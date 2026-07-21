# Route cleanup V7

- Removed the two standalone Tuas approach lines because they were not attached to any vessel.
- Split the PACIFIC ORBIT route at the International Date Line so Leaflet no longer draws a full-width horizontal dotted line across the world map.
- Added a route-integrity check that rejects any raw longitude jump greater than 180 degrees inside a route segment.
