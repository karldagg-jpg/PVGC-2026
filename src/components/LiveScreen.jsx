import { useState, useRef, useEffect, useMemo } from "react";
import { TEAMS, SCHEDULE, PAR, SI, getTeeTimes } from "../constants/league";
import { matchKey, computeTeamTotal, computePlayerTotal, stabPts, hcpStr } from "../lib/leagueLogic";
import { fmtDate } from "../lib/format";

const ROUND = { 18: "Knockdown Round", 19: "Quarterfinals", 20: "Semifinals", 21: "Finals" };

const unflat = (s) => Array.isArray(s) ? s : (s ? [s.p0 || [], s.p1 || []] : [[], []]);

function teamThru(rec, tIdx) {
  if (!rec) return 0;
  const s = unflat(tIdx === 0 ? rec.t1scores : rec.t2scores);
  let m = 0;
  for (const ps of s) { if (!Array.isArray(ps)) continue; for (let h = 8; h >= 0; h--) { if ((ps[h] || 0) > 0) { m = Math.max(m, h + 1); break; } } }
  return m;
}
// per-hole team Stableford (from real grosses; subs/phantoms omitted from the heat)
function teamHolePts(rec, tIdx, tid, hi, H) {
  const s = unflat(tIdx === 0 ? rec.t1scores : rec.t2scores);
  const types = (tIdx === 0 ? rec.t1types : rec.t2types) || [];
  const snap = rec.hcpSnapshot;
  let pts = 0;
  for (let pi = 0; pi < 2; pi++) {
    if ((types[pi] || "normal") !== "normal") continue;
    const g = (s[pi] || [])[hi] || 0; if (!g) continue;
    const hcp = snap ? (snap[tid] || [0, 0])[pi] || 0 : (H[tid] || [0, 0])[pi] || 0;
    pts += stabPts(g, PAR[hi], hcpStr(hcp, SI[hi])) || 0;
  }
  return pts;
}
const cumTeam = (rec, tIdx, tid, upto, H) => { let s = 0; for (let h = 0; h < upto; h++) s += teamHolePts(rec, tIdx, tid, h, H); return s; };
const grossOf = (ps) => (Array.isArray(ps) ? ps.reduce((s, v) => s + (v || 0), 0) : 0);

