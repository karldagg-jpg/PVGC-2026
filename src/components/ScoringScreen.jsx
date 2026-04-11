import { PAR, SI, RAINOUT_SUB, TEAMS, SCHEDULE } from "../constants/league";
import { stabPts, hcpStr, maxGross, getEffectiveHcp, getEffectiveHcpRaw, computeTeamTotal, matchKey } from "../lib/leagueLogic";
import { BG, CARD, CARD2, CREAM, FB, FD, G, GO, GOLD, M, R } from "../constants/theme";
import { fmtDate } from "../lib/format";
import { Tag, PtsBadge } from "./ui";
import { useState, useEffect, useRef } from "react";

const LOST_BALL_SECS = 20;

// Module-level AudioContext — created on first user tap so iOS allows it later
let _audioCtx = null;

function unlockAudio() {
  try {
    if (!_audioCtx) {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    // Play a silent buffer — fully unlocks iOS audio policy
    const buf = _audioCtx.createBuffer(1, 1, 22050);
    const src = _audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(_audioCtx.destination);
    src.start(0);
  } catch(e) {}
}

function playHorn() {
  try {
    const ctx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    // Clown horn: three descending "honk" blasts
    const honks = [
      { startFreq: 480, endFreq: 320, start: 0.0, dur: 0.25 },
      { startFreq: 420, endFreq: 280, start: 0.3, dur: 0.25 },
      { startFreq: 360, endFreq: 220, start: 0.6, dur: 0.35 },
    ];
    honks.forEach(({ startFreq, endFreq, start, dur }) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(startFreq, ctx.currentTime + start);
      osc.frequency.linearRampToValueAtTime(endFreq, ctx.currentTime + start + dur);
      env.gain.setValueAtTime(0, ctx.currentTime + start);
      env.gain.linearRampToValueAtTime(0.6, ctx.currentTime + start + 0.02);
      env.gain.setValueAtTime(0.6, ctx.currentTime + start + dur - 0.05);
      env.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
      osc.connect(env);
      env.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.05);
    });
  } catch(e) {}
}

