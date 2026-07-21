// src/agent/mockBrain.js
// Deterministic MOCK advisor. No API calls. Uses current simulated snapshot only.
//
// This brain does not send the system prompt anywhere — there is no model to
// send it to. Instead it ENFORCES THE SAME RULES IN CODE: the domain boundary
// below is the executable counterpart of the "STAY INSIDE THE DOMAIN"
// constraint in src/agent/prompts/constraints.js, and the four-view response
// shape mirrors the output contract in prompts/style.js. Both brains therefore
// behave the same way; only the mechanism differs.

import { getSnapshot } from '../data/simulation.js'

// ─── Domain boundary (mirrors prompts/constraints.js rule 5) ─────────────────
// Vocabulary that marks a question as maritime / port / supply-chain related.
const DOMAIN_TERMS = [
  'port', 'tuas', 'berth', 'terminal', 'vessel', 'ship', 'shipment', 'cargo', 'container',
  'eta', 'delay', 'delays', 'arrival', 'departure', 'anchorage', 'unload', 'load', 'teu',
  'route', 'reroute', 'rerouting', 'malacca', 'sunda', 'lombok', 'strait', 'transit', 'voyage',
  'weather', 'storm', 'wind', 'wave', 'visibility', 'gale', 'typhoon', 'monsoon',
  'congestion', 'occupancy', 'queue', 'dwell', 'turnaround',
  'cold-chain', 'cold chain', 'coldchain', 'reefer', 'pharma', 'pharmaceutical', 'temperature',
  'inventory', 'stock', 'stockout', 'safety stock', 'buffer', 'replenish',
  'supplier', 'procurement', 'expedite', 'carrier', 'customer', 'escalate', 'escalation',
  'disruption', 'risk', 'mitigation', 'contingency', 'resilience', 'supply chain', 'logistics',
  'co2', 'carbon', 'emission', 'cost', 'freight', 'air freight', 'maritime',
  'shp-', 'confidence', 'recommend', 'decision', 'validation', 'operations', 'operational'
]

// Greetings and "what can you do" are neither out-of-domain nor operational
// questions — they get a short capability answer instead of a refusal.
const GREETING_TERMS = ['hello', 'hi ', 'hey', 'good morning', 'good afternoon', 'good evening',
  'what can you', 'what do you do', 'who are you', 'help me', 'how do i use', 'what can i ask']

function isGreeting(msg) {
  const m = msg.trim()
  if (['hi', 'hello', 'hey', 'yo'].includes(m)) return true
  return GREETING_TERMS.some(t => m.includes(t))
}

function greetingResponse(snap) {
  const ps = snap.portSummary
  return {
    sections: {
      orchestrator: [
        `Tuas Mega Port operations advisor, ready. Current status: berth occupancy ${ps.berthOccupancy}%, Malacca Strait risk ${snap.weather.riskLevel}, ${ps.highRiskShipments} high-risk shipments of ${snap.shipments.length} tracked.`,
        'I can assess vessel and shipment risk, explain berth and terminal congestion, compare Malacca/Sunda/Lombok routing trade-offs, flag cold-chain exposure, and recommend mitigations during disruptions.',
        'Every recommendation I give is a proposal for your validation — I have no authority to execute anything.'
      ]
    },
    plain: 'Tuas Mega Port operations advisor, ready. Ask about port status, vessel risk, routing options, weather, cold-chain exposure, or disruption mitigation.',
    confidence: 'High',
    humanValidationRequired: false,
    decision: decision({
      action: 'Awaiting operational query.',
      recommendation: 'Advisor online. No operational action pending.',
      confidence: 'High', risk: 'Low',
      dataUsed: [`berthOccupancy ${ps.berthOccupancy}%`, `weather ${snap.weather.riskLevel}`]
    }),
    dataUsed: [`berthOccupancy ${ps.berthOccupancy}%`, `weather.riskLevel ${snap.weather.riskLevel}`],
    source: 'MOCK'
  }
}

