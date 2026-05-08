import React, { useMemo, useState } from "react";
import { PAR, SI, RAINOUT_SUB, SCHEDULE, TEAMS, DEFAULT_HCP } from "../constants/league";
import {
  stabPts, hcpStr, calcSuggestedHcps,
  computePlayerTotal, isMatchComplete, isWeekCancelled,
} from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD2, FD, FB } from "../constants/theme";
import { fmtDate } from "../lib/format";

const N_SIMS          = 5000;
const N_SCORECARD_SIMS = 1500;
const COLOR_A  = "#1a6b3a";
const COLOR_B  = "#b06020";
const COLOR_TIE = "#555";

function normS(s) {
  if (!s) return [[], []];
  if (Array.isArray(s)) return s;
  return [s.p0 || [], s.p1 || []];
}

function buildPlayerHoleDists(results, handicaps, beforeWeek = 99) {
  const dists = {};
  for (let tid = 1; tid <= 18; tid++)
    for (let pi = 0; pi < 2; pi++)
      dists[`${tid}-${pi}`] = Array.from({ length: 9 }, () => ({
        eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0, n: 0,
      }));

  for (const [wStr, weekRecs] of Object.entries(results || {})) {
    if (parseInt(wStr) >= beforeWeek) continue;
    for (const [mk, rec] of Object.entries(weekRecs || {})) {
      if (!rec) continue;
      const parts = mk.split("-");
      const tlow = parseInt(parts[1]), thigh = parseInt(parts[2]);
      const snap = rec.hcpSnapshot || {};

      [[tlow, normS(rec.t1scores), rec.t1types],
       [thigh, normS(rec.t2scores), rec.t2types]].forEach(([tid, scores, types]) => {
        for (let pi = 0; pi < 2; pi++) {
          const type = (types || [])[pi] || "normal";
          if (type !== "normal") continue;
          const hcp = (snap[tid] || handicaps?.[tid] || [0, 0])[pi] || 0;
          const gr  = scores[pi] || [];
          const key = `${tid}-${pi}`;
          for (let hi = 0; hi < 9; hi++) {
            let g = gr[hi] || 0;
            if (!g && rec.rainout && RAINOUT_SUB?.[hi] != null) g = gr[RAINOUT_SUB[hi]] || 0;
            if (!g) continue;
            const diff = g - PAR[hi];
            const d = dists[key][hi];
            d.n++;
            if (diff <= -2)       d.eagle++;
            else if (diff === -1) d.birdie++;
            else if (diff ===  0) d.par++;
            else if (diff ===  1) d.bogey++;
            else if (diff ===  2) d.double++;
            else                  d.triple++;
          }
        }
      });
    }
  }
  return dists;
}

function sampleGross(holeDist, par) {
  const cats   = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  const deltas = [-2, -1, 0, 1, 2, 3];
  const total  = cats.reduce((s, c) => s + holeDist[c], 0);
  if (total === 0) return par + 1;
  const r = Math.random() * total;
  let cum = 0;
  for (let i = 0; i < cats.length; i++) {
    cum += holeDist[cats[i]];
    if (r <= cum) return par + deltas[i];
  }
  return par + 3;
}

