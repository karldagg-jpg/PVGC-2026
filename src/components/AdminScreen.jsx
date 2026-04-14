import React, { useState, useEffect } from "react";
import { SCHEDULE_RAW, TEAMS, getTeeTimes, SEASON_YEAR } from "../constants/league";
import * as L2026 from "../constants/league_2026";
import { G, GO, M, CREAM, GOLD, CARD, FB, FD, R } from "../constants/theme";
import { fmtDate } from "../lib/format";
import { exportStandings, exportHandicaps, exportScores } from "../lib/exportUtils";
import { matchKey, getOpponent } from "../lib/leagueLogic";

// Add future year modules here as they become available
const PRINT_SCHEDULES = {
  2026: { scheduleRaw: L2026.SCHEDULE_RAW, getTeeTimes: L2026.getTeeTimes, teams: L2026.TEAMS },
};

function printStarterSheet(week, pairs, teeTimes, schedRaw, teams) {
  const dateStr = fmtDate(schedRaw.find(r => r[0] === week)?.[1]) || "";
  const rows = pairs.map(([ta, tb], i) => {
    const time = teeTimes[i] || "";
    const t1 = teams[ta] || {};
    const t2 = teams[tb] || {};
    const chk = `<span style="display:inline-block;width:14px;height:14px;border:1.5px solid #333;border-radius:2px;margin-right:4px;vertical-align:middle"></span>`;
    return `<tr style="${i % 2 === 0 ? "background:#f9f9f9" : "background:#fff"}">
      <td style="padding:8px 10px;font-weight:700;font-size:13px;white-space:nowrap;border-right:2px solid #ccc">${time}</td>
      <td style="padding:8px 10px;border-right:1px solid #ddd">
        <div style="font-weight:700;font-size:12px;color:#1e4d2b;margin-bottom:4px">T${ta} · ${t1.name || ""}</div>
        <div style="font-size:12px">${chk}${t1.p1 || "—"}</div>
        <div style="font-size:12px;margin-top:3px">${chk}${t1.p2 || "—"}</div>
      </td>
      <td style="padding:8px 10px;border-right:2px solid #ccc">
        <div style="font-weight:700;font-size:12px;color:#8a3a00;margin-bottom:4px">T${tb} · ${t2.name || ""}</div>
        <div style="font-size:12px">${chk}${t2.p1 || "—"}</div>
        <div style="font-size:12px;margin-top:3px">${chk}${t2.p2 || "—"}</div>
      </td>
      <td style="padding:8px 10px;min-width:120px">
        <div style="font-size:10px;color:#999;margin-bottom:4px">Notes / Subs</div>
        <div style="border-bottom:1px solid #ccc;height:14px;margin-bottom:4px"></div>
        <div style="border-bottom:1px solid #ccc;height:14px"></div>
      </td>
    </tr>`;
  });

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>PVGC Week ${week} Starter Sheet</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;color:#111;background:#fff;padding:16px 20px}
h1{font-size:16px;font-weight:700;margin-bottom:2px}
.sub{font-size:12px;color:#555;margin-bottom:12px}
table{width:100%;border-collapse:collapse;border:1.5px solid #999}
th{background:#1e4d2b;color:#fff;padding:7px 10px;font-size:11px;font-weight:600;text-align:left;border-right:1px solid #2e6d3b}
tr{border-bottom:1.5px solid #ccc}
.footer{margin-top:14px;font-size:11px;color:#666;display:flex;justify-content:space-between}
.footer-line{border-top:1px solid #bbb;padding-top:4px;min-width:160px}
@media print{body{padding:8px};@page{size:portrait;margin:12mm}}
</style></head><body>
<h1>⛳ PVGC Golf League — Week ${week} Starter Sheet</h1>
<div class="sub">${dateStr ? dateStr + " &nbsp;·&nbsp; " : ""}Wednesdays &nbsp;·&nbsp; First tee 4:10 PM &nbsp;·&nbsp; 18 Teams</div>
<table>
  <thead>
    <tr>
      <th style="width:80px">Tee Time</th>
      <th style="width:37%">Team (Home)</th>
      <th style="width:37%">Team (Away)</th>
      <th>Notes / Subs</th>
    </tr>
  </thead>
  <tbody>${rows.join("")}</tbody>
</table>
<div class="footer">
  <div class="footer-line">Weather: _______________________</div>
  <div class="footer-line">Groups out: ______ / ${pairs.length}</div>
</div>
</body></html>`;

  const w = window.open("", "_blank", "width=820,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export default function AdminScreen({ league, knockdownPairs, qfPairs, sfPairs, finalPairs, saveLeague, unlockMatch, clearMatch, clearSeason, isAdmin, adminPin, adminUnlock, adminLock, saveAdminPin, teamStandings, createSnapshot, listSnapshots, restoreSnapshot, match, setMatch, activeWeek, activeTeam, cancelledWeeks, toggleCancelWeek }) {
  const printYears = Object.keys(PRINT_SCHEDULES).map(Number).sort();
  const [printYear, setPrintYear] = useState(printYears[printYears.length - 1] || SEASON_YEAR);

  // Admin PIN state
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [changingPin, setChangingPin] = useState(false);

  // Clear match state
  const [clearWeek, setClearWeek] = useState(1);
  const [clearTeam, setClearTeam] = useState(1);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearMsg, setClearMsg] = useState("");

  // Reset season state
  const [resetPhase, setResetPhase] = useState(0); // 0=idle, 1=confirm1, 2=confirm2

  // Snapshot state
  const [snapshots, setSnapshots] = useState([]);
  const [snapshotLabel, setSnapshotLabel] = useState("");
  const [snapshotStatus, setSnapshotStatus] = useState(""); // "saving"|"saved"|"error"|"restoring"|"restored"
  const [restoreId, setRestoreId] = useState(null);

  useEffect(() => {
    if (!isAdmin || !listSnapshots) return;
    listSnapshots().then(setSnapshots);
  }, [isAdmin]);

  async function handleCreateSnapshot() {
    setSnapshotStatus("saving");
    const ok = await createSnapshot?.(snapshotLabel);
    setSnapshotStatus(ok ? "saved" : "error");
    if (ok) {
      setSnapshotLabel("");
      const updated = await listSnapshots?.();
      if (updated) setSnapshots(updated);
      setTimeout(() => setSnapshotStatus(""), 3000);
    }
  }

  async function handleRestore(id) {
    setSnapshotStatus("restoring");
    setRestoreId(id);
    const ok = await restoreSnapshot?.(id);
    setSnapshotStatus(ok ? "restored" : "error");
    setRestoreId(null);
    setTimeout(() => setSnapshotStatus(""), 3000);
  }


  const activeSched = PRINT_SCHEDULES[printYear] || PRINT_SCHEDULES[SEASON_YEAR];
  const schedRaw = activeSched.scheduleRaw;
  const schedTeams = activeSched.teams;

  const regularWeeks = schedRaw.filter(([w]) => w < 18).map(([w]) => w);
  const [selWeek, setSelWeek] = useState(regularWeeks[regularWeeks.length - 1] || 1);

  const weekRow = schedRaw.find(([w]) => w === selWeek);
  const rawPairs = weekRow ? weekRow.slice(2).filter(Array.isArray) : [];
  // Playoff pairs only apply for current season
  const dynPairs = printYear === SEASON_YEAR
    ? (selWeek === 18 ? knockdownPairs
      : selWeek === 19 ? qfPairs
      : selWeek === 20 ? (sfPairs || [])
      : selWeek === 21 ? (finalPairs ? [finalPairs.championship, finalPairs.thirdPlace] : [])
      : null)
    : null;
  const pairs = dynPairs || rawPairs;

  const readOnlyWeeks = league?.readOnlyWeeks || [];

  // Clear match derived values
  const clearDynPairs = clearWeek === 18 ? knockdownPairs : clearWeek === 19 ? qfPairs
    : clearWeek === 20 ? (sfPairs || []) : clearWeek === 21 ? (finalPairs ? [finalPairs.championship, finalPairs.thirdPlace] : []) : null;
  const clearOpp = getOpponent(clearTeam, clearWeek, clearDynPairs);
  const clearTlow = clearOpp ? Math.min(clearTeam, clearOpp) : 0;
  const clearThigh = clearOpp ? Math.max(clearTeam, clearOpp) : 0;
  const clearMk = clearTlow && clearThigh ? matchKey(clearWeek, clearTlow, clearThigh) : null;
  const clearHasData = clearMk ? !!(league?.results?.[clearWeek]?.[clearMk]) : false;


  function toggleReadOnly(w) {
    if (!saveLeague) return;
    const cur = readOnlyWeeks.includes(w);
    const next = { ...league, readOnlyWeeks: cur ? readOnlyWeeks.filter(x => x !== w) : [...readOnlyWeeks, w] };
    saveLeague(next);
  }

  // Collect locked + confirmed matches
  const lockedMatches = [];
  for (const [wStr, weekRecs] of Object.entries(league?.results || {})) {
    const w = parseInt(wStr);
    for (const [mk, rec] of Object.entries(weekRecs || {})) {
      if (!rec) continue;
      if (rec.locked || (rec.confirmations && Object.keys(rec.confirmations).length > 0)) {
        lockedMatches.push({ week: w, mk, rec });
      }
    }
  }
  lockedMatches.sort((a, b) => a.week - b.week);

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ fontFamily: FD, fontSize: "26px", fontWeight: 600, color: CREAM, marginBottom: "20px" }}>
        Admin
      </div>

      {/* ── Admin Lock ──────────────────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${isAdmin ? G + "55" : GOLD}33`, borderRadius: "14px", padding: "16px 18px", marginBottom: "16px" }}>
        {isAdmin ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>🔓</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: G }}>Admin Unlocked</div>
                <div style={{ fontSize: "11px", color: M }}>Full edit access active</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {!changingPin ? (
                <button onClick={() => setChangingPin(true)}
                  style={{ padding: "6px 14px", borderRadius: "7px", border: `1px solid ${GOLD}44`, background: "transparent", color: M, fontFamily: FB, fontSize: "12px", cursor: "pointer" }}>
                  Change PIN
                </button>
              ) : (
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="password" placeholder="New PIN" value={newPin}
                    onChange={e => setNewPin(e.target.value)}
                    style={{ width: "90px", padding: "6px 8px", borderRadius: "7px", border: `1px solid ${GOLD}44`, fontFamily: FB, fontSize: "13px", outline: "none" }}
                  />
                  <button onClick={async () => {
                    if (!newPin) return;
                    await saveAdminPin(newPin);
                    setNewPin(""); setChangingPin(false);
                  }}
                    style={{ padding: "6px 12px", borderRadius: "7px", border: `1px solid ${G}55`, background: G + "18", color: G, fontFamily: FB, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                    Save
                  </button>
                  <button onClick={() => { setNewPin(""); setChangingPin(false); }}
                    style={{ padding: "6px 10px", borderRadius: "7px", border: `1px solid ${GOLD}33`, background: "transparent", color: M, fontFamily: FB, fontSize: "12px", cursor: "pointer" }}>
                    Cancel
                  </button>
                </div>
              )}
              <button onClick={adminLock}
                style={{ padding: "6px 14px", borderRadius: "7px", border: `1px solid ${R}44`, background: R + "10", color: R, fontFamily: FB, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                Lock
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <span style={{ fontSize: "16px" }}>🔒</span>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: M }}>Admin Locked</div>
                <div style={{ fontSize: "11px", color: M }}>Enter PIN to unlock editing</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <input
                type="password" placeholder="Enter PIN"
                value={pinInput}
                onChange={e => { setPinInput(e.target.value); setPinError(false); }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const ok = adminUnlock(pinInput);
                    if (!ok) setPinError(true);
                    else setPinInput("");
                  }
                }}
                style={{
                  width: "120px", padding: "8px 10px", borderRadius: "8px",
                  border: `1px solid ${pinError ? R : GOLD}44`,
                  fontFamily: FB, fontSize: "14px", outline: "none",
                  background: pinError ? R + "08" : "#fff",
                }}
              />
              <button onClick={() => {
                const ok = adminUnlock(pinInput);
                if (!ok) setPinError(true);
                else setPinInput("");
              }}
                style={{ padding: "8px 18px", borderRadius: "8px", border: `1px solid ${GOLD}66`, background: GOLD + "18", color: GOLD, fontFamily: FB, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                Unlock
              </button>
              {pinError && <span style={{ fontSize: "12px", color: R, fontWeight: 600 }}>Incorrect PIN</span>}
              {!adminPin && <span style={{ fontSize: "11px", color: M }}>No PIN set — set one after unlocking</span>}
            </div>
          </div>
        )}
      </div>

      {/* ── Print Starter Sheet ──────────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "14px", fontWeight: 600 }}>
          Print Starter Sheet
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          {printYears.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: M }}>Year</span>
              <select
                value={printYear}
                onChange={e => { setPrintYear(parseInt(e.target.value)); setSelWeek(1); }}
                style={{
                  background: "#fff", border: `1px solid ${GOLD}44`, borderRadius: "7px",
                  color: "#0f2a14", fontFamily: FB, fontSize: "14px",
                  padding: "6px 10px", cursor: "pointer", outline: "none",
                }}
              >
                {printYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", color: M }}>Week</span>
            <select
              value={selWeek}
              onChange={e => setSelWeek(parseInt(e.target.value))}
              style={{
                background: "#fff", border: `1px solid ${GOLD}44`, borderRadius: "7px",
                color: "#0f2a14", fontFamily: FB, fontSize: "14px",
                padding: "6px 10px", cursor: "pointer", outline: "none",
              }}
            >
              {schedRaw.map(([w]) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => printStarterSheet(selWeek, pairs, activeSched.getTeeTimes(selWeek), schedRaw, schedTeams)}
            disabled={pairs.length === 0}
            style={{
              padding: "8px 18px", borderRadius: "8px", cursor: pairs.length ? "pointer" : "not-allowed",
              border: `1px solid ${GOLD}66`, background: GOLD + "18",
              color: GOLD, fontFamily: FB, fontSize: "14px", fontWeight: 600,
              opacity: pairs.length ? 1 : 0.4,
            }}
          >
            Print Sheet
          </button>
          {weekRow && (
            <span style={{ fontSize: "12px", color: M }}>
              {fmtDate(weekRow[1])} &nbsp;·&nbsp; {pairs.length} groups
            </span>
          )}
        </div>
      </div>

      {/* ── Admin-only sections ─────────────────────────────────── */}
      {!isAdmin && (
        <div style={{ textAlign: "center", padding: "20px", fontSize: "13px", color: M }}>
          Unlock admin to manage read-only weeks, clear matches, and reset season.
        </div>
      )}
      {isAdmin && <>

      {/* ── Read-Only Weeks ──────────────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "4px", fontWeight: 600 }}>
          Read-Only Weeks
        </div>
        <div style={{ fontSize: "12px", color: M, marginBottom: "14px" }}>
          Lock a past week so scores can't be edited by anyone.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {regularWeeks.map(w => {
            const isRO = readOnlyWeeks.includes(w);
            return (
              <button key={w} onClick={() => toggleReadOnly(w)}
                style={{
                  padding: "6px 12px", borderRadius: "7px", fontFamily: FB, fontSize: "13px",
                  fontWeight: isRO ? 700 : 400, cursor: "pointer",
                  border: isRO ? `2px solid #e6a817` : `1px solid ${GOLD}44`,
                  background: isRO ? "#fff3cd" : "transparent",
                  color: isRO ? "#7a4f00" : M,
                }}>
                {isRO ? "🔒" : ""} W{w}
              </button>
            );
          })}
        </div>
        {readOnlyWeeks.length > 0 && (
          <div style={{ marginTop: "12px", fontSize: "12px", color: M }}>
            Locked: {readOnlyWeeks.sort((a,b)=>a-b).map(w => `W${w}`).join(", ")}
          </div>
        )}
      </div>

      {/* ── Cancel Week — Weather ───────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
        <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "4px", fontWeight: 600 }}>
          ⛈ Cancel Week — Weather
        </div>
        <div style={{ fontSize: "12px", color: M, marginBottom: "14px" }}>
          Cancels all matches for a week. No points awarded. Toggle again to restore.
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {regularWeeks.map(w => {
            const isCancelled = cancelledWeeks?.has(w);
            return (
              <button key={w} onClick={() => toggleCancelWeek?.(w)}
                style={{
                  padding: "6px 12px", borderRadius: "7px", fontFamily: FB, fontSize: "13px",
                  fontWeight: isCancelled ? 700 : 400, cursor: "pointer",
                  border: isCancelled ? `2px solid #e6a817` : `1px solid ${GOLD}44`,
                  background: isCancelled ? "#fff3cd" : "transparent",
                  color: isCancelled ? "#7a4f00" : M,
                }}>
                {isCancelled ? "⛈" : ""} W{w}
              </button>
            );
          })}
        </div>
        {cancelledWeeks?.size > 0 && (
          <div style={{ marginTop: "12px", fontSize: "12px", color: "#e6a817" }}>
            Cancelled: {[...cancelledWeeks].sort((a,b)=>a-b).map(w => `W${w}`).join(", ")}
          </div>
        )}
      </div>

      {/* ── Confirmed / Locked Matches ───────────────────────────── */}
      {lockedMatches.length > 0 && (
        <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "20px" }}>
          <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "14px", fontWeight: 600 }}>
            Confirmed Matches
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {lockedMatches.map(({ week, mk, rec }) => {
              const parts = mk.split("-");
              const tlow = parseInt(parts[1]), thigh = parseInt(parts[2]);
              const confs = rec.confirmations || {};
              const t1c = confs[tlow], t2c = confs[thigh];
              return (
                <div key={`${week}-${mk}`} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: "8px", padding: "10px 12px", borderRadius: "9px",
                  background: rec.locked ? G + "0d" : GOLD + "0a",
                  border: `1px solid ${rec.locked ? G + "33" : GOLD + "33"}`,
                  flexWrap: "wrap"
                }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: CREAM }}>
                      W{week} — T{tlow} vs T{thigh}
                      {rec.locked && <span style={{ marginLeft: "8px", color: G, fontSize: "12px" }}>✅ Locked</span>}
                    </div>
                    <div style={{ fontSize: "11px", color: M, marginTop: "3px" }}>
                      {t1c ? <span style={{ color: G }}>T{tlow}: {t1c.confirmedBy} {t1c.confirmedAt}</span> : <span style={{ color: M }}>T{tlow}: pending</span>}
                      <span style={{ color: M }}> · </span>
                      {t2c ? <span style={{ color: G }}>T{thigh}: {t2c.confirmedBy} {t2c.confirmedAt}</span> : <span style={{ color: M }}>T{thigh}: pending</span>}
                    </div>
                  </div>
                  {rec.locked && unlockMatch && (
                    <button onClick={() => unlockMatch(week, mk)}
                      style={{
                        padding: "5px 12px", borderRadius: "6px",
                        border: `1px solid ${R}44`, background: R + "10",
                        color: R, fontFamily: FB, fontSize: "12px",
                        fontWeight: 600, cursor: "pointer"
                      }}>
                      Unlock
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Rainout Settings ────────────────────────────────────── */}
      {match && setMatch && (
        <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "20px", marginBottom: "16px" }}>
          <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "4px", fontWeight: 600 }}>
            ☔ Rainout — Week {activeWeek} · T{activeTeam}
          </div>
          <div style={{ fontSize: "12px", color: M, marginBottom: "14px" }}>
            If the last group completes hole 6, invoke the rainout rule. Holes 7→1 · 8→4 · 9→3.
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "13px", color: match.rainout ? GO : M }}>
                {match.rainout ? "Rainout active" : "No rainout"}
              </span>
              <button onClick={() => setMatch(p => ({ ...p, rainout: !p.rainout }))}
                style={{
                  width: "42px", height: "22px", borderRadius: "13px", border: "none", cursor: "pointer",
                  background: match.rainout ? GOLD : "rgba(255,255,255,0.25)", position: "relative", transition: "background 0.2s"
                }}>
                <span style={{
                  position: "absolute", top: "3px", left: match.rainout ? "22px" : "3px",
                  width: "16px", height: "16px", borderRadius: "50%",
                  background: match.rainout ? "#0f2a14" : "#888", transition: "left 0.2s"
                }} />
              </button>
            </div>
            {match.rainout && (
              <select value={match.holesPlayed} onChange={e => setMatch(p => ({ ...p, holesPlayed: parseInt(e.target.value) }))}
                style={{ background: "#fff", border: `1px solid ${GOLD}44`, borderRadius: "7px", color: "#0f2a14", fontFamily: FB, fontSize: "14px", padding: "6px 10px", cursor: "pointer", outline: "none" }}>
                {[6, 7, 8].map(n => <option key={n} value={n}>Stopped after H{n}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {/* ── Clear Match ─────────────────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "20px", marginBottom: "16px", marginTop: "16px" }}>
        <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "4px", fontWeight: 600 }}>
          Clear Match Scores
        </div>
        <div style={{ fontSize: "12px", color: M, marginBottom: "14px" }}>
          Delete scores for a single match. All other data is untouched.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px", color: M }}>Week</span>
            <select value={clearWeek} onChange={e => { setClearWeek(parseInt(e.target.value)); setClearConfirm(false); setClearMsg(""); }}
              style={{ background: "#fff", border: `1px solid ${GOLD}44`, borderRadius: "7px", color: "#0f2a14", fontFamily: FB, fontSize: "14px", padding: "6px 10px", cursor: "pointer", outline: "none" }}>
              {Array.from({ length: 21 }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px", color: M }}>Team</span>
            <select value={clearTeam} onChange={e => { setClearTeam(parseInt(e.target.value)); setClearConfirm(false); setClearMsg(""); }}
              style={{ background: "#fff", border: `1px solid ${GOLD}44`, borderRadius: "7px", color: "#0f2a14", fontFamily: FB, fontSize: "14px", padding: "6px 10px", cursor: "pointer", outline: "none" }}>
              {Array.from({ length: 18 }, (_, i) => i + 1).map(t => (
                <option key={t} value={t}>T{t}: {TEAMS[t]?.name}</option>
              ))}
            </select>
          </div>
          {clearOpp && (
            <span style={{ fontSize: "13px", color: M }}>
              vs <span style={{ color: CREAM, fontWeight: 600 }}>T{clearOpp} {TEAMS[clearOpp]?.name}</span>
              {clearHasData
                ? <span style={{ color: GOLD, marginLeft: "8px" }}>● has scores</span>
                : <span style={{ color: M, marginLeft: "8px" }}>○ no data</span>}
            </span>
          )}
          {!clearOpp && <span style={{ fontSize: "13px", color: M }}>No match this week</span>}
        </div>

        {clearOpp && clearHasData && (
          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "10px" }}>
            {!clearConfirm ? (
              <button onClick={() => setClearConfirm(true)}
                style={{ padding: "8px 18px", borderRadius: "8px", border: `1px solid ${R}55`, background: R + "12", color: R, fontFamily: FB, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
                Clear Scores
              </button>
            ) : (
              <>
                <span style={{ fontSize: "13px", color: R, fontWeight: 600 }}>Delete W{clearWeek} T{clearTeam} vs T{clearOpp}?</span>
                <button onClick={async () => {
                  await clearMatch?.(clearWeek, clearMk);
                  setClearConfirm(false);
                  setClearMsg("✓ Cleared");
                  setTimeout(() => setClearMsg(""), 3000);
                }}
                  style={{ padding: "7px 16px", borderRadius: "7px", border: `1px solid ${R}`, background: R, color: "#fff", fontFamily: FB, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                  Yes, delete
                </button>
                <button onClick={() => setClearConfirm(false)}
                  style={{ padding: "7px 14px", borderRadius: "7px", border: `1px solid ${GOLD}44`, background: "transparent", color: M, fontFamily: FB, fontSize: "13px", cursor: "pointer" }}>
                  Cancel
                </button>
              </>
            )}
            {clearMsg && <span style={{ fontSize: "13px", color: G, fontWeight: 600 }}>{clearMsg}</span>}
          </div>
        )}
      </div>

      {/* ── Reset Season (admin only) ───────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${R}33`, borderRadius: "14px", padding: "20px" }}>
        <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: R + "cc", marginBottom: "4px", fontWeight: 600 }}>
          Reset Entire Season
        </div>
        <div style={{ fontSize: "12px", color: M, marginBottom: "14px" }}>
          Deletes all match scores for every week. Handicaps, rules, and settings are preserved.
        </div>
        {resetPhase === 0 && (
          <button onClick={() => setResetPhase(1)}
            style={{ padding: "8px 18px", borderRadius: "8px", border: `1px solid ${R}55`, background: R + "12", color: R, fontFamily: FB, fontSize: "14px", fontWeight: 600, cursor: "pointer" }}>
            Reset Season…
          </button>
        )}
        {resetPhase === 1 && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", color: R, fontWeight: 600 }}>This will delete ALL scores. Are you sure?</span>
            <button onClick={() => setResetPhase(2)}
              style={{ padding: "7px 16px", borderRadius: "7px", border: `1px solid ${R}`, background: R + "20", color: R, fontFamily: FB, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
              Yes, continue
            </button>
            <button onClick={() => setResetPhase(0)}
              style={{ padding: "7px 14px", borderRadius: "7px", border: `1px solid ${GOLD}44`, background: "transparent", color: M, fontFamily: FB, fontSize: "13px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}
        {resetPhase === 2 && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "13px", color: R, fontWeight: 700 }}>Last chance — this cannot be undone.</span>
            <button onClick={async () => { setResetPhase(0); await clearSeason?.(); }}
              style={{ padding: "7px 16px", borderRadius: "7px", border: `1px solid ${R}`, background: R, color: "#fff", fontFamily: FB, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
              Delete everything
            </button>
            <button onClick={() => setResetPhase(0)}
              style={{ padding: "7px 14px", borderRadius: "7px", border: `1px solid ${GOLD}44`, background: "transparent", color: M, fontFamily: FB, fontSize: "13px", cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        )}
      </div>
      {/* ── Data Export ─────────────────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "20px" }}>
        <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: "4px", fontWeight: 600 }}>
          Export Data
        </div>
        <div style={{ fontSize: "12px", color: M, marginBottom: "14px" }}>
          Download season data as CSV files — open in Excel or Google Sheets.
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={() => exportStandings(teamStandings || [])}
            style={exportBtn}>
            ↓ Standings
          </button>
          <button onClick={() => exportHandicaps(league)}
            style={exportBtn}>
            ↓ Handicaps
          </button>
          <button onClick={() => exportScores(league)}
            style={exportBtn}>
            ↓ All Scores
          </button>
        </div>
      </div>

      {/* ── Snapshots ────────────────────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "20px" }}>
        <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: GOLD, marginBottom: "4px", fontWeight: 600 }}>
          Snapshots
        </div>
        <div style={{ fontSize: "12px", color: M, marginBottom: "14px" }}>
          Save a full backup of all scores and settings to Firestore. Restore any snapshot to roll back the season.
        </div>

        {/* Create snapshot */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
          <input
            value={snapshotLabel}
            onChange={e => setSnapshotLabel(e.target.value)}
            placeholder="Label (optional, e.g. 'After Week 3')"
            style={{ flex: 1, minWidth: "180px", background: "rgba(26,61,36,0.07)", border: `1px solid ${GOLD}44`, borderRadius: "8px", color: CREAM, fontFamily: FB, fontSize: "13px", padding: "8px 12px", outline: "none" }}
          />
          <button
            onClick={handleCreateSnapshot}
            disabled={snapshotStatus === "saving"}
            style={{ ...exportBtn, background: GOLD + "22", borderColor: GOLD + "66", color: GOLD }}>
            {snapshotStatus === "saving" ? "Saving…" : snapshotStatus === "saved" ? "✓ Saved!" : "Create Snapshot"}
          </button>
        </div>

        {snapshotStatus === "error" && (
          <div style={{ fontSize: "12px", color: R, marginBottom: "10px" }}>Something went wrong. Try again.</div>
        )}
        {snapshotStatus === "restored" && (
          <div style={{ fontSize: "12px", color: G, marginBottom: "10px" }}>✓ Snapshot restored successfully.</div>
        )}

        {/* Snapshot list */}
        {snapshots.length === 0 ? (
          <div style={{ fontSize: "12px", color: M }}>No snapshots yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {snapshots.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", background: "rgba(26,61,36,0.04)", border: `1px solid ${GOLD}22`, borderRadius: "8px", padding: "10px 12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: CREAM }}>
                    {s.label || s.createdAt}
                  </div>
                  <div style={{ fontSize: "11px", color: M, marginTop: "2px" }}>
                    {s.label ? s.createdAt + " · " : ""}{s.weeksCovered} week{s.weeksCovered !== 1 ? "s" : ""} of data
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Restore snapshot "${s.label || s.createdAt}"? This will overwrite all current scores.`)) {
                      handleRestore(s.id);
                    }
                  }}
                  disabled={snapshotStatus === "restoring"}
                  style={{ padding: "6px 14px", borderRadius: "7px", border: `1px solid ${GOLD}55`, background: "transparent", color: GOLD, fontFamily: FB, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                  {snapshotStatus === "restoring" && restoreId === s.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      </>}
    </div>
  );
}

const exportBtn = {
  padding: "8px 16px", borderRadius: "8px", border: `1px solid ${GOLD}44`,
  background: "transparent", color: GOLD, fontFamily: FB, fontSize: "13px",
  fontWeight: 600, cursor: "pointer", letterSpacing: "0.04em",
};
