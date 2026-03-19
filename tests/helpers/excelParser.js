import XLSX from "xlsx";
const SCORE_START_COL = 7;
const SCORE_END_COL = 15;
function isNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

function toInt(v, fallback = 0) {
  return isNumber(v) ? Math.trunc(v) : fallback;
}

function toScore(v) {
  return isNumber(v) && v > 0 ? Math.trunc(v) : 0;
}

function norm(v) {
  return String(v ?? "").trim().toLowerCase();
}

function detectPointsColumns(rows) {
  const r6 = rows[5] || [];
  const r7 = rows[6] || [];

  for (let c = 0; c < Math.max(r6.length, r7.length); c += 1) {
    if (
      norm(r6[c]) === "team" &&
      norm(r6[c + 1]) === "versus" &&
      norm(r6[c + 2]) === "match" &&
      norm(r6[c + 3]) === "bonus" &&
      norm(r7[c]) === "points" &&
      norm(r7[c + 1]) === "points" &&
      norm(r7[c + 2]) === "points" &&
      norm(r7[c + 3]) === "points" &&
      norm(r7[c + 4]) === "total"
    ) {
      return {
        team: c,
        versus: c + 1,
        match: c + 2,
        bonus: c + 3,
        total: c + 4,
      };
    }
  }

  // fallback to original known layout
  return { team: 30, versus: 31, match: 32, bonus: 33, total: 34 };
}

function safeSheetRows(ws) {
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
}

