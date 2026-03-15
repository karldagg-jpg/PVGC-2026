import React, { useRef, useState } from "react";
import { TEAMS, PAR, SI, SCHEDULE } from "../constants/league";
import { getOpponent, matchKey, initMatch, stabPts, hcpStr, maxGross } from "../lib/leagueLogic";
import { fmtDate } from "../lib/format";
import { G, GO, R, M, CREAM, GOLD, FB, FD } from "../constants/theme";
import { Tag } from "./ui";

function EntryTab({league, saveLeague, entryWeek, setEntryWeek, entryTeam, setEntryTeam,
                   entryScores, setEntryScores, entrySaved, setEntrySaved,
                   userName, setUserName,
                   knockdownPairs, qfPairs, sfPairs, finalPairs}) {
  const cellRefs = useRef({});
  const [showNamePrompt, setShowNamePrompt] = useState(false);

  const entDynPairs = entryWeek===18?(knockdownPairs||null):entryWeek===19?(qfPairs||null):entryWeek===20?(sfPairs||null):entryWeek===21?(finalPairs?[finalPairs.championship,finalPairs.thirdPlace]:null):null;
  const entOpp = getOpponent(entryTeam, entryWeek, entDynPairs);
  const entT1id = entryTeam;
  const entT2id = entOpp;
  const mk = entT1id && entT2id ? matchKey(entryWeek, Math.min(entT1id,entT2id), Math.max(entT1id,entT2id)) : null;
  const savedRec = mk ? league.results[entryWeek]?.[mk] : null;

  const getOrd = (tid) => {
    const [h0,h1] = (league.handicaps[tid]||[0,0]);
    return h0 <= h1 ? [0,1] : [1,0];
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

  const saveEntry = async () => {
    if (!mk || !entT1id || !entT2id) return;
    const draft = entryScores[draftKey] || initDraft();
    const isSwapped = entT1id > entT2id;
    const t1s = isSwapped ? draft[1] : draft[0];
    const t2s = isSwapped ? draft[0] : draft[1];
    const existing = savedRec || {};
    const [tlow, thigh] = entT1id < entT2id ? [entT1id, entT2id] : [entT2id, entT1id];
    const hcpSnapshot = {
      [tlow]: [...(league.handicaps[tlow]||[0,0])],
      [thigh]: [...(league.handicaps[thigh]||[0,0])],
    };
    const toSave = {
      ...initMatch(), ...existing,
      t1scores: t1s, t2scores: t2s,
      t1types: existing.t1types || ["normal","normal"],
      t2types: existing.t2types || ["normal","normal"],
      hcpSnapshot,
      updatedBy: userName || "scorer",
      updatedAt: new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}),
    };
    const next = {...league, results: {...league.results,
      [entryWeek]: {...league.results[entryWeek], [mk]: toSave}}};
    await saveLeague(next);
    setEntryScores(prev => { const n={...prev}; delete n[draftKey]; return n; });
    setEntrySaved(true);
    setTimeout(() => setEntrySaved(false), 2500);
  };

  const focusCell = (row, col) => {
    const el = cellRefs.current[`${row}-${col}`];
    if (el) { el.focus(); el.select(); }
  };
  const handleKeyDown = (e, row, col) => {
    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      if (col < 8) focusCell(row, col+1);
      else if (row < 3) focusCell(row+1, 0);
    } else if (e.key === "ArrowRight") { e.preventDefault(); focusCell(row, Math.min(8,col+1)); }
    else if (e.key === "ArrowLeft")  { e.preventDefault(); focusCell(row, Math.max(0,col-1)); }
    else if (e.key === "ArrowDown")  { e.preventDefault(); focusCell(Math.min(3,row+1), col); }
    else if (e.key === "ArrowUp")    { e.preventDefault(); focusCell(Math.max(0,row-1), col); }
  };

  // (Masters theme — uses global constants);

  const LBL = {fontSize:"14px",fontWeight:600,color:M,letterSpacing:"0.05em",textTransform:"uppercase",marginBottom:"6px"};
  const SEL = {width:"100%",background:"#fff",border:`2px solid ${G}`,borderRadius:"13px",
    color:CREAM,fontFamily:FB,fontSize:"16px",fontWeight:600,padding:"12px 14px",cursor:"pointer",outline:"none",display:"block"};

  return (
    <div style={{maxWidth:"860px",margin:"0 auto",padding:"20px 14px"}}>

      {/* Title + scorer name */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"18px"}}>
        <div style={{fontFamily:FD,fontSize:"30px",fontWeight:700,color:CREAM}}>Score Entry</div>
        <button onClick={()=>setShowNamePrompt(v=>!v)}
          style={{padding:"9px 16px",background:userName?G+"18":"#fff",
            border:`2px solid ${G}`,borderRadius:"8px",color:G,
            fontFamily:FB,fontSize:"14px",fontWeight:600,cursor:"pointer"}}>
          {userName ? `✎ ${userName}` : "Set Your Name"}
        </button>
      </div>

      {/* Name prompt */}
      {showNamePrompt&&(
        <div style={{background:"#fff",border:`2px solid ${G}`,borderRadius:"12px",
          padding:"16px",marginBottom:"16px",display:"flex",gap:"13px",flexWrap:"wrap",alignItems:"center"}}>
          <span style={{fontSize:"15px",color:CREAM,fontWeight:500}}>Your name:</span>
          <input type="text" placeholder="e.g. Karl Dagg" defaultValue={userName}
            onKeyDown={e=>{if(e.key==="Enter"){const v=e.target.value.trim();setUserName(v);localStorage.setItem("pvgc_user",v);setShowNamePrompt(false);}}}
            style={{flex:1,minWidth:"160px",background:"#f8f8f4",border:`2px solid ${G}66`,
              borderRadius:"8px",color:CREAM,fontFamily:FB,fontSize:"16px",padding:"10px 12px",outline:"none"}}
            autoFocus
          />
          <button onClick={e=>{const v=e.target.closest("div").querySelector("input").value.trim();setUserName(v);localStorage.setItem("pvgc_user",v);setShowNamePrompt(false);}}
            style={{padding:"10px 20px",background:G,border:"none",borderRadius:"8px",
              color:"#fff",fontFamily:FB,fontSize:"15px",fontWeight:700,cursor:"pointer"}}>Save</button>
        </div>
      )}

      {/* Week + Team selectors */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
        <div>
          <div style={LBL}>Week</div>
          <select value={entryWeek} onChange={e=>{setEntryWeek(parseInt(e.target.value));setEntrySaved(false);}} style={SEL}>
            {Array.from({length:21},(_,i)=>i+1).map(w=>(
              <option key={w} value={w}>Week {w} — {fmtDate(SCHEDULE[w]?.date)}</option>
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

      {/* Opponent banner */}
      {entOpp
        ? <div style={{background:"#fff",border:`2px solid ${G}`,borderRadius:"13px",
            padding:"12px 16px",marginBottom:"16px",display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
            <span style={{fontSize:"15px",color:M}}>vs</span>
            <span style={{fontSize:"18px",fontWeight:700,color:G}}>{TEAMS[entOpp]?.name}</span>
            <span style={{fontSize:"14px",color:M}}>Team {entOpp}</span>
            {savedRec?.updatedBy&&(
              <span style={{marginLeft:"auto",fontSize:"13px",color:GOLD,fontWeight:500}}>
                ✎ last saved by {savedRec.updatedBy}{savedRec.updatedAt?" at "+savedRec.updatedAt:""}
              </span>
            )}
          </div>
        : <div style={{background:"#fff3f3",border:`2px solid ${R}55`,borderRadius:"13px",
            padding:"12px 16px",marginBottom:"16px",fontSize:"16px",color:R,fontWeight:600}}>
            No match scheduled for Week {entryWeek}
          </div>
      }

      {entOpp&&(<>
        {/* One card per player */}
        {players.map((p, rowIdx) => {
          const pname = TEAMS[p.tid]?.[p.pi===0?"p1":"p2"] || "";
          const hcp = (league.handicaps[p.tid]||[0,0])[p.pi] || 0;
          const teamColor = p.tIdx===0 ? G : GO;
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
                <div style={{display:"flex",alignItems:"center",gap:"13px"}}>
                  <div style={{width:"12px",height:"12px",borderRadius:"50%",background:teamColor,flexShrink:0}}/>
                  <span style={{fontSize:"18px",fontWeight:700,color:"#1a2e1a"}}>{pname}</span>
                  <span style={{fontSize:"14px",color:M,fontWeight:500}}>HCP {hcp}</span>
                </div>
                {grossTotal>0&&(
                  <div style={{display:"flex",gap:"20px",alignItems:"center"}}>
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
              {/* Hole inputs */}
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
                    const isCapped = gross > 0 && gross >= grossMax;
                    const ptColor=pts===null?M:pts>=3?G:pts===1?GOLD:pts===0?M:R;
                    const bgColor=gross?(pts>=3?"#e6f5ea":pts===1?"#fdf6e0":pts===0?"#ffffff":R+"18"):"#ffffff";
                    const bdColor=isCapped?GO:gross?(pts>=3?G:pts===1?GOLD:pts===0?"#999":R):"#999";
                    return (
                      <div key={hi} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
                        <input
                          ref={el=>cellRefs.current[`${rowIdx}-${hi}`]=el}
                          type="number" min="1" max={grossMax}
                          value={gross||""}
                          placeholder={String(PAR[hi])}
                          onChange={e=>{const v=parseInt(e.target.value);setEntry(p.tIdx,p.pi,hi,isNaN(v)||v<1?0:Math.min(grossMax,v));}}
                          onKeyDown={e=>handleKeyDown(e,rowIdx,hi)}
                          onFocus={e=>e.target.select()}
                          style={{width:"100%",height:"48px",background:bgColor,
                            border:`2px solid ${bdColor}`,borderRadius:"8px",
                            color:gross?ptColor:"#555",fontFamily:FB,fontSize:"19px",
                            fontWeight:700,textAlign:"center",outline:"none",
                            MozAppearance:"textfield",appearance:"textfield"}}
                        />
                        {gross>0&&pts!==null&&(
                          <span style={{fontSize:"12px",fontWeight:700,color:isCapped?GO:ptColor}}>
                            {isCapped?"max":pts>0?"+"+pts:pts}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        {/* Save */}
        <button onClick={saveEntry}
          style={{width:"100%",padding:"18px",borderRadius:"12px",marginTop:"4px",
            border:`2px solid ${entrySaved?G:G}`,
            background:entrySaved?G:"#fff",
            color:entrySaved?"#fff":G,fontFamily:FB,fontSize:"17px",
            letterSpacing:"0.06em",textTransform:"uppercase",cursor:"pointer",
            fontWeight:700,transition:"all 0.2s"}}>
          {entrySaved ? "✓ Saved!" : userName ? "Save Scores" : "Save Scores (set your name first)"}
        </button>
      </>)}
    </div>
  );
}


export default EntryTab;
