import { ALL_PLAYERS, TEAMS, DEFAULT_HCP, isNewMember } from "../constants/league";
import { G, GO, R, M, CREAM, GOLD, CARD2, FD, FB } from "../constants/theme";
import { getEffectiveHcp, getOpponent, matchKey } from "../lib/leagueLogic";

function HandicapScreen({
  hcpUnlocked,
  setHcpUnlocked,
  hcpPin,
  setHcpPin,
  hcpPinErr,
  setHcpPinErr,
  league,
  saveLeague,
}) {
  const tryUnlock = () => {
    if (hcpPin === "2026pvgc") {
      setHcpUnlocked(true);
      setHcpPin("");
    } else {
      setHcpPin("");
      setHcpPinErr(true);
      setTimeout(() => setHcpPinErr(false), 2000);
    }
  };

  if (!hcpUnlocked) {
    return (
      <div
        style={{
          maxWidth: "340px",
          margin: "80px auto",
          padding: "32px",
          background: "rgba(255,255,255,0.6)",
          border: `1px solid ${GOLD}44`,
          borderRadius: "12px",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: FD, fontSize: "26px", color: CREAM, marginBottom: "6px" }}>
          Handicap Access
        </div>
        <div style={{ fontSize: "12px", color: M, marginBottom: "24px", fontFamily: FB }}>
          Commissioner access only
        </div>
        <input
          type="password"
          placeholder="Enter PIN"
          value={hcpPin}
          onChange={(e) => setHcpPin(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") tryUnlock();
          }}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.7)",
            border: `1px solid ${GOLD}44`,
            borderRadius: "8px",
            color: CREAM,
            fontFamily: FB,
            fontSize: "16px",
            padding: "12px 16px",
            textAlign: "center",
            outline: "none",
            letterSpacing: "0.3em",
            marginBottom: "13px",
          }}
        />
        {hcpPinErr && (
          <div style={{ color: R, fontSize: "14px", marginBottom: "13px", fontFamily: FB }}>
            Incorrect PIN
          </div>
        )}
        <button
          onClick={tryUnlock}
          style={{
            width: "100%",
            padding: "12px",
            background: GOLD + "22",
            border: `1px solid ${GOLD}55`,
            borderRadius: "8px",
            color: GOLD,
            fontFamily: FB,
            fontSize: "12px",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          Unlock
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
        <div style={{ fontFamily: FD, fontSize: "28px", fontWeight: 600, color: CREAM }}>Handicaps</div>
        <button
          onClick={() => setHcpUnlocked(false)}
          style={{
            fontSize: "13px",
            padding: "5px 10px",
            background: "rgba(192,57,43,0.15)",
            border: "1px solid rgba(192,57,43,0.4)",
            borderRadius: "6px",
            color: R,
            fontFamily: FB,
            cursor: "pointer",
            letterSpacing: "0.08em",
          }}
        >
          Lock
        </button>
      </div>
      <div style={{ color: M, fontSize: "14px", marginBottom: "16px" }}>
        9-hole handicaps · Auto-calculated after each round · Locked after Week 18
      </div>

      <div style={{ overflowX: "auto", background: CARD2, border: `1px solid ${GOLD}22`, borderRadius: "12px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", minWidth: "900px" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${GOLD}33`, background: "rgba(26,61,36,0.07)" }}>
              <td style={{ padding: "9px 12px", fontWeight: 700, color: CREAM, fontSize: "13px", position: "sticky", left: 0, background: "rgba(240,236,224,0.98)", zIndex: 2, whiteSpace: "nowrap" }}>Player</td>
              <td style={{ padding: "9px 8px", fontWeight: 700, color: M, fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>Team</td>
              <td style={{ padding: "9px 8px", fontWeight: 700, color: GOLD, fontSize: "12px", textAlign: "center", borderRight: `2px solid ${GOLD}44` }}>Start</td>
              {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => (
                <td
                  key={w}
                  style={{
                    padding: "9px 6px",
                    fontWeight: 600,
                    color: M,
                    fontSize: "11px",
                    textAlign: "center",
                    letterSpacing: "0.04em",
                    borderRight: w === 18 ? `2px solid ${GOLD}44` : `1px solid ${GOLD}11`,
                  }}
                >
                  W{w}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PLAYERS.map((player, rowIdx) => {
              const { tid, pi, name } = player;
              const team = TEAMS[tid];
              const startHcp = (DEFAULT_HCP[tid] || [0, 0])[pi];
              const isNew = isNewMember(tid, pi);
              const isEvenRow = rowIdx % 2 === 0;
              const isNewTeam = rowIdx > 0 && ALL_PLAYERS[rowIdx - 1].tid !== tid;
              return (
                <tr
                  key={`${tid}-${pi}`}
                  style={{
                    borderTop: isNewTeam ? `2px solid ${GOLD}33` : `1px solid ${GOLD}11`,
                    background: isEvenRow ? "transparent" : "rgba(26,61,36,0.02)",
                  }}
                >
                  <td
                    style={{
                      padding: "8px 12px",
                      fontWeight: 600,
                      color: CREAM,
                      position: "sticky",
                      left: 0,
                      background: isEvenRow ? "rgba(240,236,224,0.98)" : "rgba(235,231,218,0.98)",
                      zIndex: 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {name}
                    {isNew && (
                      <span style={{ marginLeft: "5px", fontSize: "10px", color: "#f0a050", border: "1px solid #f0a05055", borderRadius: "3px", padding: "1px 4px" }}>
                        New
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 8px", color: M, fontSize: "12px", whiteSpace: "nowrap" }}>{team?.name}</td>
                  <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, color: GOLD, fontSize: "14px", borderRight: `2px solid ${GOLD}44` }}>
                    {startHcp}
                  </td>
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((w) => {
                    const isLocked = w >= 18;
                    const autoHcp = getEffectiveHcp(tid, pi, w, league.results, league.handicaps, {});
                    const overrideKey = `${tid}-${pi}-${w}`;
                    const override = (league.hcpOverrides || {})[overrideKey];
                    const displayVal = override !== undefined ? override : autoHcp;
                    const opp = getOpponent(tid, w);
                    const mk = opp ? matchKey(w, Math.min(tid, opp), Math.max(tid, opp)) : null;
                    const rec = mk ? league.results[w]?.[mk] : null;
                    const played = !!rec;
                    const isRainout = rec?.rainout;
                    const tIdx = opp && tid < opp ? 0 : 1;
                    const scores = rec ? (tIdx === 0 ? rec.t1scores : rec.t2scores) : null;
                    const gross = scores ? (scores[pi] || []).reduce((s, v) => s + (v || 0), 0) : 0;
                    const prevPlayed =
                      w === 1 ||
                      (() => {
                        const prevOpp = getOpponent(tid, w - 1);
                        return prevOpp && !!league.results[w - 1]?.[matchKey(w - 1, Math.min(tid, prevOpp), Math.max(tid, prevOpp))];
                      })();
                    const showHcp = w === 1 || played || prevPlayed;

                    return (
                      <td
                        key={w}
                        style={{
                          padding: "3px 4px",
                          textAlign: "center",
                          verticalAlign: "middle",
                          borderRight: w === 18 ? `2px solid ${GOLD}44` : `1px solid ${GOLD}11`,
                        }}
                      >
                        {showHcp ? (
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1px" }}>
                            {isLocked ? (
                              <span style={{ fontWeight: 600, color: G, fontSize: "13px" }}>{displayVal}</span>
                            ) : (
                              <input
                                type="number"
                                min="-9"
                                max={isNew ? 99 : startHcp + 2}
                                value={override !== undefined ? override : autoHcp}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const next = { ...league, hcpOverrides: { ...(league.hcpOverrides || {}) } };
                                  if (v === "") delete next.hcpOverrides[overrideKey];
                                  else next.hcpOverrides[overrideKey] = parseInt(v) || 0;
                                  saveLeague(next);
                                }}
                                style={{
                                  width: "36px",
                                  height: "26px",
                                  textAlign: "center",
                                  background: override !== undefined ? "#fff8e6" : "transparent",
                                  border: override !== undefined ? `1px solid ${GOLD}88` : "1px solid transparent",
                                  borderRadius: "4px",
                                  color: override !== undefined ? GOLD : G,
                                  fontWeight: 600,
                                  fontSize: "13px",
                                  fontFamily: FB,
                                  outline: "none",
                                  MozAppearance: "textfield",
                                  appearance: "textfield",
                                }}
                              />
                            )}
                            {played &&
                              (isRainout ? (
                                <span style={{ fontSize: "9px", color: GO, fontWeight: 600, letterSpacing: "0.04em" }}>R</span>
                              ) : gross > 0 ? (
                                <span style={{ fontSize: "10px", color: M }}>{gross}</span>
                              ) : null)}
                          </div>
                        ) : (
                          <span style={{ color: "#ccc", fontSize: "12px" }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: "10px", fontSize: "12px", color: M, display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <span><span style={{ color: G, fontWeight: 700 }}>Green</span> = auto HCP</span>
        <span><span style={{ color: GOLD, fontWeight: 700 }}>Gold</span> = overridden</span>
        <span>Small number = gross score shot</span>
        <span><span style={{ color: GO, fontWeight: 700 }}>R</span> = rainout</span>
        <span><span style={{ color: "#ccc" }}>—</span> = not yet reached</span>
      </div>
    </div>
  );
}

export default HandicapScreen;
