import React from 'react'
import { WEATHER, PORT, LEGEND, BERTHS } from '../data/mockData.js'
import { SHIPMENTS as SIM_SHIPMENTS, ROUTES as SIM_ROUTES, NEWS_TICKER as SIM_NEWS } from '../data/simulation.js'
import { LineChart, Line, BarChart, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'

const RISK_STYLE = {
  HIGH:   'bg-red-500/15 text-red-400 border-red-500/40',
  MEDIUM: 'bg-accent-500/15 text-accent-500 border-accent-500/40',
  LOW:    'bg-green-500/15 text-green-400 border-green-500/40',
  SEVERE: 'bg-red-600/20 text-red-300 border-red-600/50'
}

// ─── Weather Card ─────────────────────────────────────────────────────────────

export function WeatherCard({ snapshot, stormActive, onForceStorm, onClearStorm, weatherFilter }) {
  const w = snapshot?.weather

  // Build a 5-point forecast from snapshot weather (simulated progression)
  const buildForecast = (windKts, waveM) => {
    const factor = stormActive ? 1 : 0.85
    return [
      { t: 'Now',  wind: windKts,                   wave: waveM },
      { t: '+6h',  wind: Math.round(windKts * 0.90), wave: +(waveM * 0.88).toFixed(1) },
      { t: '+12h', wind: Math.round(windKts * 0.72), wave: +(waveM * 0.72).toFixed(1) },
      { t: '+18h', wind: Math.round(windKts * 0.56), wave: +(waveM * 0.57).toFixed(1) },
      { t: '+24h', wind: Math.round(windKts * factor * 0.42), wave: +(waveM * 0.42).toFixed(1) }
    ]
  }

  const riskLevel = w?.riskLevel ?? WEATHER.severity
  const riskKey = riskLevel?.toUpperCase()
  const windKts = w?.windKts ?? WEATHER.windKnots
  const waveM = w?.waveM ?? WEATHER.waveHeightM
  const visKm = w?.visibilityKm ?? WEATHER.visibilityNm
  const stormProb = w?.stormProbability ?? 0
  const conditionLabel = w?.conditionLabel ?? WEATHER.condition
  const forecast = buildForecast(windKts, waveM)

  // Apply weatherFilter: if 'high-risk', only show card with urgent styling when risk is High/Severe
  const isHighRisk = riskKey === 'HIGH' || riskKey === 'SEVERE'
  const dimmed = weatherFilter === 'high-risk' && !isHighRisk

  return (
    <div className={`card transition-opacity ${dimmed ? 'opacity-40' : 'opacity-100'}`}>
      <div className="card-header">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-sea-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
          </svg>
          <h3 className="text-sm font-semibold tracking-wide text-navy-50">WEATHER OVERVIEW</h3>
        </div>
        <span className={`chip border ${RISK_STYLE[riskKey] || RISK_STYLE.HIGH}`}>{riskLevel}</span>
      </div>

      <div className="p-3 space-y-2">
        <p className="text-[11px] text-navy-300 font-medium truncate">{w?.location ?? 'Malacca Strait'} · {conditionLabel}</p>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-navy-900/50 rounded-lg py-2">
            <div className="text-[10px] text-navy-300 uppercase">Wind</div>
            <div className={`text-lg font-mono ${stormActive ? 'text-red-400' : 'text-navy-50'}`}>
              {windKts}<span className="text-xs text-navy-300">kn</span>
            </div>
          </div>
          <div className="bg-navy-900/50 rounded-lg py-2">
            <div className="text-[10px] text-navy-300 uppercase">Waves</div>
            <div className={`text-lg font-mono ${stormActive ? 'text-red-400' : 'text-navy-50'}`}>
              {waveM}<span className="text-xs text-navy-300">m</span>
            </div>
          </div>
          <div className="bg-navy-900/50 rounded-lg py-2">
            <div className="text-[10px] text-navy-300 uppercase">Visibility</div>
            <div className={`text-lg font-mono ${stormActive ? 'text-red-400' : 'text-navy-50'}`}>
              {visKm}<span className="text-xs text-navy-300">km</span>
            </div>
          </div>
        </div>

        {stormActive && (
          <div className="flex items-center gap-1.5 bg-red-600/10 border border-red-600/40 rounded-lg px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 blink shrink-0" />
            <p className="text-[11px] text-red-300 font-medium">Storm probability: {stormProb}% — Gale warning active. Cold-chain cargo at risk.</p>
          </div>
        )}
        {!stormActive && (
          <div className="bg-navy-900/40 border border-navy-600/30 rounded-lg px-2.5 py-1.5">
            <p className="text-[11px] text-navy-300">Storm probability: {stormProb}% · {WEATHER.advisory}</p>
          </div>
        )}

        <div style={{ height: 80 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={forecast} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27426b" />
              <XAxis dataKey="t" tick={{ fill: '#a8bbd3', fontSize: 9 }} />
              <YAxis tick={{ fill: '#a8bbd3', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#142239', border: '1px solid #27426b', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="wind" stroke={stormActive ? '#ef4444' : '#f58220'} strokeWidth={2} dot={{ r: 2 }} name="Wind (kn)" />
              <Line type="monotone" dataKey="wave" stroke="#5fb0d8" strokeWidth={2} dot={{ r: 2 }} name="Wave (m)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Storm simulation controls */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onForceStorm}
            disabled={stormActive}
            className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border transition font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20"
          >
            ⛈ Simulate Storm
          </button>
          <button
            onClick={onClearStorm}
            disabled={!stormActive}
            className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border transition font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
          >
            ☀ Clear Storm
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Port Summary Card ────────────────────────────────────────────────────────

export function PortSummaryCard({ snapshot, congestionActive, onForceCongestion, onClearCongestion }) {
  const ps = snapshot?.portSummary
  const pct = ps?.berthOccupancy ?? PORT.berthOccupancyPct
  const congested = pct >= 80

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 21V8l9-5 9 5v13M3 21h18M9 21v-6h6v6" />
          </svg>
          <h3 className="text-sm font-semibold tracking-wide text-navy-50">PORT SUMMARY</h3>
        </div>
        <span className={`chip border ${pct >= 90 ? RISK_STYLE.SEVERE : congested ? RISK_STYLE.HIGH : RISK_STYLE.LOW}`}>
          {pct >= 90 ? 'SEVERE' : congested ? 'CONGESTED' : 'NOMINAL'}
        </span>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-navy-200">Berth Occupancy</span>
          <span className={`text-sm font-mono ${pct >= 90 ? 'text-red-400' : pct >= 75 ? 'text-accent-500' : 'text-navy-50'}`}>{pct}%</span>
        </div>
        <div className="w-full bg-navy-900 rounded-full h-2.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, background: pct >= 90 ? '#ef4444' : pct >= 75 ? '#f58220' : '#5fb0d8' }}
          />
        </div>

        {congestionActive && (
          <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/30 rounded-lg px-2.5 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 blink shrink-0" />
            <p className="text-[11px] text-red-300">High congestion — queueing delay likely. Priority berthing protocol active.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-navy-900/50 rounded-lg py-2">
            <div className="text-[10px] text-navy-300 uppercase">Avg Wait</div>
            <div className={`text-base font-mono ${ps?.avgDelayHours >= 18 ? 'text-red-400' : 'text-navy-50'}`}>
              {ps?.avgDelayHours ?? PORT.avgWaitHours}h
            </div>
          </div>
          <div className="bg-navy-900/50 rounded-lg py-2">
            <div className="text-[10px] text-navy-300 uppercase">Ships In Port</div>
            <div className="text-base font-mono text-navy-50">{ps?.shipsInPort ?? PORT.berthsOccupied}</div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-navy-300">High-risk shipments</span>
          <span className="text-red-400 font-mono font-medium">{ps?.highRiskShipments ?? 2}</span>
        </div>

        {/* Congestion simulation controls */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onForceCongestion}
            disabled={congestionActive}
            className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border transition font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-red-500/10 border-red-500/40 text-red-400 hover:bg-red-500/20"
          >
            Simulate 92% Congestion
          </button>
          <button
            onClick={onClearCongestion}
            disabled={!congestionActive}
            className="flex-1 text-[11px] px-2 py-1.5 rounded-lg border transition font-medium disabled:opacity-40 disabled:cursor-not-allowed bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20"
          >
            Clear Congestion
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Legend Card ──────────────────────────────────────────────────────────────

export function LegendCard() {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold tracking-wide text-navy-50">LEGEND</h3>
      </div>
      <div className="p-3 space-y-1.5">
        {LEGEND.map(l => (
          <div key={l.label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: l.color }} />
            <span className="text-xs text-navy-200">{l.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-navy-600/40 mt-1">
          <span className="w-3 h-3 rounded-full shrink-0 bg-sea-400" />
          <span className="text-xs text-navy-200">Cold-chain pharmaceutical</span>
        </div>
      </div>
    </div>
  )
}

// ─── Berth Occupancy Widget ───────────────────────────────────────────────────

export function BerthOccupancyWidget({ snapshot }) {
  const berthData = snapshot?.berthHistory
  const pct = snapshot?.portSummary?.berthOccupancy ?? PORT.berthOccupancyPct

  if (berthData) {
    const sampled = berthData.filter((_, i) => i % 3 === 0)
    return (
      <div className="card">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-sea-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="6" width="18" height="12" rx="1" /><path d="M3 12h18" />
            </svg>
            <h3 className="text-sm font-semibold tracking-wide text-navy-50">BERTH OCCUPANCY</h3>
          </div>
          <span className={`text-[11px] font-mono ${pct >= 90 ? 'text-red-400' : pct >= 75 ? 'text-accent-500' : 'text-sea-400'}`}>
            {pct}%
          </span>
        </div>
        <div className="p-3" style={{ height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sampled} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27426b" />
              <XAxis dataKey="hour" tick={{ fill: '#a8bbd3', fontSize: 9 }} />
              <YAxis domain={[50, 100]} tick={{ fill: '#a8bbd3', fontSize: 9 }} />
              <Tooltip contentStyle={{ background: '#142239', border: '1px solid #27426b', borderRadius: 8, fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke={pct >= 90 ? '#ef4444' : '#5fb0d8'} strokeWidth={2} dot={{ r: 2 }} name="Occupancy %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="px-3 pb-2">
          <p className="text-[10px] text-navy-400 italic">24h history · 3h moving-average projection — not trained ML</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-sea-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="6" width="18" height="12" rx="1" /><path d="M3 12h18" />
          </svg>
          <h3 className="text-sm font-semibold tracking-wide text-navy-50">BERTH OCCUPANCY</h3>
        </div>
        <span className="text-[11px] text-navy-300 font-mono">{pct}%</span>
      </div>
      <div className="p-3 text-center py-10 text-[11px] text-navy-400">No berth history available</div>
    </div>
  )
}

// ─── Shipment Risk Board (12 shipments, click-to-assess, filters) ─────────────

const PRIORITY_ORDER = { Critical: 0, CRITICAL: 0, High: 1, HIGH: 1, MEDIUM: 2, Routine: 3, LOW: 3 }

const PRIORITY_CHIP = {
  Critical:  'bg-red-500/15 text-red-400 border-red-500/40',
  CRITICAL:  'bg-red-500/15 text-red-400 border-red-500/40',
  High:     'bg-accent-500/15 text-accent-500 border-accent-500/40',
  HIGH:     'bg-accent-500/15 text-accent-500 border-accent-500/40',
  Routine:  'bg-green-500/15 text-green-400 border-green-500/40',
  LOW:      'bg-green-500/15 text-green-400 border-green-500/40',
  MEDIUM:   'bg-accent-500/15 text-accent-500 border-accent-500/40'
}

const STATUS_COLOR = {
  Critical: 'text-red-400',
  Watch:    'text-accent-500',
  Delayed:  'text-amber-400',
  'On time': 'text-green-400'
}

export function ShipmentRiskBoard({ onSelectVessel, snapshot, vesselFilter, onShipmentClick }) {
  const source = snapshot?.shipments ?? SIM_SHIPMENTS

  // Apply vessel type filter
  let filtered = [...source]
  if (vesselFilter === 'cold-chain') {
    filtered = filtered.filter(s => s.isColdChain && s.temperatureRange === '2-8 C')
  } else if (vesselFilter === 'general') {
    filtered = filtered.filter(s => !s.isColdChain)
  }

  const sorted = filtered.sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
  )

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-sm font-semibold tracking-wide text-navy-50">SHIPMENT RISK BOARD</h3>
        </div>
        <span className="text-[11px] text-navy-300">{sorted.length}/{source.length}</span>
      </div>
      <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
        {sorted.length === 0 && (
          <p className="text-[11px] text-navy-400 text-center py-4">No shipments match current filter.</p>
        )}
        {sorted.map(s => (
          <button
            key={s.id}
            onClick={() => onShipmentClick?.(s.id)}
            className="w-full text-left bg-navy-900/40 hover:bg-navy-700/50 active:scale-[0.99] border border-navy-600/40 rounded-lg px-3 py-2 transition group"
            title={`Click to assess risk for ${s.id}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-xs font-mono text-navy-200 shrink-0">{s.id}</span>
                {(s.isColdChain && s.temperatureRange === '2-8 C') && (
                  <span className="text-sea-400 text-[9px] font-bold shrink-0">❄ PHARMA</span>
                )}
                {(s.isColdChain && s.temperatureRange !== '2-8 C') && (
                  <span className="text-sea-400 text-[9px] shrink-0">❄</span>
                )}
              </div>
              <span className={`chip border text-[9px] shrink-0 ${PRIORITY_CHIP[s.priority] || PRIORITY_CHIP.MEDIUM}`}>
                {s.priority}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[11px] text-navy-100 font-medium truncate mr-2">{s.vessel}</span>
              <span className={`text-[10px] shrink-0 ${STATUS_COLOR[s.status] || 'text-navy-300'}`}>{s.status}</span>
            </div>
            <div className="text-[10px] text-navy-400 truncate mt-0.5">{s.cargo}</div>
            <div className="flex items-center justify-between mt-0.5 text-[10px]">
              <span className="text-navy-400">ETA {s.etaHours}h</span>
              {s.inventoryRisk && <span className={`${s.inventoryRisk?.includes('Stockout') ? 'text-red-400 font-medium' : 'text-navy-400'}`}>{s.inventoryRisk}</span>}
            </div>
            <div className="mt-1 text-[9px] text-accent-500 opacity-0 group-hover:opacity-100 transition">
              Click to assess risk →
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Route Risk Summary ───────────────────────────────────────────────────────

export function RouteRiskSummary({ snapshot, stormActive, congestionActive }) {
  const simRoutes = snapshot?.routes ?? SIM_ROUTES
  const berthPct = snapshot?.portSummary?.berthOccupancy ?? PORT.berthOccupancyPct

  // Dynamic risk overrides based on active simulation controls
  const getRouteRisk = (route) => {
    if (route.id === 'R_MALACCA') {
      if (stormActive || congestionActive) return 'Severe'
      return route.riskLevel || 'High'
    }
    if (route.id === 'R_SUNDA') {
      if (stormActive || congestionActive) return 'Medium'
      return route.riskLevel || 'Medium'
    }
    if (route.id === 'R_LOMBOK') {
      return 'Medium' // longer route always carries operational overhead
    }
    return route.riskLevel || 'Low'
  }

  const getRouteNote = (route) => {
    if (route.id === 'R_MALACCA') {
      if (stormActive && congestionActive) return `SEVERE: Active storm + ${berthPct}% congestion. Avoid. Divert to Sunda.`
      if (stormActive) return 'SEVERE: Storm active — gale warning. Cold-chain vessels should divert.'
      if (congestionActive) return `SEVERE: ${berthPct}% congestion — queueing delay. Priority berth required.`
      return route.notes
    }
    if (route.id === 'R_SUNDA') {
      if (stormActive || congestionActive) return 'Recommended alternate: +2 days, but avoids active Malacca disruption.'
      return route.notes
    }
    return route.notes
  }

  const riskStyle = (level) => {
    const u = level?.toUpperCase()
    return RISK_STYLE[u] || RISK_STYLE.MEDIUM
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-sea-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
          <h3 className="text-sm font-semibold tracking-wide text-navy-50">ROUTE RISK SUMMARY</h3>
        </div>
        {(stormActive || congestionActive) && (
          <span className="chip border bg-red-500/15 text-red-400 border-red-500/40 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 blink" />DISRUPTION
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        {simRoutes.map(r => {
          const risk = getRouteRisk(r)
          const note = getRouteNote(r)
          const isHighlighted = (r.id === 'R_SUNDA') && (stormActive || congestionActive)
          return (
            <div key={r.id} className={`rounded-lg px-3 py-2 border transition ${
              isHighlighted
                ? 'bg-green-500/8 border-green-500/30'
                : 'bg-navy-900/40 border-navy-600/30'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-navy-50 font-medium">{r.name}</span>
                  {isHighlighted && <span className="text-[9px] text-green-400 font-bold">RECOMMENDED</span>}
                </div>
                <span className={`chip border ${riskStyle(risk)}`}>{risk}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-navy-300 flex-wrap">
                {r.deltaDays !== undefined && <span>Δ{r.deltaDays >= 0 ? '+' : ''}{r.deltaDays}d</span>}
                {r.costIndex !== undefined && <span>Cost ×{(r.costIndex / 100).toFixed(1)}</span>}
                {r.co2Index !== undefined && <span>CO2 ×{(r.co2Index / 100).toFixed(1)}</span>}
              </div>
              <p className="text-[10px] text-navy-400 mt-1 leading-relaxed">{note}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}



// ─── Terminal Occupancy Breakdown ────────────────────────────────────────────

export function TerminalOccupancyBreakdown({ snapshot, onTerminalSelect }) {
  const terminals = snapshot?.terminalOccupancy ?? []
  const highTerminals = terminals.filter(t => ['High', 'Severe'].includes(t.riskLevel))

  const riskColor = (risk) => {
    if (risk === 'Severe') return '#ef4444'
    if (risk === 'High') return '#f58220'
    if (risk === 'Medium') return '#f59e0b'
    return '#22c55e'
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-accent-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 20V8m4 12V4m4 16v-8m4 8V6m4 14V10" />
          </svg>
          <h3 className="text-sm font-semibold tracking-wide text-navy-50">TERMINAL OCCUPANCY BREAKDOWN</h3>
        </div>
        <span className={`chip border ${highTerminals.length >= 3 ? RISK_STYLE.HIGH : RISK_STYLE.MEDIUM}`}>
          {highTerminals.length} high/severe
        </span>
      </div>
      <div className="p-3 space-y-3">
        <div className="bg-navy-900/40 border border-navy-700/40 rounded-xl p-2" style={{ height: 160 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={terminals} margin={{ top: 8, right: 6, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27426b" />
              <XAxis dataKey="terminalId" tick={{ fill: '#a8bbd3', fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#a8bbd3', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: '#142239', border: '1px solid #27426b', borderRadius: 8, color: '#eef2f8', fontSize: 11 }}
                formatter={(value) => [`${value}%`, 'Occupancy']}
              />
              <Bar dataKey="occupancyPercent" radius={[5, 5, 0, 0]}>
                {terminals.map(t => <Cell key={t.terminalId} fill={riskColor(t.riskLevel)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-navy-300 leading-relaxed bg-navy-900/35 border border-navy-700/35 rounded-lg px-3 py-2">
          {highTerminals.length
            ? `${highTerminals.map(t => t.terminalId).join(', ')} are above 85%; prioritise critical/cold-chain cargo and smooth ETAs for routine vessels.`
            : 'No terminal is above 85%; maintain planned arrival sequence with routine monitoring.'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-[10px] border-separate border-spacing-y-1">
            <thead className="text-navy-400 uppercase tracking-wider">
              <tr>
                <th className="text-left px-2 py-1">Terminal</th>
                <th className="text-right px-2 py-1">Occ.</th>
                <th className="text-right px-2 py-1">Queue</th>
                <th className="text-right px-2 py-1">Delay</th>
                <th className="text-left px-2 py-1">Action</th>
              </tr>
            </thead>
            <tbody>
              {terminals.map(t => (
                <tr
                  key={t.terminalId}
                  onClick={() => onTerminalSelect?.(t)}
                  className="bg-navy-900/45 hover:bg-navy-800/70 transition cursor-pointer"
                  title="Click to load this terminal into the Decision Interface"
                >
                  <td className="rounded-l-lg px-2 py-2 font-semibold text-navy-100">
                    <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: riskColor(t.riskLevel) }} />
                    {t.terminalId}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-navy-100">{t.occupancyPercent}%</td>
                  <td className="px-2 py-2 text-right font-mono text-navy-300">{t.vesselsWaiting}</td>
                  <td className="px-2 py-2 text-right font-mono text-navy-300">{t.avgDelayHours}h</td>
                  <td className="rounded-r-lg px-2 py-2 text-navy-300 max-w-[180px] truncate">{t.recommendedAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── News Ticker ──────────────────────────────────────────────────────────────

export function NewsTicker({ snapshot }) {
  const source = snapshot?.newsTicker ?? SIM_NEWS
  const items = [...source, ...source]
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-navy-900 border-r border-navy-600 shrink-0">
          <svg className="w-3.5 h-3.5 text-accent-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12l9-9 9 9M5 10v10h14V10" />
          </svg>
          <span className="text-[11px] font-semibold text-navy-50 tracking-wider whitespace-nowrap">WORLD SHIPPING NEWS</span>
        </div>
        <div className="flex-1 overflow-hidden py-2">
          <div className="ticker-track flex gap-8 whitespace-nowrap">
            {items.map((n, i) => (
              <span key={i} className="text-[11px] text-navy-200 font-mono">
                <span className="text-accent-500 mr-1.5">●</span>{n}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
