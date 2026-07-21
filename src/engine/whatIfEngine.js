// src/engine/whatIfEngine.js
// Deterministic what-if simulation engine for the Tuas Mega Port Resilience Monitor.
// MOCK MODE — no API key required. All logic is rule-based and references snapshot data only.

import { SHIPMENTS, ROUTES } from '../data/simulation.js'

// ─── Route constants (exact spec values) ─────────────────────────────────────
const ROUTE = {
  MALACCA: { deltaDays: 0,   costIndex: 100, co2Index: 100, risk: 'High'   },
  SUNDA:   { deltaDays: 2,   costIndex: 118, co2Index: 115, risk: 'Medium' },
  LOMBOK:  { deltaDays: 3.5, costIndex: 126, co2Index: 124, risk: 'Low'    },
  AIR:     { deltaDays: -4,  costIndex: 340, co2Index: 610, risk: 'Low'    }
}

// ─── Preset definitions ───────────────────────────────────────────────────────
export const PRESETS = [
  {
    id: 'storm',
    label: 'Storm closes the Malacca Strait for 48 h'
  },
  {
    id: 'congestion',
    label: 'Berth congestion spikes to 95%'
  },
  {
    id: 'multi',
    label: 'Multi-disruption: Malacca spillover + Batam vessel incident'
  }
]

// ─── Classify free text to a preset ──────────────────────────────────────────
export function classifyFreeText(text) {
  const t = text.toLowerCase()
  if (/golden star|batam|spillover|multi.?disruption|hormuz|red sea|regional|incident|sank|grounded/.test(t)) return 'multi'
  if (/storm|typhoon|gale|malacca.*close|close.*malacca|weather|wind|wave/.test(t)) return 'storm'
  if (/congestion|berth|95%|92%|occupancy|queue|capacity|full/.test(t)) return 'congestion'
  // Default to storm for anything weather-related
  if (/disrupt|delay|closure|blockage/.test(t)) return 'storm'
  return 'storm'
}

// ─── Affected shipments calculation ──────────────────────────────────────────
function getAffectedShipments(preset) {
  return SHIPMENTS.filter(s => {
    const route = (s.route || '').toLowerCase()
    const onMalacca = route.includes('malacca')
    const isDelayedOrCritical = s.status === 'Delayed' || s.status === 'Critical' || s.status === 'Watch'
    const isColdChainExposed = s.isColdChain

    if (preset === 'storm' || preset === 'multi') {
      return onMalacca || isDelayedOrCritical || isColdChainExposed
    }
    if (preset === 'congestion') {
      // Congestion affects all inbound vessels
      return isDelayedOrCritical || isColdChainExposed || onMalacca
    }
    return onMalacca || isDelayedOrCritical || isColdChainExposed
  })
}

// ─── Option tables ────────────────────────────────────────────────────────────

