# ParcelPilot Assessment — Data Model & Business Rules

Derived from direct inspection of the supplied data pack (`ParcelPilot_Assessment_Data.xlsx` and the six PDFs). No business rule in this document was assumed before reading the source.

## Dataset snapshot time

- **`DATASET_AS_OF` = 2026-08-16 11:00 Asia/Kolkata** (workbook `README`)
- Currency: INR
- Workbook is a synthetic dataset for the assessment; historical ticket resolutions may be incorrect and must be treated as context, not authority.

## Workbook sheets

| Sheet | Rows (excl. header) | Columns |
| --- | --- | --- |
| README | — | snapshot timestamp, currency, notes |
| accounts | 4 | account_id, account_name, plan, status, csm, contract_file, premium_support, notes |
| orders | 6 | order_id, account_id, carrier, status, booked_at, pickup_window_start, pickup_window_end, pickup_actual_at, shipment_fee_inr, carrier_fault, customer_fault, cancellation_requested_at, notes |
| tickets | 8 | ticket_id, account_id, created_at, status, subject, description, channel, assigned_to, last_customer_message_at, historical_resolution |

## Tables (target schema)

### accounts
| Column | Source col | Type | Notes |
| --- | --- | --- | --- |
| id | — | uuid PK | internal |
| account_id | account_id | varchar | ACCT-001..ACCT-004 |
| account_name | account_name | varchar | |
| plan | plan | enum | standard / growth / enterprise |
| status | status | enum | active / inactive |
| csm | csm | varchar | |
| contract_file | contract_file | varchar | nullable; empty = no supplied agreement |
| premium_support | premium_support | boolean | |
| notes | notes | text | |

### orders
| Column | Source col | Type | Notes |
| --- | --- | --- | --- |
| id | — | uuid PK | internal |
| order_id | order_id | varchar | ORD-XXXX |
| account_id | account_id | FK | |
| carrier | carrier | varchar | SwiftShip, BlueDart Pro, RoadRunner |
| status | status | enum | BOOKED / PICKED_UP / DELIVERED |
| booked_at | booked_at | timestamp | |
| pickup_window_start | pickup_window_start | timestamp | |
| pickup_window_end | pickup_window_end | timestamp | |
| pickup_actual_at | pickup_actual_at | timestamp | nullable — empty = not yet picked up |
| shipment_fee_inr | shipment_fee_inr | numeric | |
| carrier_fault | carrier_fault | boolean | |
| customer_fault | customer_fault | boolean | |
| cancellation_requested_at | cancellation_requested_at | timestamp | nullable — empty = no cancellation requested |

### tickets
| Column | Source col | Type | Notes |
| --- | --- | --- | --- |
| id | — | uuid PK | internal |
| ticket_id | ticket_id | varchar | TKT-XXX |
| account_id | account_id | FK | |
| created_at | created_at | timestamp | |
| status | status | enum | open / closed |
| subject | subject | varchar | |
| description | description | text | |
| channel | channel | enum | email / chat |
| assigned_to | assigned_to | varchar | |
| last_customer_message_at | last_customer_message_at | timestamp | |
| historical_resolution | historical_resolution | text | nullable; **context only, may be wrong** |

> **Schema adaptation decision:** the workbook has **no severity, sla_due_at, or resolved_at columns** on tickets. These are derived:
> - `severity` is assigned at investigation time from the subject/description using the policy P1/P2/P3 definitions.
> - `sla_due_at` is computed from `created_at` + the applicable first-response target (plan + severity, or customer agreement if it overrides).
> - `resolved_at` is not present; ticket status (open/closed) is the operational truth.

### Derived/lookup tables
- documents — one row per ingested PDF: title, source_type, customer_account_id, version, status, effective_from, effective_to, authority_rank.
- document_chunks — section-aware chunks with pgvector embedding and document metadata denormalized for filtering.
- escalations, follow_up_tasks — state-changing action records (prepared → confirmed → executed).
- issue_clusters — detected-issue hypotheses (not confirmed facts).

## Relationships

- accounts 1—N orders
- accounts 1—N tickets
- documents N—1 accounts (only for customer agreements; policy/SOP docs have no account)
- escalations N—1 tickets, N—1 accounts
- issue_clusters reference sets of ticket_ids / account_ids / order_ids

## Source hierarchy & authority ranks

