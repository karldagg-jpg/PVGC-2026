import React, { useState, useMemo } from "react";
import { TEAMS, ALL_PLAYERS, PAR, SI, RAINOUT_SUB } from "../constants/league";
import { hcpStr } from "../lib/leagueLogic";
import { FD, FB } from "../constants/theme";

// ── Masters palette ─────────────────────────────────────────────────────────
const MG    = "#006747";   // Augusta National green
const MG2   = "#00402c";   // darker header green
const MG3   = "#004d38";   // mid header
const MWHT  = "#ffffff";
const MROW  = "#f6f6f4";   // alternate row
const MRED  = "#c41230";   // under par (Masters tradition: red = under par)
const MBLK  = "#1a1a1a";   // over par / even
const MGLD  = "#d4af37";   // gold trim
const MGRY  = "#888";
const MSEP  = "#e0ddd6";   // row separator
const SEASON_PAR = 36;     // par per week (9 holes, par 36)

function fmtVsPar(diff) {
  if (diff === 0)  return { label: "E",     color: MBLK };
  if (diff < 0)    return { label: String(diff), color: MRED };
  return           { label: "+" + diff,     color: MBLK };
}

// ── Compute season leaderboard in "strokes vs par" mode ─────────────────────
function computeLeaderboard(league, mode) {
  const { results, handicaps, cancelledWeeks = new Set() } = league;

  const players = ALL_PLAYERS.map(({ tid, pi, name, team }) => {
    const weekScores = {};  // w → { gross, net, par } | null (cancelled)
    let totalVsPar = 0;
    let weeksPlayed = 0;

    for (let w = 1; w <= 17; w++) {
      if (cancelledWeeks?.has?.(w)) { weekScores[w] = null; continue; }
      const weekResults = results[w] || {};
      for (const [key, rec] of Object.entries(weekResults)) {
        if (!rec) continue;
        const parts = key.split("-");
        const tlow = parseInt(parts[1]), thigh = parseInt(parts[2]);
        let tIdx = tlow === tid ? 0 : thigh === tid ? 1 : -1;
        if (tIdx === -1) continue;

        const scores = tIdx === 0 ? rec.t1scores : rec.t2scores;
        const types  = tIdx === 0 ? rec.t1types  : rec.t2types;
        const type   = (types || [])[pi] || "normal";

        // Subs / phantoms: no stroke data — skip from stroke leaderboard
        if (type === "sub" || type === "phantom") break;

        const hcp = rec.hcpSnapshot
          ? (rec.hcpSnapshot[tid] || [0, 0])[pi]
          : (handicaps[tid] || [0, 0])[pi];

        let gross = 0, hcpStrokes = 0;
        let hasScore = false;

        for (let hi = 0; hi < 9; hi++) {
          const effHi = (rec.rainout && !((scores[pi] || [])[hi]) && RAINOUT_SUB[hi] !== undefined)
            ? RAINOUT_SUB[hi] : hi;
          const g = (scores[pi] || [])[effHi] || 0;
          if (!g) continue;
          hasScore = true;
          gross += g;
          hcpStrokes += hcpStr(hcp, SI[hi]);
        }

        if (hasScore) {
          const net      = gross - hcpStrokes;
          const wkVsPar  = mode === "gross" ? gross - SEASON_PAR : net - SEASON_PAR;
          weekScores[w]  = { gross, net, vsPar: wkVsPar };
          totalVsPar    += wkVsPar;
          weeksPlayed++;
        }
        break;
      }
    }

    return { tid, pi, name, team, weekScores, totalVsPar, weeksPlayed };
  });

  // Sort ascending (lower strokes = better)
  players.sort((a, b) => {
    if (a.weeksPlayed === 0 && b.weeksPlayed === 0) return 0;
    if (a.weeksPlayed === 0) return 1;
    if (b.weeksPlayed === 0) return -1;
    return a.totalVsPar - b.totalVsPar || b.weeksPlayed - a.weeksPlayed;
  });

  return players.map((p, i, arr) => {
    if (p.weeksPlayed === 0) return { ...p, pos: null, tied: false };
    const first = arr.findIndex(x => x.weeksPlayed > 0 && x.totalVsPar === p.totalVsPar);
    const tied  = arr.filter(x => x.weeksPlayed > 0 && x.totalVsPar === p.totalVsPar).length > 1;
    return { ...p, pos: first + 1, tied };
  });
}

