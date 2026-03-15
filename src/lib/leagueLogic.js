import {
  PAR,
  SI,
  RAINOUT_SUB,
  SCHEDULE,
  ALL_PLAYERS,
  TEAMS,
  DEFAULT_HCP,
  HCP_PCT,
  isNewMember,
} from "../constants/league";

function getPlayoffSeeds(results, handicaps) {
  const {teamStats} = calcLeagueStats(results, handicaps, 17);
  return Object.entries(teamStats)
    .map(([id,s])=>({id:parseInt(id),...s}))
    .sort((a,b)=>b.totalPts-a.totalPts||b.stab-a.stab)
    .slice(0,8)
    .map(s=>s.id);
}

// Week 18 Knockdown: 1v2, 3v4, 5v6, 7v8
function getKnockdownPairs(seeds) {
  if(seeds.length<8) return [];
  return [[seeds[0],seeds[1]],[seeds[2],seeds[3]],[seeds[4],seeds[5]],[seeds[6],seeds[7]]];
}

// Week 19 QF: 1v8, 2v7, 3v6, 4v5
function getQFPairs(seeds) {
  if(seeds.length<8) return [];
  return [[seeds[0],seeds[7]],[seeds[1],seeds[6]],[seeds[2],seeds[5]],[seeds[3],seeds[4]]];
}

// Get winner of a playoff match (higher score wins; tie = lower seed advances)
function getPlayoffWinner(week, ta, tb, results) {
  const mk = matchKey(week, Math.min(ta,tb), Math.max(ta,tb));
  const rec = results[week]?.[mk];
  if(!rec) return null;
  // Use team stableford totals to determine winner
  const totA = (rec.t1scores||[[],[]]).reduce((s,arr)=>s+arr.reduce((x,v)=>x+(v||0),0),0);
  const totB = (rec.t2scores||[[],[]]).reduce((s,arr)=>s+arr.reduce((x,v)=>x+(v||0),0),0);
  // t1scores belongs to lower-numbered team
  const tlow=Math.min(ta,tb), thigh=Math.max(ta,tb);
  const scoreA = ta===tlow ? totA : totB;
  const scoreB = tb===tlow ? totA : totB;
  if(scoreA > scoreB) return ta;
  if(scoreB > scoreA) return tb;
  return ta; // tie: lower seed (ta is lower seed by convention)
}

// Get SF pairs from QF results
function getSFPairs(seeds, results) {
  const qf = getQFPairs(seeds);
  const w = qf.map(([a,b])=>getPlayoffWinner(19,a,b,results));
  if(w.some(x=>!x)) return null; // QF not complete
  // SF: QF1 winner vs QF4 winner, QF2 winner vs QF3 winner
  return [[w[0],w[3]],[w[1],w[2]]];
}

// Get Finals pair from SF results + 3rd place match
function getFinalPairs(seeds, results) {
  const sf = getSFPairs(seeds, results);
  if(!sf) return null;
  const w = sf.map(([a,b])=>getPlayoffWinner(20,a,b,results));
  if(w.some(x=>!x)) return null;
  // Losers
  const l = sf.map(([a,b],i)=>w[i]===a?b:a);
  return {championship:[w[0],w[1]], thirdPlace:[l[0],l[1]]};
}

function getOpponent(teamId, week, dynamicPairs=null) {
  if(dynamicPairs) {
    for(const [a,b] of dynamicPairs) {
      if(a===teamId) return b;
      if(b===teamId) return a;
    }
    return null;
  }
  const w = SCHEDULE[week];
  if (!w?.pairs) return null;
  for (const [a,b] of w.pairs) {
    if (a===teamId) return b;
    if (b===teamId) return a;
  }
  return null;
}

function matchKey(w,ta,tb) { return `${w}-${Math.min(ta,tb)}-${Math.max(ta,tb)}`; }

