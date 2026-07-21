// src/agent/liveBrain.js
// LIVE mode brain — calls Anthropic Claude directly from the browser.
//
// NOTE: Client-side API keys are acceptable for a classroom/demo prototype.
// In production, route through a backend proxy (Node/Express or similar) so the
// API key is never exposed in browser traffic. The backend proxy would forward
// requests to https://api.anthropic.com and return the response. MOCK MODE
// is always independent of any backend and never requires an API key.

import { query as mockQuery } from './mockBrain.js'
import { SYSTEM_PROMPT } from './systemPrompt.js'
import { getSnapshot } from '../data/simulation.js'

export const DEFAULT_MODEL = 'claude-opus-4-8'
const API_URL = 'https://api.anthropic.com/v1/messages'
const TIMEOUT_MS = 30000  // 30 seconds

// ─── Response parsing ─────────────────────────────────────────────────────────

// Extract the 4 structured sections from a free-text LLM response.
// Claude is instructed to use the exact headings from the system prompt.
function parseStructured(text) {
  const sections = {}

  const patterns = {
    logistics: /LOGISTICS\s+view\s*[:\-]?\s*([\s\S]*?)(?=\n\s*INVENTORY\s+view|$)/i,
    inventory: /INVENTORY\s+view\s*[:\-]?\s*([\s\S]*?)(?=\n\s*PROCUREMENT\s+view|$)/i,
    procurement: /PROCUREMENT\s+view\s*[:\-]?\s*([\s\S]*?)(?=\n\s*ORCHESTRATOR\s+recommendation|$)/i,
    orchestrator: /ORCHESTRATOR\s+recommendation\s*[:\-]?\s*([\s\S]*?)(?=\n\s*(?:Confidence|Decision Interface|Data used)|$)/i
  }

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = text.match(pattern)
    if (match) {
      const lines = match[1]
        .split('\n')
        .map(l => l.replace(/^[-•*›]\s*/, '').trim())
        .filter(l => l.length > 10)
      if (lines.length) sections[key] = lines
    }
  }

  // If parsing failed, dump everything into orchestrator
  if (!Object.keys(sections).length) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    sections.orchestrator = lines
  }

  return sections
}

function parseConfidence(text) {
  const match = text.match(/Confidence\s*[:\-]\s*(High|Medium|Low)/i)
  return match ? match[1] : 'Medium'
}

function parseHVR(text) {
  return /HUMAN\s+VALIDATION\s+REQUIRED/i.test(text)
}

function buildDecision(text, sections, confidence) {
  // Try to extract a concise selected action from the orchestrator section
  const orchLines = sections.orchestrator || []
  const firstAction = orchLines.find(l => /recommend|action|decision|prioriti|unload|reroute|hold|expedite/i.test(l))
  const selectedAction = firstAction
    ? firstAction.replace(/^(Recommended action|Decision|Action)\s*[:\-]\s*/i, '').slice(0, 120)
    : 'LIVE recommendation — see ORCHESTRATOR view'

  const recommendation = orchLines.slice(0, 2).join(' ').slice(0, 300) || text.slice(0, 300)

  return {
    recommendation,
    selectedAction,
    confidence,
    humanValidationRequired: parseHVR(text),
    tradeoffs: {
      delay: null,
      cost: null,
      co2: null,
      coldChainSafe: /cold.?chain.*protect|protect.*cold.?chain|2-8|temperature.*safe/i.test(text) ? true : null,
      risk: confidence === 'High' ? 'Low' : confidence === 'Medium' ? 'Medium' : 'High'
    },
    dataUsed: ['LIVE — Claude response citing snapshot data per system prompt']
  }
}

// ─── LIVE query ───────────────────────────────────────────────────────────────

export async function queryLive({ message, apiKey, model = DEFAULT_MODEL, history = [] }) {
  if (!apiKey?.trim()) throw new Error('No API key provided')

  const snap = getSnapshot()

  // Build context messages: last 6 chat turns (user + advisor), then current user message
  const contextMessages = history
    .filter(m => m.plain || (m.structured && m.role === 'advisor'))
    .slice(-6)
    .map(m => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.plain
        || Object.values(m.structured || {}).flat().join('\n')
        || '[structured advisor response]'
    }))

  // Snapshot is attached to the user turn so Claude sees fresh data each request
  const snapshotSummary = {
    generatedAt: snap.generatedAt,
    weather: snap.weather,
    portSummary: snap.portSummary,
    shipments: snap.shipments.map(s => ({
      id: s.id, vessel: s.vessel, cargo: s.cargo, isColdChain: s.isColdChain,
      temperatureRange: s.temperatureRange, priority: s.priority, riskLevel: s.riskLevel,
      etaHours: s.etaHours, status: s.status, inventoryRisk: s.inventoryRisk,
      valueSGD: s.valueSGD, customer: s.customer
    })),
    routes: snap.routes,
    orchestrationSignals: snap.orchestrationSignals
  }

  const userContent = `Current simulated snapshot (JSON — use only this data, do not invent facts):\n${JSON.stringify(snapshotSummary, null, 2)}\n\nUser query: ${message}`

  const messages = [...contextMessages, { role: 'user', content: userContent }]

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1800,
        system: SYSTEM_PROMPT,
        messages
      })
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.error?.message || `API error HTTP ${response.status}`)
    }

    const data = await response.json()
    const text = data?.content?.[0]?.text?.trim() || ''
    if (!text) throw new Error('Empty response from Claude API')

    const sections = parseStructured(text)
    const confidence = parseConfidence(text)
    const humanValidationRequired = parseHVR(text)
    const decision = buildDecision(text, sections, confidence)

    return { sections, confidence, humanValidationRequired, decision, source: 'LIVE', rawText: text }
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

// ─── Degraded fallback ────────────────────────────────────────────────────────

// Called when LIVE fails. Returns the MOCK response tagged as DEGRADED.
export function queryDegraded(message) {
  const result = mockQuery(message)
  return { ...result, source: 'DEGRADED' }
}
