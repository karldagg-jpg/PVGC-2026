import React, { useState } from "react";
import { SCHEDULE_RAW, TEAMS, getTeeTimes, SEASON_YEAR } from "../constants/league";
import { G, M, CREAM, GOLD, CARD, FB, FD } from "../constants/theme";
import { fmtDate } from "../lib/format";

function printStarterSheet(week, pairs, teeTimes) {
  const dateStr = fmtDate(SCHEDULE_RAW.find(r => r[0] === week)?.[1]) || "";
  const rows = pairs.map(([ta, tb], i) => {
    const time = teeTimes[i] || "";
    const t1 = TEAMS[ta] || {};
    const t2 = TEAMS[tb] || {};
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

export default function AdminScreen({ league, knockdownPairs, qfPairs, sfPairs, finalPairs }) {
  const regularWeeks = SCHEDULE_RAW.filter(([w]) => w < 18).map(([w]) => w);
  const [selWeek, setSelWeek] = useState(regularWeeks[regularWeeks.length - 1] || 1);

  const weekRow = SCHEDULE_RAW.find(([w]) => w === selWeek);
  const rawPairs = weekRow ? weekRow.slice(2).filter(Array.isArray) : [];
  const dynPairs = selWeek === 18 ? knockdownPairs
    : selWeek === 19 ? qfPairs
    : selWeek === 20 ? (sfPairs || [])
    : selWeek === 21 ? (finalPairs ? [finalPairs.championship, finalPairs.thirdPlace] : [])
    : null;
  const pairs = dynPairs || rawPairs;

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "24px 16px" }}>
      <div style={{ fontFamily: FD, fontSize: "26px", fontWeight: 600, color: CREAM, marginBottom: "20px" }}>
        Admin
      </div>

      {/* ── Print Starter Sheet ──────────────────────────────────── */}
      <div style={{ background: CARD, border: `1px solid ${GOLD}33`, borderRadius: "14px", padding: "20px" }}>
        <div style={{ fontSize: "13px", letterSpacing: "0.1em", textTransform: "uppercase", color: M, marginBottom: "14px", fontWeight: 600 }}>
          Print Starter Sheet
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
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
              {SCHEDULE_RAW.map(([w]) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => printStarterSheet(selWeek, pairs, getTeeTimes(selWeek))}
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
    </div>
  );
}
