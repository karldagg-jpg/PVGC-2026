import React, { useMemo, useState } from "react";
import { PAR, SI, RAINOUT_SUB, TEAMS, ALL_PLAYERS } from "../constants/league";
import { stabPts, hcpStr } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD2, FB, FD } from "../constants/theme";

const DIST = [
  { key: "eagle",  color: "#8a5a1a", label: "Eagle"   },
  { key: "birdie", color: "#1a6b3a", label: "Birdie"  },
  { key: "par",    color: "#7a9a7a", label: "Par"     },
  { key: "bogey",  color: "#c07020", label: "Bogey"   },
  { key: "double", color: "#b03010", label: "Double"  },
  { key: "triple", color: "#8a1010", label: "Triple+" },
];

function normS(s) {
  if (!s) return [[], []];
  if (Array.isArray(s)) return s;
  return [s.p0 || [], s.p1 || []];
}

function computeStats(results, handicaps, filterTid, filterPi) {
  const holes = Array.from({ length: 9 }, () => ({
    eagle: 0, birdie: 0, par: 0, bogey: 0, double: 0, triple: 0,
    grossSum: 0, ptsSum: 0, n: 0,
  }));

  for (const weekRecs of Object.values(results || {})) {
    for (const [mk, rec] of Object.entries(weekRecs || {})) {
      if (!rec) continue;
      const parts = mk.split("-");
      const tlow = parseInt(parts[1]), thigh = parseInt(parts[2]);
      const snap = rec.hcpSnapshot || {};

      [[tlow, normS(rec.t1scores), rec.t1types],
       [thigh, normS(rec.t2scores), rec.t2types]].forEach(([tid, scores, types]) => {
        for (let pi = 0; pi < 2; pi++) {
          if (filterTid != null && (tid !== filterTid || pi !== filterPi)) continue;
          const type = (types || [])[pi] || "normal";
          if (type !== "normal") continue;
          const hcp = (snap[tid] || handicaps?.[tid] || [0, 0])[pi] || 0;
          const gr = scores[pi] || [];

          for (let hi = 0; hi < 9; hi++) {
            let g = gr[hi] || 0;
            if (!g && rec.rainout && RAINOUT_SUB?.[hi] != null) g = gr[RAINOUT_SUB[hi]] || 0;
            if (!g) continue;
            const pts = stabPts(g, PAR[hi], hcpStr(hcp, SI[hi])) || 0;
            const diff = g - PAR[hi];
            holes[hi].grossSum += g;
            holes[hi].ptsSum += pts;
            holes[hi].n++;
            if (diff <= -2)     holes[hi].eagle++;
            else if (diff ===  -1) holes[hi].birdie++;
            else if (diff ===   0) holes[hi].par++;
            else if (diff ===   1) holes[hi].bogey++;
            else if (diff ===   2) holes[hi].double++;
            else                   holes[hi].triple++;
          }
        }
      });
    }
  }

  return holes.map((h, hi) => ({
    ...h,
    hi,
    avgGross: h.n ? Math.round(h.grossSum / h.n * 10) / 10 : null,
    avgPts:   h.n ? Math.round(h.ptsSum   / h.n * 10) / 10 : null,
  }));
}