// ── Scoring logic ──────────────────────────────────────────────
function hcpStr(hcp, si) {
  const h = Math.floor(parseFloat(hcp)||0);
  if (h < 0) return si <= Math.abs(h) ? -1 : 0;
  const full = Math.floor(h / 9);
  const remainder = h % 9;
  return full + (si <= remainder ? 1 : 0);
}

// Max gross score on a hole = par + 2 (net double bogey) + strokes received
function maxGross(par, strokes) {
  return par + 2 + strokes;
}

// Stableford points — gross is capped at net double bogey before calculation
function stabPts(gross, par, strokes) {
  if (!gross) return null;
  const cappedGross = Math.min(gross, maxGross(par, strokes));
  const diff = par - (cappedGross - strokes);
  if (diff >= 3) return 5;
  if (diff === 2) return 4;
  if (diff === 1) return 3;
  if (diff === 0) return 1;
  if (diff === -1) return 0;
  return -1;
}

// ── Compute team total from a saved match record ───────────────
function computeTeamTotal(rec, tIdx, tid, handicaps) {
  let total = 0;
  const types  = tIdx===0 ? rec.t1types  : rec.t2types;
  const scores = tIdx===0 ? rec.t1scores : rec.t2scores;
  // Use snapshotted handicap if available, else fall back to current
  const snap = rec.hcpSnapshot;
  for (let pi=0; pi<2; pi++) {
    const type = (types||[])[pi]||"normal";
    if (type==="sub") { total+=6; continue; }
    for (let hi=0; hi<9; hi++) {
      const effHi = (rec.rainout && hi>=rec.holesPlayed && RAINOUT_SUB[hi]!==undefined) ? RAINOUT_SUB[hi] : hi;
      const gross = (scores||[[],[]])[pi]?.[effHi]||0;
      if (!gross) continue;
      const hcp = snap ? (snap[tid]||[0,0])[pi]||0 : (handicaps[tid]||[0,0])[pi]||0;
      total += stabPts(gross, PAR[hi], hcpStr(hcp, SI[hi]))||0;
    }
  }
  return total;
}

// Compute individual player total from record
function computePlayerTotal(rec, tIdx, pi, tid, handicaps) {
  const types  = tIdx===0 ? rec.t1types  : rec.t2types;
  const scores = tIdx===0 ? rec.t1scores : rec.t2scores;
  const type = (types||[])[pi]||"normal";
  if (type==="sub") return 6;
  let total = 0;
  const snap = rec.hcpSnapshot;
  for (let hi=0; hi<9; hi++) {
    const effHi = (rec.rainout && hi>=rec.holesPlayed && RAINOUT_SUB[hi]!==undefined) ? RAINOUT_SUB[hi] : hi;
    const gross = (scores||[[],[]])[pi]?.[effHi]||0;
    if (!gross) continue;
    const hcp = snap ? (snap[tid]||[0,0])[pi]||0 : (handicaps[tid]||[0,0])[pi]||0;
    total += stabPts(gross, PAR[hi], hcpStr(hcp, SI[hi]))||0;
  }
  return total;
}

// ── Bonus points: rank all 9 team totals in a week ─────────────
// Returns {teamId: bonusPts} — only if ALL 9 matches scored
function calcWeekBonus(week, results, handicaps) {
  const w = SCHEDULE[week];
  if (!w?.pairs?.length) return null;
  const totals = [];
  for (const [ta,tb] of w.pairs) {
    const key = matchKey(week,ta,tb);
    const rec = results[week]?.[key];
    if (!rec) return null; // not all scored yet
    const [tlow,thigh] = ta<tb?[ta,tb]:[tb,ta];
    totals.push({tid:tlow,  total:computeTeamTotal(rec,0,tlow,handicaps)});
    totals.push({tid:thigh, total:computeTeamTotal(rec,1,thigh,handicaps)});
  }
  // Sort descending by total
  totals.sort((a,b)=>b.total-a.total);
  const bonus = {};
  // 8/6/4/2 for pairs: rank 1-2 get 8, 3-4 get 6, 5-6 get 4, 7-8 get 2, 9-10 (if tie) also 2
  // Handle ties: if teams tie, they share the same bracket
  const pts = [8,8,6,6,4,4,2,2,2,2];
  // Group tied teams at same bonus level
  let i=0;
  while (i < totals.length) {
    let j=i;
    while (j<totals.length && totals[j].total===totals[i].total) j++;
    // teams i..j-1 are tied — average their bonus levels
    const avgPts = pts.slice(i,j).reduce((s,p)=>s+p,0)/(j-i);
    for (let k=i;k<j;k++) bonus[totals[k].tid] = Math.round(avgPts);
    i=j;
  }
  return bonus;
}

