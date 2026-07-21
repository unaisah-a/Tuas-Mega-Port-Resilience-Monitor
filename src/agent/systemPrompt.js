// src/agent/systemPrompt.js
//
// Kept as a compatibility re-export. The system prompt now lives in
// src/agent/prompts/, split into persona / constraints / actionLogic / style
// so each part maps visibly to the assignment's System Prompting requirements.
//
// Import from here or from './prompts/index.js' — both give the same string.

export { SYSTEM_PROMPT, PERSONA, CONSTRAINTS, ACTION_LOGIC, STYLE, IN_DOMAIN_TOPICS } from './prompts/index.js'
