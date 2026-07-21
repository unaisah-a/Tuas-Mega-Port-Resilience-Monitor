// MOCK snapshot data for the Tuas Mega Port Resilience Monitor.
// All values are simulated. The chatbot cites only this snapshot unless LIVE mode is explicitly labelled.

export const MODE = 'MOCK' // 'MOCK' | 'LIVE'

export const PORT = {
  name: 'Tuas Mega Port',
  berthsTotal: 8,
  berthsOccupied: 6,
  berthOccupancyPct: 72,
  avgWaitHours: 18.6,
  unloadingCapacityTEU: 2400,
  status: 'CONGESTED'
}

export const WEATHER = {
  strait: 'Malacca Strait',
  condition: 'Severe Thunderstorm',
  windKnots: 42,
  waveHeightM: 3.8,
  visibilityNm: 1.2,
  severity: 'HIGH',
  advisory: 'Gale warning active. Vessel movement restricted. Expect 18-30h transit delays.',
  forecast: [
    { t: 'Now', wind: 42, wave: 3.8 },
    { t: '+6h', wind: 38, wave: 3.5 },
    { t: '+12h', wind: 30, wave: 2.9 },
    { t: '+18h', wind: 24, wave: 2.2 },
    { t: '+24h', wind: 18, wave: 1.6 }
  ]
}

// Vessels plotted on the command map. x/y are % positions on the SVG canvas.
export const VESSELS = [
  {
    id: 'SL_TRADER',
    name: 'SL TRADER',
    type: 'Container',
    flag: 'Liberia',
    pos: { x: 62, y: 58 },
    etaHours: 6,
    teu: 8400,
    coldChain: true,
    cargo: 'Pharmaceuticals + Electronics',
    priority: 'CRITICAL',
    speedKnots: 14,
    status: 'Approaching',
    destination: 'Tuas Berth 3',
    riskScore: 78
  },
  {
    id: 'OCEAN_VEGA',
    name: 'OCEAN VEGA',
    type: 'Reefer',
    flag: 'Panama',
    pos: { x: 38, y: 42 },
    etaHours: 22,
    teu: 5200,
    coldChain: true,
    cargo: 'Frozen Seafood + Vaccines',
    priority: 'HIGH',
    speedKnots: 11,
    status: 'Holding',
    destination: 'Tuas Berth 5',
    riskScore: 64
  },
  {
    id: 'NORDIC_PEARL',
    name: 'NORDIC PEARL',
    type: 'Bulk Carrier',
    flag: 'Singapore',
    pos: { x: 48, y: 30 },
    etaHours: 30,
    teu: 0,
    dwt: 82000,
    coldChain: false,
    cargo: 'Iron Ore',
    priority: 'MEDIUM',
    speedKnots: 9,
    status: 'Reroute Candidate',
    destination: 'Tuas Berth 7',
    riskScore: 41
  },
  {
    id: 'PACIFIC_DAWN',
    name: 'PACIFIC DAWN',
    type: 'Tanker',
    flag: 'Marshall Islands',
    pos: { x: 74, y: 70 },
    etaHours: 12,
    teu: 0,
    dwt: 64000,
    coldChain: false,
    cargo: 'LNG',
    priority: 'MEDIUM',
    speedKnots: 13,
    status: 'On Schedule',
    destination: 'Tuas Berth 2',
    riskScore: 35
  },
  {
    id: 'MERIDIAN_STAR',
    name: 'MERIDIAN STAR',
    type: 'Container',
    flag: 'Hong Kong',
    pos: { x: 28, y: 64 },
    etaHours: 4,
    teu: 6100,
    coldChain: false,
    cargo: 'Consumer Goods',
    priority: 'LOW',
    speedKnots: 16,
    status: 'Berthing',
    destination: 'Tuas Berth 1',
    riskScore: 22
  }
]

export const BERTHS = [
  { id: 'B1', name: 'Berth 1', vessel: 'MERIDIAN STAR', occupancy: 92, status: 'Loading' },
  { id: 'B2', name: 'Berth 2', vessel: '—', occupancy: 0, status: 'Free' },
  { id: 'B3', name: 'Berth 3', vessel: '—', occupancy: 0, status: 'Reserved (SL TRADER)' },
  { id: 'B4', name: 'Berth 4', vessel: 'ATLAS V', occupancy: 78, status: 'Unloading' },
  { id: 'B5', name: 'Berth 5', vessel: '—', occupancy: 0, status: 'Free' },
  { id: 'B6', name: 'Berth 6', vessel: 'KAIROS', occupancy: 65, status: 'Unloading' },
  { id: 'B7', name: 'Berth 7', vessel: '—', occupancy: 0, status: 'Maintenance' },
  { id: 'B8', name: 'Berth 8', vessel: 'HORIZON', occupancy: 88, status: 'Loading' }
]

