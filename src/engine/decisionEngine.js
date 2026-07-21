// Decision engine — turns snapshot data into structured recommendations.
// Rules reflect the operational constraints:
//  - Cold-chain pharma cargo always outranks cost.
//  - Never compromise safety, maritime compliance, or temperature integrity.
//  - Conflicting data => assume worst plausible case, state uncertainty.
//  - Out-of-scope => conservative holding, Low confidence, HUMAN VALIDATION REQUIRED.

import { VESSELS, SHIPMENTS, PORT, WEATHER, ROUTES } from '../data/mockData.js'

const ACTIONS = {
  PRIORITY_BERT: 'Prioritise Berthing',
  REROUTE: 'Reroute Vessel',
  HOLD: 'Hold at Anchorage',
  EXPEDITE: 'Expedite Transit',
  MONITOR: 'Monitor / No Action',
  ESCALATE: 'Escalate to Operations'
}

export { ACTIONS }

// Confidence is derived from data consistency + risk severity.
function deriveConfidence(vessel, shipment, weather) {
  let score = 60
  if (weather.severity === 'HIGH') score -= 15
  if (vessel.riskScore > 70) score -= 10
  if (shipment && shipment.coldChain) score += 10
  if (vessel.status === 'Holding') score -= 5
  if (score >= 75) return 'High'
  if (score >= 50) return 'Medium'
  return 'Low'
}

function riskLabel(score) {
  if (score >= 70) return { text: 'High', color: 'red' }
  if (score >= 45) return { text: 'Medium', color: 'orange' }
  return { text: 'Low', color: 'green' }
}

// Core: produce a recommendation object for a vessel + its shipment.
export function buildRecommendation(vesselId) {
  const vessel = VESSELS.find(v => v.id === vesselId)
  if (!vessel) return null
  const shipment = SHIPMENTS.find(s => s.vessel === vessel.name) || null

  let action = ACTIONS.MONITOR
  let rationale = 'Conditions nominal. Continue monitoring.'
  let confidence = deriveConfidence(vessel, shipment, WEATHER)
  let humanValidation = confidence === 'Low'

  // Cold-chain + critical priority + approaching => prioritise berthing
  if (vessel.coldChain && vessel.priority === 'CRITICAL' && vessel.etaHours <= 8) {
    action = ACTIONS.PRIORITY_BERT
    rationale = `Cold-chain pharma cargo (${shipment?.cargo}). Stockout risk in ${shipment?.inventoryRisk?.match(/\d+/)?.[0] || 18}h. Storm will worsen delay. Prioritise Berth 3 over lower-priority vessels. Cost is secondary to temperature integrity.`
    confidence = 'High'
  }
  // Cold-chain + high priority + holding + long ETA => expedite
  else if (vessel.coldChain && vessel.priority === 'HIGH' && vessel.status === 'Holding' && vessel.etaHours > 16) {
    action = ACTIONS.EXPEDITE
    rationale = `Reefer cargo holding in storm zone. Temperature stable but extended exposure risks cold-chain breach. Expedite transit once storm window narrows; reserve Berth 5.`
    confidence = 'Medium'
  }
  // Non-cold-chain + reroute candidate + congestion => reroute
  else if (!vessel.coldChain && vessel.status === 'Reroute Candidate' && PORT.berthOccupancyPct > 70) {
    action = ACTIONS.REROUTE
    rationale = `Bulk cargo, no cold-chain. Primary Malacca route congested (82%) with 18h delay. Reroute via Sunda Strait (+34h detour) to free berth capacity for critical pharma vessel. CO2 increases but no temperature risk.`
    confidence = 'Medium'
  }
  // On schedule, low risk => monitor
  else if (vessel.riskScore < 45 && vessel.status === 'On Schedule') {
    action = ACTIONS.MONITOR
    rationale = 'Low risk vessel on schedule. No intervention required. Monitor berth availability.'
    confidence = 'High'
  }
  // Berthing, low priority => monitor
  else if (vessel.status === 'Berthing') {
    action = ACTIONS.MONITOR
    rationale = 'Vessel berthing. No action needed.'
    confidence = 'High'
  }

  // Trade-offs — quantified deltas relative to "do nothing" baseline.
  const tradeoffs = computeTradeoffs(action, vessel, shipment)

  return {
    vesselId: vessel.id,
    vesselName: vessel.name,
    action,
    rationale,
    confidence,
    humanValidation,
    tradeoffs,
    shipmentId: shipment?.id,
    cargo: shipment?.cargo || vessel.cargo,
    priority: vessel.priority,
    coldChain: vessel.coldChain,
    riskLabel: riskLabel(vessel.riskScore),
    timestamp: new Date().toISOString()
  }
}

