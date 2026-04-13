import React, { useState, useEffect, useRef } from "react";
import { LEAGUE_DOC, LEAGUE_DOC_ID, WEEK_SCORES_COL, db, auth } from "./firebase/client";
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
import RulesScreen from "./components/RulesScreen";
import AdminScreen from "./components/AdminScreen";
import PlayoffScreen from "./components/PlayoffScreen";
import PlayerScreen from "./components/PlayerScreen";
import {
  getPlayoffSeeds,
  getQFSeeds,
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
import { applySnapshotToLeague, applyWeekScoreDoc, removeWeekScoreDoc, normalizeMatch } from "./lib/persistence";

function App() {
  const [screen,  setScreen]  = useState("schedule");
  const [league,  setLeague]  = useState(initLeague);
  const [selWeek, setWeek]    = useState(1);
  const [selTeam, setTeam]    = useState(1);
  const [match,   setMatch]   = useState(initMatch());
  const matchDirty = useRef(false);
  const [hole,    setHole]    = useState(0);
  const [potyTab, setPotyTab] = useState("season");
  const playoffSeeds = React.useMemo(()=>getPlayoffSeeds(league.results,league.handicaps),[league]);
  const qfSeeds = React.useMemo(()=>getQFSeeds(league.results,league.handicaps),[league]);
  const knockdownPairs = React.useMemo(()=>getKnockdownPairs(league.results,league.handicaps),[league]);
  const qfPairs = React.useMemo(()=>getQFPairs(qfSeeds),[qfSeeds]);
  const sfPairs = React.useMemo(()=>getSFPairs(qfSeeds,league.results),[qfSeeds,league.results]);
  const finalPairs = React.useMemo(()=>getFinalPairs(qfSeeds,league.results),[qfSeeds,league.results]);
  const [entryTeam, setEntryTeam] = useState(1);
  const [entryScores, setEntryScores] = useState({});
  const [entrySaved, setEntrySaved] = useState(false);
const [seasonYear] = useState(SEASON_YEAR);
  const [rules, setRules] = useState([]);
  const [scanMsg, setScanMsg] = useState("");
  const [userName] = useState(() => localStorage.getItem("pvgc_user") || "");
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem("pvgc_admin") === "1");
  const [adminPin, setAdminPin] = useState(""); // loaded from Firebase

  function changeSeason(year) {
    if (!setSeasonYear(year)) return;
    window.location.reload();
  }

  // ── Firebase sync ────────────────────────────────────────────
  const lastSaveTime = useRef(0);
  const lastMatchSaveTime = useRef(0);
  const [fbStatus, setFbStatus] = useState("connecting");

  // Initial load: main doc (legacy results) + subcollection (current results)
  const loadFromFirebase = async () => {
    setFbStatus("connecting");
    try {
      // Wait for anonymous auth before hitting Firestore
      await new Promise(resolve => {
        const unsub = auth.onAuthStateChanged(user => { if (user) { unsub(); resolve(); } });
      });
      const [snap, scoresSnap] = await Promise.all([
        LEAGUE_DOC.get({ source: "server" }),
        WEEK_SCORES_COL.get({ source: "server" }),
      ]);
      setLeague(prev => {
        if (!snap.exists) return prev;
        const p = snap.data();
        // Start with legacy results from main doc
        let next = applySnapshotToLeague(prev, p, DEFAULT_HCP);
        // Apply subcollection docs on top (they override legacy)
        scoresSnap.docs.forEach(d => {
          next = applyWeekScoreDoc(next, d.data());
        });
        return next;
      });
      if (snap.exists && snap.data().rules) setRules(snap.data().rules);
      if (snap.exists && snap.data().adminPin) setAdminPin(snap.data().adminPin);
      setFbStatus("loaded");
    } catch(err) {
      console.warn("Firebase load error:", err);
      setFbStatus("error:"+(err.code||err.message||String(err)));
    }
  };

  useEffect(()=>{
    loadFromFirebase();
    // Main doc listener — only updates non-results fields
    const unsub = LEAGUE_DOC.onSnapshot((snap)=>{
      const msSinceSave = Date.now() - lastSaveTime.current;
      if(msSinceSave < 8000) return;
      if(!snap.exists){ setFbStatus("loaded"); return; }
      const p = snap.data();
      setLeague(prev => ({
        ...prev,
        handicaps: { ...(DEFAULT_HCP || {}), ...(p.handicaps || {}) },
        hcpOverrides: p.hcpOverrides || {},
        loHiOverrides: p.loHiOverrides || {},
        cancelledWeeks: new Set(p.cancelledWeeks || []),
        readOnlyWeeks: p.readOnlyWeeks || [],
      }));
      if (p.rules) setRules(p.rules);
      if (p.adminPin) setAdminPin(p.adminPin);
      setFbStatus("loaded");
    }, (err)=>console.warn("Snapshot error:", err));
    return ()=>unsub();
  },[]);

  // Subcollection listener — receives live per-match updates from other users
  useEffect(()=>{
    const unsub = WEEK_SCORES_COL.onSnapshot(snap => {
      const msSinceSave = Date.now() - lastMatchSaveTime.current;
      if(msSinceSave < 8000) return;
      snap.docChanges().forEach(change => {
        if(change.type === "removed"){
          const [weekStr, ...rest] = change.doc.id.split("_");
          const mk = rest.join("_");
          setLeague(prev => removeWeekScoreDoc(prev, parseInt(weekStr), mk));
        } else {
          setLeague(prev => applyWeekScoreDoc(prev, change.doc.data()));
        }
      });
    }, err => console.warn("WeekScores snapshot error:", err));
    return ()=>unsub();
  },[]);

  async function saveLeague(next){
    setLeague(next);
    lastSaveTime.current = Date.now();
    try{
      await LEAGUE_DOC.set({
        handicaps: next.handicaps,
        hcpOverrides: next.hcpOverrides||{},
        loHiOverrides: next.loHiOverrides||{},
        cancelledWeeks: [...(next.cancelledWeeks || [])],
        readOnlyWeeks: next.readOnlyWeeks || [],
      }, {merge:true});
      setFbStatus("loaded");
    }catch(e){
      console.warn("Save error:",e);
      setFbStatus("save-error:"+e.code+":"+e.message);
    }
  }

  async function saveMatchDoc(toSave, week, tlow, thigh){
    const key = matchKey(week, tlow, thigh);
    const docId = `${week}_${key}`;
    lastMatchSaveTime.current = Date.now();
    // Firestore doesn't support nested arrays — flatten [[p0],[p1]] → {p0:[],p1:[]}
    const flatScores = (arr) => Array.isArray(arr) ? { p0: arr[0]||[], p1: arr[1]||[] } : arr;
    try{
      await WEEK_SCORES_COL.doc(docId).set({
        ...toSave,
        t1scores: flatScores(toSave.t1scores),
        t2scores: flatScores(toSave.t2scores),
        week,
        matchKey: key,
        updatedAt: new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),
        ...(userName ? {updatedBy: userName} : {}),
      }, {merge:true});
      setLeague(prev => ({
        ...prev,
        results: {
          ...prev.results,
          [week]: { ...(prev.results[week]||{}), [key]: normalizeMatch(toSave) },
        },
      }));
    }catch(e){
      console.warn("saveMatchDoc error:",e);
      setFbStatus("save-error:"+e.code+":"+e.message);
    }
  }

  async function saveAdminPin(pin) {
    setAdminPin(pin);
    try {
      await LEAGUE_DOC.set({ adminPin: pin }, { merge: true });
    } catch(e) {
      console.warn("saveAdminPin error:", e);
    }
  }

  function adminUnlock(pin) {
    // If no PIN set yet, any non-empty entry unlocks so you can set one
    if (!adminPin || pin === adminPin) {
      localStorage.setItem("pvgc_admin", "1");
      setIsAdmin(true);
      return true;
    }
    return false;
  }

  function adminLock() {
    localStorage.removeItem("pvgc_admin");
    setIsAdmin(false);
  }

  async function saveRules(next) {
    setRules(next);
    try {
      await LEAGUE_DOC.set({ rules: next }, { merge: true });
    } catch(e) {
      console.warn("Rules save error:", e);
    }
  }

  async function clearMatch(week, mk){
    const docId = `${week}_${mk}`;
    try {
      // Delete from subcollection
      await WEEK_SCORES_COL.doc(docId).delete();
      // Also remove from main doc legacy results
      const snap = await LEAGUE_DOC.get();
      if (snap.exists) {
        const legacyResults = snap.data().results || {};
        const weekResults = { ...(legacyResults[week] || {}) };
        delete weekResults[mk];
        await LEAGUE_DOC.set({ results: { ...legacyResults, [week]: weekResults } }, { merge: true });
      }
      setLeague(prev => {
        const weekResults = { ...(prev.results[week] || {}) };
        delete weekResults[mk];
        return { ...prev, results: { ...prev.results, [week]: weekResults } };
      });
    } catch(e) {
      console.warn("clearMatch error:", e);
    }
  }

  async function clearSeason(){
    const fresh = initLeague();
    setMatch(initMatch());
    try {
      // Delete all subcollection docs
      const scoresSnap = await WEEK_SCORES_COL.get();
      if(scoresSnap.docs.length > 0){
        const batch = db.batch();
        scoresSnap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      // Also wipe results from main doc
      await LEAGUE_DOC.set({ results: {} }, { merge: true });
    } catch(e) {
      console.warn("clearSeason error:", e);
    }
    await saveLeague(fresh);
  }

  // ── Snapshots ────────────────────────────────────────────────
  const SNAPSHOTS_COL = LEAGUE_DOC.collection("snapshots");

  async function createSnapshot(label) {
    const id = new Date().toISOString().replace(/[:.]/g, "-");
    const weeksCovered = Object.keys(league.results || {}).filter(w => Object.keys(league.results[w] || {}).length > 0).length;
    try {
      await SNAPSHOTS_COL.doc(id).set({
        createdAt: new Date().toLocaleString("en-US"),
        label: label || "",
        weeksCovered,
        data: JSON.stringify(league),
      });
      return true;
    } catch(e) {
      console.warn("snapshot error:", e);
      return false;
    }
  }

  async function listSnapshots() {
    try {
      const snap = await SNAPSHOTS_COL.orderBy("createdAt", "desc").limit(10).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data(), data: undefined }));
    } catch(e) {
      console.warn("listSnapshots error:", e);
      return [];
    }
  }

  async function restoreSnapshot(id) {
    try {
      const doc = await SNAPSHOTS_COL.doc(id).get();
      if (!doc.exists) return false;
      const restored = JSON.parse(doc.data().data);
      // Write main doc fields back
      const { results, ...mainFields } = restored;
      await LEAGUE_DOC.set({ ...mainFields, results: {} }, { merge: false });
      // Delete existing weekScores and rewrite from snapshot
      const existing = await WEEK_SCORES_COL.get();
      if (existing.docs.length > 0) {
        const batch = db.batch();
        existing.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      // Write snapshot weekScores back
      for (const [week, matches] of Object.entries(results || {})) {
        for (const [mk, rec] of Object.entries(matches || {})) {
          if (!rec) continue;
          const docId = `${week}_${mk}`;
          const flatScores = (arr) => Array.isArray(arr) ? { p0: arr[0]||[], p1: arr[1]||[] } : arr;
          await WEEK_SCORES_COL.doc(docId).set({
            ...rec,
            t1scores: flatScores(rec.t1scores),
            t2scores: flatScores(rec.t2scores),
            week: parseInt(week),
            matchKey: mk,
          });
        }
      }
      await loadFromFirebase();
      return true;
    } catch(e) {
      console.warn("restoreSnapshot error:", e);
      return false;
    }
  }

  async function confirmMatch(week, mk, tid){
    const existing = league.results[week]?.[mk] || {};
    const confirmations = {
      ...(existing.confirmations || {}),
      [tid]: {
        confirmedBy: userName || `T${tid}`,
        confirmedAt: new Date().toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"}),
      },
    };
    const parts = mk.split("-");
    const tlow = parseInt(parts[1]), thigh = parseInt(parts[2]);
    const bothConfirmed = !!(confirmations[tlow] && confirmations[thigh]);
    const docId = `${week}_${mk}`;
    lastMatchSaveTime.current = Date.now();
    const flatScores = (arr) => Array.isArray(arr) ? { p0: arr[0]||[], p1: arr[1]||[] } : arr;
    try {
      await WEEK_SCORES_COL.doc(docId).set(
        { ...existing, t1scores: flatScores(existing.t1scores), t2scores: flatScores(existing.t2scores), week, matchKey: mk, confirmations, locked: bothConfirmed },
        { merge: false }
      );
      setLeague(prev => ({
        ...prev,
        results: {
          ...prev.results,
          [week]: {
            ...(prev.results[week]||{}),
            [mk]: normalizeMatch({ ...existing, confirmations, locked: bothConfirmed }),
          },
        },
      }));
    } catch(e) {
      console.warn("confirmMatch error:", e);
    }
  }

  async function unlockMatch(week, mk){
    const docId = `${week}_${mk}`;
    lastMatchSaveTime.current = Date.now();
    try {
      await WEEK_SCORES_COL.doc(docId).set({ locked: false, confirmations: {} }, { merge: true });
      const existing = league.results[week]?.[mk] || {};
      setLeague(prev => ({
        ...prev,
        results: {
          ...prev.results,
          [week]: {
            ...(prev.results[week]||{}),
            [mk]: normalizeMatch({ ...existing, locked: false, confirmations: {} }),
          },
        },
      }));
    } catch(e) {
      console.warn("unlockMatch error:", e);
    }
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
    matchDirty.current = false;
    const prev = prevWeekTeam.current;
    if(prev.week !== selWeek || prev.team !== selTeam){
      setHole(0);
      prevWeekTeam.current = {week:selWeek, team:selTeam};
    }
  },[selWeek,selTeam,league.results]);

  const selDynPairs = selWeek===PLAYOFF_START_WEEK ? knockdownPairs
                    : selWeek===PLAYOFF_START_WEEK+1 ? qfPairs
                    : selWeek===PLAYOFF_START_WEEK+2 ? (sfPairs||null)
                    : selWeek===PLAYOFF_START_WEEK+3 ? (finalPairs?[finalPairs.championship,finalPairs.thirdPlace]:null)
                    : null;
  const opp=getOpponent(selTeam,selWeek,selDynPairs);
  const t1id=selTeam, t2id=opp||0;

  const setMatchUser = React.useCallback((fn) => {
    matchDirty.current = true;
    setMatch(fn);
  }, []);

  async function saveMatch(matchToSave){
    if(!t1id||!t2id) return;
    const m = matchToSave || match;
    const[tlow,thigh]=t1id<t2id?[t1id,t2id]:[t2id,t1id];
    const hcpSnapshot = {
      [tlow]: [0,1].map(pi => getEffectiveHcp(tlow, pi, selWeek, league.results, league.handicaps, league.hcpOverrides||{})),
      [thigh]: [0,1].map(pi => getEffectiveHcp(thigh, pi, selWeek, league.results, league.handicaps, league.hcpOverrides||{})),
    };
    const toSave = selTeam===tlow
      ? {...m, hcpSnapshot}
      : {...m, hcpSnapshot, t1scores:m.t2scores, t1types:m.t2types, t2scores:m.t1scores, t2types:m.t1types};
    await saveMatchDoc(toSave, selWeek, tlow, thigh);
    setScanMsg("✓ Saved");
    setTimeout(()=>setScanMsg(""),2000);
  }

  const autoSaveTimer = useRef(null);
  const matchHasScores = (m) => m && (
    (m.t1scores||[]).some(arr=>(arr||[]).some(v=>v>0)) ||
    (m.t2scores||[]).some(arr=>(arr||[]).some(v=>v>0))
  );
  useEffect(()=>{
    if(!t1id||!t2id) return;
    if(!matchHasScores(match)) return;
    if(!matchDirty.current) return;
    if(autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(()=>saveMatch(match), 5000);
    return ()=>clearTimeout(autoSaveTimer.current);
  },[match]);

  const {teamStats,potyList,weeklyPoty,cancelledWeeks}=calcLeagueStats(league.results,league.handicaps,league.cancelledWeeks);
  const teamStandings=Object.entries(teamStats)
    .map(([id,s])=>({id:parseInt(id),...s}))
    .sort((a,b)=>b.totalPts-a.totalPts||b.stab-a.stab);

  const weekBonus=calcWeekBonus(selWeek,league.results,league.handicaps);

  const TABS=["schedule","scoring","entry","standings","poty","hcp","playoffs","players","rules","admin"];

  // Current match doc (for confirm/lock)
  const [cTlow,cThigh] = t1id && t2id ? (t1id<t2id?[t1id,t2id]:[t2id,t1id]) : [0,0];
  const currentMk = cTlow && cThigh ? matchKey(selWeek,cTlow,cThigh) : null;

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

      <div style={{padding:"12px 18px 0 18px",
        display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"8px",
        background:"#ffffff",position:"sticky",top:0,zIndex:20,
        borderBottom:`3px solid ${G}`,
        boxShadow:"0 3px 10px rgba(26,61,36,0.12)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"13px",paddingBottom:"12px"}}>
          <div>
            <div style={{fontFamily:FD,fontSize:"20px",color:"#0f2a14",letterSpacing:"0.02em",fontWeight:700}}>PVGC {seasonYear} League</div>
            <div style={{fontSize:"11px",color:"#3a5a3a",marginTop:"1px",letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:500}}>
              Pickering Valley · 18 Teams · Stableford · <span style={{color:GOLD}}>v3.8</span> · <span style={{color:"#2f5a3a"}}>{LEAGUE_DOC_ID}</span>
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
        </div>
        <div style={{display:"flex",gap:"0px",flexWrap:"wrap"}}>
          {TABS.map(t=><NavBtn key={t} active={screen===t} onClick={()=>setScreen(t)}>{t==="poty"?"POTY":t==="hcp"?"HCP":t==="entry"?"Entry":t==="rules"?"Rules":t==="admin"?"Admin":t==="playoffs"?"Playoffs":t==="players"?"Players":t}</NavBtn>)}
        </div>
      </div>

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
            confirmMatch={confirmMatch}
            unlockMatch={unlockMatch}
          />
        </>;
      })()}

      {screen==="standings"&&(
        <StandingsScreen teamStandings={teamStandings} />
      )}

      {screen==="poty"&&(
        <PotyScreen
          potyTab={potyTab}
          setPotyTab={setPotyTab}
          potyList={potyList}
          weeklyPoty={weeklyPoty}
          cancelledWeeks={cancelledWeeks}
        />
      )}

      {screen==="entry"&&(
        <EntryTab
          league={league} saveLeague={saveLeague} saveMatchDoc={saveMatchDoc}
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

      {screen==="hcp"&&(
        <HandicapScreen
          league={league}
          saveLeague={saveLeague}
          isAdmin={isAdmin}
        />
      )}

      {screen==="playoffs"&&(
        <PlayoffScreen
          league={league}
          playoffSeeds={playoffSeeds}
          qfSeeds={qfSeeds}
          knockdownPairs={knockdownPairs}
          qfPairs={qfPairs}
          sfPairs={sfPairs}
          finalPairs={finalPairs}
          teamStandings={teamStandings}
        />
      )}

      {screen==="players"&&(
        <PlayerScreen league={league} />
      )}

      {screen==="rules"&&(
        <RulesScreen rules={rules} saveRules={saveRules} />
      )}

      {screen==="admin"&&(
        <AdminScreen
          league={league}
          knockdownPairs={knockdownPairs}
          qfPairs={qfPairs}
          sfPairs={sfPairs}
          finalPairs={finalPairs}
          saveLeague={saveLeague}
          unlockMatch={unlockMatch}
          clearMatch={clearMatch}
          clearSeason={clearSeason}
          isAdmin={isAdmin}
          adminPin={adminPin}
          adminUnlock={adminUnlock}
          adminLock={adminLock}
          saveAdminPin={saveAdminPin}
          teamStandings={teamStandings}
          createSnapshot={createSnapshot}
          listSnapshots={listSnapshots}
          restoreSnapshot={restoreSnapshot}
        />
      )}
    </div>
  );
}


export default App;
