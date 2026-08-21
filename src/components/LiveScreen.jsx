import { useState } from "react";
import { TEAMS, SCHEDULE, PAR, getTeeTimes } from "../constants/league";
import { matchKey, computeTeamTotal, computePlayerTotal } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD2, FD, FB } from "../constants/theme";
import { fmtDate } from "../lib/format";

const ROUND = { 18: "Knockdown Round", 19: "Quarterfinals", 20: "Semifinals", 21: "Finals" };

const unflat = (s) => Array.isArray(s) ? s : (s ? [s.p0 || [], s.p1 || []] : [[], []]);

// Highest hole (1-9) a team has a score on, across both players
function teamThru(rec, tIdx) {
  if (!rec) return 0;
  const scores = unflat(tIdx === 0 ? rec.t1scores : rec.t2scores);
  let m = 0;
  for (const ps of scores) {
    if (!Array.isArray(ps)) continue;
    for (let h = 8; h >= 0; h--) { if ((ps[h] || 0) > 0) { m = Math.max(m, h + 1); break; } }
  }
  return m;
}

const grossOf = (ps) => (Array.isArray(ps) ? ps.reduce((s, v) => s + (v || 0), 0) : 0);

// ── Expandable match card ────────────────────────────────────────
function LiveMatch({ league, week, ta, tb, seedOf, teeTime, label }) {
  const [open, setOpen] = useState(false);
  const [tlow, thigh] = ta < tb ? [ta, tb] : [tb, ta];
  const rec = league.results?.[week]?.[matchKey(week, tlow, thigh)] || null;

  const teams = [
    { tid: tlow, tIdx: 0 },
    { tid: thigh, tIdx: 1 },
  ].map(({ tid, tIdx }) => ({
    tid, tIdx,
    name: TEAMS[tid]?.name || `Team ${tid}`,
    seed: seedOf(tid),
    stab: rec ? computeTeamTotal(rec, tIdx, tid, league.handicaps) : 0,
    thru: teamThru(rec, tIdx),
  }));

  const matchThru = Math.max(teams[0].thru, teams[1].thru);
  const started = matchThru > 0;
  const final = !!rec?.locked || (teams[0].thru >= 9 && teams[1].thru >= 9);
  const lead = !started ? 0 : teams[0].stab === teams[1].stab ? 0 : teams[0].stab > teams[1].stab ? tlow : thigh;

  const statusPill = final
    ? { text: "FINAL", color: G, bg: G + "18" }
    : started
      ? { text: `THRU ${matchThru}`, color: GOLD, bg: GOLD + "18" }
      : { text: teeTime || "UPCOMING", color: M, bg: "rgba(26,61,36,0.05)" };

  return (
    <div style={{ background: CARD2, border: `1px solid ${started ? G + "44" : GOLD + "22"}`, borderRadius: "12px", overflow: "hidden" }}>
      <div
        onClick={() => started && setOpen(o => !o)}
        style={{ cursor: started ? "pointer" : "default" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 12px", borderBottom: `1px solid ${GOLD}14`, background: "rgba(26,61,36,0.04)" }}>
          <span style={{ fontSize: "10px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, fontWeight: 700 }}>{label}</span>
          <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em", color: statusPill.color, background: statusPill.bg, padding: "2px 8px", borderRadius: "10px" }}>
            {statusPill.text}
          </span>
        </div>
        {teams.map((t, i) => (
          <div key={t.tid} style={{
            display: "flex", alignItems: "center", gap: "8px", padding: "11px 12px",
            borderBottom: i === 0 ? `1px solid ${GOLD}12` : "none",
            background: lead === t.tid ? G + "0c" : "transparent",
          }}>
            {t.seed > 0 && <span style={{ fontSize: "10px", fontWeight: 700, color: lead === t.tid ? G : M, width: "18px", flexShrink: 0 }}>#{t.seed}</span>}
            <span style={{ flex: 1, fontSize: "15px", fontWeight: lead === t.tid ? 700 : 500, color: lead === t.tid ? CREAM : M, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.name}
            </span>
            {started && <span style={{ fontSize: "11px", color: M + "aa", flexShrink: 0 }}>thru {t.thru || 0}</span>}
            <span style={{ fontSize: "22px", fontWeight: 800, color: lead === t.tid ? G : CREAM, minWidth: "34px", textAlign: "right", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
              {started ? t.stab : "–"}
            </span>
            {lead === t.tid && <span style={{ fontSize: "13px", color: G, flexShrink: 0 }}>▲</span>}
          </div>
        ))}
        {started && (
          <div style={{ textAlign: "center", fontSize: "10px", color: M + "88", padding: "3px 0 5px", letterSpacing: "0.05em" }}>
            {open ? "▲ hide scorecard" : "▼ tap for hole-by-hole"}
          </div>
        )}
      </div>

      {open && started && (
        <div style={{ borderTop: `1px solid ${GOLD}22`, overflowX: "auto", padding: "4px 0 8px" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", minWidth: "420px" }}>
            <thead>
              <tr style={{ color: M, fontSize: "10px" }}>
                <td style={{ padding: "5px 10px", textAlign: "left", position: "sticky", left: 0, background: CARD2 }}>Hole</td>
                {PAR.map((_, h) => <td key={h} style={{ padding: "5px 4px", textAlign: "center", minWidth: "20px" }}>{h + 1}</td>)}
                <td style={{ padding: "5px 6px", textAlign: "center", color: GOLD }}>Gr</td>
                <td style={{ padding: "5px 6px", textAlign: "center", color: G }}>Pts</td>
              </tr>
              <tr style={{ color: M + "88", fontSize: "9px", borderBottom: `1px solid ${GOLD}18` }}>
                <td style={{ padding: "0 10px 5px", textAlign: "left", position: "sticky", left: 0, background: CARD2 }}>Par</td>
                {PAR.map((p, h) => <td key={h} style={{ padding: "0 4px 5px", textAlign: "center" }}>{p}</td>)}
                <td /><td />
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const scores = unflat(t.tIdx === 0 ? rec.t1scores : rec.t2scores);
                const types = (t.tIdx === 0 ? rec.t1types : rec.t2types) || [];
                return [0, 1].map((pi) => {
                  const pname = TEAMS[t.tid]?.[pi === 0 ? "p1" : "p2"] || `P${pi + 1}`;
                  const type = types[pi] || "normal";
                  const ps = scores[pi] || [];
                  const isLead = lead === t.tid;
                  return (
                    <tr key={`${t.tid}-${pi}`} style={{ borderBottom: `1px solid ${GOLD}0e`, background: isLead ? G + "07" : "transparent" }}>
                      <td style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, color: isLead ? CREAM : M, whiteSpace: "nowrap", position: "sticky", left: 0, background: isLead ? "#f2f6f0" : CARD2 }}>
                        {pname}{pi === 0 ? "" : ""}
                      </td>
                      {type !== "normal"
                        ? <td colSpan={9} style={{ padding: "6px 4px", textAlign: "center", color: M, fontStyle: "italic", fontSize: "11px" }}>{type === "sub" ? "Sub (6 pts)" : "Phantom (2 pts)"}</td>
                        : PAR.map((par, h) => {
                            const g = ps[h] || 0;
                            const c = !g ? M + "55" : g < par ? R : g === par ? CREAM : M;
                            return <td key={h} style={{ padding: "6px 4px", textAlign: "center", color: c, fontWeight: g && g < par ? 700 : 500 }}>{g || "·"}</td>;
                          })}
                      <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 700, color: GOLD }}>{type === "normal" ? (grossOf(ps) || "–") : "–"}</td>
                      <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 700, color: G }}>{computePlayerTotal(rec, t.tIdx, pi, t.tid, league.handicaps)}</td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function LiveScreen({ league, schedule = SCHEDULE, qfSeeds = [], playoffSeeds = [] }) {
  const seedOf = (tid) => (qfSeeds.indexOf(tid) + 1) || (playoffSeeds.indexOf(tid) + 1) || 0;

  // Weeks that have a set of pairings (regular weeks + dynamic knockdown/playoffs)
  const weeksWithPairs = Object.keys(schedule)
    .map(Number)
    .filter(w => (schedule[w]?.pairs || []).some(Array.isArray))
    .sort((a, b) => a - b);

  const statusOf = (w) => {
    let anyStarted = false, allFinal = true, count = 0;
    for (const pair of schedule[w].pairs) {
      if (!Array.isArray(pair)) continue;
      count++;
      const [ta, tb] = pair; const [tlow, thigh] = ta < tb ? [ta, tb] : [tb, ta];
      const rec = league.results?.[w]?.[matchKey(w, tlow, thigh)];
      const thru = Math.max(teamThru(rec, 0), teamThru(rec, 1));
      const final = !!rec?.locked || (teamThru(rec, 0) >= 9 && teamThru(rec, 1) >= 9);
      if (thru > 0) anyStarted = true;
      if (!final) allFinal = false;
    }
    return { anyStarted, allFinal: allFinal && count > 0, count };
  };

  const today = new Date().toISOString().slice(0, 10);
  // Pick the active week: an in-progress round wins; else the next upcoming; else the latest played.
  let activeWeek = null;
  const inProgress = weeksWithPairs.filter(w => { const s = statusOf(w); return s.anyStarted && !s.allFinal; });
  if (inProgress.length) {
    activeWeek = Math.max(...inProgress);
  } else {
    const upcoming = weeksWithPairs.filter(w => !statusOf(w).anyStarted && (schedule[w]?.date || "9999") >= today);
    if (upcoming.length) activeWeek = upcoming.sort((a, b) => (schedule[a].date || "").localeCompare(schedule[b].date || ""))[0];
    else {
      const played = weeksWithPairs.filter(w => statusOf(w).anyStarted);
      activeWeek = played.length ? Math.max(...played) : (weeksWithPairs[weeksWithPairs.length - 1] || null);
    }
  }

  const wrap = { maxWidth: "620px", margin: "0 auto", padding: "20px 14px" };
  if (!activeWeek) {
    return <div style={wrap}><div style={{ color: M, textAlign: "center", padding: "40px 0" }}>No matches scheduled.</div></div>;
  }

  const pairs = (schedule[activeWeek].pairs || []).filter(Array.isArray);
  const teeTimes = getTeeTimes(activeWeek) || [];
  const roundName = ROUND[activeWeek] || `Week ${activeWeek}`;
  const dateStr = schedule[activeWeek]?.date ? fmtDate(schedule[activeWeek].date) : "";
  const anyLive = inProgress.includes(activeWeek);
  const labelFor = (i) => activeWeek === 21 ? (i === 0 ? "Championship" : "3rd Place") : `Match ${i + 1}`;

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: "3px" }}>
        {anyLive && <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: R, boxShadow: `0 0 0 0 ${R}`, animation: "livePulse 1.6s infinite", flexShrink: 0 }} />}
        <div style={{ fontFamily: FD, fontSize: "27px", fontWeight: 600, color: CREAM }}>
          {anyLive ? "Live Scoring" : "Scoreboard"}
        </div>
      </div>
      <div style={{ color: M, fontSize: "14px", marginBottom: "16px" }}>
        {roundName}{dateStr ? ` · ${dateStr}` : ""}{anyLive ? " · updating live" : ""}
      </div>

      <style>{`@keyframes livePulse { 0%{box-shadow:0 0 0 0 ${R}88;} 70%{box-shadow:0 0 0 7px ${R}00;} 100%{box-shadow:0 0 0 0 ${R}00;} }`}</style>

      <div style={{ display: "grid", gap: "11px" }}>
        {pairs.map((pair, i) => (
          <LiveMatch
            key={i}
            league={league}
            week={activeWeek}
            ta={pair[0]}
            tb={pair[1]}
            seedOf={seedOf}
            teeTime={teeTimes[i]}
            label={labelFor(i)}
          />
        ))}
      </div>

      <div style={{ marginTop: "14px", fontSize: "11px", color: M + "99", textAlign: "center", lineHeight: 1.5 }}>
        Scores update automatically as players enter them · <span style={{ color: G }}>▲</span> leads · tap a match for the full scorecard
      </div>
    </div>
  );
}
