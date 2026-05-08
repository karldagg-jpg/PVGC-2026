import React, { useMemo, useState } from "react";
import { PAR, SI, RAINOUT_SUB, SCHEDULE, TEAMS, DEFAULT_HCP } from "../constants/league";
import { stabPts, hcpStr, calcSuggestedHcps } from "../lib/leagueLogic";
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
// Only includes weeks *before* the target week so we don't leak current-week data.
// Returns { "tid-pi": Array(9) of {eagle,birdie,par,bogey,double,triple,n} }
function buildPlayerHoleDists(results, handicaps, beforeWeek = 99) {
  const dists = {};
  for (let tid = 1; tid <= 18; tid++) {
    for (let pi = 0; pi < 2; pi++) {
      dists[`${tid}-${pi}`] = Array.from({ length: 9 }, () => ({
        eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0, n: 0,
      }));
    }
  }

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
  if (total === 0) return par + 1;
  const r = Math.random() * total;
  let cum = 0;
  for (let i = 0; i < cats.length; i++) {
    cum += holeDist[cats[i]];
    if (r <= cum) return par + deltas[i];
  }
  return par + 3;
}

// Monte Carlo simulation for one matchup.
// matchRec: optional — if provided, uses actual scores for completed holes and
//           respects sub/phantom types. Simulates only the remaining holes.
function simulateMatchup(tidA, tidB, playerDists, handicaps, matchRec) {
  const hcpA = handicaps[tidA] || DEFAULT_HCP[tidA] || [0, 0];
  const hcpB = handicaps[tidB] || DEFAULT_HCP[tidB] || [0, 0];

  // Lo = lower handicap player index for each team
  const piA_lo = hcpA[0] <= hcpA[1] ? 0 : 1;
  const piB_lo = hcpB[0] <= hcpB[1] ? 0 : 1;
  const pairings = [
    { piA: piA_lo,       piB: piB_lo,       label: "Lo" },
    { piA: 1 - piA_lo,  piB: 1 - piB_lo,  label: "Hi" },
  ];

  // Sub/phantom: fixed pts, skip simulation for that player
  const typesA = matchRec?.t1types || [];
  const typesB = matchRec?.t2types || [];
  const fixedA = [0, 1].map(pi => {
    const t = typesA[pi] || "normal";
    return t === "sub" ? 6 : t === "phantom" ? 2 : null;
  });
  const fixedB = [0, 1].map(pi => {
    const t = typesB[pi] || "normal";
    return t === "sub" ? 6 : t === "phantom" ? 2 : null;
  });

  // Compute pts already locked in from actual scores (per player)
  const scoresA = matchRec ? normS(matchRec.t1scores) : [[], []];
  const scoresB = matchRec ? normS(matchRec.t2scores) : [[], []];

  const earnedA = [0, 1].map(pi => {
    if (fixedA[pi] !== null) return fixedA[pi];
    let pts = 0;
    const gr = scoresA[pi] || [];
    for (let hi = 0; hi < 9; hi++) {
      const g = gr[hi] || 0;
      if (!g) continue;
      pts += stabPts(g, PAR[hi], hcpStr(hcpA[pi] || 0, SI[hi])) || 0;
    }
    return pts;
  });
  const earnedB = [0, 1].map(pi => {
    if (fixedB[pi] !== null) return fixedB[pi];
    let pts = 0;
    const gr = scoresB[pi] || [];
    for (let hi = 0; hi < 9; hi++) {
      const g = gr[hi] || 0;
      if (!g) continue;
      pts += stabPts(g, PAR[hi], hcpStr(hcpB[pi] || 0, SI[hi])) || 0;
    }
    return pts;
  });

  // Holes that still need simulating: any hole where a normal player has no score
  const holesLeft = [];
  for (let hi = 0; hi < 9; hi++) {
    const aDone = [0, 1].every(pi => fixedA[pi] !== null || (scoresA[pi]?.[hi] || 0) > 0);
    const bDone = [0, 1].every(pi => fixedB[pi] !== null || (scoresB[pi]?.[hi] || 0) > 0);
    if (!aDone || !bDone) holesLeft.push(hi);
  }

  const holesPlayed = 9 - holesLeft.length;
  const isLive = matchRec != null && holesPlayed > 0 && holesLeft.length > 0;
  const isComplete = matchRec != null && holesLeft.length === 0;

  let aWins = 0, bWins = 0, ties = 0;
  let aTotalPts = 0, bTotalPts = 0;
  const pWins = [0, 0], pLoss = [0, 0], pTies = [0, 0];
  // Track per-player stableford sums across sims
  const aStabSum = [0, 0];
  const bStabSum = [0, 0];
  let aTeamStabSum = 0, bTeamStabSum = 0;
  let teamWins = 0, teamLoss = 0, teamTies = 0;

  for (let sim = 0; sim < N_SIMS; sim++) {
    const ppA = [...earnedA];
    const ppB = [...earnedB];

    for (const hi of holesLeft) {
      for (let piA = 0; piA < 2; piA++) {
        if (fixedA[piA] !== null) continue;
        const g = sampleGross(playerDists[`${tidA}-${piA}`][hi], PAR[hi]);
        ppA[piA] += stabPts(g, PAR[hi], hcpStr(hcpA[piA] || 0, SI[hi])) || 0;
      }
      for (let piB = 0; piB < 2; piB++) {
        if (fixedB[piB] !== null) continue;
        const g = sampleGross(playerDists[`${tidB}-${piB}`][hi], PAR[hi]);
        ppB[piB] += stabPts(g, PAR[hi], hcpStr(hcpB[piB] || 0, SI[hi])) || 0;
      }
    }

    const teamA = ppA[0] + ppA[1];
    const teamB = ppB[0] + ppB[1];

    aStabSum[0] += ppA[0]; aStabSum[1] += ppA[1];
    bStabSum[0] += ppB[0]; bStabSum[1] += ppB[1];
    aTeamStabSum += teamA;
    bTeamStabSum += teamB;

    let mA = 0, mB = 0;
    for (let p = 0; p < 2; p++) {
      const pA = ppA[pairings[p].piA];
      const pB = ppB[pairings[p].piB];
      if (pA > pB)      { mA += 2; pWins[p]++; }
      else if (pB > pA) { mB += 2; pLoss[p]++; }
      else              { mA++; mB++; pTies[p]++; }
    }
    if (teamA > teamB)      { mA += 4; teamWins++; }
    else if (teamB > teamA) { mB += 4; teamLoss++; }
    else                    { mA += 2; mB += 2; teamTies++; }

    if (mA > mB) aWins++;
    else if (mB > mA) bWins++;
    else ties++;
    aTotalPts += mA;
    bTotalPts += mB;
  }

  return {
    aWinPct:       aWins  / N_SIMS,
    bWinPct:       bWins  / N_SIMS,
    tiePct:        ties   / N_SIMS,
    aAvgPts:       aTotalPts / N_SIMS,
    bAvgPts:       bTotalPts / N_SIMS,
    // Per-player expected stableford
    aAvgStab:      aStabSum.map(s => s / N_SIMS),
    bAvgStab:      bStabSum.map(s => s / N_SIMS),
    aAvgTeamStab:  aTeamStabSum / N_SIMS,
    bAvgTeamStab:  bTeamStabSum / N_SIMS,
    // Team total match win probability
    teamWinPct:    teamWins / N_SIMS,
    teamLossPct:   teamLoss / N_SIMS,
    teamTiePct:    teamTies / N_SIMS,
    holesPlayed,
    holesLeft:     holesLeft.length,
    isLive,
    isComplete,
    currentPtsA:   earnedA[0] + earnedA[1],
    currentPtsB:   earnedB[0] + earnedB[1],
    currentIndivA: [...earnedA],
    currentIndivB: [...earnedB],
    piA_lo,
    piB_lo,
    pairings: pairings.map((p, i) => ({
      ...p,
      aWinPct: pWins[i]  / N_SIMS,
      bWinPct: pLoss[i]  / N_SIMS,
      tiePct:  pTies[i]  / N_SIMS,
    })),
  };
}

