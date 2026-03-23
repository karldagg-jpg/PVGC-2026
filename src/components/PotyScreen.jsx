import { SCHEDULE } from "../constants/league";
import { G, GO, M, CREAM, GOLD, CARD2, FD, FB } from "../constants/theme";
import { fmtDate } from "../lib/format";
import { Tag } from "./ui";

function PotyScreen({ potyTab, setPotyTab, potyList, weeklyPoty, cancelledWeeks }) {
  return (
    <div style={{ maxWidth: "820px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "28px", marginBottom: "4px", fontWeight: 600, color: CREAM }}>
        Player of the Year
      </div>
      <div style={{ color: M, fontSize: "14px", marginBottom: "18px" }}>
        Individual stableford points · Weekly cash payout · Season champion
      </div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "18px" }}>
        {["season", "weekly"].map((t) => (
          <button
            key={t}
            onClick={() => setPotyTab(t)}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              fontFamily: FB,
              fontSize: "13px",
              letterSpacing: "0.07em",
              textTransform: "uppercase",
              cursor: "pointer",
              border: potyTab === t ? `1px solid ${GO}` : `1px solid ${GOLD}33`,
              background: potyTab === t ? GO + "22" : "transparent",
              color: potyTab === t ? GO : M,
            }}
          >
            {t === "season" ? "Season Standings" : "Weekly Results"}
          </button>
        ))}
      </div>

      {potyTab === "season" && (
        <>
          <div style={{ background: GO + "0d", border: `1px solid ${GO}33`, borderRadius: "13px", padding: "10px 14px", marginBottom: "14px", fontSize: "13px", color: M }}>
            ⚡ Season total drops the <span style={{ color: GO }}>2 lowest rounds</span> per player at season end.
            Scores shown are current running totals (all rounds included until season ends).
          </div>
          <div style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", minWidth: "460px" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${GOLD}33`, background: "rgba(26,61,36,0.05)" }}>
                    {["#", "Player", "Team", "Rounds", "Cur. Total", "Drop-2 Total", ""].map((h, i) => (
                      <td key={i} style={{ padding: "9px 10px", color: M, textAlign: i >= 3 ? "center" : "left", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {h}
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {potyList.map((p, idx) => {
                    const rank = idx + 1;
                    const rc = rank === 1 ? GO : rank === 2 ? "#c0a060" : rank === 3 ? G : CREAM;
                    const curTotal = p.rounds.reduce((s, r) => s + r.pts, 0);
                    return (
                      <tr key={`${p.tid}-${p.pi}`} style={{ borderBottom: `1px solid ${GOLD}22` }}>
                        <td style={{ padding: "9px 10px", fontWeight: 700, color: rc, fontSize: "13px" }}>{rank}</td>
                        <td style={{ padding: "9px 10px", fontWeight: rank <= 3 ? 600 : 400, color: rank <= 3 ? CREAM : M }}>{p.name}</td>
                        <td style={{ padding: "9px 10px", fontSize: "13px", color: M }}>{p.team}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: M }}>{p.rounds.length}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center", color: M }}>{curTotal}</td>
                        <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: rank <= 3 ? 700 : 400, fontSize: rank === 1 ? "15px" : "12px", color: rc }}>
                          {p.total}
                        </td>
                        <td style={{ padding: "9px 10px" }}>
                          {rank === 1 && p.rounds.length > 0 && <Tag color={GO}>Leader</Tag>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {potyTab === "weekly" && (
        <div style={{ display: "grid", gap: "8px" }}>
          {Array.from({ length: 17 }, (_, i) => i + 1).map((w) => {
            const wr = weeklyPoty[w];
            if (!wr) {
              const isCancelled = cancelledWeeks?.has(w);
              return (
                <div key={w} style={{ background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px", padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "14px", color: M }}>Week {w} — {fmtDate(SCHEDULE[w]?.date)}</span>
                  <Tag color={M}>{isCancelled ? "Cancelled" : "Not scored"}</Tag>
                </div>
              );
            }
            const isTie = wr.winners.length > 1;
            return (
              <div key={w} style={{ background: GO + "0d", border: `1px solid ${GO}33`, borderRadius: "12px", padding: "11px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "14px", color: GO, fontFamily: FD }}>Week {w} — {fmtDate(SCHEDULE[w]?.date)}</span>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {isTie && <Tag color={GO}>Split payout</Tag>}
                    {!isTie && <Tag color={GO}>Winner</Tag>}
                  </div>
                </div>
                {wr.winners.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: i < wr.winners.length - 1 ? "6px" : 0 }}>
                    <span style={{ color: GO, fontSize: "14px" }}>★</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: CREAM }}>{p.name}</div>
                      <div style={{ fontSize: "13px", color: M }}>{p.team}</div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: "15px", fontWeight: 700, color: GO }}>{wr.pts} pts</div>
                      <div style={{ fontSize: "12px", color: M }}>stableford</div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PotyScreen;
