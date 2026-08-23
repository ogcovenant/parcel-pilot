# ParcelPilot Support Intelligence

An internal AI-powered support and operations system for ParcelPilot, a B2B logistics platform. It combines a controlled AI support copilot with proactive issue detection and human-in-the-loop actions.

The LLM (OpenRouter via the Vercel AI SDK) orchestrates a **strict, pre-approved tool layer**. Authorization, data access, calculations, and state-changing actions live outside the model — the LLM never runs arbitrary SQL, never decides permissions, and never mutates data without explicit user confirmation.

## Product overview

- **AI Support Copilot** — natural-language chat that investigates requests using document retrieval, structured operational data, and deterministic calculations; answers with evidence, source hierarchy, and confidence.
- **Proactive Issue Detection** — deterministic detectors for SLA risks, recurring complaints, cross-customer incidents, and unusual activity, with agent-driven investigation of each hypothesis.
- **Safe Actions** — prepare → confirm → execute flows for escalations, ticket updates, and follow-up tasks. Preparing is not executing; execution only happens after explicit confirmation.

## Architecture

```
User
  ↓
Vite/React UI  (apps/web)
  ↓  /api (proxied)
NestJS API  (apps/api)
  ↓
Agent Orchestrator  (agent.service.ts)
  ↓
Tool Layer          (tool-registry.ts)
  ├── search_documents         (pgvector retrieval + authority rerank)
  ├── get_account / get_order / get_ticket / search_tickets
  ├── calculate_sla / calculate_cancellation / calculate_service_credit
  └── prepare_escalation / prepare_ticket_update / prepare_follow_up_task
  ↓
PostgreSQL + pgvector (accounts, orders, tickets, documents, document_chunks,
                       escalations, follow_up_tasks, ticket_updates, issue_clusters)
```

Issue detection runs in parallel over the structured data and produces hypotheses that the agent verifies.

## Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 4, Radix/shadcn-style components |
| Backend | NestJS 11, TypeScript (strict) |
| AI | OpenRouter via the Vercel AI SDK (`ai` + `@openrouter/ai-sdk-provider`), tool calling |
| Embeddings | OpenRouter `openai/text-embedding-3-small` (1536-dim), stored in pgvector |
| Database | PostgreSQL with pgvector |
| Validation | Zod (env vars + tool inputs) |
| Tests | Jest (unit), evaluation cases in `tests/evals/cases.json` |

## Repository layout

```
apps/web                 Vite + React support UI
apps/api                 NestJS API
apps/api/src/agent       agent orchestrator, prompts, tool registry
apps/api/src/retrieval   semantic search + authority reranking
apps/api/src/calculations deterministic cancellation / credit logic
apps/api/src/actions     prepare → confirm → execute state machine
apps/api/src/issues      deterministic issue detection
apps/api/scripts         ingestion + detection + evaluation scripts
data/pdfs                the six supplied PDFs
data/workbook            ParcelPilot_Assessment_Data.xlsx
docs/                    architecture.md, product.md, data-model.md
tests/evals/cases.json   evaluation scenarios
```

## Setup

Requirements: Node 20+, pnpm 10, PostgreSQL with the `vector` extension (0.8.x).

```bash
pnpm install
```

### Database

```sql
CREATE ROLE parelpilot WITH LOGIN PASSWORD 'parelpilot_dev';
CREATE DATABASE parcel_pilot OWNER parelpilot;
\c parcel_pilot
CREATE EXTENSION IF NOT EXISTS vector;
GRANT ALL ON SCHEMA public TO parelpilot;
```

The schema is applied automatically at API startup (`src/database/schema.sql`, idempotent) and by the ingestion scripts. TypeORM runs with `synchronize: false`.

### Environment variables

Copy `apps/api/.env.example` to `apps/api/.env`:

| Variable | Purpose |
| --- | --- |
| `PORT`, `NODE_ENV` | API server |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | PostgreSQL |
| `DATASET_AS_OF` | Dataset snapshot time (reference clock for all time-based reasoning) |
| `OPENROUTER_API_KEY` | OpenRouter API key (agent + embeddings) |
| `OPENROUTER_MODEL` | Chat model (default `openai/gpt-4o-mini`) |
| `OPENROUTER_EMBEDDING_MODEL` | Embedding model (default `openai/text-embedding-3-small`) |
| `AGENT_MAX_TOOL_ROUNDS` | Max tool-calling roundtrips |

### Data ingestion

```bash
pnpm ingest:workbook     # accounts, orders, tickets from the workbook
pnpm ingest:documents    # PDFs → section chunks → embeddings → pgvector
pnpm detect:issues       # run issue detection and persist hypotheses
```

## Local development

```bash
pnpm dev                 # API (:3000) + web (:5173, proxies /api to :3000)
```

## Test users

Mock auth via the `X-User-Email` header (selectable in the UI).

| Email | Role | Scope |
| --- | --- | --- |
| `agent@parcelpilot.local` | support_agent | ACCT-001 (Northstar) |
| `lumen@parcelpilot.local` | support_agent | ACCT-002 (LumenWorks) |
| `manager@parcelpilot.local` | support_manager | cross-account |
| `operations@parcelpilot.local` | operations | cross-account |

A scoped support agent is denied access to any other customer's data at the tool layer.

## Test scenarios (demo)

1. "Can Northstar cancel ORD-1001 without a cancellation fee?" — order lookup + agreement retrieval + policy retrieval + conflict resolution.
2. "A pickup is three hours late because of carrier fault. Should I get a service credit?" — deterministic credit calculation.
3. "Why is ticket TKT-502 still unresolved?" — ticket investigation + SLA + known issue match.
4. "Find high-severity tickets approaching SLA." — structured search + SLA math.
5. "Are multiple customers reporting the same product issue?" — cross-customer clustering.
6. "Prepare an escalation for TKT-501." — prepare → confirm → execute flow.

## Tests & evaluation

```bash
pnpm test                # unit tests: authorization, actions lifecycle, SLA, retrieval, calculations
pnpm eval:cases          # run tests/evals/cases.json against a live agent (needs API + key)
```

## Deployment

- **Frontend**: Vercel — build `apps/web`, rewrite `/api/*` to the API host.
- **API**: Render/Railway — run `pnpm --filter @parel-pilot/api build && node apps/api/dist/main.js`, with `apps/api/.env` variables set.
- **Database**: Supabase or Neon (Postgres + pgvector). Run `pnpm ingest:workbook && pnpm ingest:documents` once against the production DB.

## Limitations

- Mock authentication (header-based) — designed for the assessment; production uses SSO.
- Dataset is a synthetic snapshot; `DATASET_AS_OF` fixes the reference clock.
- Detection is deterministic and rule-based; no ML anomaly scoring.
- Historical tickets are context only and may be wrong (by design of the data pack).

## Design decisions

- LLM for orchestration only; deterministic logic for anything that can be computed.
- The database is the source of truth for operational facts; documents are evidence.
- Tool layer, not prompts, enforces authorization and scoping.
- State-changing actions require a prepare step and explicit confirmation.
- Source authority is implemented as metadata (authority rank + status + effective dates + customer applicability) applied during retrieval reranking.
- A separate evidence-resolution pass decides SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED / CONFLICTED and gates confidence.

See `docs/architecture.md` and `docs/product.md` for detail.

## AI tooling disclosure

AI coding tools were used for: initial scaffolding, architecture exploration, schema drafting, test generation, debugging, and code review assistance. Generated code was reviewed manually, especially for authorization, data access, state-changing actions, security, and source reliability.