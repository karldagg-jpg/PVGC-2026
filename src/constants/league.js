const PAR         = [4,3,4,5,4,3,4,5,4];
const SI          = [1,3,7,8,4,9,2,6,5];
const RAINOUT_SUB = {6:0, 7:3, 8:2}; // H7→H1, H8→H4, H9→H3

// ── Teams ──────────────────────────────────────────────────────
const TEAMS = {
  1:  {name:"Charles - Dagg",        p1:"Brian Charles",   p2:"Karl Dagg"},
  2:  {name:"Brosius - Albano",       p1:"Steve Brosius",   p2:"Mike Albano"},
  3:  {name:"Mistry - Reddy",         p1:"Baz Mistry",      p2:"Sanjay Reddy"},
  4:  {name:"Pineno - MacKenzie",     p1:"Scot Pineno",     p2:"Scott MacKenzie"},
  5:  {name:"Carickhoff - Schantz",   p1:"Jack Carickhoff", p2:"Tracy Schantz"},
  6:  {name:"Glascott - Adler",       p1:"Scott Glascott",  p2:"Mark Adler"},
  7:  {name:"Harvey - Rowles",        p1:"John Harvey",     p2:"Jeff Rowles"},
  8:  {name:"Saenz - Huston",         p1:"Bob Saenz",       p2:"Dennis Huston"},
  9:  {name:"Fahey - Wzorek",         p1:"Chris Fahey",     p2:"Berry Wzorek"},
  10: {name:"Mulvey - Nelson",        p1:"Tom Mulvey",      p2:"Chris Nelson"},
  11: {name:"West - Herman",          p1:"Jack West",       p2:"Ron Herman"},
  12: {name:"Lorenz - Huckestein",    p1:"Gabe Lorenz",     p2:"Jake Huckestein"},
  13: {name:"Wagner - Hammond",       p1:"Betsy Wagner",    p2:"Gordon Hammond"},
  14: {name:"Franks - Lightbody",     p1:"John Franks",     p2:"Scott Lightbody"},
  15: {name:"Jurden - Olivos",        p1:"Jesse Jurden",    p2:"JC Olivos"},
  16: {name:"Lukas - Blizard",        p1:"Rhonda Lukas",    p2:"Carol Blizard"},
  17: {name:"Posey - Minasian",       p1:"Russ Posey",      p2:"Aret Minasian"},
  18: {name:"Pavelik - Mitchell",     p1:"Barry Pavelik",   p2:"Mark Mitchell"},
};

// Player list: {tid, pi, name}
const ALL_PLAYERS = Object.entries(TEAMS).flatMap(([tid,t]) => [
  {tid:parseInt(tid), pi:0, name:t.p1, team:t.name},
  {tid:parseInt(tid), pi:1, name:t.p2, team:t.name},
]);

// ── 2026 Schedule ──────────────────────────────────────────────
const SCHEDULE_RAW = [
  // Official 2026 schedule — validated (all 18 teams present each week)
  // Dates corrected from spreadsheet's /25 typo to /26
  [1,  "2026-04-15", [9,18],[13,15],[14,16],[3,11],[1,10],[4,8],[6,12],[2,7],[5,17]],
  [2,  "2026-04-22", [5,15],[17,18],[10,11],[1,16],[3,14],[2,12],[4,7],[6,8],[9,13]],
  [3,  "2026-04-29", [7,8],[12,16],[2,6],[13,18],[4,5],[15,17],[1,14],[9,11],[3,10]],
  [4,  "2026-05-06", [2,14],[4,11],[3,15],[10,17],[9,16],[7,18],[8,13],[5,12],[1,6]],
  [5,  "2026-05-13", [7,13],[6,14],[16,17],[3,9],[2,11],[5,8],[12,18],[1,4],[10,15]],
  [6,  "2026-05-20", [10,16],[8,12],[6,18],[2,4],[5,13],[1,15],[9,17],[11,14],[3,7]],
  [7,  "2026-05-27", [4,15],[6,17],[12,14],[7,11],[1,8],[5,10],[16,18],[3,13],[2,9]],
  [8,  "2026-06-03", [6,11],[4,14],[9,10],[8,18],[3,17],[12,13],[5,7],[15,16],[1,2]],
  [9,  "2026-06-10", [6,9],[4,17],[8,11],[10,18],[7,14],[13,16],[3,5],[1,12],[2,15]],
  [10, "2026-06-17", [8,10],[3,16],[5,18],[2,13],[4,6],[1,11],[14,17],[9,15],[7,12]],
  [11, "2026-06-24", [2,17],[4,9],[1,7],[8,14],[11,12],[3,18],[10,13],[5,16],[6,15]],
  [12, "2026-07-08", [14,18],[11,13],[6,16],[8,17],[9,12],[2,3],[4,10],[7,15],[1,5]],
  [13, "2026-07-15", [5,11],[1,18],[12,17],[7,9],[8,15],[6,10],[2,16],[3,4],[13,14]],
  [14, "2026-07-22", [1,13],[5,14],[8,9],[12,15],[7,17],[4,16],[3,6],[2,10],[11,18]],
  [15, "2026-07-29", [3,12],[7,10],[4,13],[5,6],[2,18],[9,14],[11,15],[1,17],[8,16]],
  [16, "2026-08-05", [7,16],[3,8],[2,5],[4,18],[6,13],[11,17],[10,12],[14,15],[1,9]],
  [17, "2026-08-12", [13,17],[5,9],[4,12],[10,14],[11,16],[6,7],[2,8],[1,3],[15,18]],
  [18, "2026-08-19"],   // Knockdown: 1v2, 3v4, 5v6, 7v8
  [19, "2026-08-26"],   // Playoffs Quarterfinals: 1v8, 2v7, 3v6, 4v5
  [20, "2026-09-02"],   // Playoffs Semifinals
  [21, "2026-09-09"],   // Playoffs Finals
];

