# ParcelPilot Support Intelligence — Demo Video Script (~5 minutes)

Setup: `pnpm dev` running, API at :3000, web at :5173. Log in as **manager@parcelpilot.local** (selectable in the bottom-left user picker). Sign in as **agent@parcelpilot.local** for the authorization segment.

## 0:00–0:30 — Architecture (screen: repo tree + architecture diagram)
- "This is ParcelPilot Support Intelligence: an internal support + operations assistant."
- One sentence on the architecture: a Vite/React UI → NestJS API → agent orchestrator → a strict tool layer → PostgreSQL + pgvector.
- Key principle: the LLM orchestrates, but authorization, data access, calculations, and mutations live in the tool layer outside the model.

## 0:30–1:30 — Policy + agreement question (screen: Copilot chat)
Ask: **"Can Northstar cancel ORD-1001 without a cancellation fee?"**
Point out, in the right-hand tool activity panel:
- Order lookup (get_order) → confirms ORD-1001 is BOOKED, Northstar
- Document search (search_documents) → retrieves the Northstar Enterprise Agreement (authority rank 100) and the SOP (rank 85)
- Calculation (calculate_cancellation) → deterministic "no fee — agreement waives it"
- Final answer: HIGH confidence, sources listed
Point out that a LumenWorks agent gets nothing back (switch user to `lumen@parcelpilot.local`, re-ask — "Access denied, scope is ACCT-002").

## 1:30–2:15 — Structured lookup (screen: Copilot chat)
Ask: **"Find high-severity tickets approaching SLA."**
- Tool activity shows search_tickets → calculate_sla × N → get_ticket
- Answer surfaces TKT-501 (P1, SLA breached) and TKT-505 (P1, credential exposure, breached), with due times computed from the business calendar (Sunday → Monday business-hours rollover).
- The reference clock is the dataset snapshot (2026-08-16 11:00 Asia/Kolkata), not the real system clock.

## 2:15–3:00 — Safe action with confirmation (screen: Copilot chat)
Ask: **"Prepare an escalation for TKT-501."**
- The agent investigates first (get_ticket, calculate_sla), then calls `prepare_escalation`.
- The UI renders the Proposed Action card: Action, Reference (ESC-…), Priority P1, Team, Reason — **awaiting confirmation**.
- Click **Confirm** → a direct authenticated API call executes it → "✓ Escalation created. Reference: ESC-…".
- Note: preparing is not executing; the DB row stays `prepared` until the user confirms, and an unconfirmed action is never executed.

## 3:00–4:00 — Proactive issue detection (screen: Issues dashboard)
- Open the Issues view, click **Re-run detection** (or show existing hypotheses).
- Show the SLA-risk issue (2 tickets past first-response target) and the recurring-complaint issue (bulk upload, matching known issue KI-208).
- Click **Investigate** on one → the agent independently verifies the hypothesis with tools (get_ticket, calculate_sla) and reports impact.
- Emphasize: these are hypotheses, not facts; detection is deterministic and explainable.

## 4:00–5:00 — Design decisions (screen: code / docs)
- **Source hierarchy**: customer agreement (100) > current policy (90) > SOP (85) > product docs (80) > deprecated policy (40) > historical tickets (20).
- **Historical tickets are context only**: TKT-450 told Northstar a fee applied after 30 minutes — wrong; the agreement governs. The agent treats the ticket as evidence, not policy.
- **Authorization is enforced in the tool layer**, not prompts.
- **Confirmation gating** for every mutation.
- **Explicit uncertainty**: LOW confidence → recommends human review.

## Close
- "Verified first-response resolution rate is the product metric; the eval harness in `tests/evals/cases.json` measures it."
- Links: README, docs/architecture.md, docs/product.md.

## Recording tips
- Use the built bundle: `pnpm --filter @parel-pilot/web preview` (or `pnpm dev`).
- Zoom the browser to ~120% for readability.
- Have the API key set and documents ingested before recording (`pnpm ingest:documents`).
- Re-run issue detection at the start of segment 4 so the dashboard is populated.