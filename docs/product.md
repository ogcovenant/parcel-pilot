# ParcelPilot Support Intelligence — Product

## Problem addressed: proactive issue detection

ParcelPilot's support team is reactive: a customer must notice a problem, file a ticket, and wait. By the time a ticket lands, multiple customers may already be affected, SLAs may be breached, and a product or carrier issue may be spreading silently. Reactive support measures impact in retrospect; it cannot prevent it.

## Why it matters

- **SLA breach risk is time-sensitive.** Tickets created near their first-response deadline need attention before — not after — the deadline passes.
- **Recurring complaints hide systemic problems.** A product defect (e.g. bulk-upload failures) or a carrier issue (e.g. webhook delays) repeats across customers; each ticket looks isolated unless clustered.
- **Cross-customer incidents are the expensive ones.** One carrier/feature outage touching many accounts is a different response from a single-customer issue.
- **Trust depends on first response.** The verified first-response resolution rate is the primary metric: how often the system resolves an eligible request correctly without human intervention.

## Solution: detection + investigation workflow

1. **Detect.** Deterministic detectors run over the structured operational data (SLA risk, recurring complaints, cross-customer patterns, unusual activity) and persist hypotheses with severity and confidence.
2. **Investigate.** An authorized operator opens the Issue Dashboard and selects "Investigate". A fresh agent pass — instructed that the detection is a hypothesis, not a fact — independently verifies using the same approved tools: it quantifies impact from operational data, matches known product issues, checks relevant documentation, and proposes a recommended action.
3. **Act (safely).** Any resulting action (escalation, ticket update, follow-up task) goes through prepare → confirm → execute, so investigation drives action without removing the human from the loop.

Hypotheses are never presented as facts; confidence and human escalation requirements are explicit.

## Primary metric

**Verified First-Response Resolution Rate**

Percentage of eligible support requests correctly resolved by the system without requiring human intervention. An eligible request is one within the user's authorized scope with sufficient authoritative evidence; "correctly resolved" is verified against the evidence resolver decision and, in the evaluation set, expected outcomes.

## Future work

- Real SSO and fine-grained role management.
- Integration with the actual support platform (live tickets, workflows).
- Carrier integrations for live pickup/status data.
- Richer anomaly detection: time-series baselines, embedding-based clustering, seasonal awareness.
- A feedback loop where operator actions and agent answers feed the evaluation set.
- An evaluation platform around `tests/evals/cases.json`.
- A customer-facing agent with tighter scope, disclosure, and escalation.

## Intentionally omitted

- Real carrier integrations (live carrier APIs).
- Production SSO.
- Autonomous production actions (actions always require confirmation).
- Sophisticated ML incident detection (deterministic first version, explainable by design).

## AI tool usage

AI coding tools were used for: initial scaffolding, architecture exploration, schema drafting, test generation, debugging, and code review assistance. Generated code was reviewed manually, especially for authorization, data access, state-changing actions, security, and source reliability.