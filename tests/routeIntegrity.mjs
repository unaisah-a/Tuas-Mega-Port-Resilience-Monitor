import {
  SEA_ROUTE_LINES,
  TUAS_LOCAL_ROUTES,
  ROUTE_DESTINATIONS,
  WORLD_VESSELS,
} from '../src/data/worldMapData.js';

const EPS = 1e-6;
const destinationById = Object.fromEntries(ROUTE_DESTINATIONS.map(x => [x.id, x]));
const vesselById = Object.fromEntries(WORLD_VESSELS.map(x => [x.id, x]));

function lonDelta(a, b) {
  return ((b - a + 180) % 360 + 360) % 360 - 180;
}
function distance(a, b) {
  return Math.hypot(b[0] - a[0], lonDelta(a[1], b[1]));
}
function project([lat, lon], zoom, offset = 0) {
  const scale = 256 * 2 ** zoom;
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sin = Math.sin((clampedLat * Math.PI) / 180);
  return {
    x: ((lon + offset + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale,
  };
}

const failures = [];
for (const route of SEA_ROUTE_LINES) {
  const segments = route.segments || [route.positions || []];
  const vessel = vesselById[route.vesselId];
  const destination = destinationById[route.destinationId];
  if (!vessel) failures.push(`${route.id}: missing vessel`);
  if (!destination) failures.push(`${route.id}: missing destination`);
  if (!segments.length || segments.some(segment => segment.length < 2)) {
    failures.push(`${route.id}: empty or one-point segment`);
    continue;
  }
  if (vessel && distance(segments[0][0], vessel.position) > EPS) {
    failures.push(`${route.id}: route does not start at vessel`);
  }
  if (destination && distance(segments.at(-1).at(-1), destination.routeEndpoint) > EPS) {
    failures.push(`${route.id}: route does not end at destination`);
  }
  for (let index = 1; index < segments.length; index += 1) {
    if (distance(segments[index - 1].at(-1), segments[index][0]) > EPS) {
      failures.push(`${route.id}: discontinuity before segment ${index}`);
    }
  }
  for (const segment of segments) {
    for (let index = 1; index < segment.length; index += 1) {
      const rawLongitudeJump = Math.abs(segment[index][1] - segment[index - 1][1]);
      if (rawLongitudeJump > 180) {
        failures.push(`${route.id}: raw longitude jump over 180° before point ${index}`);
      }
    }
  }
  for (const zoom of [2, 2.25, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18]) {
    for (const offset of [-1080, -720, -360, 0, 360, 720, 1080]) {
      for (const segment of segments) {
        const projected = segment.map(point => project(point, zoom, offset));
        if (projected.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) {
          failures.push(`${route.id}: invalid projection at zoom ${zoom}, offset ${offset}`);
        }
      }
    }
  }
}

if (TUAS_LOCAL_ROUTES.length !== 1) {
  failures.push(`Tuas close-up contains ${TUAS_LOCAL_ROUTES.length} route(s); expected one controlled harbour approach`);
}

const localTuasRoute = TUAS_LOCAL_ROUTES[0];
if (localTuasRoute) {
  const localPoints = (localTuasRoute.segments || []).flat();
  const meridian = vesselById.MERIDIAN_STAR;
  const berth = destinationById.TUAS_BERTHS;
  if (!meridian || distance(localPoints[0], meridian.position) > EPS) {
    failures.push('Tuas local route does not start at MERIDIAN STAR');
  }
  if (!berth || distance(localPoints.at(-1), berth.routeEndpoint) > EPS) {
    failures.push('Tuas local route does not end at the west berth water-side point');
  }
  // The dedicated close-up route must stay south-west of the terminal land mass
  // until its final water-side berth approach.
  for (const [index, point] of localPoints.entries()) {
    if (index < localPoints.length - 1 && point[0] > 1.2525 && point[1] > 103.607) {
      failures.push(`Tuas local route enters the terminal land envelope at point ${index}`);
    }
  }
}

const meridianRoute = SEA_ROUTE_LINES.find(route => route.vesselId === 'MERIDIAN_STAR');
if (!meridianRoute) {
  failures.push('MERIDIAN_STAR: missing route');
} else {
  if (meridianRoute.destinationId !== 'TUAS_BERTHS') {
    failures.push('MERIDIAN_STAR: route does not target the Tuas berth face');
  }
  const points = (meridianRoute.segments || []).flat();
  if (points.length < 8) {
    failures.push('MERIDIAN_STAR: berth route has too few sea waypoints');
  }
  const berthDestination = destinationById.TUAS_BERTHS;
  if (!berthDestination || distance(points.at(-1), berthDestination.routeEndpoint) > EPS) {
    failures.push('MERIDIAN_STAR: route does not finish at the berth face');
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(`Route integrity passed: ${SEA_ROUTE_LINES.length} global vessel routes, ${TUAS_LOCAL_ROUTES.length} dedicated Tuas approach, 12 zoom levels, 7 wrapped-world offsets.`);
