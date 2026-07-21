import React, { useState, useCallback } from 'react'
import {
  PRESETS,
  runSimulation,
  runChallenge,
  logWhatIfDecision,
  getDecisionLog,
  clearDecisionLog
} from '../engine/whatIfEngine.js'
import { getSnapshot } from '../data/simulation.js'

// ─── Styles ───────────────────────────────────────────────────────────────────

const CONF_CHIP = {
  High:   'bg-green-500/15 text-green-400 border-green-500/30',
  Medium: 'bg-accent-500/15 text-accent-500 border-accent-500/30',
  Low:    'bg-red-500/15 text-red-400 border-red-500/30'
}
const CONF_DOT = { High: 'bg-green-400', Medium: 'bg-accent-500', Low: 'bg-red-400' }

const RISK_ROW = {
  High:   'text-red-400',
  Medium: 'text-accent-500',
  Low:    'text-green-400',
  'Low / Medium': 'text-accent-500',
  'Medium (could escalate to High)': 'text-accent-500',
  'Low / Medium (contingency only)': 'text-green-400'
}

const SECTION_COLOR = {
  logistics:   'text-sea-400',
  inventory:   'text-green-400',
  procurement: 'text-accent-500'
}

// ─── Reusable sub-components ──────────────────────────────────────────────────