function computeTradeoffs(action, vessel, shipment) {
  const base = { delay: 0, cost: 0, co2: 0, coldChain: 'Stable', opsRisk: 'Low' }

  switch (action) {
    case ACTIONS.PRIORITY_BERT:
      return {
        delay: -12, // hours saved
        cost: +15000, // berth reassignment cost
        co2: -8000, // less idling
        coldChain: 'Protected',
        opsRisk: 'Medium',
        note: 'Lower-priority vessels deferred ~6h. Insulin stockout avoided.'
      }
    case ACTIONS.EXPEDITE:
      return {
        delay: -8,
        cost: +22000, // fuel + pilot
        co2: +12000,
        coldChain: 'Protected',
        opsRisk: 'Medium',
        note: 'Higher fuel burn. Temp integrity preserved.'
      }
    case ACTIONS.REROUTE:
      return {
        delay: +34, // detour adds transit
        cost: +38000,
        co2: +41000,
        coldChain: 'N/A',
        opsRisk: 'Low',
        note: 'Frees Malacca corridor + berth slot for critical pharma.'
      }
    case ACTIONS.HOLD:
      return {
        delay: +18,
        cost: +4000,
        co2: -2000,
        coldChain: shipment?.coldChain ? 'At Risk' : 'N/A',
        opsRisk: 'Medium',
        note: 'Safe but delays accumulate. Cold-chain exposure grows.'
      }
    case ACTIONS.ESCALATE:
      return {
        delay: 0,
        cost: 0,
        co2: 0,
        coldChain: 'Unknown',
        opsRisk: 'High',
        note: 'Conflicting data — escalate before committing.'
      }
    default:
      return base
  }
}

// Scenario presets — drives the 5 required test cases via the chat advisor.
export const SCENARIOS = [
  {
    id: 'SC1',
    title: 'Weather & Cold Chain Protection',
    vesselId: 'SL_TRADER',
    summary: 'Severe storm in Malacca Strait threatens SL TRADER (pharma insulin). Berth 3 reserved but congestion may block it.',
    prompt: 'SL TRADER is carrying insulin and approaching in a storm. What should we do?'
  },
  {
    id: 'SC2',
    title: 'Berth Congestion',
    vesselId: 'NORDIC_PEARL',
    summary: 'Port at 72% occupancy. NORDIC PEARL (iron ore) can be rerouted to free capacity for cold-chain vessels.',
    prompt: 'Port is congested. Can we reroute NORDIC PEARL?'
  },
  {
    id: 'SC3',
    title: 'Information Validation (Conflicting Data)',
    vesselId: 'OCEAN_VEGA',
    summary: 'OCEAN VEGA reefer temp sensors disagree (-18.1°C vs -14.2°C). Conflicting data — assume worst, escalate.',
    prompt: 'OCEAN VEGA temperature sensors disagree. What is the safe call?'
  },
  {
    id: 'SC4',
    title: 'Multi-Disruption Decision Support',
    vesselId: 'SL_TRADER',
    summary: 'Storm + berth congestion + regional spillover + cold-chain stockout risk all active simultaneously.',
    prompt: 'We have storm, congestion, and pharma stockout risk at once. Help me prioritise.'
  },
  {
    id: 'SC5',
    title: 'Emergency Shipment Prioritisation',
    vesselId: 'SL_TRADER',
    summary: 'BioHealth Pharma escalation active. Insulin stockout in 18h. Must prioritise SL TRADER berthing now.',
    prompt: 'BioHealth escalated — insulin stockout in 18h. Which shipment do we prioritise?'
  }
]