function buildOptions(preset) {
  const pharmaCritical = SHIPMENTS.filter(s => s.isColdChain && s.temperatureRange === '2-8 C')
  const stockoutHours = 18 // SHP-2041

  if (preset === 'storm') {
    return [
      {
        id: 'hold',
        label: 'Hold & wait',
        deltaTransit: '+48 h (storm closure)',
        deltaCost: 'Minimal (+anchorage fees)',
        risk: 'High',
        deltaCO2: 'Low (engines idle)',
        coldChainSafe: false,
        coldChainNote: `No — ${stockoutHours}h pharma stockout window breached by 48h closure. Cold-chain integrity at risk.`
      },
      {
        id: 'sunda',
        label: 'Reroute via Sunda',
        deltaTransit: '+2 days (+48 h detour)',
        deltaCost: '+18% (cost index 118)',
        risk: 'Medium',
        deltaCO2: '+15% (CO2 index 115)',
        coldChainSafe: true,
        coldChainNote: 'Yes — if reefer monitoring is maintained during transit. Stockout risk for SHP-2041 remains marginal at 48h.'
      },
      {
        id: 'sunda_air',
        label: 'Sunda + air-freight the pharma',
        deltaTransit: 'General cargo +2 days | Pharma −4 days vs storm-delayed ETA',
        deltaCost: 'General +18% | Pharma +240% (air cost index 340)',
        risk: 'Low / Medium',
        deltaCO2: 'General +15% | Pharma +510% (air CO2 index 610)',
        coldChainSafe: true,
        coldChainNote: 'Yes — pharmaceutical cold-chain integrity guaranteed via controlled air freight. Cold-chain integrity outranks cost.'
      }
    ]
  }

  if (preset === 'congestion') {
    return [
      {
        id: 'hold',
        label: 'Hold & wait (queue)',
        deltaTransit: '+12–24 h (berth queuing delay)',
        deltaCost: 'Minimal (+demurrage ~SGD 10,000/vessel)',
        risk: 'High',
        deltaCO2: 'Minimal (anchorage idling)',
        coldChainSafe: false,
        coldChainNote: 'No — 12–24h queue at 95% occupancy threatens cold-chain integrity for 2-8°C pharma (SHP-2041 18h window).'
      },
      {
        id: 'sunda',
        label: 'Reroute via Sunda (non-critical only)',
        deltaTransit: '+2 days for rerouted vessels; frees berth capacity immediately',
        deltaCost: '+18% (cost index 118) for diverted vessels',
        risk: 'Medium',
        deltaCO2: '+15% for diverted vessels',
        coldChainSafe: true,
        coldChainNote: 'Yes — diverting routine cargo frees priority berth for cold-chain pharma immediate unloading.'
      },
      {
        id: 'sunda_air',
        label: 'Priority berthing + partial air-freight pharma',
        deltaTransit: 'Critical pharma −4 days | Routine cargo +2 days (Sunda)',
        deltaCost: 'Pharma +240% (air index 340) | Others +18% (Sunda index 118)',
        risk: 'Low',
        deltaCO2: 'Pharma +510% (air index 610) | Others +15%',
        coldChainSafe: true,
        coldChainNote: 'Yes — cold-chain integrity fully protected. Congestion resolved for all inbound vessels.'
      }
    ]
  }

  if (preset === 'multi') {
    return [
      {
        id: 'hold',
        label: 'Hold & watch (minimal response)',
        deltaTransit: 'Variable — +24–48h if Malacca degrades',
        deltaCost: 'Low currently; escalates if disruption worsens',
        risk: 'Medium (could escalate to High)',
        deltaCO2: 'Minimal currently',
        coldChainSafe: false,
        coldChainNote: 'Uncertain — cold-chain safety depends on how quickly Malacca clears. Do not hold if pharma exposed >18h.'
      },
      {
        id: 'sunda',
        label: 'Sunda contingency pre-authorisation',
        deltaTransit: '+2 days if activated (do not execute yet)',
        deltaCost: '+18% if activated (cost index 118)',
        risk: 'Low / Medium (contingency only)',
        deltaCO2: '+15% if activated (CO2 index 115)',
        coldChainSafe: true,
        coldChainNote: 'Yes — pre-authorising avoids reactive delay if situation deteriorates. Cold-chain protected proactively.'
      },
      {
        id: 'sunda_air',
        label: 'Cold-chain priority + Sunda contingency + partial air',
        deltaTransit: 'Pharma −4 days (air) | Others contingency Sunda +2 days',
        deltaCost: 'Pharma +240% (air index 340) | Others +18% if diverted',
        risk: 'Low',
        deltaCO2: 'Pharma +510% (air) | Others +15% if diverted',
        coldChainSafe: true,
        coldChainNote: 'Yes — maximum cold-chain protection under multi-disruption uncertainty. Conservative priority response.'
      }
    ]
  }

  return []
}

// ─── Orchestrator recommendations ─────────────────────────────────────────────

