import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { query as mockQuery } from '../agent/mockBrain.js'
import { queryDegraded, queryLive, DEFAULT_MODEL } from '../agent/liveBrain.js'
import { WORLD_VESSELS } from '../data/worldMapData.js'

const QUICK_QUESTIONS = [
  { id: 'weather', label: 'Weather outlook', prompt: 'What is the weather outlook for the Malacca Strait?' },
  { id: 'berth', label: 'Berth occupancy at Tuas', prompt: 'What is the berth occupancy at Tuas and how can delays be reduced?' },
  { id: 'risk', label: 'High risk shipments', prompt: 'Which shipments are currently high risk?' },
  { id: 'reroute', label: 'Recommend rerouting', prompt: 'Recommend the best rerouting option for a critical shipment.' }
]

function normaliseVesselText(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function resolveVesselId(value) {
  const normalised = normaliseVesselText(value)
  if (!normalised) return null

  return [...WORLD_VESSELS]
    .sort((a, b) => b.name.length - a.name.length)
    .find(vessel => {
      const name = normaliseVesselText(vessel.name)
      const id = normaliseVesselText(vessel.id)
      return normalised.includes(name) || normalised.includes(id)
    })?.id || null
}

function buildInitialMessages(snapshot) {
  const port = snapshot?.portSummary || {}
  const delay = Number(port.avgDelayHours ?? 18.6)
  const occupancy = Number(port.berthOccupancy ?? 72)
  const slTrader = snapshot?.shipments?.find(item => item.vessel === 'SL TRADER')
  const yesterdayDelay = Math.max(0, delay - 3.2).toFixed(1)
  return [
    { role: 'user', plain: 'What is the average delay at Tuas Mega Port today?', time: '10:29 AM' },
    {
      role: 'advisor',
      type: 'delay',
      plain: 'The average vessel delay at Tuas Mega Port today is',
      highlight: `${delay.toFixed(1)} hours.`,
      detail: `This is 3.2 hours higher than yesterday (${yesterdayDelay} hours). Delays are mainly due to berth occupancy (${occupancy}%) and adverse weather in the Malacca Strait.`,
      time: '10:29 AM'
    },
    { role: 'user', plain: 'Show me vessel SL TRADER', time: '10:30 AM' },
    {
      role: 'advisor',
      type: 'vessel',
      vesselId: 'SL_TRADER',
      plain: 'Displaying details for',
      highlight: 'SL TRADER',
      detail: `(${slTrader?.imo || 'IMO9874321'}).`,
      time: '10:30 AM'
    }
  ]
}

function BotIcon() {
  return (
    <div className="relative w-10 h-10 shrink-0">
      <svg viewBox="0 0 48 48" className="w-full h-full" fill="none">
        <rect x="8" y="12" width="32" height="27" rx="10" fill="#092a70"/>
        <circle cx="19" cy="25" r="3" fill="white"/><circle cx="29" cy="25" r="3" fill="white"/>
        <path d="M18 32c4 2 8 2 12 0M24 12V7M21 7h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <path d="M8 23H4M44 23h-4" stroke="#092a70" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    </div>
  )
}

function buildQuickResponse(id, snapshot) {
  const weather = snapshot?.weather || {}
  const port = snapshot?.portSummary || {}
  const terminals = snapshot?.terminalOccupancy || []
  const shipments = snapshot?.shipments || []
  const routes = snapshot?.routes || []
  const highRisk = shipments.filter(item => item.riskLevel === 'High' || item.status === 'Critical')
  const coldChain = shipments.filter(item => item.isColdChain)
  const highestTerminals = [...terminals].sort((a, b) => b.occupancyPercent - a.occupancyPercent).slice(0, 2)
  const malacca = routes.find(item => item.id === 'R_MALACCA')
  const sunda = routes.find(item => item.id === 'R_SUNDA')
  const lombok = routes.find(item => item.id === 'R_LOMBOK')
  const air = routes.find(item => item.id === 'R_AIR')
  const severeWeather = weather.riskLevel === 'Severe' || Number(weather.stormProbability) >= 70

  if (id === 'weather') {
    return {
      sections: {
        'Current conditions': [
          `${weather.location || 'Malacca Strait'} is ${weather.conditionLabel || 'under observation'} with ${weather.windKts ?? 18} kn winds, ${weather.waveM ?? 1.8} m waves, and ${weather.visibilityKm ?? 9} km visibility.`,
          `Storm probability is ${weather.stormProbability ?? 22}% and the simulated route risk is ${weather.riskLevel || 'Medium'}.`
        ],
        'Six-hour outlook': [
          severeWeather
            ? 'The active weather cell is expected to track east toward the Singapore approaches, so exposed vessels should expect restricted manoeuvring and slower transit.'
            : 'Scattered rain cells are expected to move east across the strait. Conditions remain manageable, but short visibility reductions are possible.',
          'Use the weather-layer timeline on the map to review each forecast hour from now to +6h.'
        ],
        'Recommended action': [
          severeWeather
            ? 'Hold non-critical arrivals outside the strongest cell, verify reefer telemetry, and prepare the Sunda contingency.'
            : 'Keep Malacca as the primary route, monitor updates, and avoid unnecessary rerouting.'
        ]
      },
      confidence: 'High',
      decision: {
        selectedAction: severeWeather ? 'Prepare Sunda contingency and protect exposed cold-chain cargo.' : 'Maintain Malacca route and monitor the six-hour forecast.',
        recommendation: 'Weather-specific recommendation generated from the current simulated snapshot.',
        confidence: 'High',
        humanValidationRequired: false,
        tradeoffs: { delay: severeWeather ? 2 : 0, cost: severeWeather ? 118 : 100, co2: severeWeather ? 115 : 100, coldChainSafe: true, risk: weather.riskLevel || 'Medium' }
      }
    }
  }

  if (id === 'berth') {
    const terminalSummary = highestTerminals.length
      ? highestTerminals.map(item => `${item.terminalId} ${item.occupancyPercent}% (${item.vesselsWaiting} waiting)`).join('; ')
      : 'terminal detail unavailable'
    return {
      sections: {
        'Port status': [
          `Tuas berth occupancy is ${port.berthOccupancy ?? 72}% with an estimated average delay of ${port.avgDelayHours ?? 18.6} hours.`,
          `The most pressured terminals are ${terminalSummary}.`
        ],
        'Delay reduction plan': [
          `Give priority berthing to ${coldChain.map(item => `${item.id} ${item.vessel}`).join(' and ') || 'critical cold-chain cargo'}.`,
          'Ask routine vessels to slow-steam or accept revised arrival windows before they reach anchorage.',
          'Shift suitable cargo to lower-pressure terminals and confirm receiving teams before assigning the berth.'
        ],
        'Trigger point': [
          Number(port.berthOccupancy) >= 90
            ? 'The congestion playbook should be active now because occupancy is at or above 90%.'
            : 'Prepare the congestion playbook; activate it if occupancy reaches 90% or a critical shipment loses its safe service window.'
        ]
      },
      confidence: 'High',
      decision: {
        selectedAction: 'Prioritise cold-chain cargo, smooth ETAs, and reschedule routine arrivals.',
        recommendation: 'Berth-specific recommendation generated from live dashboard values.',
        confidence: 'High',
        humanValidationRequired: false,
        tradeoffs: { delay: port.avgDelayHours ?? 18.6, cost: 0, co2: 0, coldChainSafe: true, risk: Number(port.berthOccupancy) >= 90 ? 'High' : 'Medium' }
      }
    }
  }

  if (id === 'risk') {
    return {
      sections: {
        'Highest-risk shipments': highRisk.length
          ? highRisk.map(item => `${item.id} — ${item.vessel}: ${item.cargo}; ETA ${item.etaHours}h; ${item.inventoryRisk}.`)
          : ['No shipment is currently classified High or Critical.'],
        'Why they matter': [
          ...coldChain.map(item => `${item.id} requires ${item.temperatureRange} control and is valued at SGD ${Number(item.valueSGD || 0).toLocaleString('en-SG')}.`),
          'Cold-chain integrity and stockout exposure take priority over routine cargo delay.'
        ],
        'Immediate checks': [
          'Confirm reefer temperature, power redundancy, berth sequence, customs readiness, and cold-room receiving capacity.',
          'Escalate only the affected customers; routine low-risk cargo can remain on the planned sequence.'
        ]
      },
      confidence: 'High',
      decision: {
        selectedAction: `Protect ${highRisk.map(item => item.id).join(', ') || 'all high-risk shipments'} first.`,
        recommendation: 'Shipment-risk answer generated from the current 12-shipment snapshot.',
        confidence: 'High',
        humanValidationRequired: false,
        tradeoffs: { delay: null, cost: null, co2: null, coldChainSafe: true, risk: 'High' }
      }
    }
  }

  const routeRecommendation = severeWeather
    ? `Use ${sunda?.name || 'Sunda Strait'} for exposed sea cargo. It adds ${sunda?.deltaDays ?? 2} days, with cost index ${sunda?.costIndex ?? 118} and CO₂ index ${sunda?.co2Index ?? 115}.`
    : `Keep ${malacca?.name || 'Malacca Strait'} as the primary route and pre-authorise ${sunda?.name || 'Sunda Strait'} as the contingency.`

  return {
    sections: {
      'Route comparison': [
        routeRecommendation,
        `${lombok?.name || 'Lombok Strait'} adds ${lombok?.deltaDays ?? 3.5} days and should be used only if both Malacca and Sunda are unsuitable.`
      ],
      'Critical cargo rule': [
        `For 2–8°C pharmaceutical cargo, use partial air freight only when the projected sea delay threatens stockout or cold-chain integrity. Its cost index is ${air?.costIndex ?? 340} and CO₂ index is ${air?.co2Index ?? 610}.`,
        'Do not reroute a vessel merely because an alternate exists; first verify berth slot, weather exposure, cargo buffer, and customer service window.'
      ],
      'Recommendation': [
        severeWeather
          ? 'Activate Sunda for exposed general cargo and reserve air freight for the most time-critical pharmaceutical units.'
          : 'Remain on Malacca, monitor the six-hour weather layer, and keep Sunda paperwork ready without executing the diversion.'
      ]
    },
    confidence: severeWeather ? 'High' : 'Medium',
    decision: {
      selectedAction: severeWeather ? 'Divert exposed sea cargo through Sunda; air-freight only critical pharma units.' : 'Maintain Malacca and pre-authorise Sunda contingency.',
      recommendation: 'Rerouting recommendation compares delay, cost, CO₂, and cold-chain exposure.',
      confidence: severeWeather ? 'High' : 'Medium',
      humanValidationRequired: !severeWeather,
      tradeoffs: { delay: severeWeather ? sunda?.deltaDays ?? 2 : 0, cost: severeWeather ? sunda?.costIndex ?? 118 : 100, co2: severeWeather ? sunda?.co2Index ?? 115 : 100, coldChainSafe: true, risk: severeWeather ? 'Medium' : 'Low' }
    }
  }
}

function pickSummaryLines(sections) {
  const entries = Object.entries(sections || {}).filter(([, lines]) => Array.isArray(lines) && lines.length)
  const actionPattern = /recommend|action|orchestrator|plan|response|next step|trigger/i
  const actionEntries = entries.filter(([key]) => actionPattern.test(key))
  const situationEntries = entries.filter(([key]) => !actionPattern.test(key))

  const situation = (situationEntries.length ? situationEntries : entries)
    .flatMap(([, lines]) => lines)
    .filter(Boolean)
    .slice(0, 2)

  const actions = (actionEntries.length ? actionEntries : entries.slice(-1))
    .flatMap(([, lines]) => lines)
    .filter(Boolean)
    .slice(0, 2)

  return {
    situation: situation.length ? situation : ['Current situation assessed from the latest dashboard snapshot.'],
    actions: actions.length ? actions : ['Continue monitoring and validate any operational change before execution.']
  }
}

function StructuredReply({ sections, confidence, humanValidationRequired, source, dark, vesselId, onSelectVessel }) {
  const [expanded, setExpanded] = useState(false)
  const summary = pickSummaryLines(sections)

  const SummaryBlock = ({ title, lines }) => (
    <div className={`rounded-lg border px-3 py-2 ${dark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <div className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-sky-200' : 'text-blue-900'}`}>{title}</div>
      {lines.map((line, index) => <p key={index} className={dark ? 'text-slate-300' : 'text-slate-700'}>• {line}</p>)}
    </div>
  )

  return (
    <div className="space-y-2 text-[12px] leading-relaxed">
      <div className="flex flex-wrap items-center gap-1.5">
        {confidence && <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${dark ? 'bg-blue-500/10 text-sky-200 border-blue-400/20' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>Confidence: {confidence}</span>}
        {source === 'LIVE' && <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />LIVE</span>}
        {source === 'DEGRADED' && <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-500" />EXPERT RULES</span>}
        {humanValidationRequired && <span className="inline-flex rounded-full border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">Human validation required</span>}
      </div>

      <SummaryBlock title="Situation Summary" lines={summary.situation} />
      <SummaryBlock title="Recommended Actions" lines={summary.actions} />

      <button
        type="button"
        onClick={() => setExpanded(value => !value)}
        className={`w-full rounded-lg border px-3 py-2 text-[10px] font-bold transition ${dark ? 'border-slate-700 text-sky-200 hover:bg-slate-800' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
        aria-expanded={expanded}
      >
        {expanded ? 'Hide Analysis' : 'View Analysis'}
      </button>

      {vesselId && (
        <button
          type="button"
          onClick={() => onSelectVessel?.(vesselId)}
          className={`w-full rounded-lg border px-3 py-2 text-[10px] font-bold transition ${dark ? 'border-blue-700 text-sky-200 hover:bg-slate-800' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}
        >
          View Vessel on Map
        </button>
      )}

      {expanded && (
        <div className="space-y-2">
          {Object.entries(sections || {}).map(([key, lines]) => lines?.length ? (
            <div key={key} className={`rounded-lg border px-3 py-2 ${dark ? 'bg-slate-950 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
              <div className={`mb-1 text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-sky-200' : 'text-blue-900'}`}>{key}</div>
              {lines.map((line, index) => <p key={index} className={dark ? 'text-slate-300' : 'text-slate-700'}>• {line}</p>)}
            </div>
          ) : null)}
        </div>
      )}
    </div>
  )
}

function LiveSettings({ apiKey, setApiKey, llmModel, setLlmModel, mode, setMode, onClose, dark }) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className={`mx-4 mb-3 rounded-xl border p-3 space-y-3 text-xs shrink-0 ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={`text-[11px] font-bold tracking-wide ${dark ? 'text-sky-200' : 'text-[#0b2a69]'}`}>LIVE MODE SETTINGS</p>
          <p className={`mt-0.5 text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>The existing Anthropic API connection is retained.</p>
        </div>
        <button type="button" onClick={onClose} className={`h-7 w-7 rounded-md ${dark ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-500 hover:bg-slate-100'}`} aria-label="Close API settings">×</button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {['MOCK', 'LIVE'].map(item => (
          <button
            type="button"
            key={item}
            onClick={() => setMode(item)}
            className={`rounded-lg border py-2 text-[11px] font-bold transition ${
              mode === item || (mode === 'DEGRADED' && item === 'LIVE')
                ? item === 'LIVE' && mode !== 'DEGRADED'
                  ? 'border-green-600 bg-green-600 text-white'
                  : mode === 'DEGRADED'
                    ? 'border-amber-500 bg-amber-500 text-white'
                    : 'border-blue-700 bg-blue-700 text-white'
                : dark
                  ? 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
            }`}
          >
            {mode === 'DEGRADED' && item === 'LIVE' ? 'DEGRADED' : item}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className={`block text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>API Provider</label>
        <div className={`rounded-lg border px-3 py-2 text-[11px] ${dark ? 'border-slate-700 bg-slate-950 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}>Claude (Anthropic)</div>
      </div>

      <div className="space-y-1.5">
        <label className={`block text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>API Key</label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={event => setApiKey(event.target.value)}
            placeholder="sk-ant-..."
            autoComplete="off"
            className={`w-full rounded-lg border px-3 py-2 pr-16 font-mono text-[11px] outline-none focus:ring-2 focus:ring-blue-200 ${dark ? 'border-slate-700 bg-slate-950 text-slate-100 placeholder:text-slate-600' : 'border-slate-200 bg-white text-slate-800 placeholder:text-slate-400'}`}
          />
          <button type="button" onClick={() => setShowKey(value => !value)} className={`absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[9px] font-semibold ${dark ? 'text-sky-200 hover:bg-slate-800' : 'text-blue-700 hover:bg-blue-50'}`}>
            {showKey ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={`block text-[10px] font-semibold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Model</label>
        <input
          value={llmModel}
          onChange={event => setLlmModel(event.target.value)}
          className={`w-full rounded-lg border px-3 py-2 font-mono text-[11px] outline-none focus:ring-2 focus:ring-blue-200 ${dark ? 'border-slate-700 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-800'}`}
        />
      </div>

      <p className={`rounded-lg border px-3 py-2 text-[10px] leading-relaxed ${dark ? 'border-amber-800 bg-amber-950/30 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        MOCK mode needs no key. LIVE mode uses the API key only for the current browser session and falls back to expert rules if the request fails.
      </p>
    </div>
  )
}

const ChatAdvisor = forwardRef(function ChatAdvisor({
  snapshot,
  onRecommendation,
  onSelectVessel,
  mode = 'MOCK', setMode = () => {},
  apiKey = '', setApiKey = () => {},
  llmModel = DEFAULT_MODEL, setLlmModel = () => {},
  theme = 'light',
  onDegraded = () => {}
}, ref) {
  const [messages, setMessages] = useState(() => buildInitialMessages(snapshot))
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [degradedError, setDegradedError] = useState('')
  const scrollRef = useRef(null)
  const messagesRef = useRef(messages)
  const dark = theme === 'dark'

  useEffect(() => {
    messagesRef.current = messages
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, thinking])

  useImperativeHandle(ref, () => ({
    prefill(text) {
      setInput(text)
      setTimeout(() => document.querySelector('[data-chat-input]')?.focus(), 0)
    },
    pushAlert(text) {
      setMessages(prev => [...prev, { role: 'advisor', plain: text, isAlert: true, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
    }
  }), [])

  const handleModeChange = (nextMode) => {
    setMode(nextMode)
    setDegradedError('')
    onDegraded('')
    if (nextMode === 'LIVE') setShowSettings(true)
  }

  const pushDecision = (result) => {
    if (!result?.decision || !onRecommendation) return
    const d = result.decision
    onRecommendation({
      action: d.selectedAction,
      rationale: d.recommendation,
      confidence: d.confidence,
      // All recommended operational changes pass through the human safegate.
      // This is a UI/state safeguard only and does not alter Claude API requests or parsing.
      humanValidation: true,
      modelRequestedHumanValidation: d.humanValidationRequired,
      tradeoffs: d.tradeoffs,
      timestamp: new Date().toISOString()
    })
  }

  const send = async (text, quickId = null) => {
    const value = (text || input).trim()
    if (!value || thinking) return
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const vesselId = resolveVesselId(value)
    setInput('')
    setMessages(prev => [...prev, { role: 'user', plain: value, time }])
    if (vesselId) onSelectVessel?.(vesselId)
    setThinking(true)

    try {
      let result
      if (mode === 'LIVE') {
        // LIVE mode must be tested through the same path for typed prompts and quick prompts.
        // Any missing key, API error, CORS issue, or timeout falls back to DEGRADED mode.
        try {
          result = await queryLive({ message: value, apiKey, model: llmModel || DEFAULT_MODEL, history: messagesRef.current })
          setDegradedError('')
          onDegraded('')
        } catch (error) {
          const reason = error?.message || 'The LIVE request failed or timed out.'
          setMode('DEGRADED')
          setDegradedError(reason)
          onDegraded(`LIVE request failed or timed out. ${reason}. MOCK expert rules are being used.`)
          result = queryDegraded(value)
        }
      } else if (quickId) {
        await new Promise(resolve => setTimeout(resolve, 180))
        result = { ...buildQuickResponse(quickId, snapshot), source: 'MOCK' }
      } else {
        await new Promise(resolve => setTimeout(resolve, 260))
        result = mode === 'DEGRADED' ? queryDegraded(value) : { ...mockQuery(value), source: 'MOCK' }
      }
      setMessages(prev => [...prev, {
        role: 'advisor',
        structured: result.sections,
        confidence: result.confidence,
        humanValidationRequired: result.humanValidationRequired,
        source: result.source,
        vesselId,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }])
      pushDecision(result)
    } finally {
      setThinking(false)
    }
  }

  const modeLabel = mode === 'DEGRADED' ? 'DEGRADED' : mode
  const modeTone = mode === 'LIVE' ? 'bg-green-500' : mode === 'DEGRADED' ? 'bg-amber-500' : 'bg-blue-500'

  return (
    <aside className={`h-full max-h-full overflow-hidden flex flex-col border-r min-w-0 ${dark ? 'bg-slate-950 border-slate-800' : 'bg-white border-slate-200'}`}>
      <div className="px-5 pt-5 pb-3 shrink-0">
        <div className="flex items-center gap-3">
          <BotIcon />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className={`font-bold text-[17px] truncate ${dark ? 'text-sky-200' : 'text-[#0b2a69]'}`}>AI Logistics Advisor</h2>
              <button type="button" onClick={() => setShowSettings(value => !value)} className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold transition ${showSettings ? 'border-blue-500 bg-blue-50 text-blue-700' : dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                API Settings
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className={`text-[12px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Ask about port status, risks, or options.</p>
              <span className={`flex items-center gap-1 text-[10px] font-bold ${mode === 'DEGRADED' ? 'text-amber-600' : dark ? 'text-slate-300' : 'text-slate-600'}`}><span className={`h-2 w-2 rounded-full ${modeTone}`} />{modeLabel}</span>
            </div>
            <div className="mt-2 flex gap-1.5">
              {['MOCK', 'LIVE'].map(item => (
                <button
                  type="button"
                  key={item}
                  onClick={() => handleModeChange(item)}
                  className={`rounded-md border px-2.5 py-1 text-[9px] font-bold transition ${
                    mode === item || (mode === 'DEGRADED' && item === 'LIVE')
                      ? item === 'LIVE' && mode !== 'DEGRADED'
                        ? 'border-green-600 bg-green-600 text-white'
                        : mode === 'DEGRADED'
                          ? 'border-amber-500 bg-amber-500 text-white'
                          : 'border-blue-700 bg-blue-700 text-white'
                      : dark
                        ? 'border-slate-700 text-slate-400 hover:bg-slate-800'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {mode === 'DEGRADED' && item === 'LIVE' ? 'DEGRADED' : item}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showSettings && (
        <LiveSettings
          apiKey={apiKey}
          setApiKey={setApiKey}
          llmModel={llmModel}
          setLlmModel={setLlmModel}
          mode={mode}
          setMode={handleModeChange}
          onClose={() => setShowSettings(false)}
          dark={dark}
        />
      )}

      {degradedError && (
        <div className={`mx-4 mb-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-[10px] leading-relaxed ${dark ? 'border-amber-800 bg-amber-950/30 text-amber-200' : 'border-amber-300 bg-amber-50 text-amber-900'}`} role="status" aria-live="polite">
          <span className="shrink-0 font-extrabold uppercase tracking-wide">⚠ DEGRADED MODE</span>
          <span className="min-w-0 flex-1 break-words">LIVE request failed or timed out. MOCK expert rules are being used. Reason: {degradedError}</span>
          <button type="button" onClick={() => setDegradedError('')} className="shrink-0 font-bold" aria-label="Dismiss degraded mode details">×</button>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-5 pb-3 space-y-3">
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? 'ml-12' : ''}>
            <div className={`rounded-xl border px-4 py-3 shadow-sm ${
              message.role === 'user'
                ? dark ? 'bg-blue-950/60 border-blue-800 text-sky-100 rounded-br-sm' : 'bg-[#eef6ff] border-blue-200 text-[#0c2c70] rounded-br-sm'
                : message.isAlert
                  ? dark ? 'bg-amber-950/40 border-amber-800 text-amber-100' : 'bg-amber-50 border-amber-200 text-amber-900'
                  : dark ? 'bg-slate-900 border-slate-700 text-slate-200 rounded-bl-sm' : 'bg-white border-slate-200 text-slate-700 rounded-bl-sm'
            }`}>
              {message.structured ? (
                <StructuredReply sections={message.structured} confidence={message.confidence} humanValidationRequired={message.humanValidationRequired} source={message.source} dark={dark} vesselId={message.vesselId} onSelectVessel={onSelectVessel} />
              ) : message.type === 'delay' ? (
                <div className="text-[13px] leading-relaxed">
                  <p>{message.plain}</p>
                  <p className="text-[23px] text-red-500 font-bold my-1">{message.highlight}</p>
                  <p>{message.detail}</p>
                </div>
              ) : message.type === 'vessel' ? (
                <div className="text-[13px] leading-relaxed">
                  <p>{message.plain}</p>
                  <p className={`font-bold ${dark ? 'text-sky-200' : 'text-[#0b2a69]'}`}>{message.highlight} <span className={`font-normal ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{message.detail}</span></p>
                  <button type="button" onClick={() => onSelectVessel?.(message.vesselId || resolveVesselId(message.highlight) || 'SL_TRADER')} className={`mt-3 w-full rounded-lg border font-semibold py-2 transition ${dark ? 'border-blue-700 text-sky-200 hover:bg-slate-800' : 'border-blue-200 text-blue-700 hover:bg-blue-50'}`}>View Vessel Details</button>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed whitespace-pre-line">{message.plain}</p>
              )}
            </div>
            <div className={`mt-1 text-[10px] ${dark ? 'text-slate-500' : 'text-slate-500'} ${message.role === 'user' ? 'text-right' : 'text-right pr-2'}`}>
              {message.time}{message.role === 'user' && <span className="text-blue-500 ml-2">✓✓</span>}
            </div>
          </div>
        ))}
        {thinking && (
          <div className={`rounded-xl border px-4 py-3 w-fit flex items-center gap-1.5 ${dark ? 'border-slate-700 bg-slate-900' : 'border-slate-200 bg-white'}`}>
            <span className="typing-dot"/><span className="typing-dot"/><span className="typing-dot"/>
            {mode === 'LIVE' && <span className={`ml-1 text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Calling Claude API…</span>}
          </div>
        )}
      </div>

      <div className={`shrink-0 border-t px-5 pt-3 pb-4 ${dark ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-white'}`}>
        <p className={`text-[12px] font-bold mb-2 ${dark ? 'text-slate-200' : 'text-slate-700'}`}>Quick questions</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {QUICK_QUESTIONS.map(item => (
            <button key={item.id} type="button" disabled={thinking} onClick={() => send(item.prompt, item.id)} className={`min-h-8 rounded-lg border font-semibold text-[10px] px-2 transition disabled:opacity-50 ${dark ? 'border-slate-700 bg-slate-900 text-sky-200 hover:bg-slate-800' : 'border-slate-200 bg-white text-blue-700 hover:bg-blue-50 hover:border-blue-200'}`}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            data-chat-input
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && !event.shiftKey && send()}
            placeholder={mode === 'LIVE' ? 'Ask Claude about the port...' : 'Type your question...'}
            className={`flex-1 min-w-0 h-10 rounded-lg border px-3 text-[12px] outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 ${dark ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500' : 'border-slate-200 text-slate-800 placeholder:text-slate-400'}`}
          />
          <button type="button" onClick={() => send()} disabled={!input.trim() || thinking} className="h-10 w-10 rounded-lg bg-[#072a74] text-white flex items-center justify-center hover:bg-blue-800 disabled:opacity-40 transition">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
        <p className={`mt-2 text-center text-[9px] ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
          {mode === 'MOCK' && 'MOCK MODE · No API key required'}
          {mode === 'LIVE' && 'LIVE MODE · Anthropic API · Falls back to expert rules on failure'}
          {mode === 'DEGRADED' && 'DEGRADED MODE · LIVE failed · Expert rules active'}
        </p>
      </div>
    </aside>
  )
})

export default ChatAdvisor