// ── Full league stats ──────────────────────────────────────────
function calcLeagueStats(results, handicaps, maxWeek=17) {
  // Team stats: matchPts, bonusPts, totalPts, stab, wins, losses, ties, played
  const teamStats = {};
  for (let t=1;t<=18;t++) teamStats[t] = {matchPts:0,bonusPts:0,totalPts:0,stab:0,wins:0,losses:0,ties:0,played:0};

  // Player stats: rounds[], total (drop 3 lowest at end)
  const playerStats = {};
  ALL_PLAYERS.forEach(p => { playerStats[`${p.tid}-${p.pi}`] = {rounds:[],name:p.name,team:TEAMS[p.tid]?.name,tid:p.tid,pi:p.pi}; });

  for (let w=1; w<=maxWeek; w++) {
    const week = SCHEDULE[w];
    if (!week?.pairs?.length) continue;

    // Bonus pts for week (null if not all scored)
    const bonus = calcWeekBonus(w, results, handicaps);

    for (const pair of week.pairs) {
      if (!Array.isArray(pair)) continue;
      const [ta,tb] = pair;
      const key = matchKey(w,ta,tb);
      const rec = results[w]?.[key];
      if (!rec) continue;

      const [tlow,thigh] = ta<tb?[ta,tb]:[tb,ta];
      const totA = computeTeamTotal(rec,0,tlow,handicaps);
      const totB = computeTeamTotal(rec,1,thigh,handicaps);

      teamStats[tlow].stab  += totA;
      teamStats[thigh].stab += totB;
      teamStats[tlow].played++;
      teamStats[thigh].played++;

      // Points: Low vs Low (2/1), High vs High (2/1), Team match (4/2)
      const hA = handicaps[tlow]||[0,0];
      const hB = handicaps[thigh]||[0,0];
      const lowA = hA[0]<=hA[1]?0:1, highA = 1-lowA;
      const lowB = hB[0]<=hB[1]?0:1, highB = 1-lowB;
      const pairings = [{piA:lowA,piB:lowB},{piA:highA,piB:highB}];
      let winsA=0, winsB=0;
      for (const {piA,piB} of pairings) {
        const pA = computePlayerTotal(rec,0,piA,tlow,handicaps);
        const pB = computePlayerTotal(rec,1,piB,thigh,handicaps);
        if (pA>pB)      { teamStats[tlow].matchPts+=2; winsA++; }
        else if (pB>pA) { teamStats[thigh].matchPts+=2; winsB++; }
        else            { teamStats[tlow].matchPts+=1; teamStats[thigh].matchPts+=1; }
      }
      // Team match result (4 for win, 2 each for tie)
      if (winsA>winsB)      { teamStats[tlow].matchPts+=4;  teamStats[tlow].wins++;  teamStats[thigh].losses++; }
      else if (winsB>winsA) { teamStats[thigh].matchPts+=4; teamStats[thigh].wins++; teamStats[tlow].losses++; }
      else                  { teamStats[tlow].matchPts+=2;  teamStats[thigh].matchPts+=2; teamStats[tlow].ties++; teamStats[thigh].ties++; }

      // Bonus pts
      if (bonus) {
        teamStats[tlow].bonusPts  += bonus[tlow]||0;
        teamStats[thigh].bonusPts += bonus[thigh]||0;
      }

      // Player individual totals
      for (let pi=0; pi<2; pi++) {
        const ptA = computePlayerTotal(rec,0,pi,tlow,handicaps);
        const ptB = computePlayerTotal(rec,1,pi,thigh,handicaps);
        playerStats[`${tlow}-${pi}`].rounds.push({week:w,pts:ptA});
        playerStats[`${thigh}-${pi}`].rounds.push({week:w,pts:ptB});
      }
    }
  }

  // Finalize team totals
  for (let t=1;t<=18;t++) {
    teamStats[t].totalPts = teamStats[t].matchPts + teamStats[t].bonusPts;
  }

  // Finalize POTY: drop 3 lowest rounds
  const potyList = Object.values(playerStats).map(p => {
    const sorted = [...p.rounds].sort((a,b)=>a.pts-b.pts);
    const dropCount = Math.max(0, sorted.length - Math.max(sorted.length - 3, 0)) ;
    // Only drop if player has played more than 3 rounds
    const toDrop = sorted.length > 3 ? 3 : 0;
    const kept   = sorted.slice(toDrop);
    const total  = kept.reduce((s,r)=>s+r.pts,0);
    return {...p, total, keptRounds:kept.length, droppedRounds:sorted.slice(0,toDrop)};
  }).sort((a,b)=>b.total-a.total);

  // Weekly POTY: highest individual score per week across all players
  const weeklyPoty = {};
  for (let w=1;w<=17;w++) {
    let best = -Infinity;
    let winners = [];
    ALL_PLAYERS.forEach(p => {
      const key = matchKey(w, p.tid, getOpponent(p.tid,w)||0);
      // Find which tIdx this player is
      const opp = getOpponent(p.tid, w);
      if (!opp) return;
      const [tlow,thigh] = p.tid<opp?[p.tid,opp]:[opp,p.tid];
      const tIdx = p.tid===tlow?0:1;
      const rec = results[w]?.[matchKey(w,tlow,thigh)];
      if (!rec) return;
      const pts = computePlayerTotal(rec, tIdx, p.pi, p.tid, handicaps);
      if (pts > best) { best=pts; winners=[{...p,pts}]; }
      else if (pts===best) winners.push({...p,pts});
    });
    if (winners.length) weeklyPoty[w] = {pts:best, winners};
  }

  return {teamStats, potyList, weeklyPoty};
}