function buildRecommendation(preset, affectedShipments, freeText) {
  const pharmaShipments = SHIPMENTS.filter(s => s.isColdChain && s.temperatureRange === '2-8 C')
  const goldenStarMentioned = NEWS_TICKER_HAS_GOLDEN_STAR()
  const port = 'Tuas Mega Port'

  if (preset === 'storm') {
    return {
      recommended: 'sunda_air',
      logistics: [
        'Malacca Strait is closed for 48h due to storm conditions. All vessels on primary route are affected.',
        `${pharmaShipments.map(s => s.id).join(' and ')} (SL TRADER and AURORA PIONEER) carry 2-8°C pharmaceutical cargo — their ETA window cannot absorb a 48h delay without cold-chain breach.`,
        'Sunda Strait (+2 days, cost index 118, CO2 index 115) is the safest sea route alternate. Pre-authorise immediately.',
        'Air freight (cost index 340, CO2 index 610) is warranted for pharmaceutical cargo only — −4 days vs delayed sea ETA.'
      ],
      inventory: [
        `SHP-2041 (SL TRADER): insulin & vaccines — stockout in 18h. A 48h storm hold breaches this window by 30h. CRITICAL.`,
        `SHP-2042 (AURORA PIONEER): biologics — stockout in 36h. Storm delay brings this to marginal. Monitor reefer telemetry every 4h.`,
        'Safety stock release must be activated immediately with BioHealth Pharma and MedGlobal AG.',
        'Non-cold-chain cargo (SHP-2044 through SHP-2052) has buffers of 4–30 days — Sunda reroute is acceptable.'
      ],
      procurement: [
        'BioHealth Pharma (SHP-2041): Director already notified. Confirm air freight activation for insulin units — approximate uplift ~$280,000 SGD.',
        'MedGlobal AG (SHP-2042): Notify of potential 36h delay risk. Release regional buffer inventory immediately.',
        'Carrier authorisation required for Sunda diversion — obtain within 2h window.',
        'No cargo substitution feasible for pharmaceuticals. Air freight is the only compliant contingency.'
      ],
      tradeoff: 'Sunda route adds +2 days and +18% cost for general cargo. Air freight for pharma adds +240% cost and +510% CO2 but saves −4 days vs storm-delayed sea ETA. Cold-chain integrity outranks cost. The financial loss from insulin stockout ($5.88M SGD) far exceeds the air freight premium. Recommend: activate Sunda for general cargo + air freight for SHP-2041 pharma.',
      coldChainStatement: 'Cold-chain integrity outranks cost.',
      confidence: 'High',
      humanValidationRequired: false,
      dataUsed: `SHP-2041 (SL TRADER, insulin, 2-8°C, SGD 5.88M, stockout 18h), SHP-2042 (AURORA PIONEER, biologics, 2-8°C, SGD 3.24M, stockout 36h), Malacca 48h storm closure, Sunda route (cost index 118, CO2 index 115, +2 days), air freight (cost index 340, CO2 index 610, −4 days), 12 simulated shipments.`
    }
  }

  if (preset === 'congestion') {
    return {
      recommended: 'sunda_air',
      logistics: [
        `${port} berth occupancy at 95% — severe congestion. Average queuing delay: 22h. Effective berth capacity reduced by Berth 7 maintenance.`,
        'Priority berthing protocol must be activated immediately: cold-chain pharma first, critical-priority cargo second, high-priority third, routine last.',
        'Reroute routine-cargo vessels (SHP-2044, SHP-2051, SHP-2052) via Sunda Strait (+2 days, cost index 118) to free berth slots.',
        'ETA adjustment: request non-critical inbound vessels to reduce speed to create a 6-8h arrival buffer.'
      ],
      inventory: [
        'SHP-2041 (SL TRADER): insulin — stockout in 18h. 22h average queue means immediate berth override required.',
        'SHP-2042 (AURORA PIONEER): biologics — stockout in 36h. Assign to Berth 3 immediately after SHP-2041.',
        'Routine cargo (SHP-2044: iron ore 9-day buffer, SHP-2051: steel 18-day buffer) — can absorb 2-day Sunda diversion with no service impact.',
        'Activate safety stock release for BioHealth Pharma and MedGlobal AG to bridge the expected 22h delay.'
      ],
      procurement: [
        'BioHealth Pharma (SHP-2041): Notify that priority berthing has been activated. Confirm cold-storage receiving team standby at Berth 3.',
        'Notify routine-cargo carriers (NORDIC PEARL, TITAN GLORY, PACIFIC BRIDGE) of Sunda diversion: +2 days, demurrage waived.',
        'Customs fast-track authorisation required for SHP-2041 pharmaceutical clearance.',
        'No expedite orders required if berth priority is executed within 2h.'
      ],
      tradeoff: 'Diverting routine cargo via Sunda costs +18% per vessel and adds 2 days. This frees berth slots immediately and avoids pharma stockout. Holding all vessels in queue risks 22h delay for SHP-2041 — exceeding the 18h stockout window. Cold-chain integrity outranks cost. Priority unloading protocol is unambiguously correct.',
      coldChainStatement: 'Cold-chain integrity outranks cost.',
      confidence: 'High',
      humanValidationRequired: false,
      dataUsed: `${port} occupancy 95%, avg delay 22h, SHP-2041 (insulin, 18h stockout), SHP-2042 (biologics, 36h stockout), Sunda route (cost index 118, +2 days), 12 simulated shipments, Berth 7 maintenance capacity reduction.`
    }
  }

  if (preset === 'multi') {
    const goldenStar = goldenStarMentioned ? 'GOLDEN STAR 1 vessel incident off Batam (6 km, all 9 crew rescued) creates a navigational advisory zone near Malacca southern approach. ' : ''
    return {
      recommended: 'sunda',
      logistics: [
        `Multi-disruption context: Red Sea and Hormuz spillover increasing Malacca vessel volume. Malaysian ports report congestion manageable (not severe). ${goldenStar}`,
        'Current Malacca occupancy is elevated but below crisis threshold — avoid overreaction.',
        'Pre-authorise Sunda contingency route (+2 days, cost index 118, CO2 index 115). Do not execute yet.',
        'Monitor Malacca approach times every 2h. Trigger Sunda diversion if delay exceeds 12h.'
      ],
      inventory: [
        'Prioritise cold-chain pharma: SHP-2041 (SL TRADER, insulin, 2-8°C, 18h stockout window) and SHP-2042 (AURORA PIONEER, biologics, 36h window).',
        'High-value cargo at risk: SHP-2041 (SGD 5.88M), SHP-2042 (SGD 3.24M), SHP-2052 (SGD 2.8M, heavy machinery).',
        'Safety stock on standby — do not release prematurely. Congestion is "manageable" per current intelligence.',
        'If Malacca approach time exceeds 12h for SHP-2041, activate safety stock and escalate.'
      ],
      procurement: [
        'Issue precautionary notifications to BioHealth Pharma and MedGlobal AG — advise of elevated transit risk without triggering full escalation.',
        'Prepare Sunda diversion carrier authorisation — ready to execute within 2h if triggered.',
        'Do not order air freight yet — situation is multi-disruption elevated, not confirmed emergency.',
        'Monitor bunker and spot freight rates — Red Sea pressure is driving rate increases.'
      ],
      tradeoff: `Multi-disruption posture: watch and prepare, do not overreact. ${goldenStar}Sunda contingency is pre-authorised at no cost until activated. Over-reacting wastes +18% cost per vessel and delays routine cargo by 2 days. Under-reacting risks missing the cold-chain deterioration window. Conservative contingency readiness is the correct middle path. Cold-chain integrity outranks cost if situation escalates.`,
      coldChainStatement: 'Cold-chain integrity outranks cost.',
      confidence: 'Medium',
      humanValidationRequired: false,
      dataUsed: `Malacca spillover intelligence, ${goldenStar ? 'GOLDEN STAR 1 Batam incident (simulated newsTicker), ' : ''}SHP-2041 (insulin, 2-8°C, SGD 5.88M), SHP-2042 (biologics, 2-8°C, SGD 3.24M), Sunda route (cost index 118, CO2 index 115), 12 simulated shipments.`
    }
  }

  return null
}