function getWeekFromName(sheetName) {
  const m = String(sheetName || "").match(/week\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function piFromPlayerId(teamId, playerId) {
  const id = toInt(playerId, -1);
  if (id > 0) {
    return id % 2 === 1 ? 0 : 1;
  }
  return 0;
}

function parseWeekMatchSheet(rows) {
  const pointsCols = detectPointsColumns(rows);
  const teamPoints = {};
  const currentWeekHandicaps = {};
  const rawEntries = [];
  let lastRawIdx = -1;

  for (const row of rows) {
    const teamId = toInt(row[1], -1);
    if (row[6] === "Raw" && teamId > 0) {
      const playerId = toInt(row[2], 0);
      const pi = piFromPlayerId(teamId, playerId);
      const sub = String(row[4] || "").trim().toUpperCase() === "Y";
      const phantom = String(row[5] || "").trim().toUpperCase() === "Y";
      const type = phantom ? "phantom" : sub ? "sub" : "normal";
      const scores = [];
      for (let c = SCORE_START_COL; c <= SCORE_END_COL; c += 1) scores.push(toScore(row[c]));
      rawEntries.push({ teamId, pi, type, scores, hcp: 0 });
      lastRawIdx = rawEntries.length - 1;
      continue;
    }

    if (row[6] === "Handicap" && lastRawIdx >= 0) {
      const h = toInt(row[16], 0);
      const last = rawEntries[lastRawIdx];
      const key = `${last.teamId}-${last.pi}`;
      currentWeekHandicaps[key] = h;
      rawEntries[lastRawIdx].hcp = h;
      continue;
    }

    if (
      lastRawIdx >= 0 &&
      isNumber(row[pointsCols.team]) &&
      isNumber(row[pointsCols.versus]) &&
      isNumber(row[pointsCols.match]) &&
      isNumber(row[pointsCols.bonus]) &&
      isNumber(row[pointsCols.total])
    ) {
      const t = rawEntries[lastRawIdx].teamId;
      teamPoints[t] = {
        team: toInt(row[pointsCols.team]),
        versus: toInt(row[pointsCols.versus]),
        match: toInt(row[pointsCols.match]),
        bonus: toInt(row[pointsCols.bonus]),
        total: toInt(row[pointsCols.total]),
      };
    }
  }

  const matches = new Map();
  for (let i = 0; i + 3 < rawEntries.length; i += 4) {
    const block = rawEntries.slice(i, i + 4);
    const matchIdx = Math.floor(i / 4) + 1;
    const teams = {};
    for (const p of block) {
      if (!teams[p.teamId]) {
        teams[p.teamId] = {
          players: [Array(9).fill(0), Array(9).fill(0)],
          types: ["normal", "normal"],
          hcp: [0, 0],
        };
      }
      teams[p.teamId].players[p.pi] = p.scores;
      teams[p.teamId].types[p.pi] = p.type;
      teams[p.teamId].hcp[p.pi] = p.hcp;
    }
    matches.set(matchIdx, { teams });
  }

  const results = {};
  const pairs = [];
  for (const [, m] of matches) {
    const teamIds = Object.keys(m.teams).map((x) => parseInt(x, 10)).sort((a, b) => a - b);
    if (teamIds.length !== 2) continue;
    const [tlow, thigh] = teamIds;
    pairs.push([tlow, thigh]);
    const t1 = m.teams[tlow];
    const t2 = m.teams[thigh];
    results[`${tlow}-${thigh}`] = {
      t1scores: t1.players,
      t2scores: t2.players,
      t1types: t1.types,
      t2types: t2.types,
      hcpSnapshot: {
        [tlow]: t1.hcp,
        [thigh]: t2.hcp,
      },
      rainout: false,
      holesPlayed: 6,
    };
  }

  return { results, teamPoints, pairs, currentWeekHandicaps };
}

function parseNextWeekHandicaps(rows) {
  const byPlayer = {};
  let lastPlayer = null;

  for (const row of rows) {
    const teamId = toInt(row[1], -1);
    const playerId = toInt(row[2], 0);
    if (row[6] === "Raw" && teamId > 0) {
      lastPlayer = {
        teamId,
        pi: piFromPlayerId(teamId, playerId),
      };
      continue;
    }

    if (row[6] === "Handicap" && lastPlayer) {
      const perHole = [];
      for (let c = SCORE_START_COL; c <= SCORE_END_COL; c += 1) {
        perHole.push(toInt(row[c], 0));
      }
      byPlayer[`${lastPlayer.teamId}-${lastPlayer.pi}`] = {
        total: toInt(row[16], 0),
        perHole,
      };
    }
  }

  return byPlayer;
}

function parsePoy(rows, week) {
  const header = rows.find((r) => Array.isArray(r) && r.includes("PlayerID") && r.includes("POY Total Points"));
  if (!header) return {};

  const weekCol = header.findIndex((c) => String(c || "").trim().toLowerCase() === `week${week}`.toLowerCase());
  const playerCol = header.findIndex((c) => String(c || "").trim().toLowerCase() === "playerid");

  const out = {};
  for (const row of rows) {
    const pid = toInt(row[playerCol], -1);
    if (pid <= 0) continue;
    // Workbook uses merged cells; cumulative total is the first numeric cell after the Week columns.
    const tail = row.slice(21).filter((v) => isNumber(v));
    out[pid] = {
      weekPoints: weekCol >= 0 ? toInt(row[weekCol], 0) : 0,
      totalPoints: tail.length ? toInt(tail[0], 0) : 0,
    };
  }
  return out;
}

function parseMain(rows, week) {
  const header = rows.find((r) => Array.isArray(r) && String(r[0] || "").trim().toLowerCase() === "standing");
  if (!header) return [];

  const totalCol = header.findIndex((c) => String(c || "").trim().toLowerCase() === "points");
  const teamCol = header.findIndex((c) => String(c || "").trim().toLowerCase() === "id");
  const weekCol = header.findIndex((c) => toInt(c, -1) === week);

  const out = [];
  for (const row of rows) {
    const standing = toInt(row[0], -1);
    const teamId = toInt(row[teamCol], -1);
    if (standing <= 0 || teamId <= 0) continue;
    out.push({
      standing,
      teamId,
      weekPoints: weekCol >= 0 ? toInt(row[weekCol], 0) : 0,
      totalPoints: totalCol >= 0 ? toInt(row[totalCol], 0) : 0,
    });
  }
  return out.sort((a, b) => a.standing - b.standing);
}

function parseRosterFromMain(rows) {
  const out = [];
  for (const row of rows) {
    const standing = toInt(row[0], -1);
    const tid = toInt(row[1], -1);
    if (standing <= 0 || tid <= 0) continue;

    const p1id = toInt(row[2], 0);
    const p1name = String(row[3] || "").trim();
    const p2id = toInt(row[4], 0);
    const p2name = String(row[5] || "").trim();

    if (p1id > 0) out.push({ tid, pi: 0, playerId: p1id, name: p1name || `P${p1id}`, team: `Team ${tid}` });
    if (p2id > 0) out.push({ tid, pi: 1, playerId: p2id, name: p2name || `P${p2id}`, team: `Team ${tid}` });
  }
  return out;
}

export function parseWorkbook(filePath) {
  const wb = XLSX.readFile(filePath);
  const weekSheets = wb.SheetNames.filter((n) => /week\s*\d+/i.test(n));
  if (weekSheets.length < 2) {
    throw new Error(`Expected at least two Week sheets in ${filePath}`);
  }

  const orderedWeeks = weekSheets
    .map((name) => ({ name, week: getWeekFromName(name) }))
    .filter((x) => x.week)
    .sort((a, b) => a.week - b.week);

  const thisWeek = orderedWeeks[0];
  const nextWeek = orderedWeeks[1];

  const thisRows = safeSheetRows(wb.Sheets[thisWeek.name]);
  const nextRows = safeSheetRows(wb.Sheets[nextWeek.name]);
  const poyRows = safeSheetRows(wb.Sheets.POY || wb.Sheets.Poy || wb.Sheets.poy);
  const mainRows = safeSheetRows(wb.Sheets.Main || wb.Sheets.main);

  const { results, teamPoints, pairs, currentWeekHandicaps } = parseWeekMatchSheet(thisRows);

  return {
    week: thisWeek.week,
    nextWeek: nextWeek.week,
    results,
    pairs,
    teamPoints,
    currentWeekHandicaps,
    nextWeekHandicaps: parseNextWeekHandicaps(nextRows),
    poy: parsePoy(poyRows, thisWeek.week),
    main: parseMain(mainRows, thisWeek.week),
    roster: parseRosterFromMain(mainRows),
  };
}
