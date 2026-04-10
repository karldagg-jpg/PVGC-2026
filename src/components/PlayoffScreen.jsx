import React from "react";
import { TEAMS, SCHEDULE } from "../constants/league";
import { matchKey, computeTeamTotal, getPlayoffWinner } from "../lib/leagueLogic";
import { G, GO, R, M, CREAM, GOLD, CARD, CARD2, FB, FD } from "../constants/theme";
import { fmtDate } from "../lib/format";

// ── Helpers ──────────────────────────────────────────────────────
function getRec(league, week, ta, tb) {
  if (!ta || !tb) return null;
  const mk = matchKey(week, Math.min(ta, tb), Math.max(ta, tb));
  return league.results[week]?.[mk] || null;
}

function getScore(rec, tid, ta, tb, handicaps) {
  if (!rec) return null;
  const tlow = Math.min(ta, tb);
  const tIdx = tid === tlow ? 0 : 1;
  return computeTeamTotal(rec, tIdx, tid, handicaps);
}

function hasScores(rec) {
  if (!rec) return false;
  const flat = (arr) => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr.flat();
    return [...(arr.p0 || []), ...(arr.p1 || [])];
  };
  return flat(rec.t1scores).some(v => v > 0) || flat(rec.t2scores).some(v => v > 0);
}

// ── Match Card ───────────────────────────────────────────────────
function MatchCard({ week, ta, tb, seedA, seedB, league, label, dim }) {
  const rec = getRec(league, week, ta, tb);
  const played = hasScores(rec);
  const scoreA = played ? getScore(rec, ta, ta, tb, league.handicaps) : null;
  const scoreB = played ? getScore(rec, tb, ta, tb, league.handicaps) : null;
  const winner = played ? getPlayoffWinner(week, ta, tb, league.results) : null;
  const winA = winner === ta;
  const winB = winner === tb;
  const nameA = TEAMS[ta]?.name || `Team ${ta}`;
  const nameB = TEAMS[tb]?.name || `Team ${tb}`;
  const dateStr = SCHEDULE[week]?.date ? fmtDate(SCHEDULE[week].date) : "";

  return (
    <div style={{
      background: dim ? "rgba(26,61,36,0.03)" : CARD2,
      border: `1px solid ${played ? G + "55" : GOLD + "22"}`,
      borderRadius: "10px", overflow: "hidden", minWidth: "160px", width: "100%",
      opacity: dim ? 0.55 : 1,
    }}>
      {label && (
        <div style={{
          padding: "4px 10px", fontSize: "10px", letterSpacing: "0.1em",
          textTransform: "uppercase", color: M, fontWeight: 600,
          borderBottom: `1px solid ${GOLD}22`,
          background: "rgba(26,61,36,0.04)"
        }}>
          {label}{dateStr ? ` · ${dateStr}` : ""}
        </div>
      )}
      {[{ tid: ta, seed: seedA, score: scoreA, win: winA }, { tid: tb, seed: seedB, score: scoreB, win: winB }].map(({ tid, seed, score, win }, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: "7px",
          padding: "8px 10px",
          borderBottom: i === 0 ? `1px solid ${GOLD}18` : "none",
          background: win ? G + "0d" : "transparent",
        }}>
          {seed != null && (
            <span style={{
              fontSize: "9px", fontWeight: 700, color: win ? G : M,
              width: "14px", textAlign: "center", flexShrink: 0,
              letterSpacing: "0.04em"
            }}>#{seed}</span>
          )}
          <span style={{
            flex: 1, fontSize: "13px", fontWeight: win ? 700 : 400,
            color: win ? CREAM : M,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {TEAMS[tid]?.name || `T${tid}`}
          </span>
          {score !== null ? (
            <span style={{
              fontSize: "14px", fontWeight: 700,
              color: win ? G : played ? M : M,
              minWidth: "22px", textAlign: "right", flexShrink: 0
            }}>
              {score}{win && <span style={{ fontSize: "10px", marginLeft: "3px" }}>✓</span>}
            </span>
          ) : (
            <span style={{ fontSize: "11px", color: M + "88", flexShrink: 0 }}>—</span>
          )}
        </div>
      ))}
    </div>
  );
}

