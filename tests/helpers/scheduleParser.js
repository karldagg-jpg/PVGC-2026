import fs from "node:fs";
import XLSX from "xlsx";

function toInt(v, fallback = null) {
  return typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;
}

function excelDateToIso(v) {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const d = XLSX.SSF.parse_date_code(v);
  if (!d) return null;
  const mm = String(d.m).padStart(2, "0");
  const dd = String(d.d).padStart(2, "0");
  return `${d.y}-${mm}-${dd}`;
}

export function parseScheduleWorkbook(filePath = "tests/data/schedule.xlsx") {
  if (!fs.existsSync(filePath)) return null;

  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  const schedule = {};
  // Week rows are at rows 5..25 in this workbook layout (1-indexed).
  for (let r = 4; r <= 24; r += 1) {
    const row = rows[r] || [];
    const week = toInt(row[1], null);
    if (!week) continue;

    const pairs = [];
    for (let c = 3; c <= 20; c += 2) {
      const a = toInt(row[c], null);
      const b = toInt(row[c + 1], null);
      if (a && b) pairs.push([a, b]);
    }

    schedule[week] = {
      week,
      date: excelDateToIso(row[2]),
      pairs,
    };
  }

  const teams = {};
  // Team rows are at rows 29..46 (1-indexed): "<tid> Name1 - Name2"
  for (let r = 28; r <= 45; r += 1) {
    const label = String((rows[r] || [])[1] || "").trim();
    if (!label) continue;
    const m = label.match(/^(\d+)\s+(.+)$/);
    if (!m) continue;
    const tid = parseInt(m[1], 10);
    const pair = m[2].split("-").map((x) => x.trim());
    teams[tid] = {
      name: m[2],
      p1: pair[0] || `Team ${tid} P1`,
      p2: pair[1] || `Team ${tid} P2`,
    };
  }

  return { schedule, teams };
}
