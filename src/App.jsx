import React, { useState, useEffect, useRef } from "react";
import { LEAGUE_DOC, LEAGUE_DOC_ID } from "./firebase/client";
import {
  PAR,
  RAINOUT_SUB,
  TEAMS,
  DEFAULT_HCP,
  AVAILABLE_SEASONS,
  SEASON_YEAR,
  setSeasonYear,
} from "./constants/league";
import { G, R, M, BG, CREAM, GOLD, FD, FB } from "./constants/theme";
import { NavBtn } from "./components/ui";
import EntryTab from "./components/EntryTab";
import ScheduleScreen from "./components/ScheduleScreen";
import ScoringScreen from "./components/ScoringScreen";
import StandingsScreen from "./components/StandingsScreen";
import PotyScreen from "./components/PotyScreen";
import HandicapScreen from "./components/HandicapScreen";
import {
  getPlayoffSeeds,
  getKnockdownPairs,
  getQFPairs,
  getSFPairs,
  getFinalPairs,
  getOpponent,
  matchKey,
  calcWeekBonus,
  calcLeagueStats,
  initLeague,
  initMatch,
} from "./lib/leagueLogic";
import { encodeResults, applySnapshotToLeague } from "./lib/persistence";

function App() {
  const [screen,  setScreen]  = useState("schedule");
  const [league,  setLeague]  = useState(initLeague);
  const [selWeek, setWeek]    = useState(1);
  const [selTeam, setTeam]    = useState(1);
  const [match,   setMatch]   = useState(initMatch());
  const [hole,    setHole]    = useState(0);
  const [scanState, setScan]  = useState("idle");
  const [scanMsg,  setScanMsg]= useState("");
  const [potyTab, setPotyTab] = useState("season"); // season | weekly
  const [entryWeek, setEntryWeek] = useState(1);
  const [entryTeam, setEntryTeam] = useState(1);
  // User identity for score attribution
  const [userName, setUserName] = useState(()=>localStorage.getItem("pvgc_user")||"");
  // Handicap PIN gate
  const [hcpUnlocked, setHcpUnlocked] = useState(false);
  // Playoff seeds (computed from week 17 standings)
  const playoffSeeds = React.useMemo(()=>getPlayoffSeeds(league.results,league.handicaps),[league]);
  const knockdownPairs = React.useMemo(()=>getKnockdownPairs(playoffSeeds),[playoffSeeds]);
  const qfPairs = React.useMemo(()=>getQFPairs(playoffSeeds),[playoffSeeds]);
  const sfPairs = React.useMemo(()=>getSFPairs(playoffSeeds,league.results),[playoffSeeds,league.results]);
  const finalPairs = React.useMemo(()=>getFinalPairs(playoffSeeds,league.results),[playoffSeeds,league.results]);
  const [hcpPin, setHcpPin] = useState("");
  const [hcpPinErr, setHcpPinErr] = useState(false);
  // entryScores: { [tid]: [[9 holes], [9 holes]] } — local draft before save
  const [entryScores, setEntryScores] = useState({});
  const [entrySaved, setEntrySaved] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [seasonYear] = useState(SEASON_YEAR);

  function changeSeason(year) {
    if (!setSeasonYear(year)) return;
    window.location.reload();
  }

  // ── Firebase sync ────────────────────────────────────────────
  const lastSaveTime = useRef(0);
  const [fbStatus, setFbStatus] = useState("connecting");

  const applySnapshot = (snap) => {
    if(!snap.exists){ setFbStatus("loaded"); return; }
    const p = snap.data();
    setLeague(prev => applySnapshotToLeague(prev, p, DEFAULT_HCP));
    setFbStatus("loaded");
  };

  const loadFromFirebase = () => {
    setFbStatus("connecting");
    LEAGUE_DOC.get().then(applySnapshot).catch((err)=>{
      console.warn("Firebase load error:", err);
      setFbStatus("error:"+(err.code||err.message||String(err)));
    });
  };

  useEffect(()=>{
    // Initial load
    loadFromFirebase();
    // Real-time listener for other users' updates
    const unsub = LEAGUE_DOC.onSnapshot((snap)=>{
      const msSinceSave = Date.now() - lastSaveTime.current;
      if(msSinceSave < 8000) return; // ignore our own echo
      applySnapshot(snap);
    }, (err)=>console.warn("Snapshot error:", err));
    return ()=>unsub();
  },[]);

  async function saveLeague(next){
    setLeague(next);
    lastSaveTime.current = Date.now();
    try{
      // Store each match as a JSON string — avoids all Firestore nested array restrictions
      const encodedResults = encodeResults(next.results);
      // Use set() with merge — works on empty or existing docs
      await LEAGUE_DOC.set({
        handicaps: next.handicaps,
        results: encodedResults,
        hcpOverrides: next.hcpOverrides||{},
      }, {merge:true});
      setFbStatus("loaded");
    }catch(e){
      console.warn("Save error:",e);
      setFbStatus("save-error:"+e.code+":"+e.message);
    }
  }

  async function clearData(){
    const fresh=initLeague();
    setMatch(initMatch());
    setConfirmReset(false);
    await saveLeague(fresh);
  }

  // Reload match when week/team/league changes
  const prevWeekTeam = useRef({week:null,team:null});
  useEffect(()=>{
    const selDynPairs = selWeek===18 ? knockdownPairs
                    : selWeek===19 ? qfPairs
                    : selWeek===20 ? (sfPairs||null)
                    : selWeek===21 ? (finalPairs?[finalPairs.championship,finalPairs.thirdPlace]:null)
                    : null;
    const opp=getOpponent(selTeam,selWeek,selDynPairs);
    if(!opp){setMatch(initMatch());return;}
    const [tlow,thigh]=selTeam<opp?[selTeam,opp]:[opp,selTeam];
    const saved=league.results[selWeek]?.[matchKey(selWeek,tlow,thigh)];
    if(!saved){setMatch(initMatch());return;}
    const display = selTeam===tlow ? {...initMatch(),...saved} : {
      ...initMatch(),...saved,
      t1scores:saved.t2scores, t1types:saved.t2types,
      t2scores:saved.t1scores, t2types:saved.t1types,
    };
    setMatch(display);
    // Only reset hole when switching to a different match, not on every league update
    const prev = prevWeekTeam.current;
    if(prev.week !== selWeek || prev.team !== selTeam){
      setHole(0);
      prevWeekTeam.current = {week:selWeek, team:selTeam};
    }
  },[selWeek,selTeam,league.results]);

  // Dynamic pairs for current selected week
  const selDynPairs = selWeek===18 ? knockdownPairs
                    : selWeek===19 ? qfPairs
                    : selWeek===20 ? (sfPairs||null)
                    : selWeek===21 ? (finalPairs?[finalPairs.championship,finalPairs.thirdPlace]:null)
                    : null;
  const opp=getOpponent(selTeam,selWeek,selDynPairs);
  const [t1id,t2id]=selTeam<(opp||99)?[selTeam,opp||0]:[opp||0,selTeam];

  // Effective hole (rainout)
  const effH=(hi)=>(match.rainout&&hi>=match.holesPlayed&&RAINOUT_SUB[hi]!==undefined)?RAINOUT_SUB[hi]:hi;

  async function saveMatch(matchToSave){
    if(!t1id||!t2id) return;
    const m = matchToSave || match;
    const[tlow,thigh]=t1id<t2id?[t1id,t2id]:[t2id,t1id];
    const key=matchKey(selWeek,tlow,thigh);
    // Snapshot handicaps at save time so historical scores are protected
    const hcpSnapshot = {
      [tlow]: [...(league.handicaps[tlow]||[0,0])],
      [thigh]: [...(league.handicaps[thigh]||[0,0])],
    };
    const toSave = selTeam===tlow
      ? {...m, hcpSnapshot}
      : {...m, hcpSnapshot, t1scores:m.t2scores, t1types:m.t2types, t2scores:m.t1scores, t2types:m.t1types};
    const next={...league,results:{...league.results,
      [selWeek]:{...league.results[selWeek],[key]:toSave}}};
    await saveLeague(next);
    setScanMsg("✓ Saved");
    setTimeout(()=>setScanMsg(""),2000);
  }

  // Auto-save 5s after last score change — debounced so rapid entry = 1 write
  const autoSaveTimer = useRef(null);
  const matchHasScores = (m) => m && (
    (m.t1scores||[]).some(arr=>(arr||[]).some(v=>v>0)) ||
    (m.t2scores||[]).some(arr=>(arr||[]).some(v=>v>0))
  );
  useEffect(()=>{
    if(!t1id||!t2id) return;
    if(!matchHasScores(match)) return; // don't auto-save empty match on load
    if(autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(()=>saveMatch(match), 5000);
    return ()=>clearTimeout(autoSaveTimer.current);
  },[match]);

  // Auto-advance hole when all 4 players have a score — runs after render, no mid-setState jump
  // Auto-advance: only fires when match scores change, not when hole changes
  // Tracks the hole that was complete to avoid re-firing after advance
  const lastAdvancedHole = useRef(-1);
  useEffect(()=>{
    if(!t1id||!t2id) return;
    // Don't re-check if we already advanced away from this hole
    if(lastAdvancedHole.current === hole) return;
    const getOrder=(tid)=>{const[h0,h1]=(league.handicaps[tid]||[0,0]);return h0<=h1?{low:0,high:1}:{low:1,high:0};};
    const o1=getOrder(t1id), o2=getOrder(t2id);
    const rows2=[
      {tIdx:0,pi:o1.low},{tIdx:1,pi:o2.low},
      {tIdx:0,pi:o1.high},{tIdx:1,pi:o2.high},
    ];
    const allScored=rows2.every(row=>{
      const types=row.tIdx===0?match.t1types:match.t2types;
      if((types||[])[row.pi]==="sub"||(types||[])[row.pi]==="phantom") return true;
      const scores=row.tIdx===0?match.t1scores:match.t2scores;
      return (scores||[[],[]])[row.pi]?.[effH(hole)]>0;
    });
    if(allScored && hole<8){
      lastAdvancedHole.current = hole;
      setTimeout(()=>setHole(h=>h+1), 500);
    }
  },[match]);  // only match, NOT hole — prevents double-fire on advance

  // Scorecard scan
  async function scanCard(file){
    if(!file) return;
    setScan("loading"); setScanMsg("Reading scorecard...");
    try{
      const b64=await new Promise((res,rej)=>{
        const r=new FileReader();
        r.onload=()=>res(r.result.split(",")[1]);
        r.onerror=()=>rej(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const p1a=TEAMS[t1id]?.p1||"P1", p2a=TEAMS[t1id]?.p2||"P2";
      const p1b=TEAMS[t2id]?.p1||"P1", p2b=TEAMS[t2id]?.p2||"P2";
      const prompt=`This is a golf scorecard from Pickering Valley Golf Course (front 9, pars: ${PAR.join(",")}).
Two teams are playing:
- Team A: ${TEAMS[t1id]?.name} — players: ${p1a} (player 1) and ${p2a} (player 2)
- Team B: ${TEAMS[t2id]?.name} — players: ${p1b} (player 1) and ${p2b} (player 2)

Extract each player's GROSS score (actual strokes) per hole 1-9.
Return ONLY valid JSON, no explanation:
{"t1p1":[h1,h2,h3,h4,h5,h6,h7,h8,h9],"t1p2":[...],"t2p1":[...],"t2p2":[...]}
Use 0 for missing/unreadable scores.`;
      const resp=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:500,
          messages:[{role:"user",content:[
            {type:"image",source:{type:"base64",media_type:file.type||"image/jpeg",data:b64}},
            {type:"text",text:prompt}
          ]}]})
      });
      const data=await resp.json();
      const text=(data.content||[]).map(c=>c.text||"").join("").trim();
      const sc=JSON.parse(text.replace(/```json|```/g,"").trim());
      const v=arr=>Array.isArray(arr)&&arr.length===9?arr.map(x=>(typeof x==="number"&&x>=0&&x<=15)?x:0):Array(9).fill(0);
      setMatch(prev=>({...prev,t1scores:[v(sc.t1p1),v(sc.t1p2)],t2scores:[v(sc.t2p1),v(sc.t2p2)]}));
      const filled=[...(sc.t1p1||[]),...(sc.t1p2||[]),...(sc.t2p1||[]),...(sc.t2p2||[])].filter(x=>x>0).length;
      setScan("done"); setScanMsg(`✓ Read ${filled}/36 scores — review then save`);
    }catch(e){
      console.error(e); setScan("error");
      setScanMsg("Could not read scorecard — try a clearer photo or enter manually");
    }
  }

  // Compute full league stats
  const {teamStats,potyList,weeklyPoty}=calcLeagueStats(league.results,league.handicaps);
  const teamStandings=Object.entries(teamStats)
    .map(([id,s])=>({id:parseInt(id),...s}))
    .sort((a,b)=>b.totalPts-a.totalPts||b.stab-a.stab);

  // Check if all matches scored for current week (for bonus display)
  const weekBonus=calcWeekBonus(selWeek,league.results,league.handicaps);

  const TABS=["schedule","scoring","entry","standings","poty","hcp"];

  return(
    <div style={{minHeight:"100vh",background:BG,fontFamily:FB,color:CREAM,paddingBottom:"60px",
      backgroundImage:"radial-gradient(ellipse at 30% 0%,#dfe8d4 0%,transparent 50%),radial-gradient(ellipse at 70% 100%,#e8e0cc 0%,transparent 50%)"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Mono:wght@300;400;500&display=swap');
        *{box-sizing:border-box;}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;}
        input[type=number]{-moz-appearance:textfield;}
        select{-webkit-appearance:none;-moz-appearance:none;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:#2a3a1a;border-radius:2px;}
        button:hover{opacity:0.85;}
      `}</style>

      {/* Firebase status banner */}
      {fbStatus==="connecting"&&(
        <div style={{background:"#fffbe6",borderBottom:"2px solid #f0c040",padding:"10px 18px",
          fontSize:"13px",color:"#7a5a00",display:"flex",alignItems:"center",gap:"8px"}}>
          <span>⏳</span> Connecting to database…
        </div>
      )}
      {(fbStatus.startsWith("error")||fbStatus.startsWith("save-error"))&&(
        <div style={{background:"#fff0f0",borderBottom:"2px solid #e04040",padding:"10px 18px",
          fontSize:"13px",color:"#900",display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}>
          <span>⚠️</span>
          <span><strong>Database error:</strong></span>
          <span style={{fontSize:"11px"}}>{fbStatus}</span>
        </div>
      )}

      {/* Header */}
      <div style={{padding:"12px 18px 0 18px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px",
        background:"#ffffff",position:"sticky",top:0,zIndex:20,
        borderBottom:`3px solid ${G}`,
        boxShadow:"0 3px 10px rgba(26,61,36,0.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"13px",paddingBottom:"12px"}}>
          <div>
            <div style={{fontFamily:FD,fontSize:"20px",color:"#0f2a14",letterSpacing:"0.02em",fontWeight:700}}>PVGC {seasonYear} League</div>
            <div style={{fontSize:"11px",color:"#3a5a3a",marginTop:"1px",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>
              Pickering Valley · 18 Teams · Stableford · <span style={{color:GOLD}}>v3.7</span> · <span style={{color:"#2f5a3a"}}>{LEAGUE_DOC_ID}</span>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
            <span style={{fontSize:"11px",color:"#3a5a3a",letterSpacing:"0.08em",textTransform:"uppercase"}}>Season</span>
            <select
              value={seasonYear}
              onChange={(e)=>changeSeason(parseInt(e.target.value, 10))}
              style={{
                background:"rgba(255,255,255,0.95)", border:`1px solid ${GOLD}44`,
                borderRadius:"7px", color:"#0f2a14", fontFamily:FB, fontSize:"13px",
                padding:"4px 8px", cursor:"pointer", outline:"none"
              }}>
              {AVAILABLE_SEASONS.map((y)=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {!confirmReset ? (
            <button onClick={()=>setConfirmReset(true)}
              style={{padding:"4px 9px",borderRadius:"6px",border:`1px solid ${R}55`,
                background:R+"12",color:R,fontFamily:FB,fontSize:"12px",letterSpacing:"0.06em",
                textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap"}}>
              ↺ Reset
            </button>
          ) : (
            <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
              <span style={{fontSize:"12px",color:R}}>Sure?</span>
              <button onClick={clearData}
                style={{padding:"4px 9px",borderRadius:"6px",border:`1px solid ${R}`,
                  background:R,color:"#fff",fontFamily:FB,fontSize:"12px",fontWeight:700,
                  cursor:"pointer",whiteSpace:"nowrap"}}>Yes</button>
              <button onClick={()=>setConfirmReset(false)}
                style={{padding:"4px 9px",borderRadius:"6px",border:`1px solid ${GOLD}66`,
                  background:"transparent",color:M,fontFamily:FB,fontSize:"12px",
                  cursor:"pointer",whiteSpace:"nowrap"}}>No</button>
            </div>
          )}
        </div>
        <div style={{display:"flex",gap:"0px",flexWrap:"wrap"}}>
          {TABS.map(t=><NavBtn key={t} active={screen===t} onClick={()=>setScreen(t)}>{t==="poty"?"POTY":t==="hcp"?"HCP":t==="entry"?"Entry":t}</NavBtn>)}
        </div>
      </div>

      {/* ══ SCHEDULE ══ */}
      {/* -- SCHEDULE -- */}
      {screen==="schedule"&&(
        <ScheduleScreen
          league={league}
          selWeek={selWeek}
          setWeek={setWeek}
          setTeam={setTeam}
          setScreen={setScreen}
          knockdownPairs={knockdownPairs}
          qfPairs={qfPairs}
          sfPairs={sfPairs}
          finalPairs={finalPairs}
        />
      )}

      {/* -- SCORING -- */}
      {screen==="scoring"&&(
        <ScoringScreen
          selWeek={selWeek}
          setWeek={setWeek}
          selTeam={selTeam}
          setTeam={setTeam}
          opp={opp}
          match={match}
          setMatch={setMatch}
          hole={hole}
          setHole={setHole}
          t1id={t1id}
          t2id={t2id}
          league={league}
          saveLeague={saveLeague}
          weekBonus={weekBonus}
          scanState={scanState}
          scanMsg={scanMsg}
          scanCard={scanCard}
        />
      )}
      {/* ══ STANDINGS ══ */}
      {/* -- STANDINGS -- */}
      {screen==="standings"&&(
        <StandingsScreen teamStandings={teamStandings} />
      )}

      {/* -- POTY -- */}
      {screen==="poty"&&(
        <PotyScreen
          potyTab={potyTab}
          setPotyTab={setPotyTab}
          potyList={potyList}
          weeklyPoty={weeklyPoty}
        />
      )}

      {/* ══ BULK ENTRY ══ */}
      {screen==="entry"&&(
        <EntryTab
          league={league} saveLeague={saveLeague}
          entryWeek={entryWeek} setEntryWeek={setEntryWeek}
          entryTeam={entryTeam} setEntryTeam={setEntryTeam}
          entryScores={entryScores} setEntryScores={setEntryScores}
          entrySaved={entrySaved} setEntrySaved={setEntrySaved}
          userName={userName} setUserName={setUserName}
          knockdownPairs={knockdownPairs} qfPairs={qfPairs}
          sfPairs={sfPairs} finalPairs={finalPairs}
        />
      )}

            {/* ══ HANDICAPS ══ */}
      {/* -- HANDICAPS -- */}
      {screen==="hcp"&&(
        <HandicapScreen
          hcpUnlocked={hcpUnlocked}
          setHcpUnlocked={setHcpUnlocked}
          hcpPin={hcpPin}
          setHcpPin={setHcpPin}
          hcpPinErr={hcpPinErr}
          setHcpPinErr={setHcpPinErr}
          league={league}
          saveLeague={saveLeague}
        />
      )}
    </div>
  );
}


export default App;
