import { TEAMS, ALL_PLAYERS, SCHEDULE, PAR, SI } from "../constants/league";
import { stabPts, hcpStr, getEffectiveHcp } from "./leagueLogic";

function downloadCSV(filename, rows) {
  const csv = rows.map(r =>
    r.map(cell => {
      const s = String(cell ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  ).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Standings CSV ────────────────────────────────────────────────
export function exportStandings(teamStandings) {
  const rows = [
    ["Rank", "Team", "Player 1", "Player 2", "W", "L", "T", "Match Pts", "Bonus Pts", "Total Pts", "Stab Pts"],
  ];
  teamStandings.forEach((t, i) => {
    const team = TEAMS[t.id] || {};
    rows.push([
      i + 1,
      team.name || `Team ${t.id}`,
      team.p1 || "",
      team.p2 || "",
      t.wins ?? 0,
      t.losses ?? 0,
      t.ties ?? 0,
      t.matchPts ?? 0,
      t.bonusPts ?? 0,
      t.totalPts ?? 0,
      t.stab ?? 0,
    ]);
  });
  downloadCSV("pvgc-2026-standings.csv", rows);
}

// ── Handicaps CSV ────────────────────────────────────────────────
export function exportHandicaps(league) {
  const rows = [
    ["Team", "Player", "Start HCP", "Current HCP", "Rounds Played"],
  ];
  ALL_PLAYERS.forEach(({ tid, pi, name }) => {
    const startHcp = (league.handicaps[tid] || [0, 0])[pi];
    const currentHcp = getEffectiveHcp(tid, pi, 99, league.results, league.handicaps, league.hcpOverrides || {});
    // Count rounds
    let rounds = 0;
    for (const week of Object.values(league.results || {})) {
      for (const [mk, rec] of Object.entries(week || {})) {
        if (!rec) continue;
        const parts = mk.split("-").map(Number);
        const tlow = parts[1], thigh = parts[2];
        if (tlow !== tid && thigh !== tid) continue;
        const tIdx = tid === tlow ? 0 : 1;
        const scores = (tIdx === 0 ? rec.t1scores : rec.t2scores) || [];
        const types = (tIdx === 0 ? rec.t1types : rec.t2types) || [];
        if ((types[pi] || "normal") !== "normal") continue;
        const gross = (Array.isArray(scores[pi]) ? scores[pi] : (scores[`p${pi}`] || []));
        if (gross.reduce((s, g) => s + (g || 0), 0) > 0) rounds++;
      }
    }
    rows.push([TEAMS[tid]?.name || `Team ${tid}`, name, startHcp, currentHcp, rounds]);
  });
  downloadCSV("pvgc-2026-handicaps.csv", rows);
}

// ── Scores CSV ───────────────────────────────────────────────────
export function exportScores(league) {
  const rows = [
    [
      "Week", "Date",
      "Team 1", "Player 1", "P1 H1","P1 H2","P1 H3","P1 H4","P1 H5","P1 H6","P1 H7","P1 H8","P1 H9","P1 Gross","P1 Stab",
      "Player 2", "P2 H1","P2 H2","P2 H3","P2 H4","P2 H5","P2 H6","P2 H7","P2 H8","P2 H9","P2 Gross","P2 Stab",
      "Team 2", "Player 3", "P3 H1","P3 H2","P3 H3","P3 H4","P3 H5","P3 H6","P3 H7","P3 H8","P3 H9","P3 Gross","P3 Stab",
      "Player 4", "P4 H1","P4 H2","P4 H3","P4 H4","P4 H5","P4 H6","P4 H7","P4 H8","P4 H9","P4 Gross","P4 Stab",
    ],
  ];

  const normScores = s => Array.isArray(s) ? s : [s?.p0 || [], s?.p1 || []];

  for (let w = 1; w <= 21; w++) {
    const weekResults = league.results[w] || {};
    const date = SCHEDULE[w]?.date || "";
    for (const [mk, rec] of Object.entries(weekResults)) {
      if (!rec) continue;
      const parts = mk.split("-").map(Number);
      const tlow = parts[1], thigh = parts[2];

      const buildPlayer = (tid, tIdx) => {
        const t1scores = normScores(rec.t1scores);
        const t2scores = normScores(rec.t2scores);
        const scores = tIdx === 0 ? t1scores : t2scores;
        const types = (tIdx === 0 ? rec.t1types : rec.t2types) || [];
        const snap = rec.hcpSnapshot;
        const teamName = TEAMS[tid]?.name || `Team ${tid}`;
        const rows = [];
        for (let pi = 0; pi < 2; pi++) {
          const pname = TEAMS[tid]?.[pi === 0 ? "p1" : "p2"] || "";
          const type = types[pi] || "normal";
          if (type !== "normal") {
            rows.push([pname, ...Array(9).fill(""), "", type === "sub" ? "6" : "2"]);
            continue;
          }
          const hcp = snap ? (snap[tid] || [0, 0])[pi] : (league.handicaps[tid] || [0, 0])[pi];
          const grossArr = Array.isArray(scores[pi]) ? scores[pi] : (scores[`p${pi}`] || []);
          let grossTotal = 0, stabTotal = 0;
          const holes = Array(9).fill(0).map((_, hi) => {
            const g = grossArr[hi] || 0;
            grossTotal += g;
            if (g) stabTotal += stabPts(g, PAR[hi], hcpStr(hcp, SI[hi])) || 0;
            return g || "";
          });
          rows.push([pname, ...holes, grossTotal || "", stabTotal]);
        }
        return { teamName, rows };
      };

      const t1 = buildPlayer(tlow, 0);
      const t2 = buildPlayer(thigh, 1);

      rows.push([
        w, date,
        t1.teamName, ...t1.rows[0],
        ...t1.rows[1],
        t2.teamName, ...t2.rows[0],
        ...t2.rows[1],
      ]);
    }
  }

  downloadCSV("pvgc-2026-scores.csv", rows);
}
