import React, { useMemo, useState, useRef, useCallback } from "react";
import {
  PAR, SI, RAINOUT_SUB, ALL_PLAYERS, TEAMS, SCHEDULE, DEFAULT_HCP,
  isNewMember, PLAYOFF_START_WEEK,
} from "../constants/league";
import {
  stabPts, hcpStr, isWeekCancelled, buildGrossHistory, calcAutoHcp, getOpponent,
} from "../lib/leagueLogic";
import { G, GO, R, M, BG, CREAM, GOLD, CARD2, FD, FB } from "../constants/theme";
import { fmtDate } from "../lib/format";

// ── Palette extensions (derived, no new hues) ─────────────────────
const HOT  = GO;                // burnt orange — warmest existing accent
const COLD = "#1a6b8a";         // HSL(195,68%,32%) — hue-shifted from G
const BUCK = {
  eagle:  "#0a5028",
  birdie: G,
  par:    GOLD,
  bogey:  "#c07020",
  double: "#b03010",
  triple: R,
};
const BUCK_LABEL = { eagle:"Eagle", birdie:"Birdie", par:"Par", bogey:"Bogey", double:"Double", triple:"Triple+" };
const BUCK_ORDER = ["eagle","birdie","par","bogey","double","triple"];

// ── Helpers ────────────────────────────────────────────────────────
function normS(s) {
  if (!s) return [[], []];
  if (Array.isArray(s)) return s;
  return [s.p0 || [], s.p1 || []];
}
function arr_mean(a) { return a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0; }
function arr_std(a) {
  if (a.length < 2) return 0;
  const m = arr_mean(a);
  return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));
}
function holeBucket(gross, par, hcp, si) {
  if (!gross) return null;
  const str = hcpStr(hcp, si);
  const diff = par - (gross - str);          // positive = under par net
  if (diff >= 2) return "eagle";
  if (diff === 1) return "birdie";
  if (diff === 0) return "par";
  if (diff === -1) return "bogey";
  if (diff === -2) return "double";
  return "triple";
}

// ── Data: per-player per-round {week, stab, gross, hcp, holes[9]} ─
function buildPlayerRounds(results, handicaps) {
  const data = {};
  ALL_PLAYERS.forEach(p => { data[`${p.tid}-${p.pi}`] = []; });

  for (let w = 1; w < PLAYOFF_START_WEEK; w++) {
    const wRes = results[w] || {};
    if (isWeekCancelled(wRes)) continue;
    for (const [mk, rec] of Object.entries(wRes)) {
      if (!rec) continue;
      const pts = mk.split("-");
      const tlow = parseInt(pts[1]), thigh = parseInt(pts[2]);
      [[tlow, rec.t1scores, rec.t1types], [thigh, rec.t2scores, rec.t2types]].forEach(([tid, rawS, types]) => {
        const scores = normS(rawS);
        for (let pi = 0; pi < 2; pi++) {
          const type = (types || [])[pi] || "normal";
          if (type === "sub" || type === "phantom") continue;
          const snap = rec.hcpSnapshot;
          const hcp = snap ? (snap[tid] || [0,0])[pi] || 0 : (handicaps[tid] || [0,0])[pi] || 0;
          let gross = 0, stab = 0;
          const holes = Array(9).fill(null);
          for (let hi = 0; hi < 9; hi++) {
            const effHi = (rec.rainout && !((scores[pi] || [])[hi]) && RAINOUT_SUB[hi] != null)
              ? RAINOUT_SUB[hi] : hi;
            const g = (scores[pi] || [])[effHi] || 0;
            if (g > 0) {
              gross += g;
              stab  += stabPts(g, PAR[hi], hcpStr(hcp, SI[hi])) || 0;
              holes[hi] = g;
            }
          }
          if (gross > 0) data[`${tid}-${pi}`].push({ week: w, stab, gross, hcp, holes });
        }
      });
    }
  }
  for (const k of Object.keys(data)) data[k].sort((a,b)=>a.week-b.week);
  return data;
}

// ── Hot/Cold: z-score classification ──────────────────────────────
function computeHotCold(playerRounds) {
  const out = {};
  for (const [key, rounds] of Object.entries(playerRounds)) {
    const stabs   = rounds.map(r => r.stab);
    const spark   = stabs.slice(-8);
    const baseline = stabs.slice(-12);

    if (baseline.length < 6) {
      out[key] = { status: "insufficient", z: 0, tier: 0, spark, rounds: rounds.length };
      continue;
    }

    const recent  = stabs.slice(-4);
    if (!recent.length) { out[key] = { status: "neutral", z: 0, tier: 0, spark }; continue; }

    const bMean  = arr_mean(baseline);
    const bStd   = arr_std(baseline);
    const cMean  = arr_mean(recent);
    const z      = bStd < 0.01 ? 0 : (cMean - bMean) / bStd;

    // Hcp trend: recent 4 vs prior 4
    const recentH = rounds.slice(-4).map(r => r.hcp);
    const priorH  = rounds.slice(-8,-4).map(r => r.hcp);
    const hcpDelta = priorH.length ? arr_mean(recentH) - arr_mean(priorH) : 0;

    let status = "neutral", tier = 0;
    if (z >= 1.0 && hcpDelta <= 0.5) {
      status = "hot";
      tier = z >= 2.0 ? 3 : z >= 1.5 ? 2 : 1;
    } else if (z <= -1.0 && hcpDelta >= -0.5) {
      status = "cold";
      tier = Math.abs(z) >= 2.0 ? 3 : Math.abs(z) >= 1.5 ? 2 : 1;
    }
    out[key] = { status, tier, z, bMean, bStd, cMean, hcpDelta, spark, rounds: rounds.length };
  }
  return out;
}

