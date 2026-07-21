import fs from 'node:fs';
import {
  ROUTE_DESTINATIONS,
  TUAS_FOCUS_VESSEL_IDS,
  TUAS_LOCAL_ROUTES,
  TUAS_PORT_POSITION,
  TUAS_VIEW,
  WORLD_VESSELS,
} from '../src/data/worldMapData.js';

const failures = [];
const eps = 1e-9;
const eq = (a, b) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;

if (!eq(TUAS_VIEW.center, TUAS_PORT_POSITION)) {
  failures.push('Tuas view is not centred on the Tuas Port coordinate');
}
if (TUAS_LOCAL_ROUTES.length !== 1) {
  failures.push(`Expected one Tuas local route, found ${TUAS_LOCAL_ROUTES.length}`);
}
if (TUAS_FOCUS_VESSEL_IDS.length !== 1 || TUAS_FOCUS_VESSEL_IDS[0] !== 'MERIDIAN_STAR') {
  failures.push('Tuas close-up should render only MERIDIAN STAR');
}

const route = TUAS_LOCAL_ROUTES[0];
const vessel = WORLD_VESSELS.find((item) => item.id === route?.vesselId);
const berth = ROUTE_DESTINATIONS.find((item) => item.id === route?.destinationId);
const points = route?.segments?.flat() || [];
if (!vessel || !eq(points[0], vessel.position)) failures.push('Local route does not start at its vessel');
if (!berth || !eq(points.at(-1), berth.routeEndpoint)) failures.push('Local route does not end at the berth water-side endpoint');
if (route?.segments?.length !== 1) failures.push('Local route is unexpectedly split into multiple segments');
if (points.length < 8) failures.push('Local route needs at least eight controlled waypoints');

// The close-up route must approach from the open water south-west of the
// terminal. This protects against the previous line crossing the reclaimed
// terminal, Jurong Island, or the Singapore mainland.
for (const [index, [lat, lon]] of points.entries()) {
  if (lat < 1.19 || lat > 1.251 || lon < 103.57 || lon > 103.607) {
    failures.push(`Waypoint ${index} leaves the Tuas water approach envelope: ${lat}, ${lon}`);
  }
  if (index > 0) {
    const previous = points[index - 1];
    if (lon < previous[1] - eps) failures.push(`Waypoint ${index} reverses westward unexpectedly`);
    if (Math.hypot(lat - previous[0], lon - previous[1]) > 0.02) {
      failures.push(`Waypoint ${index} creates an overlong straight shortcut`);
    }
  }
}

const mapSource = fs.readFileSync(new URL('../src/components/CommandMap.jsx', import.meta.url), 'utf8');
for (const required of [
  'routesToRender = isTuasMode ? TUAS_LOCAL_ROUTES : SEA_ROUTE_LINES',
  'vesselsToRender = isTuasMode',
  'key="tuas-standard-basemap"',
  'tile.openstreetmap.org',
  'smoothFactor={isTuasMode ? 0 : 0.35}',
  'noClip',
  '!isTuasMode && weatherVisible',
  '!isTuasMode && worldRiskEvents.flatMap',
]) {
  if (!mapSource.includes(required)) failures.push(`Missing Tuas focus safeguard: ${required}`);
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Tuas focus passed: exact port centre, standard street basemap, ${points.length} sea-approach waypoints, one vessel and one persistent route.`);
