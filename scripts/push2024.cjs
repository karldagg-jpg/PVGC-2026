/**
 * push2024.js — Push 2024 import data into Firebase week by week.
 *
 * Usage:
 *   node scripts/push2024.js          # load all weeks
 *   node scripts/push2024.js 1        # load only week 1
 *   node scripts/push2024.js 1 5      # load weeks 1 through 5
 *   node scripts/push2024.js --reset  # wipe league-2024 and start fresh
 *
 * Run from the project root.
 */

const firebase = require("firebase/compat/app");
require("firebase/compat/firestore");
const fs   = require("fs");
const path = require("path");

const firebaseConfig = {
  apiKey:            "AIzaSyA0ubEbHoYbfCSjfNxHUkt_fr_6WMb3t5Y",
  authDomain:        "pvgc-league.firebaseapp.com",
  projectId:         "pvgc-league",
  storageBucket:     "pvgc-league.firebasestorage.app",
  messagingSenderId: "731595471102",
  appId:             "1:731595471102:web:d4ad8bf15746bab7874daf",
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db  = firebase.firestore();
const DOC = db.collection("pvgc").doc("league-2024");

const DATA_FILE = path.join(__dirname, "..", "data", "2024-import.json");
const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

// ── Helpers ──────────────────────────────────────────────────────────────────
// Inject hcpSnapshot into every match record using hcpOverrides for that week.
// This ensures computePlayerTotal uses the actual Excel handicaps, not DEFAULT_HCP fallback.
function encodeResults(results, hcpOverrides) {
  const out = {};
  for (const [w, matches] of Object.entries(results)) {
    out[w] = {};
    for (const [mk, rec] of Object.entries(matches)) {
      const parts = mk.split("-");
      const week  = parseInt(w);
      const tlow  = parseInt(parts[1]);
      const thigh = parseInt(parts[2]);
      const hcpSnapshot = {
        [tlow]:  [0, 1].map(pi => hcpOverrides?.[`${tlow}-${pi}-${week}`]  ?? 0),
        [thigh]: [0, 1].map(pi => hcpOverrides?.[`${thigh}-${pi}-${week}`] ?? 0),
      };
      out[w][mk] = JSON.stringify({ ...rec, hcpSnapshot });
    }
  }
  return out;
}

async function loadWeeks(fromWeek, toWeek) {
  // Filter results to only the requested weeks
  const filteredResults = {};
  for (let w = fromWeek; w <= toWeek; w++) {
    if (data.results[String(w)]) {
      filteredResults[String(w)] = data.results[String(w)];
    }
  }

  // Also filter hcpOverrides to only weeks <= toWeek
  const filteredHcpOverrides = {};
  for (const [key, val] of Object.entries(data.hcpOverrides || {})) {
    const week = parseInt(key.split("-")[2]);
    if (week <= toWeek) filteredHcpOverrides[key] = val;
  }

  const payload = {
    handicaps:    data.defaultHcp,
    results:      encodeResults(filteredResults, filteredHcpOverrides),
    hcpOverrides: filteredHcpOverrides,
    loHiOverrides: {},
  };

  console.log(`Pushing weeks ${fromWeek}–${toWeek} (${Object.keys(filteredResults).length} weeks, ${
    Object.values(filteredResults).reduce((s, m) => s + Object.keys(m).length, 0)
  } matches) …`);

  await DOC.set(payload, { merge: false });
  console.log("✓ Done");
}

async function reset() {
  console.log("Resetting league-2024 …");
  await DOC.set({
    handicaps: data.defaultHcp,
    results: {},
    hcpOverrides: {},
    loHiOverrides: {},
  });
  console.log("✓ Reset complete");
}

// ── Main ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

(async () => {
  try {
    if (args[0] === "--reset") {
      await reset();
    } else {
      const from = args[0] ? parseInt(args[0]) : 1;
      const to   = args[1] ? parseInt(args[1]) : 18;
      await loadWeeks(from, to);
    }
    process.exit(0);
  } catch (e) {
    console.error("Error:", e.message || e);
    process.exit(1);
  }
})();