// ── Default handicaps ──────────────────────────────────────────
function initLeague() {
  const handicaps={}, results={};
  for (let t=1;t<=18;t++) handicaps[t]=[...DEFAULT_HCP[t]];
  for (let w=1;w<=21;w++) results[w]={};
  return {handicaps, results, hcpOverrides:{}};
}

// ── Auto-handicap calculation ─────────────────────────────────
// Stagger percentages for returning players (by round number played)
// Calculate the auto handicap for one player given their season gross scores so far.
// grossRounds: array of gross totals in chronological order (round 1 first).
// startHcp: their DEFAULT_HCP value (last season ending hcp).
// Returns: new handicap (integer, capped at startHcp+2).
function calcAutoHcp(grossRounds, startHcp, isNew) {
  const n = grossRounds.length;
  if (n === 0) return isNew ? 0 : startHcp;  // new members start at 0 until round 1

  let avgGross, PCT;

  if (isNew) {
    // New members: always 60%, always average all rounds, no cap
    PCT = 0.60;
    avgGross = grossRounds.reduce((s, g) => s + g, 0) / n;
    return Math.round(PCT * (avgGross - 36));
  }

  // Returning members
  PCT = n <= 4 ? HCP_PCT[n] : 0.90;

  if (n <= 4) {
    avgGross = grossRounds.reduce((s, g) => s + g, 0) / n;
  } else {
    // Average of lowest 7 gross scores out of all rounds
    const sorted = [...grossRounds].sort((a, b) => a - b);
    const best7 = sorted.slice(0, Math.min(7, n));
    avgGross = best7.reduce((s, g) => s + g, 0) / best7.length;
  }

  const raw = PCT * (avgGross - 36);
  const rounded = Math.round(raw);
  // Cap: cannot exceed startHcp + 2, no floor (negatives allowed)
  return Math.min(rounded, startHcp + 2);
}

