import React, { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  GLOBAL_WEATHER_CELLS,
  ROUTE_DESTINATIONS,
  SEA_ROUTE_LINES,
  TUAS_POSITION,
  TUAS_VIEW,
  TUAS_LOCAL_ROUTES,
  TUAS_FOCUS_VESSEL_IDS,
  WORLD_BOUNDS,
  WORLD_VESSELS,
  WORLD_VIEW,
} from "../data/worldMapData.js";

const RISK = {
  low: { color: "#35a853", label: "Low Risk" },
  medium: { color: "#f59e0b", label: "Medium Risk" },
  high: { color: "#ef3f32", label: "High Risk" },
  severe: { color: "#b91c1c", label: "Severe Risk" },
};

// Global disruptions follow the two circle colours shown in the legend:
// red = security/conflict; amber = weather, port and climate disruption.
const EVENT_COLORS = {
  Security: "#dc2626",
  Conflict: "#dc2626",
  Weather: "#f59e0b",
  Port: "#f59e0b",
  Climate: "#f59e0b",
};

const WRAP_NEIGHBORS = [-360, 0, 360];

function offsetPosition(position, longitudeOffset) {
  return [position[0], position[1] + longitudeOffset];
}

function offsetSegment(segment, longitudeOffset) {
  return segment.map((point) => offsetPosition(point, longitudeOffset));
}

function nearestWrappedOffset(longitude, referenceLongitude) {
  return Math.round((referenceLongitude - longitude) / 360) * 360;
}

