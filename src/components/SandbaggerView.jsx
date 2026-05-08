// Sandbagger Index — half-joke, all-math.
import React, { useMemo, useState } from "react";
import { PAR, SI, RAINOUT_SUB, ALL_PLAYERS, TEAMS, SCHEDULE, PLAYOFF_START_WEEK } from "../constants/league";
import { stabPts, hcpStr, isWeekCancelled } from "../lib/leagueLogic";
import { G, GO, R, M, BG, CREAM, GOLD, CARD2, FD, FB } from "../constants/theme";
import { fmtDate } from "../lib/format";

// ── Constants ─────────────────────────────────────────────────────
const MIN_ROUNDS = 8;
const PAR_TOTAL  = PAR.reduce((s,v)=>s+v, 0); // 36

const TIERS = {
  insufficient: { label:"Gathering intel…",  emoji:"🔍", color:M,    bg:"transparent" },
  reproach:     { label:"Above Reproach",     emoji:"😇", color:G,    bg:G+"11"        },
  hmm:          { label:"Hmm…",              emoji:"🤔", color:GOLD, bg:GOLD+"0d"     },
  suspicious:   { label:"Suspicious",         emoji:"🕵️", color:GO,   bg:GO+"11"       },
  bandit:       { label:"Bandit",            emoji:"🥷", color:R,    bg:R+"11"        },
  godhand:      { label:"Hand of God",       emoji:"🎰", color:"#8b1a1a", bg:"#8b1a1a18" },
};

const SIG_LABELS = ["Δ vs HCP", "Consistency", "Win Rate", "Trend"];
const SIG_WEIGHTS = [40, 25, 20, 15];
const SIG_KEYS   = ["s1","s2","s3","s4"];
const SIG_EXPLAIN = [
  "Average strokes above handicap the player beats each round. Primary signal — sustained overperformance means the handicap isn't capturing their real ability.",
  "How reliably they overperform. Low variance in a consistently positive delta = suspicious. Erratic beats are luck; systematic ones are something else.",
  "Individual stableford win rate vs. the expected 50% that a fair handicap would produce. Above 50% is fine; well above 50% is telling.",
  "Match performance trending better while handicap holds flat or rises. The classic signature: improving player, stubborn handicap.",
];

// ── Helpers ────────────────────────────────────────────────────────
function normS(s) {
  if (!s) return [[], []];
  if (Array.isArray(s)) return s;
  return [s.p0 || [], s.p1 || []];
}
function aMean(a) { return a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0; }
function aStd(a) {
  if (a.length < 2) return 0;
  const m = aMean(a);
  return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));
}
function linSlope(ys) {
  const n = ys.length;
  if (n < 3) return 0;
  const xm = (n-1)/2, ym = aMean(ys);
  let num=0, den=0;
  ys.forEach((y,i) => { num+=(i-xm)*(y-ym); den+=(i-xm)**2; });
  return den===0 ? 0 : num/den;
}
function normSig(v, lo, hi) {
  return Math.max(0, Math.min(100, ((v-lo)/(hi-lo))*100));
}
function scoreColor(score) {
  if (score == null) return M;
  if (score < 41)   return G;
  if (score < 61)   return GOLD;
  if (score < 76)   return GO;
  return R;
}