function playerRounds(dists, tid, pi) {
  const holes = dists[`${tid}-${pi}`] || [];
  return Math.max(...holes.map(h => h.n), 0);
}

function ProbBar({ aWin, tie, bWin, small }) {
  const h  = small ? "14px" : "24px";
  const fs = small ? "9px"  : "11px";
  return (
    <div style={{ display: "flex", height: h, borderRadius: "5px", overflow: "hidden", width: "100%" }}>
      {[
        { val: aWin, color: COLOR_A },
        { val: tie,  color: COLOR_TIE },
        { val: bWin, color: COLOR_B },
      ].map(({ val, color }, i) => val > 0 && (
        <div key={i} style={{ width: `${val * 100}%`, background: color, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
  return (
    <span title={rounds === 0 ? "No data" : `${rounds} rounds`} style={{
      display: "inline-block", width: "7px", height: "7px",
      borderRadius: "50%", background: color, marginLeft: "4px", verticalAlign: "middle",
    }} />
  );
}

function LiveTag({ holesPlayed, holesLeft }) {
  return (
    <span style={{
      fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
      padding: "2px 7px", borderRadius: "6px",
      background: G + "33", color: G, border: `1px solid ${G}55`,
    }}>
      LIVE · H{holesPlayed} played · {holesLeft} left
    </span>
  );
}

function CompleteTag() {
  return (
    <span style={{
      fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
      padding: "2px 7px", borderRadius: "6px",
      background: GOLD + "22", color: GOLD, border: `1px solid ${GOLD}44`,
    }}>
      FINAL
    </span>
  );
}

export default function PredictScreen({ league }) {
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

  // Handicaps auto-calculated from scoring history up to (but not including) the selected week.
  // This is what the league actually uses for that week's matches.
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

  const weekDate = SCHEDULE[week]?.date
    ? new Date(SCHEDULE[week].date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

  const anyLive = simResults.some(r => r.isLive || r.isComplete);

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "28px", fontWeight: 600, color: CREAM, marginBottom: "4px" }}>
        Match Predictor
      </div>
      <div style={{ color: M, fontSize: "13px", marginBottom: "18px" }}>
        Monte Carlo · {N_SIMS.toLocaleString()} runs per matchup
        {anyLive ? " · live mode: simulating remaining holes only" : " · based on per-player hole history"}
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
        {[{ color: COLOR_A, label: "Home win" }, { color: COLOR_TIE, label: "Tie" }, { color: COLOR_B, label: "Away win" }]
          .map(({ color, label }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: color }} />
            <span style={{ fontSize: "11px", color: M }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: "10px" }}>
          {[{ color: G, label: "4+ rds" }, { color: GO, label: "2-3 rds" }, { color: R, label: "<2 rds" }]
            .map(({ color, label }) => (
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
          piA_lo, piB_lo, pairings: indiv,
        }) => {
          const teamA = TEAMS[ta], teamB = TEAMS[tb];
          const edgeColor = aWinPct > bWinPct ? COLOR_A : bWinPct > aWinPct ? COLOR_B : COLOR_TIE;

          const pnA = pi => pi === 0 ? teamA?.p1 : teamA?.p2;
          const pnB = pi => pi === 0 ? teamB?.p1 : teamB?.p2;

          const mk = `${week}-${Math.min(ta, tb)}-${Math.max(ta, tb)}`;
          const rec = league.results[week]?.[mk];
          const isLower = ta < tb;
          const typesA = (isLower ? rec?.t1types : rec?.t2types) || [];
          const typesB = (isLower ? rec?.t2types : rec?.t1types) || [];
          const typeTag = (types, pi) => {
            const t = types[pi];
            if (t === "sub")     return <span style={{ marginLeft: "4px", fontSize: "9px", color: GO }}>(Sub)</span>;
            if (t === "phantom") return <span style={{ marginLeft: "4px", fontSize: "9px", color: M }}>(Phantom)</span>;
            return null;
          };

          // Row helper: player name + stab score | prob bar | player name + stab score
          const StabRow = ({ piA, piB, label, aWin, aTie, bWin }) => {
            const expA = isLive || isComplete ? currentIndivA[piA] : aAvgStab[piA];
            const expB = isLive || isComplete ? currentIndivB[piB] : bAvgStab[piB];
            const aLeads = expA > expB;
            return (
              <div style={{ marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                  {/* Team A player */}
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "5px" }}>
                    <span style={{ fontSize: "22px", fontWeight: 700, color: aLeads ? G : CREAM, lineHeight: 1 }}>
                      {(isLive || isComplete) ? expA : expA.toFixed(1)}
                    </span>
                    <div>
                      <div style={{ fontSize: "11px", color: CREAM, fontWeight: 600 }}>{pnA(piA)}</div>
                      <div style={{ fontSize: "9px", color: M }}>{typeTag(typesA, piA) ? ((typesA[piA] === "sub" ? "Sub · 6" : "Phantom · 2") + " pts fixed") : `hcp ${(weekHcps[ta] || [0,0])[piA]}`}</div>
                    </div>
                  </div>
                  {/* Label */}
                  <span style={{ fontSize: "9px", color: M, background: GOLD + "22", padding: "2px 8px", borderRadius: "4px", flexShrink: 0 }}>{label}</span>
                  {/* Team B player */}
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "5px", justifyContent: "flex-end", flexDirection: "row-reverse" }}>
                    <span style={{ fontSize: "22px", fontWeight: 700, color: !aLeads && expB !== expA ? G : CREAM, lineHeight: 1 }}>
                      {(isLive || isComplete) ? expB : expB.toFixed(1)}
                    </span>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", color: CREAM, fontWeight: 600 }}>{pnB(piB)}</div>
                      <div style={{ fontSize: "9px", color: M }}>{typeTag(typesB, piB) ? ((typesB[piB] === "sub" ? "Sub · 6" : "Phantom · 2") + " pts fixed") : `hcp ${(weekHcps[tb] || [0,0])[piB]}`}</div>
                    </div>
                  </div>
                </div>
                {!(isComplete) && <ProbBar aWin={aWin} tie={aTie} bWin={bWin} small />}
              </div>
            );
          };

          return (
            <div key={`${ta}-${tb}`} style={{
              background: CARD2, border: `1px solid ${GOLD}22`,
              borderLeft: `3px solid ${edgeColor}`, borderRadius: "12px", padding: "14px 16px",
            }}>
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: CREAM }}>{teamA?.name}</div>
                  <div style={{ fontSize: "11px", color: M }}>
                    <ConfidenceDot rounds={playerRounds(playerDists, ta, 0)} />
                    {" "}{pnA(0)} · {pnA(1)}{" "}
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
                    <ConfidenceDot rounds={playerRounds(playerDists, tb, 0)} />
                    {" "}{pnB(0)} · {pnB(1)}{" "}
                    <ConfidenceDot rounds={playerRounds(playerDists, tb, 1)} />
                  </div>
                </div>
              </div>

              {/* Individual stableford rows — lo match, hi match */}
              {indiv.map((p, i) => (
                <StabRow key={i}
                  piA={p.piA} piB={p.piB} label={p.label + " match"}
                  aWin={p.aWinPct} aTie={p.tiePct} bWin={p.bWinPct}
                />
              ))}

              {/* Team total row */}
              <div style={{ borderTop: `1px solid ${GOLD}22`, paddingTop: "8px", marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: "22px", fontWeight: 700, color: (isLive||isComplete ? currentPtsA : aAvgTeamStab) >= (isLive||isComplete ? currentPtsB : bAvgTeamStab) ? G : CREAM }}>
                      {isLive || isComplete ? currentPtsA : aAvgTeamStab.toFixed(1)}
                    </span>
                  </div>
                  <span style={{ fontSize: "9px", color: M, background: GOLD + "22", padding: "2px 8px", borderRadius: "4px", flexShrink: 0 }}>
                    {isLive ? `team total · H${holesPlayed}` : isComplete ? "team total · final" : "team total"}
                  </span>
                  <div style={{ flex: 1, textAlign: "right" }}>
                    <span style={{ fontSize: "22px", fontWeight: 700, color: (isLive||isComplete ? currentPtsB : bAvgTeamStab) > (isLive||isComplete ? currentPtsA : aAvgTeamStab) ? G : CREAM }}>
                      {isLive || isComplete ? currentPtsB : bAvgTeamStab.toFixed(1)}
                    </span>
                  </div>
                </div>
                {!isComplete && <ProbBar aWin={teamWinPct} tie={teamTiePct} bWin={teamLossPct} small />}
              </div>

              {/* Inferred match pts footer */}
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
        Based on per-player per-hole scoring distributions from prior weeks.
        Results vary each run — refresh to resimulate.
      </div>
    </div>
  );
}