// ── Per-player per-hole bucket stats ──────────────────────────────
function buildHoleStats(playerRounds, tid, pi) {
  const holes = Array.from({length:9}, ()=>({n:0,stab:0,eagle:0,birdie:0,par:0,bogey:0,double:0,triple:0}));
  for (const r of (playerRounds[`${tid}-${pi}`] || [])) {
    for (let hi = 0; hi < 9; hi++) {
      const g = r.holes[hi];
      if (!g) continue;
      const b = holeBucket(g, PAR[hi], r.hcp, SI[hi]);
      if (!b) continue;
      holes[hi].n++;
      holes[hi].stab += stabPts(g, PAR[hi], hcpStr(r.hcp, SI[hi])) || 0;
      holes[hi][b]++;
    }
  }
  return holes.map((h,i) => ({ ...h, hi: i, avgStab: h.n ? +(h.stab/h.n).toFixed(1) : null }));
}

// Build historical hcp trajectory [{round#, hcp}]
function buildHcpHistory(results, tid, pi, handicaps) {
  const grossRounds = buildGrossHistory(results, PLAYOFF_START_WEEK, handicaps)[tid]?.[pi] || [];
  const startHcp = (handicaps[tid] || [0,0])[pi] || 0;
  const isNew = isNewMember(tid, pi);
  return grossRounds.map((_, i) => ({
    i,
    hcp: calcAutoHcp(grossRounds.slice(0, i+1), startHcp, isNew),
  }));
}

// ── Small display components ───────────────────────────────────────
function Sparkline({ data = [], width = 80, height = 24, color = CREAM, fillColor }) {
  if (data.length < 2) return <span style={{display:"inline-block",width,height}} />;
  const min = Math.min(...data), max = Math.max(...data);
  const rng = max - min || 1;
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * (width - 2) + 1,
    (height - 3) - ((v - min) / rng) * (height - 6) + 1,
  ]);
  const polyPts = pts.map(p => p.map(v=>v.toFixed(1)).join(",")).join(" ");
  return (
    <svg width={width} height={height} style={{verticalAlign:"middle",display:"inline-block"}}>
      {fillColor && (
        <polygon
          points={`1,${height} ${polyPts} ${(width-1).toFixed(1)},${height}`}
          fill={fillColor}
          opacity="0.18"
        />
      )}
      <polyline points={polyPts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* Last dot */}
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={color} />
    </svg>
  );
}

function HotBadge({ status, tier, size = "sm" }) {
  if (status === "neutral" || status === "insufficient") return null;
  const emojis = status === "hot" ? ["🔥","🔥🔥","🔥🔥🔥"] : ["❄️","❄️❄️","❄️❄️❄️"];
  const fs = size === "lg" ? "24px" : "14px";
  return <span style={{fontSize:fs, lineHeight:1}}>{emojis[Math.max(0,tier-1)]}</span>;
}

function HcpArrow({ delta }) {
  if (Math.abs(delta) < 0.5) return <span style={{color:GOLD,fontWeight:700}}>→</span>;
  return delta < 0
    ? <span style={{color:G,fontWeight:700}}>↓</span>
    : <span style={{color:R,fontWeight:700}}>↑</span>;
}