// ── Data computation ───────────────────────────────────────────────
function buildSandbaggerData(results, handicaps) {
  const roundMap  = {};
  const winMap    = {}, playedMap = {};
  ALL_PLAYERS.forEach(p => {
    roundMap[`${p.tid}-${p.pi}`]  = [];
    winMap[`${p.tid}-${p.pi}`]    = 0;
    playedMap[`${p.tid}-${p.pi}`] = 0;
  });

  for (let w = 1; w < PLAYOFF_START_WEEK; w++) {
    const wRes = results[w] || {};
    if (isWeekCancelled(wRes)) continue;

    for (const [mk, rec] of Object.entries(wRes)) {
      if (!rec) continue;
      const pts  = mk.split("-");
      const tlow = parseInt(pts[1]), thigh = parseInt(pts[2]);
      const snap = rec.hcpSnapshot;
      const scA  = normS(rec.t1scores), scB = normS(rec.t2scores);
      const hcpA = snap?.[tlow]  || handicaps[tlow]  || [0,0];
      const hcpB = snap?.[thigh] || handicaps[thigh] || [0,0];

      // Compute per-player stab + gross (returns null for phantom, {stab,gross} for sub)
      const calc = (scores, types, hcpArr) => [0,1].map(pi => {
        const type = (types||[])[pi]||"normal";
        if (type === "phantom") return null;
        if (type === "sub") return { stab:6, gross:null, hcp:hcpArr[pi]||0 };
        const hcp = hcpArr[pi]||0;
        let gross=0, stab=0;
        const holes = Array(9).fill(null);
        for (let hi=0; hi<9; hi++) {
          const effHi = (rec.rainout && !((scores[pi]||[])[hi]) && RAINOUT_SUB[hi]!=null)
            ? RAINOUT_SUB[hi] : hi;
          const g = (scores[pi]||[])[effHi]||0;
          if (g>0) {
            gross+=g;
            stab+=stabPts(g,PAR[hi],hcpStr(hcp,SI[hi]))||0;
            holes[hi]=g;
          }
        }
        return gross>0 ? { stab, gross, hcp, holes } : null;
      });

      const pA = calc(scA, rec.t1types, hcpA);
      const pB = calc(scB, rec.t2types, hcpB);

      // Append to round history (skip sub: gross is null)
      [[tlow,pA],[thigh,pB]].forEach(([tid,pArr])=>{
        for (let pi=0; pi<2; pi++) {
          const r = pArr[pi];
          if (!r || r.gross === null) continue;
          roundMap[`${tid}-${pi}`].push({ week:w, stab:r.stab, gross:r.gross, hcp:r.hcp, holes:r.holes });
        }
      });

      // Win/loss for lo-vs-lo / hi-vs-hi pairings
      const loA = hcpA[0] <= hcpA[1] ? 0 : 1;
      const loB = hcpB[0] <= hcpB[1] ? 0 : 1;
      for (const [piA,piB] of [[loA,loB],[1-loA,1-loB]]) {
        const rA = pA[piA], rB = pB[piB];
        if (!rA || !rB) continue;
        const kA=`${tlow}-${piA}`, kB=`${thigh}-${piB}`;
        playedMap[kA]++; playedMap[kB]++;
        if      (rA.stab > rB.stab) winMap[kA]++;
        else if (rB.stab > rA.stab) winMap[kB]++;
        else { winMap[kA]+=0.5; winMap[kB]+=0.5; }
      }
    }
  }

  // Sort rounds chronologically
  for (const k of Object.keys(roundMap)) roundMap[k].sort((a,b)=>a.week-b.week);

  // Compute index per player
  const index = {};
  for (const [key, rounds] of Object.entries(roundMap)) {
    if (rounds.length < MIN_ROUNDS) {
      index[key] = { tier:"insufficient", score:null, s1:0,s2:0,s3:0,s4:0, rounds:rounds.length };
      continue;
    }

    const deltas   = rounds.map(r => r.hcp + PAR_TOTAL - r.gross);
    const meanDelta = aMean(deltas);
    const stdDelta  = aStd(deltas);
    const stdGross  = aStd(rounds.map(r=>r.gross));

    // S1 — mean delta above zero, normalized 0→0  3.5→100
    const s1 = normSig(meanDelta, 0, 3.5);

    // S2 — consistent overperformance: high mean delta, low variance in delta
    //      adapted from "casual vs match variance" (not separable here)
    const consistency = Math.max(0, meanDelta) / (stdDelta + 0.4);
    const s2 = Math.max(
      normSig((stdGross/(stdDelta+0.4)) - 1.0, 0, 1.5),   // gross variance ≫ delta variance
      normSig(consistency - 1.0, 0, 4.0)                   // reliably beats hcp
    );

    // S3 — win rate > 50%
    const played   = playedMap[key]||0;
    const wins     = winMap[key]||0;
    const winRate  = played>0 ? wins/played : 0.5;
    const s3       = played >= 4
      ? normSig(Math.max(0, winRate-0.5), 0, 0.45)
      : 50; // neutral until sufficient matches

    // S4 — delta trend improving while hcp flat or rising
    const dSlope   = linSlope(deltas);
    const hSlope   = linSlope(rounds.map(r=>r.hcp));
    const stick    = dSlope>0 ? dSlope*(1+Math.max(0,hSlope*3)) : 0;
    const s4       = normSig(stick, 0, 0.4);

    const score = Math.round(0.40*s1 + 0.25*s2 + 0.20*s3 + 0.15*s4);
    const tier  = score>=90?"godhand":score>=76?"bandit":score>=61?"suspicious":score>=41?"hmm":"reproach";

    index[key] = {
      tier, score,
      s1:Math.round(s1), s2:Math.round(s2), s3:Math.round(s3), s4:Math.round(s4),
      meanDelta:+meanDelta.toFixed(2), stdDelta:+stdDelta.toFixed(2), stdGross:+stdGross.toFixed(2),
      winRate:+winRate.toFixed(3), played, wins:+wins.toFixed(1),
      dSlope:+dSlope.toFixed(3), hSlope:+hSlope.toFixed(3),
      rounds:rounds.length,
      roundData: rounds.map(r=>({
        week:r.week, gross:r.gross, hcp:r.hcp,
        delta:+(r.hcp+PAR_TOTAL-r.gross).toFixed(1),
        stab:r.stab,
      })),
    };
  }

  return { index };
}

