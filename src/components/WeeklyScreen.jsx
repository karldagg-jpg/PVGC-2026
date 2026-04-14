import { useState } from "react";
import { TEAMS, SCHEDULE_RAW } from "../constants/league";
import { G, GO, R, M, CREAM, GOLD, CARD2, FD, FB } from "../constants/theme";

// Derive list of regular season weeks from schedule
const REGULAR_WEEKS = SCHEDULE_RAW
  .filter(([w]) => w <= 17)
  .map(([w, date]) => ({ week: w, date }));

export default function WeeklyScreen({ weeklyTeamPts }) {
  const pts = weeklyTeamPts || {};

  // Default to most recent week that has data
  const playedWeeks = REGULAR_WEEKS.filter(({ week }) =>
    Object.values(pts).some(t => t[week] !== undefined)
  );
  const defaultWeek = playedWeeks.length ? playedWeeks[playedWeeks.length - 1].week : 1;
  const [selWeek, setSelWeek] = useState(defaultWeek);

  // Build ranked list for selected week — sorted by team stableford total
  const weekEntries = Object.entries(pts)
    .map(([tid, weeks]) => ({ tid: parseInt(tid), ...weeks[selWeek] }))
    .filter(e => e.stab !== undefined)
    .sort((a, b) => b.stab - a.stab);

  const weekInfo = REGULAR_WEEKS.find(w => w.week === selWeek);

  return (
    <div style={{ maxWidth: "700px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "28px", fontWeight: 600, color: CREAM, letterSpacing: "0.02em", marginBottom: "4px" }}>
        Weekly Results
      </div>
      <div style={{ color: M, fontSize: "14px", marginBottom: "18px" }}>
        Total stableford points earned per team each week
      </div>

      {/* Week picker */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "18px" }}>
        {REGULAR_WEEKS.map(({ week, date }) => {
          const hasData = Object.values(pts).some(t => t[week] !== undefined);
          const isSel = week === selWeek;
          return (
            <button key={week} onClick={() => setSelWeek(week)} disabled={!hasData}
              style={{
                padding: "6px 12px", borderRadius: "8px", fontFamily: FB, fontSize: "13px",
                border: isSel ? `2px solid ${GOLD}` : `1px solid ${GOLD}33`,
                background: isSel ? GOLD + "22" : hasData ? "rgba(26,61,36,0.06)" : "transparent",
                color: isSel ? GOLD : hasData ? CREAM : M + "55",
                cursor: hasData ? "pointer" : "not-allowed",
                fontWeight: isSel ? 700 : 400,
              }}>
              W{week}
            </button>
          );
        })}
      </div>

      {weekEntries.length === 0 ? (
        <div style={{ color: M, fontSize: "14px", textAlign: "center", padding: "40px 0" }}>
          No scores recorded for Week {selWeek} yet.
        </div>
      ) : (
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{
            padding: "10px 14px", borderBottom: `1px solid ${GOLD}33`,
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <span style={{ fontFamily: FD, fontSize: "16px", color: CREAM }}>Week {selWeek}</span>
            {weekInfo?.date && <span style={{ fontSize: "13px", color: M }}>{weekInfo.date}</span>}
          </div>

          {/* Header */}
          <div style={{
            display: "grid", gridTemplateColumns: "32px 1fr 80px",
            padding: "7px 14px", borderBottom: `1px solid ${GOLD}22`,
            background: "rgba(26,61,36,0.05)"
          }}>
            {["#", "Team", "Pts"].map((h, i) => (
              <div key={i} style={{
                fontSize: "11px", color: M, letterSpacing: "0.08em", textTransform: "uppercase",
                textAlign: i >= 2 ? "center" : "left"
              }}>{h}</div>
            ))}
          </div>

          {weekEntries.map((e, idx) => {
            const rank = idx + 1;
            const rc = rank === 1 ? GO : rank === 2 ? G : rank === 3 ? CREAM : M;
            const isTop = rank <= 3;
            return (
              <div key={e.tid} style={{
                display: "grid", gridTemplateColumns: "32px 1fr 80px",
                padding: "11px 14px",
                borderBottom: idx < weekEntries.length - 1 ? `1px solid ${GOLD}11` : "none",
                background: rank === 1 ? GOLD + "08" : "transparent",
                alignItems: "center",
              }}>
                <div style={{ fontSize: "15px", fontWeight: 700, color: rc }}>{rank}</div>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: isTop ? 600 : 400, color: isTop ? CREAM : M }}>
                    {TEAMS[e.tid]?.name}
                  </div>
                  <div style={{ fontSize: "11px", color: M, marginTop: "1px" }}>
                    {TEAMS[e.tid]?.p1} · {TEAMS[e.tid]?.p2}
                  </div>
                </div>
                <div style={{
                  textAlign: "center", fontSize: "18px", fontWeight: 700,
                  color: rank === 1 ? GOLD : rank <= 3 ? G : CREAM
                }}>{e.stab}</div>
              </div>
            );
          })}

          <div style={{
            padding: "9px 14px", borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: "12px", color: M
          }}>
            Stableford total for both players on the team
          </div>
        </div>
      )}
    </div>
  );
}