function BucketBar({ holeStats, compact = false }) {
  const totals = { eagle:0, birdie:0, par:0, bogey:0, double:0, triple:0 };
  let total = 0;
  for (const h of holeStats) {
    for (const b of BUCK_ORDER) { totals[b] += h[b]; total += h[b]; }
  }
  if (!total) return <span style={{color:M,fontSize:"12px"}}>No data</span>;
  const h = compact ? 16 : 22;
  return (
    <div>
      <div style={{display:"flex",height:h,borderRadius:"5px",overflow:"hidden"}}>
        {BUCK_ORDER.map(b => {
          const w = totals[b] / total;
          if (w === 0) return null;
          return (
            <div key={b} style={{width:`${w*100}%`,background:BUCK[b],
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {w >= 0.1 && <span style={{fontSize:"9px",color:"rgba(255,255,255,0.9)",fontWeight:700}}>
                {Math.round(w*100)}%
              </span>}
            </div>
          );
        })}
      </div>
      {!compact && (
        <div style={{display:"flex",gap:"6px",marginTop:"4px",flexWrap:"wrap"}}>
          {BUCK_ORDER.filter(b=>totals[b]>0).map(b=>(
            <span key={b} style={{fontSize:"10px",color:BUCK[b],fontWeight:600}}>
              {totals[b]} {BUCK_LABEL[b].toLowerCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function HoleHeatmap({ rounds }) {
  // rows = rounds (latest first), cols = H1-H9
  const recent = [...rounds].reverse().slice(0, 14);
  if (!recent.length) return <div style={{color:M,fontSize:"12px"}}>No rounds yet.</div>;
  return (
    <div style={{overflowX:"auto"}}>
      <div style={{display:"grid",gridTemplateColumns:"auto repeat(9,1fr)",gap:"2px",minWidth:"280px"}}>
        {/* Header */}
        <div style={{fontSize:"9px",color:M}} />
        {Array.from({length:9},(_,i)=>(
          <div key={i} style={{textAlign:"center",fontSize:"9px",color:M,fontWeight:600}}>H{i+1}</div>
        ))}
        {/* Rows */}
        {recent.map((r, ri) => (
          <React.Fragment key={ri}>
            <div style={{fontSize:"9px",color:M,paddingRight:"4px",whiteSpace:"nowrap",display:"flex",alignItems:"center"}}>
              W{r.week}
            </div>
            {Array.from({length:9},(_,hi)=>{
              const g = r.holes[hi];
              const b = g ? holeBucket(g, PAR[hi], r.hcp, SI[hi]) : null;
              return (
                <div key={hi} style={{
                  height:"18px",borderRadius:"3px",
                  background: b ? BUCK[b] : "#e0ddd8",
                  opacity: b ? 1 : 0.4,
                  display:"flex",alignItems:"center",justifyContent:"center",
                }} title={g ? `H${hi+1}: ${g}` : "—"}>
                  {g ? <span style={{fontSize:"8px",color:"rgba(255,255,255,0.85)",fontWeight:700}}>{g}</span> : null}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function LineChart({ points, width = 240, height = 60, color = G }) {
  if (points.length < 2) return null;
  const ys = points.map(p=>p.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const rng = max - min || 1;
  const mkPt = (p, i) => [
    (i / (points.length-1)) * (width-4) + 2,
    (height-6) - ((p.y-min)/rng)*(height-12) + 3,
  ];
  const mapped = points.map((p,i)=>mkPt(p,i));
  const polyPts = mapped.map(p=>p.map(v=>v.toFixed(1)).join(",")).join(" ");
  return (
    <svg width={width} height={height} style={{display:"block"}}>
      <polyline points={polyPts} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {mapped.map((p,i)=>(
        <circle key={i} cx={p[0]} cy={p[1]} r="3" fill={color} />
      ))}
      {/* y-axis labels */}
      <text x="2" y="10" fontSize="8" fill={M}>{max}</text>
      <text x="2" y={height-2} fontSize="8" fill={M}>{min}</text>
    </svg>
  );
}

// ── Bottom Sheet ───────────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }) {
  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",
        zIndex:200,opacity:open?1:0,pointerEvents:open?"auto":"none",
        transition:"opacity 0.25s",
      }} />
      <div style={{
        position:"fixed",bottom:0,left:0,right:0,maxHeight:"88vh",
        background:BG,borderRadius:"20px 20px 0 0",zIndex:201,
        transform:open?"translateY(0)":"translateY(100%)",
        transition:"transform 0.32s cubic-bezier(0.4,0,0.2,1)",
        overflowY:"auto",paddingBottom:"64px",
      }}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}>
          <div style={{width:"40px",height:"4px",background:GOLD+"55",borderRadius:"2px"}} />
        </div>
        <div style={{padding:"4px 16px 16px"}}>
          {title && (
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px"}}>
              <div style={{fontFamily:FD,fontSize:"22px",fontWeight:600,color:CREAM}}>{title}</div>
              <button onClick={onClose} style={{
                background:"none",border:"none",color:M,fontSize:"22px",cursor:"pointer",padding:"0 0 0 12px",lineHeight:1
              }}>×</button>
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
}

// ── Player Detail Sheet ────────────────────────────────────────────
function PlayerDetailSheet({ pKey, playerRounds, hotcold, onClose, onNav, allKeys, league }) {
  const idx = allKeys.indexOf(pKey);
  const [tid, pi] = pKey.split("-").map(Number);
  const team = TEAMS[tid];
  const playerName = pi === 0 ? team?.p1 : team?.p2;
  const rounds = playerRounds[pKey] || [];
  const hc = hotcold[pKey] || { status:"neutral", z:0, tier:0 };

  const holeStats = useMemo(() => buildHoleStats(playerRounds, tid, pi), [pKey]);
  const hcpHistory = useMemo(() => buildHcpHistory(league.results, tid, pi, league.handicaps), [pKey]);

  const currentHcp = rounds.length ? rounds[rounds.length-1].hcp : (league.handicaps[tid]||[0,0])[pi];
  const avgStab = rounds.length ? +(arr_mean(rounds.map(r=>r.stab))).toFixed(1) : null;

  const statusColor = hc.status==="hot" ? HOT : hc.status==="cold" ? COLD : M;
  const statusBg    = hc.status==="hot" ? HOT+"18" : hc.status==="cold" ? COLD+"18" : "transparent";

  return (
    <div>
      {/* Nav arrows */}
      {allKeys.length > 1 && (
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"12px"}}>
          <button onClick={()=>onNav(allKeys[(idx-1+allKeys.length)%allKeys.length])}
            style={{background:"none",border:`1px solid ${GOLD}44`,borderRadius:"8px",
              padding:"4px 12px",color:M,fontSize:"13px",cursor:"pointer",fontFamily:FB}}>
            ← Prev
          </button>
          <span style={{fontSize:"12px",color:M,alignSelf:"center"}}>{idx+1} / {allKeys.length}</span>
          <button onClick={()=>onNav(allKeys[(idx+1)%allKeys.length])}
            style={{background:"none",border:`1px solid ${GOLD}44`,borderRadius:"8px",
              padding:"4px 12px",color:M,fontSize:"13px",cursor:"pointer",fontFamily:FB}}>
            Next →
          </button>
        </div>
      )}

      {/* Hero */}
      <div style={{background:statusBg,border:`1px solid ${statusColor}44`,borderRadius:"14px",
        padding:"14px 16px",marginBottom:"14px",display:"flex",alignItems:"center",gap:"12px"}}>
        <div style={{flex:1}}>
          <div style={{fontFamily:FD,fontSize:"20px",fontWeight:700,color:CREAM,display:"flex",alignItems:"center",gap:"8px"}}>
            {playerName}
            <HotBadge status={hc.status} tier={hc.tier} />
          </div>
          <div style={{fontSize:"12px",color:M,marginTop:"2px"}}>{team?.name}</div>
          <div style={{display:"flex",gap:"14px",marginTop:"8px",flexWrap:"wrap"}}>
            <div>
              <div style={{fontSize:"10px",color:M,textTransform:"uppercase",letterSpacing:"0.07em"}}>HCP</div>
              <div style={{fontSize:"18px",fontWeight:700,color:CREAM}}>
                {currentHcp} <HcpArrow delta={hc.hcpDelta ?? 0} />
              </div>
            </div>
            <div>
              <div style={{fontSize:"10px",color:M,textTransform:"uppercase",letterSpacing:"0.07em"}}>Rounds</div>
              <div style={{fontSize:"18px",fontWeight:700,color:CREAM}}>{rounds.length}</div>
            </div>
            <div>
              <div style={{fontSize:"10px",color:M,textTransform:"uppercase",letterSpacing:"0.07em"}}>Avg Pts</div>
              <div style={{fontSize:"18px",fontWeight:700,color:G}}>{avgStab ?? "—"}</div>
            </div>
          </div>
        </div>
        {hc.spark.length >= 2 && (
          <div style={{flexShrink:0}}>
            <Sparkline data={hc.spark} width={88} height={36}
              color={statusColor} fillColor={statusColor} />
            <div style={{fontSize:"9px",color:M,textAlign:"center",marginTop:"2px"}}>last {hc.spark.length} rounds</div>
          </div>
        )}
      </div>

      {/* Z-score detail (long-press style — always shown in this sheet) */}
      {hc.status !== "insufficient" && hc.bStd !== undefined && (
        <div style={{background:CARD2,border:`1px solid ${GOLD}22`,borderRadius:"10px",
          padding:"10px 14px",marginBottom:"14px",display:"flex",gap:"16px",flexWrap:"wrap"}}>
          <Stat label="Z-Score" val={hc.z>=0?`+${hc.z.toFixed(2)}`:`${hc.z.toFixed(2)}`}
            color={hc.z>=1?HOT:hc.z<=-1?COLD:M} />
          <Stat label="Baseline Mean" val={hc.bMean?.toFixed(1)} />
          <Stat label="Baseline σ" val={hc.bStd?.toFixed(2)} />
          <Stat label="Recent Mean (4w)" val={hc.cMean?.toFixed(1)}
            color={hc.cMean > hc.bMean ? G : hc.cMean < hc.bMean ? R : M} />
          {hc.status==="insufficient" && (
            <div style={{fontSize:"11px",color:M,fontStyle:"italic"}}>
              Need 6+ rounds for baseline.
            </div>
          )}
        </div>
      )}

      {/* Bucket distribution */}
      <SectionLabel>Scoring Distribution</SectionLabel>
      <div style={{marginBottom:"16px"}}>
        <BucketBar holeStats={holeStats} />
      </div>

      {/* Hcp history chart */}
      {hcpHistory.length >= 2 && (
        <>
          <SectionLabel>Handicap Trend</SectionLabel>
          <div style={{background:CARD2,border:`1px solid ${GOLD}22`,borderRadius:"10px",
            padding:"10px 12px",marginBottom:"16px",display:"flex",alignItems:"center",gap:"10px"}}>
            <LineChart
              points={hcpHistory.map(h=>({y:h.hcp}))}
              width={Math.min(280, hcpHistory.length * 22 + 10)}
              height={56}
              color={G}
            />
            <div style={{fontSize:"11px",color:M}}>
              {hcpHistory[0].hcp} → {hcpHistory[hcpHistory.length-1].hcp}
            </div>
          </div>
        </>
      )}

      {/* 9-hole heatmap */}
      <SectionLabel>Round × Hole Heatmap</SectionLabel>
      <div style={{background:CARD2,border:`1px solid ${GOLD}22`,borderRadius:"10px",
        padding:"10px 12px",marginBottom:"16px"}}>
        <HoleHeatmap rounds={rounds} />
      </div>

      {/* Per-hole averages */}
      <SectionLabel>Per-Hole Averages</SectionLabel>
      <div style={{background:CARD2,border:`1px solid ${GOLD}22`,borderRadius:"10px",
        overflow:"hidden",marginBottom:"16px"}}>
        <div style={{display:"flex",borderBottom:`1px solid ${GOLD}22`}}>
          {holeStats.map(h=>(
            <div key={h.hi} style={{flex:1,padding:"6px 2px",textAlign:"center"}}>
              <div style={{fontSize:"9px",color:M,fontWeight:600}}>H{h.hi+1}</div>
              <div style={{fontSize:"11px",color:M}}>P{PAR[h.hi]}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex"}}>
          {holeStats.map(h=>{
            const diff = h.avgStab != null ? h.avgStab - 1 : null; // net par = 1pt baseline
            const c = h.avgStab == null ? M : h.avgStab >= 2 ? G : h.avgStab >= 1 ? GOLD : R;
            return (
              <div key={h.hi} style={{flex:1,padding:"6px 2px",textAlign:"center",
                background:h.avgStab!=null ? (h.avgStab>=2?G:h.avgStab>=1?GOLD:R)+"12" : "transparent"}}>
                <div style={{fontSize:"13px",fontWeight:700,color:c}}>{h.avgStab ?? "—"}</div>
                <div style={{fontSize:"9px",color:M}}>{h.n}r</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, val, color = CREAM }) {
  return (
    <div>
      <div style={{fontSize:"9px",color:M,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>{label}</div>
      <div style={{fontSize:"17px",fontWeight:700,color}}>{val ?? "—"}</div>
    </div>
  );
}
function SectionLabel({ children }) {
  return (
    <div style={{fontSize:"11px",color:M,textTransform:"uppercase",letterSpacing:"0.1em",
      fontWeight:600,marginBottom:"6px"}}>{children}</div>
  );
}

// ── Match Detail Sheet ─────────────────────────────────────────────
function MatchDetailSheet({ week, ta, tb, league, onClose }) {
  const [tlow, thigh] = ta < tb ? [ta, tb] : [tb, ta];
  const mk = `${week}-${tlow}-${thigh}`;
  const rec = league.results[week]?.[mk];
  const tA = TEAMS[tlow], tB = TEAMS[thigh];
  if (!rec) return <div style={{color:M,padding:"20px 0",textAlign:"center"}}>No scores recorded.</div>;

  const snap = rec.hcpSnapshot;
  return (
    <div>
      <div style={{fontSize:"13px",color:M,marginBottom:"14px"}}>{fmtDate(SCHEDULE[week]?.date)}</div>
      {[[tlow, tA, normS(rec.t1scores), rec.t1types], [thigh, tB, normS(rec.t2scores), rec.t2types]].map(([tid, team, scores, types]) => (
        <div key={tid} style={{marginBottom:"16px"}}>
          <div style={{fontFamily:FD,fontSize:"16px",fontWeight:600,color:CREAM,marginBottom:"6px"}}>{team?.name}</div>
          {[0,1].map(pi=>{
            const type = (types||[])[pi]||"normal";
            const name = pi===0 ? team?.p1 : team?.p2;
            const hcp = snap ? (snap[tid]||[0,0])[pi]||0 : (league.handicaps[tid]||[0,0])[pi]||0;
            return (
              <div key={pi} style={{marginBottom:"8px"}}>
                <div style={{fontSize:"12px",color:CREAM,fontWeight:600,marginBottom:"4px"}}>
                  {name} <span style={{color:M,fontWeight:400}}>· HCP {hcp}</span>
                  {type!=="normal"&&<span style={{color:GO,marginLeft:"8px",fontSize:"11px",textTransform:"uppercase"}}>{type}</span>}
                </div>
                {type==="normal" ? (
                  <div style={{display:"flex",gap:"3px"}}>
                    {Array.from({length:9},(_,hi)=>{
                      const g = (scores[pi]||[])[hi] || 0;
                      const b = g ? holeBucket(g, PAR[hi], hcp, SI[hi]) : null;
                      const pts = g ? stabPts(g, PAR[hi], hcpStr(hcp, SI[hi])) : null;
                      return (
                        <div key={hi} style={{
                          flex:1,background:b?BUCK[b]:"#e0ddd8",borderRadius:"4px",
                          padding:"4px 2px",textAlign:"center",opacity:g?1:0.35,
                        }} title={g?`H${hi+1}: gross ${g}, ${pts}pts`:""}>
                          <div style={{fontSize:"11px",fontWeight:700,color:"white"}}>{g||"—"}</div>
                          <div style={{fontSize:"8px",color:"rgba(255,255,255,0.8)"}}>H{hi+1}</div>
                          {pts!=null&&<div style={{fontSize:"8px",color:"rgba(255,255,255,0.75)"}}>{pts}p</div>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{fontSize:"12px",color:M,padding:"4px 0"}}>
                    {type==="sub"?"6 pts (substitute)":"2 pts (phantom)"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Hot/Cold player card ───────────────────────────────────────────
function PlayerCard({ pKey, playerRounds, hotcold, onClick }) {
  const [tid, pi] = pKey.split("-").map(Number);
  const team = TEAMS[tid];
  const name = pi===0 ? team?.p1 : team?.p2;
  const hc = hotcold[pKey] || { status:"neutral", z:0, tier:0, spark:[] };
  const rounds = playerRounds[pKey] || [];
  const currentHcp = rounds.length ? rounds[rounds.length-1].hcp : "—";

  const statusColor = hc.status==="hot" ? HOT : hc.status==="cold" ? COLD : M;
  const glow = hc.status==="hot"
    ? `0 0 12px ${HOT}55`
    : hc.status==="cold"
    ? `0 0 12px ${COLD}55`
    : "none";

  return (
    <div onClick={onClick} style={{
      background:CARD2,border:`1px solid ${statusColor}${hc.status==="neutral"?"22":"55"}`,
      borderRadius:"12px",padding:"12px 14px",cursor:"pointer",
      boxShadow:glow,display:"flex",alignItems:"center",gap:"10px",
      transition:"box-shadow 0.2s, border-color 0.2s",
    }}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
          <span style={{fontSize:"14px",fontWeight:600,color:CREAM,whiteSpace:"nowrap"}}>{name}</span>
          <HotBadge status={hc.status} tier={hc.tier} />
        </div>
        <div style={{fontSize:"11px",color:M,marginTop:"1px"}}>{team?.name}</div>
        <div style={{display:"flex",gap:"8px",marginTop:"5px",alignItems:"center"}}>
          <span style={{fontSize:"11px",color:M}}>HCP {currentHcp}</span>
          {typeof hc.hcpDelta==="number" && <HcpArrow delta={hc.hcpDelta} />}
          {rounds.length>0&&(
            <span style={{fontSize:"11px",color:M}}>{rounds.length}r</span>
          )}
        </div>
      </div>
      {hc.spark.length >= 2 && (
        <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"3px"}}>
          <Sparkline data={hc.spark} width={72} height={28} color={statusColor} />
          {hc.status!=="neutral"&&hc.status!=="insufficient"&&(
            <span style={{fontSize:"9px",color:statusColor,fontWeight:700}}>
              {hc.z>=0?"+":""}{hc.z.toFixed(1)}σ
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Views ──────────────────────────────────────────────────────────

function LeaguePulseView({ playerRounds, hotcold, timeframe, setTimeframe, league, onPlayerClick }) {
  const ranked = useMemo(() => {
    const keys = ALL_PLAYERS.map(p=>`${p.tid}-${p.pi}`)
      .filter(k => hotcold[k]?.status !== "insufficient");
    return {
      hot:  [...keys].filter(k=>hotcold[k]?.status==="hot").sort((a,b)=>(hotcold[b]?.z??0)-(hotcold[a]?.z??0)).slice(0,3),
      cold: [...keys].filter(k=>hotcold[k]?.status==="cold").sort((a,b)=>(hotcold[a]?.z??0)-(hotcold[b]?.z??0)).slice(0,3),
    };
  }, [hotcold]);

  // Recent matches — last 2 weeks with results
  const recentWeeks = useMemo(() => {
    const weeks = [];
    for (let w = 17; w >= 1 && weeks.length < (timeframe==="week"?1:timeframe==="4w"?4:4); w--) {
      const wr = league.results[w];
      if (wr && Object.keys(wr).length > 0 && !isWeekCancelled(wr)) weeks.push(w);
    }
    return weeks;
  }, [league.results, timeframe]);

  return (
    <div>
      {/* Timeframe chips */}
      <div style={{display:"flex",gap:"6px",marginBottom:"20px"}}>
        {[["week","This Week"],["4w","Last 4 Weeks"],["season","Season"]].map(([v,l])=>(
          <button key={v} onClick={()=>setTimeframe(v)} style={{
            padding:"5px 12px",borderRadius:"20px",fontFamily:FB,fontSize:"12px",
            letterSpacing:"0.06em",cursor:"pointer",border:"none",
            background:timeframe===v?CREAM:CARD2,
            color:timeframe===v?BG:M,
            fontWeight:timeframe===v?700:400,
          }}>{l}</button>
        ))}
      </div>

      {/* Hot / Cold side by side */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"20px"}}>
        {[{label:"🔥 Heating Up",list:ranked.hot,color:HOT},{label:"❄️ Cooling Down",list:ranked.cold,color:COLD}].map(({label,list,color})=>(
          <div key={label}>
            <div style={{fontSize:"12px",fontWeight:700,color,letterSpacing:"0.06em",
              textTransform:"uppercase",marginBottom:"8px"}}>{label}</div>
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {list.length === 0 && (
                <div style={{fontSize:"12px",color:M,padding:"8px 0"}}>None this period.</div>
              )}
              {list.map(k=>(
                <PlayerCard key={k} pKey={k} playerRounds={playerRounds} hotcold={hotcold}
                  onClick={()=>onPlayerClick(k)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Recent match results */}
      <div style={{fontSize:"11px",color:M,textTransform:"uppercase",letterSpacing:"0.1em",
        fontWeight:600,marginBottom:"8px"}}>Recent Results</div>
      {recentWeeks.map(w=>(
        <WeekSummary key={w} week={w} league={league} />
      ))}
      {recentWeeks.length === 0 && (
        <div style={{color:M,fontSize:"13px",padding:"20px 0",textAlign:"center"}}>
          No results yet.
        </div>
      )}
    </div>
  );
}

function WeekSummary({ week, league }) {
  const wr = league.results[week] || {};
  const matches = Object.entries(wr).filter(([,r])=>r).slice(0,4); // show first 4
  return (
    <div style={{background:CARD2,border:`1px solid ${GOLD}22`,borderRadius:"12px",
      padding:"10px 14px",marginBottom:"8px"}}>
      <div style={{fontFamily:FD,fontSize:"15px",fontWeight:600,color:CREAM,marginBottom:"6px"}}>
        Week {week} <span style={{fontSize:"12px",fontWeight:400,color:M}}>— {fmtDate(SCHEDULE[week]?.date)}</span>
      </div>
      {matches.map(([mk,rec])=>{
        const pts = mk.split("-");
        const tlow=parseInt(pts[1]),thigh=parseInt(pts[2]);
        const tA=TEAMS[tlow],tB=TEAMS[thigh];
        let totA=0,totB=0;
        for(let tIdx=0;tIdx<2;tIdx++){
          const tid=tIdx===0?tlow:thigh;
          const scores=normS(tIdx===0?rec.t1scores:rec.t2scores);
          const types=tIdx===0?rec.t1types:rec.t2types;
          const snap=rec.hcpSnapshot;
          for(let pi=0;pi<2;pi++){
            const type=(types||[])[pi]||"normal";
            if(type==="sub"){tIdx===0?totA+=6:totB+=6;continue;}
            if(type==="phantom"){tIdx===0?totA+=2:totB+=2;continue;}
            const hcp=snap?(snap[tid]||[0,0])[pi]||0:(league.handicaps[tid]||[0,0])[pi]||0;
            for(let hi=0;hi<9;hi++){
              const g=(scores[pi]||[])[hi]||0;
              if(g>0) tIdx===0?(totA+=stabPts(g,PAR[hi],hcpStr(hcp,SI[hi]))||0):(totB+=stabPts(g,PAR[hi],hcpStr(hcp,SI[hi]))||0);
            }
          }
        }
        const winner = totA>totB?tlow:totB>totA?thigh:null;
        return (
          <div key={mk} style={{display:"flex",alignItems:"center",gap:"8px",
            padding:"4px 0",borderBottom:`1px solid ${GOLD}11`}}>
            <span style={{flex:1,fontSize:"12px",color:winner===tlow?CREAM:M,fontWeight:winner===tlow?600:400,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tA?.name}</span>
            <span style={{fontSize:"13px",fontWeight:700,color:totA>totB?G:R,flexShrink:0}}>{totA}</span>
            <span style={{fontSize:"11px",color:M,flexShrink:0}}>vs</span>
            <span style={{fontSize:"13px",fontWeight:700,color:totB>totA?G:R,flexShrink:0}}>{totB}</span>
            <span style={{flex:1,fontSize:"12px",color:winner===thigh?CREAM:M,fontWeight:winner===thigh?600:400,textAlign:"right",minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tB?.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function PlayersListView({ playerRounds, hotcold, onPlayerClick }) {
  const [filter, setFilter] = useState("all"); // all | hot | cold
  const keys = useMemo(() => {
    let list = ALL_PLAYERS.map(p=>`${p.tid}-${p.pi}`);
    if (filter==="hot")  list = list.filter(k=>hotcold[k]?.status==="hot");
    if (filter==="cold") list = list.filter(k=>hotcold[k]?.status==="cold");
    return list.sort((a,b)=>(hotcold[b]?.z??0)-(hotcold[a]?.z??0));
  }, [hotcold, filter]);

  return (
    <div>
      <div style={{display:"flex",gap:"6px",marginBottom:"14px"}}>
        {[["all","All"],["hot","🔥 Hot"],["cold","❄️ Cold"]].map(([v,l])=>(
          <button key={v} onClick={()=>setFilter(v)} style={{
            padding:"5px 12px",borderRadius:"20px",fontFamily:FB,fontSize:"12px",
            cursor:"pointer",border:"none",
            background:filter===v?CREAM:CARD2,
            color:filter===v?BG:M,fontWeight:filter===v?700:400,
          }}>{l}</button>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
        {keys.map(k=>(
          <PlayerCard key={k} pKey={k} playerRounds={playerRounds} hotcold={hotcold}
            onClick={()=>onPlayerClick(k)} />
        ))}
        {keys.length===0&&<div style={{color:M,fontSize:"13px",padding:"20px 0",textAlign:"center"}}>No players match filter.</div>}
      </div>
    </div>
  );
}

function MatchesListView({ league, onMatchClick }) {
  const weeks = useMemo(()=>{
    const out=[];
    for(let w=17;w>=1;w--){
      const wr=league.results[w]||{};
      if(Object.keys(wr).length>0&&!isWeekCancelled(wr)) out.push(w);
    }
    return out;
  },[league.results]);

  return (
    <div>
      {weeks.map(w=>{
        const wr = league.results[w]||{};
        return (
          <div key={w} style={{marginBottom:"14px"}}>
            <div style={{fontFamily:FD,fontSize:"16px",fontWeight:600,color:CREAM,marginBottom:"6px"}}>
              Week {w} <span style={{fontSize:"12px",fontWeight:400,color:M}}>— {fmtDate(SCHEDULE[w]?.date)}</span>
            </div>
            {Object.entries(wr).filter(([,r])=>r).map(([mk])=>{
              const pts=mk.split("-");
              const tlow=parseInt(pts[1]),thigh=parseInt(pts[2]);
              return (
                <div key={mk} onClick={()=>onMatchClick(w,tlow,thigh)}
                  style={{background:CARD2,border:`1px solid ${GOLD}22`,borderRadius:"10px",
                    padding:"10px 14px",marginBottom:"4px",cursor:"pointer",
                    display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <span style={{fontSize:"13px",color:CREAM}}>{TEAMS[tlow]?.name}</span>
                  <span style={{fontSize:"11px",color:M}}>vs</span>
                  <span style={{fontSize:"13px",color:CREAM}}>{TEAMS[thigh]?.name}</span>
                  <span style={{fontSize:"11px",color:GOLD}}>›</span>
                </div>
              );
            })}
          </div>
        );
      })}
      {weeks.length===0&&<div style={{color:M,fontSize:"13px",padding:"20px 0",textAlign:"center"}}>No results yet.</div>}
    </div>
  );
}

function TeamsView({ playerRounds, hotcold, onPlayerClick }) {
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:"10px"}}>
      {Object.entries(TEAMS).map(([tidStr, team])=>{
        const tid = parseInt(tidStr);
        return (
          <div key={tid} style={{background:CARD2,border:`1px solid ${GOLD}22`,borderRadius:"12px",padding:"12px 14px"}}>
            <div style={{fontFamily:FD,fontSize:"15px",fontWeight:600,color:CREAM,marginBottom:"8px"}}>
              {team.name}
            </div>
            {[0,1].map(pi=>{
              const k=`${tid}-${pi}`;
              const name=pi===0?team.p1:team.p2;
              const hc=hotcold[k]||{status:"neutral",z:0,tier:0,spark:[]};
              const rounds=(playerRounds[k]||[]);
              const hcp=rounds.length?rounds[rounds.length-1].hcp:"—";
              const statusColor=hc.status==="hot"?HOT:hc.status==="cold"?COLD:M;
              return (
                <div key={pi} onClick={()=>onPlayerClick(k)}
                  style={{display:"flex",alignItems:"center",gap:"8px",
                    padding:"6px 8px",borderRadius:"8px",cursor:"pointer",
                    background:hc.status!=="neutral"?statusColor+"0f":"transparent",
                    marginBottom:"4px",}}>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                      <span style={{fontSize:"13px",fontWeight:600,color:CREAM}}>{name}</span>
                      <HotBadge status={hc.status} tier={hc.tier} />
                    </div>
                    <span style={{fontSize:"11px",color:M}}>HCP {hcp}</span>
                    {typeof hc.hcpDelta==="number"&&<span style={{marginLeft:"4px"}}><HcpArrow delta={hc.hcpDelta}/></span>}
                  </div>
                  {hc.spark.length>=2&&(
                    <Sparkline data={hc.spark} width={56} height={22} color={statusColor} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────
const VIEWS = [
  { key:"pulse",   label:"League Pulse" },
  { key:"players", label:"Players" },
  { key:"matches", label:"Matches" },
  { key:"teams",   label:"Teams" },
];

export default function PulseScreen({ league }) {
  const [view, setView]         = useState("pulse");
  const [timeframe, setTimeframe] = useState("season");
  const [sheetPlayer, setSheetPlayer] = useState(null);  // pKey or null
  const [sheetMatch, setSheetMatch]   = useState(null);  // {week,ta,tb} or null

  const playerRounds = useMemo(
    () => buildPlayerRounds(league.results, league.handicaps),
    [league.results, league.handicaps]
  );
  const hotcold = useMemo(
    () => computeHotCold(playerRounds),
    [playerRounds]
  );

  const allPlayerKeys = useMemo(() => ALL_PLAYERS.map(p=>`${p.tid}-${p.pi}`), []);

  const handlePlayerClick = useCallback((k) => setSheetPlayer(k), []);
  const handleMatchClick  = useCallback((w,ta,tb) => setSheetMatch({week:w,ta,tb}), []);

  return (
    <div style={{maxWidth:"900px",margin:"0 auto",padding:"22px 14px"}}>
      <div style={{fontFamily:FD,fontSize:"28px",fontWeight:600,color:CREAM,marginBottom:"2px"}}>
        League Pulse
      </div>
      <div style={{color:M,fontSize:"13px",marginBottom:"18px"}}>
        Hot/cold indicators · Sparklines · Hole analytics
      </div>

      {/* Sub-nav */}
      <div style={{display:"flex",gap:"0",borderBottom:`2px solid ${GOLD}22`,marginBottom:"20px",overflowX:"auto"}}>
        {VIEWS.map(v=>(
          <button key={v.key} onClick={()=>setView(v.key)} style={{
            padding:"8px 16px",background:"none",border:"none",
            borderBottom:view===v.key?`2px solid ${CREAM}`:"2px solid transparent",
            marginBottom:"-2px",fontFamily:FB,fontSize:"13px",letterSpacing:"0.06em",
            color:view===v.key?CREAM:M,cursor:"pointer",whiteSpace:"nowrap",
            fontWeight:view===v.key?700:400,
          }}>{v.label}</button>
        ))}
      </div>

      {view==="pulse" && (
        <LeaguePulseView
          playerRounds={playerRounds} hotcold={hotcold}
          timeframe={timeframe} setTimeframe={setTimeframe}
          league={league} onPlayerClick={handlePlayerClick}
        />
      )}
      {view==="players" && (
        <PlayersListView
          playerRounds={playerRounds} hotcold={hotcold}
          onPlayerClick={handlePlayerClick}
        />
      )}
      {view==="matches" && (
        <MatchesListView league={league} onMatchClick={handleMatchClick} />
      )}
      {view==="teams" && (
        <TeamsView playerRounds={playerRounds} hotcold={hotcold}
          onPlayerClick={handlePlayerClick} />
      )}

      {/* Player detail sheet */}
      <BottomSheet
        open={!!sheetPlayer}
        onClose={()=>setSheetPlayer(null)}
        title={sheetPlayer ? (() => {
          const [tid,pi]=sheetPlayer.split("-").map(Number);
          return pi===0?TEAMS[tid]?.p1:TEAMS[tid]?.p2;
        })() : ""}
      >
        {sheetPlayer && (
          <PlayerDetailSheet
            pKey={sheetPlayer}
            playerRounds={playerRounds}
            hotcold={hotcold}
            onClose={()=>setSheetPlayer(null)}
            onNav={setSheetPlayer}
            allKeys={allPlayerKeys}
            league={league}
          />
        )}
      </BottomSheet>

      {/* Match detail sheet */}
      <BottomSheet
        open={!!sheetMatch}
        onClose={()=>setSheetMatch(null)}
        title={sheetMatch ? `Week ${sheetMatch.week} — ${TEAMS[Math.min(sheetMatch.ta,sheetMatch.tb)]?.name} vs ${TEAMS[Math.max(sheetMatch.ta,sheetMatch.tb)]?.name}` : ""}
      >
        {sheetMatch && (
          <MatchDetailSheet
            week={sheetMatch.week} ta={sheetMatch.ta} tb={sheetMatch.tb}
            league={league} onClose={()=>setSheetMatch(null)}
          />
        )}
      </BottomSheet>
    </div>
  );
}