// GOLDEN STAR 1 is confirmed present in simulation.js NEWS_TICKER
function NEWS_TICKER_HAS_GOLDEN_STAR() {
  return true
}

// ─── Main simulation function ─────────────────────────────────────────────────

export function runSimulation(preset, freeText, snapshot) {
  const resolvedPreset = preset || (freeText.trim() ? classifyFreeText(freeText) : 'storm')
  const affected = getAffectedShipments(resolvedPreset)
  const options = buildOptions(resolvedPreset)
  const rec = buildRecommendation(resolvedPreset, affected, freeText)

  const situationSummaryMap = {
    storm: `Malacca Strait closed for 48 hours due to storm — ${affected.length} of ${SHIPMENTS.length} shipments affected, including 2 critical cold-chain pharmaceutical vessels on the primary route.`,
    congestion: `Tuas Mega Port berth occupancy spiked to 95% — severe congestion creating 22h average queueing delay for all ${affected.length} of ${SHIPMENTS.length} tracked inbound shipments.`,
    multi: `Multi-disruption active: Malacca spillover pressure from Red Sea/Hormuz disruptions plus GOLDEN STAR 1 vessel incident off Batam — ${affected.length} of ${SHIPMENTS.length} shipments at elevated risk; congestion currently manageable.`
  }

  const result = {
    preset: resolvedPreset,
    freeText: freeText.trim(),
    situationSummary: situationSummaryMap[resolvedPreset],
    affectedCount: affected.length,
    totalCount: SHIPMENTS.length,
    affectedShipments: affected,
    options,
    recommended: rec.recommended,
    recommendation: rec,
    confidence: rec.confidence,
    humanValidationRequired: rec.humanValidationRequired,
    dataUsed: rec.dataUsed,
    timestamp: new Date().toISOString()
  }

  // Attach decision object for Decision Interface
  result.decision = buildDecisionFromResult(result)
  return result
}

