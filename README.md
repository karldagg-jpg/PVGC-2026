# PVGC-2026

React + Vite web app for managing the Pickering Valley Golf Club 2026 league season.

## Development
- Install: `npm install`
- Run locally: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`

## Stack
- `React 18` + `Vite 5` (`@vitejs/plugin-react`)
- `Firebase Firestore` (compat API via `firebase/compat/*`)
- Single Firestore document for league state: `pvgc/league-2026`

## Project Structure (Agent Reference)
```text
.
|- .github/
|  `- workflows/
|     `- deploy-pages.yml        # GitHub Pages build/deploy workflow
|- src/
|  |- components/
|  |  |- EntryTab.jsx            # Bulk score entry UI/workflow
|  |  |- HandicapScreen.jsx      # Handicap management (PIN gated)
|  |  |- PotyScreen.jsx          # Player of the Year views
|  |  |- ScheduleScreen.jsx      # Week schedule + status + playoff rounds
|  |  |- ScoringScreen.jsx       # Per-match live scoring UI
|  |  |- StandingsScreen.jsx     # Team standings table
|  |  `- ui.jsx                  # Shared presentational controls
|  |- constants/
|  |  |- league.js               # Teams, schedule, pars/SI, handicap seeds, tee times
|  |  `- theme.js                # Color/type/style constants
|  |- firebase/
|  |  `- client.js               # Firebase init + LEAGUE_DOC reference
|  |- lib/
|  |  |- format.js               # Date/text formatting helpers
|  |  `- leagueLogic.js          # Core league rules, scoring, standings, playoffs, hcp math
|  |- App.jsx                    # App shell, routing by tab, Firestore sync, save/load orchestration
|  |- main.jsx                   # React entrypoint
|  `- styles.css                 # Global styles
|- index.html                    # Vite app mount
|- vite.config.js                # Vite config (`base: "/PVGC-2026/"`)
|- package.json                  # Scripts and dependencies
`- README.md
```

## Data Model
- `league.handicaps`: `{ [teamId]: [p1Hcp, p2Hcp] }`
- `league.results`: `{ [week]: { [matchKey]: matchRecord } }`
- `league.hcpOverrides`: `{ "team-player-week": hcpValue }`
- `matchRecord` includes `t1scores`, `t2scores`, `t1types`, `t2types`, `rainout`, `holesPlayed`, `hcpSnapshot`, `updatedBy`, `updatedAt`

## Runtime Behavior
- `App.jsx` loads once from Firestore and subscribes with `onSnapshot`.
- Saves use `LEAGUE_DOC.set(..., { merge: true })`.
- Match objects are JSON-encoded before save and normalized back on load.
- Recent local save echo is ignored for ~8 seconds to prevent state bounce.
- Scoring autosave is debounced to 5 seconds.

## Feature Map
- Tabs: `schedule`, `scoring`, `entry`, `standings`, `poty`, `hcp`
- Dynamic playoff pairing generation:
  - Week 18: knockdown
  - Week 19: quarterfinals
  - Week 20: semifinals
  - Week 21: championship + third-place
- Scorecard image extraction is wired through Anthropic Messages API in `App.jsx`.

## Deployment
- GitHub Pages workflow: `.github/workflows/deploy-pages.yml`
- Push to `main` or `master` builds `dist/` and deploys via Actions.
- Vite base path is set for Pages: `"/PVGC-2026/"`.

## Testing Guidance
- Prioritize logic-level tests around exports in `src/lib/leagueLogic.js`:
  - `calcLeagueStats`
  - `calcWeekBonus`
  - handicap helpers
  - playoff pair helpers
- Keep end-to-end/UI tests focused on interaction flow; validate scoring correctness in logic tests.
