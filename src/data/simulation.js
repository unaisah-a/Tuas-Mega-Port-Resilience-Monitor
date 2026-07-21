// src/data/simulation.js
// Canonical simulation data for Tuas Mega Port Resilience Monitor.
// MOCK MODE only — no API key required. All data is simulated.

export const MODE = 'MOCK'

// ─── Mutable simulation state ─────────────────────────────────────────────────
let _stormForced = false
let _congestionForced = false
export const BASELINE_BERTH_OCCUPANCY = 72
export const BASELINE_AVG_DELAY_HOURS = 18.6
let _congestionLevel = BASELINE_BERTH_OCCUPANCY

// ─── Weather ──────────────────────────────────────────────────────────────────
const BASE_WEATHER = {
  location: 'Malacca Strait',
  conditionLabel: 'Partly Cloudy with Scattered Showers',
  windKts: 18,
  waveM: 1.8,
  visibilityKm: 9,
  stormProbability: 22,
  riskLevel: 'Medium'
}

const STORM_OVERRIDE = {
  conditionLabel: 'Severe Thunderstorm — Gale Warning Active',
  windKts: 42,
  waveM: 4.8,
  visibilityKm: 1.8,
  stormProbability: 91,
  riskLevel: 'Severe'
}

function getWeather() {
  if (_stormForced) return { ...BASE_WEATHER, ...STORM_OVERRIDE }
  return { ...BASE_WEATHER }
}

export function forceStorm() { _stormForced = true }
export function clearStorm() { _stormForced = false }
export function isStormForced() { return _stormForced }

// ─── Berth occupancy ──────────────────────────────────────────────────────────
// 24-hour historical occupancy (%) — hourly readings, evening peak ~18:00
const BERTH_HISTORY_BASE = [
  { hour: '00:00', value: 61 }, { hour: '01:00', value: 59 },
  { hour: '02:00', value: 57 }, { hour: '03:00', value: 58 },
  { hour: '04:00', value: 60 }, { hour: '05:00', value: 62 },
  { hour: '06:00', value: 65 }, { hour: '07:00', value: 68 },
  { hour: '08:00', value: 72 }, { hour: '09:00', value: 75 },
  { hour: '10:00', value: 77 }, { hour: '11:00', value: 79 },
  { hour: '12:00', value: 80 }, { hour: '13:00', value: 81 },
  { hour: '14:00', value: 82 }, { hour: '15:00', value: 85 },
  { hour: '16:00', value: 88 }, { hour: '17:00', value: 91 },
  { hour: '18:00', value: 93 }, { hour: '19:00', value: 92 },
  { hour: '20:00', value: 90 }, { hour: '21:00', value: 85 },
  { hour: '22:00', value: 79 }, { hour: '23:00', value: 72 }
]

function generateBerthHistory() {
  if (_congestionForced) {
    const baselineCurrent = BERTH_HISTORY_BASE[BERTH_HISTORY_BASE.length - 1].value
    const delta = _congestionLevel - baselineCurrent
    return BERTH_HISTORY_BASE.map(h => ({
      ...h,
      value: Math.max(35, Math.min(99, Math.round(h.value + delta)))
    }))
  }
  return [...BERTH_HISTORY_BASE]
}

// 3-hour moving average projection for next 24 hours (8 × 3h steps).
// Labelled as heuristic — not a trained ML model.
function generateBerthProjection(history) {
  const vals = history.map(h => h.value)
  return Array.from({ length: 8 }, (_, i) => {
    const refIdx = vals.length - 3 + i
    const window = [
      vals[Math.max(0, refIdx - 2)],
      vals[Math.max(0, refIdx - 1)],
      vals[Math.max(0, refIdx)]
    ]
    const avg = Math.round(window.reduce((a, b) => a + b, 0) / 3)
    const hourNum = (i * 3) % 24
    const label = hourNum.toString().padStart(2, '0') + ':00'
    return {
      hour: `+${i * 3}h (${label})`,
      value: Math.min(95, Math.max(55, avg)),
      projected: true
    }
  })
}

export function forceCongestion(level = BASELINE_BERTH_OCCUPANCY) {
  _congestionLevel = Math.max(60, Math.min(98, Math.round(Number(level) || BASELINE_BERTH_OCCUPANCY)))
  _congestionForced = true
}
export function setCongestionLevel(level) {
  _congestionLevel = Math.max(60, Math.min(98, Math.round(Number(level) || BASELINE_BERTH_OCCUPANCY)))
}
export function clearCongestion() { _congestionForced = false }
export function isCongestionForced() { return _congestionForced }
export function getCongestionLevel() { return _congestionLevel }

