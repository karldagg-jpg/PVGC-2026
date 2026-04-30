import { TEAMS } from "../constants/league";
import { G, GO, M, CREAM, GOLD, CARD, CARD2, FB, FD } from "../constants/theme";

export default function StandingsScreen({ teamStandings, weeklyTeamPts }) {
  const pts = weeklyTeamPts || {};
  const sorted = teamStandings || [];

  const weeksWithData = [];
  for (let w = 1; w <= 17; w++) {
    if (Object.values(pts).some(tw => tw[w] != null)) weeksWithData.push(w);
  }

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "28px", fontWeight: 600, color: CREAM, letterSpacing: "0.02em", marginBottom: "4px" }}>
        Standings
      </div>
      <div style={{ color: M, fontSize: "14px", marginBottom: "18px" }}>
        Total points per team each week · hover a cell for match vs bonus split
      </div>

      {weeksWithData.length === 0 ? (
        <div style={{ textAlign: "center", color: M, padding: "40px 0", fontSize: "14px" }}>
          No scores recorded yet.
        </div>
      ) : (
        <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", fontFamily: FB }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${GOLD}33`, background: "rgba(26,61,36,0.05)" }}>
                  <th style={{
                    textAlign: "left", padding: "9px 12px", color: GOLD, fontWeight: 600,
                    whiteSpace: "nowrap", position: "sticky", left: 0,
                    background: CARD2, zIndex: 2, borderBottom: `1px solid ${GOLD}33`,
                    minWidth: "140px",
                  }}>Team</th>
                  {weeksWithData.map(w => (
                    <th key={w} style={{
                      textAlign: "center", padding: "9px 6px", color: M, fontWeight: 600,
                      minWidth: "36px", borderBottom: `1px solid ${GOLD}33`,
                      background: CARD2,
                    }}>W{w}</th>
                  ))}
                  <th style={{
                    textAlign: "center", padding: "9px 10px", color: GOLD, fontWeight: 700,
                    minWidth: "46px", borderBottom: `1px solid ${GOLD}33`,
                    background: CARD2,
                  }}>Tot</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const tw = pts[s.id] || {};
                  const weekTotal = weeksWithData.reduce((sum, w) => sum + (tw[w]?.totalPts || 0), 0);
                  const rowBg = i % 2 === 0 ? "transparent" : `${GOLD}08`;
                  const stickyBg = i % 2 === 0 ? CARD2 : `${GOLD}12`;
                  return (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${GOLD}11`, background: rowBg }}>
                      <td style={{
                        padding: "9px 12px", whiteSpace: "nowrap",
                        position: "sticky", left: 0, background: stickyBg, zIndex: 1,
                      }}>
                        <div style={{ fontSize: "13px", color: CREAM, fontWeight: 500 }}>
                          {TEAMS[s.id]?.name || `Team ${s.id}`}
                        </div>
                        <div style={{ fontSize: "10px", color: M, marginTop: "1px" }}>
                          {TEAMS[s.id]?.p1} · {TEAMS[s.id]?.p2}
                        </div>
                      </td>
                      {weeksWithData.map(w => {
                        const entry = tw[w];
                        return (
                          <td key={w} style={{ textAlign: "center", padding: "9px 6px", color: entry ? CREAM : M }}>
                            {entry
                              ? <span title={`Match: ${entry.matchPts}  Bonus: ${entry.bonusPts}`} style={{ fontWeight: 600 }}>{entry.totalPts}</span>
                              : "—"}
                          </td>
                        );
                      })}
                      <td style={{ textAlign: "center", padding: "9px 10px", color: GOLD, fontWeight: 700, fontSize: "14px" }}>
                        {weekTotal || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "9px 14px", borderTop: "1px solid rgba(255,255,255,0.06)", fontSize: "11px", color: M }}>
            Points per week = Match pts (Win 2 / Tie 1 / Loss 0) + Bonus pts (weekly stableford rank 8/6/4/2)
          </div>
        </div>
      )}
    </div>
  );
}