function isInDomain(msg, snap) {
  if (DOMAIN_TERMS.some(t => msg.includes(t))) return true
  // A bare vessel name or shipment ID is in-domain even without other keywords.
  return snap.shipments.some(s => msg.includes(s.id.toLowerCase()) || msg.includes(s.vessel.toLowerCase()))
}

// Out-of-domain reply: decline, state the domain, redirect. No fabrication,
// no four-view structure, no invented confidence in an unrelated answer.
function outOfDomainResponse() {
  return {
    sections: {
      orchestrator: [
        'That question is outside my operational domain, so I will not answer it.',
        'I am the Tuas Mega Port operations advisor. I cover port and terminal status, vessel movements and ETAs, Malacca/Sunda/Lombok routing, maritime weather, cold-chain and inventory risk, and procurement actions during disruptions.',
        'Ask me something in that scope — for example, current berth occupancy, which shipments are high risk, or how to reroute a cold-chain vessel during a storm.'
      ]
    },
    plain: 'That question is outside my operational domain. I am the Tuas Mega Port operations advisor — ask me about port status, vessel risk, routing, weather, cold-chain, or disruption mitigation.',
    confidence: 'Low',
    humanValidationRequired: false,
    outOfDomain: true,
    decision: decision({
      action: 'No operational action — question outside scope.',
      recommendation: 'Query declined: outside the maritime logistics domain. No operational data was used and none was invented.',
      confidence: 'Low',
      humanValidation: false,
      risk: 'Low',
      dataUsed: ['No snapshot data used — out-of-domain query declined']
    }),
    dataUsed: ['No snapshot data used — out-of-domain query declined'],
    source: 'MOCK'
  }
}

function decision({ action, recommendation, confidence = 'Medium', humanValidation = false, delay = null, cost = null, co2 = null, coldChainSafe = null, risk = 'Medium', dataUsed = [] }) {
  return {
    recommendation,
    selectedAction: action,
    confidence,
    humanValidationRequired: humanValidation || confidence === 'Low',
    tradeoffs: { delay, cost, co2, coldChainSafe, risk },
    dataUsed
  }
}

function response({ logistics, inventory, procurement, orchestrator, confidence = 'Medium', humanValidationRequired = false, decision }) {
  return {
    sections: { logistics, inventory, procurement, orchestrator },
    confidence,
    humanValidationRequired: humanValidationRequired || confidence === 'Low',
    decision,
    source: 'MOCK'
  }
}

function key(msg, words) { return words.some(w => msg.includes(w)) }
function highTerminals(snap) { return (snap.terminalOccupancy || []).filter(t => ['High', 'Severe'].includes(t.riskLevel)) }
function pharma(snap) { return snap.shipments.filter(s => s.isColdChain && s.temperatureRange === '2-8 C') }
function route(snap, id) { return snap.routes.find(r => r.id === id) }

function tcWeatherColdChain(snap) {
  const p = pharma(snap)
  const w = snap.weather
  const sunda = route(snap, 'R_SUNDA')
  const air = route(snap, 'R_AIR')
  const dataUsed = [
    `Weather ${w.stormProbability}% storm probability, ${w.windKts}kn wind, ${w.waveM}m waves`,
    `${p.map(s => `${s.id} ${s.vessel} ${s.temperatureRange}`).join('; ')}`,
    `Sunda +${sunda.deltaDays} days, cost index ${sunda.costIndex}, CO2 index ${sunda.co2Index}`,
    `Partial air freight ${air.deltaDays} days, cost index ${air.costIndex}, CO2 index ${air.co2Index}`
  ]
  const d = decision({
    action: 'Protect cold-chain shipment; prepare Sunda reroute and partial air freight if 48h delay persists.',
    recommendation: 'Classify the pharmaceutical vessel as High Risk. Protect 2-8°C integrity first, then choose the lowest-risk movement plan.',
    confidence: 'High', delay: 48, cost: 340, co2: 610, coldChainSafe: true, risk: 'High', dataUsed
  })
  return response({
    logistics: [
      `Malacca route is exposed to severe weather: ${w.conditionLabel}, storm probability ${w.stormProbability}%. A 48h arrival delay creates High Risk for pharma cargo.`,
      `Sunda is the preferred sea contingency because it avoids the Malacca disruption, although it adds ${sunda.deltaDays} days.`
    ],
    inventory: [
      `The affected pharma shipments are ${p.map(s => `${s.id} (${s.vessel})`).join(' and ')} at 2-8°C. Cold-chain integrity outranks cost.`,
      'Release buffer/safety stock and monitor reefer telemetry until discharge is confirmed.'
    ],
    procurement: [
      'Notify supplier, carrier, receiving cold-room team, and customer immediately.',
      `If the delay threatens the service window, use partial air freight for the most critical pharma units despite cost index ${air.costIndex}.`
    ],
    orchestrator: [
      'Recommendation: keep reefer monitoring active, prepare Sunda reroute, and air-freight critical pharma units if the 48h delay remains likely.',
      'Decision trade-off: higher cost and CO2 are accepted because cold-chain integrity outranks cost.'
    ],
    confidence: 'High', decision: d
  })
}

