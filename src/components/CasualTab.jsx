import React, { useRef, useState } from "react";
import { stabPts, hcpStr, maxGross } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD2, FB, FD } from "../constants/theme";

const PAR  = [4, 4, 3, 4, 4, 3, 4, 4, 5];
const SI   = [11, 5, 9, 17, 1, 13, 3, 7, 15];
const TOTAL_PAR = PAR.reduce((s, p) => s + p, 0); // 35

const COLORS = [G, GO, "#4a7fc4", "#9b4db5"];

const emptyScores = () => Array(9).fill(0);

function CasualTab() {
  const [players, setPlayers] = useState([
    { name: "", hcp: "" },
    { name: "", hcp: "" },
  ]);
  const [scores, setScores] = useState([emptyScores(), emptyScores()]);
  const cellRefs = useRef({});

  const addPlayer = () => {
    if (players.length >= 4) return;
    setPlayers(p => [...p, { name: "", hcp: "" }]);
    setScores(s => [...s, emptyScores()]);
  };

  const removePlayer = (idx) => {
    if (players.length <= 1) return;
    setPlayers(p => p.filter((_, i) => i !== idx));
    setScores(s => s.filter((_, i) => i !== idx));
  };

  const setPlayerField = (idx, field, val) =>
    setPlayers(p => p.map((pl, i) => i === idx ? { ...pl, [field]: val } : pl));

  const setScore = (pi, hi, val) =>
    setScores(s => s.map((row, i) => i === pi ? row.map((v, h) => h === hi ? val : v) : row));

  const getHcp = (pi) => parseInt(players[pi]?.hcp) || 0;

  const getPts = (pi, hi) => {
    const gross = scores[pi]?.[hi];
    if (!gross) return null;
    return stabPts(gross, PAR[hi], hcpStr(getHcp(pi), SI[hi]));
  };

  const stabTotal = (pi) => Array(9).fill(0).reduce((s, _, h) => s + (getPts(pi, h) || 0), 0);
  const grossTotal = (pi) => (scores[pi] || []).reduce((s, v) => s + (v || 0), 0);

  const handleKeyDown = (e, pi, hi) => {
    const last = players.length - 1;
    if ((e.key === "Tab" && !e.shiftKey) || e.key === "Enter" || e.key === "ArrowRight") {
      e.preventDefault();
      if (hi < 8) cellRefs.current[`${pi}-${hi + 1}`]?.focus();
      else if (pi < last) cellRefs.current[`${pi + 1}-0`]?.focus();
    } else if ((e.key === "Tab" && e.shiftKey) || e.key === "ArrowLeft") {
      e.preventDefault();
      if (hi > 0) cellRefs.current[`${pi}-${hi - 1}`]?.focus();
      else if (pi > 0) cellRefs.current[`${pi - 1}-8`]?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      cellRefs.current[`${Math.min(last, pi + 1)}-${hi}`]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      cellRefs.current[`${Math.max(0, pi - 1)}-${hi}`]?.focus();
    }
  };

  const anyScores = scores.some(row => row.some(v => v > 0));

  const results = players
    .map((p, i) => ({ name: p.name || `Player ${i + 1}`, hcp: getHcp(i), stab: stabTotal(i), color: COLORS[i] }))
    .sort((a, b) => b.stab - a.stab);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px 14px" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "4px" }}>
        <div style={{ fontFamily: FD, fontSize: "28px", fontWeight: 600, color: CREAM }}>Casual Match</div>
        {anyScores && (
          <button onClick={() => setScores(players.map(emptyScores))}
            style={{ padding: "6px 14px", borderRadius: "7px", border: `1px solid ${R}44`, background: R + "12", color: R, fontFamily: FB, fontSize: "12px", cursor: "pointer" }}>
            Clear Scores
          </button>
        )}
      </div>
      <div style={{ color: M, fontSize: "13px", marginBottom: "20px" }}>
        Applecross CC · Front 9 · Par {TOTAL_PAR}
      </div>

      {/* Player cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "10px", marginBottom: "20px" }}>
        {players.map((p, i) => (
          <div key={i} style={{ background: "#fff", border: `2px solid ${COLORS[i]}44`, borderRadius: "12px", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: COLORS[i], display: "inline-block", marginRight: "7px" }} />
              <span style={{ fontSize: "11px", color: M, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Player {i + 1}</span>
              {players.length > 1 && (
                <button onClick={() => removePlayer(i)}
                  style={{ marginLeft: "auto", border: "none", background: "none", color: M, cursor: "pointer", fontSize: "18px", lineHeight: 1, padding: 0 }}>×</button>
              )}
            </div>
            <input
              type="text"
              placeholder="Name"
              value={p.name}
              onChange={e => setPlayerField(i, "name", e.target.value)}
              style={{ width: "100%", marginBottom: "7px", background: "#f8f8f4", border: `1px solid ${COLORS[i]}44`, borderRadius: "6px", color: CREAM, fontFamily: FB, fontSize: "14px", padding: "7px 9px", outline: "none" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "12px", color: M }}>HCP</span>
              <input
                type="number" min="0" max="36"
                value={p.hcp}
                placeholder="0"
                onChange={e => setPlayerField(i, "hcp", e.target.value)}
                style={{ width: "56px", background: "#f8f8f4", border: `1px solid ${COLORS[i]}44`, borderRadius: "6px", color: CREAM, fontFamily: FB, fontSize: "16px", fontWeight: 700, padding: "6px", textAlign: "center", outline: "none", MozAppearance: "textfield", appearance: "textfield" }}
              />
            </div>
          </div>
        ))}
        {players.length < 4 && (
          <button onClick={addPlayer}
            style={{ border: `2px dashed ${GOLD}44`, borderRadius: "12px", padding: "12px", background: "transparent", color: GOLD, fontFamily: FB, fontSize: "14px", cursor: "pointer", minHeight: "90px" }}>
            + Add Player
          </button>
        )}
      </div>

      {/* Scorecard */}
      <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "14px", overflow: "hidden", marginBottom: "16px" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "580px" }}>
            <thead>
              <tr style={{ background: "rgba(26,61,36,0.07)", borderBottom: `1px solid ${GOLD}33` }}>
                <td style={{ padding: "7px 12px", fontWeight: 700, color: M, fontSize: "12px" }}>Player</td>
                {PAR.map((_, h) => (
                  <td key={h} style={{ padding: "7px 4px", textAlign: "center", fontWeight: 600, color: M, fontSize: "12px" }}>H{h + 1}</td>
                ))}
                <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: CREAM, fontSize: "12px" }}>Total</td>
              </tr>
              <tr style={{ background: "rgba(26,61,36,0.03)", borderBottom: `1px solid ${GOLD}22`, fontSize: "11px", color: M }}>
                <td style={{ padding: "3px 12px", fontWeight: 600 }}>Par</td>
                {PAR.map((p, h) => <td key={h} style={{ padding: "3px 4px", textAlign: "center" }}>{p}</td>)}
                <td style={{ padding: "3px 10px", textAlign: "center", fontWeight: 700 }}>{TOTAL_PAR}</td>
              </tr>
              <tr style={{ borderBottom: `2px solid ${GOLD}33`, fontSize: "11px", color: M }}>
                <td style={{ padding: "3px 12px", fontWeight: 600 }}>SI</td>
                {SI.map((si, h) => <td key={h} style={{ padding: "3px 4px", textAlign: "center" }}>{si}</td>)}
                <td />
              </tr>
            </thead>
            <tbody>
              {players.map((p, pi) => {
                const stab = stabTotal(pi);
                const gross = grossTotal(pi);
                return (
                  <tr key={pi} style={{ borderBottom: pi < players.length - 1 ? `1px solid ${GOLD}18` : "none" }}>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS[pi], display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: CREAM }}>{p.name || `Player ${pi + 1}`}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: M, paddingLeft: "14px" }}>HCP {getHcp(pi)}</div>
                    </td>
                    {Array(9).fill(0).map((_, hi) => {
                      const gross = scores[pi]?.[hi] || 0;
                      const pts = getPts(pi, hi);
                      const strokes = hcpStr(getHcp(pi), SI[hi]);
                      const cap = maxGross(PAR[hi], strokes);
                      const ptColor = pts === null ? M : pts >= 3 ? G : pts === 1 ? GOLD : pts === 0 ? M : R;
                      const bgColor = gross ? (pts >= 3 ? "#e6f5ea" : pts === 1 ? "#fdf6e0" : pts === 0 ? "#fff" : R + "14") : "#fff";
                      const bdColor = gross ? (pts >= 3 ? G : pts === 1 ? GOLD : pts === 0 ? "#aaa" : R) : "#ccc";
                      return (
                        <td key={hi} style={{ padding: "6px 3px", textAlign: "center" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                            {strokes > 0 && <span style={{ fontSize: "8px", color: G, fontWeight: 700, lineHeight: 1 }}>{"•".repeat(strokes)}</span>}
                            <input
                              ref={el => cellRefs.current[`${pi}-${hi}`] = el}
                              type="number" min="1" max={cap}
                              value={gross || ""}
                              placeholder={String(PAR[hi])}
                              onChange={e => {
                                const v = parseInt(e.target.value);
                                setScore(pi, hi, isNaN(v) || v < 1 ? 0 : Math.min(cap, v));
                              }}
                              onKeyDown={e => handleKeyDown(e, pi, hi)}
                              onFocus={e => e.target.select()}
                              style={{
                                width: "36px", height: "36px", textAlign: "center",
                                background: bgColor, border: `2px solid ${bdColor}`,
                                borderRadius: "6px", color: gross ? ptColor : "#aaa",
                                fontFamily: FB, fontSize: "15px", fontWeight: 700,
                                outline: "none", MozAppearance: "textfield", appearance: "textfield",
                              }}
                            />
                            {gross > 0 && pts !== null && (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: ptColor, lineHeight: 1 }}>
                                {pts > 0 ? "+" + pts : pts}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: "6px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: G, lineHeight: 1.1 }}>{stab || "—"}</div>
                      {gross > 0 && <div style={{ fontSize: "11px", color: M, marginTop: "2px" }}>{gross} gross</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results */}
      {anyScores && (
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "14px", padding: "14px 16px" }}>
          <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "10px" }}>Leaderboard</div>
          {results.map((p, rank) => (
            <div key={rank} style={{
              display: "flex", alignItems: "center", gap: "12px",
              padding: "9px 0",
              borderBottom: rank < results.length - 1 ? `1px solid ${GOLD}18` : "none",
            }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: rank === 0 ? GOLD : M, minWidth: "20px", textAlign: "center" }}>
                {rank + 1}
              </span>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: "15px", fontWeight: 600, color: CREAM }}>{p.name}</span>
              <span style={{ fontSize: "12px", color: M }}>HCP {p.hcp}</span>
              <span style={{ fontSize: "22px", fontWeight: 700, color: rank === 0 ? G : CREAM, minWidth: "32px", textAlign: "right" }}>{p.stab}</span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default CasualTab;
