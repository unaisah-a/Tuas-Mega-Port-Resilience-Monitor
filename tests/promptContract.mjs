// tests/promptContract.mjs
// Verifies the system prompt covers the three graded specification bullets and
// that MOCK mode enforces the same domain boundary the prompt declares.
// Run: npm run test:prompt

import { SYSTEM_PROMPT, PERSONA, CONSTRAINTS, ACTION_LOGIC, STYLE } from '../src/agent/prompts/index.js'
import { query } from '../src/agent/mockBrain.js'

let failures = 0
function check(label, condition) {
  if (!condition) {
    console.error(`FAIL: ${label}`)
    failures++
  }
}

// ── 1. Assignment §4 coverage ────────────────────────────────────────────────
check('Persona module is included in the assembled prompt', SYSTEM_PROMPT.includes(PERSONA))
check('Constraints module is included', SYSTEM_PROMPT.includes(CONSTRAINTS))
check('Action Logic module is included', SYSTEM_PROMPT.includes(ACTION_LOGIC))
check('Output contract is included', SYSTEM_PROMPT.includes(STYLE))

check('Persona names the role', /Senior Logistics Planner/i.test(PERSONA))
check('Persona states the advisor authority limit', /no authority/i.test(PERSONA))
check('Constraints prioritise cold chain over cost', /cold-chain integrity \(2-8°C\) always outranks cost/i.test(CONSTRAINTS))
check('Constraints forbid inventing figures', /never from memory/i.test(CONSTRAINTS))
check('Constraints define a domain boundary', /STAY INSIDE THE DOMAIN/i.test(CONSTRAINTS))
check('Action logic covers conflicting reports', /CONFLICTING REPORTS/i.test(ACTION_LOGIC))
check('Action logic covers out-of-distribution data', /OUT-OF-DISTRIBUTION DATA/i.test(ACTION_LOGIC))
check('Action logic requires human validation at Low confidence', /HUMAN VALIDATION REQUIRED/i.test(ACTION_LOGIC))

// ── 2. Output contract matches the LIVE parser in liveBrain.js ───────────────
for (const heading of ['LOGISTICS view', 'INVENTORY view', 'PROCUREMENT view', 'ORCHESTRATOR recommendation', 'Confidence', 'Data used']) {
  check(`Output contract declares "${heading}" (parsed by liveBrain.js)`, STYLE.includes(heading))
}

// ── 3. MOCK mode enforces the same domain boundary ──────────────────────────
const outOfDomain = [
  'Who is winning the World Cup',
  'What is the capital of France?',
  'Write me a python script to sort a list',
  'Tell me a joke'
]
for (const q of outOfDomain) {
  const r = query(q)
  check(`Declines out-of-domain query: "${q}"`, r.outOfDomain === true)
  check(`Uses no snapshot data when declining: "${q}"`, /No snapshot data used/i.test(r.dataUsed.join(' ')))
}

const inDomain = [
  'What is the berth occupancy at Tuas?',
  'Which shipments are high risk right now?',
  'Berth occupancy has reached 92%. How can we minimise delays?',
  'A tropical storm is expected in the Malacca Strait and my vessel carrying pharmaceutical products will arrive 48 hours late. What should I do?',
  'Should I reroute via Sunda?',
  'SHP-2041 status',
  'SL TRADER'
]
for (const q of inDomain) {
  check(`Answers in-domain query: "${q.slice(0, 50)}"`, query(q).outOfDomain !== true)
}

// Greetings are neither declined nor treated as operational queries
check('Greeting receives a capability answer, not a refusal', query('hello, what can you do?').outOfDomain !== true)

if (failures) {
  console.error(`\nPrompt contract FAILED: ${failures} check(s).`)
  process.exit(1)
}
console.log(`Prompt contract passed: persona/constraints/action-logic present, ${SYSTEM_PROMPT.length} chars assembled, domain boundary enforced in MOCK mode.`)