function tcBerthCongestion(snap) {
  const ps = snap.portSummary
  const highs = highTerminals(snap)
  const p = pharma(snap)
  const terminalText = highs.length ? highs.map(t => `${t.terminalId} ${t.occupancyPercent}%`).join(', ') : 'no terminal above 85%'
  const dataUsed = [
    `Berth occupancy ${ps.berthOccupancy}%`,
    `High/severe terminals: ${terminalText}`,
    `Cold-chain pharma: ${p.map(s => s.id).join(', ')}`
  ]
  const d = decision({
    action: 'Prioritise critical/cold-chain cargo; smooth ETAs; reschedule routine arrivals.',
    recommendation: 'Treat 92% berth occupancy as high congestion and activate the priority berthing playbook.',
    confidence: 'High', delay: 18, cost: 18000, co2: 0, coldChainSafe: true, risk: 'High', dataUsed
  })
  return response({
    logistics: [
      `${ps.berthOccupancy}% berth occupancy is High/Severe congestion. Terminal pressure is concentrated at ${terminalText}.`,
      'Operational impact: queueing delay, dwell-time increase, and possible missed transshipment windows.'
    ],
    inventory: [
      `Unload critical cold-chain first: ${p.map(s => `${s.id} ${s.vessel}`).join('; ')}.`,
      'Routine cargo with inventory buffer can be delayed 12-24h with lower service impact.'
    ],
    procurement: [
      'Notify carriers of revised arrival windows and request ETA smoothing before vessels reach anchorage.',
      'Tell customers with critical cargo that priority discharge is being activated.'
    ],
    orchestrator: [
      'Recommendation: optimise berth allocation, unload pharma/critical cargo first, and reschedule lower-priority arrivals.',
      'Use terminal-level occupancy to move suitable cargo away from High/Severe terminals where possible.'
    ],
    confidence: 'High', decision: d
  })
}

function tcConflictingInfo(snap) {
  const w = snap.weather
  const ps = snap.portSummary
  const sunda = route(snap, 'R_SUNDA')
  const dataUsed = [`Weather ${w.riskLevel}`, `Berth occupancy ${ps.berthOccupancy}%`, `Sunda +${sunda.deltaDays} days`]
  const d = decision({
    action: 'Validate berth slot first; prepare Sunda contingency but do not reroute yet.',
    recommendation: 'Conflicting data requires conservative validation before rerouting.',
    confidence: 'Medium', humanValidation: true, delay: 4, cost: 0, co2: 0, coldChainSafe: true, risk: 'Medium', dataUsed
  })
  return response({
    logistics: [
      `Conflict detected: weather is ${w.riskLevel}, but port congestion is reported severe at ${ps.berthOccupancy}%.`,
      `Do not reroute solely on this conflict. Sunda adds ${sunda.deltaDays} days, so execute only after berth-window validation.`
    ],
    inventory: [
      'Keep cold-chain and critical inventory on watch; do not add unnecessary route delay unless berth delay is confirmed.',
      'Prepare buffer stock release only if the berth delay exceeds the safe service window.'
    ],
    procurement: [
      'Ask carrier/terminal for confirmed berth slot and queue position before notifying customers of reroute.',
      'Prepare reroute paperwork as contingency, not as immediate execution.'
    ],
    orchestrator: [
      'Recommendation: validate berth slot, slow-steam if needed, and keep Sunda as a contingency.',
      'HUMAN VALIDATION REQUIRED if port data remains inconsistent or impacts cold-chain cargo.'
    ],
    confidence: 'Medium', humanValidationRequired: true, decision: d
  })
}