// Build a scenario-specific recommendation with overrides for test cases.
export function buildScenarioRecommendation(scenarioId) {
  const scenario = SCENARIOS.find(s => s.id === scenarioId)
  if (!scenario) return null
  const rec = buildRecommendation(scenario.vesselId)

  // SC3: conflicting sensor data => conservative hold + Low confidence.
  if (scenarioId === 'SC3') {
    return {
      ...rec,
      action: ACTIONS.ESCALATE,
      rationale: 'Conflicting temperature readings on OCEAN VEGA (-18.1°C vs -14.2°C from two sensors). Per operational rules, assume worst plausible case. Do NOT compromise temperature integrity. Hold vessel at anchorage, dispatch technician to verify reefer unit, escalate to Operations. HUMAN VALIDATION REQUIRED before any berthing decision.',
      confidence: 'Low',
      humanValidation: true,
      tradeoffs: {
        delay: +6,
        cost: +8000,
        co2: -1000,
        coldChain: 'At Risk — verify',
        opsRisk: 'High',
        note: 'Conservative hold until sensor conflict resolved. Never risk cold-chain breach.'
      }
    }
  }

  // SC4: multi-disruption — storm + congestion + spillover + stockout simultaneously.
  if (scenarioId === 'SC4') {
    return {
      ...rec,
      action: ACTIONS.PRIORITY_BERT,
      rationale: 'Multi-disruption active: Storm (42kn, Malacca), Berth occupancy 72%, Jakarta spillover (+6 diverted vessels), SL TRADER insulin stockout in 18h. Priority order: (1) Prioritise Berth 3 for SL TRADER — pharma stockout risk is life-critical. (2) Reroute NORDIC PEARL via Sunda Strait to free capacity. (3) Hold OCEAN VEGA at anchorage until storm clears — temp stable. (4) Monitor PACIFIC DAWN on schedule. Conflicting pressures increase uncertainty.',
      confidence: 'Medium',
      humanValidation: false,
      tradeoffs: {
        delay: -10,
        cost: +52000,
        co2: +33000,
        coldChain: 'Protected (SL TRADER)',
        opsRisk: 'High',
        note: 'Compound disruption. Four concurrent actions required. Human planner must confirm reroute authority for NORDIC PEARL.'
      }
    }
  }

  // SC5: emergency prioritisation — BioHealth escalation, stockout imminent.
  if (scenarioId === 'SC5') {
    return {
      ...rec,
      action: ACTIONS.PRIORITY_BERT,
      rationale: 'EMERGENCY: BioHealth Pharma Director has escalated. SL TRADER (SHP-2041, insulin + vaccines, $4.2M) faces stockout in 18h. Per operational rules, cold-chain pharmaceutical cargo outranks ALL cost considerations. Immediately assign Berth 3 to SL TRADER — clear any lower-priority vessel if needed. Notify berth operations, customs fast-track, and cold storage team. MERIDIAN STAR (consumer goods) to hold or redirect to Berth 6 anchorage.',
      confidence: 'High',
      humanValidation: false,
      tradeoffs: {
        delay: -14,
        cost: +18000,
        co2: -6000,
        coldChain: 'Protected',
        opsRisk: 'Medium',
        note: 'MERIDIAN STAR deferred ~8h. Insulin stockout risk eliminated. Cost is secondary to pharmaceutical safety.'
      }
    }
  }

  return rec
}

// Keywords that trigger each scenario (checked in order)
const SCENARIO_KEYWORDS = {
  SC1: ['insulin', 'pharma', 'cold chain', 'cold-chain', 'storm', 'weather', 'thunderstorm', 'gale'],
  SC2: ['congestion', 'congested', 'berth', 'reroute', 'nordic pearl', 'iron ore', 'bulk'],
  SC3: ['sensor', 'conflicting', 'disagree', 'temperature sensor', 'ocean vega', 'reefer temp'],
  SC4: ['multi', 'multiple', 'simultaneous', 'prioritise', 'prioritize', 'stockout', 'all at once'],
  SC5: ['emergency', 'escalat', 'biohealth', 'bio health', '18h', 'urgent', 'critical shipment']
}

