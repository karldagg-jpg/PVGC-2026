/**
 * push2026.cjs — Push 2026 starting handicaps into Firebase.
 *
 * Usage:
 *   node scripts/push2026.cjs          # push DEFAULT_HCP to league-2026
 *
 * Run from the project root.
 */

const firebase = require("firebase/compat/app");
require("firebase/compat/firestore");

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
const DOC = db.collection("pvgc").doc("league-2026");

// DEFAULT_HCP from src/constants/league_2026.js
// Update this object whenever starting handicaps change, then re-run the script.
const DEFAULT_HCP = {
  1:  [6,6],   // Brian Charles (6), Karl Dagg (6)
  2:  [6,10],  // Steve Brosius, Mike Albano
  3:  [6,7],   // Baz Mistry, Sanjay Reddy
  4:  [9,11],  // Scot Pineno, Scott MacKenzie
  5:  [2,6],   // Jack Carickhoff (2), Tracy Schantz (6)
  6:  [3,0],   // Scott Glascott (3), Mark Adler (new member)
  7:  [10,9],  // John Harvey, Jeff Rowles
  8:  [8,10],  // Bob Saenz, Dennis Huston
  9:  [7,0],   // Chris Fahey (7), Berry Wzorek (TBD)
  10: [7,4],   // Tom Mulvey (7), Chris Nelson (4)
  11: [11,16], // Jack West, Ron Herman
  12: [13,3],  // Gabe Lorenz, Jake Huckestein
  13: [16,11], // Betsy Wagner, Gordon Hammond
  14: [7,1],   // John Franks, Scott Lightbody
  15: [10,8],  // Jesse Jurden (10), JC Olivos (8)
  16: [7,28],  // Rhonda Lukas, Carol Blizard
  17: [10,9],  // Russ Posey, Aret Minasian
  18: [18,9],  // Barry Pavelik, Mark Mitchell
};

(async () => {
  try {
    console.log("Pushing 2026 starting handicaps to Firebase …");
    // merge: true so existing results/hcpOverrides are preserved
    await DOC.set({ handicaps: DEFAULT_HCP }, { merge: true });
    console.log("✓ Done — league-2026 handicaps updated");
    console.log("");
    console.log("Teams updated:");
    for (const [tid, hcps] of Object.entries(DEFAULT_HCP)) {
      console.log(`  T${tid}: [${hcps}]`);
    }
    process.exit(0);
  } catch (e) {
    console.error("Error:", e.message || e);
    process.exit(1);
  }
})();