function buildDecisionFromResult(result) {
  const rec = result.recommendation
  const recOption = result.options.find(o => o.id === result.recommended) || result.options[0]

  const actionMap = {
    storm:      'Reroute via Sunda + air-freight critical cold-chain pharma',
    congestion: 'Priority berthing for cold-chain pharma; reroute routine cargo via Sunda',
    multi:      'Activate Sunda contingency watch; prioritise cold-chain/high-value cargo'
  }

  const costMap = { storm: 280000, congestion: 95000, multi: 42000 }
  const delayMap = { storm: -4, congestion: -18, multi: -6 }

  return {
    vesselId: null,
    vesselName: null,
    action: actionMap[result.preset] || recOption.label,
    rationale: [rec.logistics[0], rec.tradeoff].join(' — '),
    confidence: result.confidence,
    humanValidation: result.humanValidationRequired,
    tradeoffs: {
      delay: delayMap[result.preset] || 0,
      cost: costMap[result.preset] || 0,
      co2: result.preset === 'storm' ? 41000 : result.preset === 'congestion' ? 18000 : 8000,
      coldChain: recOption.coldChainSafe ? 'Protected' : 'At Risk',
      opsRisk: result.confidence === 'High' ? 'Medium' : 'Medium',
      note: result.dataUsed.slice(0, 120)
    },
    shipmentId: null,
    cargo: 'Multiple — see what-if simulation',
    priority: 'CRITICAL',
    coldChain: true,
    riskLabel: { text: result.confidence, color: result.confidence === 'High' ? 'green' : 'orange' },
    timestamp: result.timestamp
  }
}

// ─── Challenge loop ───────────────────────────────────────────────────────────