function LostBallTimer() {
  const [running, setRunning] = useState(false);
  const [secsLeft, setSecsLeft] = useState(LOST_BALL_SECS);
  const [expired, setExpired] = useState(false);
  const intervalRef = useRef(null);

  function start() {
    unlockAudio(); // must happen during the tap — unlocks iOS audio
    setSecsLeft(LOST_BALL_SECS);
    setExpired(false);
    setRunning(true);
  }

  function cancel() {
    setRunning(false);
    setExpired(false);
    setSecsLeft(LOST_BALL_SECS);
    clearInterval(intervalRef.current);
  }

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setSecsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          setRunning(false);
          setExpired(true);
          playHorn();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const mins = Math.floor(secsLeft / 60);
  const secs = secsLeft % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, "0")}`;
  const urgent = secsLeft <= 30 && running;
  const pct = secsLeft / LOST_BALL_SECS;

  return (
    <>
      {/* Floating button — bottom right */}
      {!running && !expired && (
        <button onClick={start}
          title="Start 3-min lost ball timer"
          style={{
            position: "fixed", bottom: "20px", right: "18px", zIndex: 100,
            width: "52px", height: "52px", borderRadius: "50%",
            background: GOLD + "22", border: `2px solid ${GOLD}66`,
            color: GOLD, fontSize: "22px", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.2)", touchAction: "manipulation",
          }}>
          ⏱
        </button>
      )}

      {/* Running / expired banner */}
      {(running || expired) && (
        <div style={{
          position: "fixed", bottom: "0", left: "0", right: "0", zIndex: 100,
          background: expired ? R : urgent ? R + "ee" : "rgba(20,45,20,0.96)",
          borderTop: `3px solid ${expired ? R : urgent ? R : GOLD}`,
          padding: "14px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.3)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1 }}>
            <span style={{ fontSize: "26px" }}>{expired ? "🚫" : "⏱"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "11px", color: expired ? "#fff" : GOLD, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, marginBottom: "2px" }}>
                {expired ? "Time's Up — Lost Ball!" : "Lost Ball Timer"}
              </div>
              {!expired && (
                <>
                  <div style={{ fontFamily: FB, fontSize: "32px", fontWeight: 700, color: urgent ? "#fff" : GOLD, lineHeight: 1 }}>
                    {timeStr}
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: "3px", background: "rgba(255,255,255,0.15)", borderRadius: "2px", marginTop: "4px" }}>
                    <div style={{
                      height: "100%", borderRadius: "2px",
                      background: urgent ? "#fff" : GOLD,
                      width: `${pct * 100}%`,
                      transition: "width 1s linear",
                    }} />
                  </div>
                </>
              )}
              {expired && (
                <div style={{ fontSize: "14px", color: "#fff", fontWeight: 600 }}>
                  Drop and play a penalty stroke
                </div>
              )}
            </div>
          </div>
          <button onClick={cancel}
            style={{
              padding: "10px 20px", borderRadius: "9px", fontFamily: FB, fontSize: "14px",
              fontWeight: 700, cursor: "pointer", touchAction: "manipulation",
              border: "2px solid rgba(255,255,255,0.4)",
              background: "rgba(255,255,255,0.15)", color: "#fff",
            }}>
            {expired ? "Dismiss" : "Cancel"}
          </button>
        </div>
      )}
    </>
  );
}

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
  cancelledWeeks,
  toggleCancelWeek,
  confirmMatch,
  unlockMatch,
}) {
  const isReadOnly = (league.readOnlyWeeks || []).includes(selWeek);
  const [tlow, thigh] = t1id && t2id ? (t1id<t2id?[t1id,t2id]:[t2id,t1id]) : [0,0];
  const mk = tlow && thigh ? matchKey(selWeek, tlow, thigh) : null;
  const matchDoc = mk ? league.results[selWeek]?.[mk] : null;
  const isLocked = !!(matchDoc?.locked);
  const isDisabled = isLocked || isReadOnly;
  const confirmations = matchDoc?.confirmations || {};
  const hasConfirmed = !!(confirmations[t1id]);
  const oppConfirmed = !!(confirmations[t2id]);

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
      const n = {
        ...prev,
        t1types: [...(Array.isArray(prev.t1types) ? prev.t1types : ["normal","normal"])],
        t2types: [...(Array.isArray(prev.t2types) ? prev.t2types : ["normal","normal"])],
      };
      if (tIdx === 0) n.t1types[pi] = val;
      else n.t2types[pi] = val;
      if (val === "phantom" || val === "sub") {
        const sc = tIdx === 0 ? prev.t1scores.map((a) => [...a]) : prev.t2scores.map((a) => [...a]);
        for (let h = 0; h < 9; h++) sc[pi][h] = 0;
        if (tIdx === 0) n.t1scores = sc;
        else n.t2scores = sc;
      }
      return n;
    });
  }

  function printScorecard() {
    if (!opp) return;
    const getHcpForPrint = (tid, pi) => getEffectiveHcp(tid, pi, selWeek, league.results, league.handicaps, league.hcpOverrides || {});
    const getOrderForPrint = (tid) => {
      const ov = (league.loHiOverrides || {})[`${tid}-${selWeek}`];
      if (ov !== undefined) return ov === 0 ? { low: 0, high: 1 } : { low: 1, high: 0 };
      const r0 = getEffectiveHcpRaw(tid, 0, selWeek, league.results, league.handicaps, league.hcpOverrides || {});
      const r1 = getEffectiveHcpRaw(tid, 1, selWeek, league.results, league.handicaps, league.hcpOverrides || {});
      return r0 <= r1 ? { low: 0, high: 1 } : { low: 1, high: 0 };
    };
    const o1 = getOrderForPrint(t1id), o2 = getOrderForPrint(t2id);
    const players = [
      { tid: t1id, tIdx: 0, pi: o1.low,  label: "Low"  },
      { tid: t1id, tIdx: 0, pi: o1.high, label: "High" },
      { tid: t2id, tIdx: 1, pi: o2.low,  label: "Low"  },
      { tid: t2id, tIdx: 1, pi: o2.high, label: "High" },
    ].map(p => {
      const hcp = getHcpForPrint(p.tid, p.pi);
      // strokes per hole (0, 1, or 2)
      const strokes = Array(9).fill(0).map((_, h) => hcpStr(hcp, SI[h]));
      return {
        ...p,
        hcp,
        strokes,
        name: TEAMS[p.tid]?.[p.pi === 0 ? "p1" : "p2"] || "",
      };
    });

    const dateStr = fmtDate(SCHEDULE[selWeek]?.date) || "";
    const t1name = TEAMS[t1id]?.name || `Team ${t1id}`;
    const t2name = TEAMS[t2id]?.name || `Team ${t2id}`;

    // Stroke indicator: shaded cell bg + small dots at top
    const scoreCell = (str) => {
      const bg = str === 2 ? "#c8e6c9" : str === 1 ? "#e8f5e9" : "#fff";
      const dots = str > 0 ? `<div style="font-size:7px;color:#1a6b3a;line-height:1;margin-bottom:1px">${"●".repeat(str)}</div>` : "";
      return `<td style="background:${bg};width:36px;height:38px;vertical-align:top;padding-top:3px">${dots}</td>`;
    };

    const playerRows = players.map((p, pi) => {
      const isFirst = pi === 0 || pi === 2;
      const sep = isFirst && pi === 2 ? `<tr><td colspan="12" style="height:6px;background:#e8f0e8;border:none"></td></tr>` : "";
      return sep + `<tr>
        <td style="text-align:left;padding:4px 6px;white-space:nowrap;font-size:11px">
          <strong>${p.name}</strong><br>
          <span style="color:#666;font-size:10px">HCP ${p.hcp} · ${p.label}</span>
        </td>
        ${p.strokes.map(str => scoreCell(str)).join("")}
        <td style="width:38px;height:38px;background:#f5f5f5"></td>
      </tr>`;
    });

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>PVGC Wk ${selWeek}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#111;background:#fff;padding:14px 16px}
h1{font-size:14px;font-weight:700;text-align:center;margin-bottom:2px}
.sub{font-size:11px;text-align:center;color:#555;margin-bottom:10px}
table{width:100%;border-collapse:collapse}
td,th{border:1px solid #999;text-align:center;vertical-align:middle}
.hdr th{background:#1e4d2b;color:#fff;font-size:11px;font-weight:600;padding:4px 2px;height:24px}
.par td{background:#f5f0e0;font-weight:700;font-size:12px;padding:3px 2px}
.si  td{background:#fafafa;font-size:10px;color:#888;padding:2px}
.match-section{margin-top:10px;font-size:11px}
.match-row{display:flex;gap:8px;margin-top:6px;align-items:center}
.match-box{border:1px solid #bbb;border-radius:4px;padding:5px 10px;flex:1;font-size:11px}
.match-label{font-weight:700;font-size:10px;color:#555;margin-bottom:3px}
.score-line{display:flex;justify-content:space-between;align-items:center;gap:6px}
.score-blank{border-bottom:1px solid #333;width:32px;height:18px;display:inline-block}
@media print{body{padding:6px};@page{size:portrait;margin:10mm}}
</style></head><body>

<h1>PVGC Golf League — Week ${selWeek}</h1>
<div class="sub">${t1name} &nbsp;vs&nbsp; ${t2name}${dateStr ? " &nbsp;·&nbsp; " + dateStr : ""}</div>

<table>
  <thead>
    <tr class="hdr">
      <th style="text-align:left;padding-left:6px;width:130px">Player</th>
      ${Array(9).fill(0).map((_,h) => `<th style="width:36px">${h+1}</th>`).join("")}
      <th style="width:38px">Total</th>
    </tr>
    <tr class="par">
      <td style="text-align:left;padding-left:6px">Par</td>
      ${PAR.map(p => `<td>${p}</td>`).join("")}
      <td>36</td>
    </tr>
    <tr class="si">
      <td style="text-align:left;padding-left:6px">SI</td>
      ${SI.map(s => `<td>${s}</td>`).join("")}
      <td></td>
    </tr>
  </thead>
  <tbody>
    ${playerRows.join("")}
  </tbody>
</table>

<div class="match-section">
  <div style="font-size:10px;font-weight:700;color:#1e4d2b;margin-bottom:4px;letter-spacing:.06em">MATCH RESULTS</div>
  <div class="match-row">
    <div class="match-box">
      <div class="match-label">LOW vs LOW</div>
      <div class="score-line">
        <span>${players[0].name.split(" ").slice(-1)[0]}</span>
        <span class="score-blank"></span>
        <span style="color:#999">—</span>
        <span class="score-blank"></span>
        <span>${players[2].name.split(" ").slice(-1)[0]}</span>
      </div>
    </div>
    <div class="match-box">
      <div class="match-label">HIGH vs HIGH</div>
      <div class="score-line">
        <span>${players[1].name.split(" ").slice(-1)[0]}</span>
        <span class="score-blank"></span>
        <span style="color:#999">—</span>
        <span class="score-blank"></span>
        <span>${players[3].name.split(" ").slice(-1)[0]}</span>
      </div>
    </div>
    <div class="match-box" style="flex:0.6">
      <div class="match-label">MATCH PTS</div>
      <div class="score-line">
        <span style="font-size:10px">${t1name.split(" - ")[0]}</span>
        <span class="score-blank"></span>
        <span style="color:#999">—</span>
        <span class="score-blank"></span>
        <span style="font-size:10px">${t2name.split(" - ")[0]}</span>
      </div>
    </div>
  </div>
  <div style="font-size:9px;color:#888;margin-top:5px">● = handicap stroke &nbsp;|&nbsp; ●● = 2 strokes &nbsp;|&nbsp; Shaded cells indicate stroke holes</div>
</div>
</body></html>`;

    const w = window.open("", "_blank", "width=780,height=600");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
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
      {opp && (
        <button onClick={printScorecard} style={{
          padding: "6px 12px", borderRadius: "7px", border: `1px solid ${GOLD}44`,
          background: "rgba(26,61,36,0.06)", color: CREAM, fontFamily: FB, fontSize: "13px",
          cursor: "pointer", display: "flex", alignItems: "center", gap: "5px"
        }}>
          🖨 Print
        </button>
      )}
      {cancelledWeeks?.has(selWeek)
        ? <div style={{ marginLeft: "auto", fontSize: "13px", color: "#e6a817", fontWeight: 700 }}>⛈ Cancelled</div>
        : opp
          ? <div style={{ marginLeft: "auto", fontSize: "14px", color: M, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "2px" }}>
              <span>vs <span style={{ color: GO }}>{TEAMS[opp]?.name}</span></span>
              {match.updatedBy && <span style={{ fontSize: "12px", color: GOLD, fontFamily: FB }}>
                ✎ {match.updatedBy}{match.updatedAt ? " · " + match.updatedAt : ""}
              </span>}
            </div>
          : <div style={{ marginLeft: "auto", fontSize: "13px", color: R }}>No match this week</div>
      }
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
          const loHiKey = `${tid}-${selWeek}`;
          const loHiOv = (league.loHiOverrides || {})[loHiKey];
          if (loHiOv !== undefined) return loHiOv === 0 ? { low: 0, high: 1 } : { low: 1, high: 0 };
          const r0 = getEffectiveHcpRaw(tid, 0, selWeek, league.results, league.handicaps, league.hcpOverrides||{});
          const r1 = getEffectiveHcpRaw(tid, 1, selWeek, league.results, league.handicaps, league.hcpOverrides||{});
          return r0 <= r1 ? { low: 0, high: 1 } : { low: 1, high: 0 };
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
        const getHcp = (tid, pi) => getEffectiveHcp(tid, pi, selWeek, league.results, league.handicaps, league.hcpOverrides||{});

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
          if (type === "phantom") return 2;
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

              const cap = maxGross(PAR[effH(hole)], strokes);
              const adjGross = (delta) => {
                if (isDisabled) return;
                const cur = getGross(r.tIdx, r.pi, effH(hole));
                const next = Math.max(1, Math.min(cap, (cur || PAR[hole]) + delta));
                setScoreVal(r.tIdx, r.pi, effH(hole), next);
              };
              const atMax = gross > 0 && gross >= cap;

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
                    <select value={type} onChange={e => !isDisabled && setTypeVal(r.tIdx, r.pi, e.target.value)}
                      disabled={isDisabled}
                      style={{
                        background: "rgba(26,61,36,0.04)", border: `1px solid ${GOLD}33`,
                        borderRadius: "5px", color: CREAM, fontFamily: FB, fontSize: "12px",
                        padding: "3px 5px", cursor: isDisabled ? "not-allowed" : "pointer",
                        outline: "none", flexShrink: 0, opacity: isDisabled ? 0.5 : 1
                      }}>
                      <option value="normal">Regular</option>
                      <option value="sub">Sub</option>
                      <option value="phantom">Phantom</option>
                    </select>

                    {/* +/- Score entry + net + stab */}
                    {(type === "sub" || type === "phantom") ? (
                      <div style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        minWidth: "90px", gap: "2px"
                      }}>
                        <span style={{ fontSize: "13px", color: type === "phantom" ? R : GO }}>
                          {type === "phantom" ? "2 pts fixed" : "6 pts fixed"}
                        </span>
                        <span style={{ fontSize: "12px", color: M }}>
                          {type === "phantom" ? "Phantom" : "Sub"}
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                        {/* −/+ stepper */}
                        <div style={{ display: "flex", alignItems: "center" }}>
                          <button onClick={() => adjGross(-1)}
                            style={{
                              width: "42px", height: "52px", borderRadius: "9px 0 0 9px",
                              border: `1px solid ${GOLD}44`, borderRight: "none",
                              background: "rgba(26,61,36,0.08)", color: CREAM, fontSize: "22px",
                              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                              userSelect: "none", touchAction: "manipulation"
                            }}>−</button>
                          <div onClick={() => !gross && !isDisabled && setScoreVal(r.tIdx, r.pi, effH(hole), PAR[hole])}
                            style={{
                              width: "52px", height: "52px", border: `1px solid ${atMax ? R + "88" : GOLD + "44"}`,
                              background: atMax ? R + "18" : "rgba(26,61,36,0.08)", display: "flex", flexDirection: "column",
                              alignItems: "center", justifyContent: "center", gap: "1px",
                              cursor: !gross && !isDisabled ? "pointer" : "default",
                              touchAction: "manipulation",
                            }}>
                            <span style={{ fontSize: "20px", fontWeight: 700, color: gross ? ptColor : M, lineHeight: 1 }}>
                              {gross || PAR[hole]}
                            </span>
                            <span style={{ fontSize: "10px", lineHeight: 1, color: gross ? ptColor : M }}>
                              {!gross ? "tap par" : scoreName(gross, PAR[hole])}
                            </span>
                          </div>
                          <button onClick={() => adjGross(+1)} disabled={atMax}
                            style={{
                              width: "42px", height: "52px", borderRadius: "0 9px 9px 0",
                              border: `1px solid ${GOLD}44`, borderLeft: "none",
                              background: "rgba(26,61,36,0.08)", color: CREAM, fontSize: "22px",
                              cursor: atMax ? "not-allowed" : "pointer",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              opacity: atMax ? 0.3 : 1, userSelect: "none", touchAction: "manipulation"
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
                        {!gross && <div style={{ width: "36px" }} />}
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
              const gross = (type === "sub" || type === "phantom") ? null : getGrossTotal(r.tIdx, r.pi);
              const net = (type === "sub" || type === "phantom") ? null : getNetTotal(r.tIdx, r.pi, r.tid);
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
                    }}>{pname}{type === "phantom" ? " (P)" : type === "sub" ? " (S)" : ""}</span>
                    {winning && <span style={{ marginLeft: "auto", fontSize: "12px", color: r.color }}>▲ leading</span>}
                    {losing && <span style={{ marginLeft: "auto", fontSize: "12px", color: R }}>▼ trailing</span>}
                  </div>
                  <div style={{ display: "flex", gap: "13px" }}>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "12px", color: M, letterSpacing: "0.04em" }}>GROSS</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: CREAM, lineHeight: 1.1 }}>
                        {(type === "sub" || type === "phantom") ? "—" : gross || "—"}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "12px", color: M, letterSpacing: "0.04em" }}>NET</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#c8d4c0", lineHeight: 1.1 }}>
                        {(type === "sub" || type === "phantom") ? "—" : net || "—"}
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
                          const strokesH = hcpStr(getHcp(r.tid, r.pi), SI[h]);
                          if (type === "sub") return (
                            <td key={h} style={{ padding: "7px 4px", textAlign: "center", color: GO, fontSize: "13px" }}>S</td>
                          );
                          if (type === "phantom") return (
                            <td key={h} style={{ padding: "7px 4px", textAlign: "center", color: R, fontSize: "13px" }}>P</td>
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
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                                {strokesH > 0 && <span style={{ fontSize: "9px", color: G, fontWeight: 700, lineHeight: 1 }}>{"•".repeat(strokesH)}</span>}
                                {gross > 0 ? (<>
                                  <span style={{ fontSize: "14px", fontWeight: 600, color: CREAM }}>{gross}</span>
                                  <span style={{ fontSize: "11px", color: "#c8d4c0" }}>{getNet(r.tIdx, r.pi, r.tid, h)}</span>
                                  <span style={{ fontSize: "12px", fontWeight: pts !== null && pts >= 3 ? 700 : 400, color: ptColor2 }}>
                                    {pts !== null ? pts : "?"}
                                  </span>
                                </>) : (
                                  <span style={{ color: CREAM, fontSize: "14px" }}>–</span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ padding: "4px 8px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: CREAM }}>
                            {(type === "sub" || type === "phantom") ? "—" : getGrossTotal(r.tIdx, r.pi) || "—"}
                          </div>
                          <div style={{ fontSize: "14px", fontWeight: 600, color: "#c8d4c0" }}>
                            {(type === "sub" || type === "phantom") ? "—" : getNetTotal(r.tIdx, r.pi, r.tid) || "—"}
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

      {/* Read-only / Lock banner */}
      {isReadOnly && (
        <div style={{
          background: "#fff3cd", border: "2px solid #e6a817", borderRadius: "12px",
          padding: "12px 16px", marginBottom: "12px", fontSize: "14px",
          color: "#7a4f00", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px"
        }}>
          🔒 Week {selWeek} is read-only — scores are locked by the admin.
        </div>
      )}
      {!isReadOnly && isLocked && (
        <div style={{
          background: G + "12", border: `2px solid ${G}55`, borderRadius: "12px",
          padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "8px", flexWrap: "wrap"
        }}>
          <div style={{ fontSize: "14px", color: G, fontWeight: 700 }}>
            ✅ Scores confirmed &amp; locked
            <span style={{ fontSize: "12px", fontWeight: 400, color: M, marginLeft: "8px" }}>
              Both teams agreed
            </span>
          </div>
          {unlockMatch && (
            <button onClick={() => unlockMatch(selWeek, mk)}
              style={{
                padding: "6px 14px", borderRadius: "7px", border: `1px solid ${R}55`,
                background: R + "12", color: R, fontFamily: FB, fontSize: "13px",
                fontWeight: 600, cursor: "pointer"
              }}>
              Unlock
            </button>
          )}
        </div>
      )}
      {!isReadOnly && !isLocked && opp && mk && (
        <div style={{
          background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px",
          padding: "12px 16px", marginBottom: "12px", display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "8px", flexWrap: "wrap"
        }}>
          <div>
            <div style={{ fontSize: "13px", color: M, marginBottom: "4px", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Confirm Scores
            </div>
            <div style={{ fontSize: "12px", color: M, display: "flex", gap: "12px" }}>
              <span style={{ color: hasConfirmed ? G : M }}>
                {hasConfirmed ? "✓" : "○"} T{t1id} {hasConfirmed ? `(${confirmations[t1id]?.confirmedBy||"confirmed"})` : ""}
              </span>
              <span style={{ color: oppConfirmed ? GO : M }}>
                {oppConfirmed ? "✓" : "○"} T{t2id} {oppConfirmed ? `(${confirmations[t2id]?.confirmedBy||"confirmed"})` : ""}
              </span>
            </div>
          </div>
          {!hasConfirmed && confirmMatch && (
            <button onClick={() => confirmMatch(selWeek, mk, t1id)}
              style={{
                padding: "8px 18px", borderRadius: "8px", border: `1px solid ${G}55`,
                background: G + "18", color: G, fontFamily: FB, fontSize: "14px",
                fontWeight: 600, cursor: "pointer"
              }}>
              Confirm T{t1id} Scores
            </button>
          )}
          {hasConfirmed && !oppConfirmed && (
            <span style={{ fontSize: "12px", color: GOLD, fontWeight: 600 }}>
              Waiting for T{t2id} to confirm…
            </span>
          )}
        </div>
      )}

      {/* Bonus pts */}
      {weekBonus ? (
        <div style={{ background: GOLD + "0a", border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "11px 14px", marginBottom: "12px" }}>
          <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: "8px" }}>
            ✓ Week {selWeek} Bonus Points Awarded
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {(() => {
              // Build tid→weekTotal map from match records
              const weekTotals = {};
              for (const [ta, tb] of (SCHEDULE[selWeek]?.pairs || [])) {
                const [tlow, thigh] = ta < tb ? [ta, tb] : [tb, ta];
                const rec = league.results[selWeek]?.[matchKey(selWeek, tlow, thigh)];
                if (rec) {
                  weekTotals[tlow]  = computeTeamTotal(rec, 0, tlow,  league.handicaps);
                  weekTotals[thigh] = computeTeamTotal(rec, 1, thigh, league.handicaps);
                }
              }
              return Object.entries(weekBonus).sort((a, b) => b[1] - a[1]).map(([tid, bp]) => (
                <div key={tid} style={{
                  padding: "4px 9px", borderRadius: "6px", background: G + "18",
                  border: `1px solid ${G}33`, fontSize: "13px"
                }}>
                  <span style={{ color: G, fontWeight: 600 }}>+{bp}</span>
                  <span style={{ color: M, marginLeft: "4px" }}>{TEAMS[parseInt(tid)]?.name}</span>
                  {weekTotals[parseInt(tid)] != null && (
                    <span style={{ color: GOLD, marginLeft: "6px", fontWeight: 600 }}>{weekTotals[parseInt(tid)]}</span>
                  )}
                </div>
              ));
            })()}
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


      {/* Save */}
      {/* Auto-saves on score change */}

    </>)}

    <LostBallTimer />
  </div>
  );
}

export default ScoringScreen;
