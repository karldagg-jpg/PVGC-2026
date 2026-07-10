import { useEffect, useRef, useState, useMemo } from "react";
import { SCHEDULE_RAW, TEAMS, getTeeTimes, SEASON_YEAR } from "../constants/league";
import { calcWeekBonus, matchKey, isMatchComplete } from "../lib/leagueLogic";
import { CARD, CREAM, G, GO, GOLD, M, FB, FM } from "../constants/theme";
import { Tag } from "./ui";
import { fmtDate } from "../lib/format";

const MY_TEAM_KEY = "pvgc_my_team";

// Friendly relative-date label; returns null when a plain date reads better.
function relLabel(str) {
  if (!str) return null;
  const d = new Date(str + "T12:00:00");
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const diff = Math.round((d - t) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff <= 7) return `in ${diff} days`;
  if (diff > 7 && diff <= 13) return "Next week";
  if (diff < -1 && diff >= -7) return `${-diff} days ago`;
  return null;
}

const PLAYOFF_LABEL = { 18: "KNOCKDOWN", 19: "QUARTERFINALS", 20: "SEMIFINALS", 21: "CHAMPIONSHIP" };

function StatusPill({ w }) {
  if (w.isCancelled) return <Tag color="#e6a817">⛈ Cancelled</Tag>;
  if (w.cleanPairs.length === 0) return <Tag color={M}>TBD</Tag>;
  if (w.allDone) return <Tag color={G}>✓ Complete</Tag>;
  if (w.scored > 0) return <Tag color={GO}>In progress {w.scored}/{w.cleanPairs.length}</Tag>;
  return <Tag color={M}>Not started</Tag>;
}

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
  onPlayerClick,
  currentUserTid,
}) {
  const currentWeekRef = useRef(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [savedTid, setSavedTid] = useState(() => {
    const v = localStorage.getItem(MY_TEAM_KEY);
    return v ? parseInt(v, 10) : null;
  });

  // Email match wins; localStorage pick is the fallback for members whose email isn't set.
  const myTid = (currentUserTid != null && TEAMS[currentUserTid]) ? currentUserTid
              : (savedTid != null && TEAMS[savedTid]) ? savedTid : null;
  const usingFallback = currentUserTid == null && myTid != null;

  function pickTeam(tid) {
    if (tid) { localStorage.setItem(MY_TEAM_KEY, String(tid)); setSavedTid(tid); }
    else { localStorage.removeItem(MY_TEAM_KEY); setSavedTid(null); }
  }

  // Per-week derived data (pairs, scored count, status).
  const weeks = useMemo(() => SCHEDULE_RAW.map(([week, date, ...pairs]) => {
    const isKnockdown = week === 18;
    const isPlayoff = week >= 19;
    const dynPairs = isKnockdown ? knockdownPairs
      : week === 19 ? qfPairs
      : week === 20 ? (sfPairs || [])
      : week === 21 ? (finalPairs ? [finalPairs.championship, finalPairs.thirdPlace] : [])
      : null;
    const cleanPairs = dynPairs || (pairs || []).filter(Array.isArray);
    const scored = cleanPairs.filter(([ta, tb]) =>
      isMatchComplete(league.results[week]?.[matchKey(week, Math.min(ta, tb), Math.max(ta, tb))])
    ).length;
    const allDone = cleanPairs.length > 0 && scored === cleanPairs.length;
    const isCancelled = cancelledWeeks?.has(week);
    return { week, date, isKnockdown, isPlayoff, cleanPairs, scored, allDone, isCancelled };
  }), [league.results, knockdownPairs, qfPairs, sfPairs, finalPairs, cancelledWeeks]);

  // First week whose date is today or later — the "current" week.
  const todayWeek = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    for (const w of weeks) {
      if (!w.date) continue;
      if (t <= new Date(w.date + "T12:00:00")) return w.week;
    }
    return weeks[weeks.length - 1]?.week ?? 1;
  }, [weeks]);

  // The signed-in member's next unplayed, non-cancelled match.
  const nextMatch = useMemo(() => {
    if (!myTid) return null;
    for (const w of weeks) {
      if (w.week < todayWeek || w.isCancelled) continue;
      const idx = w.cleanPairs.findIndex(([ta, tb]) => ta === myTid || tb === myTid);
      if (idx < 0) continue;
      const [ta, tb] = w.cleanPairs[idx];
      const done = isMatchComplete(league.results[w.week]?.[matchKey(w.week, Math.min(ta, tb), Math.max(ta, tb))]);
      if (done) continue;
      return { week: w.week, date: w.date, oppTid: ta === myTid ? tb : ta, teeTime: getTeeTimes(w.week)[idx] || "" };
    }
    return null;
  }, [weeks, myTid, todayWeek, league.results]);

  useEffect(() => {
    currentWeekRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const goScore = (tid, week) => { setTeam(tid); setWeek(week); setScreen("scoring"); };

  // Hide finished/cancelled past weeks unless toggled (always keep the open week).
  const isPast = (w) => (w.allDone || w.isCancelled) && w.week < todayWeek;
  const visibleWeeks = showCompleted ? weeks : weeks.filter(w => w.week === selWeek || !isPast(w));
  const hiddenCount = weeks.length - visibleWeeks.length;

  return (
    <div style={{ maxWidth: "900px", margin: "0 auto", padding: "22px 14px" }}>
      <div style={{ fontFamily: "'Cormorant Garamond','Georgia',serif", fontSize: "28px", marginBottom: "4px", fontWeight: 600, letterSpacing: "0.02em", color: CREAM }}>
        {SEASON_YEAR} Season
      </div>
      <div style={{ color: M, fontSize: "14px", marginBottom: "18px" }}>
        18 teams · Wednesdays · First tee 4:10pm
      </div>

      {/* ── Your Next Match ─────────────────────────────── */}
      {myTid && nextMatch && (() => {
        const rel = relLabel(nextMatch.date);
        return (
          <div style={{ background: `linear-gradient(135deg, ${G}14, ${GOLD}10)`, border: `1px solid ${G}44`, borderRadius: "15px", padding: "15px 17px", marginBottom: "18px", display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: "200px" }}>
              <div style={{ fontSize: "10px", letterSpacing: "0.14em", textTransform: "uppercase", color: G, fontWeight: 700, marginBottom: "5px" }}>Your Next Match</div>
              <div style={{ fontSize: "17px", fontWeight: 700, color: CREAM, lineHeight: 1.3 }}>
                vs {TEAMS[nextMatch.oppTid]?.name || `Team ${nextMatch.oppTid}`}
              </div>
              <div style={{ fontSize: "13px", color: M, marginTop: "3px" }}>
                Week {nextMatch.week} · {rel ? <strong style={{ color: GOLD }}>{rel}</strong> : fmtDate(nextMatch.date)}
                {rel && <span> · {fmtDate(nextMatch.date)}</span>}
                {nextMatch.teeTime && <span> · {nextMatch.teeTime} tee</span>}
              </div>
            </div>
            <button onClick={() => goScore(myTid, nextMatch.week)}
              style={{ padding: "9px 18px", borderRadius: "8px", border: "none", background: G, color: "#f0ece0", fontFamily: FM || FB, fontSize: "14px", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", whiteSpace: "nowrap" }}>
              Score →
            </button>
          </div>
        );
      })()}
      {myTid && !nextMatch && (
        <div style={{ background: `${G}0d`, border: `1px solid ${G}33`, borderRadius: "13px", padding: "13px 16px", marginBottom: "18px", fontSize: "14px", color: M }}>
          🎉 <strong style={{ color: G }}>{TEAMS[myTid]?.name}</strong> — you're all caught up. No upcoming matches to score.
        </div>
      )}
      {!myTid && (
        <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "13px", padding: "13px 16px", marginBottom: "18px" }}>
          <div style={{ fontSize: "13px", color: M, marginBottom: "8px" }}>Pick your team to see your next match:</div>
          <select defaultValue="" onChange={(e) => pickTeam(parseInt(e.target.value, 10))}
            style={{ width: "100%", maxWidth: "320px", padding: "9px 11px", borderRadius: "8px", border: `1px solid ${GOLD}55`, background: "#fff", color: "#0f2a14", fontFamily: FB, fontSize: "14px", cursor: "pointer" }}>
            <option value="" disabled>Select your team…</option>
            {Object.entries(TEAMS).map(([tid, t]) => <option key={tid} value={tid}>{t.name}</option>)}
          </select>
        </div>
      )}
      {usingFallback && (
        <div style={{ fontSize: "12px", color: M, marginBottom: "14px", marginTop: "-6px" }}>
          Showing matches for <strong style={{ color: CREAM }}>{TEAMS[myTid]?.name}</strong>.{" "}
          <button onClick={() => pickTeam(null)} style={{ background: "none", border: "none", color: G, cursor: "pointer", textDecoration: "underline", fontSize: "12px", padding: 0 }}>Change team</button>
        </div>
      )}

      {/* ── Controls ────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", flexWrap: "wrap" }}>
        <button onClick={() => { setWeek(todayWeek); setTimeout(() => currentWeekRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 0); }}
          style={{ padding: "6px 13px", borderRadius: "7px", border: `1px solid ${G}55`, background: `${G}12`, color: G, fontFamily: FB, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
          ↓ Jump to this week
        </button>
        {hiddenCount > 0 && !showCompleted && (
          <button onClick={() => setShowCompleted(true)}
            style={{ padding: "6px 13px", borderRadius: "7px", border: `1px solid ${M}44`, background: "transparent", color: M, fontFamily: FB, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            Show completed ({hiddenCount}) ▾
          </button>
        )}
        {showCompleted && (
          <button onClick={() => setShowCompleted(false)}
            style={{ padding: "6px 13px", borderRadius: "7px", border: `1px solid ${M}44`, background: "transparent", color: M, fontFamily: FB, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
            Hide completed ▴
          </button>
        )}
      </div>

      {/* ── Week list ───────────────────────────────────── */}
      <div style={{ display: "grid", gap: "8px" }}>
        {visibleWeeks.map((w) => {
          const { week, date, isKnockdown, isPlayoff, cleanPairs, allDone, isCancelled } = w;
          const isThisWeek = week === todayWeek;
          const myInWeek = myTid ? cleanPairs.some(([ta, tb]) => ta === myTid || tb === myTid) : false;
          const bonus = !isKnockdown && !isPlayoff && allDone
            ? calcWeekBonus(week, league.results, league.handicaps) : null;
          const rel = relLabel(date);
          return (
            <div
              key={week}
              ref={week === selWeek ? currentWeekRef : null}
              style={{
                background: isCancelled ? "rgba(230,168,23,0.06)" : CARD,
                border: `1px solid ${isCancelled ? "#e6a81755" : week === selWeek ? G + "55" : isThisWeek ? GOLD + "44" : "rgba(26,61,36,0.06)"}`,
                borderRadius: "13px",
                overflow: "hidden",
              }}
            >
              <div
                style={{ padding: "11px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", background: week === selWeek ? G + "0d" : "transparent", cursor: "pointer" }}
                onClick={() => {
                  setWeek(week);
                  if (isKnockdown || isPlayoff) {
                    if (cleanPairs.length > 0) setTeam(cleanPairs[0][0]);
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "13px" }}>
                  <div style={{ width: "34px", height: "34px", borderRadius: "50%", border: `1px solid ${allDone ? G : GOLD}55`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: "12px", color: allDone ? G : GOLD, flexShrink: 0 }}>
                    {week}
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                      <span>Week {week}</span>
                      {PLAYOFF_LABEL[week] && <span style={{ color: GO, fontSize: "13px", fontWeight: 700 }}>{PLAYOFF_LABEL[week]}</span>}
                      {isThisWeek && <span style={{ background: GOLD, color: "#3a2a00", fontSize: "10px", fontWeight: 700, padding: "1px 7px", borderRadius: "20px", letterSpacing: "0.06em" }}>THIS WEEK</span>}
                      {bonus && <span style={{ color: G, fontSize: "12px" }}>⭐ Bonus points</span>}
                    </div>
                    <div style={{ fontSize: "13px", color: M, marginTop: "1px" }}>
                      {rel ? <><strong style={{ color: isThisWeek ? GOLD : M }}>{rel}</strong> · {fmtDate(date)}</> : fmtDate(date)}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <StatusPill w={w} />
                  {!isCancelled && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setWeek(week); if (myInWeek) setTeam(myTid); setScreen("scoring"); }}
                      style={{ padding: "5px 13px", borderRadius: "6px", border: `1px solid ${G}66`, background: allDone ? "transparent" : G, color: allDone ? G : "#f0ece0", fontFamily: FM || FB, fontSize: "13px", fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", whiteSpace: "nowrap" }}>
                      {allDone ? "View" : "Score →"}
                    </button>
                  )}
                </div>
              </div>

              {week === selWeek && (isKnockdown || isPlayoff) && cleanPairs.length === 0 && (
                <div style={{ padding: "10px 15px 12px", fontSize: "14px", color: M }}>
                  {isKnockdown && "Matchups determined by final regular season standings."}
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
                      const isMine = myTid && (ta === myTid || tb === myTid);
                      return (
                        <div
                          key={i}
                          onClick={() => goScore(isMine ? myTid : ta, week)}
                          style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 15px", cursor: "pointer", borderBottom: `1px solid rgba(26,61,36,0.06)`, borderLeft: isMine ? `3px solid ${GOLD}` : "3px solid transparent", background: isMine ? "rgba(212,175,55,0.09)" : done ? "rgba(26,107,58,0.04)" : "transparent", transition: "background 0.1s" }}
                          onMouseEnter={(e) => { if (!isMine) e.currentTarget.style.background = done ? "rgba(26,107,58,0.08)" : "rgba(26,61,36,0.04)"; }}
                          onMouseLeave={(e) => { if (!isMine) e.currentTarget.style.background = done ? "rgba(26,107,58,0.04)" : "transparent"; }}
                        >
                          <div style={{ minWidth: "58px", fontSize: "12px", fontWeight: 600, color: GOLD, letterSpacing: "0.04em", flexShrink: 0 }}>
                            {teeTime}
                            {isMine && <div style={{ fontSize: "9px", fontWeight: 700, color: "#3a2a00", background: GOLD, borderRadius: "3px", padding: "0 4px", marginTop: "3px", display: "inline-block", letterSpacing: "0.06em" }}>YOU</div>}
                          </div>
                          <div style={{ flex: 1, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ flex: 1 }}>
                              {[0, 1].map(pi => (
                                <div key={pi}
                                  onClick={onPlayerClick ? e => { e.stopPropagation(); onPlayerClick(ta, pi); } : undefined}
                                  style={{ fontWeight: 600, color: done ? G : CREAM, cursor: onPlayerClick ? "pointer" : "default", lineHeight: 1.4, textDecoration: onPlayerClick ? "underline" : "none", textDecorationColor: "rgba(0,0,0,0.18)", textUnderlineOffset: "2px" }}>
                                  {pi === 0 ? TEAMS[ta]?.p1 : TEAMS[ta]?.p2}
                                </div>
                              ))}
                            </div>
                            <span style={{ color: M, fontSize: "11px", flexShrink: 0 }}>vs</span>
                            <div style={{ flex: 1 }}>
                              {[0, 1].map(pi => (
                                <div key={pi}
                                  onClick={onPlayerClick ? e => { e.stopPropagation(); onPlayerClick(tb, pi); } : undefined}
                                  style={{ fontWeight: 600, color: done ? G : CREAM, cursor: onPlayerClick ? "pointer" : "default", lineHeight: 1.4, textDecoration: onPlayerClick ? "underline" : "none", textDecorationColor: "rgba(0,0,0,0.18)", textUnderlineOffset: "2px" }}>
                                  {pi === 0 ? TEAMS[tb]?.p1 : TEAMS[tb]?.p2}
                                </div>
                              ))}
                            </div>
                          </div>
                          {done ? (
                            <span style={{ fontSize: "12px", color: G, fontWeight: 600, padding: "3px 8px", borderRadius: "5px", border: `1px solid ${G}44`, background: `${G}10` }}>✓ Done</span>
                          ) : (
                            <span style={{ fontSize: "12px", color: G, fontWeight: 700, padding: "3px 10px", borderRadius: "5px", border: `1px solid ${G}66`, background: `${G}15`, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>Score →</span>
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