function simulateMatchup(tidA, tidB, playerDists, handicaps, matchRec, nSims = N_SIMS) {
  const hcpA = handicaps[tidA] || DEFAULT_HCP[tidA] || [0, 0];
  const hcpB = handicaps[tidB] || DEFAULT_HCP[tidB] || [0, 0];

  const piA_lo = hcpA[0] <= hcpA[1] ? 0 : 1;
  const piB_lo = hcpB[0] <= hcpB[1] ? 0 : 1;
  const pairings = [
    { piA: piA_lo,      piB: piB_lo,      label: "Lo" },
    { piA: 1 - piA_lo, piB: 1 - piB_lo, label: "Hi" },
  ];

  const typesA = matchRec?.t1types || [];
  const typesB = matchRec?.t2types || [];
  const fixedA = [0, 1].map(pi => { const t = typesA[pi] || "normal"; return t === "sub" ? 6 : t === "phantom" ? 2 : null; });
  const fixedB = [0, 1].map(pi => { const t = typesB[pi] || "normal"; return t === "sub" ? 6 : t === "phantom" ? 2 : null; });

  const scoresA = matchRec ? normS(matchRec.t1scores) : [[], []];
  const scoresB = matchRec ? normS(matchRec.t2scores) : [[], []];

  const earnedA = [0, 1].map(pi => {
    if (fixedA[pi] !== null) return fixedA[pi];
    let pts = 0;
    const gr = scoresA[pi] || [];
    for (let hi = 0; hi < 9; hi++) { const g = gr[hi] || 0; if (!g) continue; pts += stabPts(g, PAR[hi], hcpStr(hcpA[pi] || 0, SI[hi])) || 0; }
    return pts;
  });
  const earnedB = [0, 1].map(pi => {
    if (fixedB[pi] !== null) return fixedB[pi];
    let pts = 0;
    const gr = scoresB[pi] || [];
    for (let hi = 0; hi < 9; hi++) { const g = gr[hi] || 0; if (!g) continue; pts += stabPts(g, PAR[hi], hcpStr(hcpB[pi] || 0, SI[hi])) || 0; }
    return pts;
  });

  const holesLeft = [];
  for (let hi = 0; hi < 9; hi++) {
    const aDone = [0, 1].every(pi => fixedA[pi] !== null || (scoresA[pi]?.[hi] || 0) > 0);
    const bDone = [0, 1].every(pi => fixedB[pi] !== null || (scoresB[pi]?.[hi] || 0) > 0);
    if (!aDone || !bDone) holesLeft.push(hi);
  }

  const holesPlayed = 9 - holesLeft.length;
  const isLive     = matchRec != null && holesPlayed > 0 && holesLeft.length > 0;
  const isComplete = matchRec != null && holesLeft.length === 0;

  let aWins = 0, bWins = 0, ties = 0, aTotalPts = 0, bTotalPts = 0;
  const pWins = [0, 0], pLoss = [0, 0], pTies = [0, 0];
  const aStabSum = [0, 0], bStabSum = [0, 0];
  let aTeamStabSum = 0, bTeamStabSum = 0;
  let teamWins = 0, teamLoss = 0, teamTies = 0;

  for (let sim = 0; sim < nSims; sim++) {
    const ppA = [...earnedA], ppB = [...earnedB];

    for (const hi of holesLeft) {
      for (let piA = 0; piA < 2; piA++) {
        if (fixedA[piA] !== null) continue;
        ppA[piA] += stabPts(sampleGross(playerDists[`${tidA}-${piA}`][hi], PAR[hi]), PAR[hi], hcpStr(hcpA[piA] || 0, SI[hi])) || 0;
      }
      for (let piB = 0; piB < 2; piB++) {
        if (fixedB[piB] !== null) continue;
        ppB[piB] += stabPts(sampleGross(playerDists[`${tidB}-${piB}`][hi], PAR[hi]), PAR[hi], hcpStr(hcpB[piB] || 0, SI[hi])) || 0;
      }
    }

    const teamA = ppA[0] + ppA[1], teamB = ppB[0] + ppB[1];
    aStabSum[0] += ppA[0]; aStabSum[1] += ppA[1];
    bStabSum[0] += ppB[0]; bStabSum[1] += ppB[1];
    aTeamStabSum += teamA; bTeamStabSum += teamB;

    let mA = 0, mB = 0;
    for (let p = 0; p < 2; p++) {
      const pA = ppA[pairings[p].piA], pB = ppB[pairings[p].piB];
      if (pA > pB) { mA += 2; pWins[p]++; } else if (pB > pA) { mB += 2; pLoss[p]++; } else { mA++; mB++; pTies[p]++; }
    }
    if (teamA > teamB) { mA += 4; teamWins++; } else if (teamB > teamA) { mB += 4; teamLoss++; } else { mA += 2; mB += 2; teamTies++; }
    if (mA > mB) aWins++; else if (mB > mA) bWins++; else ties++;
    aTotalPts += mA; bTotalPts += mB;
  }

  return {
    aWinPct: aWins / nSims, bWinPct: bWins / nSims, tiePct: ties / nSims,
    aAvgPts: aTotalPts / nSims, bAvgPts: bTotalPts / nSims,
    aAvgStab: aStabSum.map(s => s / nSims), bAvgStab: bStabSum.map(s => s / nSims),
    aAvgTeamStab: aTeamStabSum / nSims, bAvgTeamStab: bTeamStabSum / nSims,
    teamWinPct: teamWins / nSims, teamLossPct: teamLoss / nSims, teamTiePct: teamTies / nSims,
    holesPlayed, holesLeft: holesLeft.length, isLive, isComplete,
    currentPtsA: earnedA[0] + earnedA[1], currentPtsB: earnedB[0] + earnedB[1],
    currentIndivA: [...earnedA], currentIndivB: [...earnedB],
    piA_lo, piB_lo,
    pairings: pairings.map((p, i) => ({
      ...p,
      aWinPct: pWins[i] / nSims, bWinPct: pLoss[i] / nSims, tiePct: pTies[i] / nSims,
    })),
  };
}

