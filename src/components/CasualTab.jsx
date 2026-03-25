import React, { useRef, useState } from "react";
import { stabPts, maxGross } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD2, FB, FD } from "../constants/theme";

const PAR  = [4, 4, 3, 4, 4, 3, 4, 4, 5];
const SI   = [11, 5, 9, 17, 1, 13, 3, 7, 15];
const TOTAL_PAR = PAR.reduce((s, p) => s + p, 0); // 35

const SI_SORTED = [...SI].sort((a, b) => a - b); // [1,3,5,7,9,11,13,15,17]

function casualHcpStr(hcp, si) {
  const h = Math.floor(hcp) || 0;
  if (h <= 0) return 0;
  const full      = Math.floor(h / 9);
  const remainder = h % 9;
  const cutoff    = remainder > 0 ? SI_SORTED[remainder - 1] : -1;
  return full + (si <= cutoff ? 1 : 0);
}

const COLORS = [G, GO, "#4a7fc4", "#9b4db5"];
const emptyScores = () => Array(9).fill(0);
const emptyTakes  = () => Array(9).fill(null); // null=undecided, true=Take, false=Pass

// ── Sixies helpers ────────────────────────────────────────────────────────────
// Given decisions in holes 0..hi-1, is hole hi forced?
// Returns true=forcedTake, false=forcedPass, null=freeChoice
function sixiesForced(t, hi) {
  const passesUsed = t.slice(0, hi).filter(x => x === false).length;
  const takesUsed  = t.slice(0, hi).filter(x => x === true).length;
  if (takesUsed >= 6)                    return false; // already 6 takes
  if (passesUsed >= 3)                   return true;  // used all 3 passes
  if ((8 - hi) < (6 - takesUsed))        return true;  // can't afford to pass
  return null;
}

