# ParcelPilot Support Intelligence — Architecture

## 1. Agent design

The agent is a deterministic pipeline around the LLM (OpenRouter via the Vercel AI SDK):

1. **Tool loop** — `generateText` with a registered tool set and `maxToolRounds`. The model requests tool calls; the tool layer executes them with the authenticated user's context; results are fed back. The loop terminates when the model stops calling tools.
2. **Evidence resolver** — a structured pass over the investigation transcript that classifies the evidence: `SUPPORTED / PARTIALLY_SUPPORTED / UNSUPPORTED / CONFLICTED`, with confidence and a recommended action (`ANSWER / CLARIFY / ESCALATE`).
3. **Response generator** — produces the final answer from the question, the evidence resolution, the sources used, and any prepared action. It is instructed to use only supplied evidence and to never expose chain-of-thought.

The agent never receives raw SQL access, never decides permissions, and only *prepares* actions. Execution is a separate, user-confirmed API call.

## 2. Tool design

Tools are declared in `agent/tools/tool-registry.ts` with a Zod input schema, a description, and a handler `(args, user) => ToolResult`. Each handler calls the access-control service first. Tool outputs are plain JSON that the model can consume.

Required and demonstrated tool categories:

- **Document search**: `search_documents`
- **Structured lookup / calculation**: `get_account`, `get_order`, `get_ticket`, `search_tickets`, `calculate_sla`, `calculate_cancellation`, `calculate_service_credit`
- **State-changing (prepare only)**: `prepare_escalation`, `prepare_ticket_update`, `prepare_follow_up_task`

The AI SDK converts each Zod schema to the model's tool schema; inputs are re-validated with Zod before execution.

## 3. Document ingestion

`scripts/ingest-documents.ts`:

1. Extract text from each PDF (`pdf-parse`).
2. Clean the text (normalize whitespace).
3. Split into sections on numbered headings (`1. …`, `KI-### …`).
4. Chunk each section by paragraph with overlap, targeting ~1100 chars.
5. Assign per-chunk metadata: title, source type, version, status, effective dates, customer account, authority rank.
6. Embed with `openai/text-embedding-3-small` (1536-dim) and store in `document_chunks` with an HNSW cosine index.

Document-level metadata (version, status, effective dates, authority rank, applicable customer) is denormalized onto every chunk so retrieval needs no join.

## 4. Retrieval

`retrieval/retrieval.service.ts`:

- Candidate selection: `1 - (embedding <=> $query)`, restricted by a WHERE clause built from the request.
- Applicability: when a customer context is supplied, customer agreements are limited to that customer (plus general docs); with no customer context, customer agreements are excluded entirely.
- Currentness: deprecated sources are excluded unless `includeDeprecated`.
- Reranking: `score = (0.65 · similarity + 0.35 · authorityRank/100) · currentBoost · customerBoost`.

So a current, applicable, high-authority source beats a semantically-equal deprecated one, and a Northstar agreement is never returned for a LumenWorks question.

## 5. Structured data

`accounts`, `orders`, `tickets` mirror the workbook. Tickets gain derived fields at import:

- `severity` from a deterministic classifier using the Policy v3 definitions (P1/P2/P3).
- `sla_due_at` from the applicable first-response target (customer agreement override else Policy v3) applied to `created_at` over a business calendar (Mon–Fri 09:00–18:00 Asia/Kolkata; 24x7 for P1 wall-clock targets).

All time-based reasoning uses `DATASET_AS_OF` (the workbook snapshot), never the system clock.

## 6. Authorization

- Mock users/roles in `auth/mock-users.ts`; `MockAuthGuard` resolves the `X-User-Email` header.
- `AccessControlService` is the single authorization authority. Every tool and controller calls it. `support_agent` is scoped to `accountId`; `support_manager` and `operations` are cross-account; `support_agent` cannot execute actions; issue dashboard requires manager/operations.
- Cross-account reads return `Access denied` at the tool/service layer — not a prompt instruction.

## 7. Source reliability

| Rank | Source |
| --- | --- |
| 100 | Applicable customer agreement |
| 90 | Current support policy (v3) |
| 85 | Current SOP (v4) |
| 80 | Current product documentation |
| 40 | Deprecated policy (v2) |
| 20 | Historical support tickets |

Ranks are implementation metadata. Applicability and effective dates matter: a customer agreement only applies to its customer during its term.

## 8. Conflict handling

The evidence resolver evaluates each source for applicability, customer specificity, effective date, current/deprecated status, authority, relevance, and conflicts. Rules: applicable agreements may override general policy; current outranks deprecated; historical tickets are contextual only; never invent missing clauses. An unresolved material conflict yields `CONFLICTED` / LOW confidence and `ESCALATE`.

## 9. Action confirmation

Every mutation goes through `prepare → confirm → execute`:

- `prepare_*` writes a record in `prepared` state and returns a reference ID. No system state changes.
- The UI renders the proposed action (target, action, reason, priority, evidence) with Confirm/Cancel.
- `execute_*` (direct API, authenticated user) requires the record to be `prepared` and confirmation to be true. A `prepared` record never executes without confirmation; a rejected record cannot be executed later.
- Execution failures are reported honestly; the agent never claims success without the execution tool confirming it.

## 10. Issue detection

Deterministic detectors in `issues/issues.service.ts`:

- **SLA risk**: open tickets with `sla_due_at` before the snapshot (overdue) or within 2 hours (approaching).
- **Recurring complaints**: keyword-theme clusters over open tickets (bulk upload, SwiftShip webhook, creation outage, security, admin).
- **Cross-customer**: a theme reported by ≥2 distinct customers.
- **Unusual activity**: elevated open P1 volume; high cancellation-request ratio among BOOKED orders.

Detected issues are hypotheses (stored in `issue_clusters` with type/severity/confidence), never confirmed facts. Investigation is a separate agent pass that independently verifies with tools.

## 11. Technical trade-offs

- **Monorepo with two apps + shared scripts** — simple, no extra infra; scripts reuse the API's deps and schema.
- **TypeORM with `synchronize: false` + an idempotent SQL schema** — full control over pgvector DDL with familiar entities.
- **OpenRouter + Vercel AI SDK** — one provider and one API key for chat and embeddings; swap models by changing a slug; provider routing/failover for free.
- **Deterministic detection over ML** — explainable first version; no training data, thresholds are readable.
- **Non-streaming agent responses** — simpler confirmation/evidence UX; streaming can be layered on with `streamText` later.

## 12. Future improvements

- Real SSO/JWT replacing header mock auth.
- Streaming responses (`streamText`) and React `useChat` hooks.
- Richer anomaly detection (time-series baselines, embeddings-based clustering).
- Carrier/webhook integrations for live operational data.
- Feedback loop on agent answers → evaluation dataset growth.
- Customer-facing agent with stricter scope + disclosure.
- Observability: request logging with request ID, user, role, tools, sources, decision, latency (see §30 of the brief).