export default function LiveScreen({ league, schedule = SCHEDULE, qfSeeds = [], playoffSeeds = [], onExit }) {
  const H = league.handicaps || {};
  const results = league.results || {};
  const seedOf = (tid) => (qfSeeds.indexOf(tid) + 1) || (playoffSeeds.indexOf(tid) + 1) || 0;

  const [dark, setDark] = useState(() => { try { return localStorage.getItem("pvgcLiveTheme") === "dark"; } catch (e) { return false; } });
  const toggleTheme = () => setDark(d => { const nd = !d; try { localStorage.setItem("pvgcLiveTheme", nd ? "dark" : "light"); } catch (e) {} return nd; });
  const [tv, setTv] = useState(false);
  const [open, setOpen] = useState({});
  const [selWeek, setSelWeek] = useState(null);

  const weeksWithPairs = useMemo(() =>
    Object.keys(schedule).map(Number).filter(w => (schedule[w]?.pairs || []).some(Array.isArray)).sort((a, b) => a - b),
    [schedule]);

  const statusOf = (w) => {
    let anyStarted = false, allFinal = true, count = 0;
    for (const pair of (schedule[w]?.pairs || [])) {
      if (!Array.isArray(pair)) continue; count++;
      const [ta, tb] = pair; const [tlow, thigh] = ta < tb ? [ta, tb] : [tb, ta];
      const rec = results[w]?.[matchKey(w, tlow, thigh)];
      const thru = Math.max(teamThru(rec, 0), teamThru(rec, 1));
      const final = !!rec?.locked || (teamThru(rec, 0) >= 9 && teamThru(rec, 1) >= 9);
      if (thru > 0) anyStarted = true;
      if (!final) allFinal = false;
    }
    return { anyStarted, allFinal: allFinal && count > 0 };
  };

  const today = new Date().toISOString().slice(0, 10);
  const autoWeek = useMemo(() => {
    if (!weeksWithPairs.length) return null;
    const up = weeksWithPairs.filter(w => (schedule[w]?.date || "9999") >= today)
      .sort((a, b) => (schedule[a].date || "").localeCompare(schedule[b].date || ""));
    return up.length ? up[0] : weeksWithPairs[weeksWithPairs.length - 1];
  }, [weeksWithPairs, schedule]);

  const activeWeek = (selWeek && weeksWithPairs.includes(selWeek)) ? selWeek : autoWeek;
  const onAuto = activeWeek === autoWeek;
  const goto = (w) => setSelWeek(w === autoWeek ? null : w);
  const weekName = (w) => ROUND[w] || `Week ${w}`;

  // ── derive match data for the active week ──
  const pairs = activeWeek ? (schedule[activeWeek].pairs || []).filter(Array.isArray) : [];
  const teeTimes = activeWeek ? (getTeeTimes(activeWeek) || []) : [];
  const matches = pairs.map((p, i) => {
    const ta = p[0], tb = p[1]; const [tlow, thigh] = ta < tb ? [ta, tb] : [tb, ta];
    const key = matchKey(activeWeek, tlow, thigh);
    const rec = results[activeWeek]?.[key] || null;
    const A = rec ? computeTeamTotal(rec, 0, tlow, H) : 0;
    const B = rec ? computeTeamTotal(rec, 1, thigh, H) : 0;
    const thruA = teamThru(rec, 0), thruB = teamThru(rec, 1);
    const thru = Math.max(thruA, thruB), left = 9 - thru;
    const started = thru > 0;
    const final = !!rec?.locked || (thruA >= 9 && thruB >= 9 && started);
    const leadTid = !started ? 0 : A === B ? 0 : A > B ? tlow : thigh;
    let badge;
    if (final) badge = { cls: "final", txt: A === B ? "TIE" : "FINAL" };
    else if (started && Math.abs(A - B) > left * 4) badge = { cls: "clinch", txt: "CLINCHED" };
    else if (started && Math.abs(A - B) <= 2 && left <= 4) badge = { cls: "tight", txt: "TIGHT" };
    else badge = { cls: "live", txt: started ? "IN PLAY" : (teeTimes[i] || "UPCOMING") };
    let mA = 0, mB = 0; for (let h = Math.max(0, thru - 2); h < thru; h++) { mA += teamHolePts(rec, 0, tlow, h, H); mB += teamHolePts(rec, 1, thigh, h, H); }
    const mt = Math.max(1, mA + mB), wA = Math.round(mA / mt * 100);
    const teams = [{ tid: tlow, tIdx: 0, tot: A }, { tid: thigh, tIdx: 1, tot: B }].map(t => ({
      ...t, name: TEAMS[t.tid]?.name || `Team ${t.tid}`, seed: seedOf(t.tid),
      thru: teamThru(rec, t.tIdx), lead: leadTid === t.tid,
      pips: Array.from({ length: 9 }, (_, h) => h < thru ? Math.max(0, Math.min(4, teamHolePts(rec, t.tIdx, t.tid, h, H))) : -1),
    }));
    return { key, i, rec, ta, tb, tlow, thigh, A, B, thru, left, started, final, leadTid, badge, wA, teams };
  });

  // ── moments feed ──
  const moments = useMemo(() => {
    if (!activeWeek) return [];
    const out = []; const lead = {};
    for (let h = 0; h < 9; h++) {
      for (const [ta, tb] of pairs) {
        const [tlow, thigh] = ta < tb ? [ta, tb] : [tb, ta];
        const rec = results[activeWeek]?.[matchKey(activeWeek, tlow, thigh)]; if (!rec) continue;
        const thru = Math.max(teamThru(rec, 0), teamThru(rec, 1)); if (h >= thru) continue;
        [[tlow, 0], [thigh, 1]].forEach(([tid, ti]) => {
          const s = unflat(ti === 0 ? rec.t1scores : rec.t2scores);
          const types = (ti === 0 ? rec.t1types : rec.t2types) || [];
          [0, 1].forEach(pi => {
            if ((types[pi] || "normal") !== "normal") return;
            const g = (s[pi] || [])[h] || 0; if (!g) return;
            const d = g - PAR[h]; const nm = TEAMS[tid]?.[pi === 0 ? "p1" : "p2"] || "";
            if (d <= -2) out.push({ c: "clinch", t: `🦅 ${nm} eagle #${h + 1}` });
            else if (d === -1) out.push({ c: "", t: `🐦 ${nm} birdie #${h + 1}` });
          });
        });
        const A = cumTeam(rec, 0, tlow, h + 1, H), B = cumTeam(rec, 1, thigh, h + 1, H);
        const ls = A > B ? tlow : B > A ? thigh : 0;
        const key = matchKey(activeWeek, tlow, thigh);
        if (h > 0 && lead[key] !== undefined && lead[key] !== ls && ls !== 0)
          out.push({ c: "lead", t: `▲ ${TEAMS[ls]?.name} take the lead over ${TEAMS[ls === tlow ? thigh : tlow]?.name}` });
        const left = 9 - (h + 1);
        if (ls !== 0 && Math.abs(A - B) > left * 4 && left > 0 && !lead["cl" + key]) { out.push({ c: "clinch", t: `🔒 ${TEAMS[ls]?.name} clinch their match` }); lead["cl" + key] = 1; }
        lead[key] = ls;
      }
    }
    return out.slice(-16).reverse();
  }, [activeWeek, results, schedule]);

  // ── day leaderboard ──
  const strip = useMemo(() => {
    let low = { g: 99, n: "" }, bird = { c: -1, n: "" }, close = { d: 99, m: null };
    for (const m of matches) {
      for (const t of [{ tid: m.tlow, ti: 0 }, { tid: m.thigh, ti: 1 }]) {
        const s = unflat(t.ti === 0 ? m.rec?.t1scores : m.rec?.t2scores);
        const types = (t.ti === 0 ? m.rec?.t1types : m.rec?.t2types) || [];
        for (let pi = 0; pi < 2; pi++) {
          if ((types[pi] || "normal") !== "normal") continue;
          const arr = s[pi] || []; const played = arr.some(v => v > 0); if (!played) continue;
          const g = grossOf(arr); if (g > 0 && g < low.g) low = { g, n: TEAMS[t.tid]?.[pi === 0 ? "p1" : "p2"] };
          let b = 0; for (let h = 0; h < 9; h++) { const v = arr[h] || 0; if (v && v - PAR[h] <= -1) b++; }
          if (b > bird.c) bird = { c: b, n: TEAMS[t.tid]?.[pi === 0 ? "p1" : "p2"] };
        }
      }
      if (m.started && !m.final) { const d = Math.abs(m.A - m.B); if (d < close.d) close = { d, m }; }
    }
    return { low, bird, close, closeName: close.m ? `${close.m.teams[0].name.split("-")[0]} v ${close.m.teams[1].name.split("-")[0]}` : "—" };
  }, [matches]);

  // status / live flag
  const status = activeWeek ? statusOf(activeWeek) : { anyStarted: false, allFinal: false };
  const autoIsCurrent = activeWeek && (schedule[activeWeek]?.date || "9999") >= today;
  const showLive = onAuto && autoIsCurrent && status.anyStarted && !status.allFinal;
  const dateStr = activeWeek && schedule[activeWeek]?.date ? fmtDate(schedule[activeWeek].date) : "";

  // ── ticker constant-speed ──
  const trackRef = useRef(null);
  const momKey = moments.map(m => m.t).join("|");
  useEffect(() => {
    const el = trackRef.current; if (!el) return;
    const single = el.scrollWidth / 2, speed = 62;
    el.style.animationDuration = Math.max(14, single / speed).toFixed(1) + "s";
  }, [momKey, dark]);

  // score-change bump
  const prev = useRef({});
  useEffect(() => { const t = {}; matches.forEach(m => { t[m.key + "a"] = m.A; t[m.key + "b"] = m.B; }); prev.current = t; });
  const bumped = (k, v) => prev.current[k] !== undefined && prev.current[k] !== v;

  const idx = weeksWithPairs.indexOf(activeWeek);
  const labelFor = (m) => activeWeek === 21 ? (m.i === 0 ? "Championship" : "3rd Place") : `#${m.teams[0].seed} seed vs #${m.teams[1].seed} seed`;

  return (
    <div className={"pvgc-live" + (dark ? " dark" : "") + (tv ? " tv" : "")}>
      <style>{CSS}</style>

      <div className="mast">
        <div className="mast-in">
          {onExit && <button className="backbtn" onClick={onExit}>‹ Menu</button>}
          <div className="live"><span className={"dot" + (showLive ? "" : " off")}></span><b>{showLive ? "LIVE" : "BOARD"}</b></div>
          <div className="mtitle">
            <h1>PVGC <span>{activeWeek >= 19 ? "PLAYOFFS" : ""}</span> · {weekName(activeWeek).toUpperCase()}</h1>
            <div className="sub">Pickering Valley GC{dateStr ? ` · ${dateStr}` : ""}{showLive ? " · updating live" : ""}</div>
          </div>
          <button className="tvbtn" onClick={toggleTheme}>{dark ? "Light" : "Dark"}</button>
          <button className="tvbtn" onClick={() => setTv(v => !v)}>TV</button>
        </div>
      </div>

      {moments.length > 0 && (
        <div className="ticker">
          <div className="tag">MOMENTS</div>
          <div className="track-wrap"><div className="track" ref={trackRef}>
            {[0, 1].map(dup => (moments.length ? moments : [{ c: "", t: "⛳ Groups on the tee" }]).map((x, j) => (
              <span key={dup + "-" + j} className={"m " + x.c} dangerouslySetInnerHTML={{ __html: x.t }} />
            )))}
          </div></div>
        </div>
      )}

      <div className="wrap">
        {/* week selector */}
        <div className="selrow">
          <button className="nav" disabled={idx <= 0} onClick={() => idx > 0 && goto(weeksWithPairs[idx - 1])}>‹</button>
          <select className="wsel" value={activeWeek || ""} onChange={e => goto(parseInt(e.target.value))}>
            {weeksWithPairs.map(w => <option key={w} value={w}>{weekName(w)}{w === autoWeek ? " (current)" : ""}</option>)}
          </select>
          <button className="nav" disabled={idx >= weeksWithPairs.length - 1} onClick={() => idx < weeksWithPairs.length - 1 && goto(weeksWithPairs[idx + 1])}>›</button>
          {!onAuto && <button className="now" onClick={() => setSelWeek(null)}>● Now</button>}
        </div>

        {/* leaderboard strip */}
        {status.anyStarted && (
          <div className="strip">
            <div className="chip"><div className="k">Low round · live</div><div className="v">{strip.low.n || "—"} <small>{strip.low.g < 99 ? strip.low.g : ""}</small></div></div>
            <div className="chip"><div className="k">Most birdies</div><div className="v">{strip.bird.n || "—"} <small>{strip.bird.c > 0 ? strip.bird.c : 0}</small></div></div>
            <div className="chip hot"><div className="k">Closest match</div><div className="v" style={{ fontSize: "13px" }}>{strip.closeName} <small>{strip.close.d < 99 ? "+" + strip.close.d : ""}</small></div></div>
          </div>
        )}

        {matches.length === 0 ? (
          <div className="empty">Matchups set once the previous round is complete.</div>
        ) : (
          <div className="cards">
            {matches.map(m => (
              <div key={m.key} className={"card" + (m.badge.cls === "tight" ? " tight" : "") + (open[m.key] ? " open" : "")}>
                <div className="chead"><span className="lbl">{labelFor(m)}</span><span className={"badge " + m.badge.cls}>{m.badge.txt}</span></div>
                {m.teams.map((t, ti) => (
                  <div key={t.tid} className={"row" + (t.lead ? " lead" : "")}>
                    {t.seed > 0 && <span className="seed">{t.seed}</span>}
                    <div className="team"><div className="nm">{t.name}</div>
                      <div className="spark">{t.pips.map((p, h) => <span key={h} className={"pip" + (p >= 0 ? " p" + p : "") + (m.started && h === m.thru - 1 && p >= 0 ? " just" : "")} />)}</div>
                    </div>
                    <div className="thru"><div className="t">{m.started ? "thru " + t.thru : ""}</div></div>
                    <div className={"score" + (bumped(m.key + (ti === 0 ? "a" : "b"), t.tot) ? " bumped" : "")}>{m.started ? t.tot : "–"}</div>
                    <span className="arw">{t.lead ? "▲" : ""}</span>
                  </div>
                ))}
                <div className="cfoot">
                  <div className="mom"><div className="a" style={{ width: m.wA + "%" }} /><div className="b" style={{ width: (100 - m.wA) + "%" }} /></div>
                  <div className="margin" dangerouslySetInnerHTML={{ __html: marginText(m) }} />
                </div>
                {m.started && (
                  <div className="expander" onClick={() => setOpen(o => ({ ...o, [m.key]: !o[m.key] }))}>
                    {open[m.key] ? "▲ hide card" : "▼ hole-by-hole"}
                  </div>
                )}
                {open[m.key] && m.started && <div className="sheet"><Sheet m={m} H={H} /></div>}
              </div>
            ))}
          </div>
        )}

        <div className="foot"><span className="g">▲</span> leads · tap a match for the hole-by-hole card · scores update automatically as they're entered</div>
      </div>
    </div>
  );
}

