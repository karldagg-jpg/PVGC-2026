# PVGC 2026 — Change Log

---

## 1. Removed Auto-Advance Through Holes on Scoring Page
**File:** `src/App.jsx`

When opening the scoring page, the app used to automatically walk through all completed holes. Removed the `useEffect` that triggered this and the `lastAdvancedHole` ref that tracked it.

---

## 2. Show HCP Percentage on Entry Screen
**File:** `src/components/EntryTab.jsx`

Each player's header now shows their current handicap percentage alongside their HCP number (e.g., `HCP 8 · 90%`). The percentage reflects how many rounds they've played this season.

---

## 3. Moved Player Type Selector (Entry Screen)
**File:** `src/components/EntryTab.jsx`

The Regular / Sub / Phantom dropdown was moved from the far right of the row into the player header area, inline with the player's name and handicap info.

---

## 4. Max Score Label (Entry Screen)
**File:** `src/components/EntryTab.jsx`

When a player reaches the max score on a hole (par + 2 + strokes), the points display below that hole's input now shows **Max** and **-1** stacked in red instead of the normal points badge.

---

## 5. Removed Handicaps Editor from Scoring Page
**File:** `src/components/ScoringScreen.jsx`

The handicap input section that appeared at the bottom of the scoring page has been removed. Handicap management now lives exclusively in the Handicap screen.

---

## 6. Net Score Under Gross in Scorecard
**File:** `src/components/ScoringScreen.jsx`

The full scorecard table on the scoring page now shows the net score (gross minus stroke allocation) in small text below the gross score for each hole.

---

## 7. Stroke Indicator Dots in Scorecard
**File:** `src/components/ScoringScreen.jsx`

Green dots (•) appear at the top of each scorecard cell to show which holes a player receives strokes on, based on their handicap and the hole's stroke index.

---

## 8. Removed Handicap PIN Lock
**File:** `src/components/HandicapScreen.jsx`

The PIN gate that locked handicap editing has been removed. All weeks are now freely editable without a PIN.

---

## 9. Handicap Calculation Breakdown
**File:** `src/components/HandicapScreen.jsx`

Added a "How Handicaps Are Calculated" section at the bottom of the Handicap screen showing:
- The formula: `round(PCT × (avg gross − 36))`
- A per-player table with rounds played, percentage used, scores included, average, the full formula string, and the resulting handicap
- New members always use 60% with no cap; returning members ramp from 60% → 90% over rounds 1–5+

---

## 10. Hardened Handicap Usage — `getEffectiveHcp` Everywhere
**Files:** `src/App.jsx`, `src/components/ScoringScreen.jsx`, `src/components/EntryTab.jsx`

The scoring and entry pages were using `league.handicaps` (static starting values) for all handicap lookups. All lookups now use `getEffectiveHcp`, which applies the correct week-adjusted calculation:
- Week 1 → starting HCP
- Week 2 → 60% of round 1 gross
- Ramping up to 90% (best 7 of all rounds) from round 5 onward

This applies to: player ordering (low/high), stroke allocation per hole, net score display, and the handicap snapshot saved with each match.

---

## 11. Arrow Key Navigation on Entry Screen
**File:** `src/components/EntryTab.jsx`

Score input cells can now be navigated with:
- **→ / Tab / Enter** — move right; wraps to next player at hole 9
- **← / Shift+Tab** — move left; wraps to previous player at hole 1
- **↓ / ↑** — move between players on the same hole

---

## 12. Raw Handicap Tie-Breaking for Low/High Order
**Files:** `src/lib/leagueLogic.js`, `src/components/EntryTab.jsx`, `src/components/ScoringScreen.jsx`

Added `getEffectiveHcpRaw` which returns the unrounded handicap float. When two players on the same team have the same rounded handicap, the raw value (e.g., 7.6 vs 8.4) is used to determine who is Low and who is High, instead of always defaulting to player index 0.

---

## 13. Manual Low/High Override
**Files:** `src/lib/leagueLogic.js`, `src/components/EntryTab.jsx`, `src/components/ScoringScreen.jsx`, `src/App.jsx`, `src/lib/persistence.js`

Added the ability to manually swap which player is Low or High for a specific team and week.

- A **⇅ Swap** button appears in the player header for each team on the entry screen
- When active it shows **⇅ Swapped** in gold
- Click again to clear the override and return to the auto-calculated order
- Overrides are stored in `league.loHiOverrides` and persisted to Firebase

---

## 14. Synced Week Selection Across Scoring and Entry Tabs
**File:** `src/App.jsx`

The scoring tab and entry tab now share a single `selWeek` state. Changing the week on either tab updates both. This ensures that Low/High overrides and handicap calculations are always applied to the same week across both views.

---

## Bug Fixes

| Bug | Fix |
|-----|-----|
| Opening scoring page auto-walked through all completed holes | Removed the `useEffect` that triggered after match load |
| Changing one player's type (Sub/Phantom) changed multiple players | Fixed swapped match load to use `\|\| ["normal","normal"]` fallbacks instead of setting `undefined` |
| Low/High override reverted immediately after being set | `loHiOverrides` was not included in the Firebase save payload or restore path — added to both |
