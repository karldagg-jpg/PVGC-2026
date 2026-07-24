import { useState, useEffect, useMemo } from "react";
import { TEAMS, PAR, SI, SCHEDULE, getTeeTimes } from "../constants/league";
import { stabPts, hcpStr, matchKey } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD2, FD, FB } from "../constants/theme";
import { fmtDate } from "../lib/format";

const AMBER = "#b88400";
const flat = (s) => Array.isArray(s) ? s : (s ? [s.p0 || [], s.p1 || []] : [[], []]);

// Per-player summary from a match record (confirmed record OR live match).
function playerLine(rec, tIdx, pi, tid) {
  const type = (tIdx === 0 ? rec.t1types : rec.t2types)?.[pi] || "normal";
  const holes = flat(tIdx === 0 ? rec.t1scores : rec.t2scores)[pi] || [];
  const gross = holes.reduce((s, v) => s + (v || 0), 0);
  const thru = holes.filter(v => v > 0).length;
  const hcp = (rec.hcpSnapshot?.[tid] || [0, 0])[pi] || 0;
  let stab = 0;
  for (let hi = 0; hi < 9; hi++) {
    const g = holes[hi] || 0;
    if (g > 0) stab += stabPts(g, PAR[hi], hcpStr(hcp, SI[hi])) || 0;
  }
  return { type, gross, thru, stab };
}

const sameLine = (a, b) => a.type === b.type && a.gross === b.gross;

export default function ConfirmedScoresScreen({ league, listConfirmedScores, restoreConfirmedRecord }) {
  const [records, setRecords] = useState(null); // null = loading
  const [filter, setFilter] = useState("attention");
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => { listConfirmedScores().then(setRecords); }, []);

  // Group records by match; build confirmed-vs-live comparison for each.
  const matches = useMemo(() => {
    if (!records) return [];
    const groups = {};
    for (const r of records) {
      const k = `${r.week}::${r.matchKey}`;
      (groups[k] ||= []).push(r);
    }
    const out = Object.values(groups).map(recs => {
      recs.sort((a, b) => (a.confirmedAt || "").localeCompare(b.confirmedAt || ""));
      const latest = recs[recs.length - 1];
      const byTeam = {};
      for (const r of recs) byTeam[r.tid] = r; // latest per team (sorted asc)
      const { week, matchKey: mk, tlow, thigh } = latest;
      const live = league.results?.[week]?.[mk] || null;

      const players = [];
      let changed = false;
      [[0, tlow], [1, thigh]].forEach(([tIdx, tid]) => {
        for (let pi = 0; pi < 2; pi++) {
          const conf = playerLine(latest, tIdx, pi, tid);
          const liveL = live ? playerLine(live, tIdx, pi, tid) : null;
          const diff = liveL ? !sameLine(conf, liveL) : true;
          if (diff) changed = true;
          players.push({
            tid, tIdx, pi,
            name: TEAMS[tid]?.[pi === 0 ? "p1" : "p2"] || `P${pi + 1}`,
            conf, live: liveL, diff,
          });
        }
      });

      const bothConfirmed = !!(byTeam[tlow] && byTeam[thigh]);
      const status = changed ? "flagged" : bothConfirmed ? "verified" : "awaiting";
      const missing = bothConfirmed ? null : (byTeam[tlow] ? thigh : tlow);
      const teeIdx = (SCHEDULE[week]?.pairs || []).findIndex(([a, b]) => matchKey(week, Math.min(a, b), Math.max(a, b)) === mk);
      return { key: `${week}::${mk}`, week, mk, tlow, thigh, byTeam, latest, players, status, missing,
        tee: teeIdx >= 0 ? getTeeTimes(week)[teeIdx] : "" };
    });
    // Newest week first, flagged first within a week
    return out.sort((a, b) => (b.week - a.week) || (a.status === "flagged" ? -1 : 1));
  }, [records, league.results]);

  const counts = useMemo(() => ({
    flagged: matches.filter(m => m.status === "flagged").length,
    verified: matches.filter(m => m.status === "verified").length,
    awaiting: matches.filter(m => m.status === "awaiting").length,
  }), [matches]);

  const shown = matches.filter(m =>
    filter === "all" ? true :
    filter === "attention" ? m.status === "flagged" :
    filter === "awaiting" ? m.status === "awaiting" :
    m.status === "verified"
  );

  async function doRestore(m) {
    if (!window.confirm(`Restore the confirmed scores for ${TEAMS[m.tlow]?.name} vs ${TEAMS[m.thigh]?.name}? This overwrites the current live scores for that match.`)) return;
    setBusy(m.key);
    const ok = await restoreConfirmedRecord(m.latest);
    setBusy(null);
    setToast(ok ? "✓ Restored from confirmed record" : "Restore failed — try again");
    setTimeout(() => setToast(""), 3000);
  }

  const weeks = [...new Set(shown.map(m => m.week))];

  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "30px", fontWeight: 600, color: CREAM, marginBottom: "3px" }}>Verify · Confirmed Scores</div>
      <div style={{ fontSize: "14px", color: M, marginBottom: "18px", maxWidth: "60ch", lineHeight: 1.5 }}>
        A permanent, un-editable copy is saved the moment each team confirms their foursome. If the live scores change afterward, it shows up here — restore the confirmed version in one tap.
      </div>

      {records === null ? (
        <div style={{ color: M, padding: "40px 0", textAlign: "center" }}>Loading confirmed records…</div>
      ) : matches.length === 0 ? (
        <div style={{ color: M, padding: "40px 0", textAlign: "center", fontSize: "14px" }}>
          No confirmed scores yet. Once a team confirms a match, its permanent record appears here.
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
            <Stat n={counts.verified} label={"Verified\nlive matches confirmed"} color={G} />
            <Stat n={counts.flagged} label={"Needs attention\nchanged since confirmed"} color={R} />
            <Stat n={counts.awaiting} label={"Awaiting\none team still to confirm"} color={AMBER} />
          </div>

          <div style={{ display: "flex", gap: "6px", marginBottom: "18px", flexWrap: "wrap" }}>
            <Chip on={filter === "attention"} warn onClick={() => setFilter("attention")}>Needs attention ({counts.flagged})</Chip>
            <Chip on={filter === "awaiting"} onClick={() => setFilter("awaiting")}>Awaiting ({counts.awaiting})</Chip>
            <Chip on={filter === "verified"} onClick={() => setFilter("verified")}>Verified ({counts.verified})</Chip>
            <Chip on={filter === "all"} onClick={() => setFilter("all")}>All ({matches.length})</Chip>
          </div>

          {shown.length === 0 && <div style={{ color: M, padding: "24px 0", fontSize: "14px" }}>Nothing in this filter.</div>}

          {weeks.map(w => (
            <div key={w}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", margin: "20px 2px 10px" }}>
                <div style={{ fontFamily: FD, fontSize: "19px", color: G, fontWeight: 700 }}>Week {w}</div>
                <div style={{ fontSize: "12px", color: M }}>{fmtDate(SCHEDULE[w]?.date)}</div>
                <div style={{ flex: 1, height: "1px", background: "rgba(26,61,36,0.10)" }} />
              </div>
              {shown.filter(m => m.week === w).map(m => (
                <MatchCard key={m.key} m={m} busy={busy === m.key} onRestore={() => doRestore(m)} />
              ))}
            </div>
          ))}
        </>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", background: CREAM, color: "#f0ece0", padding: "10px 20px", borderRadius: "10px", fontSize: "14px", fontWeight: 600, boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 1000 }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function Stat({ n, label, color }) {
  const [l1, l2] = label.split("\n");
  return (
    <div style={{ flex: 1, minWidth: "150px", background: CARD2, border: "1px solid rgba(26,61,36,0.10)", borderRadius: "12px", padding: "12px 15px", display: "flex", alignItems: "center", gap: "11px" }}>
      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: FD, fontSize: "30px", fontWeight: 700, lineHeight: 1, color }}>{n}</span>
      <span style={{ fontSize: "12px", color: M, lineHeight: 1.3 }}>{l1}<br />{l2}</span>
    </div>
  );
}

