# V4 corrections

## Map and routes
- Tuas Port view now centres on the Tuas marine arrival gate.
- Vertical map panning is constrained to the Web Mercator world, while horizontal wrapping remains enabled.
- The minimum zoom is calculated from the map height so no empty area can appear above or below the world.
- All 18 vessels now have a continuous route from the vessel marker to a named marine port approach.
- Route simplification is disabled and route clipping is disabled, preventing zoom-dependent shortcuts and disappearing segments.
- The Pacific date-line route is split at the date line to prevent a line across the whole map.
- Route geometry was checked against Basemap's intermediate-resolution land polygons; zero intersections were found.

## Vessel details
- The AI chat's View Vessel Details button now issues a new open request every time, even if that vessel is already selected.
- The map flies to the vessel and opens its details card.
- Escape continues to close vessel and disruption details.

## Chat presentation
- Responses now show Situation Summary and Recommended Actions first.
- View Analysis expands the detailed sections.
- The Anthropic API request, API key field, model field, LIVE parsing and fallback logic were not changed.
