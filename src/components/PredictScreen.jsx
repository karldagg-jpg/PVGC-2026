import React, { useMemo, useState } from "react";
import { PAR, SI, RAINOUT_SUB, SCHEDULE, TEAMS, DEFAULT_HCP } from "../constants/league";
import { stabPts, hcpStr } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD2, FD, FB } from "../constants/theme";

const N_SIMS = 5000;
const COLOR_A = "#1a6b3a";
const COLOR_B = "#b06020";
const COLOR_TIE = "#555";

function normS(s) {
  if (!s) return [[], []];
  if (Array.isArray(s)) return s;
  return [s.p0 || [], s.p1 || []];
}

// Build per-player per-hole scoring distributions from all historical results.
// Returns { "tid-pi": Array(9) of {eagle,birdie,par,bogey,double,triple,n} }
function buildPlayerHoleDists(results, handicaps) {
  const dists = {};
  for (let tid = 1; tid <= 18; tid++) {
    for (let pi = 0; pi < 2; pi++) {
      dists[`${tid}-${pi}`] = Array.from({ length: 9 }, () => ({
        eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0, n: 0,
      }));
    }
  }

  for (const weekRecs of Object.values(results || {})) {
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
          const gr = scores[pi] || [];
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

// Sample a gross score for a hole from the observed distribution.
// Falls back to bogey if no data for this hole.
function sampleGross(holeDist, par) {
  const cats   = ["eagle", "birdie", "par", "bogey", "double", "triple"];
  const deltas = [-2, -1, 0, 1, 2, 3];
  const total  = cats.reduce((s, c) => s + holeDist[c], 0);
  if (total === 0) return par + 1; // no data: bogey fallback
  const r = Math.random() * total;
  let cum = 0;
  for (let i = 0; i < cats.length; i++) {
    cum += holeDist[cats[i]];
    if (r <= cum) return par + deltas[i];
  }
  return par + 3;
}

// Run Monte Carlo simulation for one matchup.
// Returns win%, tie%, expected pts, and per-individual-pairing breakdown.
function simulateMatchup(tidA, tidB, playerDists, handicaps) {
  const hcpA = handicaps[tidA] || DEFAULT_HCP[tidA] || [0, 0];
  const hcpB = handicaps[tidB] || DEFAULT_HCP[tidB] || [0, 0];

  // lo = lower handicap player
  const piA_lo = hcpA[0] <= hcpA[1] ? 0 : 1;
  const piA_hi = 1 - piA_lo;
  const piB_lo = hcpB[0] <= hcpB[1] ? 0 : 1;
  const piB_hi = 1 - piB_lo;

  const pairings = [
    { piA: piA_lo, piB: piB_lo },
    { piA: piA_hi, piB: piB_hi },
  ];

  let aWins = 0, bWins = 0, ties = 0;
  let aTotalPts = 0, bTotalPts = 0;
  const pWins  = [0, 0];
  const pLoss  = [0, 0];
  const pTies  = [0, 0];

  for (let sim = 0; sim < N_SIMS; sim++) {
    let teamA = 0, teamB = 0;
    const pp = [[0, 0], [0, 0]]; // pp[team][pi]

    for (let hi = 0; hi < 9; hi++) {
      for (let piA = 0; piA < 2; piA++) {
        const g   = sampleGross(playerDists[`${tidA}-${piA}`][hi], PAR[hi]);
        const pts = stabPts(g, PAR[hi], hcpStr(hcpA[piA] || 0, SI[hi])) || 0;
        pp[0][piA] += pts;
        teamA += pts;
      }
      for (let piB = 0; piB < 2; piB++) {
        const g   = sampleGross(playerDists[`${tidB}-${piB}`][hi], PAR[hi]);
        const pts = stabPts(g, PAR[hi], hcpStr(hcpB[piB] || 0, SI[hi])) || 0;
        pp[1][piB] += pts;
        teamB += pts;
      }
    }

    let mA = 0, mB = 0;
    for (let p = 0; p < 2; p++) {
      const pA = pp[0][pairings[p].piA];
      const pB = pp[1][pairings[p].piB];
      if (pA > pB)      { mA += 2; pWins[p]++; }
      else if (pB > pA) { mB += 2; pLoss[p]++; }
      else              { mA++; mB++; pTies[p]++; }
    }
    if (teamA > teamB)      mA += 4;
    else if (teamB > teamA) mB += 4;
    else                    { mA += 2; mB += 2; }

    if (mA > mB) aWins++;
    else if (mB > mA) bWins++;
    else ties++;
    aTotalPts += mA;
    bTotalPts += mB;
  }

  return {
    aWinPct:  aWins  / N_SIMS,
    bWinPct:  bWins  / N_SIMS,
    tiePct:   ties   / N_SIMS,
    aAvgPts:  aTotalPts / N_SIMS,
    bAvgPts:  bTotalPts / N_SIMS,
    pairings: pairings.map((p, i) => ({
      piA: p.piA, piB: p.piB,
      label: i === 0 ? "Lo" : "Hi",
      aWinPct: pWins[i] / N_SIMS,
      bWinPct: pLoss[i] / N_SIMS,
      tiePct:  pTies[i] / N_SIMS,
    })),
  };
}

// Returns max rounds played (proxy for data confidence) for a player
function playerRounds(dists, tid, pi) {
  const holes = dists[`${tid}-${pi}`] || [];
  return Math.max(...holes.map(h => h.n), 0);
}

function ProbBar({ aWin, tie, bWin, small }) {
  const h = small ? "14px" : "24px";
  const fs = small ? "9px" : "11px";
  return (
    <div style={{ display: "flex", height: h, borderRadius: "5px", overflow: "hidden", width: "100%" }}>
      {[
        { val: aWin, color: COLOR_A },
        { val: tie,  color: COLOR_TIE },
        { val: bWin, color: COLOR_B },
      ].map(({ val, color }, i) => val > 0 && (
        <div key={i} style={{
          width: `${val * 100}%`, background: color,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {val >= 0.08 && (
            <span style={{ fontSize: fs, color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
              {Math.round(val * 100)}%
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function ConfidenceDot({ rounds }) {
  const color = rounds >= 4 ? G : rounds >= 2 ? GO : R;
  const title = rounds === 0 ? "No data" : `${rounds} rounds`;
  return (
    <span title={title} style={{
      display: "inline-block", width: "7px", height: "7px",
      borderRadius: "50%", background: color, marginLeft: "4px", verticalAlign: "middle",
    }} />
  );
}

export default function PredictScreen({ league }) {
  // Default to the first unscored future week
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

  const playerDists = useMemo(
    () => buildPlayerHoleDists(league.results, league.handicaps),
    [league.results, league.handicaps]
  );

  const simResults = useMemo(() => {
    const pairs = SCHEDULE[week]?.pairs || [];
    return pairs.map(([ta, tb]) => ({
      ta, tb,
      ...simulateMatchup(ta, tb, playerDists, league.handicaps),
    }));
  }, [week, playerDists, league.handicaps]);

  const pairs = SCHEDULE[week]?.pairs || [];
  const weekDate = SCHEDULE[week]?.date
    ? new Date(SCHEDULE[week].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "28px", fontWeight: 600, color: CREAM, marginBottom: "4px" }}>
        Match Predictor
      </div>
      <div style={{ color: M, fontSize: "13px", marginBottom: "18px" }}>
        Monte Carlo simulation · {N_SIMS.toLocaleString()} runs per matchup · based on per-player hole-by-hole history
      </div>

      {/* Week selector */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "22px" }}>
        <button
          onClick={() => setWeek(w => Math.max(1, w - 1))}
          disabled={week <= 1}
          style={{ padding: "6px 12px", borderRadius: "8px", border: `1px solid ${GOLD}44`, background: CARD2, color: week <= 1 ? M : CREAM, cursor: week <= 1 ? "default" : "pointer", fontFamily: FB }}
        >◀</button>
        <div style={{ textAlign: "center", minWidth: "140px" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color: CREAM }}>Week {week}</div>
          {weekDate && <div style={{ fontSize: "12px", color: M }}>{weekDate}</div>}
        </div>
        <button
          onClick={() => setWeek(w => Math.min(17, w + 1))}
          disabled={week >= 17}
          style={{ padding: "6px 12px", borderRadius: "8px", border: `1px solid ${GOLD}44`, background: CARD2, color: week >= 17 ? M : CREAM, cursor: week >= 17 ? "default" : "pointer", fontFamily: FB }}
        >▶</button>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "14px", marginBottom: "14px", alignItems: "center" }}>
        {[
          { color: COLOR_A, label: "Home team win" },
          { color: COLOR_TIE, label: "Tie" },
          { color: COLOR_B, label: "Away team win" },
        ].map(({ color, label }) => (
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
        {simResults.map(({ ta, tb, aWinPct, bWinPct, tiePct, aAvgPts, bAvgPts, pairings: indiv }) => {
          const teamA = TEAMS[ta], teamB = TEAMS[tb];
          const hcpA = league.handicaps[ta] || [0, 0];
          const hcpB = league.handicaps[tb] || [0, 0];
          const piA_lo = hcpA[0] <= hcpA[1] ? 0 : 1;
          const piB_lo = hcpB[0] <= hcpB[1] ? 0 : 1;

          const favorite = aWinPct > bWinPct ? "a" : bWinPct > aWinPct ? "b" : "tie";
          const edgeColor = favorite === "a" ? COLOR_A : favorite === "b" ? COLOR_B : COLOR_TIE;

          return (
            <div key={`${ta}-${tb}`} style={{
              background: CARD2, border: `1px solid ${GOLD}22`,
              borderLeft: `3px solid ${edgeColor}`,
              borderRadius: "12px", padding: "14px 16px",
            }}>
              {/* Team headers */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: CREAM }}>{teamA?.name}</div>
                  <div style={{ fontSize: "11px", color: M }}>
                    {teamA?.p1}<ConfidenceDot rounds={playerRounds(playerDists, ta, 0)} />
                    {" · "}
                    {teamA?.p2}<ConfidenceDot rounds={playerRounds(playerDists, ta, 1)} />
                  </div>
                </div>
                <div style={{ fontSize: "13px", color: M, fontWeight: 600, alignSelf: "center" }}>vs</div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: CREAM }}>{teamB?.name}</div>
                  <div style={{ fontSize: "11px", color: M }}>
                    {teamB?.p1}<ConfidenceDot rounds={playerRounds(playerDists, tb, 0)} />
                    {" · "}
                    {teamB?.p2}<ConfidenceDot rounds={playerRounds(playerDists, tb, 1)} />
                  </div>
                </div>
              </div>

              {/* Team probability bar */}
              <ProbBar aWin={aWinPct} tie={tiePct} bWin={bWinPct} />

              {/* Expected pts */}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", marginBottom: "10px" }}>
                <span style={{ fontSize: "11px", color: aWinPct >= bWinPct ? G : M, fontWeight: aWinPct >= bWinPct ? 700 : 400 }}>
                  {aAvgPts.toFixed(1)} exp pts
                </span>
                <span style={{ fontSize: "10px", color: M }}>expected match pts</span>
                <span style={{ fontSize: "11px", color: bWinPct > aWinPct ? G : M, fontWeight: bWinPct > aWinPct ? 700 : 400 }}>
                  {bAvgPts.toFixed(1)} exp pts
                </span>
              </div>

              {/* Individual matchups */}
              <div style={{ borderTop: `1px solid ${GOLD}22`, paddingTop: "8px", display: "grid", gap: "6px" }}>
                {indiv.map((p, i) => {
                  const nameA = p.piA === piA_lo ? teamA?.p1 : teamA?.p2;
                  const nameB = p.piB === piB_lo ? teamB?.p1 : teamB?.p2;
                  return (
                    <div key={i}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                        <span style={{ fontSize: "10px", color: M }}>{nameA}</span>
                        <span style={{ fontSize: "9px", color: M, background: GOLD + "22", padding: "1px 6px", borderRadius: "4px" }}>{p.label} match</span>
                        <span style={{ fontSize: "10px", color: M }}>{nameB}</span>
                      </div>
                      <ProbBar aWin={p.aWinPct} tie={p.tiePct} bWin={p.bWinPct} small />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "16px", fontSize: "11px", color: M, textAlign: "center" }}>
        Probabilities are based on historical per-hole scoring distributions. Dots indicate data confidence.
        Results will vary each simulation run.
      </div>
    </div>
  );
}
