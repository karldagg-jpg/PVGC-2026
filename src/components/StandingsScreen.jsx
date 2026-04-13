import { TEAMS } from "../constants/league";
import { G, GO, R, M, CREAM, GOLD, CARD2, FD } from "../constants/theme";
import { Tag } from "./ui";

function ptColor(pts) {
  if (pts === undefined) return "transparent";
  if (pts >= 12) return G + "cc";
  if (pts >= 8)  return G + "66";
  if (pts >= 4)  return GOLD + "55";
  return R + "44";
}

function StandingsScreen({ teamStandings, weeklyTeamPts = {} }) {
  // Determine which weeks have any data
  const playedWeeks = [];
  for (let w = 1; w <= 17; w++) {
    const hasData = teamStandings.some(t => weeklyTeamPts[t.id]?.[w] !== undefined);
    if (hasData) playedWeeks.push(w);
  }
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
          overflow: "hidden",
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
      {playedWeeks.length > 0 && (
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", overflow: "hidden", marginBottom: "20px" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: CREAM }}>Week-by-Week Points</span>
            <span style={{ fontSize: "12px", color: M }}>total pts per match</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: `${220 + playedWeeks.length * 42}px` }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${GOLD}33`, background: "rgba(26,61,36,0.05)" }}>
                  <td style={{ padding: "7px 10px", color: M, fontSize: "12px", letterSpacing: "0.07em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Team</td>
                  {playedWeeks.map(w => (
                    <td key={w} style={{ padding: "7px 6px", textAlign: "center", color: M, fontSize: "12px", minWidth: "38px" }}>W{w}</td>
                  ))}
                  <td style={{ padding: "7px 8px", textAlign: "center", color: G, fontSize: "12px", fontWeight: 600 }}>Total</td>
                </tr>
              </thead>
              <tbody>
                {teamStandings.map((s, idx) => {
                  const rank = idx + 1;
                  const inPlayoffs = rank <= 8;
                  // running cumulative for sparkline
                  let cumulative = 0;
                  return (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${GOLD}11`, background: inPlayoffs ? "rgba(184,150,46,0.02)" : "transparent" }}>
                      <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: rank === 1 ? GO : rank <= 3 ? G : inPlayoffs ? CREAM : M, width: "16px" }}>{rank}</span>
                          <div>
                            <div style={{ fontSize: "13px", color: inPlayoffs ? CREAM : M, fontWeight: 600 }}>{TEAMS[s.id]?.name}</div>
                            <div style={{ fontSize: "11px", color: M }}>{TEAMS[s.id]?.p1} · {TEAMS[s.id]?.p2}</div>
                          </div>
                        </div>
                      </td>
                      {playedWeeks.map(w => {
                        const wk = weeklyTeamPts[s.id]?.[w];
                        const pts = wk?.totalPts;
                        if (pts !== undefined) cumulative += pts;
                        return (
                          <td key={w} style={{ padding: "4px 3px", textAlign: "center" }}>
                            {pts !== undefined ? (
                              <div style={{
                                margin: "0 auto", width: "30px", height: "26px", borderRadius: "5px",
                                background: ptColor(pts),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: "13px", fontWeight: pts >= 8 ? 700 : 400,
                                color: pts >= 8 ? CREAM : pts >= 4 ? CREAM + "bb" : CREAM + "66",
                              }}>{pts}</div>
                            ) : (
                              <div style={{ width: "30px", height: "26px", margin: "0 auto", borderRadius: "5px", background: "rgba(255,255,255,0.02)" }} />
                            )}
                          </td>
                        );
                      })}
                      <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, color: inPlayoffs ? G : M, fontSize: "14px" }}>
                        {s.totalPts}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "8px 14px", borderTop: "1px solid rgba(255,255,255,0.05)", fontSize: "11px", color: M, display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <span><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", background: G + "cc", verticalAlign: "middle", marginRight: "3px" }} />12+ pts</span>
            <span><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", background: G + "66", verticalAlign: "middle", marginRight: "3px" }} />8–11 pts</span>
            <span><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", background: GOLD + "55", verticalAlign: "middle", marginRight: "3px" }} />4–7 pts</span>
            <span><span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "2px", background: R + "44", verticalAlign: "middle", marginRight: "3px" }} />0–3 pts</span>
          </div>
        </div>
      )}

    </div>
  );
}

export default StandingsScreen;
