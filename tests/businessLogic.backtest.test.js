import { describe, it, expect, beforeAll } from "vitest";
import { SI } from "../src/constants/league.js";
import {
  calcLeagueStats,
  calcWeekBonus,
  computeTeamTotal,
  getOpponent,
  hcpStr,
  matchKey,
  getEffectiveHcp,
} from "../src/lib/leagueLogic.js";
import { loadBacktestData } from "./helpers/backtestDataset.js";

function sortedStandings(teamStats) {
  return Object.entries(teamStats)
    .map(([id, s]) => ({ id: parseInt(id, 10), ...s }))
    .sort((a, b) => b.totalPts - a.totalPts || b.stab - a.stab);
}

function stablefordForTeam(week, teamId, results, handicaps, schedule) {
  const opp = getOpponent(teamId, week, null, schedule);
  if (!opp) return 0;
  const [tlow, thigh] = teamId < opp ? [teamId, opp] : [opp, teamId];
  const rec = results[week]?.[matchKey(week, tlow, thigh)];
  if (!rec) return 0;
  return teamId === tlow
    ? computeTeamTotal(rec, 0, tlow, handicaps)
    : computeTeamTotal(rec, 1, thigh, handicaps);
}

describe("Backtest parity vs weekly workbooks", () => {
  let weeks;
  let league;
  let schedule;
  let startHcps;
  let allPlayers;
  let teams;

  beforeAll(() => {
    const data = loadBacktestData(8);
    weeks = data.weeks;
    league = data.league;
    schedule = data.schedule;
    startHcps = data.startHcps;
    allPlayers = data.allPlayers;
    teams = data.teams;
  });

  it("matches weekly match/bonus totals and running standings", () => {
    for (const w of weeks) {
      const current = calcLeagueStats(league.results, league.handicaps, w.week, schedule, allPlayers, teams).teamStats;
      const prev =
        w.week > 1
          ? calcLeagueStats(league.results, league.handicaps, w.week - 1, schedule, allPlayers, teams).teamStats
          : Object.fromEntries(Array.from({ length: 18 }, (_, i) => [i + 1, { matchPts: 0, bonusPts: 0 }]));

      for (const [tidStr, expected] of Object.entries(w.expectedTeamPoints)) {
        const tid = parseInt(tidStr, 10);
        const weekMatch = current[tid].matchPts - prev[tid].matchPts;
        const weekBonus = current[tid].bonusPts - prev[tid].bonusPts;
        const weekTotal = weekMatch + weekBonus;
        const expectedMatchCombined = expected.versus + expected.match;

        expect(weekMatch, `Week ${w.week} Team ${tid} (versus+match) points`).toBe(expectedMatchCombined);
        expect(weekBonus, `Week ${w.week} Team ${tid} bonus points`).toBe(expected.bonus);
        expect(weekTotal, `Week ${w.week} Team ${tid} total points`).toBe(expected.total);

        const stab = stablefordForTeam(w.week, tid, league.results, league.handicaps, schedule);
        expect(stab, `Week ${w.week} Team ${tid} stableford total`).toBe(expected.team);
      }

      const standings = sortedStandings(current);
      for (const row of w.expectedMain) {
        const team = current[row.teamId];
        expect(team.totalPts, `Week ${w.week} Team ${row.teamId} running total`).toBe(row.totalPoints);
        expect(team.matchPts + team.bonusPts).toBe(team.totalPts);

        const rankedTeam = standings[row.standing - 1]?.id;
        expect(rankedTeam, `Week ${w.week} standing #${row.standing}`).toBe(row.teamId);
      }
    }
  });

  it("matches calcWeekBonus output for all completed weeks", () => {
    for (const w of weeks) {
      const bonus = calcWeekBonus(w.week, league.results, league.handicaps, schedule);
      expect(bonus, `Week ${w.week} bonus should be available`).toBeTruthy();
      for (const [tidStr, expected] of Object.entries(w.expectedTeamPoints)) {
        const tid = parseInt(tidStr, 10);
        expect(bonus[tid] || 0, `Week ${w.week} Team ${tid} bonus`).toBe(expected.bonus);
      }
    }
  });

  it("matches workbook POY weekly scores and winners", () => {
    for (const w of weeks) {
      const { potyList, weeklyPoty } = calcLeagueStats(league.results, league.handicaps, w.week, schedule, allPlayers, teams);
      const byPlayerId = {};
      for (const p of potyList) {
        byPlayerId[p.playerId] = p;
      }

      let bestExpectedWeek = -Infinity;
      const expectedWinners = [];

      for (const [pidStr, expected] of Object.entries(w.expectedPoy)) {
        const pid = parseInt(pidStr, 10);
        const actual = byPlayerId[pid];
        expect(actual, `Week ${w.week} missing POY player ${pid}`).toBeTruthy();

        const weekRound = (actual.rounds || []).find((r) => r.week === w.week);
        const weekPts = weekRound ? weekRound.pts : 0;

        expect(weekPts, `Week ${w.week} Player ${pid} weekly POY`).toBe(expected.weekPoints);
        if (expected.weekPoints > bestExpectedWeek) {
          bestExpectedWeek = expected.weekPoints;
          expectedWinners.length = 0;
          expectedWinners.push(pid);
        } else if (expected.weekPoints === bestExpectedWeek) {
          expectedWinners.push(pid);
        }
      }

      const weekly = weeklyPoty[w.week];
      expect(weekly, `Week ${w.week} weekly POTY exists`).toBeTruthy();
      expect(weekly.pts, `Week ${w.week} weekly POTY best score`).toBe(bestExpectedWeek);

      const winnerIds = weekly.winners.map((p) => p.playerId).sort((a, b) => a - b);
      const expectedIds = [...expectedWinners].sort((a, b) => a - b);
      expect(winnerIds, `Week ${w.week} weekly POTY winners`).toEqual(expectedIds);
    }
  });

  it("matches next-week handicap totals and per-hole stroke allocation", () => {
    for (const w of weeks) {
      const targetWeek = w.nextWeek;
      for (const [key, expected] of Object.entries(w.expectedNextWeekHandicaps)) {
        const [tid, pi] = key.split("-").map((n) => parseInt(n, 10));

        const eff = getEffectiveHcp(
          tid,
          pi,
          targetWeek,
          league.results,
          league.handicaps,
          league.hcpOverrides,
          startHcps,
          () => false
        );

        expect(eff, `Week ${w.week} -> ${targetWeek} Team ${tid} P${pi + 1} handicap`).toBe(expected.total);
        const perHole = SI.map((si) => hcpStr(eff, si));
        expect(perHole, `Week ${w.week} -> ${targetWeek} Team ${tid} P${pi + 1} per-hole`).toEqual(expected.perHole);
      }
    }

    expect(startHcps[1]).toBeDefined();
  });
});