// ─── Shipments (exactly 12; exactly 2 cold-chain pharma at 2-8 C) ─────────────
export const SHIPMENTS = [
  // ── Cold-chain pharma #1 — CRITICAL ────────────────────────────────────────
  {
    id: 'SHP-2041',
    vessel: 'SL TRADER',
    imo: 'IMO9874321',
    cargo: 'Pharmaceuticals — Insulin & Vaccines',
    origin: 'Rotterdam, Netherlands',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Rotterdam → Suez Canal → Malacca Strait → Singapore',
    etaHours: 6,
    status: 'Critical',
    valueSGD: 5880000,
    isColdChain: true,
    temperatureRange: '2-8 C',
    priority: 'Critical',
    riskLevel: 'High',
    currentLocation: 'Malacca Strait — 38 nm from Tuas anchorage',
    inventoryRisk: 'Stockout in 18h',
    customer: 'BioHealth Pharma',
    escalation: 'Active — Director notified'
  },
  // ── Cold-chain pharma #2 — CRITICAL ────────────────────────────────────────
  {
    id: 'SHP-2042',
    vessel: 'AURORA PIONEER',
    imo: 'IMO9761234',
    cargo: 'Biologics — COVID-19 Antivirals & Blood Products',
    origin: 'Hamburg, Germany',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Hamburg → Suez Canal → Malacca Strait → Singapore',
    etaHours: 18,
    status: 'Watch',
    valueSGD: 3240000,
    isColdChain: true,
    temperatureRange: '2-8 C',
    priority: 'Critical',
    riskLevel: 'High',
    currentLocation: 'Malacca Strait — 190 nm west of Singapore',
    inventoryRisk: 'Stockout in 36h',
    customer: 'MedGlobal AG',
    escalation: 'Monitoring'
  },
  // ── Frozen reefer cargo — not pharmaceutical cold-chain ─────────────────────
  {
    id: 'SHP-2043',
    vessel: 'OCEAN VEGA',
    imo: 'IMO9652891',
    cargo: 'Frozen Seafood Reefer (non-pharma)',
    origin: 'Oslo, Norway',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Oslo → Gibraltar → Suez Canal → Malacca Strait → Singapore',
    etaHours: 22,
    status: 'Watch',
    valueSGD: 2590000,
    isColdChain: false,
    temperatureRange: '-20 C (frozen food)',
    priority: 'High',
    riskLevel: 'Medium',
    currentLocation: 'Malacca Strait — holding at anchorage',
    inventoryRisk: 'Stable — 36h buffer',
    customer: 'AsiaCold Logistics',
    escalation: 'None'
  },
  // ── Non-cold-chain shipments ────────────────────────────────────────────────
  {
    id: 'SHP-2044',
    vessel: 'NORDIC PEARL',
    imo: 'IMO9543210',
    cargo: 'Iron Ore',
    origin: 'Port Hedland, Australia',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Port Hedland → Lombok Strait → Singapore',
    etaHours: 30,
    status: 'On time',
    valueSGD: 896000,
    isColdChain: false,
    temperatureRange: 'N/A',
    priority: 'Routine',
    riskLevel: 'Low',
    currentLocation: 'South China Sea — 310 nm east of Singapore',
    inventoryRisk: 'Buffer 9 days',
    customer: 'SG Steel Mills',
    escalation: 'None'
  },
  {
    id: 'SHP-2045',
    vessel: 'PACIFIC DAWN',
    imo: 'IMO9432109',
    cargo: 'LNG',
    origin: 'Doha, Qatar',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Doha → Strait of Hormuz → Malacca Strait → Singapore',
    etaHours: 12,
    status: 'On time',
    valueSGD: 1372000,
    isColdChain: false,
    temperatureRange: 'N/A',
    priority: 'High',
    riskLevel: 'Medium',
    currentLocation: 'Malacca Strait — southern approach',
    inventoryRisk: 'Buffer 4 days',
    customer: 'EnergyCo Singapore',
    escalation: 'None'
  },
  {
    id: 'SHP-2046',
    vessel: 'MERIDIAN STAR',
    imo: 'IMO9321098',
    cargo: 'Consumer Electronics',
    origin: 'Shenzhen, China',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Shenzhen → South China Sea → Singapore',
    etaHours: 4,
    status: 'On time',
    valueSGD: 728000,
    isColdChain: false,
    temperatureRange: 'N/A',
    priority: 'Routine',
    riskLevel: 'Low',
    currentLocation: 'Approaching Tuas Berth 1',
    inventoryRisk: 'Buffer 14 days',
    customer: 'RetailMart SG',
    escalation: 'None'
  },
  {
    id: 'SHP-2047',
    vessel: 'EAST WIND',
    imo: 'IMO9210987',
    cargo: 'Automotive Parts & Assembly Kits',
    origin: 'Nagoya, Japan',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Nagoya → East China Sea → South China Sea → Singapore',
    etaHours: 36,
    status: 'Delayed',
    valueSGD: 1540000,
    isColdChain: false,
    temperatureRange: 'N/A',
    priority: 'High',
    riskLevel: 'Medium',
    currentLocation: 'South China Sea — delayed by Typhoon Kimi residual swell',
    inventoryRisk: 'Production line impact in 42h',
    customer: 'AutoAssemble Ltd',
    escalation: 'Monitoring'
  },
  {
    id: 'SHP-2048',
    vessel: 'HONG KONG EXPRESS',
    imo: 'IMO9109876',
    cargo: 'Textiles & Apparel',
    origin: 'Hong Kong',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Hong Kong → South China Sea → Singapore',
    etaHours: 14,
    status: 'On time',
    valueSGD: 448000,
    isColdChain: false,
    temperatureRange: 'N/A',
    priority: 'Routine',
    riskLevel: 'Low',
    currentLocation: 'South China Sea — 140 nm north-east of Singapore',
    inventoryRisk: 'Buffer 21 days',
    customer: 'FashionHub Asia',
    escalation: 'None'
  },
  {
    id: 'SHP-2049',
    vessel: 'MAJESTIC ACE',
    imo: 'IMO9098765',
    cargo: 'Ro-Ro Vehicles (1,200 units)',
    origin: 'Yokohama, Japan',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Yokohama → East China Sea → Luzon Strait → South China Sea → Singapore',
    etaHours: 48,
    status: 'On time',
    valueSGD: 2184000,
    isColdChain: false,
    temperatureRange: 'N/A',
    priority: 'High',
    riskLevel: 'Low',
    currentLocation: 'South China Sea — 520 nm north of Singapore',
    inventoryRisk: 'Buffer 7 days',
    customer: 'SG Auto Distributors',
    escalation: 'None'
  },
  {
    id: 'SHP-2050',
    vessel: 'CORAL SEA',
    imo: 'IMO9087654',
    cargo: 'Industrial Chemicals (Class 3)',
    origin: 'Jubail, Saudi Arabia',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Jubail → Strait of Hormuz → Malacca Strait → Singapore',
    etaHours: 20,
    status: 'Watch',
    valueSGD: 1176000,
    isColdChain: false,
    temperatureRange: 'N/A',
    priority: 'High',
    riskLevel: 'Medium',
    currentLocation: 'Malacca Strait — 220 nm from Tuas',
    inventoryRisk: 'Buffer 5 days',
    customer: 'ChemIndustries SG',
    escalation: 'None'
  },
  {
    id: 'SHP-2051',
    vessel: 'TITAN GLORY',
    imo: 'IMO9076543',
    cargo: 'Steel Coils & Structural Steel',
    origin: 'Pohang, South Korea',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Pohang → East China Sea → South China Sea → Singapore',
    etaHours: 52,
    status: 'On time',
    valueSGD: 672000,
    isColdChain: false,
    temperatureRange: 'N/A',
    priority: 'Routine',
    riskLevel: 'Low',
    currentLocation: 'South China Sea — 680 nm north-east of Singapore',
    inventoryRisk: 'Buffer 18 days',
    customer: 'BuildCorp SG',
    escalation: 'None'
  },
  {
    id: 'SHP-2052',
    vessel: 'PACIFIC BRIDGE',
    imo: 'IMO9065432',
    cargo: 'Heavy Machinery & Construction Equipment',
    origin: 'Tianjin, China',
    destination: 'Singapore (Tuas Mega Port)',
    route: 'Tianjin → Yellow Sea → East China Sea → South China Sea → Singapore',
    etaHours: 60,
    status: 'On time',
    valueSGD: 2800000,
    isColdChain: false,
    temperatureRange: 'N/A',
    priority: 'Routine',
    riskLevel: 'Low',
    currentLocation: 'East China Sea — 820 nm from Singapore',
    inventoryRisk: 'Buffer 30 days',
    customer: 'MegaBuild Asia',
    escalation: 'None'
  }
]

