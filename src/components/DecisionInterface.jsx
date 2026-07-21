import React, { useEffect, useMemo, useRef, useState } from 'react'

function TriangleAlert({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" aria-hidden="true">
      <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18A2 2 0 0 0 3.53 21h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    </svg>
  )
}

function makeEntry({ recommendation, status, challenge = '', user = 'demo-user' }) {
  return {
    id: `DEC-${Date.now()}`,
    vesselId: recommendation?.vesselId || null,
    vessel: recommendation?.vesselName || null,
    recommendation: recommendation?.action || 'No action supplied',
    rationale: recommendation?.rationale || '',
    confidence: recommendation?.confidence || 'Medium',
    validationStatus: status,
    challenge: challenge || null,
    user,
    timestamp: new Date().toISOString(),
  }
}

export default function DecisionInterface({
  recommendation,
  onAccept,
  onChallenge,
  onLog,
  theme = 'light',
}) {
  const [status, setStatus] = useState('pending')
  const [challenging, setChallenging] = useState(false)
  const [challengeText, setChallengeText] = useState('')
  const [logged, setLogged] = useState(false)
  const [notice, setNotice] = useState('')
  const [username, setUsername] = useState(() => {
    try { return localStorage.getItem('tmprm_username') || 'demo-user' } catch { return 'demo-user' }
  })
  const previousKey = useRef(null)
  const dark = theme === 'dark'

  const recommendationKey = useMemo(() => {
    if (!recommendation) return null
    return `${recommendation.vesselId || ''}-${recommendation.action || ''}-${recommendation.timestamp || ''}`
  }, [recommendation])

  useEffect(() => {
    if (recommendationKey !== previousKey.current) {
      previousKey.current = recommendationKey
      setStatus('pending')
      setChallenging(false)
      setChallengeText('')
      setLogged(false)
      setNotice('')
    }
  }, [recommendationKey])

  if (!recommendation) return null

  const buildEntry = (nextStatus, challenge = challengeText) =>
    makeEntry({ recommendation, status: nextStatus, challenge, user: username || 'demo-user' })

  const accept = () => {
    const entry = buildEntry('accepted', '')
    setStatus('accepted')
    setChallenging(false)
    setChallengeText('')
    setLogged(false)
    setNotice('Recommendation accepted. It is now approved for execution.')
    onAccept?.(entry)
  }

  const startChallenge = () => {
    setChallenging(true)
    setStatus('pending')
    setLogged(false)
    setNotice('')
  }

  const submitChallenge = () => {
    const reason = challengeText.trim()
    if (!reason) {
      setNotice('Add a reason before submitting the challenge.')
      return
    }
    const entry = buildEntry('challenged', reason)
    setStatus('challenged')
    setChallenging(false)
    setLogged(false)
    setNotice('Recommendation challenged. The proposed change remains blocked.')
    onChallenge?.(entry)
  }

  const logDecision = () => {
    if (status === 'pending') {
      setNotice('Accept or challenge the recommendation before logging the decision.')
      return
    }
    const entry = buildEntry(status)
    onLog?.(entry)
    setLogged(true)
    setNotice('Decision recorded in the local audit log.')
  }

  const statusClasses = status === 'accepted'
    ? dark
      ? 'border-emerald-700 bg-emerald-950/35 text-emerald-200'
      : 'border-emerald-300 bg-emerald-50 text-emerald-800'
    : status === 'challenged'
      ? dark
        ? 'border-amber-700 bg-amber-950/35 text-amber-200'
        : 'border-amber-300 bg-amber-50 text-amber-800'
      : dark
        ? 'border-red-700 bg-red-950/35 text-red-200'
        : 'border-red-300 bg-red-50 text-red-800'

  return (
    <section className={`mx-4 mt-3 overflow-hidden rounded-xl border shadow-sm ${dark ? 'border-slate-700 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-900'}`} aria-label="Human validation safegate">
      <div className={`flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between ${statusClasses}`}>
        <div className="flex min-w-0 items-start gap-3">
          <TriangleAlert className={`mt-0.5 h-6 w-6 shrink-0 ${status === 'pending' ? 'text-red-500' : status === 'challenged' ? 'text-amber-500' : 'text-emerald-500'}`} />
          <div className="min-w-0">
            <h2 className="text-[13px] font-extrabold uppercase tracking-wide">
              {status === 'pending' ? 'Human validation needed' : status === 'accepted' ? 'Human validation accepted' : 'Recommendation challenged'}
            </h2>
            <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
              {status === 'pending'
                ? 'Safegate active: no AI-recommended operational change is approved until a user selects Accept.'
                : status === 'accepted'
                  ? 'The recommendation is approved for execution. Log the decision to create an audit record.'
                  : 'The recommendation is blocked and must be reviewed or revised before it can be applied.'}
            </p>
          </div>
        </div>
        <div className={`shrink-0 rounded-lg border px-3 py-2 text-[10px] ${dark ? 'border-slate-600 bg-slate-950/55' : 'border-white/70 bg-white/65'}`}>
          <label className="flex items-center gap-2">
            <span className="font-semibold">Validator</span>
            <input
              value={username}
              onChange={(event) => {
                const next = event.target.value.slice(0, 40)
                setUsername(next)
                try { localStorage.setItem('tmprm_username', next) } catch {}
              }}
              className={`w-32 rounded-md border px-2 py-1 outline-none focus:border-blue-400 ${dark ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-300 bg-white text-slate-800'}`}
              aria-label="Validator name"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-3 px-4 py-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className={`text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Recommended change</div>
          <div className={`mt-1 text-[13px] font-bold ${dark ? 'text-sky-200' : 'text-[#092a70]'}`}>{recommendation.action}</div>
          {recommendation.rationale && (
            <p className={`mt-1 line-clamp-2 text-[11px] leading-relaxed ${dark ? 'text-slate-300' : 'text-slate-600'}`}>{recommendation.rationale}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-2 text-[9px]">
            <span className={`rounded-full border px-2 py-1 ${dark ? 'border-slate-600 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Confidence: {recommendation.confidence || 'Medium'}</span>
            {recommendation.vesselName && <span className={`rounded-full border px-2 py-1 ${dark ? 'border-slate-600 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Vessel: {recommendation.vesselName}</span>}
            <span className={`rounded-full border px-2 py-1 font-bold ${status === 'accepted' ? 'border-emerald-400 text-emerald-500' : status === 'challenged' ? 'border-amber-400 text-amber-500' : 'border-red-400 text-red-500'}`}>Status: {status}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <button
            type="button"
            onClick={accept}
            className={`h-10 min-w-28 rounded-lg px-4 text-[11px] font-bold transition ${status === 'accepted' ? 'bg-emerald-600 text-white ring-2 ring-emerald-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {status === 'accepted' ? 'Accepted ✓' : 'Accept'}
          </button>
          <button
            type="button"
            onClick={startChallenge}
            className={`h-10 min-w-28 rounded-lg border px-4 text-[11px] font-bold transition ${status === 'challenged' ? 'border-amber-500 bg-amber-500 text-white' : dark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            Challenge
          </button>
          <button
            type="button"
            onClick={logDecision}
            aria-disabled={status === 'pending'}
            title={status === 'pending' ? 'Accept or challenge first' : 'Record this validated decision'}
            className={`h-10 min-w-28 rounded-lg border px-4 text-[11px] font-bold transition ${logged ? 'border-emerald-500 text-emerald-500' : status === 'pending' ? dark ? 'cursor-not-allowed border-slate-700 text-slate-600' : 'cursor-not-allowed border-slate-200 text-slate-400' : dark ? 'border-slate-600 text-slate-200 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            {logged ? 'Logged ✓' : 'Log decision'}
          </button>
        </div>
      </div>

      {challenging && (
        <div className={`border-t px-4 py-3 ${dark ? 'border-slate-700 bg-slate-950/45' : 'border-slate-200 bg-slate-50'}`}>
          <label className={`block text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Challenge reason</label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <textarea
              value={challengeText}
              onChange={(event) => setChallengeText(event.target.value)}
              rows={2}
              placeholder="Explain why this recommendation should be revised or blocked..."
              className={`min-h-16 flex-1 resize-y rounded-lg border px-3 py-2 text-[12px] outline-none focus:border-amber-400 ${dark ? 'border-slate-700 bg-slate-900 text-slate-100 placeholder-slate-500' : 'border-slate-300 bg-white text-slate-800 placeholder-slate-400'}`}
              autoFocus
            />
            <div className="flex gap-2 sm:flex-col">
              <button type="button" onClick={submitChallenge} className="h-9 rounded-lg bg-amber-500 px-4 text-[11px] font-bold text-white hover:bg-amber-600">Submit challenge</button>
              <button type="button" onClick={() => { setChallenging(false); setNotice('') }} className={`h-9 rounded-lg border px-4 text-[11px] font-bold ${dark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-300 text-slate-700 hover:bg-white'}`}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className={`border-t px-4 py-2 text-[10px] font-semibold ${dark ? 'border-slate-700 bg-slate-950/45 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-600'}`} role="status">
          {notice}
        </div>
      )}
    </section>
  )
}
