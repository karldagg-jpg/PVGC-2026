import React, { useState, useMemo } from "react";
import { ALL_PLAYERS, TEAMS, PAR, SI, RAINOUT_SUB, SCHEDULE } from "../constants/league";
import { getEffectiveHcp, getEffectiveHcpRaw, getOpponent, matchKey, stabPts, hcpStr } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD, CARD2, FB, FD } from "../constants/theme";

const REGULAR_WEEKS = Array.from({ length: 17 }, (_, i) => i + 1);

// Normalize scores whether stored as array-of-arrays or {p0,p1} object
function normScores(s) {
  if (!s) return [[], []];
  if (Array.isArray(s)) return s;
  return [s.p0 || [], s.p1 || []];
}

function getPlayerGross(rec, tIdx, pi) {
  const scores = normScores(tIdx === 0 ? rec.t1scores : rec.t2scores);
  let g = 0;
  for (let hi = 0; hi < 9; hi++) {
    const effHi = (rec.rainout && !(scores[pi]?.[hi]) && RAINOUT_SUB[hi] !== undefined)
      ? RAINOUT_SUB[hi] : hi;
    g += scores[pi]?.[effHi] || 0;
  }
  return g;
}

function getPlayerStab(rec, tIdx, pi, tid) {
  const types = (tIdx === 0 ? rec.t1types : rec.t2types) || [];
  const type = types[pi] || "normal";
  if (type === "sub") return 6;
  if (type === "phantom") return 2;
  const scores = normScores(tIdx === 0 ? rec.t1scores : rec.t2scores);
  const snap = rec.hcpSnapshot;
  const hcp = snap ? (snap[tid] || [0, 0])[pi] || 0 : 0;
  let total = 0;
  for (let hi = 0; hi < 9; hi++) {
    const effHi = (rec.rainout && !(scores[pi]?.[hi]) && RAINOUT_SUB[hi] !== undefined)
      ? RAINOUT_SUB[hi] : hi;
    const gross = scores[pi]?.[effHi] || 0;
    if (!gross) continue;
    total += stabPts(gross, PAR[hi], hcpStr(hcp, SI[hi])) || 0;
  }
  return total;
}

// Build full season stats for a player
function buildPlayerStats(tid, pi, league) {
  const rounds = [];

  for (const w of REGULAR_WEEKS) {
    const opp = getOpponent(tid, w);
    if (!opp) continue;
    const mk = matchKey(w, Math.min(tid, opp), Math.max(tid, opp));
    const rec = league.results[w]?.[mk];
    if (!rec) continue;
    const tIdx = tid < opp ? 0 : 1;
    const types = (tIdx === 0 ? rec.t1types : rec.t2types) || [];
    const type = types[pi] || "normal";
    if (type !== "normal") continue;
    const gross = getPlayerGross(rec, tIdx, pi);
    if (gross === 0) continue;
    const stab = getPlayerStab(rec, tIdx, pi, tid);
    const hcp = getEffectiveHcp(tid, pi, w, league.results, league.handicaps, league.hcpOverrides || {});

    // Individual head-to-head: lo vs lo, hi vs hi
    // Determine if this player is lo or hi
    const r0 = getEffectiveHcpRaw(tid, 0, w, league.results, league.handicaps, league.hcpOverrides || {});
    const r1 = getEffectiveHcpRaw(tid, 1, w, league.results, league.handicaps, league.hcpOverrides || {});
    const isLo = (r0 <= r1) ? (pi === 0) : (pi === 1);

    // Find rival
    const oppR0 = getEffectiveHcpRaw(opp, 0, w, league.results, league.handicaps, league.hcpOverrides || {});
    const oppR1 = getEffectiveHcpRaw(opp, 1, w, league.results, league.handicaps, league.hcpOverrides || {});
    const rivalPi = isLo ? (oppR0 <= oppR1 ? 0 : 1) : (oppR0 <= oppR1 ? 1 : 0);
    const oppTIdx = opp < tid ? 0 : 1;
    const rivalStab = getPlayerStab(rec, oppTIdx, rivalPi, opp);

    rounds.push({
      week: w,
      gross,
      stab,
      hcp,
      opp,
      rivalPi,
      rivalStab,
      won: stab > rivalStab,
      lost: stab < rivalStab,
      tied: stab === rivalStab,
    });
  }

  const played = rounds.length;
  const avgGross = played ? Math.round((rounds.reduce((s, r) => s + r.gross, 0) / played) * 10) / 10 : null;
  const bestGross = played ? Math.min(...rounds.map(r => r.gross)) : null;
  const totalStab = rounds.reduce((s, r) => s + r.stab, 0);
  const wins = rounds.filter(r => r.won).length;
  const losses = rounds.filter(r => r.lost).length;
  const ties = rounds.filter(r => r.tied).length;
  const currentHcp = played
    ? getEffectiveHcp(tid, pi, REGULAR_WEEKS[REGULAR_WEEKS.length - 1] + 1, league.results, league.handicaps, league.hcpOverrides || {})
    : (league.handicaps?.[tid]?.[pi] ?? 0);

  // HCP progression: starting HCP + HCP earned after each played round
  const startHcp = (league.handicaps?.[tid] || [0, 0])[pi];
  const hcpTrend = [{ week: 0, hcp: startHcp }];
  for (const r of rounds) {
    const earned = getEffectiveHcpRaw(tid, pi, r.week + 1, league.results, league.handicaps, league.hcpOverrides || {});
    hcpTrend.push({ week: r.week, hcp: earned });
  }

  // Head-to-head vs each opponent
  const h2h = {};
  for (const r of rounds) {
    if (!h2h[r.opp]) h2h[r.opp] = { w: 0, l: 0, t: 0 };
    if (r.won) h2h[r.opp].w++;
    else if (r.lost) h2h[r.opp].l++;
    else h2h[r.opp].t++;
  }

  return { rounds, played, avgGross, bestGross, totalStab, wins, losses, ties, currentHcp, hcpTrend, h2h };
}

