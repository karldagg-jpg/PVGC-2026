import { TEAMS } from "../constants/league";
import { G, GO, R, M, CREAM, GOLD, CARD2, FD } from "../constants/theme";
import { Tag } from "./ui";

function StandingsScreen({ teamStandings }) {
  return (
    <div style={{ maxWidth: "860px", margin: "0 auto", padding: "22px 14px" }}>
      <div
        style={{
          fontFamily: FD,
          fontSize: "28px",
          marginBottom: "4px",
          fontWeight: 600,
          color: CREAM,
          letterSpacing: "0.02em",
        }}
      >
        Leaderboard
      </div>
      <div style={{ color: M, fontSize: "14px", marginBottom: "18px" }}>
        Total pts = Match pts (head-to-head) + Bonus pts (weekly stableford rank
        8/6/4/2)
      </div>

      <div
        style={{
          background: CARD2,
          border: `1px solid ${GOLD}22`,
          borderRadius: "12px",
          overflow: "clip",
          marginBottom: "20px",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
              minWidth: "580px",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${GOLD}33`,
                  background: "rgba(26,61,36,0.05)",
                }}
              >
                {[
                  "#",
                  "Team",
                  "W",
                  "L",
                  "T",
                  "Match Pts",
                  "Bonus Pts",
                  "Total Pts",
                  "Played",
                  "",
                ].map((h, i) => (
                  <td
                    key={i}
                    style={{
                      padding: "9px 10px",
                      color: M,
                      textAlign: i >= 2 ? "center" : "left",
                      fontSize: "12px",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      position: "sticky",
                      top: 0,
                      zIndex: 2,
                      background: CARD2,
                      borderBottom: `1px solid ${GOLD}33`,
                    }}
                  >
                    {h}
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {teamStandings.map((s, idx) => {
                const rank = idx + 1;
                const inPlayoffs = rank <= 8;
                const rc = rank === 1 ? GO : rank <= 3 ? G : inPlayoffs ? CREAM : M;
                return (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: `1px solid ${GOLD}22`,
                      background: inPlayoffs ? "rgba(184,150,46,0.03)" : "transparent",
                    }}
                  >
                    <td style={{ padding: "10px 10px", fontWeight: 700, color: rc, fontSize: "13px" }}>
                      {rank}
                    </td>
                    <td style={{ padding: "10px 10px" }}>
                      <div style={{ fontSize: "14px", color: inPlayoffs ? CREAM : M }}>
                        {TEAMS[s.id]?.name}
                      </div>
                      <div style={{ fontSize: "12px", color: M, marginTop: "1px" }}>
                        {TEAMS[s.id]?.p1} · {TEAMS[s.id]?.p2}
                      </div>
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center", color: G, fontWeight: 600 }}>
                      {s.wins}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center", color: R }}>
                      {s.losses}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center", color: M }}>
                      {s.ties}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center", color: "#c0a060" }}>
                      {s.matchPts}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center", color: G }}>
                      {s.bonusPts}
                    </td>
                    <td
                      style={{
                        padding: "10px 10px",
                        textAlign: "center",
                        fontWeight: 700,
                        fontSize: "13px",
                        color: inPlayoffs ? G : M,
                      }}
                    >
                      {s.totalPts}
                    </td>
                    <td style={{ padding: "10px 10px", textAlign: "center", color: M }}>
                      {s.played}
                    </td>
                    <td style={{ padding: "10px 10px" }}>
                      {rank <= 8 && s.played > 0 && <Tag color={G}>Playoffs</Tag>}
                      {rank === 8 && <Tag color={GO}>Bubble</Tag>}
                      {rank === 9 && <Tag color={GO}>Bubble</Tag>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: "12px",
            color: M,
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
          }}
        >
          <span>
            <span style={{ color: G }}>●</span> Top 8 qualify for playoffs · Ranks 8 & 9 =
            Bubble
          </span>
          <span>Match pts: Win=2, Tie=1, Loss=0</span>
          <span>Bonus pts: 1st-2nd=8, 3rd-4th=6, 5th-6th=4, 7th-8th+=2 per week</span>
        </div>
      </div>
    </div>
  );
}

export default StandingsScreen;