// ─── Routes (exact spec values) ───────────────────────────────────────────────
export const ROUTES = [
  {
    id: 'R_MALACCA',
    name: 'Malacca Strait (Primary)',
    deltaDays: 0,
    costIndex: 100,
    co2Index: 100,
    riskLevel: 'High',
    notes: 'Primary route. Currently: gale warning active, 3 vessels holding.'
  },
  {
    id: 'R_SUNDA',
    name: 'Sunda Strait (Alternate)',
    deltaDays: 2,
    costIndex: 118,
    co2Index: 115,
    riskLevel: 'Medium',
    notes: 'Adds 2 days transit. Calmer seas. Suitable for non-critical bulk cargo.'
  },
  {
    id: 'R_LOMBOK',
    name: 'Lombok Strait (Deep Alternate)',
    deltaDays: 3.5,
    costIndex: 126,
    co2Index: 124,
    riskLevel: 'Low',
    notes: 'Adds 3.5 days. Minimal congestion. Highest CO2 of all sea routes.'
  },
  {
    id: 'R_AIR',
    name: 'Partial Air Freight',
    deltaDays: -4,
    costIndex: 340,
    co2Index: 610,
    riskLevel: 'Low',
    notes: 'Emergency use only. 340% cost index, 610% CO2 index vs sea baseline. Restricted to critical cold-chain cargo.'
  }
]


