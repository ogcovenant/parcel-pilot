-- ParcelPilot Support Intelligence — authoritative schema
-- Executed idempotently on startup (DatabaseModule) and by scripts.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS accounts (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id      varchar NOT NULL UNIQUE,
    account_name    varchar NOT NULL,
    plan            varchar NOT NULL,
    status          varchar NOT NULL,
    csm             varchar NOT NULL,
    contract_file   varchar,
    premium_support boolean NOT NULL DEFAULT false,
    notes           text
);

CREATE TABLE IF NOT EXISTS orders (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                 varchar NOT NULL UNIQUE,
    account_id               uuid NOT NULL REFERENCES accounts(id),
    carrier                  varchar NOT NULL,
    status                   varchar NOT NULL,
    booked_at                timestamptz NOT NULL,
    pickup_window_start      timestamptz NOT NULL,
    pickup_window_end        timestamptz NOT NULL,
    pickup_actual_at         timestamptz,
    shipment_fee_inr         numeric NOT NULL,
    carrier_fault            boolean NOT NULL DEFAULT false,
    customer_fault           boolean NOT NULL DEFAULT false,
    cancellation_requested_at timestamptz,
    notes                    text
);
CREATE INDEX IF NOT EXISTS idx_orders_account ON orders(account_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

CREATE TABLE IF NOT EXISTS tickets (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id               varchar NOT NULL UNIQUE,
    account_id              uuid NOT NULL REFERENCES accounts(id),
    order_id                uuid REFERENCES orders(id),
    created_at              timestamptz NOT NULL,
    status                  varchar NOT NULL,
    severity                varchar,
    subject                 varchar NOT NULL,
    description             text NOT NULL,
    channel                 varchar NOT NULL,
    assigned_to             varchar NOT NULL,
    last_customer_message_at timestamptz,
    historical_resolution   text,
    sla_due_at              timestamptz,
    resolved_at             timestamptz,
    notes                   text
);
CREATE INDEX IF NOT EXISTS idx_tickets_account ON tickets(account_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_severity ON tickets(severity);

CREATE TABLE IF NOT EXISTS documents (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id         varchar NOT NULL UNIQUE,
    title               varchar NOT NULL,
    source_type         varchar NOT NULL,
    customer_account_id uuid REFERENCES accounts(id),
    version             varchar NOT NULL,
    status              varchar NOT NULL,
    effective_from      date,
    effective_to        date,
    authority_rank      integer NOT NULL,
    source_file         varchar NOT NULL,
    content             text NOT NULL,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_chunks (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id           uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index           integer NOT NULL,
    section               varchar,
    content               text NOT NULL,
    embedding             vector(1536),
    doc_title             varchar NOT NULL,
    doc_source_type       varchar NOT NULL,
    doc_version           varchar NOT NULL,
    doc_status            varchar NOT NULL,
    doc_customer_account_id uuid REFERENCES accounts(id),
    doc_effective_from    date,
    doc_effective_to      date,
    doc_authority_rank    integer NOT NULL,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON document_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS escalations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    escalation_id  varchar NOT NULL UNIQUE,
    ticket_id      uuid REFERENCES tickets(id),
    account_id     uuid REFERENCES accounts(id),
    priority       varchar NOT NULL,
    target_team    varchar NOT NULL,
    reason         text NOT NULL,
    status         varchar NOT NULL DEFAULT 'prepared',
    created_by     varchar NOT NULL,
    confirmed_at   timestamptz,
    executed_at    timestamptz,
    evidence       jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follow_up_tasks (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     varchar NOT NULL UNIQUE,
    ticket_id   uuid REFERENCES tickets(id),
    assignee    varchar NOT NULL,
    due_at      timestamptz,
    description text NOT NULL,
    status      varchar NOT NULL DEFAULT 'prepared',
    created_by  varchar NOT NULL,
    confirmed_at timestamptz,
    executed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ticket_updates (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    update_id   varchar NOT NULL UNIQUE,
    ticket_id   uuid NOT NULL REFERENCES tickets(id),
    kind        varchar NOT NULL,
    note        text,
    status      varchar NOT NULL DEFAULT 'prepared',
    created_by  varchar NOT NULL,
    confirmed_at timestamptz,
    executed_at timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issue_clusters (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id           varchar NOT NULL UNIQUE,
    type               varchar NOT NULL,
    title              varchar NOT NULL,
    severity           varchar NOT NULL,
    confidence         numeric NOT NULL,
    affected_customers jsonb NOT NULL DEFAULT '[]'::jsonb,
    related_tickets    jsonb NOT NULL DEFAULT '[]'::jsonb,
    related_orders     jsonb NOT NULL DEFAULT '[]'::jsonb,
    summary            text,
    detected_at        timestamptz NOT NULL DEFAULT now(),
    status             varchar NOT NULL DEFAULT 'open'
);