function tcMultiDisruption(snap) {
  const gs = snap.newsTicker.find(n => n.includes('GOLDEN STAR 1')) || 'GOLDEN STAR 1 incident appears only as simulated scenario data.'
  const sunda = route(snap, 'R_SUNDA')
  const p = pharma(snap)
  const dataUsed = [`News: ${gs}`, `Sunda +${sunda.deltaDays} days`, `Cold-chain: ${p.map(s => s.id).join(', ')}`]
  const d = decision({
    action: 'Maintain Malacca watch; prioritise cold-chain cargo; prepare Sunda contingency.',
    recommendation: 'Do not overreact to one regional incident; use contingency planning and priority protection.',
    confidence: 'Medium', humanValidation: true, delay: 2, cost: 118, co2: 115, coldChainSafe: true, risk: 'Medium', dataUsed
  })
  return response({
    logistics: [
      'This is a multi-disruption watch: Red Sea/Hormuz spillover may add pressure, while Malaysian congestion is described as manageable.',
      `GOLDEN STAR 1 is treated as simulated regional incident data: ${gs}`
    ],
    inventory: [
      `Protect critical pharma first: ${p.map(s => `${s.id} ${s.vessel}`).join('; ')}.`,
      'Hold routine cargo decisions until port impact is confirmed.'
    ],
    procurement: [
      'Prepare customer advisory for critical shipments only; avoid broad escalation until congestion impact is verified.',
      'Request carriers to confirm ETA, berth slot, and any Batam-area slow-zone impact.'
    ],
    orchestrator: [
      `Recommendation: keep Malacca under watch, protect cold-chain/high-value shipments, and prepare Sunda contingency (+${sunda.deltaDays} days).`,
      'Confidence remains Medium because the disruption signals are mixed and not all impacts are confirmed.'
    ],
    confidence: 'Medium', humanValidationRequired: true, decision: d
  })
}

function tcEmergencyPriority(snap) {
  const p = pharma(snap)[0]
  const electronics = snap.shipments.find(s => /electronics/i.test(s.cargo))
  const dataUsed = [`${p.id} ${p.vessel} ${p.cargo}`, `${electronics.id} ${electronics.vessel} ${electronics.cargo}`]
  const d = decision({
    action: 'Unload pharmaceutical cargo first; reschedule consumer electronics.',
    recommendation: 'Prioritise pharma because cold-chain integrity and service criticality outrank routine electronics.',
    confidence: 'High', delay: 12, cost: 0, co2: 0, coldChainSafe: true, risk: 'Low', dataUsed
  })
  return response({
    logistics: [
      `Limited berth availability means one vessel must be prioritised. ${p.vessel} carries critical pharmaceutical cargo.`,
      `${electronics.vessel} carries consumer electronics and can be rescheduled with lower operational consequence.`
    ],
    inventory: [
      `${p.cargo} requires 2-8°C integrity and has higher service/public-health criticality.`,
      'Consumer electronics has lower immediate stockout or safety impact.'
    ],
    procurement: [
      'Notify the electronics carrier/customer of revised discharge timing.',
      'Confirm cold-room receiving readiness for the pharmaceutical shipment.'
    ],
    orchestrator: [
      'Recommendation: unload pharmaceutical cargo first and reschedule consumer electronics.',
      'This is a High-confidence decision because the prioritisation rule is clear.'
    ],
    confidence: 'High', decision: d
  })
}