export default function StatsScreen({ league }) {
  const [selKey, setSelKey] = useState("");   // "" = all, "tid-pi" = player

  const sel = selKey ? { tid: parseInt(selKey.split("-")[0]), pi: parseInt(selKey.split("-")[1]) } : null;

  const stats = useMemo(
    () => computeStats(league.results, league.handicaps, sel?.tid, sel?.pi),
    [league.results, league.handicaps, selKey]
  );

  const hasData = stats.some(h => h.n > 0);
  const rounds  = stats[0]?.n ?? 0;

  const holesWithData = stats.filter(h => h.n > 0);
  const avg9Gross = holesWithData.length === 9 ? (stats.reduce((s, h) => s + (h.avgGross ?? 0), 0)).toFixed(1) : null;
  const avg9Pts   = holesWithData.length === 9 ? (stats.reduce((s, h) => s + (h.avgPts   ?? 0), 0)).toFixed(1) : null;

  // Weeks actually played: has scored records AND not a cancelled/rained-out week
  // (cancelled weeks can still carry a leftover record, which shouldn't count).
  const cancelledSet = new Set(
    [...(league.cancelledWeeks instanceof Set ? league.cancelledWeeks : (league.cancelledWeeks || []))].map(Number)
  );
  const weeksPlayed = Object.keys(league.results || {}).filter(
    w => !cancelledSet.has(Number(w)) && Object.keys(league.results[w] || {}).length > 0
  ).length;

  // Quick-fact summaries
  const facts = useMemo(() => {
    if (holesWithData.length < 2) return null;
    const byPts  = [...holesWithData].sort((a, b) => (b.avgPts ?? 0) - (a.avgPts ?? 0));
    const byDiff = [...holesWithData].sort((a, b) => ((a.avgGross ?? 99) - PAR[a.hi]) - ((b.avgGross ?? 99) - PAR[b.hi]));
    return {
      easiest:     byPts[0],
      hardest:     byPts[byPts.length - 1],
      subPar:      byDiff[0],
      mostBirdies: [...holesWithData].sort((a, b) => b.birdie - a.birdie)[0],
      mostBad:     [...holesWithData].sort((a, b) => (b.double + b.triple) - (a.double + a.triple))[0],
    };
  }, [stats]);

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "28px", fontWeight: 600, color: CREAM, marginBottom: "4px" }}>
        Hole Stats
      </div>
      <div style={{ color: M, fontSize: "14px", marginBottom: "18px" }}>
        Scoring distribution &amp; averages by hole · every scored round, incl. the Knockdown
      </div>

      {/* Player filter */}
      <div style={{ marginBottom: "18px" }}>
        <select
          value={selKey}
          onChange={e => setSelKey(e.target.value)}
          style={{
            padding: "9px 12px", borderRadius: "9px",
            border: `1px solid ${GOLD}44`, background: CARD2,
            color: CREAM, fontFamily: FB, fontSize: "13px",
            cursor: "pointer", outline: "none", maxWidth: "280px",
          }}
        >
          <option value="">All Players</option>
          {ALL_PLAYERS.map(p => (
            <option key={`${p.tid}-${p.pi}`} value={`${p.tid}-${p.pi}`}>
              {p.name} · {p.team}
            </option>
          ))}
        </select>
      </div>

      {/* Summary pills */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
        {[
          { label: "Weeks",   val: weeksPlayed },
          { label: "Rounds",  val: rounds || "—" },
          { label: "Avg 9-hole gross", val: avg9Gross ?? "—" },
          { label: "Avg 9-hole pts",   val: avg9Pts   ?? "—" },
        ].map(({ label, val }) => (
          <div key={label} style={{
            background: CARD2, border: `1px solid ${GOLD}22`,
            borderRadius: "10px", padding: "8px 14px",
          }}>
            <div style={{ fontSize: "10px", color: M, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
              {label}
            </div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: CREAM }}>{val}</div>
          </div>
        ))}
      </div>

      {!hasData ? (
        <div style={{ textAlign: "center", color: M, padding: "40px 0", fontSize: "14px" }}>
          No scoring data yet.
        </div>
      ) : (
        <>
          {/* Per-hole breakdown */}
          <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", overflow: "hidden", marginBottom: "14px" }}>
            {/* Legend */}
            <div style={{
              padding: "9px 16px", borderBottom: `1px solid ${GOLD}22`,
              display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center",
            }}>
              {DIST.map(d => (
                <div key={d.key} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "2px", background: d.color }} />
                  <span style={{ fontSize: "11px", color: M }}>{d.label}</span>
                </div>
              ))}
            </div>

            {stats.map((h, hi) => {
              if (h.n === 0) return (
                <div key={hi} style={{ padding: "12px 16px", borderBottom: hi < 8 ? `1px solid ${GOLD}11` : "none", display: "flex", alignItems: "center", gap: "14px", opacity: 0.4 }}>
                  <div style={{ flexShrink: 0, width: "68px" }}>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: CREAM }}>H{hi + 1}</div>
                    <div style={{ fontSize: "11px", color: M }}>Par {PAR[hi]} · SI {SI[hi]}</div>
                  </div>
                  <div style={{ flex: 1, fontSize: "12px", color: M }}>No data</div>
                </div>
              );

              const total = DIST.reduce((s, d) => s + h[d.key], 0);
              const diff = h.avgGross != null ? h.avgGross - PAR[hi] : null;
              const diffStr = diff != null ? `${diff >= 0 ? "+" : ""}${diff.toFixed(1)}` : "—";
              const diffColor = diff == null ? M : diff <= -0.3 ? G : diff <= 0.3 ? GOLD : diff <= 0.8 ? GO : R;

              return (
                <div key={hi} style={{
                  padding: "12px 16px",
                  borderBottom: hi < 8 ? `1px solid ${GOLD}11` : "none",
                  display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap",
                }}>
                  {/* Hole label */}
                  <div style={{ flexShrink: 0, width: "68px" }}>
                    <div style={{ fontSize: "18px", fontWeight: 700, color: CREAM }}>H{hi + 1}</div>
                    <div style={{ fontSize: "11px", color: M }}>Par {PAR[hi]} · SI {SI[hi]}</div>
                  </div>

                  {/* Distribution bar + counts */}
                  <div style={{ flex: 1, minWidth: "160px" }}>
                    <div style={{ display: "flex", height: "22px", borderRadius: "5px", overflow: "hidden" }}>
                      {DIST.map(d => {
                        const w = total ? h[d.key] / total : 0;
                        if (w === 0) return null;
                        return (
                          <div key={d.key} style={{
                            width: `${w * 100}%`, background: d.color,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                            {w >= 0.11 && (
                              <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.9)", fontWeight: 700 }}>
                                {Math.round(w * 100)}%
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Count row */}
                    <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                      {DIST.filter(d => h[d.key] > 0).map(d => (
                        <span key={d.key} style={{ fontSize: "10px", color: M }}>
                          <span style={{ color: d.color, fontWeight: 600 }}>{h[d.key]}</span> {d.label.toLowerCase()}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Avg stats */}
                  <div style={{ flexShrink: 0, textAlign: "right", minWidth: "80px" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "4px", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: "18px", fontWeight: 700, color: CREAM }}>{h.avgGross ?? "—"}</span>
                      <span style={{ fontSize: "12px", fontWeight: 700, color: diffColor }}>({diffStr})</span>
                    </div>
                    <div style={{ fontSize: "12px", color: G, fontWeight: 600 }}>
                      {h.avgPts != null ? `${h.avgPts} pts` : "—"}
                    </div>
                    <div style={{ fontSize: "10px", color: M }}>{h.n} rounds</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick facts */}
          {facts && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "10px" }}>
              {[
                { label: "Easiest Hole",   val: `H${facts.easiest.hi + 1}`,     sub: `${facts.easiest.avgPts} avg pts`,        color: G  },
                { label: "Hardest Hole",   val: `H${facts.hardest.hi + 1}`,     sub: `${facts.hardest.avgPts} avg pts`,        color: R  },
                { label: "Most Birdies",   val: `H${facts.mostBirdies.hi + 1}`, sub: `${facts.mostBirdies.birdie} birdies`,   color: G  },
                { label: "Most Doubles+",  val: `H${facts.mostBad.hi + 1}`,     sub: `${facts.mostBad.double + facts.mostBad.triple} doubles+`, color: R },
              ].map(({ label, val, sub, color }) => (
                <div key={label} style={{
                  background: CARD2, border: `1px solid ${GOLD}22`,
                  borderRadius: "10px", padding: "10px 14px",
                }}>
                  <div style={{ fontSize: "10px", color: M, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: "2px" }}>
                    {label}
                  </div>
                  <div style={{ fontSize: "24px", fontWeight: 700, color }}>{val}</div>
                  <div style={{ fontSize: "11px", color: M }}>{sub}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