function routeHeading(route) {
  const segment = route?.segments?.find((item) => item?.length >= 2);
  if (!segment) return 0;
  const [start, next] = segment;
  let deltaLongitude = next[1] - start[1];
  if (deltaLongitude > 180) deltaLongitude -= 360;
  if (deltaLongitude < -180) deltaLongitude += 360;
  const latitudeScale = Math.cos((((start[0] + next[0]) / 2) * Math.PI) / 180);
  const x = deltaLongitude * Math.max(0.2, latitudeScale);
  const y = -(next[0] - start[0]);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function riskColor(intensity, stormActive) {
  const adjusted = stormActive ? Math.min(1, intensity + 0.14) : intensity;
  if (adjusted >= 0.88) return "#dc2626";
  if (adjusted >= 0.68) return "#f97316";
  if (adjusted >= 0.48) return "#facc15";
  if (adjusted >= 0.3) return "#22c55e";
  return "#22d3ee";
}

function makeVesselIcon(marker, selected, dimmed, rotation = 0) {
  const color = (RISK[marker.risk] || RISK.medium).color;
  return L.divIcon({
    className: "vessel-div-icon",
    html: `<span class="vessel-marker-shell ${selected ? "is-selected" : ""} ${dimmed ? "is-dimmed" : ""}">
      <span class="vessel-marker-arrow" style="--vessel-color:${color};--vessel-rotation:${rotation}deg"></span>
    </span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    tooltipAnchor: [0, -14],
  });
}

function MapViewportController({
  zoomMode,
  viewRequest,
  onZoomChange,
  onWorldOffsetChange,
  onBoundsChange,
}) {
  const map = useMap();
  const clampingRef = useRef(false);

  useEffect(() => {
    if (import.meta.env.DEV) window.__TMPRM_MAP__ = map;
    const quarterStepCeil = (value) => Math.ceil(value * 4) / 4;
    const verticalPadding = 28;

    const reportViewport = () => {
      const centerLongitude = map.getCenter().lng;
      onWorldOffsetChange?.(Math.round(centerLongitude / 360) * 360);
      const bounds = map.getBounds();
      onBoundsChange?.({
        south: bounds.getSouth(),
        north: bounds.getNorth(),
        west: bounds.getWest(),
        east: bounds.getEast(),
      });
    };

    const clampVertical = () => {
      if (clampingRef.current) return;
      const zoom = map.getZoom();
      const size = map.getSize();
      const worldPixelSize = 256 * 2 ** zoom;
      const halfHeight = size.y / 2;

      // If the viewport is taller than the projected world, zoom in first.
      if (worldPixelSize < size.y) {
        const requiredZoom = quarterStepCeil(Math.log2(size.y / 256));
        map.setZoom(requiredZoom, { animate: false });
        return;
      }

      const center = map.getCenter();
      const projected = map.project(center, zoom);
      const minY = halfHeight + verticalPadding;
      const maxY = worldPixelSize - halfHeight - verticalPadding;
      const clampedY = Math.max(minY, Math.min(maxY, projected.y));

      if (Math.abs(clampedY - projected.y) > 0.5) {
        clampingRef.current = true;
        const next = map.unproject(L.point(projected.x, clampedY), zoom);
        map.setView([next.lat, center.lng], zoom, { animate: false });
        window.requestAnimationFrame(() => {
          clampingRef.current = false;
        });
      }
    };

    const updateViewportRules = () => {
      const containerHeight = Math.max(1, map.getSize().y);
      const minZoom = Math.max(
        1,
        quarterStepCeil(
          Math.log2((containerHeight + verticalPadding * 2) / 256),
        ),
      );
      map.setMinZoom(minZoom);
      if (map.getZoom() < minZoom) map.setZoom(minZoom, { animate: false });
      map.setMaxBounds(L.latLngBounds(WORLD_BOUNDS));
      map.invalidateSize({ animate: false });
      clampVertical();
      onZoomChange?.(map.getZoom());
      reportViewport();
    };

    const reportAndClamp = () => {
      onZoomChange?.(map.getZoom());
      reportViewport();
      clampVertical();
    };

    map.whenReady(updateViewportRules);
    map.on("resize", updateViewportRules);
    map.on("zoomend", reportAndClamp);
    map.on("move", clampVertical);
    map.on("moveend", reportAndClamp);

    const resizeObserver = new ResizeObserver(updateViewportRules);
    resizeObserver.observe(map.getContainer());

    return () => {
      if (import.meta.env.DEV && window.__TMPRM_MAP__ === map)
        delete window.__TMPRM_MAP__;
      resizeObserver.disconnect();
      map.off("resize", updateViewportRules);
      map.off("zoomend", reportAndClamp);
      map.off("move", clampVertical);
      map.off("moveend", reportAndClamp);
    };
  }, [map, onWorldOffsetChange, onZoomChange]);

  useEffect(() => {
    const target = zoomMode === "tuas" ? TUAS_VIEW : WORLD_VIEW;
    const targetZoom =
      zoomMode === "tuas"
        ? target.zoom
        : Math.max(target.zoom, map.getMinZoom());
    map.stop();
    map.invalidateSize({ animate: false });

    if (zoomMode === "tuas") {
      // Use a deterministic setView for the port close-up. A second pass after
      // layout settles prevents the sticky toolbar or side panel from shifting
      // the terminal away from the map centre.
      map.setView(target.center, targetZoom, { animate: false });
      const frame = window.requestAnimationFrame(() => {
        map.invalidateSize({ animate: false });
        map.setView(target.center, targetZoom, { animate: false });
      });
      const timer = window.setTimeout(() => {
        map.invalidateSize({ animate: false });
        map.setView(target.center, targetZoom, { animate: false });
      }, 160);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    }

    map.flyTo(target.center, targetZoom, { animate: true, duration: 1.15 });
    return undefined;
  }, [map, viewRequest, zoomMode]);

  return null;
}

function MapInteractionController({ onMapClick }) {
  useMapEvents({ click: () => onMapClick?.() });
  return null;
}

function MapPaneOrderController() {
  const map = useMap();
  useEffect(() => {
    const popupPane = map.getPane("popupPane");
    const tooltipPane = map.getPane("tooltipPane");
    if (popupPane) popupPane.style.zIndex = "1000";
    if (tooltipPane) tooltipPane.style.zIndex = "900";
  }, [map]);
  return null;
}

function OverlayCard({ title, onHide, className = "", children, theme }) {
  const dark = theme === "dark";
  return (
    <section
      className={`absolute z-[700] rounded-xl border shadow-xl backdrop-blur ${dark ? "border-slate-700 bg-slate-900/95 text-slate-100" : "border-slate-200 bg-white/95 text-slate-800"} ${className}`}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3">
        <h3
          className={`font-bold text-[13px] ${dark ? "text-sky-200" : "text-[#0a2a69]"}`}
        >
          {title}
        </h3>
        <button
          type="button"
          onClick={onHide}
          title={`Hide ${title}`}
          className={`h-6 w-6 rounded-md flex items-center justify-center text-sm ${dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-500"}`}
        >
          ×
        </button>
      </div>
      <div className="px-4 pb-3 pt-2">{children}</div>
    </section>
  );
}

function WeatherIcon() {
  return (
    <svg
      className="w-8 h-8 text-blue-700 shrink-0"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M10 22h18a7 7 0 00-1-13.9A10 10 0 008 12a6 6 0 002 10z"
        fill="#dbeafe"
      />
      <path d="M12 27l-2 5M20 27l-2 5M28 27l-2 5" strokeLinecap="round" />
    </svg>
  );
}

function eventRiskKey(level) {
  const value = String(level || "").toLowerCase();
  if (value.includes("severe")) return "severe";
  if (value.includes("high")) return "high";
  if (value.includes("low")) return "low";
  return "medium";
}

export default function CommandMap({
  selectedId,
  onSelect,
  snapshot,
  stormActive,
  vesselFilter = "all",
  onViewSlTrader,
  openVesselRequest = null,
  zoomMode = "world",
  viewRequest = 0,
  satelliteVisible = true,
  weatherVisible = true,
  forecastHour = 0,
  setForecastHour = () => {},
  theme = "light",
  onToggleTheme = () => {},
}) {
  const mapRef = useRef(null);
  const previousSelectedRef = useRef(selectedId);
  const eventMarkerRefs = useRef({});
  const [popupOpen, setPopupOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [mapZoom, setMapZoom] = useState(WORLD_VIEW.zoom);
  const [worldOffset, setWorldOffset] = useState(0);
  const [viewportBounds, setViewportBounds] = useState(null);
  const [cardsMenuOpen, setCardsMenuOpen] = useState(false);
  const [cardsVisible, setCardsVisible] = useState({
    weather: true,
    port: true,
    legend: true,
  });

  useEffect(() => {
    if (previousSelectedRef.current !== selectedId) {
      previousSelectedRef.current = selectedId;
      if (selectedId) setPopupOpen(true);
    }
  }, [selectedId]);

  useEffect(() => {
    if (!openVesselRequest?.token || !openVesselRequest?.id) return;
    const marker = WORLD_VESSELS.find(
      (item) => item.id === openVesselRequest.id,
    );
    if (!marker) return;
    setSelectedEventId(null);
    mapRef.current?.closePopup();
    setPopupOpen(true);
    const map = mapRef.current;
    if (map) {
      const isNearTuas =
        Math.abs(marker.position[0] - TUAS_POSITION[0]) < 2 &&
        Math.abs(marker.position[1] - TUAS_POSITION[1]) < 3;
      const targetZoom = isNearTuas ? 12.5 : 7;
      const longitudeOffset = nearestWrappedOffset(
        marker.position[1],
        map.getCenter().lng,
      );
      map.flyTo(offsetPosition(marker.position, longitudeOffset), targetZoom, {
        animate: true,
        duration: 0.9,
      });
    }
  }, [openVesselRequest]);

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setPopupOpen(false);
      setSelectedEventId(null);
      mapRef.current?.closePopup();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const shipments = snapshot?.shipments || [];
  const worldRiskEvents = snapshot?.worldRiskEvents || [];
  const selectedMarker =
    WORLD_VESSELS.find((item) => item.id === selectedId) || WORLD_VESSELS[0];
  const selectedShipment = useMemo(
    () =>
      shipments.find((item) => item.vessel === selectedMarker?.name) || null,
    [selectedMarker, shipments],
  );
  const port = snapshot?.portSummary || {};
  const averageDelay = Number(port.avgDelayHours ?? 18.6);
  const dark = theme === "dark";
  const isTuasMode = zoomMode === "tuas";
  const localRouteMode = isTuasMode && mapZoom >= 9;
  const routesToRender = isTuasMode ? TUAS_LOCAL_ROUTES : SEA_ROUTE_LINES;
  const vesselsToRender = isTuasMode
    ? WORLD_VESSELS.filter((vessel) => TUAS_FOCUS_VESSEL_IDS.includes(vessel.id))
    : WORLD_VESSELS;
  const wrapOffsets = useMemo(
    () => WRAP_NEIGHBORS.map((offset) => worldOffset + offset),
    [worldOffset],
  );
  const routeWrapOffsets = isTuasMode ? [0] : wrapOffsets;

  const vesselCopyVisible = (marker, longitudeOffset) => {
    if (!viewportBounds) return true;
    const latitudePadding = Math.max(
      0.15,
      (viewportBounds.north - viewportBounds.south) * 0.08,
    );
    const longitudePadding = Math.max(
      0.15,
      (viewportBounds.east - viewportBounds.west) * 0.08,
    );
    const latitude = marker.position[0];
    const longitude = marker.position[1] + longitudeOffset;
    return (
      latitude >= viewportBounds.south - latitudePadding &&
      latitude <= viewportBounds.north + latitudePadding &&
      longitude >= viewportBounds.west - longitudePadding &&
      longitude <= viewportBounds.east + longitudePadding
    );
  };
  const vesselHeadingById = useMemo(
    () =>
      Object.fromEntries(
        SEA_ROUTE_LINES.map((route) => [route.vesselId, routeHeading(route)]),
      ),
    [],
  );

  const isDimmed = (marker) => {
    if (vesselFilter === "all") return false;
    const shipment = shipments.find((item) => item.vessel === marker.name);
    if (!shipment) return true;
    if (vesselFilter === "cold-chain") return !shipment.isColdChain;
    if (vesselFilter === "general") return shipment.isColdChain;
    return false;
  };

  const setCard = (key, value) =>
    setCardsVisible((current) => ({ ...current, [key]: value }));

  const closeMapPopups = () => {
    setPopupOpen(false);
    setSelectedEventId(null);
    mapRef.current?.closePopup();
  };

  return (
    <div
      className={`relative h-[570px] overflow-hidden border-y ${dark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-[#a8d7ef]"}`}
    >
      <MapContainer
        ref={mapRef}
        center={WORLD_VIEW.center}
        zoom={WORLD_VIEW.zoom}
        minZoom={2}
        maxZoom={18}
        zoomSnap={0.25}
        zoomDelta={0.5}
        zoomControl={false}
        scrollWheelZoom
        doubleClickZoom
        dragging
        worldCopyJump={false}
        inertia
        maxBounds={WORLD_BOUNDS}
        maxBoundsViscosity={1}
        className="h-full w-full z-0"
        preferCanvas
      >
        <MapViewportController
          zoomMode={zoomMode}
          viewRequest={viewRequest}
          onZoomChange={setMapZoom}
          onWorldOffsetChange={setWorldOffset}
          onBoundsChange={setViewportBounds}
        />
        <MapPaneOrderController />
        <MapInteractionController onMapClick={closeMapPopups} />

        {satelliteVisible ? (
          <TileLayer
            key={isTuasMode ? "tuas-satellite-basemap" : "satellite-basemap"}
            attribution="Tiles © Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
            maxNativeZoom={19}
            updateWhenIdle
            updateWhenZooming={false}
            keepBuffer={isTuasMode ? 3 : 2}
            noWrap={false}
          />
        ) : (
          <TileLayer
            key={isTuasMode ? "tuas-standard-basemap" : "street-basemap"}
            attribution="© OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            maxNativeZoom={19}
            updateWhenIdle
            updateWhenZooming={false}
            keepBuffer={isTuasMode ? 3 : 2}
            noWrap={false}
          />
        )}

        <Pane
          name="weather-risk-pane"
          style={{ zIndex: 360, pointerEvents: "none" }}
        >
          {!isTuasMode && weatherVisible &&
            GLOBAL_WEATHER_CELLS.flatMap((cell) =>
              wrapOffsets.map((longitudeOffset) => {
                const position = [
                  cell.position[0] + cell.drift[0] * forecastHour,
                  cell.position[1] +
                    cell.drift[1] * forecastHour +
                    longitudeOffset,
                ];
                const fade = Math.max(0.32, 1 - forecastHour * 0.045);
                return (
                  <Circle
                    key={`${cell.id}:${longitudeOffset}`}
                    center={position}
                    radius={cell.radius * (1 + forecastHour * 0.018)}
                    interactive={false}
                    bubblingMouseEvents={false}
                    pathOptions={{
                      color: riskColor(cell.intensity, stormActive),
                      fillColor: riskColor(cell.intensity, stormActive),
                      fillOpacity: cell.intensity * 0.22 * fade,
                      opacity: Math.max(0.24, cell.intensity * 0.48 * fade),
                      weight: 1,
                    }}
                  />
                );
              }),
            )}
        </Pane>

        <Pane
          name="shipping-route-pane"
          style={{ zIndex: 390, pointerEvents: "none" }}
        >
          {routesToRender.flatMap((route) => {
            const routeVessel = WORLD_VESSELS.find(
              (marker) => marker.id === route.vesselId,
            );
            if (!routeVessel) return [];
            return routeWrapOffsets.flatMap((longitudeOffset) => {
              if (!isTuasMode && !vesselCopyVisible(routeVessel, longitudeOffset)) return [];
              return (route.segments || [route.positions || []]).map(
                (segment, segmentIndex) => (
                  <Polyline
                    key={`${route.id}:${longitudeOffset}:${segmentIndex}`}
                    positions={offsetSegment(segment, longitudeOffset)}
                    interactive={false}
                    bubblingMouseEvents={false}
                    smoothFactor={isTuasMode ? 0 : 0.35}
                    noClip
                    pathOptions={{
                      tmprmRouteId: route.id,
                      tmprmVesselId: route.vesselId,
                      color: "#ffffff",
                      weight: localRouteMode ? 2.4 : 1.7,
                      opacity: 0.96,
                      dashArray: "8 9",
                      lineCap: "round",
                      lineJoin: "round",
                    }}
                  />
                ),
              );
            });
          })}
        </Pane>

        <Pane name="map-marker-pane" style={{ zIndex: 510 }}>
          {isTuasMode ? (
            <CircleMarker
              center={TUAS_POSITION}
              radius={7}
              bubblingMouseEvents={false}
              pathOptions={{
                color: "#ffffff",
                fillColor: "#f59e0b",
                fillOpacity: 1,
                weight: 2,
              }}
            >
              <Tooltip
                permanent
                direction="top"
                offset={[0, -7]}
                className="tuas-port-label"
              >
                Tuas Mega Port
              </Tooltip>
            </CircleMarker>
          ) : (
            ROUTE_DESTINATIONS.filter(
              (destination) => !["TUAS", "TUAS_BERTHS"].includes(destination.id),
            ).flatMap((destination) =>
              wrapOffsets.map((longitudeOffset) => (
                <CircleMarker
                  key={`${destination.id}:${longitudeOffset}`}
                  center={offsetPosition(destination.position, longitudeOffset)}
                  radius={destination.id === "TUAS_PORT" ? 7 : 5}
                  bubblingMouseEvents={false}
                  pathOptions={{
                    color: "#ffffff",
                    fillColor:
                      destination.id === "TUAS_PORT" ? "#2563eb" : "#0ea5e9",
                    fillOpacity: 1,
                    weight: 2,
                  }}
                >
                  <Tooltip
                    permanent={destination.id === "TUAS_PORT"}
                    direction="top"
                    offset={[0, -7]}
                    className="tuas-port-label"
                  >
                    {destination.id === "TUAS_PORT"
                      ? "Tuas Mega Port"
                      : destination.name}
                  </Tooltip>
                </CircleMarker>
              )),
            )
          )}
        </Pane>

        <Pane name="disruption-pane" style={{ zIndex: 650 }}>
          {!isTuasMode && worldRiskEvents.flatMap((event) =>
            wrapOffsets.map((longitudeOffset) => {
              const riskKey = eventRiskKey(event.riskLevel);
              const color = EVENT_COLORS[event.type] || "#f59e0b";
              return (
                <CircleMarker
                  key={`${event.id}:${longitudeOffset}`}
                  ref={(layer) => {
                    const refKey = `${event.id}:${longitudeOffset}`;
                    if (layer) eventMarkerRefs.current[refKey] = layer;
                    else delete eventMarkerRefs.current[refKey];
                  }}
                  center={offsetPosition(event.position, longitudeOffset)}
                  radius={riskKey === "severe" ? 10 : 8}
                  bubblingMouseEvents={false}
                  pathOptions={{
                    color: selectedEventId === event.id ? "#38bdf8" : "#ffffff",
                    fillColor: color,
                    fillOpacity: 0.96,
                    opacity: 1,
                    weight: selectedEventId === event.id ? 3 : 2,
                  }}
                  eventHandlers={{
                    click: (layerEvent) => {
                      if (layerEvent?.originalEvent)
                        L.DomEvent.stopPropagation(layerEvent.originalEvent);
                      setPopupOpen(false);
                      setSelectedEventId(event.id);
                      layerEvent.target.openPopup();
                    },
                    popupclose: () =>
                      setSelectedEventId((current) =>
                        current === event.id ? null : current,
                      ),
                  }}
                >
                  <Tooltip direction="top">
                    {event.name} · {event.riskLevel} {event.type} risk
                  </Tooltip>
                  <Popup minWidth={270} maxWidth={350}>
                    <div className="world-event-popup">
                      <strong>{event.name}</strong>
                      <div className="world-event-meta">
                        {event.region ? `${event.region} · ` : ""}
                        {event.type} · {event.riskLevel} risk ·{" "}
                        {event.asOf || "July 2026 scenario"}
                      </div>
                      <p>{event.summary}</p>
                      <p>
                        <strong>Operational impact:</strong> {event.impact}
                      </p>
                      {event.sourceLabel && (
                        <p className="world-event-source">
                          Source context: {event.sourceLabel}
                        </p>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            }),
          )}
        </Pane>

        <Pane name="vessel-pane" style={{ zIndex: 540 }}>
          {vesselsToRender.flatMap((marker) =>
            (isTuasMode ? [0] : wrapOffsets).flatMap((longitudeOffset) => {
              if (!vesselCopyVisible(marker, longitudeOffset)) return [];
              const dimmed = isDimmed(marker);
              return [
                <Marker
                  key={`${marker.id}:${longitudeOffset}`}
                  position={offsetPosition(marker.position, longitudeOffset)}
                  icon={makeVesselIcon(
                    marker,
                    marker.id === selectedId,
                    dimmed,
                    vesselHeadingById[marker.id] ?? 0,
                  )}
                  zIndexOffset={marker.id === selectedId ? 120 : 0}
                  bubblingMouseEvents={false}
                  eventHandlers={{
                    click: () => {
                      mapRef.current?.closePopup();
                      setSelectedEventId(null);
                      onSelect?.(marker.id);
                      setPopupOpen(true);
                    },
                  }}
                >
                  <Tooltip direction="top" opacity={0.96}>
                    {marker.name} · {(RISK[marker.risk] || RISK.medium).label}
                  </Tooltip>
                </Marker>,
              ];
            }),
          )}
        </Pane>
      </MapContainer>

      <div className="absolute left-3 top-3 z-[740]">
        <button
          type="button"
          onClick={() => setCardsMenuOpen((value) => !value)}
          className={`h-9 rounded-lg border px-3 text-[11px] font-bold shadow-lg flex items-center gap-2 ${dark ? "bg-slate-900 border-slate-700 text-sky-200" : "bg-white border-slate-200 text-[#092a70]"}`}
        >
          <span>▤</span> Map cards
        </button>
        {cardsMenuOpen && (
          <div
            className={`mt-2 w-52 rounded-xl border p-2 shadow-xl ${dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-700"}`}
          >
            {[
              ["weather", "Weather Overview"],
              ["port", "Port Summary"],
              ["legend", "Legend"],
            ].map(([key, label]) => (
              <label
                key={key}
                className={`flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-[11px] cursor-pointer ${dark ? "hover:bg-slate-800" : "hover:bg-slate-50"}`}
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={cardsVisible[key]}
                  onChange={(event) => setCard(key, event.target.checked)}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      {cardsVisible.weather && (
        <OverlayCard
          className="left-3 top-16 w-[215px]"
          title="Weather Overview"
          onHide={() => setCard("weather", false)}
          theme={theme}
        >
          <div className="flex gap-3 items-start">
            <WeatherIcon />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 justify-between">
                <span className="text-[12px] font-bold truncate">
                  Malacca Strait
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${stormActive ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
                >
                  {stormActive ? "Severe Risk" : "Medium Risk"}
                </span>
              </div>
              <p className="mt-3 text-[12px] font-semibold">
                {stormActive ? "Severe thunderstorms" : "Scattered showers"}
              </p>
              <p
                className={`text-[11px] mt-1 ${dark ? "text-slate-300" : "text-slate-600"}`}
              >
                Global forecast: +{forecastHour} hours
              </p>
              <p
                className={`text-[11px] ${dark ? "text-slate-300" : "text-slate-600"}`}
              >
                Winds: {stormActive ? "42" : (snapshot?.weather?.windKts ?? 18)}{" "}
                kn
              </p>
              <p
                className={`text-[11px] ${dark ? "text-slate-300" : "text-slate-600"}`}
              >
                Waves: {stormActive ? "4.8" : (snapshot?.weather?.waveM ?? 1.8)}{" "}
                m
              </p>
            </div>
          </div>
        </OverlayCard>
      )}

      {cardsVisible.port && (
        <OverlayCard
          className="left-3 top-[245px] w-[215px]"
          title="Port Summary (Tuas)"
          onHide={() => setCard("port", false)}
          theme={theme}
        >
          <div className="space-y-3 text-[12px]">
            <div className="flex justify-between">
              <span className={dark ? "text-slate-300" : "text-slate-600"}>
                Avg Delay
              </span>
              <strong className="text-red-500 text-[15px]">
                {averageDelay.toFixed(1)} hrs
              </strong>
            </div>
            <div className="flex justify-between">
              <span className={dark ? "text-slate-300" : "text-slate-600"}>
                Berth Occupancy
              </span>
              <strong className="text-amber-500 text-[15px]">
                {port.berthOccupancy ?? 72}%
              </strong>
            </div>
            <div className="flex justify-between">
              <span className={dark ? "text-slate-300" : "text-slate-600"}>
                Ships in Port
              </span>
              <strong
                className={
                  dark
                    ? "text-sky-200 text-[15px]"
                    : "text-[#092a70] text-[15px]"
                }
              >
                {port.shipsInPort ?? 11}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className={dark ? "text-slate-300" : "text-slate-600"}>
                High Risk Shipments
              </span>
              <strong
                className={
                  dark
                    ? "text-sky-200 text-[15px]"
                    : "text-[#092a70] text-[15px]"
                }
              >
                {stormActive ? 6 : (port.highRiskShipments ?? 2)}
              </strong>
            </div>
          </div>
        </OverlayCard>
      )}

      {cardsVisible.legend && (
        <OverlayCard
          className="left-3 bottom-3 w-[215px]"
          title="Legend"
          onHide={() => setCard("legend", false)}
          theme={theme}
        >
          <div
            className={`space-y-2 text-[11px] ${dark ? "text-slate-300" : "text-slate-700"}`}
          >
            {Object.entries(RISK)
              .slice(0, 3)
              .map(([key, item]) => (
                <div key={key} className="flex items-center gap-3">
                  <span
                    className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[10px]"
                    style={{ borderLeftColor: item.color }}
                  />
                  <span>{item.label}</span>
                </div>
              ))}
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-red-600 border-2 border-white shadow" />
              <span>Security / conflict</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full bg-amber-500 border-2 border-white shadow" />
              <span>Weather / port / climate</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-5 border-t-2 border-dashed border-slate-400" />
              <span>Sea-only route</span>
            </div>
          </div>
        </OverlayCard>
      )}

      {popupOpen && selectedMarker && (
        <section
          className={`absolute z-[730] top-[118px] right-[72px] w-[325px] max-w-[calc(100%-96px)] rounded-xl border shadow-2xl overflow-hidden ${dark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-200 text-slate-800"}`}
        >
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-5 w-5 rounded-sm bg-gradient-to-b from-blue-700 to-blue-700 relative overflow-hidden">
                    <span className="absolute bottom-0 left-0 right-0 h-2 bg-amber-400" />
                  </span>
                  <h3
                    className={`text-[18px] font-bold ${dark ? "text-sky-200" : "text-[#0a2a69]"}`}
                  >
                    {selectedMarker.name}
                  </h3>
                  {selectedShipment?.imo && (
                    <span
                      className={
                        dark
                          ? "text-[11px] text-slate-400"
                          : "text-[11px] text-slate-500"
                      }
                    >
                      {selectedShipment.imo}
                    </span>
                  )}
                </div>
                <p
                  className={`text-[12px] mt-2 ${dark ? "text-slate-300" : "text-slate-700"}`}
                >
                  {selectedMarker.type}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPopupOpen(false)}
                aria-label="Close vessel details"
                className={`text-xl leading-none ${dark ? "text-slate-400 hover:text-white" : "text-slate-400 hover:text-slate-800"}`}
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-[120px_1fr] gap-y-3 mt-4 text-[12px]">
              <span className={dark ? "text-slate-400" : "text-slate-600"}>
                Status
              </span>
              <span className="text-green-500 font-semibold">
                {selectedShipment?.status || "Underway"}
              </span>
              <span className={dark ? "text-slate-400" : "text-slate-600"}>
                Destination
              </span>
              <span>
                {selectedShipment?.destination || selectedMarker.destination}
              </span>
              <span className={dark ? "text-slate-400" : "text-slate-600"}>
                ETA
              </span>
              <span>
                {selectedShipment?.etaHours ?? selectedMarker.etaHours} hours
              </span>
              <span className={dark ? "text-slate-400" : "text-slate-600"}>
                Current Location
              </span>
              <span>
                {selectedShipment?.currentLocation?.split("—")[0]?.trim() ||
                  selectedMarker.currentLocation}
              </span>
              <span className={dark ? "text-slate-400" : "text-slate-600"}>
                Cargo
              </span>
              <span>{selectedShipment?.cargo || selectedMarker.cargo}</span>
              <span className={dark ? "text-slate-400" : "text-slate-600"}>
                Risk
              </span>
              <span
                className="font-semibold"
                style={{
                  color: (RISK[selectedMarker.risk] || RISK.medium).color,
                }}
              >
                {(RISK[selectedMarker.risk] || RISK.medium).label}
              </span>
            </div>
            <p
              className={`mt-3 text-[9px] ${dark ? "text-slate-500" : "text-slate-400"}`}
            >
              Press Esc to close this vessel card.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onViewSlTrader?.()}
            className={`m-4 mt-0 h-10 w-[calc(100%-2rem)] rounded-lg border font-semibold text-[12px] transition flex items-center justify-center gap-2 ${dark ? "border-blue-400 text-sky-200 hover:bg-slate-800" : "border-blue-500 text-blue-700 hover:bg-blue-50"}`}
          >
            Ask AI about this vessel
          </button>
        </section>
      )}

      <div className="absolute right-3 top-4 z-[740] flex flex-col gap-3">
        <div
          className={`rounded-lg overflow-hidden border shadow-lg ${dark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
        >
          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn()}
            aria-label="Zoom in"
            className={`w-10 h-10 flex items-center justify-center text-2xl border-b ${dark ? "text-sky-200 hover:bg-slate-800 border-slate-700" : "text-[#092a70] hover:bg-slate-50 border-slate-200"}`}
          >
            +
          </button>
          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut()}
            aria-label="Zoom out"
            className={`w-10 h-10 flex items-center justify-center text-2xl ${dark ? "text-sky-200 hover:bg-slate-800" : "text-[#092a70] hover:bg-slate-50"}`}
          >
            −
          </button>
        </div>
        <button
          type="button"
          onClick={onToggleTheme}
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
          className={`w-10 h-10 rounded-lg border shadow-lg flex items-center justify-center ${dark ? "border-slate-700 bg-slate-900 text-amber-300 hover:bg-slate-800" : "border-slate-200 bg-white text-[#092a70] hover:bg-slate-50"}`}
        >
          {dark ? (
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