// Retroactively compute predictor accuracy for all completed weeks.
// For each completed matchup, simulates using only prior-week data (same
// as a real pre-week prediction), then compares to actual scored result.
function computeScorecard(results, handicaps) {
  const entries = [];

  for (let w = 1; w <= 17; w++) {
    const pairs = SCHEDULE[w]?.pairs || [];
    if (!pairs.length || isWeekCancelled(results[w])) continue;

    const completePairs = pairs.filter(([ta, tb]) => {
      const mk = `${w}-${Math.min(ta, tb)}-${Math.max(ta, tb)}`;
      return isMatchComplete(results[w]?.[mk]);
    });
    if (!completePairs.length) continue;

    // Build distributions and handicaps once per week — same inputs the live predictor uses
    const dists = buildPlayerHoleDists(results, handicaps, w);
    const wHcps = calcSuggestedHcps(results, w, handicaps);

    for (const [ta, tb] of completePairs) {
      const mk  = `${w}-${Math.min(ta, tb)}-${Math.max(ta, tb)}`;
      const rec = results[w][mk];

      // Pure pre-round simulation (no matchRec so no actual scores bleed in)
      const sim = simulateMatchup(ta, tb, dists, wHcps, null, N_SCORECARD_SIMS);

      // Actual result — derive lo/hi order from hcpSnapshot stored with the record
      const snap = rec.hcpSnapshot || {};
      const snapA = snap[ta] ?? snap[String(ta)];
      const snapB = snap[tb] ?? snap[String(tb)];
      const piA_lo = snapA
        ? ((snapA[0] || 0) <= (snapA[1] || 0) ? 0 : 1)
        : ((wHcps[ta]?.[0] || 0) <= (wHcps[ta]?.[1] || 0) ? 0 : 1);
      const piB_lo = snapB
        ? ((snapB[0] || 0) <= (snapB[1] || 0) ? 0 : 1)
        : ((wHcps[tb]?.[0] || 0) <= (wHcps[tb]?.[1] || 0) ? 0 : 1);

      // ta is always tlow (lower id) so tIdx=0; tb is thigh, tIdx=1
      const pA_lo = computePlayerTotal(rec, 0, piA_lo,     ta, handicaps);
      const pA_hi = computePlayerTotal(rec, 0, 1 - piA_lo, ta, handicaps);
      const pB_lo = computePlayerTotal(rec, 1, piB_lo,     tb, handicaps);
      const pB_hi = computePlayerTotal(rec, 1, 1 - piB_lo, tb, handicaps);
      const teamA = pA_lo + pA_hi, teamB = pB_lo + pB_hi;

      let mA = 0, mB = 0;
      if (pA_lo > pB_lo) mA += 2; else if (pB_lo > pA_lo) mB += 2; else { mA++; mB++; }
      if (pA_hi > pB_hi) mA += 2; else if (pB_hi > pA_hi) mB += 2; else { mA++; mB++; }
      if (teamA > teamB) mA += 4;  else if (teamB > teamA) mB += 4;  else { mA += 2; mB += 2; }

      const actual = {
        lo:      pA_lo > pB_lo  ? "a" : pB_lo > pA_lo  ? "b" : "tie",
        hi:      pA_hi > pB_hi  ? "a" : pB_hi > pA_hi  ? "b" : "tie",
        team:    teamA > teamB  ? "a" : teamB > teamA  ? "b" : "tie",
        overall: mA > mB        ? "a" : mB > mA        ? "b" : "tie",
      };
      const pred = {
        lo:      sim.pairings[0].aWinPct >= sim.pairings[0].bWinPct ? "a" : "b",
        hi:      sim.pairings[1].aWinPct >= sim.pairings[1].bWinPct ? "a" : "b",
        team:    sim.teamWinPct  >= sim.teamLossPct  ? "a" : "b",
        overall: sim.aWinPct    >= sim.bWinPct       ? "a" : "b",
      };
      const conf = {
        lo:      Math.max(sim.pairings[0].aWinPct, sim.pairings[0].bWinPct),
        hi:      Math.max(sim.pairings[1].aWinPct, sim.pairings[1].bWinPct),
        team:    Math.max(sim.teamWinPct, sim.teamLossPct),
        overall: Math.max(sim.aWinPct, sim.bWinPct),
      };

      entries.push({
        week: w, ta, tb, piA_lo, piB_lo,
        actual, pred, conf,
        correct: {
          lo:      pred.lo      === actual.lo,
          hi:      pred.hi      === actual.hi,
          team:    pred.team    === actual.team,
          overall: pred.overall === actual.overall,
        },
        scores: { pA_lo, pA_hi, pB_lo, pB_hi, teamA, teamB, mA, mB },
      });
    }
  }
  return entries;
}