function CasualTab() {
  const [players, setPlayers] = useState([
    { name: "", hcp: "" },
    { name: "", hcp: "" },
  ]);
  const [scores, setScores] = useState([emptyScores(), emptyScores()]);
  const [sixiesMode, setSixiesMode] = useState(false);
  const [takes, setTakes]   = useState([emptyTakes(), emptyTakes()]);
  const cellRefs = useRef({});

  // ── Player management ───────────────────────────────────────────────────────
  const addPlayer = () => {
    if (players.length >= 4) return;
    setPlayers(p => [...p, { name: "", hcp: "" }]);
    setScores(s  => [...s,  emptyScores()]);
    setTakes(t   => [...t,  emptyTakes()]);
  };

  const removePlayer = (idx) => {
    if (players.length <= 1) return;
    setPlayers(p => p.filter((_, i) => i !== idx));
    setScores(s  => s.filter((_, i) => i !== idx));
    setTakes(t   => t.filter((_, i) => i !== idx));
  };

  const setPlayerField = (idx, field, val) =>
    setPlayers(p => p.map((pl, i) => i === idx ? { ...pl, [field]: val } : pl));

  const setScore = (pi, hi, val) =>
    setScores(s => s.map((row, i) => i === pi ? row.map((v, h) => h === hi ? val : v) : row));

  const setTake = (pi, hi, val) =>
    setTakes(t => t.map((row, i) => i === pi ? row.map((v, h) => h === hi ? val : v) : row));

  // ── Scoring ─────────────────────────────────────────────────────────────────
  const getHcp = (pi) => parseInt(players[pi]?.hcp) || 0;

  const getPts = (pi, hi) => {
    const gross = scores[pi]?.[hi];
    if (!gross) return null;
    return stabPts(gross, PAR[hi], casualHcpStr(getHcp(pi), SI[hi]));
  };

  const stabTotal = (pi) => Array(9).fill(0).reduce((s, _, h) => s + (getPts(pi, h) || 0), 0);
  const grossTotal = (pi) => (scores[pi] || []).reduce((s, v) => s + (v || 0), 0);

  // ── Sixies per-player helpers ───────────────────────────────────────────────
  const getEffective = (pi, hi) => {
    const chosen = takes[pi]?.[hi];
    if (chosen !== null) return chosen;
    return sixiesForced(takes[pi] || [], hi);
  };

  // Sixies score = sum of net (gross - strokes) on the 6 taken holes
  const sixiesTotal = (pi) =>
    Array(9).fill(0).reduce((s, _, hi) => {
      if (getEffective(pi, hi) !== true) return s;
      const gross = scores[pi]?.[hi];
      if (!gross) return s;
      const net = gross - casualHcpStr(getHcp(pi), SI[hi]);
      return s + net;
    }, 0);

  const sixiesTaken  = (pi) => Array(9).fill(0).filter((_, hi) => getEffective(pi, hi) === true).length;
  const sixiesPassed = (pi) => takes[pi]?.filter(v => v === false).length || 0; // explicit passes only

  // ── Keyboard nav ────────────────────────────────────────────────────────────
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

  const sixiesResults = players
    .map((p, i) => ({ name: p.name || `Player ${i + 1}`, hcp: getHcp(i), stab: sixiesTotal(i), taken: sixiesTaken(i), color: COLORS[i] }))
    .sort((a, b) => b.stab - a.stab);

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "16px 12px" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "4px" }}>
        <div style={{ fontFamily: FD, fontSize: "26px", fontWeight: 600, color: CREAM }}>Casual Match</div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            onClick={() => setSixiesMode(m => !m)}
            style={{
              padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontFamily: FB, fontSize: "13px",
              border: sixiesMode ? `2px solid ${GOLD}` : `1px solid ${GOLD}44`,
              background: sixiesMode ? GOLD + "22" : "transparent",
              color: sixiesMode ? GOLD : M, fontWeight: sixiesMode ? 700 : 400,
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {sixiesMode ? "⬡ Sixies ON" : "⬡ Sixies"}
          </button>
          {anyScores && (
            <button
              onClick={() => { setScores(players.map(emptyScores)); setTakes(players.map(emptyTakes)); }}
              style={{ padding: "8px 14px", borderRadius: "8px", border: `1px solid ${R}44`, background: R + "12", color: R, fontFamily: FB, fontSize: "13px", cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
              Clear
            </button>
          )}
        </div>
      </div>
      <div style={{ color: M, fontSize: "13px", marginBottom: "16px" }}>
        Applecross CC · Front 9 · Par {TOTAL_PAR}
      </div>

      {/* ── Player cards ───────────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", marginBottom: "16px" }}>
        {players.map((p, i) => (
          <div key={i} style={{ background: "#fff", border: `2px solid ${COLORS[i]}44`, borderRadius: "12px", padding: "12px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: COLORS[i], display: "inline-block", marginRight: "7px", flexShrink: 0 }} />
              <span style={{ fontSize: "11px", color: M, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>Player {i + 1}</span>
              {players.length > 1 && (
                <button onClick={() => removePlayer(i)}
                  style={{ marginLeft: "auto", border: "none", background: "none", color: M, cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "0 0 0 8px", WebkitTapHighlightColor: "transparent" }}>×</button>
              )}
            </div>
            <input
              type="text" placeholder="Name" value={p.name}
              onChange={e => setPlayerField(i, "name", e.target.value)}
              style={{ width: "100%", marginBottom: "7px", background: "#f8f8f4", border: `1px solid ${COLORS[i]}44`, borderRadius: "6px", color: CREAM, fontFamily: FB, fontSize: "15px", padding: "8px 9px", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: M }}>HCP</span>
              <input
                type="number" min="0" max="36" value={p.hcp} placeholder="0"
                onChange={e => setPlayerField(i, "hcp", e.target.value)}
                style={{ width: "60px", background: "#f8f8f4", border: `1px solid ${COLORS[i]}44`, borderRadius: "6px", color: CREAM, fontFamily: FB, fontSize: "18px", fontWeight: 700, padding: "6px", textAlign: "center", outline: "none", MozAppearance: "textfield", appearance: "textfield" }}
              />
            </div>
          </div>
        ))}
        {players.length < 4 && (
          <button onClick={addPlayer}
            style={{ border: `2px dashed ${GOLD}44`, borderRadius: "12px", padding: "12px", background: "transparent", color: GOLD, fontFamily: FB, fontSize: "14px", cursor: "pointer", minHeight: "80px", WebkitTapHighlightColor: "transparent" }}>
            + Add Player
          </button>
        )}
      </div>

      {/* ── Sixies status bars ─────────────────────────────────────────────── */}
      {sixiesMode && (
        <div style={{ marginBottom: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
          {players.map((p, pi) => {
            const taken  = sixiesTaken(pi);
            const passed = sixiesPassed(pi);
            const passesLeft = 3 - passed;
            return (
              <div key={pi} style={{
                background: CARD2, border: `1px solid ${GOLD}33`, borderRadius: "10px",
                padding: "10px 12px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS[pi], display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: CREAM }}>{p.name || `Player ${pi + 1}`}</span>
                  <span style={{ marginLeft: "auto", fontSize: "13px", color: GOLD, fontWeight: 700 }}>
                    {taken}/6 taken
                  </span>
                  <span style={{ fontSize: "12px", color: passesLeft === 0 ? R : M }}>
                    {passesLeft} pass{passesLeft !== 1 ? "es" : ""} left
                  </span>
                </div>
                {/* Hole-by-hole dots */}
                <div style={{ display: "flex", gap: "3px" }}>
                  {Array(9).fill(0).map((_, hi) => {
                    const eff    = getEffective(pi, hi);
                    const forced = takes[pi]?.[hi] === null ? sixiesForced(takes[pi] || [], hi) : null;
                    const isForced = forced !== null;
                    let bg, label, txtColor;
                    if (eff === true)  { bg = G + "33";      label = "T"; txtColor = G; }
                    else if (eff === false) { bg = GOLD + "33"; label = "P"; txtColor = "#b87800"; }
                    else               { bg = "#e0e0e0";    label = String(hi + 1); txtColor = "#999"; }
                    return (
                      <div key={hi} style={{
                        flex: 1, height: "28px", borderRadius: "5px", background: bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "10px", fontWeight: 700, color: txtColor,
                        border: isForced ? `1px dashed ${eff === true ? G : GOLD}` : "none",
                        opacity: eff === null ? 0.6 : 1,
                      }}>
                        {label}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Scorecard ──────────────────────────────────────────────────────── */}
      <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "14px", overflow: "hidden", marginBottom: "14px" }}>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: sixiesMode ? "600px" : "560px" }}>
            <thead>
              <tr style={{ background: "rgba(26,61,36,0.07)", borderBottom: `1px solid ${GOLD}33` }}>
                <td style={{ padding: "7px 10px", fontWeight: 700, color: M, fontSize: "12px", whiteSpace: "nowrap" }}>Player</td>
                {PAR.map((_, h) => (
                  <td key={h} style={{ padding: "7px 3px", textAlign: "center", fontWeight: 600, color: M, fontSize: "12px", minWidth: "44px" }}>H{h + 1}</td>
                ))}
                <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 700, color: CREAM, fontSize: "12px", whiteSpace: "nowrap" }}>
                  {sixiesMode ? "Stab · 6s" : "Total"}
                </td>
              </tr>
              <tr style={{ background: "rgba(26,61,36,0.03)", borderBottom: `1px solid ${GOLD}22`, fontSize: "11px", color: M }}>
                <td style={{ padding: "3px 10px", fontWeight: 600 }}>Par</td>
                {PAR.map((p, h) => <td key={h} style={{ padding: "3px 3px", textAlign: "center" }}>{p}</td>)}
                <td style={{ padding: "3px 8px", textAlign: "center", fontWeight: 700 }}>{TOTAL_PAR}</td>
              </tr>
              <tr style={{ borderBottom: `2px solid ${GOLD}33`, fontSize: "11px", color: M }}>
                <td style={{ padding: "3px 10px", fontWeight: 600 }}>SI</td>
                {SI.map((si, h) => <td key={h} style={{ padding: "3px 3px", textAlign: "center" }}>{si}</td>)}
                <td />
              </tr>
            </thead>
            <tbody>
              {players.map((p, pi) => {
                const stab  = stabTotal(pi);
                const gross = grossTotal(pi);
                const s6    = sixiesTotal(pi);
                const taken = sixiesMode ? sixiesTaken(pi) : null;
                return (
                  <tr key={pi} style={{ borderBottom: pi < players.length - 1 ? `1px solid ${GOLD}18` : "none" }}>
                    <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: COLORS[pi], display: "inline-block", flexShrink: 0 }} />
                        <span style={{ fontSize: "13px", fontWeight: 600, color: CREAM }}>{p.name || `P${pi + 1}`}</span>
                      </div>
                      <div style={{ fontSize: "11px", color: M, paddingLeft: "13px" }}>HCP {getHcp(pi)}</div>
                    </td>
                    {Array(9).fill(0).map((_, hi) => {
                      const gross   = scores[pi]?.[hi] || 0;
                      const pts     = getPts(pi, hi);
                      const strokes = casualHcpStr(getHcp(pi), SI[hi]);
                      const cap     = maxGross(PAR[hi], strokes);
                      const ptColor = pts === null ? M : pts >= 3 ? G : pts === 1 ? GOLD : pts === 0 ? M : R;
                      const bgColor = gross ? (pts >= 3 ? "#e6f5ea" : pts === 1 ? "#fdf6e0" : pts === 0 ? "#fff" : R + "14") : "#fff";
                      const bdColor = gross ? (pts >= 3 ? G : pts === 1 ? GOLD : pts === 0 ? "#aaa" : R) : "#ccc";

                      // Sixies state
                      const chosen  = takes[pi]?.[hi];
                      const forced  = sixiesForced(takes[pi] || [], hi);
                      const eff     = chosen !== null ? chosen : forced;
                      const isForced = chosen === null && forced !== null;

                      return (
                        <td key={hi} style={{ padding: "4px 2px", textAlign: "center", verticalAlign: "top" }}>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px", paddingTop: "2px" }}>
                            {strokes > 0 && (
                              <span style={{ fontSize: "8px", color: G, fontWeight: 700, lineHeight: 1 }}>{"•".repeat(strokes)}</span>
                            )}
                            <input
                              ref={el => cellRefs.current[`${pi}-${hi}`] = el}
                              type="number" min="1" max={cap}
                              value={gross || ""}
                              placeholder={String(PAR[hi])}
                              inputMode="numeric"
                              onChange={e => {
                                const v = parseInt(e.target.value);
                                setScore(pi, hi, isNaN(v) || v < 1 ? 0 : Math.min(cap, v));
                              }}
                              onKeyDown={e => handleKeyDown(e, pi, hi)}
                              onFocus={e => e.target.select()}
                              style={{
                                width: "42px", height: "42px", textAlign: "center",
                                background: bgColor, border: `2px solid ${bdColor}`,
                                borderRadius: "8px", color: gross ? ptColor : "#aaa",
                                fontFamily: FB, fontSize: "16px", fontWeight: 700,
                                outline: "none", MozAppearance: "textfield", appearance: "textfield",
                                opacity: sixiesMode && eff === false ? 0.35 : 1,
                                touchAction: "manipulation",
                              }}
                            />
                            {gross > 0 && (
                              <span style={{ fontSize: "11px", color: M, lineHeight: 1 }}>
                                {gross - strokes}
                              </span>
                            )}
                            {gross > 0 && pts !== null && (
                              <span style={{ fontSize: "11px", fontWeight: 700, color: ptColor, lineHeight: 1 }}>
                                {pts > 0 ? "+" + pts : pts}
                              </span>
                            )}
                            {/* Sixies T/P toggle */}
                            {sixiesMode && (
                              isForced ? (
                                <span style={{
                                  fontSize: "9px", fontWeight: 800, letterSpacing: "0.03em",
                                  color: eff === true ? G : "#b87800", opacity: 0.6,
                                  lineHeight: 1, marginTop: "1px",
                                }}>
                                  {eff === true ? "TAKE" : "PASS"}
                                </span>
                              ) : (
                                <div style={{ display: "flex", gap: "2px", marginTop: "1px" }}>
                                  <button
                                    onPointerDown={e => { e.preventDefault(); setTake(pi, hi, chosen === true ? null : true); }}
                                    style={{
                                      width: "20px", height: "20px", padding: 0, fontSize: "9px", fontWeight: 800,
                                      borderRadius: "4px", cursor: "pointer", lineHeight: 1, touchAction: "manipulation",
                                      border: `1.5px solid ${chosen === true ? G : "#ccc"}`,
                                      background: chosen === true ? G + "22" : "transparent",
                                      color: chosen === true ? G : "#bbb",
                                      WebkitTapHighlightColor: "transparent",
                                    }}
                                  >T</button>
                                  <button
                                    onPointerDown={e => { e.preventDefault(); setTake(pi, hi, chosen === false ? null : false); }}
                                    style={{
                                      width: "20px", height: "20px", padding: 0, fontSize: "9px", fontWeight: 800,
                                      borderRadius: "4px", cursor: "pointer", lineHeight: 1, touchAction: "manipulation",
                                      border: `1.5px solid ${chosen === false ? "#e6a817" : "#ccc"}`,
                                      background: chosen === false ? "#e6a81722" : "transparent",
                                      color: chosen === false ? "#e6a817" : "#bbb",
                                      WebkitTapHighlightColor: "transparent",
                                    }}
                                  >P</button>
                                </div>
                              )
                            )}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: "6px 8px", textAlign: "center", whiteSpace: "nowrap", verticalAlign: "middle" }}>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: G, lineHeight: 1.1 }}>{stab || "—"}</div>
                      {sixiesMode && (
                        <div style={{
                          fontSize: "16px", fontWeight: 700, color: GOLD, marginTop: "3px",
                          padding: "2px 6px", background: GOLD + "18", borderRadius: "6px",
                          display: "inline-block",
                        }}>
                          {taken > 0 ? s6 : "—"}
                          <span style={{ fontSize: "9px", fontWeight: 400, color: M, marginLeft: "2px" }}>6s</span>
                        </div>
                      )}
                      {gross > 0 && <div style={{ fontSize: "11px", color: M, marginTop: "2px" }}>{gross} gross</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Stableford leaderboard ─────────────────────────────────────────── */}
      {anyScores && (
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "14px", padding: "14px 14px", marginBottom: sixiesMode ? "10px" : "0" }}>
          <div style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "8px" }}>
            Stableford
          </div>
          {results.map((p, rank) => (
            <div key={rank} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "9px 0", borderBottom: rank < results.length - 1 ? `1px solid ${GOLD}18` : "none",
            }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: rank === 0 ? GOLD : M, minWidth: "18px", textAlign: "center" }}>
                {rank + 1}
              </span>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: "15px", fontWeight: 600, color: CREAM }}>{p.name}</span>
              <span style={{ fontSize: "12px", color: M }}>HCP {p.hcp}</span>
              <span style={{ fontSize: "22px", fontWeight: 700, color: rank === 0 ? G : CREAM, minWidth: "30px", textAlign: "right" }}>{p.stab}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Sixies leaderboard ─────────────────────────────────────────────── */}
      {sixiesMode && anyScores && (
        <div style={{ background: CARD2, border: `2px solid ${GOLD}55`, borderRadius: "14px", padding: "14px 14px" }}>
          <div style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: "8px", fontWeight: 700 }}>
            ⬡ Sixies
          </div>
          {sixiesResults.map((p, rank) => (
            <div key={rank} style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "9px 0", borderBottom: rank < sixiesResults.length - 1 ? `1px solid ${GOLD}18` : "none",
            }}>
              <span style={{ fontSize: "14px", fontWeight: 700, color: rank === 0 ? GOLD : M, minWidth: "18px", textAlign: "center" }}>
                {rank + 1}
              </span>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: p.color, display: "inline-block", flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: "15px", fontWeight: 600, color: CREAM }}>{p.name}</span>
              <span style={{ fontSize: "12px", color: M }}>{p.taken}/6 holes</span>
              <span style={{ fontSize: "22px", fontWeight: 700, color: rank === 0 ? GOLD : CREAM, minWidth: "30px", textAlign: "right" }}>
                {p.taken > 0 ? p.stab : "—"}
              </span>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default CasualTab;