// ── Component ────────────────────────────────────────────────────────────────
export default function MastersBoard({ league }) {
  const [mode, setMode] = useState("net");
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => computeLeaderboard(league, mode), [league, mode]);

  const playedWeeks = useMemo(() =>
    Array.from({ length: 17 }, (_, i) => i + 1)
      .filter(w => Object.keys(league.results[w] || {}).length > 0),
    [league.results]
  );

  const played = rows.filter(r => r.weeksPlayed > 0);
  const notPlayed = rows.filter(r => r.weeksPlayed === 0);
  const displayPlayed = showAll ? played : played.slice(0, 20);
  const leaderVsPar = played[0]?.totalVsPar ?? 0;

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "22px 14px" }}>

      {/* ── Masters-style header ──────────────────────────────── */}
      <div style={{
        background: `linear-gradient(180deg, ${MG2} 0%, ${MG3} 60%, ${MG} 100%)`,
        borderRadius: "10px 10px 0 0",
        padding: "0",
        boxShadow: "0 2px 12px rgba(0,65,44,0.35)"
      }}>
        {/* Gold top bar */}
        <div style={{ height: "4px", background: `linear-gradient(90deg, ${MGLD}, #f0d060, ${MGLD})`, borderRadius: "10px 10px 0 0" }} />

        <div style={{ padding: "18px 24px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ fontFamily: FD, fontSize: "28px", fontWeight: 700, color: MGLD, letterSpacing: "0.04em" }}>
              Individual Leaderboard
            </div>
            <div style={{ fontFamily: FB, fontSize: "11px", color: "#7ab89a", marginTop: "3px", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Pickering Valley Golf Club &nbsp;·&nbsp; 2026 Season &nbsp;·&nbsp; {playedWeeks.length} Round{playedWeeks.length !== 1 ? "s" : ""} Complete
            </div>
          </div>

          {/* NET / GROSS pill */}
          <div style={{ display: "flex", background: "rgba(0,0,0,0.30)", borderRadius: "6px", padding: "3px", gap: "2px" }}>
            {[["net", "Net"], ["gross", "Gross"]].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "6px 20px", borderRadius: "4px", border: "none",
                background: mode === m ? MGLD : "transparent",
                color: mode === m ? MG2 : "#7ab89a",
                fontFamily: FB, fontSize: "12px", fontWeight: mode === m ? 700 : 500,
                letterSpacing: "0.1em", textTransform: "uppercase",
                cursor: "pointer"
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Column headers */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FB }}>
          <thead>
            <tr style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <th style={{ padding: "8px 10px 8px 20px", textAlign: "left",   color: "#7ab89a", fontSize: "11px", letterSpacing: "0.12em", fontWeight: 600, width: "50px" }}>POS</th>
              <th style={{ padding: "8px 10px",           textAlign: "left",   color: "#7ab89a", fontSize: "11px", letterSpacing: "0.12em", fontWeight: 600 }}>PLAYER</th>
              <th style={{ padding: "8px 10px",           textAlign: "center", color: MGLD,      fontSize: "11px", letterSpacing: "0.12em", fontWeight: 700, width: "70px" }}>TO PAR</th>
              <th style={{ padding: "8px 14px 8px 4px",   textAlign: "center", color: "#7ab89a", fontSize: "11px", letterSpacing: "0.12em", fontWeight: 600, width: "60px" }}>TOTAL</th>
              {playedWeeks.map(w => (
                <th key={w} style={{ padding: "8px 4px", textAlign: "center", color: "#7ab89a", fontSize: "10px", letterSpacing: "0.06em", fontWeight: 500, width: "38px" }}>
                  W{w}
                </th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* ── Leaderboard rows ─────────────────────────────────── */}
      <div style={{ background: MWHT, borderRadius: "0 0 10px 10px", overflow: "hidden", boxShadow: "0 4px 20px rgba(0,65,44,0.12)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FB, minWidth: playedWeeks.length > 4 ? `${480 + playedWeeks.length * 38}px` : "420px" }}>
            <tbody>
              {displayPlayed.map((p, i) => {
                const isLeader = p.pos === 1;
                const top5 = p.pos <= 5;
                const { label: toParLabel, color: toParColor } = fmtVsPar(p.totalVsPar);
                const gap = p.totalVsPar - leaderVsPar; // positive = behind leader

                return (
                  <tr key={`${p.tid}-${p.pi}`} style={{
                    background: i % 2 === 0 ? MWHT : MROW,
                    borderBottom: `1px solid ${MSEP}`,
                  }}>
                    {/* Position */}
                    <td style={{ padding: "13px 10px 13px 20px", width: "50px", whiteSpace: "nowrap" }}>
                      <span style={{
                        fontFamily: FB, fontSize: "14px", fontWeight: 700,
                        color: isLeader ? MRED : top5 ? MG : MGRY,
                      }}>
                        {p.tied && p.pos !== 1 ? "T" : ""}{p.pos}
                      </span>
                    </td>

                    {/* Player + team */}
                    <td style={{ padding: "13px 10px" }}>
                      <div style={{ fontFamily: FB, fontSize: "14px", fontWeight: isLeader ? 700 : 600, color: MBLK }}>
                        {p.name}
                      </div>
                      <div style={{ fontFamily: FB, fontSize: "11px", color: MGRY, marginTop: "1px" }}>
                        {TEAMS[p.tid]?.name}
                      </div>
                    </td>

                    {/* TO PAR — big hero number */}
                    <td style={{ padding: "13px 10px", textAlign: "center", width: "70px" }}>
                      <span style={{
                        fontFamily: FD, fontSize: "24px", fontWeight: 700, lineHeight: 1,
                        color: toParColor,
                      }}>
                        {toParLabel}
                      </span>
                      {gap > 0 && (
                        <div style={{ fontFamily: FB, fontSize: "10px", color: MGRY, marginTop: "1px" }}>
                          +{gap}
                        </div>
                      )}
                    </td>

                    {/* Raw total strokes */}
                    <td style={{ padding: "13px 14px 13px 4px", textAlign: "center", width: "60px" }}>
                      <span style={{ fontFamily: FB, fontSize: "13px", color: "#444" }}>
                        {mode === "gross"
                          ? played.find(x => x === p) && Object.values(p.weekScores).filter(Boolean).reduce((s, w) => s + (w?.gross || 0), 0)
                          : played.find(x => x === p) && Object.values(p.weekScores).filter(Boolean).reduce((s, w) => s + (w?.net || 0), 0)
                        }
                      </span>
                    </td>

                    {/* Per-week cells */}
                    {playedWeeks.map(w => {
                      const wk = p.weekScores[w];
                      const cancelled = wk === null;
                      const played = wk !== undefined && !cancelled && wk !== undefined;
                      if (cancelled) return (
                        <td key={w} style={{ padding: "13px 4px", textAlign: "center", width: "38px" }}>
                          <span style={{ fontSize: "11px", color: "#bbb" }}>⛈</span>
                        </td>
                      );
                      if (!played || !wk) return (
                        <td key={w} style={{ padding: "13px 4px", textAlign: "center", width: "38px" }}>
                          <span style={{ fontSize: "13px", color: "#ccc" }}>–</span>
                        </td>
                      );
                      const { label, color } = fmtVsPar(wk.vsPar);
                      return (
                        <td key={w} style={{ padding: "13px 4px", textAlign: "center", width: "38px" }}>
                          <span style={{ fontFamily: FB, fontSize: "13px", fontWeight: 600, color }}>
                            {label}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}

              {/* Cut line if showing all */}
              {showAll && notPlayed.length > 0 && (
                <tr>
                  <td colSpan={4 + playedWeeks.length} style={{
                    padding: "6px 20px", background: "#f0ede4",
                    fontSize: "11px", fontWeight: 700, color: MGRY,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    borderBottom: `2px solid ${MG}44`
                  }}>
                    No scores entered
                  </td>
                </tr>
              )}
              {showAll && notPlayed.map((p, i) => (
                <tr key={`np-${p.tid}-${p.pi}`} style={{ background: i % 2 === 0 ? MWHT : MROW, borderBottom: `1px solid ${MSEP}`, opacity: 0.5 }}>
                  <td style={{ padding: "10px 10px 10px 20px", width: "50px" }}>
                    <span style={{ fontFamily: FB, fontSize: "13px", color: MGRY }}>–</span>
                  </td>
                  <td style={{ padding: "10px 10px" }}>
                    <div style={{ fontFamily: FB, fontSize: "13px", color: MBLK }}>{p.name}</div>
                    <div style={{ fontFamily: FB, fontSize: "11px", color: MGRY }}>{TEAMS[p.tid]?.name}</div>
                  </td>
                  <td colSpan={2 + playedWeeks.length} style={{ padding: "10px", textAlign: "center", fontSize: "12px", color: MGRY }}>–</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Show all / collapse */}
        <div style={{ padding: "12px", textAlign: "center", borderTop: `1px solid ${MSEP}`, background: MROW }}>
          <button onClick={() => setShowAll(v => !v)} style={{
            background: "none", border: `1px solid ${MG}55`,
            borderRadius: "5px", padding: "7px 22px",
            fontFamily: FB, fontSize: "12px", color: MG,
            cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase"
          }}>
            {showAll ? "Show Top 20" : `Show All ${rows.length} Players`}
          </button>
        </div>

        {/* Footer */}
        <div style={{
          background: MG, padding: "9px 20px",
          borderRadius: "0 0 10px 10px",
          display: "flex", gap: "20px", flexWrap: "wrap", alignItems: "center"
        }}>
          <div style={{ fontSize: "11px", color: "#7ab89a" }}>
            <span style={{ color: MRED, fontWeight: 700 }}>Red</span> = Under par &nbsp;·&nbsp;
            <span style={{ color: MBLK, background: "#7ab89a", padding: "0 3px", borderRadius: "2px" }}>Black</span> = Over par &nbsp;·&nbsp;
            <span style={{ color: "#7ab89a" }}>E</span> = Even
          </div>
          <div style={{ fontSize: "11px", color: "#7ab89a", marginLeft: "auto" }}>
            {mode === "net" ? "Net = Gross strokes − handicap strokes received" : "Gross = Raw strokes, no handicap applied"}
          </div>
        </div>
      </div>
    </div>
  );
}
