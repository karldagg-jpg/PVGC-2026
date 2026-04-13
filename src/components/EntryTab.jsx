import React, { useRef, useState } from "react";
import { TEAMS, PAR, SI, SCHEDULE, HCP_PCT } from "../constants/league";
import { getOpponent, matchKey, initMatch, stabPts, hcpStr, maxGross, getEffectiveHcp, getEffectiveHcpRaw } from "../lib/leagueLogic";
import { fmtDate } from "../lib/format";
import { G, GO, R, M, CREAM, GOLD, FB, FD } from "../constants/theme";
import { Tag } from "./ui";

function EntryTab({league, saveLeague, saveMatchDoc, entryWeek, setEntryWeek, entryTeam, setEntryTeam,
                   entryScores, setEntryScores, entrySaved, setEntrySaved,
                   knockdownPairs, qfPairs, sfPairs, finalPairs,
                   cancelledWeeks, toggleCancelWeek}) {
  const isReadOnly = (league.readOnlyWeeks || []).includes(entryWeek);
  const cellRefs = useRef({});
  const [draftTypes, setDraftTypes] = useState({});

  const entDynPairs = entryWeek===18?(knockdownPairs||null):entryWeek===19?(qfPairs||null):entryWeek===20?(sfPairs||null):entryWeek===21?(finalPairs?[finalPairs.championship,finalPairs.thirdPlace]:null):null;
  const entOpp = getOpponent(entryTeam, entryWeek, entDynPairs);
  const entT1id = entryTeam;
  const entT2id = entOpp;
  const mk = entT1id && entT2id ? matchKey(entryWeek, Math.min(entT1id,entT2id), Math.max(entT1id,entT2id)) : null;
  const savedRec = mk ? league.results[entryWeek]?.[mk] : null;

  const getOrd = (tid) => {
    const loHiKey = `${tid}-${entryWeek}`;
    const loHiOv = (league.loHiOverrides || {})[loHiKey];
    if (loHiOv !== undefined) return loHiOv === 0 ? [0,1] : [1,0];
    const r0 = getEffectiveHcpRaw(tid, 0, entryWeek, league.results, league.handicaps, league.hcpOverrides||{});
    const r1 = getEffectiveHcpRaw(tid, 1, entryWeek, league.results, league.handicaps, league.hcpOverrides||{});
    return r0 <= r1 ? [0,1] : [1,0];
  };

  const toggleLoHi = (tid) => {
    const loHiKey = `${tid}-${entryWeek}`;
    const overrides = league.loHiOverrides || {};
    const next = { ...league, loHiOverrides: { ...overrides } };
    if (overrides[loHiKey] !== undefined) {
      delete next.loHiOverrides[loHiKey];
    } else {
      const [naturalLow] = getOrd(tid);
      next.loHiOverrides[loHiKey] = naturalLow === 0 ? 1 : 0;
    }
    saveLeague(next);
  };

  const players = entT1id && entT2id ? (()=>{
    const [t1L,t1H] = getOrd(entT1id);
    const [t2L,t2H] = getOrd(entT2id);
    return [
      {tid:entT1id, pi:t1L, tIdx:0, label:"Low"},
      {tid:entT1id, pi:t1H, tIdx:0, label:"High"},
      {tid:entT2id, pi:t2L, tIdx:1, label:"Low"},
      {tid:entT2id, pi:t2H, tIdx:1, label:"High"},
    ];
  })() : [];

  const draftKey = `${entryWeek}-${entT1id}-${entT2id}`;

  // Pre-fill from saved Firebase data if no local draft yet
  const getEntry = (tIdx, pi, hi) => {
    const draft = entryScores[draftKey];
    if (draft) return draft[tIdx][pi][hi] || 0;
    // Fall back to what's saved in Firebase
    if (!savedRec) return 0;
    const scores = tIdx===0
      ? (entT1id < entT2id ? savedRec.t1scores : savedRec.t2scores)
      : (entT1id < entT2id ? savedRec.t2scores : savedRec.t1scores);
    return scores?.[pi]?.[hi] || 0;
  };

  const initDraft = () => {
    // Initialize draft FROM saved data so edits are additive, not destructive
    if (!savedRec) return { 0:[Array(9).fill(0),Array(9).fill(0)], 1:[Array(9).fill(0),Array(9).fill(0)] };
    const t1s = entT1id < entT2id ? savedRec.t1scores : savedRec.t2scores;
    const t2s = entT1id < entT2id ? savedRec.t2scores : savedRec.t1scores;
    return {
      0: [(t1s?.[0]||[]).map(x=>x||0), (t1s?.[1]||[]).map(x=>x||0)],
      1: [(t2s?.[0]||[]).map(x=>x||0), (t2s?.[1]||[]).map(x=>x||0)],
    };
  };

  const setEntry = (tIdx, pi, hi, val) => {
    setEntryScores(prev => {
      const cur = prev[draftKey] || initDraft();
      return {
        ...prev,
        [draftKey]: {
          ...cur,
          [tIdx]: cur[tIdx].map((row,i) => i===pi ? row.map((v,h) => h===hi ? val : v) : [...row])
        }
      };
    });
    setEntrySaved(false);
  };

  const getEntryType = (tIdx, pi) => {
    const draft = draftTypes[draftKey];
    if (draft) return draft[tIdx][pi] || "normal";
    if (!savedRec) return "normal";
    const types = tIdx === 0
      ? (entT1id < entT2id ? savedRec.t1types : savedRec.t2types)
      : (entT1id < entT2id ? savedRec.t2types : savedRec.t1types);
    return types?.[pi] || "normal";
  };

  const setEntryType = (tIdx, pi, val) => {
    setDraftTypes(prev => {
      const cur = prev[draftKey] || { 0: ["normal","normal"], 1: ["normal","normal"] };
      return { ...prev, [draftKey]: { ...cur, [tIdx]: cur[tIdx].map((v,i) => i===pi ? val : v) } };
    });
    if (val === "phantom" || val === "sub") {
      setEntryScores(prev => {
        const cur = prev[draftKey] || initDraft();
        return { ...prev, [draftKey]: { ...cur, [tIdx]: cur[tIdx].map((row,i) => i===pi ? Array(9).fill(0) : [...row]) } };
      });
    }
    setEntrySaved(false);
  };

  const saveEntry = async () => {
    if (!mk || !entT1id || !entT2id) return;
    if (isReadOnly) return;
    const draft = entryScores[draftKey] || initDraft();
    const isSwapped = entT1id > entT2id;
    const t1s = isSwapped ? draft[1] : draft[0];
    const t2s = isSwapped ? draft[0] : draft[1];
    const existing = savedRec || {};
    const [tlow, thigh] = entT1id < entT2id ? [entT1id, entT2id] : [entT2id, entT1id];
    const hcpSnapshot = {
      [tlow]: [0,1].map(pi => getEffectiveHcp(tlow, pi, entryWeek, league.results, league.handicaps, league.hcpOverrides||{})),
      [thigh]: [0,1].map(pi => getEffectiveHcp(thigh, pi, entryWeek, league.results, league.handicaps, league.hcpOverrides||{})),
    };
    const dt = draftTypes[draftKey];
    const t1types_draft = isSwapped ? (dt?.[1] || existing.t2types || ["normal","normal"]) : (dt?.[0] || existing.t1types || ["normal","normal"]);
    const t2types_draft = isSwapped ? (dt?.[0] || existing.t2types || ["normal","normal"]) : (dt?.[1] || existing.t2types || ["normal","normal"]);
    const now = new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
    const confirmations = {
      [tlow]: { confirmedBy: "Admin", confirmedAt: now },
      [thigh]: { confirmedBy: "Admin", confirmedAt: now },
    };
    const toSave = {
      ...initMatch(), ...existing,
      t1scores: t1s, t2scores: t2s,
      t1types: t1types_draft,
      t2types: t2types_draft,
      hcpSnapshot,
      confirmations,
      locked: true,
    };
    if (saveMatchDoc) {
      await saveMatchDoc(toSave, entryWeek, tlow, thigh);
    } else {
      const next = {...league, results: {...league.results, [entryWeek]: {...league.results[entryWeek], [mk]: toSave}}};
      await saveLeague(next);
    }
    setEntryScores(prev => { const n={...prev}; delete n[draftKey]; return n; });
    setDraftTypes(prev => { const n={...prev}; delete n[draftKey]; return n; });
    setEntrySaved(true);
    setTimeout(() => setEntrySaved(false), 2500);
  };

  const focusCell = (row, col) => {
    const el = cellRefs.current[`${row}-${col}`];
    if (el) { el.focus(); el.select(); }
  };
  const handleKeyDown = (e, row, col) => {
    if (e.key === "ArrowRight" || e.key === "Tab" && !e.shiftKey || e.key === "Enter") {
      e.preventDefault();
      if (col < 8) focusCell(row, col+1);
      else if (row < 3) focusCell(row+1, 0);
    } else if (e.key === "ArrowLeft" || e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      if (col > 0) focusCell(row, col-1);
      else if (row > 0) focusCell(row-1, 8);
    } else if (e.key === "ArrowDown") { e.preventDefault(); focusCell(Math.min(3,row+1), col); }
    else if (e.key === "ArrowUp")    { e.preventDefault(); focusCell(Math.max(0,row-1), col); }
  };

  // (Masters theme — uses global constants);

  const LBL = {fontSize:"14px",fontWeight:600,color:M,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:"6px"};
  const SEL = {width:"100%",background:"#fff",border:`2px solid ${G}`,borderRadius:"13px",
    color:CREAM,fontFamily:FB,fontSize:"16px",fontWeight:600,padding:"12px 14px",cursor:"pointer",outline:"none",display:"block"};

  return (
    <div style={{maxWidth:"860px",margin:"0 auto",padding:"20px 14px"}}>

      {/* Title */}
      <div style={{fontFamily:FD,fontSize:"30px",fontWeight:700,color:CREAM,marginBottom:"18px"}}>Score Entry</div>

      {/* Week + Team selectors */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
        <div>
          <div style={LBL}>Week</div>
          <select value={entryWeek} onChange={e=>{setEntryWeek(parseInt(e.target.value));setEntrySaved(false);}} style={SEL}>
            {Array.from({length:21},(_,i)=>i+1).map(w=>(
              <option key={w} value={w}>Week {w}{cancelledWeeks?.has(w) ? " ⛈" : ""} — {fmtDate(SCHEDULE[w]?.date)}</option>
            ))}
          </select>
        </div>
        <div>
          <div style={LBL}>Team</div>
          <select value={entryTeam} onChange={e=>{setEntryTeam(parseInt(e.target.value));setEntrySaved(false);}} style={SEL}>
            {Array.from({length:18},(_,i)=>i+1).map(t=>(
              <option key={t} value={t}>T{t}: {TEAMS[t]?.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Cancel Week button + cancelled banner */}
      {(() => {
        const isCancelled = cancelledWeeks?.has(entryWeek);
        return (
          <div style={{marginBottom:"14px"}}>
            {isCancelled ? (
              <div style={{background:"#fff3cd",border:"2px solid #e6a817",borderRadius:"13px",
                padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px"}}>
                <div>
                  <div style={{fontWeight:700,color:"#7a4f00",fontSize:"15px"}}>⛈ Week {entryWeek} — Cancelled</div>
                  <div style={{color:"#8a6000",fontSize:"13px",marginTop:"2px"}}>No points awarded. Scores move to the following week.</div>
                </div>
                <button onClick={()=>toggleCancelWeek?.(entryWeek)}
                  style={{padding:"8px 16px",background:"#fff",border:"2px solid #e6a817",borderRadius:"8px",
                    color:"#7a4f00",fontFamily:FB,fontSize:"13px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                  Restore Week
                </button>
              </div>
            ) : (
              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <button onClick={()=>toggleCancelWeek?.(entryWeek)}
                  style={{padding:"7px 16px",background:"transparent",border:`1px solid ${GOLD}55`,borderRadius:"8px",
                    color:M,fontFamily:FB,fontSize:"12px",fontWeight:600,cursor:"pointer",letterSpacing:"0.06em",
                    textTransform:"uppercase"}}>
                  ⛈ Cancel Week
                </button>
              </div>
            )}
          </div>
        );
      })()}

      {/* Opponent banner — hidden when week is cancelled */}
      {!cancelledWeeks?.has(entryWeek) && (
        entOpp
          ? <div style={{background:"#fff",border:`2px solid ${G}`,borderRadius:"13px",
              padding:"12px 16px",marginBottom:"16px",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
              <span style={{fontSize:"15px",color:M}}>vs</span>
              <span style={{fontSize:"18px",fontWeight:700,color:G}}>{TEAMS[entOpp]?.name}</span>
              <span style={{fontSize:"14px",color:M}}>Team {entOpp}</span>
              {savedRec?.updatedAt&&(
                <span style={{marginLeft:"auto",fontSize:"13px",color:GOLD,fontWeight:500}}>
                  ✎ last saved {savedRec.updatedAt}
                </span>
              )}
            </div>
          : <div style={{background:"#fff3f3",border:`2px solid ${R}55`,borderRadius:"13px",
              padding:"12px 16px",marginBottom:"16px",fontSize:"16px",color:R,fontWeight:600}}>
              No match scheduled for Week {entryWeek}
            </div>
      )}

      {isReadOnly && (
        <div style={{background:"#fff3cd",border:"2px solid #e6a817",borderRadius:"13px",
          padding:"12px 16px",marginBottom:"14px",fontSize:"14px",color:"#7a4f00",fontWeight:600}}>
          🔒 Week {entryWeek} is read-only — editing disabled by admin.
        </div>
      )}

      {entOpp && !cancelledWeeks?.has(entryWeek) && (<>
        {/* One card per player */}
        {players.map((p, rowIdx) => {
          const pname = TEAMS[p.tid]?.[p.pi===0?"p1":"p2"] || "";
          const hcp = getEffectiveHcp(p.tid, p.pi, entryWeek, league.results, league.handicaps, league.hcpOverrides||{});
          const teamColor = p.tIdx===0 ? G : GO;
          const ptype = getEntryType(p.tIdx, p.pi);
          const roundCount = (() => {
            let c = 0;
            for (let w = 1; w < entryWeek; w++) {
              for (const [k, rec] of Object.entries(league.results[w] || {})) {
                if (!rec || rec.rainout || rec.w1stab) continue;
                const [, tlow, thigh] = k.split('-').map(Number);
                if (tlow !== p.tid && thigh !== p.tid) continue;
                const tIdx = p.tid === tlow ? 0 : 1;
                const scores = (tIdx === 0 ? rec.t1scores : rec.t2scores) || [];
                const types = (tIdx === 0 ? rec.t1types : rec.t2types) || [];
                if ((types[p.pi] || 'normal') !== 'normal') continue;
                if ((scores[p.pi] || []).reduce((s, g) => s + (g||0), 0) > 0) c++;
              }
            }
            return c;
          })();
          const hcpPct = roundCount <= 0 ? null : Math.round((roundCount <= 4 ? (HCP_PCT[roundCount] || 0) : 0.90) * 100);
          let grossTotal=0, stabTotal=0;
          const holes = Array(9).fill(0).map((_,hi)=>{
            const gross=getEntry(p.tIdx,p.pi,hi);
            const pts=gross?stabPts(gross,PAR[hi],hcpStr(hcp,SI[hi])):null;
            if(gross>0){grossTotal+=gross;stabTotal+=(pts||0);}
            return {gross,pts};
          });
          return (
            <div key={rowIdx} style={{background:"#fff",border:`2px solid ${teamColor}66`,
              borderRadius:"14px",marginBottom:"14px",overflow:"hidden",
              boxShadow:"0 1px 4px rgba(26,61,36,0.08)"}}>
              {/* Player header */}
              <div style={{background:teamColor+"20",padding:"12px 16px",
                display:"flex",alignItems:"center",justifyContent:"space-between",
                borderBottom:`2px solid ${teamColor}44`}}>
                <div style={{display:"flex",alignItems:"center",gap:"10px",flex:1,minWidth:0,flexWrap:"wrap"}}>
                  <div style={{width:"12px",height:"12px",borderRadius:"50%",background:teamColor,flexShrink:0}}/>
                  <span style={{fontSize:"18px",fontWeight:700,color:"#1a2e1a"}}>{pname}</span>
                  <span style={{fontSize:"13px",color:M,fontWeight:500}}>
                    HCP {hcp}{hcpPct !== null ? <span style={{color:M,fontWeight:400}}> · {hcpPct}%</span> : ""}
                  </span>
                  <span style={{fontSize:"11px",color:M,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase"}}>
                    {p.label}
                  </span>
                  {(rowIdx === 0 || rowIdx === 2) && (() => {
                    const loHiActive = (league.loHiOverrides||{})[`${p.tid}-${entryWeek}`] !== undefined;
                    return (
                      <button onClick={() => toggleLoHi(p.tid)}
                        title={loHiActive ? "Clear low/high override" : "Swap low/high order"}
                        style={{padding:"3px 8px",fontSize:"11px",fontWeight:700,fontFamily:FB,
                          background: loHiActive ? GOLD+"22" : "transparent",
                          border: `1px solid ${loHiActive ? GOLD : teamColor+"66"}`,
                          borderRadius:"5px", color: loHiActive ? GOLD : M,
                          cursor:"pointer", flexShrink:0}}>
                        {loHiActive ? "⇅ Swapped" : "⇅ Swap"}
                      </button>
                    );
                  })()}
                  <select value={ptype} onChange={e=>setEntryType(p.tIdx,p.pi,e.target.value)}
                    style={{background:"#fff",border:`1px solid ${teamColor}66`,borderRadius:"7px",
                      color:CREAM,fontFamily:FB,fontSize:"13px",padding:"5px 8px",cursor:"pointer",outline:"none",flexShrink:0}}>
                    <option value="normal">Regular</option>
                    <option value="sub">Sub</option>
                    <option value="phantom">Phantom</option>
                  </select>
                </div>
                {ptype==="normal"&&grossTotal>0&&(
                  <div style={{display:"flex",gap:"20px",alignItems:"center",marginLeft:"12px"}}>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:"14px",color:M,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Gross</div>
                      <div style={{fontSize:"24px",fontWeight:700,color:CREAM,lineHeight:1.1}}>{grossTotal}</div>
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{fontSize:"14px",color:G,fontWeight:600,letterSpacing:"0.06em",textTransform:"uppercase"}}>Stab</div>
                      <div style={{fontSize:"24px",fontWeight:700,color:G,lineHeight:1.1}}>{stabTotal}</div>
                    </div>
                  </div>
                )}
              </div>
              {/* Hole inputs or flat-points display */}
              {(ptype==="phantom"||ptype==="sub") ? (
                <div style={{padding:"20px 16px",textAlign:"center",color:ptype==="phantom"?R:GO,fontSize:"16px",fontWeight:600}}>
                  {ptype==="phantom" ? "Phantom — 2 pts" : "Sub — 6 pts"}
                </div>
              ) : (
              <div style={{padding:"12px"}}>
                <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",gap:"5px",marginBottom:"5px"}}>
                  {PAR.map((par,hi)=>(
                    <div key={hi} style={{textAlign:"center"}}>
                      <div style={{fontSize:"13px",fontWeight:700,color:G}}>H{hi+1}</div>
                      <div style={{fontSize:"12px",color:M}}>P{par}</div>
                    </div>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(9,1fr)",gap:"5px"}}>
                  {holes.map(({gross,pts},hi)=>{
                    const strokes = hcpStr(hcp, SI[hi]);
                    const grossMax = maxGross(PAR[hi], strokes);
                    const isCapped = gross > 0 && gross > grossMax;
                    const ptColor=pts===null?M:pts>=3?G:pts===1?GOLD:pts===0?M:R;
                    const bgColor=gross?(pts>=3?"#e6f5ea":pts===1?"#fdf6e0":pts===0?"#ffffff":R+"18"):"#ffffff";
                    const bdColor=isCapped?GO:gross?(pts>=3?G:pts===1?GOLD:pts===0?"#999":R):"#999";
                    return (
                      <div key={hi} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"2px"}}>
                        <input
                          ref={el=>cellRefs.current[`${rowIdx}-${hi}`]=el}
                          type="number" min="1"
                          value={gross||""}
                          placeholder={String(PAR[hi])}
                          onChange={e=>{const v=parseInt(e.target.value);setEntry(p.tIdx,p.pi,hi,isNaN(v)||v<1?0:v);}}
                          onKeyDown={e=>handleKeyDown(e,rowIdx,hi)}
                          onFocus={e=>e.target.select()}
                          style={{width:"100%",height:"48px",background:bgColor,
                            border:`2px solid ${bdColor}`,borderRadius:"8px",
                            color:gross?ptColor:"#555",fontFamily:FB,fontSize:"19px",
                            fontWeight:700,textAlign:"center",outline:"none",
                            MozAppearance:"textfield",appearance:"textfield"}}
                        />
                        {isCapped && (
                          <span style={{fontSize:"10px",fontWeight:600,color:GO,lineHeight:1}}>→{grossMax}</span>
                        )}
                        {gross>0&&pts!==null&&(
                          <span style={{fontSize:"12px",fontWeight:700,color:ptColor}}>
                            {pts>0?"+"+pts:pts}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              )}
            </div>
          );
        })}

        {/* Save */}
        <button onClick={saveEntry}
          disabled={isReadOnly}
          style={{width:"100%",padding:"18px",borderRadius:"12px",marginTop:"4px",
            border:`2px solid ${entrySaved?G:G}`,
            background:entrySaved?G:isReadOnly?"#eee":"#fff",
            color:entrySaved?"#fff":isReadOnly?"#999":G,fontFamily:FB,fontSize:"17px",
            letterSpacing:"0.06em",textTransform:"uppercase",
            cursor:isReadOnly?"not-allowed":"pointer",
            fontWeight:700,transition:"all 0.2s"}}>
          {entrySaved ? "✓ Saved!" : isReadOnly ? "Read-Only" : "Save Scores"}
        </button>
      </>)}
    </div>
  );
}


export default EntryTab;
