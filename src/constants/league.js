import * as L2024 from "./league_2024";
import * as L2025 from "./league_2025";
import * as L2026 from "./league_2026";

const STORAGE_KEY = "pvgc_season_year";
const AVAILABLE_SEASONS = [2026];

function readSeasonYear() {
  if (typeof window === "undefined") return 2026;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const year = parseInt(raw || "", 10);
  return AVAILABLE_SEASONS.includes(year) ? year : 2026;
}

function writeSeasonYear(year) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(year));
}

const SEASON_YEAR = readSeasonYear();
const ACTIVE = SEASON_YEAR === 2024 ? L2024 : SEASON_YEAR === 2025 ? L2025 : L2026;

const {
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
  HCP_CAP,
  HCP_ROUNDS,
  NEW_MEMBER_HCP_PCT,
  PLAYOFF_START_WEEK,
} = ACTIVE;

function setSeasonYear(year) {
  const y = parseInt(year, 10);
  if (!AVAILABLE_SEASONS.includes(y)) return false;
  writeSeasonYear(y);
  return true;
}

function isNewMember(tid, pi) {
  return ACTIVE.isNewMember(tid, pi);
}

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
  HCP_CAP,
  HCP_ROUNDS,
  NEW_MEMBER_HCP_PCT,
  PLAYOFF_START_WEEK,
  AVAILABLE_SEASONS,
  SEASON_YEAR,
  setSeasonYear,
  isNewMember,
};