// ─── Terminal-level occupancy (T1-T6) ─────────────────────────────────────────
const TERMINALS_NORMAL = [
  { terminalId: 'T1', terminalName: 'Tuas Terminal 1', totalBerths: 6, occupiedBerths: 4, vesselsWaiting: 2, avgDelayHours: 6, suitableCargoTypes: ['General cargo', 'Containers'] },
  { terminalId: 'T2', terminalName: 'Tuas Terminal 2', totalBerths: 6, occupiedBerths: 5, vesselsWaiting: 3, avgDelayHours: 9, suitableCargoTypes: ['Containers', 'High-value cargo'] },
  { terminalId: 'T3', terminalName: 'Tuas Terminal 3', totalBerths: 5, occupiedBerths: 4, vesselsWaiting: 4, avgDelayHours: 12, suitableCargoTypes: ['Cold-chain pharma', 'Reefer containers'] },
  { terminalId: 'T4', terminalName: 'Tuas Terminal 4', totalBerths: 7, occupiedBerths: 5, vesselsWaiting: 3, avgDelayHours: 8, suitableCargoTypes: ['Bulk', 'Project cargo'] },
  { terminalId: 'T5', terminalName: 'Tuas Terminal 5', totalBerths: 5, occupiedBerths: 3, vesselsWaiting: 1, avgDelayHours: 4, suitableCargoTypes: ['General cargo', 'Containers'] },
  { terminalId: 'T6', terminalName: 'Tuas Terminal 6', totalBerths: 4, occupiedBerths: 3, vesselsWaiting: 2, avgDelayHours: 7, suitableCargoTypes: ['Ro-Ro', 'General cargo'] }
]

const TERMINALS_CONGESTED = [
  { terminalId: 'T1', terminalName: 'Tuas Terminal 1', totalBerths: 6, occupiedBerths: 6, vesselsWaiting: 7, avgDelayHours: 22, suitableCargoTypes: ['General cargo', 'Containers'] },
  { terminalId: 'T2', terminalName: 'Tuas Terminal 2', totalBerths: 6, occupiedBerths: 6, vesselsWaiting: 8, avgDelayHours: 24, suitableCargoTypes: ['Containers', 'High-value cargo'] },
  { terminalId: 'T3', terminalName: 'Tuas Terminal 3', totalBerths: 5, occupiedBerths: 5, vesselsWaiting: 6, avgDelayHours: 20, suitableCargoTypes: ['Cold-chain pharma', 'Reefer containers'] },
  { terminalId: 'T4', terminalName: 'Tuas Terminal 4', totalBerths: 7, occupiedBerths: 6, vesselsWaiting: 5, avgDelayHours: 16, suitableCargoTypes: ['Bulk', 'Project cargo'] },
  { terminalId: 'T5', terminalName: 'Tuas Terminal 5', totalBerths: 5, occupiedBerths: 4, vesselsWaiting: 3, avgDelayHours: 12, suitableCargoTypes: ['General cargo', 'Containers'] },
  { terminalId: 'T6', terminalName: 'Tuas Terminal 6', totalBerths: 4, occupiedBerths: 4, vesselsWaiting: 4, avgDelayHours: 18, suitableCargoTypes: ['Ro-Ro', 'General cargo'] }
]

