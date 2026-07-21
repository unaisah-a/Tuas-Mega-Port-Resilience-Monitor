# V5 map corrections

- Added dynamic longitude wrapping for vessels, routes, destinations, weather cells and disruption markers.
- Five adjacent world copies are maintained around the active longitude, preventing objects from disappearing while panning through the Pacific.
- Vessel arrows now calculate their heading from each vessel's first route leg rather than using a shared/static direction.
- Tuas Port view now targets the actual port centre at 1.2527, 103.6155 and recentres on every button press, even when the Tuas button is already active.
- Tuas routes switch to dedicated local pilot approaches at close zoom. These terminate at a labelled marine arrival gate beside the port instead of crossing reclaimed land.
- Global vessel routes were regenerated from a maritime routing graph. Every route starts at its vessel and terminates at its named port/marine approach.
- Horizontal map panning remains continuous. Vertical panning is clamped with extra Web Mercator padding to prevent exposing the map's upper or lower edge.
- Reworded the Cape of Good Hope disruption to focus on winter swell, fuel use, bunkering and schedule pressure.
- Anthropic/Claude LIVE mode, API-key handling, request headers, model field, response parsing and fallbacks were not changed.