// ── Shared UI components ──────────────────────────────────────────

function playerRounds(dists, tid, pi) {
  return Math.max(...(dists[`${tid}-${pi}`] || []).map(h => h.n), 0);
}

function ProbBar({ aWin, tie, bWin, small }) {
  const h  = small ? "14px" : "24px";
  const fs = small ? "9px"  : "11px";
  return (
    <div style={{ display: "flex", height: h, borderRadius: "5px", overflow: "hidden", width: "100%" }}>
      {[{ val: aWin, color: COLOR_A }, { val: tie, color: COLOR_TIE }, { val: bWin, color: COLOR_B }]
        .map(({ val, color }, i) => val > 0 && (
          <div key={i} style={{ width: `${val * 100}%`, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {val >= 0.08 && <span style={{ fontSize: fs, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>{Math.round(val * 100)}%</span>}
          </div>
        ))}
    </div>
  );
}

function ConfidenceDot({ rounds }) {
  return (
    <span title={rounds === 0 ? "No data" : `${rounds} rounds`} style={{
      display: "inline-block", width: "7px", height: "7px", borderRadius: "50%",
      background: rounds >= 4 ? G : rounds >= 2 ? GO : R,
      marginLeft: "4px", verticalAlign: "middle",
    }} />
  );
}

function LiveTag({ holesPlayed, holesLeft }) {
  return <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", padding: "2px 7px", borderRadius: "6px", background: G + "33", color: G, border: `1px solid ${G}55` }}>LIVE · H{holesPlayed} played · {holesLeft} left</span>;
}
function CompleteTag() {
  return <span style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", padding: "2px 7px", borderRadius: "6px", background: GOLD + "22", color: GOLD, border: `1px solid ${GOLD}44` }}>FINAL</span>;
}

// ── Scorecard tab ─────────────────────────────────────────────────

function AccCell({ correct, conf, scoreA, scoreB }) {
  const color = correct ? G : R;
  return (
    <td style={{ padding: "7px 8px", textAlign: "center", verticalAlign: "top" }}>
      <div style={{ fontSize: "15px", fontWeight: 700, color }}>{correct ? "✓" : "✗"}</div>
      <div style={{ fontSize: "9px", color: M }}>{Math.round(conf * 100)}% conf</div>
      {scoreA != null && (
        <div style={{ fontSize: "9px", color: M, marginTop: "1px" }}>
          <span style={{ color: scoreA > scoreB ? G : CREAM }}>{scoreA}</span>
          <span style={{ color: M }}> · </span>
          <span style={{ color: scoreB > scoreA ? G : CREAM }}>{scoreB}</span>
        </div>
      )}
    </td>
  );
}

function ScorecardView({ entries }) {
  if (!entries.length) {
    return (
      <div style={{ textAlign: "center", color: M, padding: "40px 0", fontSize: "14px" }}>
        No completed weeks yet — come back after Week 1 is scored.
      </div>
    );
  }

  // Aggregate accuracy across all categories
  const totals = { lo: [0, 0], hi: [0, 0], team: [0, 0], overall: [0, 0] };
  entries.forEach(e => {
    ["lo", "hi", "team", "overall"].forEach(k => {
      totals[k][1]++;
      if (e.correct[k]) totals[k][0]++;
    });
  });

  const pct = ([c, t]) => t ? `${Math.round(c / t * 100)}%` : "—";

  // Group by week
  const byWeek = {};
  entries.forEach(e => { (byWeek[e.week] = byWeek[e.week] || []).push(e); });

  return (
    <div>
      {/* Summary pills */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {[
          { label: "Overall",  key: "overall" },
          { label: "Lo match", key: "lo" },
          { label: "Hi match", key: "hi" },
          { label: "Team",     key: "team" },
        ].map(({ label, key }) => {
          const [c, t] = totals[key];
          const p = t ? c / t : 0;
          const col = p >= 0.65 ? G : p >= 0.5 ? GO : R;
          return (
            <div key={key} style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "10px", padding: "8px 14px", minWidth: "90px" }}>
              <div style={{ fontSize: "10px", color: M, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>{label}</div>
              <div style={{ fontSize: "22px", fontWeight: 700, color: col }}>{pct(totals[key])}</div>
              <div style={{ fontSize: "10px", color: M }}>{c} / {t}</div>
            </div>
          );
        })}
      </div>

      {/* Per-week tables */}
      {Object.entries(byWeek).map(([w, wEntries]) => {
        const weekCorrect = wEntries.filter(e => e.correct.overall).length;
        return (
          <div key={w} style={{ marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: CREAM }}>Week {w}</span>
              <span style={{ fontSize: "12px", color: M }}>{fmtDate(SCHEDULE[w]?.date)}</span>
              <span style={{ fontSize: "11px", color: weekCorrect / wEntries.length >= 0.6 ? G : M, marginLeft: "auto" }}>
                {weekCorrect}/{wEntries.length} overall correct
              </span>
            </div>
            <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "480px" }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${GOLD}33` }}>
                      {["Matchup", "Lo", "Hi", "Team", "Overall"].map((h, i) => (
                        <td key={i} style={{ padding: "7px 8px", color: M, fontSize: "10px", letterSpacing: "0.07em", textTransform: "uppercase", textAlign: i === 0 ? "left" : "center" }}>{h}</td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {wEntries.map((e, idx) => {
                      const tA = TEAMS[e.ta], tB = TEAMS[e.tb];
                      const pnA = pi => pi === 0 ? tA?.p1 : tA?.p2;
                      const pnB = pi => pi === 0 ? tB?.p1 : tB?.p2;
                      const { pA_lo, pA_hi, pB_lo, pB_hi, teamA, teamB } = e.scores;
                      return (
                        <tr key={idx} style={{ borderBottom: idx < wEntries.length - 1 ? `1px solid ${GOLD}11` : "none" }}>
                          <td style={{ padding: "7px 8px", verticalAlign: "top" }}>
                            <div style={{ fontSize: "12px", fontWeight: 600, color: CREAM }}>{tA?.name}</div>
                            <div style={{ fontSize: "10px", color: M }}>
                              {pnA(e.piA_lo)} · {pnA(1 - e.piA_lo)}
                            </div>
                            <div style={{ fontSize: "11px", color: M, marginTop: "3px" }}>vs {tB?.name}</div>
                            <div style={{ fontSize: "10px", color: M }}>
                              {pnB(e.piB_lo)} · {pnB(1 - e.piB_lo)}
                            </div>
                          </td>
                          <AccCell correct={e.correct.lo}      conf={e.conf.lo}      scoreA={pA_lo}  scoreB={pB_lo} />
                          <AccCell correct={e.correct.hi}      conf={e.conf.hi}      scoreA={pA_hi}  scoreB={pB_hi} />
                          <AccCell correct={e.correct.team}    conf={e.conf.team}    scoreA={teamA}  scoreB={teamB} />
                          <AccCell correct={e.correct.overall} conf={e.conf.overall} scoreA={null}   scoreB={null} />
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: "11px", color: M, textAlign: "center", marginTop: "8px" }}>
        Retroactive simulation uses {N_SCORECARD_SIMS.toLocaleString()} runs per matchup with prior-week data only.
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function PredictScreen({ league }) {
  const [tab, setTab] = useState("predict");

  const defaultWeek = useMemo(() => {
    for (let w = 1; w <= 17; w++) {
      const pairs = SCHEDULE[w]?.pairs || [];
      if (!pairs.length) continue;
      const [ta, tb] = pairs[0];
      const mk = `${w}-${Math.min(ta, tb)}-${Math.max(ta, tb)}`;
      if (!league.results[w]?.[mk]) return w;
    }
    return 1;
  }, []);

  const [week, setWeek] = useState(defaultWeek);

  const weekHcps = useMemo(
    () => calcSuggestedHcps(league.results, week, league.handicaps),
    [league.results, league.handicaps, week]
  );
  const playerDists = useMemo(
    () => buildPlayerHoleDists(league.results, league.handicaps, week),
    [league.results, league.handicaps, week]
  );
  const simResults = useMemo(() => {
    const pairs = SCHEDULE[week]?.pairs || [];
    return pairs.map(([ta, tb]) => {
      const mk = `${week}-${Math.min(ta, tb)}-${Math.max(ta, tb)}`;
      const matchRec = league.results[week]?.[mk] || null;
      return { ta, tb, ...simulateMatchup(ta, tb, playerDists, weekHcps, matchRec) };
    });
  }, [week, playerDists, weekHcps, league.results]);

  // Scorecard computed once and cached; only runs when results/handicaps change
  const scorecardEntries = useMemo(
    () => computeScorecard(league.results, league.handicaps),
    [league.results, league.handicaps]
  );

  const weekDate = SCHEDULE[week]?.date
    ? new Date(SCHEDULE[week].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";
  const anyLive = simResults.some(r => r.isLive || r.isComplete);

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "28px", fontWeight: 600, color: CREAM, marginBottom: "4px" }}>
        Match Predictor
      </div>

      {/* Tab switcher */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "18px" }}>
        {[{ key: "predict", label: "Predict" }, { key: "scorecard", label: "Scorecard" }].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "6px 14px", borderRadius: "20px", fontFamily: FB, fontSize: "13px",
            letterSpacing: "0.07em", textTransform: "uppercase", cursor: "pointer",
            border: tab === key ? `1px solid ${GO}` : `1px solid ${GOLD}33`,
            background: tab === key ? GO + "22" : "transparent",
            color: tab === key ? GO : M,
          }}>{label}</button>
        ))}
      </div>

      {/* ── Predict tab ── */}
      {tab === "predict" && (
        <>
          <div style={{ color: M, fontSize: "13px", marginBottom: "18px" }}>
            Monte Carlo · {N_SIMS.toLocaleString()} runs per matchup
            {anyLive ? " · live: simulating remaining holes only" : " · based on per-player hole history"}
          </div>

          {/* Week selector */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "22px" }}>
            <button onClick={() => setWeek(w => Math.max(1, w - 1))} disabled={week <= 1}
              style={{ padding: "6px 12px", borderRadius: "8px", border: `1px solid ${GOLD}44`, background: CARD2, color: week <= 1 ? M : CREAM, cursor: week <= 1 ? "default" : "pointer", fontFamily: FB }}>◀</button>
            <div style={{ textAlign: "center", minWidth: "140px" }}>
              <div style={{ fontSize: "18px", fontWeight: 700, color: CREAM }}>Week {week}</div>
              {weekDate && <div style={{ fontSize: "12px", color: M }}>{weekDate}</div>}
            </div>
            <button onClick={() => setWeek(w => Math.min(17, w + 1))} disabled={week >= 17}
              style={{ padding: "6px 12px", borderRadius: "8px", border: `1px solid ${GOLD}44`, background: CARD2, color: week >= 17 ? M : CREAM, cursor: week >= 17 ? "default" : "pointer", fontFamily: FB }}>▶</button>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: "14px", marginBottom: "14px", alignItems: "center", flexWrap: "wrap" }}>
            {[{ color: COLOR_A, label: "Home win" }, { color: COLOR_TIE, label: "Tie" }, { color: COLOR_B, label: "Away win" }].map(({ color, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: color }} />
                <span style={{ fontSize: "11px", color: M }}>{label}</span>
              </div>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
              {[{ color: G, label: "4+ rds" }, { color: GO, label: "2-3 rds" }, { color: R, label: "<2 rds" }].map(({ color, label }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: color }} />
                  <span style={{ fontSize: "10px", color: M }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Matchup cards */}
          <div style={{ display: "grid", gap: "10px" }}>
            {simResults.map(({
              ta, tb, aWinPct, bWinPct, tiePct, aAvgPts, bAvgPts,
              aAvgStab, bAvgStab, aAvgTeamStab, bAvgTeamStab,
              teamWinPct, teamLossPct, teamTiePct,
              holesPlayed, holesLeft, isLive, isComplete,
              currentPtsA, currentPtsB, currentIndivA, currentIndivB,
              pairings: indiv,
            }) => {
              const teamA = TEAMS[ta], teamB = TEAMS[tb];
              const edgeColor = aWinPct > bWinPct ? COLOR_A : bWinPct > aWinPct ? COLOR_B : COLOR_TIE;
              const pnA = pi => pi === 0 ? teamA?.p1 : teamA?.p2;
              const pnB = pi => pi === 0 ? teamB?.p1 : teamB?.p2;

              const mk = `${week}-${Math.min(ta, tb)}-${Math.max(ta, tb)}`;
              const rec = league.results[week]?.[mk];
              const typesA = (ta < tb ? rec?.t1types : rec?.t2types) || [];
              const typesB = (ta < tb ? rec?.t2types : rec?.t1types) || [];
              const typeTag = (types, pi) => {
                const t = types[pi];
                if (t === "sub")     return <span style={{ marginLeft: "4px", fontSize: "9px", color: GO }}>(Sub)</span>;
                if (t === "phantom") return <span style={{ marginLeft: "4px", fontSize: "9px", color: M }}>(Phantom)</span>;
                return null;
              };

              const StabRow = ({ piA, piB, label, aWin, aTie, bWin }) => {
                const expA = isLive || isComplete ? currentIndivA[piA] : aAvgStab[piA];
                const expB = isLive || isComplete ? currentIndivB[piB] : bAvgStab[piB];
                return (
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ fontSize: "22px", fontWeight: 700, color: expA > expB ? G : CREAM, lineHeight: 1 }}>
                          {(isLive || isComplete) ? expA : expA.toFixed(1)}
                        </span>
                        <div>
                          <div style={{ fontSize: "11px", color: CREAM, fontWeight: 600 }}>{pnA(piA)}</div>
                          <div style={{ fontSize: "9px", color: M }}>
                            {typeTag(typesA, piA) ? ((typesA[piA] === "sub" ? "Sub · 6" : "Phantom · 2") + " pts fixed") : `hcp ${(weekHcps[ta] || [0, 0])[piA]}`}
                          </div>
                        </div>
                      </div>
                      <span style={{ fontSize: "9px", color: M, background: GOLD + "22", padding: "2px 8px", borderRadius: "4px", flexShrink: 0 }}>{label}</span>
                      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", justifyContent: "flex-end", flexDirection: "row-reverse" }}>
                        <span style={{ fontSize: "22px", fontWeight: 700, color: expB > expA ? G : CREAM, lineHeight: 1 }}>
                          {(isLive || isComplete) ? expB : expB.toFixed(1)}
                        </span>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "11px", color: CREAM, fontWeight: 600 }}>{pnB(piB)}</div>
                          <div style={{ fontSize: "9px", color: M }}>
                            {typeTag(typesB, piB) ? ((typesB[piB] === "sub" ? "Sub · 6" : "Phantom · 2") + " pts fixed") : `hcp ${(weekHcps[tb] || [0, 0])[piB]}`}
                          </div>
                        </div>
                      </div>
                    </div>
                    {!isComplete && <ProbBar aWin={aWin} tie={aTie} bWin={bWin} small />}
                  </div>
                );
              };

              return (
                <div key={`${ta}-${tb}`} style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderLeft: `3px solid ${edgeColor}`, borderRadius: "12px", padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: CREAM }}>{teamA?.name}</div>
                      <div style={{ fontSize: "11px", color: M }}>
                        <ConfidenceDot rounds={playerRounds(playerDists, ta, 0)} />{" "}{pnA(0)} · {pnA(1)}{" "}
                        <ConfidenceDot rounds={playerRounds(playerDists, ta, 1)} />
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "0 10px" }}>
                      <span style={{ fontSize: "11px", color: M, fontWeight: 600 }}>vs</span>
                      {isLive     && <LiveTag holesPlayed={holesPlayed} holesLeft={holesLeft} />}
                      {isComplete && <CompleteTag />}
                    </div>
                    <div style={{ flex: 1, textAlign: "right" }}>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: CREAM }}>{teamB?.name}</div>
                      <div style={{ fontSize: "11px", color: M }}>
                        <ConfidenceDot rounds={playerRounds(playerDists, tb, 0)} />{" "}{pnB(0)} · {pnB(1)}{" "}
                        <ConfidenceDot rounds={playerRounds(playerDists, tb, 1)} />
                      </div>
                    </div>
                  </div>

                  {(isLive || isComplete) && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", padding: "6px 10px", background: GOLD + "11", borderRadius: "7px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: currentPtsA >= currentPtsB ? G : CREAM }}>{currentPtsA} stab pts</span>
                      <span style={{ fontSize: "11px", color: M }}>{isComplete ? "Final score" : `After H${holesPlayed}`}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: currentPtsB > currentPtsA ? G : CREAM }}>{currentPtsB} stab pts</span>
                    </div>
                  )}

                  {indiv.map((p, i) => (
                    <StabRow key={i} piA={p.piA} piB={p.piB} label={p.label + " match"} aWin={p.aWinPct} aTie={p.tiePct} bWin={p.bWinPct} />
                  ))}

                  <div style={{ borderTop: `1px solid ${GOLD}22`, paddingTop: "8px", marginBottom: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: "22px", fontWeight: 700, color: (isLive || isComplete ? currentPtsA : aAvgTeamStab) >= (isLive || isComplete ? currentPtsB : bAvgTeamStab) ? G : CREAM }}>
                          {isLive || isComplete ? currentPtsA : aAvgTeamStab.toFixed(1)}
                        </span>
                      </div>
                      <span style={{ fontSize: "9px", color: M, background: GOLD + "22", padding: "2px 8px", borderRadius: "4px", flexShrink: 0 }}>
                        {isLive ? `team total · H${holesPlayed}` : isComplete ? "team total · final" : "team total"}
                      </span>
                      <div style={{ flex: 1, textAlign: "right" }}>
                        <span style={{ fontSize: "22px", fontWeight: 700, color: (isLive || isComplete ? currentPtsB : bAvgTeamStab) > (isLive || isComplete ? currentPtsA : aAvgTeamStab) ? G : CREAM }}>
                          {isLive || isComplete ? currentPtsB : bAvgTeamStab.toFixed(1)}
                        </span>
                      </div>
                    </div>
                    {!isComplete && <ProbBar aWin={teamWinPct} tie={teamTiePct} bWin={teamLossPct} small />}
                  </div>

                  <div style={{ borderTop: `1px solid ${GOLD}22`, paddingTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "18px", fontWeight: 700, color: aWinPct >= bWinPct ? G : CREAM }}>{aAvgPts.toFixed(1)}</span>
                      <span style={{ fontSize: "10px", color: M }}> / 8</span>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "9px", color: M, marginBottom: "3px" }}>inferred match pts · {Math.round(aWinPct * 100)}% / {Math.round(tiePct * 100)}% / {Math.round(bWinPct * 100)}%</div>
                      <ProbBar aWin={aWinPct} tie={tiePct} bWin={bWinPct} />
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "18px", fontWeight: 700, color: bWinPct > aWinPct ? G : CREAM }}>{bAvgPts.toFixed(1)}</span>
                      <span style={{ fontSize: "10px", color: M }}> / 8</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: "16px", fontSize: "11px", color: M, textAlign: "center" }}>
            Based on per-player per-hole scoring distributions from prior weeks. Results vary each run.
          </div>
        </>
      )}

      {/* ── Scorecard tab ── */}
      {tab === "scorecard" && (
        <>
          <div style={{ color: M, fontSize: "13px", marginBottom: "18px" }}>
            How accurate was the predictor? Each week re-simulated using only data available before that round.
          </div>
          <ScorecardView entries={scorecardEntries} />
        </>
      )}
    </div>
  );
}
