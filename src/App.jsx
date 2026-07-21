import React, { useCallback, useEffect, useRef, useState } from "react";
import Header from "./components/Header.jsx";
import ChatAdvisor from "./components/ChatAdvisor.jsx";
import CommandMap from "./components/CommandMap.jsx";
import DecisionInterface from "./components/DecisionInterface.jsx";
import {
  BerthOccupancyPanel,
  ShipmentRiskPanel,
  RouteRiskPanel,
  NewsTicker,
} from "./components/DashboardPanels.jsx";
import {
  BASELINE_BERTH_OCCUPANCY,
  getSnapshot,
  forceStorm,
  clearStorm,
  forceCongestion,
  clearCongestion,
} from "./data/simulation.js";
import { buildRecommendation } from "./engine/decisionEngine.js";
import { DEFAULT_MODEL } from "./agent/liveBrain.js";

function ToolbarButton({
  onClick,
  children,
  active = false,
  title,
  dark = false,
  ariaExpanded,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-expanded={ariaExpanded}
      className={`h-10 px-4 rounded-lg border text-[12px] font-semibold flex items-center gap-2 transition ${
        active
          ? dark
            ? "border-sky-500 text-sky-200 bg-sky-500/10"
            : "border-blue-500 text-blue-700 bg-blue-50"
          : dark
            ? "border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
            : "border-slate-200 bg-white text-[#0a2a69] hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

function FilterSelect({ label, value, onChange, children, dark = false }) {
  return (
    <label className="min-w-0 flex-1">
      <span
        className={`block text-[11px] font-semibold mb-1.5 ${dark ? "text-slate-300" : "text-slate-700"}`}
      >
        {label}
      </span>
      <div className="relative">
        <select
          value={value}
          onChange={onChange}
          className={`w-full h-10 appearance-none rounded-lg border px-3 pr-9 text-[12px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 ${dark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-800"}`}
        >
          {children}
        </select>
        <svg
          className={`pointer-events-none absolute right-3 top-3 w-4 h-4 ${dark ? "text-sky-200" : "text-[#092a70]"}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>
    </label>
  );
}

function Toggle({ checked, onChange, label, tone = "blue", dark = false }) {
  const activeClass =
    tone === "red"
      ? "bg-red-500"
      : tone === "amber"
        ? "bg-amber-500"
        : "bg-blue-600";
  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      <span
        className={`min-w-0 flex-1 pr-1 text-[11px] font-semibold leading-snug ${dark ? "text-slate-200" : "text-slate-700"}`}
      >
        {label}
      </span>
      <button
        type="button"
        aria-label={`${checked ? "Disable" : "Enable"} ${label}`}
        aria-pressed={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${checked ? activeClass : dark ? "bg-slate-700" : "bg-slate-300"}`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

const HIGH_OCCUPANCY = 90;
const SEVERE_OCCUPANCY = 96;

export default function App() {
  const [snapshot, setSnapshot] = useState(() => getSnapshot());
  const [selectedVesselId, setSelectedVesselId] = useState("SL_TRADER");
  const [vesselDetailsRequest, setVesselDetailsRequest] = useState({
    id: null,
    token: 0,
  });
  const [mode, setMode] = useState("MOCK");
  const [degradedNotice, setDegradedNotice] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [llmModel, setLlmModel] = useState(DEFAULT_MODEL);
  const [weatherFilter, setWeatherFilter] = useState("all");
  const [berthFilter, setBerthFilter] = useState("all");
  const [vesselFilter, setVesselFilter] = useState("all");
  const [zoomMode, setZoomMode] = useState("world");
  const [mapViewRequest, setMapViewRequest] = useState(0);
  const [stormActive, setStormActive] = useState(false);
  const [berthScenarioActive, setBerthScenarioActive] = useState(false);
  const [simulationPercent, setSimulationPercent] = useState(
    BASELINE_BERTH_OCCUPANCY,
  );
  const [controlsVisible, setControlsVisible] = useState(
    () => localStorage.getItem("tmprm-controls-visible") !== "false",
  );
  const [layersOpen, setLayersOpen] = useState(false);
  const [satelliteVisible, setSatelliteVisible] = useState(true);
  const [weatherLayerVisible, setWeatherLayerVisible] = useState(true);
  const [forecastHour, setForecastHour] = useState(0);
  const [recommendation, setRecommendation] = useState(() =>
    buildRecommendation("SL_TRADER"),
  );
  const [validatedRecommendation, setValidatedRecommendation] = useState(null);
  const [decisionLog, setDecisionLog] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tmprm-decision-log") || "[]");
    } catch {
      return [];
    }
  });
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("tmprm-theme") || "light",
  );
  const chatRef = useRef(null);
  const dark = theme === "dark";

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("tmprm-theme", theme);
  }, [dark, theme]);

  useEffect(() => {
    localStorage.setItem("tmprm-controls-visible", String(controlsVisible));
  }, [controlsVisible]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    setSnapshot(getSnapshot());
    window.setTimeout(() => setRefreshing(false), 450);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(refresh, 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const selectVessel = useCallback((id) => {
    if (!id) return;
    setSelectedVesselId(id);
    try {
      setRecommendation(buildRecommendation(id));
    } catch {}
  }, []);

  const openVesselDetails = useCallback(
    (id) => {
      if (!id) return;
      selectVessel(id);
      setVesselDetailsRequest((current) => ({ id, token: current.token + 1 }));
    },
    [selectVessel],
  );

  const acceptRecommendation = useCallback((entry) => {
    setValidatedRecommendation({ ...entry, approved: true });
    chatRef.current?.pushAlert(
      `Human validation accepted: ${entry.recommendation}. The recommendation is approved for execution.`,
    );
  }, []);

  const challengeRecommendation = useCallback((entry) => {
    setValidatedRecommendation({ ...entry, approved: false });
    chatRef.current?.pushAlert(
      `Human validation challenge recorded: ${entry.challenge}. The recommendation remains blocked.`,
    );
  }, []);

  const logValidatedDecision = useCallback((entry) => {
    setDecisionLog((current) => {
      const next = [entry, ...current].slice(0, 100);
      try { localStorage.setItem("tmprm-decision-log", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const setStormSimulation = (enabled) => {
    if (enabled) {
      forceStorm();
      setStormActive(true);
      chatRef.current?.pushAlert(
        "Severe weather simulation enabled for the Malacca Strait. Forecast and shipment risk have been updated.",
      );
    } else {
      clearStorm();
      setStormActive(false);
      chatRef.current?.pushAlert(
        "Weather simulation cleared. The dashboard has returned to baseline conditions.",
      );
    }
    setSnapshot(getSnapshot());
  };

  const applyBerthScenario = (value, announce = false) => {
    const nextValue = Math.max(60, Math.min(98, Math.round(Number(value))));
    setSimulationPercent(nextValue);

    if (nextValue === BASELINE_BERTH_OCCUPANCY) {
      clearCongestion();
      setBerthScenarioActive(false);
      setBerthFilter("all");
    } else {
      forceCongestion(nextValue);
      setBerthScenarioActive(true);
      if (nextValue >= SEVERE_OCCUPANCY) setBerthFilter("severe");
      else if (nextValue >= 85) setBerthFilter("high");
      else setBerthFilter("custom");
    }

    setSnapshot(getSnapshot());

    if (announce) {
      const stateLabel =
        nextValue === BASELINE_BERTH_OCCUPANCY
          ? "reset to the 72% baseline"
          : `set to ${nextValue}%`;
      chatRef.current?.pushAlert(
        `Tuas berth occupancy scenario ${stateLabel}. Queue, delay and terminal risk values have been recalculated.`,
      );
    }
  };

  const resetBerthScenario = () =>
    applyBerthScenario(BASELINE_BERTH_OCCUPANCY, true);

  const handleBerthFilter = (value) => {
    setBerthFilter(value);
    if (value === "all") applyBerthScenario(BASELINE_BERTH_OCCUPANCY, false);
    if (value === "high") applyBerthScenario(HIGH_OCCUPANCY, false);
    if (value === "severe") applyBerthScenario(SEVERE_OCCUPANCY, false);
  };

  const sliderProgress = ((simulationPercent - 60) / (98 - 60)) * 100;

  return (
    <div
      className={`h-screen min-h-[760px] flex flex-col transition-colors ${dark ? "bg-slate-950 text-slate-100" : "bg-white text-slate-900"}`}
    >
      <Header lastUpdated={snapshot.generatedAt} mode={mode} />

      {mode === "DEGRADED" && degradedNotice && (
        <div className={`mx-4 mt-3 rounded-xl border px-4 py-3 text-xs shadow-sm ${dark ? "border-amber-800 bg-amber-950/80 text-amber-100" : "border-amber-300 bg-amber-50 text-amber-900"}`} role="status" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-base">⚠</span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold uppercase tracking-wide">DEGRADED MODE</p>
              <p className="mt-0.5 leading-relaxed">{degradedNotice}</p>
            </div>
            <button type="button" onClick={() => setDegradedNotice("")} className="rounded px-2 py-1 font-bold hover:bg-amber-100/60" aria-label="Dismiss degraded mode banner">×</button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 lg:flex overflow-hidden">
        <div
          className={`w-full lg:w-[360px] xl:w-[370px] shrink-0 h-[720px] lg:h-full min-h-0 ${dark ? "bg-slate-950" : "bg-white"}`}
        >
          <ChatAdvisor
            ref={chatRef}
            snapshot={snapshot}
            onRecommendation={setRecommendation}
            onSelectVessel={openVesselDetails}
            mode={mode}
            setMode={setMode}
            apiKey={apiKey}
            setApiKey={setApiKey}
            llmModel={llmModel}
            setLlmModel={setLlmModel}
            theme={theme}
            onDegraded={setDegradedNotice}
          />
        </div>

        <main
          className={`relative flex-1 min-w-0 h-full overflow-y-auto ${dark ? "bg-slate-950" : "bg-white"}`}
        >
          <div
            className={`px-4 pt-4 pb-3 border-b sticky top-0 z-[800] ${dark ? "border-slate-800 bg-slate-950/98" : "border-slate-100 bg-white/98"} backdrop-blur`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <ToolbarButton
                  onClick={() => {
                    setZoomMode("world");
                    setMapViewRequest((value) => value + 1);
                  }}
                  active={zoomMode === "world"}
                  dark={dark}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z" />
                    <path d="M9 3v15M15 6v15" />
                  </svg>
                  Global Map
                </ToolbarButton>
                <ToolbarButton
                  onClick={() => {
                    setZoomMode("tuas");
                    setMapViewRequest((value) => value + 1);
                  }}
                  active={zoomMode === "tuas"}
                  dark={dark}
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M4 21h16M6 21V8h12v13M9 8V4h6v4M9 12h2M13 12h2M9 16h2M13 16h2" />
                  </svg>
                  Tuas Port (Zoomed)
                </ToolbarButton>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ToolbarButton
                  onClick={() => setControlsVisible((value) => !value)}
                  active={controlsVisible}
                  title={
                    controlsVisible
                      ? "Hide filters and simulation controls"
                      : "Show filters and simulation controls"
                  }
                  dark={dark}
                  ariaExpanded={controlsVisible}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${controlsVisible ? "rotate-180" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                  {controlsVisible ? "Hide controls" : "Show controls"}
                </ToolbarButton>
                <ToolbarButton
                  onClick={refresh}
                  title="Refresh dashboard data"
                  dark={dark}
                >
                  <svg
                    className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  >
                    <path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" />
                  </svg>
                  Refresh
                </ToolbarButton>
                <div className="relative">
                  <ToolbarButton
                    onClick={() => setLayersOpen((value) => !value)}
                    active={layersOpen}
                    dark={dark}
                    ariaExpanded={layersOpen}
                  >
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M12 2l9 5-9 5-9-5 9-5z" />
                      <path d="M3 12l9 5 9-5M3 17l9 5 9-5" />
                    </svg>
                    Layers
                  </ToolbarButton>
                  {layersOpen && (
                    <div
                      className={`absolute right-0 top-12 z-[900] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border p-4 shadow-2xl ${dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3
                            className={`text-[13px] font-bold ${dark ? "text-sky-200" : "text-[#092a70]"}`}
                          >
                            Map Layers
                          </h3>
                          <p
                            className={`mt-1 text-[11px] ${dark ? "text-slate-400" : "text-slate-500"}`}
                          >
                            Switch between the street map and satellite imagery in
                            both Global Map and Tuas Port views, and show or
                            hide the six-hour global weather layer.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setLayersOpen(false)}
                          className={`h-7 w-7 rounded-md ${dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-500"}`}
                          aria-label="Close map layers"
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-4 space-y-4">
                        <Toggle
                          checked={satelliteVisible}
                          onChange={setSatelliteVisible}
                          label="Geographical satellite imagery"
                          dark={dark}
                        />
                        <Toggle
                          checked={weatherLayerVisible}
                          onChange={setWeatherLayerVisible}
                          label="6-hour weather forecast"
                          tone="amber"
                          dark={dark}
                        />
                      </div>
                      {weatherLayerVisible && (
                        <div
                          className={`mt-4 rounded-lg border p-3 ${dark ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-slate-50"}`}
                        >
                          <div className="flex justify-between text-[10px] font-semibold">
                            <span>Now</span>
                            <span>+6h</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="6"
                            step="1"
                            value={forecastHour}
                            onChange={(event) =>
                              setForecastHour(Number(event.target.value))
                            }
                            className="forecast-range mt-2 w-full"
                          />
                          <p className="mt-1 text-center text-[11px] font-bold text-green-600">
                            Forecast +{forecastHour} hour
                            {forecastHour === 1 ? "" : "s"}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {controlsVisible && (
              <div className="mt-2 space-y-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <FilterSelect
                    label="Weather Forecast"
                    value={weatherFilter}
                    onChange={(e) => setWeatherFilter(e.target.value)}
                    dark={dark}
                  >
                    <option value="all">All Conditions</option>
                    <option value="high">High Risk Only</option>
                    <option value="severe">Severe Weather</option>
                  </FilterSelect>
                  <FilterSelect
                    label="Berth Occupancy Scenario"
                    value={berthFilter}
                    onChange={(e) => handleBerthFilter(e.target.value)}
                    dark={dark}
                  >
                    <option value="all">Baseline — 72%</option>
                    <option value="custom">
                      Custom — {simulationPercent}%
                    </option>
                    <option value="high">High — 90%</option>
                    <option value="severe">Severe — 96%</option>
                  </FilterSelect>
                  <FilterSelect
                    label="Vessel Type"
                    value={vesselFilter}
                    onChange={(e) => setVesselFilter(e.target.value)}
                    dark={dark}
                  >
                    <option value="all">All Types</option>
                    <option value="cold-chain">Cold-chain Pharma</option>
                    <option value="general">General Cargo</option>
                  </FilterSelect>
                </div>

                <section
                  className={`rounded-xl border px-3 py-2 shadow-sm ${dark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white"}`}
                >
                  <div className="grid items-center gap-3 xl:grid-cols-[190px_minmax(320px,1fr)_170px_110px]">
                    <div className="flex items-center justify-between gap-2 xl:block">
                      <div>
                        <h3
                          className={`text-[12px] font-bold ${dark ? "text-sky-200" : "text-[#092a70]"}`}
                        >
                          Simulation Controls
                        </h3>
                        <p
                          className={`text-[9px] leading-snug ${dark ? "text-slate-400" : "text-slate-500"}`}
                        >
                          Adjust berth occupancy instantly.
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-md px-2 py-1 text-[12px] font-bold ${berthScenarioActive ? "bg-amber-100 text-amber-700" : dark ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-600"}`}
                      >
                        {simulationPercent}%
                      </span>
                    </div>

                    <div className="min-w-0">
                      <input
                        aria-label="Berth occupancy simulation percentage"
                        type="range"
                        min="60"
                        max="98"
                        step="1"
                        value={simulationPercent}
                        onChange={(event) =>
                          applyBerthScenario(Number(event.target.value), false)
                        }
                        onPointerUp={() =>
                          applyBerthScenario(simulationPercent, true)
                        }
                        onKeyUp={() =>
                          applyBerthScenario(simulationPercent, true)
                        }
                        className="simulation-range w-full"
                        style={{
                          background: `linear-gradient(90deg, #f59e0b 0 ${sliderProgress}%, #cbd5e1 ${sliderProgress}% 100%)`,
                        }}
                      />
                      <div
                        className={`mt-1 flex justify-between text-[8px] ${dark ? "text-slate-500" : "text-slate-500"}`}
                      >
                        <span>60% low</span>
                        <span className="font-semibold">72% baseline</span>
                        <span>98% severe</span>
                      </div>
                    </div>

                    <Toggle
                      checked={stormActive}
                      onChange={setStormSimulation}
                      label="Storm scenario"
                      tone="red"
                      dark={dark}
                    />

                    <button
                      type="button"
                      onClick={resetBerthScenario}
                      disabled={
                        !berthScenarioActive &&
                        simulationPercent === BASELINE_BERTH_OCCUPANCY
                      }
                      className={`h-8 rounded-lg border px-3 text-[10px] font-semibold transition disabled:opacity-40 ${dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                    >
                      Reset to 72%
                    </button>
                  </div>
                </section>
              </div>
            )}
          </div>

          <CommandMap
            selectedId={selectedVesselId}
            onSelect={selectVessel}
            snapshot={snapshot}
            stormActive={stormActive || weatherFilter === "severe"}
            vesselFilter={vesselFilter}
            onViewSlTrader={() =>
              chatRef.current?.prefill(
                `Show me vessel ${selectedVesselId?.replaceAll("_", " ") || "SL TRADER"}`,
              )
            }
            openVesselRequest={vesselDetailsRequest}
            zoomMode={zoomMode}
            viewRequest={mapViewRequest}
            satelliteVisible={satelliteVisible}
            weatherVisible={weatherLayerVisible}
            forecastHour={forecastHour}
            setForecastHour={setForecastHour}
            theme={theme}
            onToggleTheme={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
          />

          <DecisionInterface
            recommendation={recommendation}
            onAccept={acceptRecommendation}
            onChallenge={challengeRecommendation}
            onLog={logValidatedDecision}
            theme={theme}
            onDegraded={setDegradedNotice}
          />

          <div
            className={`grid grid-cols-1 xl:grid-cols-[.9fr_.95fr_1.15fr] gap-3 px-4 py-3 ${dark ? "bg-slate-950" : "bg-white"}`}
          >
            <BerthOccupancyPanel snapshot={snapshot} />
            <ShipmentRiskPanel snapshot={snapshot} />
            <RouteRiskPanel
              snapshot={snapshot}
              stormActive={stormActive || weatherFilter === "severe"}
            />
          </div>

          <div
            className={`px-4 pb-2 text-right text-[10px] ${dark ? "text-slate-500" : "text-slate-500"}`}
          >
            All data is simulated for demonstration purposes only and should not
            be used for real-world operations.
          </div>
        </main>
      </div>

      <NewsTicker snapshot={snapshot} />
    </div>
  );
}
