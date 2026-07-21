# Map Route Stability Update V10

This update focuses only on route integrity, map layering, and zoom performance. The human-validation safegate and Claude API integration were not changed.

## Functional changes

- Vessel routes are rendered only when the corresponding vessel is inside the visible map area. This prevents orphan route lines from appearing in the Tuas close-up.
- At the Tuas zoom, the only local route shown is MERIDIAN STAR because it is the only vessel currently inside that viewport.
- MERIDIAN STAR now follows a harbour-water channel to the Tuas west berth face.
- All 18 global route geometries were checked and corrected where required.
- Vessel markers are below disruption markers and all Leaflet popups.
- Route rendering uses one Canvas-rendered dashed line instead of two SVG lines.
- Wrapped-world copies were reduced from five to three, while retaining east/west map wrapping.
- Tile buffering was reduced and tiles now update after movement settles.

## Geometry validation completed

- 18 vessel routes
- 328 route segments
- 99,371 sampled route points
- GSHHS 1.25 arc-minute land/sea mask
- Sampling interval: approximately 0.005 degrees or closer
- Detected land intersections: 0
- Missing route starts: 0
- Missing destinations: 0
- Route discontinuities: 0

## Interactive browser validation completed

### Full Chromium route matrix

- 18 vessels
- 10 zoom levels: 2.25, 3, 4, 5, 6, 8, 10, 12, 14, 16
- 5 wrapped-world positions: -720, -360, 0, +360, +720 degrees
- Total interactive map view changes: 900
- Missing vessel route layers: 0
- Runtime exceptions: 0

### Windows-emulated Chromium check

- Windows 10 / Win64 user agent
- 1600 × 900 viewport
- 18 vessels
- 4 zoom levels
- 3 wrapped-world positions
- Total checks: 216
- Failures: 0
- Runtime exceptions: 0

### Tuas view

- Centre: 1.2527, 103.6155
- Zoom: 13.25
- Visible vessel routes: MERIDIAN STAR only
- Distant/orphan route lines: 0

### Layer order

- Vessel pane: 540
- Disruption pane: 650
- Tooltip pane: 900
- Popup pane: 1000

This guarantees that vessel triangles remain below disruption popups.

## Performance changes

The previous lag came mainly from rendering each route twice, duplicating every map object across five world copies, disabling route clipping, and retaining a large tile buffer during zooming. V10 uses Canvas paths, one route stroke, three dynamic world copies, viewport filtering, and a smaller tile buffer.

## Testing limitation

The project was tested in the available Chromium environment and with a Windows 10 user-agent/viewport simulation. It is not technically possible in this environment to test every physical Windows computer, GPU, browser build, and display configuration. The geometry checks are browser-independent, and the interactive matrix covers the zoom and wrapped-world conditions that caused the reported failures.
