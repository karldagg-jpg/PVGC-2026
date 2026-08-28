import { useState, useEffect, useMemo } from "react";
import { TEAMS, PAR, SI, SCHEDULE, getTeeTimes } from "../constants/league";
import { computeTeamTotal, calcLeagueStats, rankStandings, matchKey, slotHcp, slotName, stabPts, hcpStr } from "../lib/leagueLogic";
import { fmtDate } from "../lib/format";

const ROUND = { 18: "Knockdown Round", 19: "Quarterfinals", 20: "Semifinals", 21: "Finals" };
const DEFAULT_EXEMPT = ["Brian Charles", "Jack Carickhoff", "Karl Dagg"];
const unflat = (s) => Array.isArray(s) ? s : (s ? [s.p0 || [], s.p1 || []] : [[], []]);
const grossOf = (a) => (Array.isArray(a) ? a.reduce((s, v) => s + (v || 0), 0) : 0);
const initials = (nm) => (nm || "").split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase();

export default function RecapScreen({ league, saveLeague, isAdmin, schedule = SCHEDULE, weeklyPoty = {} }) {
  const H = league.handicaps || {};
  const results = league.results || {};

  const weeksWithData = useMemo(() =>
    Object.keys(results).map(Number).filter(w => Object.keys(results[w] || {}).length > 0).sort((a, b) => a - b),
    [results]);
  const latest = weeksWithData[weeksWithData.length - 1] || 1;

  const [selWeek, setSelWeek] = useState(null);
  const week = (selWeek && weeksWithData.includes(selWeek)) ? selWeek : latest;
  const idx = weeksWithData.indexOf(week);
  const roundName = ROUND[week] || `Week ${week}`;
  const dateStr = schedule[week]?.date ? fmtDate(schedule[week].date) : "";

  // ── editable recap content (per week) ──
  const recap = (league.recaps || {})[week] || {};
  const [editing, setEditing] = useState(false);
  const [dHead, setDHead] = useState(recap.headline || "");
  const [dNote, setDNote] = useState(recap.note || "");
  const [dHi, setDHi] = useState("");
  useEffect(() => { setEditing(false); setDHead(recap.headline || ""); setDNote(recap.note || ""); setDHi(""); }, [week]); // eslint-disable-line

  const saveRecap = (patch) => saveLeague({ ...league, recaps: { ...(league.recaps || {}), [week]: { ...recap, ...patch } } });
  const saveNote = () => { saveRecap({ headline: dHead.trim(), note: dNote.trim() }); setEditing(false); };
  const addHighlight = () => { if (!dHi.trim()) return; saveRecap({ highlights: [...(recap.highlights || []), dHi.trim()] }); setDHi(""); };
  const removeHighlight = (i) => saveRecap({ highlights: (recap.highlights || []).filter((_, j) => j !== i) });

  // ── per-week section show/hide (admin) — default shown ──
  const toggleFlag = (key) => saveRecap({ [key]: !recap[key] });
  const SECTION_TOGGLES = [["hidePotw", "Player of the Week"], ["hideStandings", "Seeding / standings"], ["hidePreview", "Next-week preview"]];

  // ── results ──
  const pairs = (schedule[week]?.pairs || []).filter(Array.isArray);
  const matchRows = pairs.map(([ta, tb]) => {
    const [tlow, thigh] = ta < tb ? [ta, tb] : [tb, ta];
    const rec = results[week]?.[matchKey(week, tlow, thigh)] || null;
    const A = rec ? computeTeamTotal(rec, 0, tlow, H) : null;
    const B = rec ? computeTeamTotal(rec, 1, thigh, H) : null;
    return { tlow, thigh, A, B, played: rec && (A > 0 || B > 0) };
  }).filter(m => m.played);

  // ── standings as of this week (+ movement vs prior week) ──
  const { standings, movement } = useMemo(() => {
    const capW = Math.min(week, 18);
    const rankAt = (w) => {
      const { teamStats } = calcLeagueStats(results, H, league.cancelledWeeks, w, schedule, undefined, undefined, league.loHiOverrides);
      return rankStandings(teamStats, { results, handicaps: H, seedOverrides: league.seedOverrides }).map(s => s.id);
    };
    const now = rankAt(capW);
    const prevWeeks = weeksWithData.filter(w => w < week);
    const prior = prevWeeks.length ? rankAt(Math.min(prevWeeks[prevWeeks.length - 1], 18)) : now;
    const mv = {};
    now.forEach((id, i) => { const p = prior.indexOf(id); mv[id] = p < 0 ? 0 : p - i; });
    return { standings: now, movement: mv };
  }, [week, results, league.cancelledWeeks, league.loHiOverrides, league.seedOverrides]); // eslint-disable-line

  // ── shots of the week (auto) ──
  const shots = useMemo(() => {
    const out = { albatross: [], eagle: [], double: [], low: null };
    for (const [ta, tb] of pairs) {
      const [tlow, thigh] = ta < tb ? [ta, tb] : [tb, ta];
      const rec = results[week]?.[matchKey(week, tlow, thigh)]; if (!rec) continue;
      [[tlow, 0], [thigh, 1]].forEach(([tid, ti]) => {
        const s = unflat(ti === 0 ? rec.t1scores : rec.t2scores);
        const types = (ti === 0 ? rec.t1types : rec.t2types) || [];
        [0, 1].forEach(pi => {
          if ((types[pi] || "normal") !== "normal") return;
          const arr = s[pi] || []; const g = grossOf(arr); if (!g) return;
          const nm = slotName(rec, tid, pi);
          if (!out.low || g < out.low.g) out.low = { nm, g };
          for (let h = 0; h < 9; h++) {
            const gr = arr[h] || 0; if (!gr) continue;
            const pts = stabPts(gr, PAR[h], hcpStr(slotHcp(rec, tid, pi, H), SI[h])) || 0;
            if (pts === 5) out.albatross.push({ nm, h: h + 1 });
            else if (pts === 4) out.eagle.push({ nm, h: h + 1 });
            else if (pts === -1) out.double.push({ nm, h: h + 1 });
          }
        });
      });
    }
    return out;
  }, [week, results]); // eslint-disable-line

  // ── POTW (already computed by App) ──
  const potw = weeklyPoty[week];

  // ── dues nudge — only for the last 2 weeks with data ──
  const showDues = weeksWithData.slice(-2).includes(week);
  const dues = useMemo(() => {
    const B = league.budget || {};
    const exempt = new Set((B.exempt || DEFAULT_EXEMPT).map(n => n.trim().toLowerCase()));
    const paid = league.dues || {};
    let unpaid = 0;
    for (let t = 1; t <= 18; t++) for (let pi = 0; pi < 2; pi++) {
      const nm = TEAMS[t]?.[pi === 0 ? "p1" : "p2"]; if (!nm) continue;
      if (exempt.has(nm.trim().toLowerCase())) continue;
      if (!paid[`${t}-${pi}`]) unpaid++;
    }
    return { unpaid, per: B.duesPerPlayer || 60 };
  }, [league.budget, league.dues]);

  // ── next week preview ──
  const nextWeek = week + 1;
  const nextPairs = (schedule[nextWeek]?.pairs || []).filter(Array.isArray);
  const nextTee = getTeeTimes(nextWeek) || [];
  const nextName = ROUND[nextWeek] || (nextWeek <= 17 ? `Week ${nextWeek}` : null);

  const seedOf = (tid) => (standings.indexOf(tid) + 1) || 0;

  // ── copy-to-email text ──
  const emailText = () => {
    const L = [];
    L.push(`PVGC — ${roundName} Recap${dateStr ? ` (${dateStr})` : ""}`);
    if (recap.headline) L.push(`\n${recap.headline}`);
    if (recap.note) L.push(recap.note);
    L.push(`\nRESULTS`);
    matchRows.forEach(m => { const wA = m.A >= m.B; L.push(`  ${TEAMS[m.tlow]?.name} ${m.A} ${wA ? "def." : "lost to"} ${TEAMS[m.thigh]?.name} ${m.B}`); });
    if (potw?.winners?.length) L.push(`\nPLAYER OF THE WEEK: ${potw.winners.map(p => p.name).join(", ")} — ${potw.pts} pts`);
    const sh = [];
    shots.albatross.forEach(a => sh.push(`  ALBATROSS — ${a.nm} on #${a.h}`));
    shots.eagle.forEach(a => sh.push(`  Net eagle — ${a.nm} on #${a.h}`));
    if (shots.low) sh.push(`  Low round — ${shots.low.nm} (${shots.low.g})`);
    (recap.highlights || []).forEach(h => sh.push(`  ${h}`));
    if (sh.length) L.push(`\nSHOTS OF THE WEEK\n${sh.join("\n")}`);
    if (showDues && dues.unpaid > 0) L.push(`\nDUES: ${dues.unpaid} player${dues.unpaid === 1 ? "" : "s"} still owe $${dues.per}. Settle up!`);
    if (nextPairs.length && nextName) {
      L.push(`\nUP NEXT — ${nextName}`);
      nextPairs.forEach((p, i) => { const [a, b] = p; L.push(`  ${nextTee[i] || ""}  ${TEAMS[a]?.name} vs ${TEAMS[b]?.name}`); });
    }
    return L.join("\n");
  };
  const [copied, setCopied] = useState(false);
  const doCopy = () => { try { navigator.clipboard.writeText(emailText()); setCopied(true); setTimeout(() => setCopied(false), 2200); } catch (e) {} };

  const weekName = (w) => ROUND[w] || `Week ${w}`;

  return (
    <div className="pvgc-recap">
      <style>{CSS}</style>
      <h1>Weekly Recap</h1>
      <div className="sub">The story of every week — built from the scores{isAdmin ? " · you can add a note & highlights" : ""}</div>

      <div className="sel">
        <button className="nav" disabled={idx <= 0} onClick={() => idx > 0 && setSelWeek(weeksWithData[idx - 1])}>‹</button>
        <select className="wsel" value={week} onChange={e => setSelWeek(parseInt(e.target.value))}>
          {weeksWithData.map(w => <option key={w} value={w}>{weekName(w)}{w === latest ? " · latest" : ""}</option>)}
        </select>
        <button className="nav" disabled={idx >= weeksWithData.length - 1} onClick={() => idx < weeksWithData.length - 1 && setSelWeek(weeksWithData[idx + 1])}>›</button>
        {isAdmin && <button className={"editbtn" + (editing ? " on" : "")} onClick={() => editing ? saveNote() : setEditing(true)}>{editing ? "✓ Save" : "✏️ Edit"}</button>}
      </div>

      {/* Commissioner's note */}
      {editing ? (
        <div className="note edit">
          <input className="hin" value={dHead} onChange={e => setDHead(e.target.value)} placeholder="Headline (e.g. The bracket is set 🦅)" />
          <textarea className="nin" value={dNote} onChange={e => setDNote(e.target.value)} placeholder="Your note — announcements, shout-outs, call Jimmy, trash talk…" rows={4} />
          <div className="showcfg">
            <div className="scttl">Show in this recap</div>
            {SECTION_TOGGLES.map(([k, label]) => (
              <div className="scrow" key={k}>
                <span>{label}</span>
                <button type="button" className={"sw" + (!recap[k] ? " on" : "")} onClick={() => toggleFlag(k)} aria-label={"Toggle " + label}><span className="kn" /></button>
              </div>
            ))}
          </div>
        </div>
      ) : (recap.headline || recap.note) ? (
        <div className="note">
          {recap.headline && <div className="hl">{recap.headline}</div>}
          {recap.note && <p>{recap.note}</p>}
        </div>
      ) : isAdmin ? (
        <div className="note empty" onClick={() => setEditing(true)}>✏️ Add a commissioner's note for this week…</div>
      ) : null}

      {/* Results */}
      {matchRows.length > 0 && (
        <div className="card">
          <div className="sechd"><span>{week >= 18 ? roundName : "Results"}</span><span>{dateStr}</span></div>
          <div className="body">
            {matchRows.map((m, i) => {
              const aw = m.A >= m.B;
              return (
                <div className="m" key={i}>
                  <span className={"nm" + (aw ? " w" : "")}>{TEAMS[m.tlow]?.name}</span>
                  <span className={"sc" + (aw ? " w" : "")}>{m.A}</span>
                  <span className="vs">{aw ? "def" : "lost"}</span>
                  <span className={"nm r" + (!aw ? " w" : "")}>{TEAMS[m.thigh]?.name}</span>
                  <span className={"sc" + (!aw ? " w" : "")}>{m.B}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Standings */}
      {!recap.hideStandings && (
      <div className="card">
        <div className="sechd"><span>{week >= 18 ? "Seeding · through Knockdown" : `Standings · through Week ${week}`}</span></div>
        <div className="body">
          {standings.slice(0, 8).map((tid, i) => {
            const mv = movement[tid] || 0;
            return (
              <div className="st" key={tid}>
                <span className="rk">{i + 1}</span>
                <span className="tm">{TEAMS[tid]?.name}</span>
                <span className={"mv " + (mv > 0 ? "up" : mv < 0 ? "dn" : "eq")}>{mv > 0 ? `▲${mv}` : mv < 0 ? `▼${-mv}` : "–"}</span>
              </div>
            );
          })}
          <div className="more">seeds 9–18 in the Standings tab</div>
        </div>
      </div>
      )}

      {/* Player of the week */}
      {!recap.hidePotw && potw?.winners?.length > 0 && (
        <div className="card">
          <div className="sechd"><span>Player of the Week</span><span className="gold">weekly payout</span></div>
          <div className="potw">
            <div className="av">{initials(potw.winners[0].name)}</div>
            <div className="who"><b>{potw.winners.map(p => p.name).join(" & ")}</b><span>{potw.winners.length === 1 ? potw.winners[0].team : "shared"}</span></div>
            <div className="big">{potw.pts}<small> pts</small></div>
          </div>
        </div>
      )}

      {/* Shots of the week */}
      {(shots.albatross.length || shots.eagle.length || shots.low || (recap.highlights || []).length || editing) ? (
        <div className="card">
          <div className="sechd"><span>Shots of the Week</span></div>
          <div className="body">
            {shots.albatross.map((a, i) => <div className="shot alb" key={"a" + i}><span className="ic">🦅</span><div className="tx"><b>{a.nm}</b> — <b className="gold">albatross on #{a.h}</b></div><span className="stag">Albatross</span></div>)}
            {shots.eagle.map((a, i) => <div className="shot" key={"e" + i}><span className="ic">🦅</span><div className="tx"><b>{a.nm}</b> — net eagle on #{a.h}</div></div>)}
            {shots.low && <div className="shot"><span className="ic">🏌️</span><div className="tx"><b>Low round:</b> {shots.low.nm} — {shots.low.g}</div></div>}
            {(recap.highlights || []).map((h, i) => (
              <div className="shot" key={"h" + i}><span className="ic">⭐</span><div className="tx">{h}</div>{editing && <button className="x" onClick={() => removeHighlight(i)}>✕</button>}</div>
            ))}
            {shots.albatross.length === 0 && shots.eagle.length === 0 && !shots.low && (recap.highlights || []).length === 0 && <div className="more">No standout shots detected — add one below.</div>}
            {editing && (
              <div className="addhi">
                <input value={dHi} onChange={e => setDHi(e.target.value)} placeholder="Add a highlight the data can't see (chip-in, clutch putt…)" onKeyDown={e => e.key === "Enter" && addHighlight()} />
                <button onClick={addHighlight}>Add</button>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Dues nudge (last 2 weeks only) */}
      {showDues && dues.unpaid > 0 && (
        <div className="dues">
          💸 <b>Dues check</b> — {dues.unpaid} player{dues.unpaid === 1 ? "" : "s"} still {dues.unpaid === 1 ? "owes" : "owe"} the ${dues.per}. You know who you are — settle up.
        </div>
      )}

      {/* Up next */}
      {!recap.hidePreview && nextPairs.length > 0 && nextName && (
        <div className="card">
          <div className="sechd"><span>Up Next · {nextName}</span><span>{schedule[nextWeek]?.date ? fmtDate(schedule[nextWeek].date) : ""}</span></div>
          <div className="body">
            {(getTeeTimes(nextWeek)?.length ? getTeeTimes(1) : []).map((slot, i) => {
              // render all slots; match if a pair is at this time
              const teeForPair = nextPairs.map((_, j) => (getTeeTimes(nextWeek) || [])[j]);
              const pi = teeForPair.indexOf(slot);
              const p = pi >= 0 ? nextPairs[pi] : null;
              if (!p) return <div className="pv open" key={i}><span className="t">{slot}</span><span className="g">Open — league play</span></div>;
              const [a, b] = p;
              return <div className="pv" key={i}><span className="t">{slot}</span><span className="g">{nextWeek >= 19 ? `#${seedOf(a)} ` : ""}{TEAMS[a]?.name} vs {nextWeek >= 19 ? `#${seedOf(b)} ` : ""}{TEAMS[b]?.name}</span></div>;
            })}
          </div>
        </div>
      )}

      <button className="copybtn" onClick={doCopy}>{copied ? "✓ Copied — paste into your email" : "📋 Copy this recap for email"}</button>
    </div>
  );
}

const CSS = `
.pvgc-recap{--bg:#f1eee3;--card:#fff;--ink:#17281e;--muted:#6a7c6f;--line:rgba(26,61,36,.12);--green:#1c854a;--greenDk:#173d24;--gold:#a97d20;--goldbg:#fbf3dd;--red:#cf372c;--num:'SF Pro Display',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
  max-width:620px;margin:0 auto;padding:22px 14px 60px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased}
.pvgc-recap *{box-sizing:border-box;min-width:0}
.pvgc-recap h1{font-size:28px;font-weight:800;letter-spacing:.01em;margin:0}
.pvgc-recap .sub{color:var(--muted);font-size:14px;margin:3px 0 14px}
.pvgc-recap .sel{display:flex;align-items:center;gap:8px;margin-bottom:16px}
.pvgc-recap .nav{width:36px;height:36px;border-radius:9px;border:1px solid var(--line);background:#fff;color:var(--ink);font-size:16px;font-weight:700;cursor:pointer;flex-shrink:0}
.pvgc-recap .nav:disabled{opacity:.4;cursor:default}
.pvgc-recap .wsel{flex:1;height:36px;border-radius:9px;border:1px solid var(--line);background:#fff;font-size:14px;font-weight:700;text-align:center;text-align-last:center;color:var(--ink)}
.pvgc-recap .editbtn{height:36px;padding:0 12px;border-radius:9px;border:1px solid var(--line);background:#fff;color:var(--muted);font-size:13px;font-weight:700;cursor:pointer;flex-shrink:0}
.pvgc-recap .editbtn.on{background:var(--green);border-color:var(--green);color:#fff}
.pvgc-recap .card{background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 4px 16px rgba(40,55,35,.06);margin-bottom:14px;overflow:hidden}
.pvgc-recap .sechd{font-size:11px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);padding:14px 16px 0;display:flex;align-items:center;justify-content:space-between}
.pvgc-recap .sechd .gold{color:var(--gold);letter-spacing:0}
.pvgc-recap .body{padding:6px 0 8px}
.pvgc-recap .more{text-align:center;color:var(--muted);font-size:12px;padding:8px 0 4px}
.pvgc-recap .note{background:var(--goldbg);border:1px solid #e6cf86;border-radius:16px;margin-bottom:14px;box-shadow:0 4px 16px rgba(40,55,35,.06)}
.pvgc-recap .note .hl{font-family:var(--num);font-size:19px;font-weight:800;color:var(--greenDk);padding:14px 16px 2px}
.pvgc-recap .note p{font-size:14px;line-height:1.55;color:#5c4a12;padding:2px 16px 15px;margin:0;white-space:pre-wrap}
.pvgc-recap .note.empty{padding:16px;color:var(--gold);font-size:14px;font-weight:600;cursor:pointer;text-align:center}
.pvgc-recap .note.edit{padding:12px}
.pvgc-recap .note .hin{width:100%;border:1px solid #e6cf86;border-radius:9px;padding:9px 11px;font-size:16px;font-weight:700;font-family:var(--num);color:var(--greenDk);background:#fff;outline:none;margin-bottom:8px}
.pvgc-recap .note .nin{width:100%;border:1px solid #e6cf86;border-radius:9px;padding:9px 11px;font-size:14px;line-height:1.5;color:#3a2c05;background:#fff;outline:none;resize:vertical;font-family:inherit}
.pvgc-recap .m{display:flex;align-items:center;padding:10px 16px;border-top:1px solid var(--line);font-size:14px}
.pvgc-recap .m:first-child{border-top:0}
.pvgc-recap .m .nm{flex:1;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pvgc-recap .m .nm.r{text-align:right}
.pvgc-recap .m .nm.w{color:var(--green);font-weight:800}
.pvgc-recap .m .vs{color:var(--muted);font-size:11px;padding:0 8px;flex-shrink:0}
.pvgc-recap .m .sc{font-family:var(--num);font-weight:800;font-size:16px;min-width:24px;text-align:center;flex-shrink:0}
.pvgc-recap .m .sc.w{color:var(--green)}
.pvgc-recap .st{display:flex;align-items:center;padding:9px 16px;border-top:1px solid var(--line);font-size:14px}
.pvgc-recap .st:first-child{border-top:0}
.pvgc-recap .st .rk{width:24px;font-family:var(--num);font-weight:800;color:var(--gold)}
.pvgc-recap .st .tm{flex:1;font-weight:600}
.pvgc-recap .st .mv{font-size:12px;font-weight:700;width:34px;text-align:right}
.pvgc-recap .up{color:var(--green)}.pvgc-recap .dn{color:var(--red)}.pvgc-recap .eq{color:var(--muted)}
.pvgc-recap .potw{display:flex;align-items:center;gap:12px;padding:14px 16px 16px}
.pvgc-recap .potw .av{width:46px;height:46px;border-radius:50%;background:var(--greenDk);color:#e3ba4e;font-family:var(--num);font-weight:800;font-size:15px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pvgc-recap .potw .who{flex:1}.pvgc-recap .potw .who b{font-size:16px}.pvgc-recap .potw .who span{display:block;font-size:12px;color:var(--muted);margin-top:1px}
.pvgc-recap .potw .big{font-family:var(--num);font-size:30px;font-weight:800;color:var(--green)}.pvgc-recap .potw .big small{font-size:12px;color:var(--muted);font-weight:600}
.pvgc-recap .shot{display:flex;align-items:center;gap:10px;padding:10px 16px;border-top:1px solid var(--line);font-size:14px}
.pvgc-recap .shot:first-child{border-top:0}
.pvgc-recap .shot .ic{font-size:17px;width:24px;text-align:center;flex-shrink:0}
.pvgc-recap .shot .tx{flex:1}.pvgc-recap .shot .tx b{font-weight:700}.pvgc-recap .shot .gold{color:var(--gold)}
.pvgc-recap .shot.alb{background:linear-gradient(90deg,rgba(169,125,32,.09),transparent)}
.pvgc-recap .shot .stag{font-size:10px;font-weight:800;letter-spacing:.05em;color:var(--gold);text-transform:uppercase;flex-shrink:0}
.pvgc-recap .shot .x{border:0;background:transparent;color:var(--red);font-size:14px;cursor:pointer;flex-shrink:0}
.pvgc-recap .addhi{display:flex;gap:8px;padding:10px 16px 4px}
.pvgc-recap .addhi input{flex:1;border:1px solid var(--line);border-radius:8px;padding:8px 10px;font-size:13px;outline:none}
.pvgc-recap .addhi button{border:0;background:var(--green);color:#fff;border-radius:8px;padding:0 14px;font-weight:700;cursor:pointer}
.pvgc-recap .dues{background:#fbf3dd;border:1px solid #e6cf86;border-radius:14px;padding:13px 16px;font-size:14px;line-height:1.5;color:#5c4a12;margin-bottom:14px}
.pvgc-recap .dues b{color:#8a6d15}
.pvgc-recap .pv{display:flex;align-items:center;padding:9px 16px;border-top:1px solid var(--line);font-size:13.5px}
.pvgc-recap .pv:first-child{border-top:0}
.pvgc-recap .pv .t{font-family:var(--num);font-weight:800;color:var(--gold);width:60px;flex-shrink:0}
.pvgc-recap .pv .g{flex:1}
.pvgc-recap .pv.open{color:var(--muted);font-style:italic}
.pvgc-recap .copybtn{width:100%;padding:13px;border-radius:12px;border:0;background:var(--greenDk);color:#fff;font-size:15px;font-weight:800;letter-spacing:.02em;cursor:pointer;margin-top:4px}
.pvgc-recap .showcfg{margin-top:10px;border-top:1px solid #e6cf86;padding-top:8px}
.pvgc-recap .scttl{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#8a6d15;margin:2px 0 4px}
.pvgc-recap .scrow{display:flex;align-items:center;justify-content:space-between;padding:6px 2px;font-size:14px;color:#3a2c05}
.pvgc-recap .sw{width:44px;height:25px;border-radius:14px;border:0;background:#d8cfa8;position:relative;cursor:pointer;flex-shrink:0;transition:background .15s;padding:0}
.pvgc-recap .sw.on{background:var(--green)}
.pvgc-recap .sw .kn{position:absolute;top:3px;left:3px;width:19px;height:19px;border-radius:50%;background:#fff;transition:left .15s;box-shadow:0 1px 3px rgba(0,0,0,.3)}
.pvgc-recap .sw.on .kn{left:22px}
`;