function getTerminalRisk(occupancyPercent) {
  if (occupancyPercent >= 95) return 'Severe'
  if (occupancyPercent >= 85) return 'High'
  if (occupancyPercent >= 70) return 'Medium'
  return 'Low'
}

function getTerminalAction(riskLevel) {
  if (riskLevel === 'Severe') return 'Activate congestion playbook and escalate berth allocation review'
  if (riskLevel === 'High') return 'Reschedule lower-priority arrivals and prioritise critical cargo'
  if (riskLevel === 'Medium') return 'Monitor queue and prepare ETA smoothing'
  return 'Maintain planned arrival sequence'
}

function enrichTerminal(t, occupancyOverride = null) {
  const occupancyPercent = occupancyOverride == null
    ? Math.round((t.occupiedBerths / t.totalBerths) * 100)
    : Math.max(0, Math.min(100, Math.round(occupancyOverride)))
  const riskLevel = getTerminalRisk(occupancyPercent)
  return {
    ...t,
    occupancyPercent,
    riskLevel,
    recommendedAction: getTerminalAction(riskLevel)
  }
}

function getTerminalOccupancy() {
  if (!_congestionForced) return TERMINALS_NORMAL.map(item => enrichTerminal(item))

  // Apply the selected port-wide scenario both below and above the 72% baseline.
  // Each terminal keeps its normal relative pressure, while queue and delay values
  // move with the selected occupancy instead of being stuck at the normal figures.
  const delta = _congestionLevel - BASELINE_BERTH_OCCUPANCY
  return TERMINALS_NORMAL.map((normal, index) => {
    const normalPercent = Math.round((normal.occupiedBerths / normal.totalBerths) * 100)
    const terminalOffset = [0, 3, 6, 8, -4, -1][index] || 0
    const occupancyPercent = Math.max(45, Math.min(100, normalPercent + delta + terminalOffset))
    const occupiedBerths = Math.max(0, Math.min(normal.totalBerths, Math.round((occupancyPercent / 100) * normal.totalBerths)))
    const waitingDelta = Math.round(delta / 5)
    const delayDelta = Math.round(delta * 0.55)

    return enrichTerminal({
      ...normal,
      occupiedBerths,
      vesselsWaiting: Math.max(0, normal.vesselsWaiting + waitingDelta),
      avgDelayHours: Math.max(1, normal.avgDelayHours + delayDelta)
    }, occupancyPercent)
  })
}

// ─── Port summary ─────────────────────────────────────────────────────────────
function getPortSummary(berthOccupancy) {
  const occupancyDelta = berthOccupancy - BASELINE_BERTH_OCCUPANCY
  const avgDelayHours = Math.max(
    2,
    Number((BASELINE_AVG_DELAY_HOURS + occupancyDelta * 0.38).toFixed(1))
  )
  return {
    portName: 'Tuas Mega Port',
    avgDelayHours,
    berthOccupancy,
    shipsInPort: Math.max(5, 11 + Math.round(occupancyDelta / 4)),
    highRiskShipments: SHIPMENTS.filter(s => s.riskLevel === 'High').length
  }
}

// ─── Orchestration signals ────────────────────────────────────────────────────
function getOrchestrationSignals(weather, berthOccupancy) {
  const coldChainShipments = SHIPMENTS.filter(s => s.isColdChain)
  const pharmaCritical = SHIPMENTS.filter(s => s.isColdChain && s.temperatureRange === '2-8 C')
  const exposedShipments = SHIPMENTS.filter(
    s => s.riskLevel === 'High' || s.status === 'Critical' || s.status === 'Watch'
  )
  const congestionLabel = berthOccupancy >= 90 ? 'Severe' : berthOccupancy >= 75 ? 'High' : 'Moderate'

  return {
    logistics: {
      weatherRisk: weather.riskLevel,
      berthCongestionLevel: congestionLabel,
      avgDelayHours: getPortSummary(berthOccupancy).avgDelayHours,
      routeRisks: {
        malacca: `${weather.riskLevel === 'Severe' ? 'Severe' : 'High'} — gale warning active`,
        sunda: 'Medium — clear, +2 days detour',
        lombok: 'Low — clear, +3.5 days detour',
        air: 'Low risk — extreme cost (340%) and CO2 (610%)'
      },
      exposedShipments: exposedShipments.map(s => s.id)
    },
    inventory: {
      coldChainShipments: coldChainShipments.map(s => s.id),
      criticalCargoCount: pharmaCritical.length,
      safetyStockRisk: 'High — SHP-2041 insulin stockout projected in 18h without priority berthing',
      estimatedStockoutExposure: 'SGD 5,880,000 (SHP-2041) + SGD 3,240,000 (SHP-2042)'
    },
    procurement: {
      expediteCandidates: pharmaCritical.map(s => s.id),
      holdCandidates: SHIPMENTS.filter(s => s.priority === 'Routine' && s.riskLevel === 'Low').map(s => s.id),
      supplierNotificationRequired: [
        'BioHealth Pharma (SHP-2041 — insulin stockout risk)',
        'MedGlobal AG (SHP-2042 — biologics, monitoring)'
      ],
      customerEscalationRequired: [
        'BioHealth Pharma — Director already notified',
        'National Pharmacy Board — on standby'
      ]
    }
  }
}

