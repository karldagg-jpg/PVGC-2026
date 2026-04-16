import React, { useState, useMemo } from "react";
import { TEAMS, ALL_PLAYERS, PAR, SI, RAINOUT_SUB } from "../constants/league";
import { stabPts, hcpStr } from "../lib/leagueLogic";
import { FD, FB } from "../constants/theme";

// ── Masters palette ────────────────────────────────────────────
const MG   = "#1a3d24";   // Augusta dark green
const MG2  = "#0d2316";   // deeper header green
const MYL  = "#f0c040";   // CBS scoreboard yellow
const MWHT = "#f8f5ec";   // parchment white rows
const MRED = "#b91c1c";   // leader red
const MGRY = "#6b7a6e";   // secondary text

// ── Compute per-player data for one mode ──────────────────────
function computeLeaderboard(league, mode) {
  const { results, handicaps, cancelledWeeks = new Set() } = league;

  const players = ALL_PLAYERS.map(({ tid, pi, name, team }) => {
    const weekTotals = {}; // w → stab pts | null (cancelled) | undefined (no match)
    let seasonTotal = 0;
    let weeksPlayed = 0;

    for (let w = 1; w <= 17; w++) {
      if (cancelledWeeks?.has?.(w)) { weekTotals[w] = null; continue; }
      const weekResults = results[w] || {};
      for (const [key, rec] of Object.entries(weekResults)) {
        if (!rec) continue;
        const parts = key.split("-");
        const tlow = parseInt(parts[1]);
        const thigh = parseInt(parts[2]);
        let tIdx = tlow === tid ? 0 : thigh === tid ? 1 : -1;
        if (tIdx === -1) continue;

        const scores = tIdx === 0 ? rec.t1scores : rec.t2scores;
        const types  = tIdx === 0 ? rec.t1types  : rec.t2types;
        const type   = (types || [])[pi] || "normal";

        if (type === "sub")     { weekTotals[w] = 6;  seasonTotal += 6;  weeksPlayed++; break; }
        if (type === "phantom") { weekTotals[w] = 2;  seasonTotal += 2;  weeksPlayed++; break; }

        const hcp = rec.hcpSnapshot
          ? (rec.hcpSnapshot[tid] || [0, 0])[pi]
          : (handicaps[tid] || [0, 0])[pi];

        let wkTotal = 0;
        let hasScore = false;

        for (let hi = 0; hi < 9; hi++) {
          const effHi = (rec.rainout && !((scores[pi] || [])[hi]) && RAINOUT_SUB[hi] !== undefined)
            ? RAINOUT_SUB[hi] : hi;
          const gross = (scores[pi] || [])[effHi] || 0;
          if (!gross) continue;
          hasScore = true;
          const strokes = mode === "net" ? hcpStr(hcp, SI[hi]) : 0;
          wkTotal += stabPts(gross, PAR[hi], strokes) || 0;
        }

        if (hasScore) {
          weekTotals[w] = wkTotal;
          seasonTotal += wkTotal;
          weeksPlayed++;
        }
        break; // only one match per team per week
      }
    }

    return { tid, pi, name, team, weekTotals, seasonTotal, weeksPlayed };
  });

  // Sort descending by total, then by weeks played (more = better data)
  players.sort((a, b) => b.seasonTotal - a.seasonTotal || b.weeksPlayed - a.weeksPlayed);

  // Assign display positions with ties
  return players.map((p, i, arr) => {
    const first = arr.findIndex(x => x.seasonTotal === p.seasonTotal);
    const tied  = arr.filter(x => x.seasonTotal === p.seasonTotal).length > 1;
    return { ...p, pos: first + 1, tied };
  });
}

