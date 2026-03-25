import { SCHEDULE_RAW, TEAMS, getTeeTimes, SEASON_YEAR } from "../constants/league";
import { calcWeekBonus, matchKey } from "../lib/leagueLogic";
import { CARD, CREAM, G, GO, GOLD, M, FB, FM } from "../constants/theme";
import { Tag } from "./ui";
import { fmtDate } from "../lib/format";

function ScheduleScreen({
  league,
  selWeek,
  setWeek,
  setTeam,
  setScreen,
  knockdownPairs,
  qfPairs,
  sfPairs,
  finalPairs,
  cancelledWeeks,
  toggleCancelWeek,
}) {
  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "22px 14px" }}>
      <div
        style={{
          fontFamily: "'Cormorant Garamond','Georgia',serif",
          fontSize: "28px",
          marginBottom: "4px",
          fontWeight: 600,
          letterSpacing: "0.02em",
          color: CREAM,
        }}
      >
        {SEASON_YEAR} Season
      </div>
      <div style={{ color: M, fontSize: "14px", marginBottom: "20px" }}>
        18 teams · Wednesdays · First tee 4:10pm
      </div>
      <div style={{ display: "grid", gap: "8px" }}>
        {SCHEDULE_RAW.map(([week, date, ...pairs]) => {
          const isKnockdown = week === 18;
          const isPlayoff = week >= 19;
          const dynPairs = isKnockdown
            ? knockdownPairs
            : week === 19
              ? qfPairs
              : week === 20
                ? sfPairs || []
                : week === 21
                  ? finalPairs
                    ? [finalPairs.championship, finalPairs.thirdPlace]
                    : []
                  : null;
          const cleanPairs = dynPairs || (pairs || []).filter(Array.isArray);
          const scored = cleanPairs.filter(
            ([ta, tb]) =>
              !!league.results[week]?.[matchKey(week, Math.min(ta, tb), Math.max(ta, tb))],
          ).length;
          const allDone = cleanPairs.length > 0 && scored === cleanPairs.length;
          const bonus =
            !isKnockdown && !isPlayoff && allDone
              ? calcWeekBonus(week, league.results, league.handicaps)
              : null;
          const isCancelled = cancelledWeeks?.has(week);
          return (
            <div
              key={week}
              style={{
                background: isCancelled ? "rgba(230,168,23,0.06)" : CARD,
                border: `1px solid ${isCancelled ? "#e6a81755" : week === selWeek ? G + "55" : "rgba(26,61,36,0.06)"}`,
                borderRadius: "13px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "11px 15px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: week === selWeek ? G + "0d" : "transparent",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setWeek(week);
                  if (isKnockdown || isPlayoff) {
                    const p = dynPairs;
                    if (p && p.length > 0) setTeam(p[0][0]);
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%",
                      border: `1px solid ${allDone ? G : GOLD}55`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 600,
                      fontSize: "12px",
                      color: allDone ? G : GOLD,
                    }}
                  >
                    {week}
                  </div>
                  <div>
                    <div style={{ fontSize: "12px" }}>
                      Week {week}
                      {isKnockdown && (
                        <span style={{ color: GO, marginLeft: "7px", fontSize: "13px", fontWeight: 700 }}>
                          KNOCKDOWN
                        </span>
                      )}
                      {week === 19 && (
                        <span style={{ color: GO, marginLeft: "7px", fontSize: "13px", fontWeight: 700 }}>
                          QUARTERFINALS
                        </span>
                      )}
                      {week === 20 && (
                        <span style={{ color: GO, marginLeft: "7px", fontSize: "13px", fontWeight: 700 }}>
                          SEMIFINALS
                        </span>
                      )}
                      {week === 21 && (
                        <span style={{ color: GO, marginLeft: "7px", fontSize: "13px", fontWeight: 700 }}>
                          CHAMPIONSHIP
                        </span>
                      )}
                      {allDone && <span style={{ color: G, marginLeft: "7px", fontSize: "13px" }}>✓ Complete</span>}
                      {bonus && <span style={{ color: G, marginLeft: "7px", fontSize: "13px" }}>Bonus pts awarded</span>}
                    </div>
                    <div style={{ fontSize: "13px", color: M, marginTop: "1px" }}>{fmtDate(date)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  {isCancelled
                    ? <Tag color="#e6a817">⛈ Cancelled</Tag>
                    : scored > 0 && <Tag color={allDone ? G : GO}>{scored}/{cleanPairs.length}</Tag>
                  }
                  {!isCancelled && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setWeek(week);
                        if (dynPairs && dynPairs.length > 0) setTeam(dynPairs[0][0]);
                        setScreen("scoring");
                      }}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: `1px solid ${G}44`,
                        background: GOLD + "18",
                        color: GOLD,
                        fontFamily: FM || FB,
                        fontSize: "13px",
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        cursor: "pointer",
                      }}
                    >
                      Score →
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCancelWeek?.(week);
                    }}
                    title={isCancelled ? "Restore week" : "Cancel week — weather"}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: `1px solid ${isCancelled ? "#e6a817" : GOLD + "33"}`,
                      background: isCancelled ? "#fff3cd" : "transparent",
                      color: isCancelled ? "#7a4f00" : M,
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    {isCancelled ? "↩ Restore" : "⛈"}
                  </button>
                </div>
              </div>
              {week === selWeek && (isKnockdown || isPlayoff) && cleanPairs.length === 0 && (
                <div style={{ padding: "10px 15px 12px", fontSize: "14px", color: M }}>
                  {isKnockdown && "Matchups determined by final regular season standings (top 8)."}
                  {week === 19 && "Matchups set after Knockdown round results."}
                  {week === 20 && "Matchups set after Quarterfinal results."}
                  {week === 21 && "Matchups set after Semifinal results."}
                </div>
              )}
              {week === selWeek && cleanPairs.length > 0 && (
                <div style={{ borderTop: `1px solid rgba(26,61,36,0.08)` }}>
                  {(() => {
                    const teeTimes = getTeeTimes(week);
                    return cleanPairs.map(([ta, tb], i) => {
                      const key = matchKey(week, ta, tb);
                      const done = !!league.results[week]?.[key];
                      const teeTime = teeTimes[i] || "";
                      return (
                        <div
                          key={i}
                          onClick={() => {
                            setTeam(ta);
                            setWeek(week);
                            setScreen("scoring");
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "9px 15px",
                            cursor: "pointer",
                            borderBottom: `1px solid rgba(26,61,36,0.06)`,
                            background: done ? "rgba(26,107,58,0.04)" : "transparent",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = done
                              ? "rgba(26,107,58,0.08)"
                              : "rgba(26,61,36,0.04)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = done
                              ? "rgba(26,107,58,0.04)"
                              : "transparent";
                          }}
                        >
                          <div
                            style={{
                              minWidth: "58px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: GOLD,
                              letterSpacing: "0.04em",
                              flexShrink: 0,
                            }}
                          >
                            {teeTime}
                          </div>
                          <div style={{ flex: 1, fontSize: "13px", color: done ? G : CREAM }}>
                            <span style={{ fontWeight: 600 }}>{TEAMS[ta]?.name}</span>
                            <span style={{ color: M, margin: "0 6px" }}>vs</span>
                            <span style={{ fontWeight: 600 }}>{TEAMS[tb]?.name}</span>
                          </div>
                          {done ? (
                            <span style={{ fontSize: "12px", color: G, fontWeight: 600 }}>✓</span>
                          ) : (
                            <span style={{ fontSize: "11px", color: M, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                              Score →
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ScheduleScreen;