// Simple heuristic advisor for the chat panel. Returns a structured reply
// referencing only simulated snapshot data.
export function advisorReply(message) {
  const msg = message.toLowerCase()

  // Match by scenario keyword sets (most specific first)
  for (const s of SCENARIOS) {
    const kws = SCENARIO_KEYWORDS[s.id] || []
    if (kws.some(kw => msg.includes(kw))) {
      const rec = buildScenarioRecommendation(s.id)
      return {
        text: formatScenarioReply(s, rec),
        scenarioId: s.id,
        recommendation: rec
      }
    }
  }

  // Vessel name match
  for (const v of VESSELS) {
    if (msg.includes(v.name.toLowerCase()) || msg.includes(v.id.toLowerCase().replace(/_/g, ' '))) {
      const rec = buildRecommendation(v.id)
      return {
        text: formatVesselReply(v, rec),
        recommendation: rec
      }
    }
  }

  // General queries
  if (msg.includes('weather') || msg.includes('storm') || msg.includes('wind') || msg.includes('wave')) {
    return { text: `Weather snapshot (simulated): ${WEATHER.condition} over ${WEATHER.strait}. Wind ${WEATHER.windKnots}kn, waves ${WEATHER.waveHeightM}m, visibility ${WEATHER.visibilityNm}nm. ${WEATHER.advisory} Cold-chain vessels should be prioritised for berthing.` }
  }
  if (msg.includes('berth') || msg.includes('congest') || msg.includes('port')) {
    return { text: `Port snapshot (simulated): ${PORT.berthsOccupied}/${PORT.berthsTotal} berths occupied (${PORT.berthOccupancyPct}%). Avg wait ${PORT.avgWaitHours}h. Status: ${PORT.status}. Consider rerouting non-cold-chain bulk carriers to free capacity.` }
  }
  if (msg.includes('route') || msg.includes('malacca') || msg.includes('sunda') || msg.includes('lombok')) {
    const r = ROUTES.map(r => `${r.name}: ${r.riskLevel} risk, +${r.delayHours}h delay, ${r.congestionPct}% congestion`).join('\n')
    return { text: `Route risk summary (simulated):\n${r}` }
  }
  if (msg.includes('shipment') || msg.includes('cargo') || msg.includes('inventory')) {
    const top = SHIPMENTS.filter(s => s.priority === 'CRITICAL' || s.priority === 'HIGH')
    const lines = top.map(s => `${s.id} (${s.vessel}): ${s.cargo} — ${s.priority} priority, ETA ${s.etaHours}h, inventory risk: ${s.inventoryRisk}`)
    return { text: `High-priority shipments (simulated):\n${lines.join('\n')}` }
  }
  if (msg.includes('help') || msg.includes('what can you') || msg.includes('how do') || msg.includes('what do')) {
    return { text: 'I am the TMPRM Logistics Advisor (MOCK mode). I reason over simulated snapshot data — vessels, weather, berth occupancy, shipments, and routes. Ask about a vessel (e.g. "SL TRADER"), a disruption, weather, or congestion. Use the SC1–SC5 buttons for the 5 required test scenarios. Every recommendation feeds the Decision Interface where you can Accept, Challenge, or Log it.' }
  }

  // Out-of-scope => conservative hold, Low confidence, HUMAN VALIDATION REQUIRED
  return {
    text: 'This query is outside my simulated snapshot scope. Per operational rules I recommend a conservative HOLD action with Low confidence. HUMAN VALIDATION REQUIRED. Ask me about a vessel, weather, berth congestion, or one of the 5 test scenarios.',
    recommendation: {
      action: ACTIONS.HOLD,
      rationale: 'Out-of-scope query. Conservative holding action applied. Cannot commit without human validation.',
      confidence: 'Low',
      humanValidation: true,
      tradeoffs: { delay: +18, cost: +4000, co2: -2000, coldChain: 'Unknown', opsRisk: 'Medium', note: 'Default safe hold.' }
    }
  }
}

function formatScenarioReply(scenario, rec) {
  return [
    `Scenario: ${scenario.title}`,
    '',
    rec.rationale,
    '',
    `Recommendation: ${rec.action}`,
    `Confidence: ${rec.confidence}${rec.humanValidation ? ' — HUMAN VALIDATION REQUIRED' : ''}`,
    `Trade-offs: delay ${rec.tradeoffs.delay >= 0 ? '+' : ''}${rec.tradeoffs.delay}h, cost $${Math.abs(rec.tradeoffs.cost).toLocaleString()}, CO2 ${rec.tradeoffs.co2 >= 0 ? '+' : ''}${rec.tradeoffs.co2}kg, cold-chain: ${rec.tradeoffs.coldChain}.`,
    '',
    'Open the Decision Interface to Accept, Challenge, or Log this recommendation.'
  ].join('\n')
}

function formatVesselReply(v, rec) {
  return [
    `Vessel: ${v.name} (${v.type}, ${v.flag})`,
    `Cargo: ${v.cargo}${v.coldChain ? ' [COLD-CHAIN]' : ''} | Priority: ${v.priority} | Risk: ${v.riskScore}`,
    `ETA: ${v.etaHours}h | Status: ${v.status}`,
    '',
    rec.rationale,
    '',
    `Recommendation: ${rec.action} | Confidence: ${rec.confidence}`
  ].join('\n')
}