// ── Component ─────────────────────────────────────────────────
export default function MastersBoard({ league }) {
  const [mode, setMode] = useState("net");
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => computeLeaderboard(league, mode), [league, mode]);

  // Which weeks have any results
  const playedWeeks = useMemo(() =>
    Array.from({ length: 17 }, (_, i) => i + 1)
      .filter(w => Object.keys(league.results[w] || {}).length > 0),
    [league.results]
  );

  const display = showAll ? rows : rows.slice(0, 20);
  const leaderTotal = rows[0]?.seasonTotal ?? 0;

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "22px 14px" }}>

      {/* ── Header board ── */}
      <div style={{
        background: `linear-gradient(160deg, ${MG2} 0%, ${MG} 100%)`,
        borderRadius: "14px 14px 0 0",
        padding: "20px 22px 16px",
        display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "12px",
        boxShadow: "0 4px 24px rgba(13,35,22,0.28)"
      }}>
        <div>
          <div style={{
            fontFamily: FD, fontSize: "26px", fontWeight: 700,
            color: MYL, letterSpacing: "0.06em", textTransform: "uppercase",
            textShadow: "0 1px 4px rgba(0,0,0,0.4)"
          }}>
            Individual Leaderboard
          </div>
          <div style={{ fontFamily: FB, fontSize: "12px", color: "#a8c8a0", marginTop: "3px", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Pickering Valley · 2026 Season · {playedWeeks.length} week{playedWeeks.length !== 1 ? "s" : ""} played
          </div>
        </div>

        {/* NET / GROSS toggle */}
        <div style={{
          display: "flex", background: "rgba(0,0,0,0.35)", borderRadius: "8px", padding: "3px", gap: "2px"
        }}>
          {["net", "gross"].map(m => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "7px 18px", borderRadius: "6px", border: "none",
              background: mode === m ? MYL : "transparent",
              color: mode === m ? MG2 : "#a8c8a0",
              fontFamily: FB, fontSize: "13px", fontWeight: mode === m ? 700 : 500,
              letterSpacing: "0.08em", textTransform: "uppercase",
              cursor: "pointer", transition: "all 0.15s"
            }}>
              {m === "net" ? "Net" : "Gross"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mode explanation strip ── */}
      <div style={{
        background: "#2a5238", padding: "7px 22px",
        fontSize: "12px", color: "#a8c8a0", letterSpacing: "0.05em",
        display: "flex", gap: "18px", alignItems: "center"
      }}>
        <span style={{ color: MYL, fontWeight: 600 }}>
          {mode === "net" ? "NET STABLEFORD" : "GROSS STABLEFORD"}
        </span>
        <span>
          {mode === "net"
            ? "Handicap strokes applied — the competitive scoring format"
            : "No handicap strokes — raw scoring ability vs par"}
        </span>
      </div>

      {/* ── Scoreboard table ── */}
      <div style={{ background: MWHT, borderRadius: "0 0 14px 14px", overflow: "hidden", boxShadow: "0 4px 24px rgba(13,35,22,0.15)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: playedWeeks.length > 3 ? "640px" : "420px" }}>
            <thead>
              <tr style={{ background: MG, color: MWHT }}>
                <th style={{ padding: "10px 10px 10px 16px", textAlign: "left", fontFamily: FB, fontSize: "11px", letterSpacing: "0.1em", fontWeight: 600, whiteSpace: "nowrap" }}>POS</th>
                <th style={{ padding: "10px 8px", textAlign: "left", fontFamily: FB, fontSize: "11px", letterSpacing: "0.1em", fontWeight: 600 }}>PLAYER</th>
                <th style={{ padding: "10px 8px", textAlign: "center", fontFamily: FB, fontSize: "11px", letterSpacing: "0.1em", fontWeight: 600, color: MYL }}>TOTAL</th>
                {playedWeeks.map(w => (
                  <th key={w} style={{ padding: "10px 4px", textAlign: "center", fontFamily: FB, fontSize: "11px", letterSpacing: "0.06em", fontWeight: 500, color: "#a8c8a0", minWidth: "30px" }}>
                    W{w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {display.map((p, i) => {
                const isLeader = p.pos === 1;
                const top3 = p.pos <= 3;
                const gap = leaderTotal - p.seasonTotal;
                const rowBg = i % 2 === 0 ? MWHT : "#f0ede2";

                return (
                  <tr key={`${p.tid}-${p.pi}`} style={{
                    background: rowBg,
                    borderBottom: "1px solid #ddd8cc",
                    transition: "background 0.1s"
                  }}>
                    {/* Position */}
                    <td style={{ padding: "11px 8px 11px 16px", whiteSpace: "nowrap" }}>
                      <span style={{
                        fontFamily: FD, fontSize: "15px", fontWeight: 700,
                        color: isLeader ? MRED : top3 ? MG : MGRY,
                      }}>
                        {p.tied && p.pos !== 1 ? "T" : ""}{p.pos}
                      </span>
                    </td>

                    {/* Player name + team */}
                    <td style={{ padding: "11px 8px" }}>
                      <div style={{ fontFamily: FB, fontSize: "14px", fontWeight: isLeader ? 700 : 600, color: isLeader ? MRED : "#1a2e1a", whiteSpace: "nowrap" }}>
                        {p.name}
                      </div>
                      <div style={{ fontFamily: FB, fontSize: "11px", color: MGRY, marginTop: "1px", letterSpacing: "0.02em" }}>
                        {TEAMS[p.tid]?.name}
                      </div>
                    </td>

                    {/* Season total */}
                    <td style={{ padding: "11px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <div style={{
                        fontFamily: FD, fontSize: "22px", fontWeight: 700, lineHeight: 1,
                        color: isLeader ? MRED : top3 ? MG : "#1a2e1a"
                      }}>
                        {p.weeksPlayed > 0 ? p.seasonTotal : "—"}
                      </div>
                      {p.weeksPlayed > 0 && gap > 0 && (
                        <div style={{ fontSize: "10px", color: MGRY, lineHeight: 1, marginTop: "2px" }}>
                          -{gap}
                        </div>
                      )}
                    </td>

                    {/* Per-week cells */}
                    {playedWeeks.map(w => {
                      const wPts = p.weekTotals[w];
                      const cancelled = wPts === null;
                      const played = wPts !== undefined && !cancelled;
                      return (
                        <td key={w} style={{ padding: "11px 4px", textAlign: "center" }}>
                          {cancelled ? (
                            <span style={{ fontSize: "11px", color: "#bbb" }}>⛈</span>
                          ) : played ? (
                            <span style={{
                              fontFamily: FB, fontSize: "13px", fontWeight: 600,
                              color: wPts >= 18 ? MRED : wPts >= 14 ? MG : wPts <= 8 ? "#9a6a3a" : "#1a2e1a"
                            }}>
                              {wPts}
                            </span>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#ccc" }}>·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Show all / collapse */}
        {rows.length > 20 && (
          <div style={{
            padding: "12px", textAlign: "center",
            borderTop: "1px solid #ddd8cc", background: "#f0ede2"
          }}>
            <button onClick={() => setShowAll(v => !v)} style={{
              background: "none", border: `1px solid ${MG}44`,
              borderRadius: "6px", padding: "7px 20px",
              fontFamily: FB, fontSize: "13px", color: MG,
              cursor: "pointer", letterSpacing: "0.06em"
            }}>
              {showAll ? "Show Top 20" : `Show All ${rows.length} Players`}
            </button>
          </div>
        )}

        {/* Legend */}
        <div style={{
          padding: "10px 18px", background: MG, display: "flex", gap: "18px",
          flexWrap: "wrap", alignItems: "center", borderRadius: "0 0 14px 14px"
        }}>
          <div style={{ fontSize: "11px", color: "#a8c8a0", letterSpacing: "0.06em" }}>
            <span style={{ color: MRED, fontWeight: 700 }}>Red</span> = Leader · {" "}
            <span style={{ color: MYL }}>≥18 pts</span> excellent · {" "}
            <span style={{ color: "#a8c8a0" }}>≥14 pts</span> solid
          </div>
          <div style={{ fontSize: "11px", color: "#a8c8a0", marginLeft: "auto" }}>
            Sub = 6 pts fixed · Phantom = 2 pts fixed
          </div>
        </div>
      </div>
    </div>
  );
}
