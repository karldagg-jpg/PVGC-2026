import { parseWorkbook } from "./excelParser.js";
import { matchKey } from "../../src/lib/leagueLogic.js";
import { toBacktestAllPlayers } from "./backtestConstants.js";
import { parseScheduleWorkbook } from "./scheduleParser.js";

function emptyHcps() {
  const out = {};
  for (let t = 1; t <= 18; t += 1) out[t] = [0, 0];
  return out;
}

export function loadBacktestData(maxWeek = 8) {
  const scheduleData = parseScheduleWorkbook("tests/data/schedule.xlsx");
  const weeks = [];
  const allResults = {};
  const schedule = scheduleData?.schedule || {};
  const teams = scheduleData?.teams || {};
  const startHcps = emptyHcps();
  let allPlayers = [];
  let roster = [];

  for (let week = 1; week <= maxWeek; week += 1) {
    const parsed = parseWorkbook(`tests/data/week${week}.xlsx`);
    const weekResults = {};
    const pairList = [];

    for (const [pairKey, rec] of Object.entries(parsed.results)) {
      const [ta, tb] = pairKey.split("-").map((n) => parseInt(n, 10));
      weekResults[matchKey(week, ta, tb)] = rec;
      pairList.push([ta, tb]);
    }

    if (week === 1) {
      for (const [key, hcp] of Object.entries(parsed.currentWeekHandicaps)) {
        const [tid, pi] = key.split("-").map((n) => parseInt(n, 10));
        startHcps[tid][pi] = hcp;
      }
      roster = parsed.roster || [];
      allPlayers = toBacktestAllPlayers(roster);
    }
    if (!schedule[week]) {
      schedule[week] = { week, date: null, pairs: pairList };
    }
    allResults[week] = weekResults;
    weeks.push({
      week,
      nextWeek: parsed.nextWeek,
      weekResults,
      expectedTeamPoints: parsed.teamPoints,
      expectedMain: parsed.main,
      expectedPoy: parsed.poy,
      expectedNextWeekHandicaps: parsed.nextWeekHandicaps,
    });
  }

  // If schedule workbook provided team names, reflect those in test player constants.
  if (allPlayers.length && Object.keys(teams).length) {
    allPlayers = allPlayers.map((p) => {
      const t = teams[p.tid];
      if (!t) return p;
      return {
        ...p,
        team: t.name,
        name: p.pi === 0 ? t.p1 : t.p2,
      };
    });
  }

  return {
    weeks,
    schedule,
    teams,
    startHcps,
    allPlayers,
    league: {
      handicaps: startHcps,
      results: allResults,
      hcpOverrides: {},
    },
  };
}