function SectionBlock({ title, colorClass, lines }) {
  const [open, setOpen] = useState(true)
  if (!lines?.length) return null
  return (
    <div className="bg-navy-900/50 border border-navy-600/40 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-navy-700/30 transition">
        <span className={`text-[10px] font-bold tracking-widest ${colorClass}`}>{title}</span>
        <svg className={`w-3 h-3 text-navy-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-2.5 space-y-1">
          {lines.map((line, i) => (
            <p key={i} className="text-[11px] text-navy-100 leading-relaxed">
              <span className={`${colorClass} mr-1`}>›</span>{line}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

function ConfidenceBadge({ confidence, humanValidationRequired }) {
  if (!confidence) return null
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`chip border ${CONF_CHIP[confidence] || CONF_CHIP.Medium}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${CONF_DOT[confidence] || CONF_DOT.Medium}`} />
        Confidence: {confidence}
      </span>
      {humanValidationRequired && (
        <span className="chip border bg-red-500/15 text-red-300 border-red-500/40">
          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          HUMAN VALIDATION REQUIRED
        </span>
      )}
    </div>
  )
}

// ─── 3-option comparison table ────────────────────────────────────────────────

function OptionsTable({ options, recommended }) {
  const cols = ['Option', 'Delta Transit', 'Delta Cost', 'Risk', 'Delta CO2', 'Cold-chain Safe']
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr className="border-b border-navy-600/60">
            {cols.map(c => (
              <th key={c} className="text-left text-[10px] font-bold uppercase tracking-wider text-navy-300 px-2.5 py-1.5 whitespace-nowrap">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {options.map((opt, i) => {
            const isRec = opt.id === recommended
            return (
              <tr
                key={opt.id}
                className={`border-b border-navy-700/40 transition ${
                  isRec
                    ? 'bg-accent-500/8 border-l-2 border-l-accent-500'
                    : 'hover:bg-navy-700/20'
                }`}
              >
                <td className="px-2.5 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold ${isRec ? 'text-accent-400' : 'text-navy-50'}`}>
                      {i + 1}. {opt.label}
                    </span>
                    {isRec && (
                      <span className="chip bg-accent-500/20 text-accent-400 border border-accent-500/40 text-[9px] px-1 py-0 leading-tight">RECOMMENDED</span>
                    )}
                  </div>
                </td>
                <td className="px-2.5 py-2 text-navy-200 max-w-[140px]">{opt.deltaTransit}</td>
                <td className="px-2.5 py-2 text-navy-200 max-w-[120px]">{opt.deltaCost}</td>
                <td className="px-2.5 py-2">
                  <span className={RISK_ROW[opt.risk] || 'text-navy-200'}>{opt.risk}</span>
                </td>
                <td className="px-2.5 py-2 text-navy-200 max-w-[120px]">{opt.deltaCO2}</td>
                <td className="px-2.5 py-2">
                  <div className="flex items-center gap-1">
                    {opt.coldChainSafe
                      ? <span className="text-green-400 font-semibold">Yes</span>
                      : <span className="text-red-400 font-semibold">No</span>
                    }
                  </div>
                  <p className="text-[10px] text-navy-400 mt-0.5 leading-relaxed max-w-[180px]">
                    {opt.coldChainNote}
                  </p>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Challenge result panel ───────────────────────────────────────────────────

function ChallengePanel({ challengeResult }) {
  if (!challengeResult) return null
  const refused = !challengeResult.accepted
  return (
    <div className={`rounded-lg border p-3 space-y-2 slide-up ${
      refused
        ? 'bg-red-500/8 border-red-500/40'
        : challengeResult.type === 'lombok_partial' || challengeResult.type === 'lombok_refused_for_pharma'
        ? 'bg-amber-500/8 border-amber-500/30'
        : 'bg-green-500/8 border-green-500/30'
    }`}>
      <div className="flex items-center gap-2">
        {refused
          ? <svg className="w-4 h-4 text-red-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          : <svg className="w-4 h-4 text-green-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3L22 4"/></svg>
        }
        <span className={`text-[11px] font-bold ${refused ? 'text-red-300' : 'text-green-300'}`}>
          {refused ? 'Challenge Refused' : 'Challenge Accepted — Re-evaluated'}
        </span>
      </div>
      {challengeResult.lombokSpecs && (
        <div className="flex gap-4 bg-navy-900/40 rounded-lg px-3 py-1.5 text-[11px]">
          <span className="text-navy-300">+{challengeResult.lombokSpecs.deltaDays} days</span>
          <span className="text-navy-300">Cost index {challengeResult.lombokSpecs.costIndex}</span>
          <span className="text-navy-300">CO2 index {challengeResult.lombokSpecs.co2Index}</span>
        </div>
      )}
      <div className="space-y-1">
        {challengeResult.message.map((line, i) => (
          <p key={i} className={`text-[11px] leading-relaxed ${
            refused ? 'text-red-200' : 'text-navy-100'
          }`}>
            {i === 0 ? <strong>{line}</strong> : line}
          </p>
        ))}
      </div>
      <ConfidenceBadge confidence={challengeResult.confidence} humanValidationRequired={challengeResult.humanValidationRequired} />
    </div>
  )
}

// ─── Decision log panel ───────────────────────────────────────────────────────

function DecisionLogPanel({ log, onClear }) {
  if (!log.length) return null
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-sea-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          <h3 className="text-sm font-semibold tracking-wide text-navy-50">WHAT-IF DECISION LOG</h3>
          <span className="chip bg-navy-700/60 text-navy-300 border border-navy-600/50">
            Simulated hash-chain audit trail for classroom demonstration
          </span>
        </div>
        <button onClick={onClear} className="text-[10px] text-navy-300 hover:text-red-400 transition">Clear log</button>
      </div>
      <div className="p-2 space-y-1.5 max-h-52 overflow-y-auto">
        {log.map(entry => (
          <div key={entry.id} className="bg-navy-900/40 border border-navy-600/30 rounded-lg px-3 py-2 slide-up">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-navy-300">{entry.id}</span>
                <span className={`text-[9px] px-1.5 rounded-full border ${CONF_CHIP[entry.confidence] || CONF_CHIP.Medium}`}>
                  {entry.confidence}
                </span>
                {entry.humanValidationRequired && (
                  <span className="text-[9px] text-red-400 font-semibold">HVR</span>
                )}
              </div>
              <span className="text-[9px] font-mono text-navy-400">{new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="text-[11px] text-navy-100 mt-0.5 font-medium truncate">{entry.scenario}</p>
            <p className="text-[10px] text-navy-300 truncate">{entry.selectedAction}</p>
            {entry.challengeApplied && (
              <p className="text-[10px] text-amber-400 mt-0.5">Challenge: {entry.challengeApplied.constraint?.slice(0, 60)}</p>
            )}
            {/* Hash-chain display */}
            <div className="flex items-center gap-1.5 mt-1.5 text-[9px] font-mono">
              <span className="text-navy-500">prev:</span>
              <span className="text-navy-500 bg-navy-900 px-1 rounded">{entry.previousHash}</span>
              <svg className="w-2.5 h-2.5 text-navy-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-7-7l7 7-7 7"/></svg>
              <span className="text-navy-400">hash:</span>
              <span className="text-sea-400 bg-navy-900 px-1 rounded">{entry.currentHash}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main WhatIfSimulator ─────────────────────────────────────────────────────

export default function WhatIfSimulator({ onRecommendation }) {
  const [preset, setPreset]                 = useState('')
  const [freeText, setFreeText]             = useState('')
  const [result, setResult]                 = useState(null)
  const [running, setRunning]               = useState(false)
  const [challengeInput, setChallengeInput] = useState('')
  const [challengeResult, setChallengeResult] = useState(null)
  const [isEvaluating, setIsEvaluating]     = useState(false)
  const [log, setLog]                       = useState(() => getDecisionLog())
  const [loggedId, setLoggedId]             = useState(null)

  const pushDecision = useCallback((dec) => {
    if (dec && onRecommendation) onRecommendation(dec)
  }, [onRecommendation])

  const handleRun = useCallback(() => {
    if (!preset && !freeText.trim()) return
    setRunning(true)
    setChallengeResult(null)
    setChallengeInput('')
    setLoggedId(null)
    // Deterministic — no async needed, but small delay for UX feedback
    setTimeout(() => {
      const snap = getSnapshot()
      const r = runSimulation(preset, freeText, snap)
      setResult(r)
      pushDecision(r.decision)
      setRunning(false)
    }, 320)
  }, [preset, freeText, pushDecision])

  const handleChallenge = useCallback(() => {
    if (!challengeInput.trim() || !result) return
    setIsEvaluating(true)
    setTimeout(() => {
      const snap = getSnapshot()
      const cr = runChallenge(challengeInput, result, snap)
      setChallengeResult({ ...cr, constraint: challengeInput })
      pushDecision(cr.decision)
      setIsEvaluating(false)
    }, 280)
  }, [challengeInput, result, pushDecision])

  const handleLog = useCallback(() => {
    if (!result) return
    const updated = logWhatIfDecision(result, challengeResult, 'demo-user')
    setLog(updated)
    setLoggedId(result.timestamp)
    setTimeout(() => setLoggedId(null), 2500)
  }, [result, challengeResult])

  const handleClearLog = useCallback(() => {
    if (confirm('Clear what-if decision log?')) {
      const updated = clearDecisionLog()
      setLog([])
    }
  }, [])

  const rec = result?.recommendation

  return (
    <div className="space-y-3">
      {/* ── Main simulator card ──────────────────────────────────────────── */}
      <div className="card">
        {/* Header */}
        <div className="card-header">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <h3 className="text-sm font-semibold tracking-wide text-navy-50">WHAT-IF SIMULATOR</h3>
            <span className="chip bg-accent-500/15 text-accent-500 border border-accent-500/30 text-[10px]">Digital Orchestrator Demo</span>
          </div>
          <span className="chip bg-sea-400/15 text-sea-400 border border-sea-400/30 text-[10px]">
            <span className="w-1.5 h-1.5 rounded-full bg-sea-400" />MOCK MODE · No API key required
          </span>
        </div>

        <div className="p-3 grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* ── LEFT: Inputs ──────────────────────────────────────────────── */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-navy-300 mb-1.5">Simulate Disruption</label>
              <select
                value={preset}
                onChange={e => setPreset(e.target.value)}
                className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-xs text-navy-50 focus:outline-none focus:ring-1 focus:ring-accent-500"
              >
                <option value="">— Select a disruption preset —</option>
                {PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-navy-300 mb-1.5">
                Free-text scenario <span className="text-navy-500 normal-case">(or describe your own)</span>
              </label>
              <textarea
                value={freeText}
                onChange={e => setFreeText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.ctrlKey && handleRun()}
                placeholder="e.g. A tropical cyclone is closing the Malacca Strait for 48h. We have two pharma vessels inbound..."
                rows={3}
                className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-xs text-navy-50 placeholder-navy-500 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-none"
              />
              <p className="text-[9px] text-navy-500 mt-0.5">Ctrl+Enter to run · Classified to nearest preset automatically</p>
            </div>

            <button
              onClick={handleRun}
              disabled={running || (!preset && !freeText.trim())}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {running ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white blink" />Running simulation…
                </span>
              ) : (
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  Run what-if
                </span>
              )}
            </button>

            {/* ── Challenge loop ────────────────────────────────────────── */}
            {result && (
              <div className="border-t border-navy-600/50 pt-3 space-y-2">
                <label className="block text-[10px] uppercase tracking-wider text-navy-300">
                  Challenge recommendation
                </label>
                <textarea
                  value={challengeInput}
                  onChange={e => setChallengeInput(e.target.value)}
                  placeholder='Impose a constraint, e.g. "Use Lombok instead" or "Minimise CO2 if pharma is protected"'
                  rows={2}
                  className="w-full bg-navy-900 border border-navy-600 rounded-lg px-3 py-2 text-xs text-navy-50 placeholder-navy-500 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-none"
                />
                <button
                  onClick={handleChallenge}
                  disabled={isEvaluating || !challengeInput.trim()}
                  className="btn-outline w-full text-xs disabled:opacity-40"
                >
                  {isEvaluating ? 'Re-evaluating…' : 'Re-evaluate'}
                </button>

                {challengeResult && <ChallengePanel challengeResult={challengeResult} />}
              </div>
            )}

            {/* Log button */}
            {result && (
              <button
                onClick={handleLog}
                className={`btn-ghost w-full text-xs transition ${loggedId ? 'text-green-400 border-green-500/30' : ''}`}
              >
                {loggedId ? '✓ Decision Logged' : 'Log decision'}
              </button>
            )}
          </div>

          {/* ── RIGHT: Results ────────────────────────────────────────────── */}
          {result ? (
            <div className="space-y-3">
              {/* A. Situation summary */}
              <div className="bg-navy-900/60 border border-navy-600/40 rounded-lg px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-wider text-navy-400 mb-1">A. Situation Summary</div>
                <p className="text-[12px] text-navy-50 font-medium leading-relaxed">{result.situationSummary}</p>
              </div>

              {/* B. Affected shipment count */}
              <div className="flex items-center gap-3 bg-navy-900/40 border border-navy-600/40 rounded-lg px-3 py-2">
                <div className="text-[10px] uppercase tracking-wider text-navy-400">B. Affected Shipments</div>
                <span className="text-sm font-mono font-bold text-red-400">{result.affectedCount}</span>
                <span className="text-xs text-navy-300">of {result.totalCount}</span>
                <div className="flex gap-1 flex-wrap">
                  {result.affectedShipments.slice(0, 6).map(s => (
                    <span key={s.id} className={`chip border text-[9px] ${s.isColdChain && s.temperatureRange === '2-8 C' ? 'bg-red-500/15 text-red-400 border-red-500/30' : 'bg-navy-700/60 text-navy-300 border-navy-600/40'}`}>
                      {s.id}
                    </span>
                  ))}
                  {result.affectedShipments.length > 6 && (
                    <span className="chip border bg-navy-700/40 text-navy-400 border-navy-600/30 text-[9px]">+{result.affectedShipments.length - 6} more</span>
                  )}
                </div>
              </div>

              {/* C. 3-option comparison table */}
              <div className="bg-navy-900/40 border border-navy-600/40 rounded-lg overflow-hidden">
                <div className="text-[10px] uppercase tracking-wider text-navy-400 px-3 py-1.5 border-b border-navy-600/40">
                  C. 3-Option Comparison
                </div>
                <div className="p-1">
                  <OptionsTable options={result.options} recommended={result.recommended} />
                </div>
              </div>

              {/* D. Orchestrator recommendation */}
              <div className="bg-navy-800/60 border border-accent-500/20 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-navy-600/40 bg-accent-500/5">
                  <svg className="w-3.5 h-3.5 text-accent-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-accent-500">D. Orchestrator Recommendation</span>
                </div>
                <div className="p-3 space-y-2">
                  <SectionBlock title="LOGISTICS" colorClass="text-sea-400" lines={rec.logistics} />
                  <SectionBlock title="INVENTORY" colorClass="text-green-400" lines={rec.inventory} />
                  <SectionBlock title="PROCUREMENT" colorClass="text-accent-500" lines={rec.procurement} />

                  {/* Trade-off */}
                  <div className="bg-navy-900/60 border border-navy-600/30 rounded-lg px-3 py-2">
                    <p className="text-[11px] text-navy-100 leading-relaxed">{rec.tradeoff}</p>
                  </div>

                  {/* Cold-chain statement — always visible */}
                  <div className="flex items-center gap-2 bg-sea-400/8 border border-sea-400/30 rounded-lg px-3 py-2">
                    <span className="text-sea-400 text-sm">❄</span>
                    <p className="text-[12px] font-bold text-sea-300">{rec.coldChainStatement}</p>
                  </div>

                  {/* E. Confidence */}
                  <div className="pt-1">
                    <div className="text-[10px] uppercase tracking-wider text-navy-400 mb-1.5">E. Confidence</div>
                    <ConfidenceBadge confidence={result.confidence} humanValidationRequired={result.humanValidationRequired} />
                  </div>

                  {/* F. Data used */}
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-navy-400 mb-1">F. Data used</div>
                    <p className="text-[10px] text-navy-400 leading-relaxed bg-navy-900/40 rounded-lg px-2.5 py-1.5 border border-navy-700/40">
                      {result.dataUsed}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <svg className="w-12 h-12 text-navy-600 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <p className="text-sm text-navy-300 font-medium">Select a disruption preset and run the simulation</p>
              <p className="text-xs text-navy-500 mt-1.5 max-w-64">Every simulation generates a 3-option comparison table and a full Orchestrator recommendation, then updates the Decision Interface above.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Decision log ─────────────────────────────────────────────────── */}
      <DecisionLogPanel log={log} onClear={handleClearLog} />
    </div>
  )
}
