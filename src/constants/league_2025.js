const PAR = [4, 3, 4, 5, 4, 3, 4, 5, 4];
const SI = [1, 3, 7, 8, 4, 9, 2, 6, 5];
const RAINOUT_SUB = { 6: 0, 7: 3, 8: 2 }; // H7->H1, H8->H4, H9->H3

// 2025 teams from tests/data/schedule.xlsx
const TEAMS = {
  1: { name: "Charles - Dagg", p1: "Charles", p2: "Dagg" },
  2: { name: "Brosius - Albano", p1: "Brosius", p2: "Albano" },
  3: { name: "Mistry - Reddy", p1: "Mistry", p2: "Reddy" },
  4: { name: "Pineno - MacKenzie", p1: "Pineno", p2: "MacKenzie" },
  5: { name: "Carickhoff - Celenza", p1: "Carickhoff", p2: "Celenza" },
  6: { name: "Deshaies - Glascott", p1: "Deshaies", p2: "Glascott" },
  7: { name: "Harvey - Rowles", p1: "Harvey", p2: "Rowles" },
  8: { name: "Saenz - Huston", p1: "Saenz", p2: "Huston" },
  9: { name: "Fahey - Olivos", p1: "Fahey", p2: "Olivos" },
  10: { name: "Mulvey - Nelson", p1: "Mulvey", p2: "Nelson" },
  11: { name: "West - Herman", p1: "West", p2: "Herman" },
  12: { name: "Lorenz - Huckestein", p1: "Lorenz", p2: "Huckestein" },
  13: { name: "Wagner - Hammond", p1: "Wagner", p2: "Hammond" },
  14: { name: "Franks - Lightbody", p1: "Franks", p2: "Lightbody" },
  15: { name: "Jurden - Schantz", p1: "Jurden", p2: "Schantz" },
  16: { name: "Lukas - Blizard", p1: "Lukas", p2: "Blizard" },
  17: { name: "Posey - Minasian", p1: "Posey", p2: "Minasian" },
  18: { name: "Mitchelle - Pavelik", p1: "Mitchelle", p2: "Pavelik" },
};

const ALL_PLAYERS = Object.entries(TEAMS).flatMap(([tid, t]) => [
  { tid: parseInt(tid, 10), pi: 0, name: t.p1, team: t.name },
  { tid: parseInt(tid, 10), pi: 1, name: t.p2, team: t.name },
]);

// 2025 schedule from tests/data/schedule.xlsx
const SCHEDULE_RAW = [
  [1, "2025-04-16", [13, 17], [14, 15], [3, 6], [9, 8], [2, 4], [11, 10], [7, 12], [5, 1], [18, 16]],
  [2, "2025-04-23", [18, 14], [16, 13], [5, 4], [2, 6], [3, 1], [9, 12], [11, 8], [7, 10], [15, 17]],
  [3, "2025-04-30", [8, 10], [12, 6], [7, 9], [13, 15], [18, 11], [16, 14], [3, 2], [17, 5], [1, 4]],
  [4, "2025-05-07", [9, 3], [5, 11], [14, 1], [4, 16], [6, 17], [8, 13], [10, 15], [12, 18], [7, 2]],
  [5, "2025-05-14", [11, 2], [3, 7], [6, 16], [9, 5], [4, 14], [10, 18], [12, 13], [8, 15], [1, 17]],
  [6, "2025-05-21", [4, 6], [10, 12], [13, 7], [9, 11], [15, 18], [14, 2], [17, 16], [5, 3], [8, 1]],
  [7, "2025-05-28", [14, 11], [7, 16], [12, 3], [8, 5], [10, 2], [18, 4], [13, 6], [15, 1], [17, 9]],
  [8, "2025-06-04", [7, 5], [2, 9], [4, 17], [6, 14], [1, 16], [12, 15], [8, 18], [10, 13], [11, 3]],
  [9, "2025-06-11", [17, 7], [9, 14], [10, 5], [12, 2], [8, 3], [15, 6], [18, 1], [13, 4], [16, 11]],
  [10, "2025-06-18", [10, 4], [6, 1], [18, 13], [15, 9], [11, 7], [2, 5], [16, 3], [14, 17], [12, 8]],
  [11, "2025-06-25", [16, 9], [11, 17], [2, 8], [10, 3], [12, 5], [14, 7], [15, 4], [18, 6], [13, 1]],
  [12, "2025-07-09", [3, 13], [15, 5], [8, 14], [16, 10], [4, 11], [2, 18], [17, 12], [6, 7], [1, 9]],
  [13, "2025-07-16", [5, 18], [13, 2], [16, 12], [17, 8], [14, 10], [1, 11], [6, 9], [4, 7], [3, 15]],
  [14, "2025-07-23", [2, 15], [18, 3], [17, 10], [14, 12], [16, 8], [6, 11], [4, 9], [1, 7], [5, 13]],
  [15, "2025-07-30", [1, 12], [4, 8], [11, 15], [7, 18], [9, 13], [3, 17], [5, 14], [2, 16], [6, 10]],
  [16, "2025-08-06", [6, 8], [3, 14], [9, 18], [11, 13], [7, 15], [5, 16], [2, 17], [1, 10], [4, 12]],
  [17, "2025-08-13", [15, 16], [17, 18], [1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12], [13, 14]],
  [18, "2025-08-20"],
  [19, "2025-08-27"],
  [20, "2025-09-03"],
  [21, "2025-09-10"],
];

const BASE_TEE_TIMES = ["4:10 PM", "4:20 PM", "4:30 PM", "4:40 PM", "4:50 PM", "5:00 PM", "5:10 PM", "5:20 PM", "5:30 PM"];
const TEE_TIME_OVERRIDES = {};

function getTeeTimes(week) {
  return TEE_TIME_OVERRIDES[week] || BASE_TEE_TIMES;
}

function buildSchedule() {
  const s = {};
  for (const [week, date, ...pairs] of SCHEDULE_RAW) {
    s[week] = { week, date, pairs: (pairs || []).filter((p) => Array.isArray(p)) };
  }
  return s;
}

const SCHEDULE = buildSchedule();

// Keep same shape as league.js so import swapping is easy.
const DEFAULT_HCP = {
  1: [6, 5],
  2: [7, 8],
  3: [6, 7],
  4: [9, 10],
  5: [2, 10],
  6: [1, 12],
  7: [9, 11],
  8: [7, 11],
  9: [8, 0],
  10: [8, 4],
  11: [23, 15],
  12: [11, 3],
  13: [16, 12],
  14: [9, 1],
  15: [0, 0],
  16: [9, 30],
  17: [10, 9],
  18: [0, 19],
};

const NEW_MEMBERS = {};
const HCP_PCT = [0, 0.60, 0.70, 0.75, 0.80];

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