function Chip({ on, warn, onClick, children }) {
  const bg = on ? (warn ? R : G) : "transparent";
  return (
    <button onClick={onClick} style={{
      padding: "6px 13px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
      border: `1px solid ${on ? bg : "rgba(26,61,36,0.10)"}`, background: bg, color: on ? "#eef3ea" : M, fontFamily: FB,
    }}>{children}</button>
  );
}

const PILL = {
  flagged: { c: R, bg: "rgba(185,28,28,.09)", bd: "rgba(185,28,28,.30)", t: "⚠ Changed since confirmed" },
  verified: { c: G, bg: "rgba(26,107,58,.10)", bd: "rgba(26,107,58,.30)", t: "✓ Verified" },
  awaiting: { c: AMBER, bg: "rgba(184,132,0,.10)", bd: "rgba(184,132,0,.30)", t: "◷ Awaiting" },
};

function MatchCard({ m, busy, onRestore }) {
  const p = PILL[m.status];
  const line = "1px solid rgba(26,61,36,0.10)";
  return (
    <div style={{ background: CARD2, border: m.status === "flagged" ? "1px solid rgba(185,28,28,.4)" : line, borderRadius: "14px", overflow: "hidden", marginBottom: "11px", boxShadow: m.status === "flagged" ? "0 0 0 1px rgba(185,28,28,.10)" : "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 15px", borderBottom: line, flexWrap: "wrap" }}>
        {m.tee && <span style={{ fontSize: "12px", fontWeight: 700, color: GOLD, minWidth: "58px" }}>{m.tee}</span>}
        <span style={{ flex: 1, minWidth: "180px", fontSize: "15px", fontWeight: 600, color: CREAM }}>
          {TEAMS[m.tlow]?.name} <span style={{ color: M, fontWeight: 400, fontSize: "12px", margin: "0 6px" }}>vs</span> {TEAMS[m.thigh]?.name}
        </span>
        <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", color: p.c, background: p.bg, border: `1px solid ${p.bd}`, whiteSpace: "nowrap" }}>
          {m.status === "awaiting" ? `◷ Awaiting Team ${m.missing}` : p.t}
        </span>
      </div>

      <div style={{ display: "flex", gap: "8px", padding: "9px 15px", flexWrap: "wrap", background: "rgba(26,61,36,0.025)", borderBottom: line }}>
        {[m.tlow, m.thigh].map(tid => {
          const rec = m.byTeam[tid];
          const t = new Date(rec?.confirmedAt || 0);
          const time = rec ? t.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : "";
          return (
            <span key={tid} style={{ display: "flex", alignItems: "center", gap: "7px", fontSize: "12px", color: rec ? M : "#9a9683", background: "#fff", border: line, borderRadius: "8px", padding: "5px 10px" }}>
              <span style={{ color: rec ? G : "#c9c4b4", fontWeight: 800 }}>{rec ? "✓" : "○"}</span>
              {rec ? <>Team {tid} confirmed by <b style={{ color: CREAM }}>{rec.confirmedBy}</b> · {time}</> : <>Team {tid} — not yet confirmed</>}
            </span>
          );
        })}
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", color: M, fontWeight: 600, padding: "8px 15px 5px" }}>Player</th>
              <th style={{ textAlign: "right", fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", color: M, fontWeight: 600, padding: "8px 15px 5px" }}>Gross</th>
              <th style={{ textAlign: "right", fontSize: "10px", letterSpacing: ".08em", textTransform: "uppercase", color: M, fontWeight: 600, padding: "8px 15px 5px" }}>Stab</th>
            </tr>
          </thead>
          <tbody>
            {[m.tlow, m.thigh].map(tid => (
              <ScoreRows key={tid} tid={tid} players={m.players.filter(pl => pl.tid === tid)} />
            ))}
          </tbody>
        </table>
      </div>

      {m.status === "flagged" && (
        <div style={{ padding: "12px 15px", background: "rgba(185,28,28,.06)", borderTop: "1px solid rgba(185,28,28,.25)", display: "flex", gap: "12px", alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: "220px" }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: R, marginBottom: "3px" }}>Live scores no longer match the confirmed record</div>
            {m.players.filter(pl => pl.diff && pl.live).map(pl => (
              <div key={`${pl.tid}-${pl.pi}`} style={{ fontSize: "13px", color: CREAM, lineHeight: 1.5 }}>
                <b>{pl.name}</b>: confirmed <b>{fmtVal(pl.conf)}</b> → now <b style={{ color: R }}>{fmtVal(pl.live)}</b>
              </div>
            ))}
          </div>
          <button onClick={onRestore} disabled={busy} style={{ fontFamily: FB, fontSize: "13px", fontWeight: 700, padding: "9px 16px", borderRadius: "9px", border: "none", background: busy ? M : G, color: "#eef3ea", cursor: busy ? "default" : "pointer" }}>
            {busy ? "Restoring…" : "Restore confirmed scores"}
          </button>
        </div>
      )}
    </div>
  );
}

function ScoreRows({ tid, players }) {
  return (
    <>
      <tr><td colSpan={3} style={{ fontSize: "10px", letterSpacing: ".06em", textTransform: "uppercase", color: GOLD, fontWeight: 700, padding: "9px 15px 3px" }}>Team {tid} — {TEAMS[tid]?.name}</td></tr>
      {players.map(pl => (
        <tr key={`${pl.tid}-${pl.pi}`} style={{ background: pl.diff && pl.live ? "rgba(185,28,28,.05)" : "transparent" }}>
          <td style={{ textAlign: "left", padding: "6px 15px", fontSize: "14px", fontWeight: 600, color: pl.diff && pl.live ? R : CREAM, borderTop: "1px solid rgba(26,61,36,0.10)" }}>{pl.name}</td>
          <td style={{ textAlign: "right", padding: "6px 15px", fontSize: "14px", color: CREAM, borderTop: "1px solid rgba(26,61,36,0.10)" }}>{fmtGross(pl.conf)}</td>
          <td style={{ textAlign: "right", padding: "6px 15px", fontSize: "14px", fontWeight: 700, color: G, borderTop: "1px solid rgba(26,61,36,0.10)" }}>{fmtStab(pl.conf)}</td>
        </tr>
      ))}
    </>
  );
}

const fmtGross = (l) => l.type === "sub" ? "SUB" : l.type === "phantom" ? "PHANTOM" : (l.gross || "—");
const fmtStab = (l) => l.type === "sub" ? 6 : l.type === "phantom" ? 2 : (l.gross ? l.stab : "—");
const fmtVal = (l) => l.type === "sub" ? "SUB (6 pts)" : l.type === "phantom" ? "PHANTOM (2 pts)" : `${l.gross} gross, ${l.stab} pts`;