// ── Tee Times ──────────────────────────────────────────────────
// Format: { week: ["4:10 PM", "4:20 PM", ...] } — 9 slots in order of play
// Matches listed in SCHEDULE_RAW order are assigned tee times in sequence
// Override individual weeks here as needed
const BASE_TEE_TIMES = ["4:10 PM","4:20 PM","4:30 PM","4:40 PM","4:50 PM","5:00 PM","5:10 PM","5:20 PM","5:30 PM"];
const TEE_TIME_OVERRIDES = {
  // Example: 3: ["4:15 PM","4:25 PM","4:35 PM","4:45 PM","4:55 PM","5:05 PM","5:15 PM","5:25 PM","5:35 PM"],
};
function getTeeTimes(week) {
  return TEE_TIME_OVERRIDES[week] || BASE_TEE_TIMES;
}

function buildSchedule() {
  const s = {};
  for (const [week, date, ...pairs] of SCHEDULE_RAW) {
    s[week] = {week, date, pairs:(pairs||[]).filter(p=>Array.isArray(p))};
  }
  return s;
}
const SCHEDULE = buildSchedule();


const DEFAULT_HCP = {
  1:  [5,4],   // Brian Charles (6), Karl Dagg (6)    ← real Week 1
  2:  [6,10],  // Steve Brosius, Mike Albano
  3:  [6,7],   // Baz Mistry, Sanjay Reddy
  4:  [9,11],  // Scot Pineno, Scott MacKenzie
  5:  [2,6],   // Jack Carickhoff (2), Tracy Schantz (6)
  6:  [13,0],   // Scott Glascott (13), Mark Adler (new member — no prior HCP)
  7:  [10,9],  // John Harvey, Jeff Rowles
  8:  [8,10],  // Bob Saenz, Dennis Huston
  9:  [7,0],   // Chris Fahey (7), Berry Wzorek (TBD — update when known)
  10: [5,3],   // Tom Mulvey (7), Chris Nelson (4)    ← real Week 1
  11: [11,16], // Jack West, Ron Herman
  12: [13,3],  // Gabe Lorenz, Jake Huckestein
  13: [16,11], // Betsy Wagner, Gordon Hammond
  14: [7,1],   // John Franks, Scott Lightbody
  15: [10,8],  // Jesse Jurden (10), JC Olivos (8)
  16: [7,28],  // Rhonda Lukas, Carol Blizard
  17: [10,9],  // Russ Posey, Aret Minasian
  18: [18,9],  // Barry Pavelik, Mark Mitchell
};


// ── New members (2026) — keyed by "tid-pi" ─────────────────────
const NEW_MEMBERS = {
  "6-1": true,  // Mark Adler (Team 6, player 2)
};


const HCP_PCT = [0, 0.60, 0.70, 0.75, 0.80]; // index 1-4, then 0.90 for 5+

export {
  PAR,
  SI,
  RAINOUT_SUB,
  TEAMS,
  ALL_PLAYERS,
  SCHEDULE_RAW,
  BASE_TEE_TIMES,
  TEE_TIME_OVERRIDES,
  getTeeTimes,
  buildSchedule,
  SCHEDULE,
  DEFAULT_HCP,
  NEW_MEMBERS,
  HCP_PCT,
};

export function isNewMember(tid, pi) {
  return !!NEW_MEMBERS[`${tid}-${pi}`];
}
