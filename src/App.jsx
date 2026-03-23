import React, { useState, useEffect, useRef } from "react";
import { LEAGUE_DOC, LEAGUE_DOC_ID } from "./firebase/client";
import {
  DEFAULT_HCP,
  AVAILABLE_SEASONS,
  SEASON_YEAR,
  PLAYOFF_START_WEEK,
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
import VerifyScreen from "./components/VerifyScreen";
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
  getEffectiveHcp,
} from "./lib/leagueLogic";
import { encodeResults, applySnapshotToLeague } from "./lib/persistence";

function App() {
  const [screen,  setScreen]  = useState("schedule");
  const [league,  setLeague]  = useState(initLeague);
  const [selWeek, setWeek]    = useState(1);
  const [selTeam, setTeam]    = useState(1);
  const [match,   setMatch]   = useState(initMatch());
  const matchDirty = useRef(false); // true only when user edits, not when loading from Firebase
  const [hole,    setHole]    = useState(0);
  const [potyTab, setPotyTab] = useState("season"); // season | weekly
  // Playoff seeds (computed from week 17 standings)
  const playoffSeeds = React.useMemo(()=>getPlayoffSeeds(league.results,league.handicaps),[league]);
  const knockdownPairs = React.useMemo(()=>getKnockdownPairs(playoffSeeds),[playoffSeeds]);
  const qfPairs = React.useMemo(()=>getQFPairs(playoffSeeds),[playoffSeeds]);
  const sfPairs = React.useMemo(()=>getSFPairs(playoffSeeds,league.results),[playoffSeeds,league.results]);
  const finalPairs = React.useMemo(()=>getFinalPairs(playoffSeeds,league.results),[playoffSeeds,league.results]);
  const [entryTeam, setEntryTeam] = useState(1);
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
    LEAGUE_DOC.get({ source: 'server' }).then(applySnapshot).catch((err)=>{
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
        loHiOverrides: next.loHiOverrides||{},
        cancelledWeeks: [...(next.cancelledWeeks || [])],
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
    const selDynPairs = selWeek===PLAYOFF_START_WEEK ? knockdownPairs
                    : selWeek===PLAYOFF_START_WEEK+1 ? qfPairs
                    : selWeek===PLAYOFF_START_WEEK+2 ? (sfPairs||null)
                    : selWeek===PLAYOFF_START_WEEK+3 ? (finalPairs?[finalPairs.championship,finalPairs.thirdPlace]:null)
                    : null;
    const opp=getOpponent(selTeam,selWeek,selDynPairs);
    if(!opp){setMatch(initMatch());return;}
    const [tlow,thigh]=selTeam<opp?[selTeam,opp]:[opp,selTeam];
    const saved=league.results[selWeek]?.[matchKey(selWeek,tlow,thigh)];
    if(!saved){setMatch(initMatch());return;}
    const display = selTeam===tlow ? {...initMatch(),...saved} : {
      ...initMatch(),...saved,
      t1scores: saved.t2scores || initMatch().t1scores,
      t1types:  saved.t2types  || ["normal","normal"],
      t2scores: saved.t1scores || initMatch().t2scores,
      t2types:  saved.t1types  || ["normal","normal"],
    };
    setMatch(display);
    matchDirty.current = false; // loading from Firebase — don't auto-save
    // Only reset hole when switching to a different match, not on every league update
    const prev = prevWeekTeam.current;
    if(prev.week !== selWeek || prev.team !== selTeam){
      setHole(0);
      prevWeekTeam.current = {week:selWeek, team:selTeam};
    }
  },[selWeek,selTeam,league.results]);

  // Dynamic pairs for current selected week
  const selDynPairs = selWeek===PLAYOFF_START_WEEK ? knockdownPairs
                    : selWeek===PLAYOFF_START_WEEK+1 ? qfPairs
                    : selWeek===PLAYOFF_START_WEEK+2 ? (sfPairs||null)
                    : selWeek===PLAYOFF_START_WEEK+3 ? (finalPairs?[finalPairs.championship,finalPairs.thirdPlace]:null)
                    : null;
  const opp=getOpponent(selTeam,selWeek,selDynPairs);
  const t1id=selTeam, t2id=opp||0;

  // Wrapper so auto-save only fires on user edits, not on Firebase loads
  const setMatchUser = React.useCallback((fn) => {
    matchDirty.current = true;
    setMatch(fn);
  }, []);


  async function saveMatch(matchToSave){
    if(!t1id||!t2id) return;
    const m = matchToSave || match;
    const[tlow,thigh]=t1id<t2id?[t1id,t2id]:[t2id,t1id];
    const key=matchKey(selWeek,tlow,thigh);
    // Snapshot handicaps at save time so historical scores are protected
    const hcpSnapshot = {
      [tlow]: [0,1].map(pi => getEffectiveHcp(tlow, pi, selWeek, league.results, league.handicaps, league.hcpOverrides||{})),
      [thigh]: [0,1].map(pi => getEffectiveHcp(thigh, pi, selWeek, league.results, league.handicaps, league.hcpOverrides||{})),
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
    if(!matchDirty.current) return; // don't auto-save data just loaded from Firebase
    if(autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(()=>saveMatch(match), 5000);
    return ()=>clearTimeout(autoSaveTimer.current);
  },[match]);


  // Compute full league stats
  const {teamStats,potyList,weeklyPoty,cancelledWeeks}=calcLeagueStats(league.results,league.handicaps,league.cancelledWeeks);
  const teamStandings=Object.entries(teamStats)
    .map(([id,s])=>({id:parseInt(id),...s}))
    .sort((a,b)=>b.totalPts-a.totalPts||b.stab-a.stab);

  // Check if all matches scored for current week (for bonus display)
  const weekBonus=calcWeekBonus(selWeek,league.results,league.handicaps);

  const TABS=["schedule","scoring","entry","standings","poty","hcp","verify"];

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
          {TABS.map(t=><NavBtn key={t} active={screen===t} onClick={()=>setScreen(t)}>{t==="poty"?"POTY":t==="hcp"?"HCP":t==="entry"?"Entry":t==="verify"?"Verify":t}</NavBtn>)}
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
          cancelledWeeks={cancelledWeeks}
          toggleCancelWeek={(w) => {
            const next = { ...league, cancelledWeeks: new Set(league.cancelledWeeks || []) };
            if (next.cancelledWeeks.has(w)) next.cancelledWeeks.delete(w);
            else next.cancelledWeeks.add(w);
            saveLeague(next);
          }}
        />
      )}

      {/* -- SCORING -- */}
      {screen==="scoring"&&(()=>{
        return <>
          <ScoringScreen
            selWeek={selWeek}
            setWeek={setWeek}
            selTeam={selTeam}
            setTeam={setTeam}
            opp={opp}
            match={match}
            setMatch={setMatchUser}
            hole={hole}
            setHole={setHole}
            t1id={t1id}
            t2id={t2id}
            league={league}
            saveLeague={saveLeague}
            weekBonus={weekBonus}
            cancelledWeeks={cancelledWeeks}
            toggleCancelWeek={(w) => {
              const next = { ...league, cancelledWeeks: new Set(league.cancelledWeeks || []) };
              if (next.cancelledWeeks.has(w)) next.cancelledWeeks.delete(w);
              else next.cancelledWeeks.add(w);
              saveLeague(next);
            }}
          />
        </>;
      })()}
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
          cancelledWeeks={cancelledWeeks}
        />
      )}

      {/* ══ BULK ENTRY ══ */}
      {screen==="entry"&&(
        <EntryTab
          league={league} saveLeague={saveLeague}
          entryWeek={selWeek} setEntryWeek={setWeek}
          entryTeam={entryTeam} setEntryTeam={setEntryTeam}
          entryScores={entryScores} setEntryScores={setEntryScores}
          entrySaved={entrySaved} setEntrySaved={setEntrySaved}
          knockdownPairs={knockdownPairs} qfPairs={qfPairs}
          sfPairs={sfPairs} finalPairs={finalPairs}
          cancelledWeeks={cancelledWeeks}
          toggleCancelWeek={(w) => {
            const next = { ...league, cancelledWeeks: new Set(league.cancelledWeeks || []) };
            if (next.cancelledWeeks.has(w)) next.cancelledWeeks.delete(w);
            else next.cancelledWeeks.add(w);
            saveLeague(next);
          }}
        />
      )}

      {/* ══ HANDICAPS ══ */}
      {/* -- HANDICAPS -- */}
      {screen==="hcp"&&(
        <HandicapScreen
          league={league}
          saveLeague={saveLeague}
        />
      )}

      {screen==="verify"&&(
        <VerifyScreen league={league} />
      )}
    </div>
  );
}


export default App;
