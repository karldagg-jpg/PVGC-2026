import { PAR, SI, RAINOUT_SUB, TEAMS, SCHEDULE } from "../constants/league";
import { stabPts, hcpStr } from "../lib/leagueLogic";
import { BG, CARD, CARD2, CREAM, FB, FD, G, GO, GOLD, M, R, FM } from "../constants/theme";
import { fmtDate } from "../lib/format";
import { Tag, PtsBadge } from "./ui";

function ScoringScreen({
  selWeek,
  setWeek,
  selTeam,
  setTeam,
  opp,
  match,
  setMatch,
  hole,
  setHole,
  t1id,
  t2id,
  league,
  saveLeague,
  weekBonus,
  scanState,
  scanMsg,
  scanCard,
}) {
  const effH = (hi) =>
    match.rainout && hi >= match.holesPlayed && RAINOUT_SUB[hi] !== undefined
      ? RAINOUT_SUB[hi]
      : hi;
  const isRain = (hi) =>
    match.rainout && hi >= match.holesPlayed && RAINOUT_SUB[hi] !== undefined;

  function setScoreVal(tIdx, pi, hi, val) {
    setMatch((prev) => {
      const n = { ...prev, t1scores: prev.t1scores.map((a) => [...a]), t2scores: prev.t2scores.map((a) => [...a]) };
      if (tIdx === 0) n.t1scores[pi][hi] = val;
      else n.t2scores[pi][hi] = val;
      return n;
    });
  }

  function setTypeVal(tIdx, pi, val) {
    setMatch((prev) => {
      const n = { ...prev, t1types: [...prev.t1types], t2types: [...prev.t2types] };
      if (tIdx === 0) n.t1types[pi] = val;
      else n.t2types[pi] = val;
      if (val === "phantom") {
        const sc = tIdx === 0 ? prev.t1scores.map((a) => [...a]) : prev.t2scores.map((a) => [...a]);
        for (let h = 0; h < 9; h++) sc[pi][h] = PAR[h] + 2;
        if (tIdx === 0) n.t1scores = sc;
        else n.t2scores = sc;
      }
      return n;
    });
  }

  return (<div style={{ maxWidth: "820px", margin: "0 auto", padding: "14px 10px" }}>

    {/* Week / Team selectors */}
    <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ fontSize: "12px", color: M, letterSpacing: "0.08em", textTransform: "uppercase" }}>Week</span>
        <select value={selWeek} onChange={e => setWeek(parseInt(e.target.value))}
          style={{
            background: "rgba(255,255,255,0.95)", border: `1px solid ${GOLD}44`,
            borderRadius: "7px", color: CREAM, fontFamily: FB, fontSize: "14px", padding: "6px 9px", cursor: "pointer", outline: "none"
          }}>
          {Array.from({ length: 17 }, (_, i) => i + 1).map(w => (
            <option key={w} value={w}>W{w} — {fmtDate(SCHEDULE[w]?.date)}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ fontSize: "12px", color: M, letterSpacing: "0.08em", textTransform: "uppercase" }}>Team</span>
        <select value={selTeam} onChange={e => setTeam(parseInt(e.target.value))}
          style={{
            background: "rgba(255,255,255,0.95)", border: `1px solid ${GOLD}44`,
            borderRadius: "7px", color: CREAM, fontFamily: FB, fontSize: "14px", padding: "6px 9px", cursor: "pointer", outline: "none"
          }}>
          {Array.from({ length: 18 }, (_, i) => i + 1).map(t => (
            <option key={t} value={t}>T{t}: {TEAMS[t]?.name}</option>
          ))}
        </select>
      </div>
      {opp
        ? <div style={{ marginLeft: "auto", fontSize: "14px", color: M, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
          <span>vs <span style={{ color: GO }}>{TEAMS[opp]?.name}</span></span>
          {match.updatedBy && <span style={{ fontSize: "12px", color: GOLD, fontFamily: FB }}>
            ✎ {match.updatedBy}{match.updatedAt ? " · " + match.updatedAt : ""}
          </span>}
        </div>
        : <div style={{ marginLeft: "auto", fontSize: "13px", color: R }}>No match this week</div>}
    </div>

    {!opp ? (
      <div style={{ textAlign: "center", padding: "50px 20px", color: M, fontSize: "12px" }}>
        No match scheduled for Week {selWeek}.
      </div>
    ) : (<>

      {/* Rainout toggle */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "7px",
        background: CARD, border: `1px solid ${match.rainout ? GO + "44" : "rgba(255,255,255,0.95)"}`,
        borderRadius: "12px", padding: "9px 13px", marginBottom: "13px"
      }}>
        <div style={{ fontSize: "14px" }}>☔ Rainout
          <span style={{ fontSize: "12px", color: M, marginLeft: "7px" }}>H7→H1 · H8→H4 · H9→H3</span>
        </div>
        <div style={{ display: "flex", gap: "7px", alignItems: "center" }}>
          {match.rainout && (
            <select value={match.holesPlayed} onChange={e => setMatch(p => ({ ...p, holesPlayed: parseInt(e.target.value) }))}
              style={{
                background: "rgba(255,255,255,0.95)", border: `1px solid ${GOLD}44`,
                borderRadius: "6px", color: CREAM, fontFamily: FB, fontSize: "13px", padding: "4px 8px", cursor: "pointer", outline: "none"
              }}>
              {[6, 7, 8].map(n => <option key={n} value={n}>Stopped H{n}</option>)}
            </select>
          )}
          <button onClick={() => setMatch(p => ({ ...p, rainout: !p.rainout }))}
            style={{
              width: "38px", height: "20px", borderRadius: "13px", border: "none", cursor: "pointer",
              background: match.rainout ? GOLD : "rgba(255,255,255,0.6)", position: "relative", transition: "background 0.2s"
            }}>
            <span style={{
              position: "absolute", top: "2px", left: match.rainout ? "19px" : "2px",
              width: "16px", height: "16px", borderRadius: "50%", background: match.rainout ? BG : "#888", transition: "left 0.2s"
            }} />
          </button>
        </div>
      </div>

      {/* ── 4-ROW SCORECARD ── */}
      {(() => {
        // Build the 4 players in match order
        // Low hcp = pi with smaller hcp, High hcp = other pi
        const getOrder = (tid) => {
          const [h0, h1] = (league.handicaps[tid] || [0, 0]);
          return h0 <= h1 ? { low: 0, high: 1 } : { low: 1, high: 0 };
        };
        const o1 = getOrder(t1id), o2 = getOrder(t2id);

        // rows: [{label, tIdx, pi, tid, color, rival: {tIdx,pi,tid}}]
        const rows = [
          { label: "Low", tIdx: 0, pi: o1.low, tid: t1id, color: G, rivalTIdx: 1, rivalPi: o2.low },
          { label: "Low", tIdx: 1, pi: o2.low, tid: t2id, color: GO, rivalTIdx: 0, rivalPi: o1.low },
          { label: "High", tIdx: 0, pi: o1.high, tid: t1id, color: G, rivalTIdx: 1, rivalPi: o2.high },
          { label: "High", tIdx: 1, pi: o2.high, tid: t2id, color: GO, rivalTIdx: 0, rivalPi: o1.high },
        ];

        const getGross = (tIdx, pi, hi) => (tIdx === 0 ? match.t1scores : match.t2scores)[pi]?.[hi] || 0;
        const scoreName = (gross, par) => {
          if (!gross) return "";
          const d = gross - par;
          if (d <= -3) return "Eagle+";
          if (d === -2) return "Eagle";
          if (d === -1) return "Birdie";
          if (d === 0) return "Par";
          if (d === 1) return "Bogey";
          if (d === 2) return "Dbl Bogey";
          return "+" + d;
        };
        const getNet = (tIdx, pi, tid, hi) => {
          const gross = getGross(tIdx, pi, effH(hi));
          if (!gross) return null;
          const strokes = hcpStr(getHcp(tid, pi), SI[hi]);
          return gross - strokes;
        };
        const getGrossTotal = (tIdx, pi) => Array(9).fill(0).reduce((s, _, h) => s + (getGross(tIdx, pi, effH(h)) || 0), 0);
        const getNetTotal = (tIdx, pi, tid) => Array(9).fill(0).reduce((s, _, h) => {
          const g = getGross(tIdx, pi, effH(h)); if (!g) return s;
          return s + g - hcpStr(getHcp(tid, pi), SI[h]);
        }, 0);
        const getType = (tIdx, pi) => (tIdx === 0 ? match.t1types : match.t2types)[pi] || "normal";
        const getHcp = (tid, pi) => (league.handicaps[tid] || [0, 0])[pi] || 0;

        const getPtsFor = (tIdx, pi, tid, hi) => {
          const type = getType(tIdx, pi);
          if (type === "sub") return 6;
          const gross = getGross(tIdx, pi, effH(hi));
          if (!gross) return null;
          return stabPts(gross, PAR[hi], hcpStr(getHcp(tid, pi), SI[hi]));
        };

        const getRunTotal = (tIdx, pi, tid) => {
          const type = getType(tIdx, pi);
          if (type === "sub") return 6;
          let t = 0;
          for (let h = 0; h < 9; h++) t += getPtsFor(tIdx, pi, tid, h) || 0;
          return t;
        };

        // Individual match pts per pairing
        const matchResults = [
          {
            label: "Low vs Low",
            t1name: TEAMS[t1id]?.[o1.low === 0 ? "p1" : "p2"],
            t2name: TEAMS[t2id]?.[o2.low === 0 ? "p1" : "p2"],
            t1pts: getRunTotal(0, o1.low, t1id),
            t2pts: getRunTotal(1, o2.low, t2id)
          },
          {
            label: "High vs High",
            t1name: TEAMS[t1id]?.[o1.high === 0 ? "p1" : "p2"],
            t2name: TEAMS[t2id]?.[o2.high === 0 ? "p1" : "p2"],
            t1pts: getRunTotal(0, o1.high, t1id),
            t2pts: getRunTotal(1, o2.high, t2id)
          },
        ];

        return (<>
          {/* Hole navigation */}
          <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginBottom: "13px", flexWrap: "wrap" }}>
            {Array(9).fill(0).map((_, h) => {
              const done = rows.every(r => {
                const type = getType(r.tIdx, r.pi);
                return type === "sub" || type === "phantom" || getGross(r.tIdx, r.pi, effH(h)) > 0;
              });
              return (
                <button key={h} onClick={() => setHole(h)}
                  style={{
                    width: "34px", height: "34px", borderRadius: "50%", fontFamily: FB, fontSize: "14px", cursor: "pointer",
                    border: hole === h ? `2px solid ${GOLD}` : done ? `1px solid ${G}55` : `1px solid ${GOLD}33`,
                    background: hole === h ? GOLD + "18" : done ? G + "0a" : "transparent",
                    color: hole === h ? GOLD : done ? G + "cc" : M, position: "relative"
                  }}>
                  {h + 1}
                  {isRain(h) && <span style={{ position: "absolute", top: 0, right: 1, fontSize: "7px", color: GO }}>R</span>}
                </button>
              );
            })}
          </div>

          {/* Score entry card — all 4 players, current hole */}
          <div style={{
            background: CARD2, border: `1px solid ${GOLD}33`, borderRadius: "13px",
            overflow: "hidden", marginBottom: "12px"
          }}>
            {/* Hole header */}
            <div style={{
              background: "rgba(26,61,36,0.08)", borderBottom: `1px solid ${GOLD}44`,
              padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: FD, fontSize: "19px", color: GOLD }}>Hole {hole + 1}</span>
                <span style={{ fontSize: "13px", color: M }}>Par {PAR[hole]}</span>
                <span style={{ fontSize: "13px", color: M }}>SI {SI[hole]}</span>
                {isRain(hole) && <Tag color={GO}>☔ → H{effH(hole) + 1}</Tag>}
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button onClick={() => setHole(h => Math.max(0, h - 1))} disabled={hole === 0}
                  style={{
                    padding: "5px 12px", borderRadius: "6px", border: `1px solid ${GOLD}33`,
                    background: "rgba(26,61,36,0.04)", color: CREAM, fontFamily: FB, fontSize: "13px",
                    cursor: hole === 0 ? "not-allowed" : "pointer", opacity: hole === 0 ? 0.3 : 1
                  }}>Prev Hole</button>
                <button onClick={() => setHole(h => Math.min(8, h + 1))} disabled={hole === 8}
                  style={{
                    padding: "5px 12px", borderRadius: "6px", border: `1px solid ${GOLD}33`,
                    background: "rgba(26,61,36,0.04)", color: CREAM, fontFamily: FB, fontSize: "13px",
                    cursor: hole === 8 ? "not-allowed" : "pointer", opacity: hole === 8 ? 0.3 : 1
                  }}>Next Hole</button>
              </div>
            </div>

            {/* 4 player rows */}
            {rows.map((r, ri) => {
              const type = getType(r.tIdx, r.pi);
              const hcp = getHcp(r.tid, r.pi);
              const strokes = hcpStr(hcp, SI[hole]);
              const gross = getGross(r.tIdx, r.pi, effH(hole));
              const pts = getPtsFor(r.tIdx, r.pi, r.tid, hole);
              const pname = TEAMS[r.tid]?.[r.pi === 0 ? "p1" : "p2"] || "";
              const isSep = ri === 1; // separator between low/high pairs

              const adjGross = (delta) => {
                const cur = getGross(r.tIdx, r.pi, effH(hole));
                const next = Math.max(1, Math.min(15, (cur || PAR[hole]) + delta));
                setScoreVal(r.tIdx, r.pi, effH(hole), next);
              };

              const ptColor = pts === null ? M : pts >= 3 ? G : pts === 1 ? "#c0a060" : pts === 0 ? M : R;

              return (
                <div key={ri}>
                  {isSep && <div style={{ height: "1px", background: "rgba(26,61,36,0.08)", margin: "0 0" }} />}
                  <div style={{
                    padding: "10px 14px", display: "flex", alignItems: "center", gap: "8px",
                    background: ri % 2 === 0 ? "rgba(255,255,255,0.01)" : "transparent",
                    borderBottom: ri < 3 ? `1px solid ${GOLD}22` : "none"
                  }}>

                    {/* Player info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                        <span style={{
                          width: "6px", height: "6px", borderRadius: "50%",
                          background: r.color, flexShrink: 0, display: "inline-block"
                        }} />
                        <span style={{
                          fontSize: "12px", fontWeight: 600, color: CREAM,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                        }}>{pname}</span>
                        <Tag color={r.label === "Low" ? "#4db8f0" : "#b97df5"}>{r.label} HCP</Tag>
                        {type === "sub" && <Tag color={GO}>Sub</Tag>}
                        {type === "phantom" && <Tag color={R}>Phantom</Tag>}
                      </div>
                      <div style={{ fontSize: "12px", color: M, marginTop: "2px", paddingLeft: "14px" }}>
                        HCP {hcp}
                        {strokes > 0 && <span style={{ color: G }}> +{strokes} stroke</span>}
                        {strokes < 0 && <span style={{ color: R }}> {strokes} stroke</span>}
                        {" · "}
                        <span style={{ color: r.color }}>Total: {getRunTotal(r.tIdx, r.pi, r.tid)}</span>
                      </div>
                    </div>

                    {/* Type selector */}
                    <select value={type} onChange={e => setTypeVal(r.tIdx, r.pi, e.target.value)}
                      style={{
                        background: "rgba(26,61,36,0.04)", border: `1px solid ${GOLD}33`,
                        borderRadius: "5px", color: CREAM, fontFamily: FB, fontSize: "12px",
                        padding: "3px 5px", cursor: "pointer", outline: "none", flexShrink: 0
                      }}>
                      <option value="normal">Regular</option>
                      <option value="sub">Sub</option>
                      <option value="phantom">Phantom</option>
                    </select>

                    {/* +/- Score entry + net + stab */}
                    {type === "sub" ? (
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        minWidth: "90px", gap: "2px"
                      }}>
                        <span style={{ fontSize: "13px", color: GO }}>6 pts fixed</span>
                        <span style={{ fontSize: "12px", color: M }}>Sub</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        {/* −/+ stepper */}
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <button onClick={() => adjGross(-1)} disabled={type === "phantom"}
                            style={{
                              width: "42px", height: "52px", borderRadius: "9px 0 0 9px",
                              border: `1px solid ${GOLD}44`, borderRight: "none",
                              background: "rgba(26,61,36,0.08)", color: CREAM, fontSize: "22px",
                              cursor: type === "phantom" ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              opacity: type === "phantom" ? 0.3 : 1, userSelect: "none", touchAction: "manipulation"
                            }}>−</button>
                          <div style={{
                            width: "52px", height: "52px", border: `1px solid ${GOLD}44`,
                            background: "rgba(26,61,36,0.08)", display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center", gap: "1px"
                          }}>
                            <span style={{
                              fontSize: "20px", fontWeight: 700,
                              color: gross ? ptColor : M, lineHeight: 1
                            }}>{gross || PAR[hole]}</span>
                            <span style={{
                              fontSize: "8px", lineHeight: 1,
                              color: gross ? ptColor : M, letterSpacing: "0.02em"
                            }}>
                              {gross ? scoreName(gross, PAR[hole]) : "tap −/+"}
                            </span>
                          </div>
                          <button onClick={() => adjGross(+1)} disabled={type === "phantom"}
                            style={{
                              width: "42px", height: "52px", borderRadius: "0 9px 9px 0",
                              border: `1px solid ${GOLD}44`, borderLeft: "none",
                              background: "rgba(26,61,36,0.08)", color: CREAM, fontSize: "22px",
                              cursor: type === "phantom" ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              opacity: type === "phantom" ? 0.3 : 1, userSelect: "none", touchAction: "manipulation"
                            }}>+</button>
                        </div>
                        {/* Net + stab column */}
                        {gross > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", minWidth: "36px" }}>
                            <div style={{ fontSize: "12px", color: M, letterSpacing: "0.04em" }}>NET</div>
                            <div style={{ fontSize: "15px", fontWeight: 700, color: CREAM, lineHeight: 1 }}>
                              {getNet(r.tIdx, r.pi, r.tid, hole)}
                            </div>
                            <PtsBadge pts={pts} />
                          </div>
                        )}
                        {!gross && (
                          <div style={{ width: "36px" }} />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gross / Net / Stab summary strip */}
          <div style={{
            background: CARD2, border: `1px solid ${GOLD}22`,
            borderRadius: "14px", padding: "10px 14px", marginBottom: "13px",
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px"
          }}>
            {rows.map((r, ri) => {
              const type = getType(r.tIdx, r.pi);
              const pname = TEAMS[r.tid]?.[r.pi === 0 ? "p1" : "p2"] || "";
              const gross = type === "sub" ? null : getGrossTotal(r.tIdx, r.pi);
              const net = type === "sub" ? null : getNetTotal(r.tIdx, r.pi, r.tid);
              const stab = getRunTotal(r.tIdx, r.pi, r.tid);
              const rivalStab = getRunTotal(r.rivalTIdx, r.rivalPi, ri < 2 ? t2id : t1id);
              const winning = stab > rivalStab, losing = stab < rivalStab;
              return (
                <div key={ri} style={{
                  background: "rgba(26,61,36,0.05)", borderRadius: "8px",
                  padding: "8px 10px", border: `1px solid ${winning ? r.color + "33" : losing ? R + "22" : "rgba(26,61,36,0.04)"}`
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "5px" }}>
                    <span style={{
                      width: "5px", height: "5px", borderRadius: "50%", background: r.color,
                      display: "inline-block", flexShrink: 0
                    }} />
                    <span style={{
                      fontSize: "13px", fontWeight: 600, color: CREAM,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>{pname}</span>
                    {winning && <span style={{ marginLeft: "auto", fontSize: "12px", color: r.color }}>▲ leading</span>}
                    {losing && <span style={{ marginLeft: "auto", fontSize: "12px", color: R }}>▼ trailing</span>}
                  </div>
                  <div style={{ display: "flex", gap: "13px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "12px", color: M, letterSpacing: "0.04em" }}>GROSS</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: CREAM, lineHeight: 1.1 }}>
                        {type === "sub" ? "—" : gross || "—"}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "12px", color: M, letterSpacing: "0.04em" }}>NET</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#c8d4c0", lineHeight: 1.1 }}>
                        {type === "sub" ? "—" : net || "—"}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "12px", color: G, letterSpacing: "0.04em" }}>STAB</div>
                      <div style={{
                        fontSize: "16px", fontWeight: 700,
                        color: winning ? r.color : losing ? R : G, lineHeight: 1.1
                      }}>{stab}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Full 4-row scrollable scorecard */}
          <div style={{
            background: CARD2, border: `1px solid ${GOLD}22`,
            borderRadius: "14px", overflow: "hidden", marginBottom: "12px"
          }}>
            <div style={{
              padding: "8px 13px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <span style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: M }}>Full Scorecard</span>
              <span style={{ fontSize: "12px", color: M }}>gross <span style={{ color: "#555" }}>·</span> <span style={{ color: G }}>stab</span></span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "520px" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <td style={{ padding: "6px 10px", color: M, fontSize: "12px", whiteSpace: "nowrap" }}>Player</td>
                    {Array(9).fill(0).map((_, h) => (
                      <td key={h} style={{
                        padding: "6px 4px", textAlign: "center",
                        color: h === hole ? G : M, fontWeight: h === hole ? 600 : 400, fontSize: "12px"
                      }}>
                        {h + 1}{isRain(h) && <span style={{ color: GO, fontSize: "7px" }}>R</span>}
                      </td>
                    ))}
                    <td style={{ padding: "6px 8px", textAlign: "center", fontSize: "12px" }}>
                      <div style={{ color: M }}>Gross</div>
                      <div style={{ color: "#c8d4c0" }}>Net</div>
                      <div style={{ color: G }}>Stab</div>
                    </td>
                  </tr>
                  <tr style={{
                    borderBottom: "1px solid rgba(255,255,255,0.07)",
                    background: "rgba(26,61,36,0.03)", fontSize: "12px", color: M
                  }}>
                    <td style={{ padding: "3px 10px" }}>Par</td>
                    {PAR.map((p, h) => (
                      <td key={h} style={{ padding: "3px 4px", textAlign: "center" }}>{p}</td>
                    ))}
                    <td style={{ padding: "3px 8px", textAlign: "center" }}>
                      <div>36</div>
                      <div style={{ color: G }}>—</div>
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => {
                    const type = getType(r.tIdx, r.pi);
                    const pname = TEAMS[r.tid]?.[r.pi === 0 ? "p1" : "p2"] || "";
                    const total = getRunTotal(r.tIdx, r.pi, r.tid);
                    // find rival for this player
                    const rivalTotal = getRunTotal(r.rivalTIdx, r.rivalPi, ri < 2 ? t2id : t1id);
                    const winning = total > rivalTotal, losing = total < rivalTotal;
                    return (
                      <tr key={ri} style={{
                        borderBottom: ri < 3 ? `1px solid ${GOLD}22` : "none",
                        background: ri === 2 ? "rgba(26,61,36,0.04)" : "transparent"
                      }}>
                        <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <span style={{
                              width: "5px", height: "5px", borderRadius: "50%",
                              background: r.color, display: "inline-block", flexShrink: 0
                            }} />
                            <span style={{ fontSize: "13px", color: CREAM, fontWeight: 600 }}>{pname}</span>
                          </div>
                          <div style={{ fontSize: "8px", color: M, paddingLeft: "12px" }}>
                            HCP {getHcp(r.tid, r.pi)} · {r.label}
                          </div>
                        </td>
                        {Array(9).fill(0).map((_, h) => {
                          if (type === "sub") return (
                            <td key={h} style={{ padding: "7px 4px", textAlign: "center", color: GO, fontSize: "13px" }}>S</td>
                          );
                          const pts = getPtsFor(r.tIdx, r.pi, r.tid, h);
                          const gross = getGross(r.tIdx, r.pi, effH(h));
                          const ptColor2 = pts === null ? (gross ? "#555" : M) : pts >= 3 ? G : pts === 1 ? "#c0a060" : pts === 0 ? M : R;
                          return (
                            <td key={h} onClick={() => setHole(h)}
                              style={{
                                padding: "4px 3px", textAlign: "center", cursor: "pointer",
                                background: h === hole ? "rgba(184,150,46,0.05)" : "transparent",
                                minWidth: "28px"
                              }}>
                              {gross > 0 ? (
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                                  <span style={{ fontSize: "14px", fontWeight: 600, color: CREAM }}>{gross}</span>
                                  <span style={{ fontSize: "12px", fontWeight: pts !== null && pts >= 3 ? 700 : 400, color: ptColor2 }}>
                                    {pts !== null ? pts : "?"}
                                  </span>
                                </div>
                              ) : (
                                <span style={{ color: CREAM, fontSize: "14px" }}>–</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: CREAM }}>
                            {type === "sub" ? "—" : getGrossTotal(r.tIdx, r.pi) || "—"}
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "#c8d4c0" }}>
                            {type === "sub" ? "—" : getNetTotal(r.tIdx, r.pi, r.tid) || "—"}
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: winning ? r.color : losing ? R : G }}>
                            {total}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Individual match results */}
          <div style={{
            background: CARD2, border: `1px solid ${GOLD}22`,
            borderRadius: "14px", overflow: "hidden", marginBottom: "12px"
          }}>
            <div style={{
              padding: "8px 13px", borderBottom: "1px solid rgba(255,255,255,0.06)",
              fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: M,
              display: "flex", justifyContent: "space-between", alignItems: "center"
            }}>
              <span>Individual Matches</span>
              <span style={{ color: G }}>
                {(() => {
                  const t1m = matchResults.reduce((s, m) => s + (m.t1pts > m.t2pts ? 2 : m.t1pts === m.t2pts ? 1 : 0), 0);
                  const t2m = matchResults.reduce((s, m) => s + (m.t2pts > m.t1pts ? 2 : m.t1pts === m.t2pts ? 1 : 0), 0);
                  const t1team = t1m > t2m ? 4 : t1m === t2m ? 2 : 0;
                  const t2team = t2m > t1m ? 4 : t1m === t2m ? 2 : 0;
                  return <>T{t1id} {t1m + t1team}<span style={{ color: M }}> vs </span>{t2m + t2team} T{t2id}<span style={{ color: GO }}> / 8 match pts</span></>;
                })()}
              </span>
            </div>
            {matchResults.map((m, i) => {
              const t1wins = m.t1pts > m.t2pts, t2wins = m.t2pts > m.t1pts, tied = m.t1pts === m.t2pts;
              return (
                <div key={i} style={{
                  padding: "10px 14px",
                  borderBottom: i === 0 ? `1px solid ${GOLD}22` : "none",
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px"
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", color: M, marginBottom: "3px", letterSpacing: "0.07em", textTransform: "uppercase" }}>{m.label}</div>
                    <div style={{ fontSize: "12px" }}>
                      <span style={{ color: t1wins ? G : CREAM, fontWeight: t1wins ? 700 : 400 }}>{m.t1name}</span>
                      <span style={{ color: M, margin: "0 6px" }}>vs</span>
                      <span style={{ color: t2wins ? GO : CREAM, fontWeight: t2wins ? 700 : 400 }}>{m.t2name}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                    <span style={{
                      fontWeight: 700, fontSize: "15px",
                      color: t1wins ? G : tied ? CREAM : "#555"
                    }}>{m.t1pts}</span>
                    <span style={{ color: M, fontSize: "13px" }}>–</span>
                    <span style={{
                      fontWeight: 700, fontSize: "15px",
                      color: t2wins ? GO : tied ? CREAM : "#555"
                    }}>{m.t2pts}</span>
                    <Tag color={t1wins ? G : t2wins ? GO : M}>
                      {t1wins ? "+2" : t2wins ? "+2" : "Split 1-1"}
                    </Tag>
                  </div>
                </div>
              );
            })}
          </div>

        </>);
      })()}

      {/* Bonus pts */}
      {weekBonus ? (
        <div style={{ background: GOLD + "0a", border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "11px 14px", marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: "8px" }}>
            ✓ Week {selWeek} Bonus Points Awarded
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {Object.entries(weekBonus).sort((a, b) => b[1] - a[1]).map(([tid, bp]) => (
              <div key={tid} style={{
                padding: "4px 9px", borderRadius: "6px", background: G + "18",
                border: `1px solid ${G}33`, fontSize: "13px"
              }}>
                <span style={{ color: G, fontWeight: 600 }}>+{bp}</span>
                <span style={{ color: M, marginLeft: "4px" }}>{TEAMS[parseInt(tid)]?.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          background: GO + "0d", border: `1px solid ${GO}22`, borderRadius: "14px",
          padding: "10px 14px", marginBottom: "12px", fontSize: "13px", color: M
        }}>
          ⚡ Bonus points (8/6/4/2) awarded once all 9 Week {selWeek} matches are scored.
        </div>
      )}

      {/* Handicaps */}
      <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "14px", padding: "11px 14px", marginBottom: "12px" }}>
        <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "12px" }}>Handicaps (9-hole)</div>
        <div style={{ display: "flex", gap: "13px", flexWrap: "wrap" }}>
          {[{ tIdx: 0, tid: t1id, color: G }, { tIdx: 1, tid: t2id, color: GO }].map(({ tIdx, tid, color }) => (
            <div key={tIdx} style={{ flex: "1 1 180px" }}>
              <div style={{ fontSize: "13px", color, marginBottom: "5px" }}>{TEAMS[tid]?.name}</div>
              {[0, 1].map(pi => {
                const pname = TEAMS[tid]?.[pi === 0 ? "p1" : "p2"] || "";
                const hcp = (league.handicaps[tid] || [0, 0])[pi] || 0;
                return (
                  <div key={pi} style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: pi === 0 ? "4px" : 0 }}>
                    <span style={{ fontSize: "13px", flex: 1, color: CREAM }}>{pname}</span>
                    <input type="number" min="-9" max="36" value={hcp}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        const next = { ...league, handicaps: { ...league.handicaps, [tid]: [...(league.handicaps[tid] || [0, 0])] } };
                        next.handicaps[tid][pi] = val;
                        saveLeague(next);
                      }}
                      style={{
                        width: "46px", background: "rgba(255,255,255,0.95)", border: `1px solid ${GOLD}33`,
                        borderRadius: "5px", color: CREAM, fontFamily: FB, fontSize: "14px",
                        padding: "3px 5px", textAlign: "center", outline: "none"
                      }} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Scan scorecard */}
      <div style={{
        background: CARD, border: `1px solid ${scanState === "done" ? G + "44" : scanState === "error" ? R + "44" : "rgba(255,255,255,0.95)"}`,
        borderRadius: "14px", padding: "12px 14px", marginBottom: "12px"
      }}>
        <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "8px" }}>📷 Scan Scorecard</div>
        <div style={{ fontSize: "13px", color: M, marginBottom: "8px" }}>Upload a photo and Claude will auto-fill all scores.</div>
        <label style={{
          padding: "7px 13px", borderRadius: "7px", border: `1px solid ${G}44`,
          background: GOLD + "18", color: GOLD, fontFamily: FM || FB, fontSize: "13px", letterSpacing: "0.06em",
          textTransform: "uppercase", cursor: scanState === "loading" ? "not-allowed" : "pointer",
          opacity: scanState === "loading" ? 0.5 : 1, display: "inline-block"
        }}>
          {scanState === "loading" ? "Scanning..." : "Upload Photo"}
          <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
            disabled={scanState === "loading"}
            onChange={e => { if (e.target.files[0]) scanCard(e.target.files[0]); e.target.value = ""; }} />
        </label>
        {scanMsg && (
          <div style={{ marginTop: "8px", fontSize: "13px", color: scanState === "done" ? G : scanState === "error" ? R : M }}>{scanMsg}</div>
        )}
      </div>

      {/* Save */}
      {/* Auto-saves on score change */}

    </>)}
  </div>
  );
}

export default ScoringScreen;