// Full SVG sparkline showing HCP progression: start + after each played round
// Y-axis inverted: lower HCP = higher on chart (improving = line goes up)
const VB_W = 300;
function HcpSparkline({ trend }) {
  if (trend.length < 2) return null;
  const vals = trend.map(t => t.hcp);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const H = 44;
  const pts = trend.map((t, i) => {
    const x = (i / (trend.length - 1)) * VB_W;
    const y = ((maxV - t.hcp) / range) * H;
    return { x, y, hcp: t.hcp, week: t.week };
  });
  const ptStr = pts.map(p => `${p.x},${p.y}`).join(" ");
  const first = trend[0], last = trend[trend.length - 1];
  const improving = last.hcp < first.hcp;
  const lineColor = improving ? G : last.hcp > first.hcp ? R : GOLD;

  return (
    <svg viewBox={`-6 -6 ${VB_W + 12} ${H + 28}`} style={{ width: "100%", display: "block" }}>
      <polyline points={ptStr} fill="none" stroke={lineColor} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={lineColor} />
          <text x={p.x} y={p.y + 15} textAnchor="middle" fontSize="9.5" fill={i === 0 ? M : i === pts.length - 1 ? GOLD : CREAM} fontWeight={i === pts.length - 1 ? "700" : "400"}>
            {p.hcp}
          </text>
          <text x={p.x} y={p.y + 25} textAnchor="middle" fontSize="8" fill={M} opacity="0.6">
            {p.week === 0 ? "Start" : `W${p.week}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

// Player card for the roster grid
function PlayerCard({ tid, pi, league, onClick }) {
  const team = TEAMS[tid];
  const name = pi === 0 ? team?.p1 : team?.p2;
  const hcp = getEffectiveHcp(tid, pi, 18, league.results, league.handicaps, league.hcpOverrides || {});
  const opp = getOpponent(tid, 1);
  // Count played rounds quickly
  let played = 0;
  let totalStab = 0;
  for (const w of REGULAR_WEEKS) {
    const o = getOpponent(tid, w);
    if (!o) continue;
    const mk = matchKey(w, Math.min(tid, o), Math.max(tid, o));
    const rec = league.results[w]?.[mk];
    if (!rec) continue;
    const tIdx = tid < o ? 0 : 1;
    const types = (tIdx === 0 ? rec.t1types : rec.t2types) || [];
    if ((types[pi] || "normal") !== "normal") continue;
    const gross = getPlayerGross(rec, tIdx, pi);
    if (gross === 0) continue;
    played++;
    totalStab += getPlayerStab(rec, tIdx, pi, tid);
  }

  return (
    <div onClick={onClick}
      style={{
        background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px",
        padding: "14px 14px", cursor: "pointer", transition: "border-color 0.15s",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = GOLD + "66"}
      onMouseLeave={e => e.currentTarget.style.borderColor = GOLD + "22"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "50%",
          background: G + "22", border: `1px solid ${G}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "13px", fontWeight: 700, color: G, flexShrink: 0,
        }}>
          {name?.charAt(0)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: CREAM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {name}
          </div>
          <div style={{ fontSize: "11px", color: M, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {team?.name}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: "10px", color: M, letterSpacing: "0.06em", textTransform: "uppercase" }}>HCP</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: GOLD }}>{hcp}</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: "10px", color: M, letterSpacing: "0.06em", textTransform: "uppercase" }}>Rounds</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: CREAM }}>{played}</div>
        </div>
        <div style={{ textAlign: "center", flex: 1 }}>
          <div style={{ fontSize: "10px", color: G, letterSpacing: "0.06em", textTransform: "uppercase" }}>Stab</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: G }}>{totalStab || "—"}</div>
        </div>
      </div>
    </div>
  );
}