// Build per-player gross round history from all saved results up to (not including) a given week.
// Returns: { [tid]: [p1_grosses[], p2_grosses[]] }
function buildGrossHistory(results, upToWeek) {
  const history = {};
  for (let t = 1; t <= 18; t++) history[t] = [[], []];

  for (let w = 1; w < upToWeek; w++) {
    const weekResults = results[w] || {};
    for (const [key, rec] of Object.entries(weekResults)) {
      if (!rec || rec.rainout) continue;
      if (rec.w1stab) continue;
      const parts = key.split('-');
      const tlow = parseInt(parts[1]);
      const thigh = parseInt(parts[2]);

      [[tlow, rec.t1scores, rec.t1types], [thigh, rec.t2scores, rec.t2types]].forEach(([tid, scores, types]) => {
        if (!scores || !history[tid]) return;
        // scores[0] = Low HCP player, scores[1] = High HCP player
        // We need to map back to p1/p2 order using starting handicaps
        const [h0,h1] = (DEFAULT_HCP[tid]||[0,0]);
        const lowPi = h0 <= h1 ? 0 : 1;
        const highPi = 1 - lowPi;
        [[0, lowPi], [1, highPi]].forEach(([scoreIdx, pi]) => {
          const type = (types || [])[scoreIdx] || 'normal';
          if (type !== 'normal') return; // skip subs/phantoms
          // Sum gross with per-hole cap (net double bogey max) using player's handicap
          const hcp = (DEFAULT_HCP[tid]||[0,0])[pi] || 0;
          const gross = (scores[scoreIdx] || []).reduce((s, g, hi) => {
            if (!g) return s;
            const strokes = hcpStr(hcp, SI[hi]);
            return s + Math.min(g, maxGross(PAR[hi], strokes));
          }, 0);
          if (gross > 0) history[tid][pi].push(gross);
        });
      });
    }
  }
  return history;
}

// Returns suggested handicaps for all players for a given week (based on prior weeks' scores).
// Returns: { [tid]: [p1hcp, p2hcp] } — same shape as league.handicaps
// Get effective handicap for a player at a given week
// Priority: match hcpSnapshot > hcpOverrides > auto-calc > current handicap
function getEffectiveHcp(tid, pi, week, results, handicaps, hcpOverrides) {
  const overrideKey = `${tid}-${pi}-${week}`;
  if (hcpOverrides && hcpOverrides[overrideKey] !== undefined) return hcpOverrides[overrideKey];
  const history = buildGrossHistory(results, week);
  const startHcp = (DEFAULT_HCP[tid]||[0,0])[pi];
  return calcAutoHcp(history[tid][pi], startHcp, isNewMember(tid, pi));
}

function calcSuggestedHcps(results, currentWeek) {
  const history = buildGrossHistory(results, currentWeek);
  const suggested = {};
  for (let t = 1; t <= 18; t++) {
    const startHcps = DEFAULT_HCP[t] || [0, 0];
    suggested[t] = [0, 1].map(pi =>
      calcAutoHcp(history[t][pi], startHcps[pi], isNewMember(t, pi))
    );
  }
  return suggested;
}

function initMatch() {
  return {
    t1scores:[Array(9).fill(0),Array(9).fill(0)],
    t2scores:[Array(9).fill(0),Array(9).fill(0)],
    t1types:["normal","normal"],
    t2types:["normal","normal"],
    rainout:false, holesPlayed:6,
  };
}


export {
  getPlayoffSeeds,
  getKnockdownPairs,
  getQFPairs,
  getSFPairs,
  getFinalPairs,
  getOpponent,
  matchKey,
  hcpStr,
  maxGross,
  stabPts,
  computeTeamTotal,
  computePlayerTotal,
  calcWeekBonus,
  calcLeagueStats,
  initLeague,
  calcAutoHcp,
  buildGrossHistory,
  getEffectiveHcp,
  calcSuggestedHcps,
  initMatch,
};
