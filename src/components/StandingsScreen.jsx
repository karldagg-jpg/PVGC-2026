import { TEAMS } from "../constants/league";
import { G, GO, M, CREAM, GOLD, CARD, CARD2, FB, FD } from "../constants/theme";

export default function StandingsScreen({ teamStandings, weeklyTeamPts, movement, movementThroughWeek }) {
  const pts = weeklyTeamPts || {};
  const sorted = teamStandings || [];
  const mv = movement || {};

  const TB_LABEL = {
    override: "Tied on points — order set by commissioner (per playoff/tiebreaker rules)",
    h2h: "Tied on points — broken by head-to-head result (TB1)",
    tb2: "Tied on points — broken by result vs. common opponent (TB2)",
    stableford: "Tied on points — no rule resolved it; provisional order by Stableford. Admin can set the order.",
    multi: "Multi-team tie on points — provisional order; admin should set the order.",
  };
  function TieTag({ s }) {
    if (!s?._tieWith?.length || !s._tb) return null;
    const needsAdmin = s._tb === "stableford" || s._tb === "multi";
    return (
      <span title={TB_LABEL[s._tb] || "Tied on points"}
        style={{ fontSize: "8px", fontWeight: 800, color: needsAdmin ? "#c0392b" : GOLD, marginLeft: "2px", cursor: "help" }}>
        T{needsAdmin ? "?" : ""}
      </span>
    );
  }

  function MoveIndicator({ id }) {
    const d = mv[id];
    if (d == null) return null;
    const label = movementThroughWeek ? `through Week ${movementThroughWeek}` : "";
    if (d > 0) return <div title={`Up ${d} ${label}`} style={{ fontSize: "9px", fontWeight: 700, color: G, marginTop: "2px", lineHeight: 1 }}>▲{d}</div>;
    if (d < 0) return <div title={`Down ${-d} ${label}`} style={{ fontSize: "9px", fontWeight: 700, color: "#c0392b", marginTop: "2px", lineHeight: 1 }}>▼{-d}</div>;
    return <div title={`No change ${label}`} style={{ fontSize: "9px", fontWeight: 700, color: M, marginTop: "2px", lineHeight: 1 }}>–</div>;
  }

  const weeksWithData = [];
  for (let w = 1; w <= 18; w++) { // include the Week 18 Knockdown once it's scored
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
                    textAlign: "center", padding: "9px 8px", color: M, fontWeight: 600,
                    position: "sticky", left: 0,
                    background: "#fff", zIndex: 2, borderBottom: `1px solid ${GOLD}33`,
                    width: "36px", minWidth: "36px",
                  }}>#</th>
                  <th style={{
                    textAlign: "left", padding: "9px 12px", color: GOLD, fontWeight: 600,
                    whiteSpace: "nowrap", position: "sticky", left: "36px",
                    background: "#fff", zIndex: 2, borderBottom: `1px solid ${GOLD}33`,
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
                  const rank = i + 1;
                  const tw = pts[s.id] || {};
                  const weekTotal = weeksWithData.reduce((sum, w) => sum + (tw[w]?.totalPts || 0), 0);
                  const rowBg    = i % 2 === 0 ? "transparent" : `${GOLD}08`;
                  const stickyBg = i % 2 === 0 ? "#ffffff" : "#faf7ee";
                  const rc = rank === 1 ? GO : rank <= 3 ? G : rank <= 8 ? CREAM : M;
                  return (
                    <tr key={s.id} style={{ borderBottom: `1px solid ${GOLD}11`, background: rowBg }}>
                      <td style={{
                        textAlign: "center", padding: "9px 8px", fontWeight: 700, fontSize: "13px", color: rc,
                        position: "sticky", left: 0, background: stickyBg, zIndex: 1,
                        width: "36px",
                      }}>
                        {rank}<TieTag s={s} />
                        <MoveIndicator id={s.id} />
                      </td>
                      <td style={{
                        padding: "9px 12px", whiteSpace: "nowrap",
                        position: "sticky", left: "36px", background: stickyBg, zIndex: 1,
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
