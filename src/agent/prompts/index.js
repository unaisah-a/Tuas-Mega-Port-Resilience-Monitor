// src/agent/prompts/index.js
//
// Assembles the system prompt from four modules, each mapping to a part of the
// assignment's Knowledge Grounding & System Prompting specification:
//
//   persona.js      → §4 bullet 1: Persona
//   constraints.js  → §4 bullet 2: Constraints
//   actionLogic.js  → §4 bullet 3: Action Logic (out-of-distribution / conflicts)
//   style.js        → output contract parsed by liveBrain.js
//
// The prompt is split into modules rather than one long string so that each
// requirement can be reviewed, cited, and revised on its own. The assembled
// string is what is actually sent to the model as the `system` parameter.

import { PERSONA } from './persona.js'
import { CONSTRAINTS, IN_DOMAIN_TOPICS } from './constraints.js'
import { ACTION_LOGIC } from './actionLogic.js'
import { STYLE } from './style.js'

export const SYSTEM_PROMPT = [
  '=== PERSONA ===',
  PERSONA,
  '',
  '=== CONSTRAINTS ===',
  CONSTRAINTS,
  '',
  '=== ACTION LOGIC ===',
  ACTION_LOGIC,
  '',
  '=== OUTPUT CONTRACT ===',
  STYLE
].join('\n')

export { PERSONA, CONSTRAINTS, ACTION_LOGIC, STYLE, IN_DOMAIN_TOPICS }
