# Tuas Mega Port Resilience Monitor

A React/Vite classroom prototype for monitoring simulated vessel delays, berth congestion, route risk, weather disruption and cold-chain shipments around Tuas Mega Port.

## What is improved in this version

- The map now works like a global interactive web map: drag anywhere around the world, scroll to zoom and use the `+` / `−` controls.
- Vessel markers use latitude and longitude. They stay attached to the correct map position and keep the same icon size while zooming.
- **Global Map** returns to a whole-world view. **Tuas Port (Zoomed)** flies directly to Tuas Mega Port and displays a port label.
- The **Layers** button now opens two working layers:
  - Global Esri satellite imagery.
  - A global OpenStreetMap basemap when satellite imagery is off.
  - A simulated six-hour worldwide weather forecast with a timeline and play/pause control.
- The map cards can be hidden separately. Use **Map cards** to turn Weather, Port, Legend or Global Disruptions back on.
- The former reset/sun control is now a working light-mode/dark-mode switch.
- **More Filters** has been removed.
- Simulation controls are now shown in their own card.
- Berth occupancy is adjustable from 60% to 98% with a slider.
- The AI chat panel has a fixed height. New messages scroll inside the panel instead of making the page longer.
- Each of the four quick questions has a separate answer based on the current simulated dashboard data.
- Existing MOCK, LIVE and DEGRADED modes remain available. The API-key workflow is retained.

All operational values remain simulated and must not be used for real port decisions.

## Run in VS Code or another IDE

1. Unzip the project.
2. Open `Tuas-Mega-Port-Resilience-Monitor-2-main` in the IDE.
3. Open a terminal in that folder.
4. Run:

```bash
npm install
npm run dev
```

5. Open the local address shown by Vite, normally:

```text
http://localhost:5173
```

Keep the terminal running while using the web app.

## Production build

```bash
npm run build
npm run preview
```

The production files are created in `dist/`.

## Main files changed

```text
src/App.jsx                         Dashboard controls, layers, theme and simulations
src/components/ChatAdvisor.jsx      Fixed chat layout and four distinct quick answers
src/components/CommandMap.jsx       Global Leaflet map, stable basemap switching, worldwide risks and vessels
src/data/worldMapData.js             Global vessel positions, sea-safe route waypoints and weather cells
src/data/simulation.js              Adjustable berth simulation and July 2026 risk-event context
src/index.css                       Map markers, timelines, dark mode and layout styling
package.json / package-lock.json    Leaflet and React-Leaflet dependencies
```

## Important map note

Both basemaps load from online tile services, so internet access is needed. Turning satellite imagery off switches to a worldwide OpenStreetMap layer at the same centre and zoom; it no longer uses the old Southeast Asia image overlay.

## Latest fixes

- Added a **Hide controls / Show controls** button in the top toolbar. It collapses the filters and simulation card so the map can use more screen space.
- Reworked the berth-occupancy simulation:
  - Starts at the real prototype baseline of **72%**, not the slider minimum.
  - Slider runs from 60% to 98% and applies changes immediately.
  - Terminal occupancy, waiting vessels, delays and risk levels now recalculate for both lower-load and higher-load scenarios.
  - Added clear labels and a **Reset to 72%** button.
- Restored the complete API-key controls in the AI panel:
  - Visible MOCK and LIVE mode buttons.
  - Claude (Anthropic) provider display.
  - API key field with show/hide control.
  - Model field.
  - Existing LIVE request and DEGRADED fallback logic remains unchanged in `src/agent/liveBrain.js`.

## Global-map correction

- Removed the Southeast Asia-only image overlay and the regional pan boundary.
- Minimum zoom now supports a whole-world view, and the map can pan continuously around the globe.
- Satellite and street basemaps share the same Leaflet coordinate system, so switching layers no longer shifts the map.
- Vessel icons stay fixed in pixel size while their latitude/longitude anchors remain fixed on the map.
- Dotted shipping corridors now use multiple sea waypoints rather than straight lines that cut across land.
- Added worldwide simulated weather cells plus July 2026 geopolitical risk markers for Hormuz, the Red Sea/Bab el-Mandeb and the Black Sea/Sea of Azov.
- Map-layer switches use a fixed-width, contained layout and no longer protrude outside the menu.

The geopolitical summaries are frozen as of 11 July 2026. They provide classroom context; operational decisions require live maritime-security feeds.

## July 2026 global-map corrections

- The AI delay response and every dashboard delay card now use the same canonical simulation snapshot. Baseline is 18.6 hours at 72% berth occupancy.
- Global panning is constrained to the real Web Mercator world bounds. Repeated world copies and empty map edges are disabled without reducing normal zoom functionality.
- Satellite and street basemaps use the same Leaflet coordinate system and retain the same centre and zoom when switched.
- Global sea routes were re-waypointed and checked against a land/sea mask. At Tuas zoom, the dashboard displays separate offshore pilot approaches which stop before reclaimed port land.
- The vessel information card closes with Escape.
- The disruption list is interactive: selecting an item flies to the location and opens its map popup.
- Global risk scenarios are distributed across North America, Europe, South America, China, Africa, Australia, the Middle East, Singapore and the Pacific.
- Red circles represent security/conflict risks. Amber circles represent weather, port and climate risks.
- MOCK/LIVE mode, Anthropic API-key input and the existing live-agent implementation are retained.

All operational data remains simulated for classroom demonstration and must not be used for navigation or real-world decisions.

## System prompt (Knowledge Grounding & System Prompting)

The agent's institutional knowledge lives in `src/agent/prompts/`, split so each
file maps to one requirement of the assignment specification:

| File | Requirement | Defines |
|---|---|---|
| `persona.js` | Persona | Senior Logistics Planner at a Tier-1 3PL; ops-officer tone; **advisor only — no authority to execute** |
| `constraints.js` | Constraints | Cold-chain over cost; safety/compliance absolute; quantify only from the supplied snapshot; stay inside the maritime logistics domain |
| `actionLogic.js` | Action Logic | Conflicting reports → name the conflict, plan for the worst case; out-of-distribution data → flag, conservative holding action, Low confidence + HUMAN VALIDATION REQUIRED; challenged recommendations → re-evaluate honestly, never fold on a safety rule |
| `style.js` | Output contract | The four-view structure and `Confidence:` / `Data used:` lines that `liveBrain.js` parses |

`prompts/index.js` assembles these into `SYSTEM_PROMPT`, which `liveBrain.js`
sends as the `system` parameter on every LIVE request.

**How the same rules apply in MOCK mode.** MOCK mode has no model to prompt, so
it enforces the identical rules in code: `mockBrain.js` contains the executable
counterpart of the domain boundary and produces the same four-view response
shape. Out-of-domain questions are declined in both modes.

Verify with:

```bash
npm run test:prompt
```