// ─── Default decision model ───────────────────────────────────────────────────
export const DEFAULT_DECISION = {
  recommendation: null,
  selectedAction: null,
  confidence: null,
  humanValidationRequired: false,
  tradeoffs: {
    delay: null,
    cost: null,
    co2: null,
    coldChainSafe: null,
    risk: null
  },
  dataUsed: []
}

// ─── World risk events and news ticker ────────────────────────────────────────
// Geopolitical entries below are scenario context frozen as of 11 July 2026.
// Weather, port and shipment figures remain simulated classroom data.
export const WORLD_RISK_EVENTS = [
  {
    id: 'EVT_HORMUZ',
    name: 'Strait of Hormuz',
    region: 'Middle East',
    position: [26.45, 56.45],
    zoom: 6.5,
    type: 'Security',
    riskLevel: 'Severe',
    asOf: '11 Jul 2026',
    sourceLabel: 'Reuters, 7–10 Jul 2026; UKMTO incident reporting',
    summary: 'Commercial-vessel attacks and renewed regional clashes have sharply reduced predictable tanker passage and increased war-risk restrictions.',
    impact: 'Verify insurer approval, crew-safety controls and a confirmed passage window before committing Gulf energy cargo.'
  },
  {
    id: 'EVT_RED_SEA',
    name: 'Red Sea / Bab el-Mandeb',
    region: 'Middle East / Africa',
    position: [13.0, 43.3],
    zoom: 5.5,
    type: 'Security',
    riskLevel: 'High',
    asOf: '11 Jul 2026',
    sourceLabel: 'U.S. MARAD Advisory 2026-006; UKMTO July 2026 incidents',
    summary: 'Attack risk remains active across the southern Red Sea, Bab el-Mandeb, Gulf of Aden and adjoining waters.',
    impact: 'Keep Cape of Good Hope contingencies and additional Asia–Europe schedule buffer available.'
  },
  {
    id: 'EVT_BLACK_SEA',
    name: 'Black Sea / Sea of Azov',
    region: 'Europe',
    position: [44.8, 35.0],
    zoom: 5.5,
    type: 'Conflict',
    riskLevel: 'Severe',
    asOf: '11 Jul 2026',
    sourceLabel: 'Active maritime combat-zone advisory; July 2026 reporting',
    summary: 'Military operations continue to threaten commercial shipping and constrain route flexibility around energy and bulk-export corridors.',
    impact: 'Apply voyage-security review, wider arrival windows and alternate sourcing for exposed cargo.'
  },
  {
    id: 'EVT_GULF_MEXICO',
    name: 'Gulf of Mexico storm corridor',
    region: 'North America',
    position: [24.7, -90.2],
    zoom: 5.2,
    type: 'Weather',
    riskLevel: 'High',
    asOf: 'July 2026 scenario',
    sourceLabel: 'TMPRM weather disruption scenario',
    summary: 'A tropical-weather scenario creates squall, visibility and offshore-terminal interruption risk across Gulf routes.',
    impact: 'Protect offshore schedules, verify port condition status and maintain hurricane-routing buffers.'
  },
  {
    id: 'EVT_US_WEST_COAST',
    name: 'Los Angeles / Long Beach queue',
    region: 'North America',
    position: [33.65, -118.25],
    zoom: 7,
    type: 'Port',
    riskLevel: 'Medium',
    asOf: 'July 2026 scenario',
    sourceLabel: 'TMPRM port-congestion scenario',
    summary: 'A simulated terminal queue and rail-dwell increase reduces schedule reliability at the main Southern California gateway.',
    impact: 'Smooth arrivals, confirm rail capacity and avoid early anchorage arrival without a berth window.'
  },
  {
    id: 'EVT_SANTOS',
    name: 'Port of Santos channel pressure',
    region: 'South America',
    position: [-24.0, -46.3],
    zoom: 7,
    type: 'Port',
    riskLevel: 'High',
    asOf: 'July 2026 scenario',
    sourceLabel: 'TMPRM Brazil port scenario; 2026 draft-limit context',
    summary: 'A channel-draft and terminal-queue scenario raises waiting-time risk for container and agricultural exports.',
    impact: 'Validate sailing draft, tide window and terminal sequence before finalising the call.'
  },
  {
    id: 'EVT_PARANA',
    name: 'Paraná / Rosario draft restriction',
    region: 'South America',
    position: [-32.5, -60.8],
    zoom: 6.2,
    type: 'Port',
    riskLevel: 'Medium',
    asOf: 'July 2026 scenario',
    sourceLabel: 'TMPRM inland-waterway scenario',
    summary: 'A simulated low-water and shoaling condition reduces permissible draft on the grain-export corridor.',
    impact: 'Review load plans, under-keel clearance and possible top-off alternatives downstream.'
  },
  {
    id: 'EVT_CAPE_HORN',
    name: 'Cape Horn winter gale',
    region: 'South America',
    position: [-56.0, -67.0],
    zoom: 5.5,
    type: 'Weather',
    riskLevel: 'High',
    asOf: 'July 2026 scenario',
    sourceLabel: 'TMPRM Southern Ocean weather scenario',
    summary: 'Winter westerlies and large swell create a high-motion and delay risk around the southern tip of South America.',
    impact: 'Use conservative weather routing and protect deck cargo and crew-rest windows.'
  },
  {
    id: 'EVT_CHINA_COAST',
    name: 'Shanghai–Ningbo weather corridor',
    region: 'China',
    position: [29.5, 123.5],
    zoom: 6.3,
    type: 'Weather',
    riskLevel: 'High',
    asOf: 'July 2026 scenario',
    sourceLabel: 'TMPRM East China Sea typhoon scenario',
    summary: 'A simulated tropical-weather track threatens pilotage, terminal windows and feeder connections on the China coast.',
    impact: 'Confirm port-condition status and protect transshipment cut-offs before departure.'
  },
  {
    id: 'EVT_GULF_GUINEA',
    name: 'Gulf of Guinea piracy watch',
    region: 'Africa',
    position: [2.5, 4.0],
    zoom: 5.3,
    type: 'Security',
    riskLevel: 'High',
    asOf: 'July 2026',
    sourceLabel: 'IMB 2026 piracy reporting and warnings',
    summary: 'Piracy and armed-robbery risk persists in the Gulf of Guinea despite improved regional counter-piracy activity.',
    impact: 'Maintain strict watch, secure access points and follow company and flag-state security guidance.'
  },
  {
    id: 'EVT_SOMALI_BASIN',
    name: 'Somali Basin piracy risk',
    region: 'Africa',
    position: [8.5, 52.0],
    zoom: 5.2,
    type: 'Security',
    riskLevel: 'High',
    asOf: 'July 2026',
    sourceLabel: 'U.S. MARAD 2026-002; UKMTO / JMIC reporting',
    summary: 'Hijacking, boarding and armed-approach risk remains elevated across the Gulf of Aden, Arabian Sea and western Indian Ocean.',
    impact: 'Use BMP procedures, reporting corridors and enhanced bridge watch throughout the exposed passage.'
  },
  {
    id: 'EVT_MOZAMBIQUE',
    name: 'Mozambique Channel squall corridor',
    region: 'Africa',
    position: [-18.0, 40.0],
    zoom: 5.2,
    type: 'Weather',
    riskLevel: 'Medium',
    asOf: 'July 2026 scenario',
    sourceLabel: 'TMPRM Indian Ocean weather scenario',
    summary: 'Strong cross-current, squall and visibility conditions create schedule and manoeuvring risk in the channel.',
    impact: 'Increase weather-routing margin and verify small-craft and coastal-security notices.'
  },
  {
    id: 'EVT_CAPE_GOOD_HOPE',
    name: 'Cape of Good Hope diversion pressure',
    region: 'Africa',
    position: [-35.0, 18.5],
    zoom: 6,
    type: 'Weather',
    riskLevel: 'High',
    asOf: 'July 2026 scenario',
    sourceLabel: 'TMPRM route-diversion and winter-swell scenario',
    summary: 'Cape-routing demand, winter swell and strong westerlies create delay, fuel-consumption and bunkering pressure around the Cape of Good Hope.',
    impact: 'Protect fuel margin, apply conservative weather routing, and confirm bunkering and berth availability before arrival.'
  },
  {
    id: 'EVT_AUSTRALIA',
    name: 'Bass Strait / Tasman winter gale',
    region: 'Australia',
    position: [-40.0, 147.0],
    zoom: 5.6,
    type: 'Weather',
    riskLevel: 'Medium',
    asOf: 'July 2026 scenario',
    sourceLabel: 'TMPRM Australian winter-weather scenario',
    summary: 'A winter low produces strong winds and rough seas around Bass Strait and the western Tasman approaches.',
    impact: 'Review coastal pilotage windows and allow additional schedule margin for exposed services.'
  },
  {
    id: 'EVT_SW_PACIFIC',
    name: 'South-West Pacific climate exposure',
    region: 'Pacific',
    position: [-18.0, 165.0],
    zoom: 5.2,
    type: 'Climate',
    riskLevel: 'Medium',
    asOf: '7 Jul 2026',
    sourceLabel: 'World Meteorological Organization regional context',
    summary: 'Ocean warming, marine heatwaves and sea-level exposure increase resilience risk for island and coastal port calls.',
    impact: 'Use wider weather buffers and continuity planning for exposed island supply chains.'
  },
  {
    id: 'EVT_MALACCA',
    name: 'Malacca Strait weather and queue risk',
    region: 'Asia',
    position: [4.2, 99.2],
    zoom: 6.5,
    type: 'Weather',
    riskLevel: 'High',
    asOf: 'Simulated 6-hour layer',
    sourceLabel: 'TMPRM classroom simulation',
    summary: 'Heavy rain cells and queueing pressure affect the primary Tuas approach corridor.',
    impact: 'Short-term delay risk for Singapore arrivals remains elevated in the active scenario.'
  },
  {
    id: 'EVT_TUAS',
    name: 'Tuas Mega Port berth pressure',
    region: 'Singapore',
    position: [1.255, 103.62],
    zoom: 12.5,
    type: 'Port',
    riskLevel: 'Medium',
    asOf: 'Simulated dashboard state',
    sourceLabel: 'TMPRM classroom simulation',
    summary: 'Simulated berth occupancy tightens priority-berthing decisions and increases queue sensitivity.',
    impact: 'Protect cold-chain and critical-value cargo first while rescheduling lower-priority arrivals.'
  }
]

