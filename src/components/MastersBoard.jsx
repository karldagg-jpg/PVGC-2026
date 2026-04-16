import React, { useState, useMemo } from "react";
import { TEAMS, ALL_PLAYERS, PAR, SI, RAINOUT_SUB } from "../constants/league";
import { hcpStr } from "../lib/leagueLogic";
import { FD, FB } from "../constants/theme";

// ── Augusta board palette ───────────────────────────────────────────────────
const BOARD_BG   = "#1a3d22";   // Augusta board green
const BOARD_DARK = "#122d18";   // header / alternating row
const BOARD_LINE = "#2a5a32";   // grid lines
const BOARD_TXT  = "#f0ece0";   // parchment white text
const BOARD_DIM  = "#7aaa82";   // secondary / dim text
const BOARD_RED  = "#e8263a";   // under par (Masters tradition)
const BOARD_GOLD = "#d4af37";   // gold trim / headings
const SEASON_PAR = 36;

function fmtVsPar(diff) {
  if (diff === 0) return { label: "E",          color: BOARD_TXT };
  if (diff < 0)   return { label: String(diff), color: BOARD_RED };
  return                  { label: "+" + diff,  color: BOARD_TXT };
}

function computeLeaderboard(league, mode) {
  const { results, handicaps, cancelledWeeks = new Set() } = league;

  const players = ALL_PLAYERS.map(({ tid, pi, name, team }) => {
    const weekScores = {};
    let totalVsPar = 0;
    let weeksPlayed = 0;

    for (let w = 1; w <= 17; w++) {
      if (cancelledWeeks?.has?.(w)) { weekScores[w] = null; continue; }
      const weekResults = results[w] || {};
      for (const [key, rec] of Object.entries(weekResults)) {
        if (!rec) continue;
        const parts = key.split("-");
        const tlow = parseInt(parts[1]), thigh = parseInt(parts[2]);
        const tIdx = tlow === tid ? 0 : thigh === tid ? 1 : -1;
        if (tIdx === -1) continue;

        const scores = tIdx === 0 ? rec.t1scores : rec.t2scores;
        const types  = tIdx === 0 ? rec.t1types  : rec.t2types;
        const type   = (types || [])[pi] || "normal";
        if (type === "sub" || type === "phantom") break;

        const hcp = rec.hcpSnapshot
          ? (rec.hcpSnapshot[tid] || [0, 0])[pi]
          : (handicaps[tid] || [0, 0])[pi];

        let gross = 0, hcpStrokes = 0, hasScore = false;
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
          const net     = gross - hcpStrokes;
          const vsPar   = mode === "gross" ? gross - SEASON_PAR : net - SEASON_PAR;
          weekScores[w] = { gross, net, vsPar };
          totalVsPar   += vsPar;
          weeksPlayed++;
        }
        break;
      }
    }
    return { tid, pi, name, team, weekScores, totalVsPar, weeksPlayed };
  });

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

  const played    = rows.filter(r => r.weeksPlayed > 0);
  const notPlayed = rows.filter(r => r.weeksPlayed === 0);
  const display   = showAll ? played : played.slice(0, 20);

  // cell style helper
  const cell = (extra = {}) => ({
    padding: "0 6px",
    textAlign: "center",
    borderRight: `1px solid ${BOARD_LINE}`,
    borderBottom: `1px solid ${BOARD_LINE}`,
    height: "36px",
    verticalAlign: "middle",
    ...extra,
  });

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto", padding: "22px 10px" }}>

      {/* ── Top controls ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ fontFamily: FB, fontSize: "12px", color: "#5a7a5a", letterSpacing: "0.08em" }}>
          {playedWeeks.length} round{playedWeeks.length !== 1 ? "s" : ""} complete · PVGC 2026 Season
        </div>
        <div style={{ display: "flex", background: "#e8e4d8", borderRadius: "6px", padding: "3px", gap: "2px" }}>
          {[["net", "Net"], ["gross", "Gross"]].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)} style={{
              padding: "6px 18px", borderRadius: "4px", border: "none",
              background: mode === m ? BOARD_BG : "transparent",
              color: mode === m ? BOARD_GOLD : "#5a7a5a",
              fontFamily: FB, fontSize: "12px", fontWeight: mode === m ? 700 : 500,
              letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer"
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── The Board ── */}
      <div style={{
        background: BOARD_BG,
        borderRadius: "10px",
        boxShadow: "0 8px 40px rgba(10,30,14,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
        overflow: "hidden",
        border: `2px solid ${BOARD_GOLD}66`,
      }}>

        {/* Gold top trim */}
        <div style={{ height: "3px", background: `linear-gradient(90deg, transparent, ${BOARD_GOLD}, transparent)` }} />

        {/* LEADERS title */}
        <div style={{
          padding: "14px 0 10px",
          textAlign: "center",
          borderBottom: `1px solid ${BOARD_GOLD}55`,
        }}>
          <div style={{
            fontFamily: FD, fontSize: "32px", fontWeight: 700,
            color: BOARD_TXT, letterSpacing: "0.25em", textTransform: "uppercase",
            textShadow: "0 1px 6px rgba(0,0,0,0.5)"
          }}>
            LEADERS
          </div>
        </div>

        {/* Scrollable grid */}
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse",
            fontFamily: FB, color: BOARD_TXT,
            minWidth: `${340 + playedWeeks.length * 52}px`
          }}>
            <thead>
              {/* WEEK header row */}
              <tr style={{ background: BOARD_DARK }}>
                <td style={{ ...cell({ textAlign: "left", paddingLeft: "14px", width: "38px", color: BOARD_DIM, fontSize: "11px", letterSpacing: "0.1em" }) }}>
                </td>
                <td style={{ ...cell({ textAlign: "left", paddingLeft: "10px", color: BOARD_DIM, fontSize: "11px", letterSpacing: "0.1em" }) }}>
                  PLAYER
                </td>
                <td style={{ ...cell({ color: BOARD_GOLD, fontSize: "11px", letterSpacing: "0.1em", fontWeight: 700, width: "64px" }) }}>
                  TO PAR
                </td>
                {playedWeeks.map(w => (
                  <td key={w} style={{ ...cell({ color: BOARD_DIM, fontSize: "11px", letterSpacing: "0.06em", width: "52px" }) }}>
                    W{w}
                  </td>
                ))}
              </tr>

              {/* PAR row */}
              <tr style={{ background: "#163320" }}>
                <td style={{ ...cell({ paddingLeft: "14px", color: BOARD_DIM, fontSize: "11px" }) }}></td>
                <td style={{ ...cell({ textAlign: "left", paddingLeft: "10px", color: BOARD_DIM, fontSize: "11px", letterSpacing: "0.06em" }) }}>
                  PAR
                </td>
                <td style={{ ...cell({ color: BOARD_DIM, fontSize: "13px", fontWeight: 600 }) }}>
                  36
                </td>
                {playedWeeks.map(w => (
                  <td key={w} style={{ ...cell({ color: BOARD_DIM, fontSize: "13px" }) }}>36</td>
                ))}
              </tr>
            </thead>

            <tbody>
              {display.map((p, i) => {
                const isLeader = p.pos === 1;
                const { label: toParLabel, color: toParColor } = fmtVsPar(p.totalVsPar);
                const rowBg = i % 2 === 0 ? BOARD_BG : BOARD_DARK;

                return (
                  <tr key={`${p.tid}-${p.pi}`} style={{ background: rowBg }}>

                    {/* Position */}
                    <td style={{ ...cell({ paddingLeft: "14px", width: "38px" }) }}>
                      <span style={{
                        fontFamily: FB, fontSize: "13px", fontWeight: 700,
                        color: isLeader ? BOARD_RED : BOARD_DIM,
                      }}>
                        {p.pos !== null ? (p.tied && p.pos !== 1 ? "T" : "") + p.pos : "–"}
                      </span>
                    </td>

                    {/* Player name */}
                    <td style={{ ...cell({ textAlign: "left", paddingLeft: "10px", paddingRight: "14px" }) }}>
                      <div style={{
                        fontFamily: FB, fontSize: "14px",
                        fontWeight: isLeader ? 700 : 600,
                        color: isLeader ? BOARD_TXT : BOARD_TXT,
                        letterSpacing: "0.02em",
                        whiteSpace: "nowrap",
                      }}>
                        {p.name.toUpperCase()}
                      </div>
                    </td>

                    {/* TO PAR */}
                    <td style={{ ...cell({ width: "64px" }) }}>
                      <span style={{
                        fontFamily: FD, fontSize: "22px", fontWeight: 700,
                        color: toParColor,
                        textShadow: toParColor === BOARD_RED ? "0 0 8px rgba(232,38,58,0.4)" : "none"
                      }}>
                        {toParLabel}
                      </span>
                    </td>

                    {/* Per-week cells */}
                    {playedWeeks.map(w => {
                      const wk = p.weekScores[w];
                      if (wk === null) return (
                        <td key={w} style={{ ...cell({ width: "52px", color: BOARD_DIM, fontSize: "12px" }) }}>⛈</td>
                      );
                      if (!wk) return (
                        <td key={w} style={{ ...cell({ width: "52px", color: BOARD_LINE, fontSize: "16px" }) }}>–</td>
                      );
                      const { label, color } = fmtVsPar(wk.vsPar);
                      return (
                        <td key={w} style={{ ...cell({ width: "52px" }) }}>
                          <span style={{ fontFamily: FB, fontSize: "14px", fontWeight: 600, color }}>
                            {label}
                          </span>
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
        <div style={{
          padding: "12px", textAlign: "center",
          borderTop: `1px solid ${BOARD_LINE}`
        }}>
          <button onClick={() => setShowAll(v => !v)} style={{
            background: "none", border: `1px solid ${BOARD_DIM}`,
            borderRadius: "4px", padding: "6px 20px",
            fontFamily: FB, fontSize: "11px", color: BOARD_DIM,
            cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase"
          }}>
            {showAll
              ? `Show Top 20`
              : `Show All ${rows.length} Players`}
          </button>
          {!showAll && notPlayed.length > 0 && (
            <span style={{ fontFamily: FB, fontSize: "11px", color: BOARD_LINE, marginLeft: "12px" }}>
              {notPlayed.length} players not yet scored
            </span>
          )}
        </div>

        {/* Gold bottom trim */}
        <div style={{ height: "3px", background: `linear-gradient(90deg, transparent, ${BOARD_GOLD}, transparent)` }} />
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "18px", marginTop: "10px", padding: "0 4px", flexWrap: "wrap" }}>
        <span style={{ fontFamily: FB, fontSize: "11px", color: "#6a8a6a" }}>
          <span style={{ color: BOARD_RED }}>Red</span> = under par
        </span>
        <span style={{ fontFamily: FB, fontSize: "11px", color: "#6a8a6a" }}>
          {mode === "net"
            ? "Net = gross strokes − handicap received"
            : "Gross = raw strokes, no handicap"}
        </span>
      </div>
    </div>
  );
}