function TBDCard({ label }) {
  return (
    <div style={{
      background: "rgba(26,61,36,0.02)", border: `1px dashed ${GOLD}22`,
      borderRadius: "10px", minWidth: "160px", width: "100%",
      padding: "18px 12px", textAlign: "center",
    }}>
      {label && (
        <div style={{ fontSize: "10px", color: M, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>
          {label}
        </div>
      )}
      <div style={{ fontSize: "12px", color: M + "66" }}>TBD</div>
    </div>
  );
}

// ── Bracket connector (visual line between rounds) ───────────────
function Connector() {
  return (
    <div style={{
      display: "flex", alignItems: "center", padding: "0 4px", flexShrink: 0,
      color: GOLD + "55", fontSize: "18px", alignSelf: "center"
    }}>→</div>
  );
}

// ── Bracket pair (two QF matches feeding into one SF match) ──────
function BracketPair({ matchA, matchB, sfMatch }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0", flex: 1 }}>
      {/* QF column */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
        {matchA}
        {matchB}
      </div>
      {/* Connector */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "0 6px", alignSelf: "stretch", justifyContent: "center",
        flexShrink: 0
      }}>
        <div style={{
          width: "12px", borderTop: `1px solid ${GOLD}44`,
          borderRight: `1px solid ${GOLD}44`, borderBottom: `1px solid ${GOLD}44`,
          alignSelf: "stretch",
        }} />
      </div>
      {/* SF/Final column */}
      <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
        {sfMatch}
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────
export default function PlayoffScreen({ league, playoffSeeds, qfSeeds, knockdownPairs, qfPairs, sfPairs, finalPairs, teamStandings }) {
  const seeds = playoffSeeds || [];  // pre-knockdown seeds (W1-W17)
  const qfSeedList = qfSeeds || [];  // post-knockdown seeds (W1-W18), used for bracket
  const seedOf = (tid) => qfSeedList.indexOf(tid) + 1 || seeds.indexOf(tid) + 1; // prefer post-knockdown

  // Determine current playoff phase
  const knockdownComplete = knockdownPairs.length > 0 && knockdownPairs.every(([a, b]) => hasScores(getRec(league, 18, a, b)));
  const qfComplete = qfPairs.length > 0 && qfPairs.every(([a, b]) => hasScores(getRec(league, 19, a, b)));
  const sfComplete = sfPairs && sfPairs.every(([a, b]) => hasScores(getRec(league, 20, a, b)));
  const finalComplete = finalPairs && hasScores(getRec(league, 21, finalPairs.championship[0], finalPairs.championship[1]));

  const champion = finalComplete ? getPlayoffWinner(21, finalPairs.championship[0], finalPairs.championship[1], league.results) : null;

  // SF pairs may not exist yet (QF not complete)
  const sf1 = sfPairs?.[0] || null;
  const sf2 = sfPairs?.[1] || null;

  // Final pairs
  const champ = finalPairs?.championship || null;
  const third = finalPairs?.thirdPlace || null;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "20px 14px" }}>

      {/* Title */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ fontFamily: FD, fontSize: "30px", fontWeight: 700, color: CREAM }}>Playoffs</div>
        <div style={{ fontSize: "12px", color: M, letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Top 8 teams · Single elimination
        </div>
      </div>

      {/* Champion banner */}
      {champion && (
        <div style={{
          background: `linear-gradient(135deg, ${G}22, ${GOLD}22)`,
          border: `2px solid ${GOLD}66`, borderRadius: "14px",
          padding: "16px 20px", marginBottom: "20px",
          display: "flex", alignItems: "center", gap: "14px"
        }}>
          <div style={{ fontSize: "32px" }}>🏆</div>
          <div>
            <div style={{ fontSize: "11px", color: GOLD, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "2px" }}>
              2026 PVGC Champion
            </div>
            <div style={{ fontFamily: FD, fontSize: "24px", color: CREAM, fontWeight: 700 }}>
              {TEAMS[champion]?.name}
            </div>
          </div>
        </div>
      )}

      {/* Seeds strip — show pre-knockdown or post-knockdown */}
      {(seeds.length > 0 || qfSeedList.length > 0) && (
        <div style={{
          background: CARD, border: `1px solid ${GOLD}33`,
          borderRadius: "14px", padding: "16px 18px", marginBottom: "20px"
        }}>
          {/* Pre-knockdown seeds (W1-17) */}
          {seeds.length > 0 && (
            <>
              <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, fontWeight: 600, marginBottom: "10px" }}>
                Regular Season Seeds (W1–17)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "5px", marginBottom: qfSeedList.length > 0 ? "16px" : "0" }}>
                {seeds.map((tid, i) => {
                  const ts = teamStandings?.find(t => t.id === tid);
                  return (
                    <div key={tid} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "6px 10px", borderRadius: "7px",
                      background: i < 2 ? G + "12" : i < 4 ? GOLD + "0a" : "rgba(26,61,36,0.03)",
                      border: `1px solid ${i < 2 ? G + "33" : i < 4 ? GOLD + "22" : GOLD + "11"}`
                    }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: i < 2 ? G : i < 4 ? GOLD : M, width: "18px", flexShrink: 0 }}>#{i + 1}</span>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: CREAM, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{TEAMS[tid]?.name}</span>
                      {ts && <span style={{ fontSize: "11px", color: M, flexShrink: 0 }}>{ts.totalPts}pts</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {/* Post-knockdown QF seeds (W1-18) */}
          {qfSeedList.length > 0 && (
            <>
              <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: G, fontWeight: 600, marginBottom: "10px" }}>
                QF Seeds — After Knockdown (W1–18) · Top 8 Advance
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "5px" }}>
                {qfSeedList.map((tid, i) => {
                  const ts = teamStandings?.find(t => t.id === tid);
                  return (
                    <div key={tid} style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      padding: "6px 10px", borderRadius: "7px",
                      background: i < 2 ? G + "18" : i < 4 ? GOLD + "12" : G + "08",
                      border: `1px solid ${i < 2 ? G + "55" : i < 4 ? GOLD + "33" : G + "22"}`
                    }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: i < 2 ? G : i < 4 ? GOLD : M, width: "18px", flexShrink: 0 }}>#{i + 1}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: CREAM, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{TEAMS[tid]?.name}</span>
                      {ts && <span style={{ fontSize: "11px", color: M, flexShrink: 0 }}>{ts.totalPts}pts</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {seeds.length === 0 && qfSeedList.length === 0 && (
            <div style={{ fontSize: "13px", color: M }}>Seeds determined after Week 17</div>
          )}
        </div>
      )}

      {/* Knockdown Round */}
      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "16px 18px", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
          <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, fontWeight: 600 }}>
            Knockdown Round — Week 18
          </div>
          {SCHEDULE[18]?.date && (
            <div style={{ fontSize: "12px", color: M }}>{fmtDate(SCHEDULE[18].date)}</div>
          )}
          {knockdownComplete && <div style={{ fontSize: "11px", color: G, fontWeight: 600 }}>✓ Complete</div>}
        </div>
        {knockdownPairs.length > 0 ? (() => {
          const topMatches = knockdownPairs.slice(0, 4);   // seeds 1-8
          const botMatches = knockdownPairs.slice(4);       // seeds 9-18
          return (
            <>
              <div style={{ fontSize: "11px", color: G, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
                Seeds 1–8 · Playoff Bracket
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "8px", marginBottom: "14px" }}>
                {topMatches.map(([ta, tb], i) => (
                  <MatchCard key={i} week={18} ta={ta} tb={tb}
                    seedA={seeds.indexOf(ta) + 1} seedB={seeds.indexOf(tb) + 1}
                    league={league} label={`Match ${i + 1}`} />
                ))}
              </div>
              {botMatches.length > 0 && (
                <>
                  <div style={{ fontSize: "11px", color: M, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
                    Seeds 9–18 · Non-Playoff
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "8px" }}>
                    {botMatches.map(([ta, tb], i) => (
                      <MatchCard key={i+4} week={18} ta={ta} tb={tb}
                        seedA={seeds.indexOf(ta) + 1 || 9 + i*2} seedB={seeds.indexOf(tb) + 1 || 10 + i*2}
                        league={league} label={`Match ${i + 5}`} dim />
                    ))}
                  </div>
                </>
              )}
            </>
          );
        })() : (
          <div style={{ fontSize: "13px", color: M }}>Matchups determined by final regular season standings</div>
        )}
      </div>

      {/* Championship Bracket */}
      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "16px 18px", marginBottom: "20px" }}>
        <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, fontWeight: 600, marginBottom: "16px" }}>
          Championship Bracket
        </div>

        {/* Round headers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr 28px 1fr", gap: "0", marginBottom: "8px" }}>
          {["Quarterfinals (W19)", "", "Semifinals (W20)", "", "Final (W21)"].map((h, i) => (
            <div key={i} style={{
              fontSize: "10px", letterSpacing: "0.08em", textTransform: "uppercase",
              color: M, fontWeight: 600, textAlign: "center",
              visibility: h ? "visible" : "hidden"
            }}>{h || "·"}</div>
          ))}
        </div>

        {/* Top half: QF1(1v8) + QF4(4v5) → SF1 → Final */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr 28px 1fr", gap: "0", alignItems: "center", marginBottom: "8px" }}>
          {/* QF top half */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {qfPairs[0]
              ? <MatchCard week={19} ta={qfPairs[0][0]} tb={qfPairs[0][1]} seedA={seedOf(qfPairs[0][0])} seedB={seedOf(qfPairs[0][1])} league={league} label="QF 1" />
              : <TBDCard label="QF 1" />}
            {qfPairs[3]
              ? <MatchCard week={19} ta={qfPairs[3][0]} tb={qfPairs[3][1]} seedA={seedOf(qfPairs[3][0])} seedB={seedOf(qfPairs[3][1])} league={league} label="QF 4" />
              : <TBDCard label="QF 4" />}
          </div>
          {/* Connector */}
          <div style={{ display: "flex", justifyContent: "center", color: GOLD + "44", fontSize: "16px", alignSelf: "center" }}>→</div>
          {/* SF1 */}
          <div>
            {sf1
              ? <MatchCard week={20} ta={sf1[0]} tb={sf1[1]} seedA={seedOf(sf1[0])} seedB={seedOf(sf1[1])} league={league} label="SF 1" />
              : <TBDCard label="SF 1" />}
          </div>
          {/* Connector */}
          <div style={{ display: "flex", justifyContent: "center", color: GOLD + "44", fontSize: "16px", alignSelf: "center" }}>→</div>
          {/* Championship (top row) */}
          <div>
            {champ
              ? <MatchCard week={21} ta={champ[0]} tb={champ[1]} seedA={seedOf(champ[0])} seedB={seedOf(champ[1])} league={league} label="🏆 Championship" />
              : <TBDCard label="🏆 Championship" />}
          </div>
        </div>

        {/* Bottom half: QF2(2v7) + QF3(3v6) → SF2 → 3rd Place */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 28px 1fr 28px 1fr", gap: "0", alignItems: "center" }}>
          {/* QF bottom half */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {qfPairs[1]
              ? <MatchCard week={19} ta={qfPairs[1][0]} tb={qfPairs[1][1]} seedA={seedOf(qfPairs[1][0])} seedB={seedOf(qfPairs[1][1])} league={league} label="QF 2" />
              : <TBDCard label="QF 2" />}
            {qfPairs[2]
              ? <MatchCard week={19} ta={qfPairs[2][0]} tb={qfPairs[2][1]} seedA={seedOf(qfPairs[2][0])} seedB={seedOf(qfPairs[2][1])} league={league} label="QF 3" />
              : <TBDCard label="QF 3" />}
          </div>
          {/* Connector */}
          <div style={{ display: "flex", justifyContent: "center", color: GOLD + "44", fontSize: "16px", alignSelf: "center" }}>→</div>
          {/* SF2 */}
          <div>
            {sf2
              ? <MatchCard week={20} ta={sf2[0]} tb={sf2[1]} seedA={seedOf(sf2[0])} seedB={seedOf(sf2[1])} league={league} label="SF 2" />
              : <TBDCard label="SF 2" />}
          </div>
          {/* Connector */}
          <div style={{ display: "flex", justifyContent: "center", color: GOLD + "44", fontSize: "16px", alignSelf: "center" }}>→</div>
          {/* 3rd Place */}
          <div>
            {third
              ? <MatchCard week={21} ta={third[0]} tb={third[1]} seedA={seedOf(third[0])} seedB={seedOf(third[1])} league={league} label="3rd Place" />
              : <TBDCard label="3rd Place" />}
          </div>
        </div>
      </div>

      {/* Non-playoff teams note */}
      {teamStandings && teamStandings.length > 8 && (
        <div style={{ background: CARD, border: `1px solid ${GOLD}22`, borderRadius: "14px", padding: "16px 18px" }}>
          <div style={{ fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, fontWeight: 600, marginBottom: "10px" }}>
            Did Not Qualify
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {teamStandings.slice(8).map((t, i) => (
              <div key={t.id} style={{
                padding: "4px 10px", borderRadius: "6px",
                background: "rgba(26,61,36,0.04)", border: `1px solid ${GOLD}11`,
                fontSize: "12px", color: M
              }}>
                #{i + 9} {TEAMS[t.id]?.name}
                <span style={{ color: M + "66", marginLeft: "6px" }}>{t.totalPts}pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