export const NEWS_TICKER = [
  'SIMULATED DATA — Port, vessel, weather and shipment values are for university classroom demonstration only.',
  'Strait of Hormuz: tanker traffic slowed sharply after July attacks and renewed U.S.–Iran clashes; passage risk remains severe.',
  'Red Sea / Bab el-Mandeb: U.S. Maritime Advisory 2026-006 remains active for Houthi attack risk through September 2026.',
  'Black Sea / Sea of Azov: active military-combat advisory and July tanker attacks keep commercial-vessel risk severe.',
  'South-West Pacific: WMO highlights growing exposure from ocean warming, marine heatwaves and sea-level rise.',
  'Malacca Strait simulation: winds 42 kn, waves 4.8 m and visibility 1.8 km under the severe-weather scenario.',
  'Tuas Mega Port simulation: berth occupancy changes dynamically with the adjustable scenario control.',
  'BioHealth Pharma simulation: insulin stockout projected in 18h without SL TRADER priority berthing (SHP-2041).'
]

// ─── getSnapshot ──────────────────────────────────────────────────────────────
export function getSnapshot() {
  const weather = getWeather()
  const berthHistory = generateBerthHistory()
  const berthProjection = generateBerthProjection(berthHistory)
  const currentBerthOccupancy = _congestionForced
    ? _congestionLevel
    : berthHistory[berthHistory.length - 1].value
  const terminalOccupancy = getTerminalOccupancy()

  return {
    generatedAt: new Date().toISOString(),
    weather,
    berthHistory,
    berthProjection,
    shipments: SHIPMENTS,
    routes: ROUTES,
    portSummary: getPortSummary(currentBerthOccupancy),
    terminalOccupancy,
    orchestrationSignals: getOrchestrationSignals(weather, currentBerthOccupancy),
    currentDecision: { ...DEFAULT_DECISION },
    newsTicker: NEWS_TICKER,
    worldRiskEvents: WORLD_RISK_EVENTS,
    notes: [
      'All data is simulated for university prototype demonstration.',
      'Berth projection is a 3-hour moving-average heuristic, not a trained machine-learning model.'
    ]
  }
}