const UNSAFE_PATTERNS = [
  /ignore\s+(temperature|temp|cold.?chain|reefer|safety|compliance|maritime|regulation)/i,
  /skip\s+(reefer|monitoring|temp|safety|inspection|compliance)/i,
  /disable\s+(cold.?chain|monitoring|reefer|safety)/i,
  /override\s+(safety|compliance|maritime|regulation|temperature)/i,
  /sacrifice\s+(cold.?chain|temperature|safety)/i,
  /dont\s+monitor|do\s+not\s+monitor/i
]

const LOMBOK_PATTERNS = [/lombok/i, /deep\s+alternate/i]

const CO2_MINIMISE_PATTERNS = [/minimis|minimiz|reduce.*(co2|carbon|emission)|co2.*low|lowest.*co2/i]

export function runChallenge(constraint, originalResult, snapshot) {
  const c = constraint.toLowerCase()

  // ── UNSAFE challenge: refuse ──────────────────────────────────────────────
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(constraint)) {
      return {
        accepted: false,
        type: 'refused',
        refusalReason: constraint,
        message: [
          `This constraint cannot be accommodated: "${constraint.slice(0, 80)}"`,
          'Operational rule: Temperature integrity, reefer monitoring, maritime safety, and regulatory compliance are non-negotiable constraints — they cannot be overridden, ignored, or skipped under any circumstances.',
          'Cold-chain pharmaceutical cargo (2-8°C) requires continuous temperature monitoring. Any breach invalidates the pharmaceutical batch and creates a public health risk.',
          'This system will not recommend actions that compromise safety, maritime compliance, or temperature integrity.',
          'If you believe there is a legitimate operational reason, escalate to Port Operations Manager and National Pharmacy Board. HUMAN VALIDATION REQUIRED before any non-standard cold-chain handling.'
        ],
        confidence: 'Low',
        humanValidationRequired: true,
        decision: {
          action: 'REFUSED — Unsafe constraint',
          rationale: 'Constraint violates cold-chain integrity, safety, or maritime compliance rules. Escalate to human operations manager.',
          confidence: 'Low',
          humanValidation: true,
          tradeoffs: { delay: 0, cost: 0, co2: 0, coldChain: 'NON-NEGOTIABLE', opsRisk: 'High', note: 'Constraint refused — see challenge log.' },
          timestamp: new Date().toISOString()
        }
      }
    }
  }

  // ── LOMBOK challenge ──────────────────────────────────────────────────────
  if (LOMBOK_PATTERNS.some(p => p.test(constraint))) {
    const pharmaCritical = SHIPMENTS.filter(s => s.isColdChain && s.temperatureRange === '2-8 C')
    const lombokDeltaDays = 3.5
    const lombokCost = 126  // cost index
    const lombokCO2  = 124  // CO2 index

    // Lombok route specs (exact from spec)
    const lombokSafe = originalResult.preset !== 'storm' // during a 48h storm, 3.5 extra days could still breach stockout
    const stockoutWindow = 18 // hours
    const lombokHoursDelay = lombokDeltaDays * 24
    const breachesStockout = lombokHoursDelay > stockoutWindow

    const message = [
      `Lombok Strait analysis: +${lombokDeltaDays} days transit, cost index ${lombokCost} (+26%), CO2 index ${lombokCO2} (+24%).`,
      `Lombok adds ${lombokHoursDelay} hours of additional transit time versus the baseline route.`
    ]

    if (breachesStockout && pharmaCritical.length > 0) {
      message.push(
        `I cannot recommend Lombok as the primary option for exposed cold-chain pharma because cold-chain integrity outranks route preference and cost.`,
        `Reason: SHP-2041 (insulin) has an 18h stockout window. Lombok adds ${lombokHoursDelay}h, which breaches this window by ${lombokHoursDelay - stockoutWindow}h. A cold-chain breach would invalidate a SGD 5.88M pharmaceutical batch.`,
        `If Lombok is required for non-pharmaceutical cargo (iron ore, steel, consumer goods), it is acceptable with no cold-chain concern.`,
        `Pharmaceutical cargo (SHP-2041, SHP-2042) must use Sunda (+2 days, cost index 118) or air freight (−4 days, cost index 340) instead.`
      )
      return {
        accepted: false,
        type: 'lombok_refused_for_pharma',
        refusalReason: 'Lombok breaches pharma cold-chain stockout window',
        message,
        lombokSpecs: { deltaDays: lombokDeltaDays, costIndex: lombokCost, co2Index: lombokCO2 },
        confidence: 'Medium',
        humanValidationRequired: true,
        decision: {
          action: `Lombok for non-pharma cargo only; Sunda/air for pharma`,
          rationale: `Lombok (+${lombokDeltaDays} days, index ${lombokCost}) acceptable for non-cold-chain. Cold-chain pharma must use Sunda or air freight. Cold-chain integrity outranks route preference.`,
          confidence: 'Medium',
          humanValidation: true,
          tradeoffs: { delay: +84, cost: +26, co2: +24, coldChain: 'At Risk for pharma — use Sunda instead', opsRisk: 'Medium', note: `Lombok specs: +${lombokDeltaDays} days, cost index ${lombokCost}, CO2 index ${lombokCO2}` },
          timestamp: new Date().toISOString()
        }
      }
    }

    // Lombok acceptable (no pharma cold-chain conflict)
    message.push(
      `Lombok is acceptable for non-cold-chain cargo in this scenario.`,
      `For cold-chain pharmaceutical cargo, Sunda (+2 days, cost index 118) is preferred as it adds less transit time.`
    )
    return {
      accepted: true,
      type: 'lombok_partial',
      message,
      lombokSpecs: { deltaDays: lombokDeltaDays, costIndex: lombokCost, co2Index: lombokCO2 },
      confidence: 'Medium',
      humanValidationRequired: false,
      decision: {
        action: `Use Lombok for non-cold-chain cargo; Sunda for cold-chain`,
        rationale: `Lombok (+${lombokDeltaDays} days, cost index ${lombokCost}, CO2 index ${lombokCO2}) acceptable for non-cold-chain. Cold-chain pharma uses Sunda (cost index 118).`,
        confidence: 'Medium',
        humanValidation: false,
        tradeoffs: { delay: +84, cost: +26, co2: +24, coldChain: 'Protected (Sunda for pharma)', opsRisk: 'Low', note: `Lombok: +${lombokDeltaDays}d, cost index ${lombokCost}, CO2 index ${lombokCO2}` },
        timestamp: new Date().toISOString()
      }
    }
  }

  // ── CO2 minimise challenge (reasonable) ───────────────────────────────────
  if (CO2_MINIMISE_PATTERNS.some(p => p.test(constraint))) {
    return {
      accepted: true,
      type: 'co2_rerank',
      message: [
        'Re-ranking options to minimise CO2 while preserving cold-chain integrity:',
        `1. Reroute via Sunda (non-pharma): CO2 index 115 (+15%) — lowest CO2 alternate that keeps cold-chain safe.`,
        `2. Hold & wait: CO2 minimal (idling) — but cold-chain safety is NOT preserved for pharma. This option is not viable.`,
        `3. Sunda + air-freight pharma: CO2 index 610 for air portion — highest CO2, but required to protect pharmaceutical cold-chain.`,
        `CO2 trade-off: Sunda-only minimises CO2 for general cargo. Air freight for pharma is CO2-intensive but non-negotiable if stockout window is breached.`,
        `Recommendation: Use Sunda for all non-critical cargo (lowest CO2), air freight only for pharmaceutical cargo where cold-chain integrity requires it. Cold-chain integrity outranks CO2 optimisation.`
      ],
      confidence: 'High',
      humanValidationRequired: false,
      decision: {
        action: 'Sunda for general cargo (CO2-optimised); air freight for pharma only if required',
        rationale: 'CO2-minimising re-rank: Sunda (+15% CO2) for all non-critical cargo. Air freight (610% CO2) only for pharmaceutical cold-chain. Cold-chain integrity outranks CO2 optimisation.',
        confidence: 'High',
        humanValidation: false,
        tradeoffs: { delay: +48, cost: 118, co2: +15, coldChain: 'Protected', opsRisk: 'Low', note: 'CO2-optimised: Sunda index 115, air freight for pharma only.' },
        timestamp: new Date().toISOString()
      }
    }
  }

  // ── General reasonable constraint ─────────────────────────────────────────
  return {
    accepted: true,
    type: 'general',
    message: [
      `Constraint noted: "${constraint.slice(0, 100)}"`,
      `Evaluating against current ${originalResult.preset} scenario with ${originalResult.affectedCount} affected shipments.`,
      `The core recommendation remains: ${originalResult.recommended === 'sunda_air' ? 'Sunda + air-freight pharma' : originalResult.recommended === 'sunda' ? 'Sunda contingency' : 'hold & monitor'}.`,
      'Cold-chain integrity for SHP-2041 (insulin, 2-8°C, 18h stockout) and SHP-2042 (biologics, 36h stockout) is non-negotiable and cannot be constrained away.',
      'If this constraint introduces a specific operational requirement (cost cap, route restriction, authority limit), please restate it with specific parameters for re-evaluation.',
      'HUMAN VALIDATION REQUIRED to confirm if this constraint overrides standard operational protocol.'
    ],
    confidence: 'Low',
    humanValidationRequired: true,
    decision: {
      action: `Modified: ${constraint.slice(0, 60)} — under review`,
      rationale: `Constraint under evaluation. Original recommendation held pending human review. Cold-chain integrity outranks cost.`,
      confidence: 'Low',
      humanValidation: true,
      tradeoffs: { delay: null, cost: null, co2: null, coldChain: 'Protected', opsRisk: 'Medium', note: `Challenge constraint: "${constraint.slice(0, 80)}"` },
      timestamp: new Date().toISOString()
    }
  }
}