function marginText(m) {
  if (!m.started) return "Awaiting tee-off";
  if (m.final) return m.A === m.B ? "All square" : `<b>${(m.A > m.B ? m.teams[0] : m.teams[1]).name.split("-")[0]}</b> win by ${Math.abs(m.A - m.B)}`;
  if (m.A === m.B) return "<b>Even</b>";
  const lead = m.A > m.B ? m.teams[0] : m.teams[1];
  return `<b>${lead.name.split("-")[0]}</b> +${Math.abs(m.A - m.B)} · ${m.left} to play`;
}

function Sheet({ m, H }) {
  const rows = [];
  [[m.tlow, 0], [m.thigh, 1]].forEach(([tid, ti]) => {
    const s = unflat(ti === 0 ? m.rec.t1scores : m.rec.t2scores);
    const types = (ti === 0 ? m.rec.t1types : m.rec.t2types) || [];
    for (let pi = 0; pi < 2; pi++) {
      rows.push({ tid, ti, pi, name: TEAMS[tid]?.[pi === 0 ? "p1" : "p2"] || `P${pi + 1}`, type: types[pi] || "normal", gr: s[pi] || [] });
    }
  });
  return (
    <table>
      <thead>
        <tr className="par"><th className="pl">Hole</th>{PAR.map((_, h) => <th key={h}>{h + 1}</th>)}<th>Gr</th><th>Pts</th></tr>
        <tr className="par"><td className="pl">Par</td>{PAR.map((p, h) => <td key={h}>{p}</td>)}<td></td><td></td></tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri}>
            <td className="pl">{r.name}</td>
            {r.type !== "normal"
              ? <td colSpan={9} className="sub">{r.type === "sub" ? "Sub (6 pts)" : "Phantom (2 pts)"}</td>
              : PAR.map((par, h) => {
                  const g = r.gr[h] || 0; if (!g || h >= m.thru) return <td key={h} className="g fut">·</td>;
                  const d = g - par; const cl = d <= -2 ? "eag" : d === -1 ? "bird" : d === 0 ? "" : d === 1 ? "bog" : "dbl";
                  return <td key={h} className={"g " + cl}>{g}</td>;
                })}
            <td className="g tot">{r.type === "normal" ? (grossOf(r.gr.slice(0, m.thru)) || "–") : "–"}</td>
            <td className="g tot">{computePlayerTotal(m.rec, r.ti, r.pi, r.tid, H)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const CSS = `
.pvgc-live{
  --bg:#f4f1e8;--bg2:#fff;--bg3:#f0f4ec;--ink:#17281e;--muted:#66786c;--line:rgba(26,61,36,.14);
  --gold:#a97d20;--green:#1c854a;--green-dim:#7bb492;--red:#cf372c;--amber:#c67d14;--sky:#3a6f8f;
  --shadow:0 8px 22px rgba(40,55,35,.10);
  --pip0:#e39a91;--pip1:#dcc790;--pip2:#9ec7ad;--pip3:#4fae77;--pip4:#1c854a;--pipe:rgba(26,61,36,.07);
  --mast:linear-gradient(120deg,rgba(255,253,247,.96),rgba(250,245,232,.95) 65%,rgba(245,228,196,.95));
  --tickbg:rgba(26,61,36,.035);--plbg:#fff;--futc:rgba(0,0,0,.2);
  --num:'SF Pro Display',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  color:var(--ink);font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;min-height:100vh;
  background:radial-gradient(120% 90% at 85% -10%,rgba(214,140,30,.12),transparent 55%),linear-gradient(180deg,#f6f3ea,#eef1e8 60%,#e8ece2);
  -webkit-font-smoothing:antialiased;padding-bottom:56px;
}
.pvgc-live.dark{
  --bg:#07110d;--bg2:#0d1a14;--bg3:#12241a;--ink:#f1eee2;--muted:#7f978a;--line:rgba(227,186,78,.14);
  --gold:#e3ba4e;--green:#45d17f;--green-dim:#2f8f57;--red:#ff5b52;--amber:#f4a52a;--shadow:0 10px 30px rgba(0,0,0,.45);
  --pip0:#7a2622;--pip1:#5c4a2a;--pip2:#3a5a45;--pip3:#2f8f57;--pip4:#45d17f;--pipe:rgba(255,255,255,.06);
  --mast:linear-gradient(120deg,rgba(9,20,15,.94),rgba(24,20,10,.92) 70%,rgba(52,36,14,.9));
  --tickbg:rgba(0,0,0,.25);--plbg:#0b1611;--futc:rgba(255,255,255,.18);
  background:radial-gradient(120% 90% at 85% -10%,rgba(244,165,42,.16),transparent 55%),linear-gradient(180deg,#07110d,#060d0a 60%,#050a08);
}
.pvgc-live *{box-sizing:border-box}
.pvgc-live .tnum,.pvgc-live .score,.pvgc-live .seed,.pvgc-live h1,.pvgc-live .clock,.pvgc-live .chip .v{font-family:var(--num);font-variant-numeric:tabular-nums}
.pvgc-live .wrap{max-width:760px;margin:0 auto;padding:0 14px}
.pvgc-live .mast{position:sticky;top:0;z-index:20;background:var(--mast);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.pvgc-live .mast-in{max-width:760px;margin:0 auto;padding:11px 14px;display:flex;align-items:center;gap:11px}
.pvgc-live .live{display:flex;align-items:center;gap:6px;flex-shrink:0}
.pvgc-live .dot{width:9px;height:9px;border-radius:50%;background:var(--red);animation:lpulse 1.7s infinite}
.pvgc-live .dot.off{background:var(--muted);animation:none}
.pvgc-live .live b{font-size:10px;letter-spacing:.16em;font-weight:800;color:var(--red)}
.pvgc-live .dot.off ~ b,.pvgc-live .live .dot.off+b{color:var(--muted)}
.pvgc-live .mtitle{min-width:0}
.pvgc-live h1{font-size:14px;font-weight:800;letter-spacing:.02em;margin:0;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pvgc-live h1 span{color:var(--gold)}
.pvgc-live .sub{font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pvgc-live .tvbtn{margin-left:auto;flex-shrink:0;background:transparent;border:1px solid var(--line);color:var(--muted);border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;cursor:pointer}
.pvgc-live .tvbtn+.tvbtn{margin-left:6px}
.pvgc-live .tvbtn:hover{color:var(--ink);border-color:var(--gold)}
.pvgc-live .backbtn{flex-shrink:0;background:transparent;border:1px solid var(--line);color:var(--muted);border-radius:8px;padding:6px 9px;font-size:12px;font-weight:700;cursor:pointer;margin-right:2px}
.pvgc-live .backbtn:hover{color:var(--ink);border-color:var(--gold)}
.pvgc-live .ticker{display:flex;align-items:center;border-bottom:1px solid var(--line);background:var(--tickbg);overflow:hidden;height:34px}
.pvgc-live .ticker .tag{flex-shrink:0;background:var(--red);color:#fff;font-weight:900;font-size:10px;letter-spacing:.12em;padding:0 10px;height:100%;display:flex;align-items:center}
.pvgc-live .track-wrap{overflow:hidden;flex:1;height:100%;position:relative}
.pvgc-live .track{display:flex;position:absolute;white-space:nowrap;height:100%;align-items:center;animation:lmarq 30s linear infinite;will-change:transform}
.pvgc-live .m{display:inline-flex;align-items:center;padding:0 20px;font-size:12.5px;color:var(--ink);border-right:1px solid var(--line)}
.pvgc-live .m.lead{color:var(--gold);font-weight:700}
.pvgc-live .m.clinch{color:var(--green);font-weight:800}
.pvgc-live .selrow{display:flex;align-items:center;gap:8px;padding:14px 0 2px}
.pvgc-live .nav{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:16px;font-weight:700;cursor:pointer;flex-shrink:0}
.pvgc-live .nav:disabled{color:var(--muted);opacity:.4;cursor:default}
.pvgc-live .wsel{flex:1;height:34px;padding:0 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg2);color:var(--ink);font-size:14px;font-weight:600;text-align:center;text-align-last:center}
.pvgc-live .now{height:34px;padding:0 12px;border-radius:8px;border:1px solid var(--green);background:rgba(28,133,74,.12);color:var(--green);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0}
.pvgc-live .strip{display:flex;gap:8px;overflow-x:auto;padding:12px 0 2px;scrollbar-width:none}
.pvgc-live .strip::-webkit-scrollbar{display:none}
.pvgc-live .chip{flex-shrink:0;background:var(--bg2);border:1px solid var(--line);border-radius:12px;padding:8px 13px;min-width:130px;box-shadow:var(--shadow)}
.pvgc-live .chip .k{font-size:9.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);font-weight:700}
.pvgc-live .chip .v{font-weight:800;font-size:16px;margin-top:3px}
.pvgc-live .chip .v small{font-size:11px;color:var(--muted);font-weight:600}
.pvgc-live .chip.hot{border-color:rgba(207,55,44,.4)}.pvgc-live .chip.hot .v{color:var(--red)}
.pvgc-live .cards{display:grid;gap:12px;margin-top:14px}
.pvgc-live .empty{text-align:center;color:var(--muted);padding:40px 0;font-size:14px}
.pvgc-live .card{background:var(--bg2);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:var(--shadow)}
.pvgc-live .card.tight{border-color:rgba(207,55,44,.35)}
.pvgc-live .chead{display:flex;align-items:center;justify-content:space-between;padding:9px 14px;border-bottom:1px solid var(--line);background:rgba(26,61,36,.03)}
.pvgc-live .lbl{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:800}
.pvgc-live .badge{font-size:9.5px;font-weight:900;letter-spacing:.06em;padding:3px 9px;border-radius:20px}
.pvgc-live .badge.live{color:var(--gold);background:rgba(169,125,32,.13)}
.pvgc-live .badge.tight{color:var(--red);background:rgba(207,55,44,.14)}
.pvgc-live .badge.clinch{color:var(--green);background:rgba(28,133,74,.14)}
.pvgc-live .badge.final{color:var(--ink);background:rgba(26,61,36,.08)}
.pvgc-live .row{display:flex;align-items:center;gap:11px;padding:12px 14px;position:relative}
.pvgc-live .row+.row{border-top:1px solid var(--line)}
.pvgc-live .row.lead{background:linear-gradient(90deg,rgba(169,125,32,.10),transparent 70%)}
.pvgc-live .row.lead::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold)}
.pvgc-live .seed{font-size:11px;font-weight:800;color:var(--muted);width:20px;text-align:center;flex-shrink:0}
.pvgc-live .row.lead .seed{color:var(--gold)}
.pvgc-live .team{flex:1;min-width:0}
.pvgc-live .nm{font-size:15px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pvgc-live .spark{display:flex;gap:3px;margin-top:6px}
.pvgc-live .pip{width:11px;height:11px;border-radius:3px;background:var(--pipe);border:1px solid var(--pipe)}
.pvgc-live .pip.p0{background:var(--pip0)}.pvgc-live .pip.p1{background:var(--pip1)}.pvgc-live .pip.p2{background:var(--pip2)}
.pvgc-live .pip.p3{background:var(--pip3)}.pvgc-live .pip.p4{background:var(--pip4);box-shadow:0 0 8px rgba(69,209,127,.4)}
.pvgc-live .pip.just{animation:ldot .6s ease-out}
.pvgc-live .thru{text-align:right;flex-shrink:0}.pvgc-live .thru .t{font-size:11px;color:var(--muted);font-weight:600}
.pvgc-live .score{font-weight:800;font-size:34px;line-height:1;min-width:50px;text-align:right;flex-shrink:0;letter-spacing:-.02em}
.pvgc-live .row.lead .score{color:var(--green)}
.pvgc-live .score.bumped{animation:lpop .55s cubic-bezier(.2,1.4,.4,1)}
.pvgc-live .arw{width:14px;flex-shrink:0;color:var(--green);font-size:13px;text-align:center}
.pvgc-live .cfoot{display:flex;align-items:center;gap:10px;padding:8px 14px 11px}
.pvgc-live .mom{flex:1;height:6px;border-radius:4px;background:var(--pipe);overflow:hidden;display:flex}
.pvgc-live .mom .a{background:linear-gradient(90deg,var(--gold),rgba(169,125,32,.4));transition:width .5s}
.pvgc-live .mom .b{background:linear-gradient(90deg,rgba(58,111,143,.4),var(--sky));transition:width .5s}
.pvgc-live .margin{font-size:11.5px;font-weight:700;color:var(--muted);white-space:nowrap;flex-shrink:0}
.pvgc-live .margin b{color:var(--ink)}
.pvgc-live .expander{font-size:10px;color:var(--muted);text-align:center;padding:0 0 9px;cursor:pointer;user-select:none}
.pvgc-live .card:hover .expander{color:var(--gold)}
.pvgc-live .sheet{border-top:1px solid var(--line);padding:6px 4px 10px;overflow-x:auto;background:rgba(26,61,36,.03)}
.pvgc-live .sheet table{width:100%;border-collapse:collapse;font-size:12px;min-width:430px}
.pvgc-live .sheet td,.pvgc-live .sheet th{padding:5px;text-align:center;font-weight:600}
.pvgc-live .sheet th{color:var(--muted);font-size:10px;font-weight:700}
.pvgc-live .sheet .pl{text-align:left;padding-left:12px;white-space:nowrap;font-weight:600;position:sticky;left:0;background:var(--plbg)}
.pvgc-live .sheet .par td{color:var(--muted);font-size:10px}
.pvgc-live .sheet .bird{color:var(--green);font-weight:800}.pvgc-live .sheet .eag{color:var(--gold);font-weight:800}
.pvgc-live .sheet .bog{color:#d98a4a}.pvgc-live .sheet .dbl{color:var(--red)}
.pvgc-live .sheet .fut{color:var(--futc)}.pvgc-live .sheet .sub{color:var(--muted);font-style:italic}
.pvgc-live .sheet .tot{color:var(--gold);font-weight:800}
.pvgc-live .foot{max-width:760px;margin:18px auto 0;padding:0 16px;font-size:11px;color:var(--muted);text-align:center;line-height:1.5}
.pvgc-live .foot .g{color:var(--green)}
.pvgc-live.tv .wrap{max-width:1100px}
.pvgc-live.tv .nm{font-size:19px}.pvgc-live.tv .score{font-size:44px}
.pvgc-live.tv .strip,.pvgc-live.tv .expander,.pvgc-live.tv .selrow{display:none}
.pvgc-live.tv .cards{gap:14px}
@media(min-width:760px){.pvgc-live.tv .cards{grid-template-columns:1fr 1fr}}
@keyframes lpulse{0%{box-shadow:0 0 0 0 rgba(207,55,44,.6)}70%{box-shadow:0 0 0 8px rgba(207,55,44,0)}100%{box-shadow:0 0 0 0 rgba(207,55,44,0)}}
@keyframes lmarq{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes lpop{0%{transform:scale(1)}35%{transform:scale(1.26);color:var(--gold)}100%{transform:scale(1)}}
@keyframes ldot{0%{transform:scale(0);opacity:0}60%{transform:scale(1.35)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){.pvgc-live .dot,.pvgc-live .track,.pvgc-live .score.bumped,.pvgc-live .pip.just{animation:none}}
`;
