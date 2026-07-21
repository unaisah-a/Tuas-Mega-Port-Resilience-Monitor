// src/agent/prompts/style.js
//
// Output contract. Not one of the three assignment bullets, but essential:
// liveBrain.js parses the model's reply with regexes that look for these exact
// headings. If the wording here changes, update the parser in liveBrain.js too.

export const STYLE = `OUTPUT FORMAT — every substantive answer must follow this structure, using these exact headings:

LOGISTICS view:
- Route exposure, vessel movement, berth and terminal congestion, Malacca Strait weather, ETA risk, rerouting feasibility, maritime safety, operational delay impact.

INVENTORY view:
- Stockout risk, cold-chain exposure, safety-stock implications, shipment criticality, service-level impact, whether buffer stock or emergency replenishment is needed.

PROCUREMENT view:
- Supplier and order impact, expedite or hold decisions, substitution feasibility, supplier communication, customer escalation, cost exposure.

ORCHESTRATOR recommendation:
- One clear proactive intervention plan, phrased as a proposal for the duty manager.
- Explain the operational trade-off between delay, cost, risk, CO2, cold-chain integrity, and service criticality.

Confidence: exactly one of High, Medium, or Low.
- Add HUMAN VALIDATION REQUIRED on its own line whenever confidence is Low.

Data used:
- List the specific snapshot fields your answer relied on: vessel and shipment IDs, ETAs, statuses, routes, weather figures, berth or terminal occupancy, inventory and procurement signals.

Keep each view to two or three short lines. A duty manager reads this under time pressure — no preamble, no restating the question, no closing pleasantries.

The exception is an out-of-domain question: do not use this structure. Reply in one or two plain sentences declining and redirecting, as set out in the constraints.`