// ─── Decision log (localStorage + hash-chain) ────────────────────────────────

const WHATIF_LOG_KEY = 'tmprm_whatif_decisions'

function simpleHash(data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data)
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
    h = h >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

export function getDecisionLog() {
  try {
    return JSON.parse(localStorage.getItem(WHATIF_LOG_KEY) || '[]')
  } catch { return [] }
}

export function logWhatIfDecision(result, challengeResult, userName) {
  const log = getDecisionLog()
  const previousHash = log.length > 0 ? log[0].currentHash : '00000000'

  const entry = {
    id: `WIF-${Date.now()}`,
    timestamp: new Date().toISOString(),
    user: userName || 'demo-user',
    scenario: PRESETS.find(p => p.id === result.preset)?.label || result.preset,
    preset: result.preset,
    situationSummary: result.situationSummary,
    recommendation: result.recommendation?.tradeoff?.slice(0, 200),
    selectedAction: result.decision?.action,
    confidence: result.confidence,
    humanValidationRequired: result.humanValidationRequired,
    tradeoffs: result.decision?.tradeoffs,
    dataUsed: result.dataUsed?.slice(0, 200),
    challengeApplied: challengeResult ? {
      constraint: challengeResult.constraint,
      accepted: challengeResult.accepted,
      confidence: challengeResult.confidence
    } : null,
    previousHash,
    // Hash of this entry (excluding currentHash itself)
    currentHash: null
  }
  entry.currentHash = simpleHash({ ...entry, currentHash: undefined })

  const updated = [entry, ...log].slice(0, 20)
  try { localStorage.setItem(WHATIF_LOG_KEY, JSON.stringify(updated)) } catch {}
  return updated
}

export function clearDecisionLog() {
  try { localStorage.removeItem(WHATIF_LOG_KEY) } catch {}
  return []
}