// ── Small components ───────────────────────────────────────────────
function BottomSheet({ open, onClose, title, children }) {
  return (
    <>
      <div onClick={onClose} style={{
        position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:300,
        opacity:open?1:0,pointerEvents:open?"auto":"none",transition:"opacity 0.25s",
      }}/>
      <div style={{
        position:"fixed",bottom:0,left:0,right:0,maxHeight:"88vh",
        background:BG,borderRadius:"20px 20px 0 0",zIndex:301,
        transform:open?"translateY(0)":"translateY(100%)",
        transition:"transform 0.32s cubic-bezier(0.4,0,0.2,1)",
        overflowY:"auto",paddingBottom:"64px",
      }}>
        <div style={{display:"flex",justifyContent:"center",padding:"10px 0 4px"}}>
          <div style={{width:"40px",height:"4px",background:GOLD+"55",borderRadius:"2px"}}/>
        </div>
        <div style={{padding:"4px 16px 16px"}}>
          {title&&(
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px"}}>
              <div style={{fontFamily:FD,fontSize:"22px",fontWeight:600,color:CREAM}}>{title}</div>
              <button onClick={onClose} style={{background:"none",border:"none",color:M,fontSize:"22px",cursor:"pointer",padding:"0 0 0 12px"}}>×</button>
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
}

function ConfettiBurst() {
  const dots = [GO,G,GOLD,R,GO,G,GOLD,R];
  return (
    <>
      <style>{`@keyframes cfB{0%{transform:rotate(var(--r))translateX(18px)scale(1);opacity:.85}100%{transform:rotate(var(--r))translateX(26px)scale(.4);opacity:0}}`}</style>
      {dots.map((c,i)=>(
        <div key={i} style={{
          position:"absolute",width:"5px",height:"5px",
          background:c,borderRadius:i%2?"50%":"2px",
          top:"50%",left:"50%",marginTop:"-2.5px",marginLeft:"-2.5px",
          "--r":`${i*45}deg`,
          animation:`cfB 1.4s ease-out ${i*0.09}s infinite`,
          pointerEvents:"none",
        }}/>
      ))}
    </>
  );
}

function ScoreBadge({ score, tier, size="md" }) {
  const t = TIERS[tier]||TIERS.insufficient;
  const c = score!=null ? scoreColor(score) : M;
  const sz = size==="lg" ? 64 : 52;
  return (
    <div style={{
      width:sz,height:sz,borderRadius:"50%",flexShrink:0,
      display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
      background:score!=null?c+"18":"transparent",
      border:`2px solid ${score!=null?c:GOLD+"33"}`,
      position:"relative",overflow:"visible",
    }}>
      {tier==="godhand"&&<ConfettiBurst/>}
      {score!=null ? (
        <>
          <span style={{fontSize:size==="lg"?"22px":"17px",fontWeight:700,color:c,lineHeight:1}}>{score}</span>
          <span style={{fontSize:size==="lg"?"14px":"11px",lineHeight:1,marginTop:"1px"}}>{t.emoji}</span>
        </>
      ) : (
        <span style={{fontSize:"18px"}}>🔍</span>
      )}
    </div>
  );
}

function SigBar({ value, label }) {
  const c = value<40?G:value<61?GOLD:value<76?GO:R;
  return (
    <div>
      <div style={{fontSize:"8px",color:M,marginBottom:"2px",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{label}</div>
      <div style={{height:"6px",background:`${c}20`,borderRadius:"3px",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${value}%`,background:c,borderRadius:"3px",transition:"width 0.4s"}}/>
      </div>
      <div style={{fontSize:"9px",color:c,fontWeight:600,marginTop:"1px",textAlign:"right"}}>{value}</div>
    </div>
  );
}

function MiniSigStrip({ d }) {
  return (
    <div style={{display:"flex",gap:"6px",marginTop:"4px",flexWrap:"wrap"}}>
      {SIG_KEYS.map((sk,i)=>(
        <div key={sk} style={{display:"flex",alignItems:"center",gap:"3px"}}>
          <div style={{width:"26px",height:"5px",background:`${scoreColor(d[sk])}22`,borderRadius:"2px"}}>
            <div style={{height:"100%",width:`${d[sk]}%`,background:scoreColor(d[sk]),borderRadius:"2px",transition:"width 0.4s"}}/>
          </div>
          <span style={{fontSize:"8px",color:M}}>{SIG_LABELS[i].split(" ")[0]}</span>
        </div>
      ))}
    </div>
  );
}

// ── Player detail sheet content ────────────────────────────────────
function BanditReport({ pKey, index, allIndex }) {
  const [tid,pi] = pKey.split("-").map(Number);
  const team     = TEAMS[tid];
  const name     = pi===0?team?.p1:team?.p2;
  const d        = index[pKey];
  const t        = TIERS[d?.tier]||TIERS.insufficient;
  const [activeSig, setActiveSig] = useState(null);
  const [copied,    setCopied]    = useState(false);

  if (!d) return null;

  // Percentile
  const ranked      = Object.values(allIndex).filter(x=>x.score!=null).sort((a,b)=>b.score-a.score);
  const rank        = ranked.findIndex(x=>x===d)+1;
  const total       = ranked.length;
  const median      = ranked.length ? ranked[Math.floor(ranked.length/2)].score : 50;

  // Sorted exhibit: most suspicious first
  const exhibit = d.roundData ? [...d.roundData].sort((a,b)=>b.delta-a.delta) : [];

  async function share() {
    const txt = [
      `${t.emoji} BANDIT REPORT — ${name}`,
      `Sandbagger Index: ${d.score}/100 — ${t.label}`,
      `  Δ vs HCP: ${d.s1}  ·  Consistency: ${d.s2}  ·  Win Rate: ${d.s3}  ·  Trend: ${d.s4}`,
      `Avg beats HCP by ${d.meanDelta>0?"+":""}${d.meanDelta} strokes  ·  Win rate ${(d.winRate*100).toFixed(0)}%`,
      `PVGC 2026  —  For entertainment only. Probably.`,
    ].join("\n");
    if (navigator.share) {
      try { await navigator.share({text:txt}); return; } catch(_) {}
    }
    try { await navigator.clipboard.writeText(txt); } catch(_) {}
    setCopied(true);
    setTimeout(()=>setCopied(false), 2200);
  }

  return (
    <div>
      {/* Hero */}
      <div style={{display:"flex",gap:"14px",alignItems:"flex-start",marginBottom:"16px"}}>
        <ScoreBadge score={d.score} tier={d.tier} size="lg"/>
        <div style={{flex:1}}>
          <div style={{fontFamily:FD,fontSize:"20px",fontWeight:700,color:CREAM}}>{name}</div>
          <div style={{fontSize:"12px",color:M}}>{team?.name}</div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginTop:"6px",alignItems:"center"}}>
            <span style={{fontSize:"15px",color:t.color,fontWeight:700}}>{t.emoji} {t.label}</span>
            {d.score!=null&&total>0&&(
              <span style={{fontSize:"11px",color:M}}>#{rank} of {total} ranked</span>
            )}
          </div>
        </div>
        {d.score!=null&&(
          <button onClick={share} style={{
            padding:"6px 10px",border:`1px solid ${GOLD}44`,borderRadius:"8px",
            background:CARD2,color:M,fontSize:"11px",cursor:"pointer",
            fontFamily:FB,flexShrink:0,
          }}>
            {copied?"✓ Copied":"Share"}
          </button>
        )}
      </div>

      {d.tier==="insufficient"&&(
        <div style={{background:CARD2,border:`1px solid ${GOLD}22`,borderRadius:"10px",
          padding:"12px 14px",marginBottom:"14px",color:M,fontSize:"13px",lineHeight:1.5}}>
          Insufficient evidence — gathering intel…
          <br/><span style={{fontSize:"11px"}}>Requires {MIN_ROUNDS} match rounds. Currently {d.rounds}.</span>
        </div>
      )}

      {d.score!=null&&(
        <>
          {/* League comparison bar */}
          <div style={{background:CARD2,border:`1px solid ${GOLD}22`,borderRadius:"10px",
            padding:"10px 14px",marginBottom:"14px"}}>
            <div style={{fontSize:"10px",color:M,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"6px"}}>
              vs League Median
            </div>
            <div style={{position:"relative",height:"10px",background:`${M}1a`,borderRadius:"5px",overflow:"visible",marginBottom:"6px"}}>
              <div style={{position:"absolute",top:0,bottom:0,left:0,width:`${d.score}%`,
                background:scoreColor(d.score),borderRadius:"5px",opacity:.7,transition:"width 0.5s"}}/>
              <div style={{position:"absolute",top:"-4px",bottom:"-4px",width:"2px",
                background:GOLD,left:`${median}%`,borderRadius:"1px"}} title={`Median: ${median}`}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:"10px",color:M}}>
              <span>😇 0</span>
              <span style={{color:GOLD}}>Median {median}</span>
              <span>🎰 100</span>
            </div>
          </div>

          {/* 4 sub-signals */}
          <div style={{fontSize:"10px",color:M,textTransform:"uppercase",
            letterSpacing:"0.08em",marginBottom:"8px"}}>Evidence Breakdown</div>
          <div style={{display:"grid",gap:"6px",marginBottom:"14px"}}>
            {SIG_KEYS.map((sk,i)=>(
              <div key={sk} onClick={()=>setActiveSig(activeSig===i?null:i)}
                style={{background:CARD2,border:`1px solid ${scoreColor(d[sk])}33`,
                  borderRadius:"10px",padding:"10px 12px",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"4px"}}>
                  <span style={{fontSize:"12px",fontWeight:600,color:CREAM,flex:1}}>{SIG_LABELS[i]}</span>
                  <span style={{fontSize:"10px",color:M}}>×{SIG_WEIGHTS[i]}%</span>
                  <span style={{fontSize:"14px",fontWeight:700,color:scoreColor(d[sk])}}>{d[sk]}</span>
                  <span style={{fontSize:"11px",color:M}}>{activeSig===i?"▴":"▾"}</span>
                </div>
                <SigBar value={d[sk]} label=""/>
                {activeSig===i&&(
                  <div style={{marginTop:"8px",padding:"8px",background:`${M}08`,
                    borderRadius:"7px",fontSize:"12px",color:M,lineHeight:1.55}}>
                    {SIG_EXPLAIN[i]}
                    <div style={{marginTop:"6px",color:CREAM,fontWeight:600,fontSize:"12px"}}>
                      {sk==="s1"&&`Season avg: ${d.meanDelta>0?"+":""}${d.meanDelta} strokes vs HCP`}
                      {sk==="s2"&&`Gross σ ${d.stdGross} · Delta σ ${d.stdDelta} · Consistency score ${(Math.max(0,d.meanDelta)/(d.stdDelta+0.4)).toFixed(2)}`}
                      {sk==="s3"&&`${(d.winRate*100).toFixed(0)}% win rate  (${d.wins}W / ${d.played} matches)`}
                      {sk==="s4"&&`Delta slope ${d.dSlope>0?"+":""}${d.dSlope}  ·  HCP slope ${d.hSlope>0?"+":""}${d.hSlope}`}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Defense Exhibit */}
          <div style={{fontSize:"10px",color:M,textTransform:"uppercase",
            letterSpacing:"0.08em",marginBottom:"8px"}}>Defense Exhibit A: The Rounds</div>
          <div style={{display:"grid",gap:"3px",marginBottom:"8px"}}>
            {exhibit.map((r,i)=>{
              const susp = r.delta >= 1.5;
              return (
                <div key={i} style={{
                  display:"flex",alignItems:"center",gap:"8px",
                  padding:"6px 10px",borderRadius:"8px",
                  background:susp?R+"08":CARD2,
                  border:`1px solid ${susp?R+"33":GOLD+"22"}`,
                }}>
                  <span style={{width:"30px",fontSize:"11px",color:M,flexShrink:0}}>W{r.week}</span>
                  <span style={{width:"56px",fontSize:"12px",color:CREAM,textAlign:"center",flexShrink:0}}>{r.gross} gross</span>
                  <span style={{width:"42px",fontSize:"11px",color:M,textAlign:"center",flexShrink:0}}>HCP {r.hcp}</span>
                  <span style={{
                    marginLeft:"auto",fontSize:"12px",fontWeight:700,flexShrink:0,
                    color:r.delta>=1.5?R:r.delta>0?GO:G,
                  }}>
                    {r.delta>0?"+":""}{r.delta} Δ
                  </span>
                  <span style={{width:"34px",fontSize:"11px",color:M,textAlign:"right",flexShrink:0}}>{r.stab} pts</span>
                </div>
              );
            })}
          </div>
          <div style={{fontSize:"10px",color:M,fontStyle:"italic"}}>
            Sorted by how much the player beat their handicap (Δ). Red rows flagged.
          </div>
        </>
      )}
    </div>
  );
}

// ── Leaderboard row ────────────────────────────────────────────────
function BanditRow({ rank, pKey, d, onTap }) {
  const [tid,pi] = pKey.split("-").map(Number);
  const team     = TEAMS[tid];
  const name     = pi===0 ? team?.p1 : team?.p2;
  const t        = TIERS[d.tier]||TIERS.insufficient;
  const isClean  = d.tier==="reproach";
  const isGod    = d.tier==="godhand";

  return (
    <div onClick={()=>onTap(pKey)} style={{
      display:"flex",alignItems:"center",gap:"10px",
      padding:"10px 12px",borderRadius:"12px",
      marginBottom:"4px",cursor:"pointer",
      background: isClean ? G+"08" : isGod ? "#8b1a1a0a" : CARD2,
      border:`1px solid ${d.score!=null?scoreColor(d.score):GOLD}22`,
    }}>
      <span style={{width:"20px",flexShrink:0,fontSize:"12px",color:M,textAlign:"center",fontWeight:600}}>
        {d.score!=null?rank:"–"}
      </span>

      <ScoreBadge score={d.score} tier={d.tier}/>

      <div style={{flex:1,minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
          <span style={{fontSize:"13px",fontWeight:600,color:CREAM}}>{name}</span>
          {isClean&&(
            <span style={{fontSize:"9px",color:G,background:G+"15",border:`1px solid ${G}33`,
              borderRadius:"3px",padding:"1px 5px",letterSpacing:"0.06em"}}>Clean</span>
          )}
        </div>
        <div style={{fontSize:"11px",color:M}}>{team?.name}</div>
        {d.score!=null ? (
          <MiniSigStrip d={d}/>
        ) : (
          <div style={{fontSize:"10px",color:M,marginTop:"3px",fontStyle:"italic"}}>
            {d.rounds}/{MIN_ROUNDS} rounds
          </div>
        )}
      </div>

      <span style={{flexShrink:0,fontSize:"11px",color:M}}>›</span>
    </div>
  );
}

// ── Main view ──────────────────────────────────────────────────────
export default function SandbaggerView({ league }) {
  const [sheet, setSheet] = useState(null);

  const { index } = useMemo(
    () => buildSandbaggerData(league.results, league.handicaps),
    [league.results, league.handicaps]
  );

  const ranked = useMemo(() => {
    const withScore = ALL_PLAYERS
      .map(p => ({ key:`${p.tid}-${p.pi}`, d:index[`${p.tid}-${p.pi}`]||{tier:"insufficient",score:null,rounds:0} }))
      .filter(x => x.d.score != null)
      .sort((a,b) => b.d.score - a.d.score);
    const noScore = ALL_PLAYERS
      .map(p => ({ key:`${p.tid}-${p.pi}`, d:index[`${p.tid}-${p.pi}`]||{tier:"insufficient",score:null,rounds:0} }))
      .filter(x => x.d.score == null);
    return [...withScore, ...noScore];
  }, [index]);

  const indexed = ranked.filter(x=>x.d.score!=null);

  return (
    <div>
      {/* Disclaimer */}
      <div style={{background:GOLD+"0a",border:`1px solid ${GOLD}22`,borderRadius:"10px",
        padding:"8px 12px",marginBottom:"16px",fontSize:"12px",color:M,fontStyle:"italic",
        display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span>For entertainment only. Probably.</span>
        <span style={{fontSize:"11px"}}>{indexed.length} indexed · {MIN_ROUNDS}r minimum</span>
      </div>

      {/* Tier legend */}
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"14px"}}>
        {Object.entries(TIERS).filter(([k])=>k!=="insufficient").map(([k,t])=>(
          <span key={k} style={{fontSize:"11px",color:t.color,background:t.bg,
            border:`1px solid ${t.color}33`,borderRadius:"6px",padding:"2px 8px"}}>
            {t.emoji} {t.label}
          </span>
        ))}
      </div>

      {/* Leaderboard */}
      <div>
        {ranked.map((row,i)=>(
          <BanditRow
            key={row.key}
            rank={i+1}
            pKey={row.key}
            d={row.d}
            onTap={setSheet}
          />
        ))}
      </div>

      {/* Detail sheet */}
      <BottomSheet
        open={!!sheet}
        onClose={()=>setSheet(null)}
        title={sheet ? (()=>{
          const [tid,pi]=sheet.split("-").map(Number);
          const t=TEAMS[tid];
          return `${pi===0?t?.p1:t?.p2} — Bandit Report`;
        })() : ""}
      >
        {sheet && (
          <BanditReport pKey={sheet} index={index} allIndex={index}/>
        )}
      </BottomSheet>
    </div>
  );
}