| Rank | Source | Covers |
| --- | --- | --- |
| 100 | Customer agreement (Northstar, LumenWorks) | that customer only, during its term |
| 90 | Support Policy v3 (CURRENT) | all customers |
| 85 | Cancellation & Service Credit SOP v4 (CURRENT) | all customers |
| 80 | Product Operations Guide (CURRENT) | all customers |
| 40 | Support Policy v2 (DEPRECATED) | historical reference only |
| 20 | Historical support tickets | context only, may contain wrong guidance |

## Documents (ingested PDFs)

| File | Title | Type | Status | Effective | Applies to |
| --- | --- | --- | --- | --- | --- |
| 01_Support_Policy_v3_CURRENT.pdf | Support Policy v3 | policy | current | 1 May 2026 – | all |
| 02_Support_Policy_v2_DEPRECATED.pdf | Support Policy v2 | policy | deprecated | 1 Jan 2025 – 30 Apr 2026 | all (historical) |
| 03_Cancellation_and_Service_Credit_SOP_v4.pdf | Cancellation & Service Credit SOP v4 | sop | current | 15 Jun 2026 – | all |
| 04_Product_Operations_Guide_and_Known_Issues.pdf | Product Operations Guide | product | current | updated 14 Aug 2026 | all |
| 05_Northstar_Logistics_Enterprise_Agreement.pdf | Northstar Enterprise Agreement | agreement | current | 1 Jan 2026 – 31 Dec 2026 | ACCT-001 only |
| 06_LumenWorks_Service_Agreement.pdf | LumenWorks Service Agreement | agreement | current | 1 Mar 2026 – 28 Feb 2027 | ACCT-002 only |

## Key business rules discovered (from sources)

### Cancellation (SOP v4 §1, Northstar §2, LumenWorks §2)
- BOOKED & not picked up: cancellable. No fee within 30 min of booking; after 30 min, INR 250 unless the customer agreement waives it.
- Northstar (ACCT-001): may cancel **any** BOOKED shipment before pickup with **no fee**, regardless of booking age.
- LumenWorks (ACCT-002): no waiver; standard SOP applies.
- PICKED_UP: do not cancel; use return-to-origin. DELIVERED: cannot cancel.

### Failed-pickup service credits (SOP v4 §2, Northstar §3, LumenWorks §3)
- Default eligibility: pickup more than 2 hours past end of scheduled window **and** carrier at fault **and** no customer-caused issue.
- Default credit: min(INR 500, 10% of shipment fee).
- Northstar: SOP applies, but monthly aggregate credits capped at INR 5,000.
- LumenWorks: threshold is 4 hours past window end; fixed INR 300 (replaces default threshold and amount).
- Any single credit above INR 1,000 requires manager approval.
- Do not promise a credit when carrier fault, pickup timing, or customer fault is unknown.

### Severity (Policy v3 §2)
- P1: complete production outage preventing shipment creation, confirmed/suspected security incident or credential exposure, immediate material business risk with no workaround.
- P2: major feature unavailable or materially degraded, workaround exists.
- P3: minor defect, how-to, config request, limited impact.

### First-response targets
- Policy v3 default: Enterprise P1 30min 24x7 / P2 2h / P3 1 business day; Growth 2 business h / 4 business h / 2 business days; Standard 4 business h / 1 business day / 2 business days.
- Northstar override: P1 15min 24x7 / P2 1h / P3 8 business hours.
- LumenWorks override: P1 2 business h / P2 4 business h / P3 2 business days; **no weekend or after-hours coverage**.
- Policy v2 (deprecated) had looser targets and must not be used for current requests.

### Escalation (Policy v3 §4)
- P1 should be escalated immediately. If a response target is already breached, state the breach and recommend escalation.

### Known issues (Product Guide)
- KI-208: bulk CSV uploads above ~3,000 rows intermittently fail for Growth/Enterprise (product limit is 5,000). Workaround: split below 3,000 rows. Individual creation unaffected.
- KI-211: SwiftShip pickup webhooks can arrive up to 20 min late; a parcel may be collected while order still shows BOOKED. Verify carrier status before claiming pickup did not occur.
- KI-176: address validation — **resolved** 18 Jul 2026; do not use to explain new incidents.

### Plan capabilities (Product Guide)
- Bulk Upload: Growth + Enterprise, up to 5,000 rows per CSV. Not included on Standard.

## Historical tickets relevant to rules (context only)

- TKT-450 (closed, ACCT-001): agent told Northstar an INR 250 fee applied after 30 min — **contradicts the Northstar agreement waiver**; historical guidance is wrong for this customer.
- TKT-451 (closed, ACCT-002): agent told LumenWorks Growth only supports 3,000 rows — **contradicts current product limit of 5,000**; historical guidance is wrong.