// Full player profile
function PlayerProfile({ tid, pi, league, onBack }) {
  const team = TEAMS[tid];
  const name = pi === 0 ? team?.p1 : team?.p2;
  const stats = useMemo(() => buildPlayerStats(tid, pi, league), [tid, pi, league.results]);
  const recent = [...stats.rounds].reverse().slice(0, 5);

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto" }}>
      {/* Back */}
      <button onClick={onBack}
        style={{ background: "none", border: "none", color: M, fontFamily: FB, fontSize: "13px", cursor: "pointer", marginBottom: "16px", padding: "0", display: "flex", alignItems: "center", gap: "5px" }}>
        ← All Players
      </button>

      {/* Header */}
      <div style={{
        background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px",
        padding: "20px", marginBottom: "14px",
        display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap"
      }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "50%",
          background: G + "22", border: `2px solid ${G}55`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "22px", fontWeight: 700, color: G, flexShrink: 0,
        }}>
          {name?.charAt(0)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: FD, fontSize: "24px", fontWeight: 700, color: CREAM }}>{name}</div>
          <div style={{ fontSize: "13px", color: M }}>{team?.name} · {pi === 0 ? "Player 1" : "Player 2"}</div>
        </div>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          {[
            { label: "HCP", val: stats.currentHcp, color: GOLD },
            { label: "Rounds", val: stats.played, color: CREAM },
            { label: "Avg Gross", val: stats.avgGross ?? "—", color: CREAM },
            { label: "Best", val: stats.bestGross ?? "—", color: G },
            { label: "Total Stab", val: stats.totalStab || "—", color: G },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: M, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "2px" }}>{label}</div>
              <div style={{ fontSize: "20px", fontWeight: 700, color }}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* W/L record + HCP sparkline */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
        {/* Individual record */}
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: M, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "10px" }}>
            Individual Record
          </div>
          <div style={{ display: "flex", gap: "16px" }}>
            {[
              { label: "W", val: stats.wins, color: G },
              { label: "L", val: stats.losses, color: R },
              { label: "T", val: stats.ties, color: M },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: "22px", fontWeight: 700, color }}>{val}</div>
                <div style={{ fontSize: "11px", color: M }}>{label}</div>
              </div>
            ))}
          </div>
          {stats.played > 0 && (
            <div style={{ marginTop: "8px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: "2px", background: G,
                width: `${(stats.wins / stats.played) * 100}%`,
              }} />
            </div>
          )}
        </div>

        {/* HCP trend */}
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: M, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "6px" }}>
            Handicap Trend
          </div>
          {stats.hcpTrend.length >= 2 ? (
            <HcpSparkline trend={stats.hcpTrend} />
          ) : (
            <div style={{ fontSize: "12px", color: M }}>Not enough rounds</div>
          )}
        </div>
      </div>

      {/* Recent form */}
      {recent.length > 0 && (
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", padding: "14px 16px", marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", color: M, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "10px" }}>
            Recent Form — Last {recent.length} Rounds
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {recent.map(r => (
              <div key={r.week} style={{
                display: "flex", alignItems: "center", gap: "10px",
                padding: "7px 10px", borderRadius: "8px",
                background: r.won ? G + "0d" : r.lost ? R + "08" : "rgba(26,61,36,0.04)",
                border: `1px solid ${r.won ? G + "22" : r.lost ? R + "18" : GOLD + "11"}`,
              }}>
                <span style={{ fontSize: "11px", color: M, width: "28px", flexShrink: 0 }}>W{r.week}</span>
                <span style={{ fontSize: "12px", color: M, flex: 1 }}>vs {TEAMS[r.opp]?.name}</span>
                <span style={{ fontSize: "12px", color: M }}>Gross {r.gross}</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: G, minWidth: "32px", textAlign: "right" }}>
                  {r.stab} pts
                </span>
                <span style={{
                  fontSize: "11px", fontWeight: 700, minWidth: "20px", textAlign: "center",
                  color: r.won ? G : r.lost ? R : M,
                }}>
                  {r.won ? "W" : r.lost ? "L" : "T"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Head-to-head */}
      {Object.keys(stats.h2h).length > 0 && (
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", padding: "14px 16px", marginBottom: "14px" }}>
          <div style={{ fontSize: "11px", color: M, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "10px" }}>
            Head-to-Head
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "6px" }}>
            {Object.entries(stats.h2h)
              .sort((a, b) => (b[1].w - b[1].l) - (a[1].w - a[1].l))
              .map(([oppId, rec]) => {
                const total = rec.w + rec.l + rec.t;
                const net = rec.w - rec.l;
                return (
                  <div key={oppId} style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "7px 10px", borderRadius: "8px",
                    background: net > 0 ? G + "0d" : net < 0 ? R + "08" : "rgba(26,61,36,0.03)",
                    border: `1px solid ${net > 0 ? G + "22" : net < 0 ? R + "18" : GOLD + "11"}`,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: CREAM, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {TEAMS[parseInt(oppId)]?.name}
                      </div>
                      <div style={{ fontSize: "10px", color: M }}>{total} match{total !== 1 ? "es" : ""}</div>
                    </div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: net > 0 ? G : net < 0 ? R : M, flexShrink: 0 }}>
                      {rec.w}–{rec.l}{rec.t > 0 ? `–${rec.t}` : ""}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* All rounds table */}
      {stats.rounds.length > 0 && (
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", padding: "14px 16px" }}>
          <div style={{ fontSize: "11px", color: M, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 600, marginBottom: "10px" }}>
            All Rounds
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {stats.rounds.map(r => (
              <div key={r.week} style={{
                display: "grid", gridTemplateColumns: "30px 1fr 42px 42px 42px 28px",
                alignItems: "center", gap: "6px",
                padding: "5px 8px", borderRadius: "6px",
                background: r.won ? G + "08" : "transparent",
              }}>
                <span style={{ fontSize: "11px", color: M }}>W{r.week}</span>
                <span style={{ fontSize: "11px", color: M, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {TEAMS[r.opp]?.name}
                </span>
                <span style={{ fontSize: "11px", color: M, textAlign: "center" }}>HCP {r.hcp}</span>
                <span style={{ fontSize: "12px", color: CREAM, textAlign: "center" }}>{r.gross}</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: G, textAlign: "center" }}>{r.stab}</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: r.won ? G : r.lost ? R : M, textAlign: "center" }}>
                  {r.won ? "W" : r.lost ? "L" : "T"}
                </span>
              </div>
            ))}
            <div style={{ display: "grid", gridTemplateColumns: "30px 1fr 42px 42px 42px 28px", gap: "6px", padding: "6px 8px", borderTop: `1px solid ${GOLD}22`, marginTop: "4px" }}>
              <span />
              <span style={{ fontSize: "11px", color: M, fontWeight: 600 }}>Season totals</span>
              <span />
              <span style={{ fontSize: "12px", color: CREAM, textAlign: "center", fontWeight: 600 }}>
                {stats.avgGross ? `~${stats.avgGross}` : ""}
              </span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: G, textAlign: "center" }}>{stats.totalStab}</span>
              <span style={{ fontSize: "11px", color: M, textAlign: "center" }}>{stats.wins}W</span>
            </div>
          </div>
        </div>
      )}

      {stats.played === 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px", fontSize: "13px", color: M }}>
          No rounds played yet
        </div>
      )}
    </div>
  );
}

