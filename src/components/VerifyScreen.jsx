import React, { useState } from "react";
import { PAR, SI, ALL_PLAYERS, TEAMS, DEFAULT_HCP, isNewMember } from "../constants/league";
import { matchKey, getOpponent, buildGrossHistory, calcAutoHcp, stabPts, hcpStr, isWeekCancelled } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, FB, FD } from "../constants/theme";

function VerifyScreen({ league }) {
  const [selPlayer, setSelPlayer] = useState(() => {
    // default to first player
    return ALL_PLAYERS[0] ? `${ALL_PLAYERS[0].tid}-${ALL_PLAYERS[0].pi}` : "";
  });

  const player = ALL_PLAYERS.find(p => `${p.tid}-${p.pi}` === selPlayer);
  const tid = player?.tid;
  const pi  = player?.pi;

  // Build per-week rows
  const rows = [];
  if (tid != null) {
    // Precompute gross history once for system HCP per week
    for (let wk = 1; wk <= 18; wk++) {
      const opp = getOpponent(tid, wk);
      if (!opp) { rows.push({ wk, opp: null }); continue; }

      const [tlow, thigh] = tid < opp ? [tid, opp] : [opp, tid];
      const mk = matchKey(wk, tlow, thigh);
      const rec = league.results[wk]?.[mk];

      if (!rec) { rows.push({ wk, opp, mk, rec: null }); continue; }

      // Entire week cancelled due to weather — no points, no scoring
      if (isWeekCancelled(league.results[wk])) {
        rows.push({ wk, opp, mk, rec, cancelled: true });
        continue;
      }

      const tIdx = tid === tlow ? 0 : 1;
      const scores = (tIdx === 0 ? rec.t1scores : rec.t2scores)?.[pi] || Array(9).fill(0);
      const types  = (tIdx === 0 ? rec.t1types  : rec.t2types)?.[pi]  || "normal";
      const gross  = scores.reduce((s, v) => s + (v || 0), 0);

      // Sheet HCP = hcpOverride for this player this week
      const sheetHcp = league.hcpOverrides?.[`${tid}-${pi}-${wk}`] ?? null;

      // App HCP = what computePlayerTotal actually uses: snap → override → auto-calc
      const snap = rec.hcpSnapshot;
      const snapHcp = (snap && snap[tid] != null) ? (snap[tid][pi] ?? null) : null;
      const history = buildGrossHistory(league.results, wk, DEFAULT_HCP);
      const startHcp = (DEFAULT_HCP[tid] || [0, 0])[pi] || 0;
      const sysHcp = snapHcp !== null
        ? snapHcp
        : (league.hcpOverrides?.[`${tid}-${pi}-${wk}`] ?? calcAutoHcp(history[tid]?.[pi] || [], startHcp, isNewMember(tid, pi)));

      // Stableford using sheet HCP
      let stabSheet = null;
      if (types === "sub") stabSheet = 6;
      else if (types === "phantom") stabSheet = 2;
      else if (gross > 0 && sheetHcp !== null) {
        stabSheet = scores.reduce((s, g, hi) => {
          if (!g) return s;
          return s + (stabPts(g, PAR[hi], hcpStr(sheetHcp, SI[hi])) || 0);
        }, 0);
      }

      // Stableford using sys HCP
      let stabSys = null;
      if (types === "sub") stabSys = 6;
      else if (types === "phantom") stabSys = 2;
      else if (gross > 0) {
        stabSys = scores.reduce((s, g, hi) => {
          if (!g) return s;
          return s + (stabPts(g, PAR[hi], hcpStr(sysHcp, SI[hi])) || 0);
        }, 0);
      }

      rows.push({ wk, opp, mk, rec, scores, types, gross, sheetHcp, sysHcp, stabSheet, stabSys });
    }
  }

  const hcpMatch  = r => r.sheetHcp !== null && r.sheetHcp === r.sysHcp;
  const stabMatch = r => r.stabSheet !== null && r.stabSys !== null && r.stabSheet === r.stabSys;

  const TH = { padding: "7px 10px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em",
    textTransform: "uppercase", color: M, borderBottom: `2px solid ${G}33`, textAlign: "center" };
  const TD = (extra={}) => ({ padding: "6px 10px", fontSize: "13px", textAlign: "center",
    borderBottom: `1px solid ${G}18`, color: CREAM, ...extra });

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px 14px" }}>
      <div style={{ fontFamily: FD, fontSize: "26px", fontWeight: 700, color: CREAM, marginBottom: "18px" }}>
        Data Verification
      </div>

      {/* Player selector */}
      <div style={{ marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "13px", color: M, textTransform: "uppercase", letterSpacing: "0.08em" }}>Player</span>
        <select value={selPlayer} onChange={e => setSelPlayer(e.target.value)}
          style={{ background: "#fff", border: `2px solid ${G}`, borderRadius: "10px",
            color: CREAM, fontFamily: FB, fontSize: "15px", fontWeight: 600,
            padding: "10px 14px", cursor: "pointer", outline: "none", minWidth: "260px" }}>
          {Object.entries(TEAMS).map(([t, tm]) => (
            <optgroup key={t} label={`T${t}: ${tm.name}`}>
              <option value={`${t}-0`}>T{t} · {tm.p1}</option>
              <option value={`${t}-1`}>T{t} · {tm.p2}</option>
            </optgroup>
          ))}
        </select>
        {player && (
          <span style={{ fontSize: "14px", color: G, fontWeight: 600 }}>
            {player.name} — {TEAMS[tid]?.name}
          </span>
        )}
      </div>

      {player && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff",
            borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 8px rgba(26,61,36,0.10)" }}>
            <thead>
              <tr style={{ background: G + "18" }}>
                <th style={TH}>Wk</th>
                <th style={TH}>Opp</th>
                <th style={TH}>Type</th>
                <th style={{...TH, textAlign:"left"}}>Holes (gross)</th>
                <th style={TH}>Total</th>
                <th style={TH}>HCP<br/><span style={{color:GO,fontWeight:400}}>Sheet</span></th>
                <th style={TH}>HCP<br/><span style={{color:G,fontWeight:400}}>Sys</span></th>
                <th style={TH}>HCP<br/>Δ</th>
                <th style={TH}>Stab<br/><span style={{color:GO,fontWeight:400}}>Sheet</span></th>
                <th style={TH}>Stab<br/><span style={{color:G,fontWeight:400}}>Sys</span></th>
                <th style={TH}>Stab<br/>Δ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                if (!r.opp) return (
                  <tr key={r.wk} style={{ background: "#fafaf8" }}>
                    <td style={TD()}>{r.wk}</td>
                    <td style={{...TD(), color: M}} colSpan={10}>Bye</td>
                  </tr>
                );
                if (!r.rec) return (
                  <tr key={r.wk} style={{ background: "#fafaf8" }}>
                    <td style={TD()}>{r.wk}</td>
                    <td style={TD()}>T{r.opp}</td>
                    <td style={{...TD(), color: M}} colSpan={9}>No data</td>
                  </tr>
                );
                if (r.cancelled) return (
                  <tr key={r.wk} style={{ background: "#f5f5f5" }}>
                    <td style={TD()}>{r.wk}</td>
                    <td style={TD()}>T{r.opp}</td>
                    <td style={{...TD(), color: "#888", fontStyle: "italic"}} colSpan={9}>Cancelled — weather</td>
                  </tr>
                );

                const hcpDelta = r.sheetHcp !== null ? r.sysHcp - r.sheetHcp : null;
                const stabDelta = r.stabSheet !== null && r.stabSys !== null ? r.stabSys - r.stabSheet : null;
                const rowBg = r.types === "normal" && (!hcpMatch(r) || !stabMatch(r)) ? "#fff8f0" : "#fff";

                return (
                  <tr key={r.wk} style={{ background: rowBg }}>
                    <td style={TD({ fontWeight: 700 })}>{r.wk}</td>
                    <td style={TD()}>T{r.opp}<br/><span style={{fontSize:"11px",color:M}}>{TEAMS[r.opp]?.name?.split(" - ")[0]}</span></td>
                    <td style={TD({ fontSize: "12px", color: r.types === "normal" ? CREAM : GO })}>
                      {r.types === "normal" ? "Reg" : r.types === "sub" ? "Sub" : "Phantom"}
                    </td>
                    {/* Per-hole scores or Sub/Phantom label */}
                    {r.types !== "normal" ? (
                      <td colSpan={2} style={TD({ color: GO, fontWeight: 700, fontStyle: "italic", textAlign: "center" })}>
                        {r.types === "sub" ? "Sub — 6 pts" : "Phantom — 2 pts"}
                      </td>
                    ) : (
                      <>
                        <td style={{ ...TD(), textAlign: "left", fontFamily: "monospace", fontSize: "12px", padding: "6px 8px" }}>
                          {r.scores.map((g, hi) => {
                            const strokes = hcpStr(r.sheetHcp ?? r.sysHcp, SI[hi]);
                            const pts = g ? stabPts(g, PAR[hi], strokes) : null;
                            const color = pts === null ? "#bbb" : pts >= 3 ? G : pts === 1 ? GOLD : pts === 0 ? "#888" : R;
                            return (
                              <span key={hi} style={{ marginRight: "4px", color }}>
                                {g || "·"}{strokes > 0 ? "•".repeat(strokes) : ""}
                              </span>
                            );
                          })}
                        </td>
                        <td style={TD({ fontWeight: 700 })}>{r.gross}</td>
                      </>
                    )}
                    {/* HCPs */}
                    <td style={TD({ color: GO, fontWeight: 600 })}>{r.types !== "normal" ? "—" : (r.sheetHcp ?? "—")}</td>
                    <td style={TD({ color: G,  fontWeight: 600 })}>{r.types !== "normal" ? "—" : r.sysHcp}</td>
                    <td style={TD({
                      fontWeight: 700,
                      color: r.types !== "normal" ? M : hcpDelta === null ? M : hcpDelta === 0 ? G : R,
                    })}>
                      {r.types !== "normal" ? "—" : hcpDelta === null ? "—" : hcpDelta === 0 ? "✓" : (hcpDelta > 0 ? "+" : "") + hcpDelta}
                    </td>
                    {/* Stableford */}
                    <td style={TD({ color: GO, fontWeight: 600 })}>{r.stabSheet ?? "—"}</td>
                    <td style={TD({ color: G,  fontWeight: 600 })}>{r.stabSys ?? "—"}</td>
                    <td style={TD({
                      fontWeight: 700,
                      color: stabDelta === null ? M : stabDelta === 0 ? G : R,
                    })}>
                      {stabDelta === null ? "—" : stabDelta === 0 ? "✓" : (stabDelta > 0 ? "+" : "") + stabDelta}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Legend */}
          <div style={{ marginTop: "12px", fontSize: "12px", color: M, display: "flex", gap: "20px", flexWrap: "wrap" }}>
            <span><span style={{ color: GO }}>■</span> Sheet = value from Excel import</span>
            <span><span style={{ color: G }}>■</span> Sys = system auto-calculation</span>
            <span><span style={{ color: R }}>■</span> Δ mismatch — row highlighted orange</span>
            <span>Holes: score followed by • = handicap stroke(s) received</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default VerifyScreen;