function routeChoice(snap) {
  const sunda = route(snap, 'R_SUNDA')
  const lombok = route(snap, 'R_LOMBOK')
  const malacca = route(snap, 'R_MALACCA')
  const p = pharma(snap)
  const storm = snap.weather.stormProbability > 70 || snap.weather.riskLevel === 'Severe'
  const dataUsed = [
    `Malacca storm probability ${snap.weather.stormProbability}%`,
    `Sunda +${sunda.deltaDays} days, cost index ${sunda.costIndex}, CO2 index ${sunda.co2Index}`,
    `Lombok +${lombok.deltaDays} days, cost index ${lombok.costIndex}, CO2 index ${lombok.co2Index}`,
    `Cold-chain pharma ${p.map(s => s.id).join(', ')}`
  ]
  const d = decision({
    action: storm ? 'Select Sunda contingency for exposed vessels; avoid Lombok for cold-chain unless validated.' : 'Keep Malacca as baseline; keep Sunda as contingency.',
    recommendation: 'Compare route options using delay, cost, CO2, and cold-chain safety.',
    confidence: storm ? 'High' : 'Medium',
    humanValidation: storm ? false : false,
    delay: sunda.deltaDays,
    cost: sunda.costIndex,
    co2: sunda.co2Index,
    coldChainSafe: true,
    risk: storm ? 'Medium' : 'Low',
    dataUsed
  })
  return response({
    logistics: [
      storm ? `Malacca is disrupted; avoid relying on ${malacca.name} for exposed vessels.` : `Malacca remains the baseline route unless berth or weather risk worsens.`,
      `Sunda adds ${sunda.deltaDays} days and is the preferred contingency. Lombok adds ${lombok.deltaDays} days and should be a deep alternate only.`
    ],
    inventory: [
      `For 2-8°C pharma (${p.map(s => s.id).join(', ')}), Sunda is safer than Lombok because it adds less transit time.`,
      'Lombok requires human validation if cold-chain service window is tight.'
    ],
    procurement: [
      'Ask carrier for Sunda slot and customer update if reroute is activated.',
      'Do not promise Lombok unless terminal, carrier, and cold-chain team validate the longer transit.'
    ],
    orchestrator: [
      storm ? 'Recommendation: choose Sunda as contingency; use Lombok only if both Malacca and Sunda are unavailable.' : 'Recommendation: maintain Malacca but pre-authorise Sunda contingency.',
      'Decision Interface updated with Sunda trade-offs.'
    ],
    confidence: storm ? 'High' : 'Medium',
    decision: d
  })
}

function vesselResponse(vessel, snap) {
  const s = snap.shipments.find(x => x.vessel.toLowerCase() === vessel.toLowerCase() || x.id.toLowerCase() === vessel.toLowerCase())
  if (!s) return generalResponse('', snap)
  const high = s.isColdChain || s.status === 'Critical' || s.riskLevel === 'High'
  const dataUsed = [`${s.id} ${s.vessel}`, `ETA ${s.etaHours}h`, `Status ${s.status}`, `Route ${s.route}`]
  const d = decision({
    action: high ? `Prioritise ${s.vessel} and validate berth/cold-chain readiness.` : `Monitor ${s.vessel} and keep planned sequence.`,
    recommendation: `${s.vessel} risk assessment completed from simulated snapshot.`,
    confidence: high ? 'High' : 'Medium', delay: s.etaHours, cost: 0, co2: 0, coldChainSafe: s.isColdChain ? true : null, risk: s.riskLevel, dataUsed
  })
  return response({
    logistics: [`${s.vessel} (${s.id}) is on ${s.route} with ETA ${s.etaHours}h and status ${s.status}.`, `Current location: ${s.currentLocation}.`],
    inventory: [s.isColdChain ? `${s.cargo} requires ${s.temperatureRange}; maintain reefer and receiving readiness.` : `${s.cargo} is not pharmaceutical cold-chain; standard buffer logic applies.`, `Inventory signal: ${s.inventoryRisk}.`],
    procurement: [`Customer: ${s.customer}. Escalation: ${s.escalation}.`, high ? 'Confirm priority handling and customer update.' : 'No immediate expedite required.'],
    orchestrator: [high ? `Recommendation: prioritise ${s.vessel} and protect service window.` : `Recommendation: maintain planned sequence and monitor ETA.`, 'Decision Interface updated with shipment risk.'],
    confidence: high ? 'High' : 'Medium', decision: d
  })
}