// Main screen
export default function PlayerScreen({ league }) {
  const [selected, setSelected] = useState(null); // {tid, pi}
  const [search, setSearch] = useState("");

  const filtered = ALL_PLAYERS.filter(p => {
    const name = (p.pi === 0 ? TEAMS[p.tid]?.p1 : TEAMS[p.tid]?.p2) || "";
    const team = TEAMS[p.tid]?.name || "";
    const q = search.toLowerCase();
    return !q || name.toLowerCase().includes(q) || team.toLowerCase().includes(q);
  });

  if (selected) {
    return (
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "20px 14px" }}>
        <PlayerProfile tid={selected.tid} pi={selected.pi} league={league} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div style={{ fontFamily: FD, fontSize: "30px", fontWeight: 700, color: CREAM }}>Players</div>
        <div style={{ fontSize: "12px", color: M, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {ALL_PLAYERS.length} players · tap for profile
        </div>
      </div>

      {/* Search */}
      <input
        type="text" placeholder="Search by name or team…"
        value={search} onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "10px 14px", borderRadius: "10px", marginBottom: "16px",
          border: `1px solid ${GOLD}33`, background: "rgba(255,255,255,0.07)",
          color: CREAM, fontFamily: FB, fontSize: "14px", outline: "none",
        }}
      />

      {/* Roster grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
        {filtered.map(p => (
          <PlayerCard
            key={`${p.tid}-${p.pi}`}
            tid={p.tid} pi={p.pi}
            league={league}
            onClick={() => setSelected({ tid: p.tid, pi: p.pi })}
          />
        ))}
      </div>
    </div>
  );
}
