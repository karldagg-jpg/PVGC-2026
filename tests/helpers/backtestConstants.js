export function toBacktestAllPlayers(roster = []) {
  return roster
    .filter((p) => p && Number.isFinite(p.tid) && Number.isFinite(p.pi))
    .map((p) => ({
      tid: p.tid,
      pi: p.pi,
      playerId: p.playerId,
      name: p.name,
      team: p.team,
    }));
}
