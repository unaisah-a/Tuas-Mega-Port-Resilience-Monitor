# Global map corrections v3

- Compact controls: the three filters are followed immediately by a horizontal simulation row.
- Removed the forecast timeline overlay from the map; the forecast slider remains in Layers.
- Enabled continuous east/west world wrapping while retaining vertical map-edge clamping.
- Weather polygons are non-interactive and rendered below disruption markers, so map disruptions remain clickable.
- Vessel routes no longer switch datasets at a zoom threshold. Every route is continuous at all zoom levels.
- Tuas routes use a shared offshore handoff and a final pilot segment that stops in navigable water south-west of the terminal.
- Route segments were sampled against a Natural Earth land polygon during build validation; no sampled segment intersected land.
- Existing MOCK/LIVE mode, API key, provider and model controls were left unchanged.