function generalResponse(_msg, snap) {
  const w = snap.weather, ps = snap.portSummary, highs = highTerminals(snap)
  const dataUsed = [`Weather ${w.riskLevel}`, `Berth ${ps.berthOccupancy}%`, `Terminals high/severe ${highs.length}`]
  const d = decision({
    action: 'Review dashboard, prioritise cold-chain cargo, and validate any unsupported request with human planner.',
    recommendation: 'General orchestration summary generated from current simulated snapshot.',
    confidence: 'Medium', delay: null, cost: null, co2: null, coldChainSafe: true, risk: highs.length ? 'High' : 'Medium', dataUsed
  })
  return response({
    logistics: [`Malacca weather risk is ${w.riskLevel}; Tuas berth occupancy is ${ps.berthOccupancy}%.`, `High/severe terminal count: ${highs.length}.`],
    inventory: [`Critical cold-chain pharma shipments: ${pharma(snap).map(s => s.id).join(', ')}.`, 'Protect 2-8°C integrity before cost optimisation.'],
    procurement: ['Keep carrier/customer updates focused on critical shipments first.', 'Hold routine cargo changes unless congestion or weather worsens.'],
    orchestrator: ['Recommendation: use the Decision Interface to compare route, terminal, and cold-chain trade-offs.', 'For unsupported requests, validate with human planner before execution.'],
    confidence: 'Medium', decision: d
  })
}

export function query(message) {
  const snap = getSnapshot()
  const msg = (message || '').toLowerCase()
  if (key(msg, ['only unload', 'only one vessel', 'pharmaceutical supplies', 'consumer electronics'])) return tcEmergencyPriority(snap)
  if (key(msg, ['golden star', 'red sea', 'hormuz', 'spillover', 'batam'])) return tcMultiDisruption(snap)
  if (msg.includes('weather') && msg.includes('normal') && (msg.includes('congestion') || msg.includes('reroute'))) return tcConflictingInfo(snap)
  if (key(msg, ['92%', '92 percent', 'berth occupancy', 'minimise delays', 'minimize delays'])) return tcBerthCongestion(snap)
  if (key(msg, ['storm', 'tropical storm', 'pharma', 'pharmaceutical', 'cold-chain', 'cold chain', '48 hours late'])) return tcWeatherColdChain(snap)
  if (msg.includes('sunda') || msg.includes('lombok') || msg.includes('reroute')) return routeChoice(snap)
  const s = snap.shipments.find(x => msg.includes(x.id.toLowerCase()) || msg.includes(x.vessel.toLowerCase()))
  if (s) return vesselResponse(s.vessel, snap)
  if (isGreeting(msg)) return greetingResponse(snap)
  // Domain gate: anything with no maritime/port/supply-chain vocabulary is
  // declined rather than answered with a generic port summary (Test Case 6).
  if (!isInDomain(msg, snap)) return outOfDomainResponse()
  return generalResponse(msg, snap)
}

export const QUICK_QUESTIONS = [
  { id: 'TC1', label: 'Pharma storm', prompt: 'A tropical storm is expected in the Malacca Strait and my vessel carrying pharmaceutical products will arrive 48 hours late. What should I do?' },
  { id: 'TC2', label: '92% berth', prompt: 'Berth occupancy has reached 92%. How can we minimise delays?' },
  { id: 'TC3', label: 'Conflicting data', prompt: 'Weather conditions are normal, but Tuas reports severe congestion. Should I reroute my shipment?' },
  { id: 'TC4', label: 'Multi-disruption', prompt: 'The Strait of Malacca is experiencing spillover pressure from Red Sea and Hormuz disruptions, though Malaysian ports report congestion remains manageable. Separately, the Tanzania-registered container vessel GOLDEN STAR 1 sank 6 km off Batam on 5 June 2026, with all nine crew rescued. What should we do?' },
  { id: 'TC5', label: 'Priority unload', prompt: 'Due to limited berth availability, we can only unload one vessel today. We have one vessel carrying pharmaceutical supplies and another carrying consumer electronics. Which should be prioritised?' }
]