export const SHIPMENTS = [
  {
    id: 'SHP-2041',
    vessel: 'SL TRADER',
    cargo: 'Pharmaceuticals (Insulin, Vaccines)',
    coldChain: true,
    priority: 'CRITICAL',
    valueUsd: 4200000,
    etaHours: 6,
    tempC: 2.4,
    tempTarget: '2-8°C',
    tempStatus: 'OK',
    inventoryRisk: 'Stockout in 18h',
    customer: 'BioHealth Pharma',
    escalation: 'Active — Director notified',
    route: 'Rotterdam → Singapore (via Suez)',
    co2Kg: 412000,
    costUsd: 285000
  },
  {
    id: 'SHP-2042',
    vessel: 'OCEAN VEGA',
    cargo: 'Frozen Seafood + Vaccine reefer',
    coldChain: true,
    priority: 'HIGH',
    valueUsd: 1850000,
    etaHours: 22,
    tempC: -18.1,
    tempTarget: '-20°C',
    tempStatus: 'OK',
    inventoryRisk: 'Stockout in 36h',
    customer: 'AsiaCold Logistics',
    escalation: 'Monitoring',
    route: 'Oslo → Singapore',
    co2Kg: 298000,
    costUsd: 198000
  },
  {
    id: 'SHP-2043',
    vessel: 'NORDIC PEARL',
    cargo: 'Iron Ore',
    coldChain: false,
    priority: 'MEDIUM',
    valueUsd: 640000,
    etaHours: 30,
    tempC: null,
    tempTarget: 'N/A',
    tempStatus: 'N/A',
    inventoryRisk: 'Buffer 9 days',
    customer: 'SG Steel Mills',
    escalation: 'None',
    route: 'Port Hedland → Singapore',
    co2Kg: 521000,
    costUsd: 142000
  },
  {
    id: 'SHP-2044',
    vessel: 'PACIFIC DAWN',
    cargo: 'LNG',
    coldChain: false,
    priority: 'MEDIUM',
    valueUsd: 980000,
    etaHours: 12,
    tempC: null,
    tempTarget: 'N/A',
    tempStatus: 'N/A',
    inventoryRisk: 'Buffer 4 days',
    customer: 'EnergyCo',
    escalation: 'None',
    route: 'Doha → Singapore',
    co2Kg: 388000,
    costUsd: 176000
  },
  {
    id: 'SHP-2045',
    vessel: 'MERIDIAN STAR',
    cargo: 'Consumer Electronics',
    coldChain: false,
    priority: 'LOW',
    valueUsd: 520000,
    etaHours: 4,
    tempC: null,
    tempTarget: 'N/A',
    tempStatus: 'N/A',
    inventoryRisk: 'Buffer 14 days',
    customer: 'RetailMart',
    escalation: 'None',
    route: 'Shenzhen → Singapore',
    co2Kg: 164000,
    costUsd: 88000
  }
]

export const ROUTES = [
  {
    id: 'R1',
    name: 'Malacca Strait (Primary)',
    congestionPct: 82,
    delayHours: 18,
    riskLevel: 'HIGH',
    notes: 'Gale warning. 3 vessels holding.'
  },
  {
    id: 'R2',
    name: 'Sunda Strait (Alternate)',
    congestionPct: 35,
    delayHours: 6,
    riskLevel: 'MEDIUM',
    notes: '+34h detour. Calmer seas.'
  },
  {
    id: 'R3',
    name: 'Lombok Strait (Deep Alternate)',
    congestionPct: 18,
    delayHours: 2,
    riskLevel: 'LOW',
    notes: '+58h detour. Higher CO2.'
  }
]

export const NEWS_TICKER = [
  'Malacca Strait: Gale warning issued — winds 42kn, waves 3.8m',
  'Tuas Port: Berth 7 maintenance window extended 12h',
  'BioHealth Pharma: Insulin stockout projected in 18h without SL TRADER berth',
  'Regional: Jakarta port congestion spilling over — 6 vessels diverted to Singapore',
  'Market: Bunker fuel prices up 4.2% week-on-week',
  'Weather: Storm system expected to clear Malacca corridor in 24-30h',
  'Vessel: OCEAN VEGA holding at anchorage — reefer temp stable at -18.1°C',
  'Advisory: IMO MARPOL emissions tightening effective next quarter'
]

export const LEGEND = [
  { color: '#ef4444', label: 'High Risk / Critical' },
  { color: '#f58220', label: 'Medium Risk / Hold' },
  { color: '#22c55e', label: 'Low Risk / Nominal' },
  { color: '#5fb0d8', label: 'Vessel / Route' }
]
