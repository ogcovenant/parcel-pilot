import 'reflect-metadata';
/**
 * Import the ParcelPilot assessment workbook (accounts, orders, tickets) into
 * PostgreSQL. Deterministic; safe to re-run (idempotent upserts by business ID).
 *
 * Usage: pnpm --filter @parel-pilot/api ingest:workbook
 */
import 'dotenv/config';
import ExcelJS from 'exceljs';
import { DataSource } from 'typeorm';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { SeverityClassifier } from '../src/sla/severity-classifier';
import { SlaService } from '../src/sla/sla.service';
import { policyOverrideFor } from '../src/policy/policy-overrides';

const WORKBOOK = join(__dirname, '../../../data/workbook/ParcelPilot_Assessment_Data.xlsx');
const SCHEMA = join(__dirname, '../src/database/schema.sql');

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'parelpilot',
    password: process.env.DB_PASSWORD ?? 'parelpilot_dev',
    database: process.env.DB_NAME ?? 'parcel_pilot',
    synchronize: false,
  });
  await dataSource.initialize();
  await dataSource.query(readFileSync(SCHEMA, 'utf8'));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(WORKBOOK);

  const classifier = new SeverityClassifier();
  const slaService = new SlaService();

  // ---- Accounts ----
  const accountsSheet = workbook.getWorksheet('accounts');
  if (!accountsSheet) throw new Error('accounts sheet missing');
  let accountCount = 0;
  const accountsRows = accountsSheet.getRows(2, accountsSheet.actualRowCount - 1) ?? [];
  for (const row of accountsRows) {
    const [accountId, accountName, plan, status, csm, contractFile, premiumSupport, notes] =
      ((row.values ?? []) as unknown[]).slice(1);
    await dataSource.query(
      `INSERT INTO accounts (account_id, account_name, plan, status, csm, contract_file, premium_support, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (account_id) DO UPDATE SET
         account_name = EXCLUDED.account_name, plan = EXCLUDED.plan, status = EXCLUDED.status,
         csm = EXCLUDED.csm, contract_file = EXCLUDED.contract_file,
         premium_support = EXCLUDED.premium_support, notes = EXCLUDED.notes`,
      [
        String(accountId).trim(),
        String(accountName).trim(),
        String(plan).toLowerCase(),
        String(status).toLowerCase(),
        String(csm).trim(),
        contractFile ? String(contractFile) : null,
        String(premiumSupport).toLowerCase() === 'true',
        notes ? String(notes) : null,
      ],
    );
    accountCount += 1;
  }
  console.log(`[workbook] imported ${accountCount} accounts`);

  // ---- Orders ----
  const ordersSheet = workbook.getWorksheet('orders');
  if (!ordersSheet) throw new Error('orders sheet missing');
  let orderCount = 0;
  const orderRows = ordersSheet.getRows(2, ordersSheet.actualRowCount - 1) ?? [];
  for (const row of orderRows) {
    const [
      orderId, accountId, carrier, status, bookedAt, windowStart, windowEnd, pickupActualAt,
      fee, carrierFault, customerFault, cancelRequestedAt, notes,
    ] = ((row.values ?? []) as unknown[]).slice(1);

    const accountIdStr = String(accountId).trim();
    await dataSource.query(
      `INSERT INTO orders (order_id, account_id, carrier, status, booked_at, pickup_window_start, pickup_window_end,
                           pickup_actual_at, shipment_fee_inr, carrier_fault, customer_fault, cancellation_requested_at, notes)
       VALUES ($1, (SELECT id FROM accounts WHERE account_id = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (order_id) DO UPDATE SET
         status = EXCLUDED.status, carrier = EXCLUDED.carrier,
         pickup_actual_at = EXCLUDED.pickup_actual_at,
         cancellation_requested_at = EXCLUDED.cancellation_requested_at,
         notes = EXCLUDED.notes`,
      [
        String(orderId).trim(),
        accountIdStr,
        String(carrier).trim(),
        String(status).toUpperCase(),
        toDate(bookedAt),
        toDate(windowStart),
        toDate(windowEnd),
        toDate(pickupActualAt),
        fee ?? 0,
        String(carrierFault).toLowerCase() === 'true',
        String(customerFault).toLowerCase() === 'true',
        toDate(cancelRequestedAt),
        notes ? String(notes) : null,
      ],
    );
    orderCount += 1;
  }
  console.log(`[workbook] imported ${orderCount} orders`);

  // ---- Tickets ----
  const ticketsSheet = workbook.getWorksheet('tickets');
  if (!ticketsSheet) throw new Error('tickets sheet missing');
  let ticketCount = 0;
  const ticketRows = ticketsSheet.getRows(2, ticketsSheet.actualRowCount - 1) ?? [];
  for (const row of ticketRows) {
    const [
      ticketId, accountId, createdAt, status, subject, description, channel,
      assignedTo, lastCustomerMessageAt, historicalResolution,
    ] = ((row.values ?? []) as unknown[]).slice(1);

    const accountIdStr = String(accountId).trim();
    const subjectStr = String(subject);
    const descriptionStr = String(description);
    const severity = classifier.classify(subjectStr, descriptionStr);
    const createdAtDate = toDate(createdAt) as Date;

    const account = await dataSource.query(
      `SELECT id, plan FROM accounts WHERE account_id = $1`,
      [accountIdStr],
    );
    const override = policyOverrideFor(accountIdStr);
    const slaDue = new SlaService().computeSlaDue(
      createdAtDate,
      String(account[0]?.plan ?? 'standard'),
      severity,
      override?.sla,
    );

    await dataSource.query(
      `INSERT INTO tickets (ticket_id, account_id, created_at, status, severity, subject, description,
                            channel, assigned_to, last_customer_message_at, historical_resolution, sla_due_at)
       VALUES ($1, (SELECT id FROM accounts WHERE account_id = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       ON CONFLICT (ticket_id) DO UPDATE SET
         status = EXCLUDED.status, severity = EXCLUDED.severity,
         last_customer_message_at = EXCLUDED.last_customer_message_at,
         sla_due_at = EXCLUDED.sla_due_at`,
      [
        String(ticketId).trim(),
        accountIdStr,
        createdAtDate,
        String(status).toLowerCase(),
        severity,
        subjectStr,
        descriptionStr,
        String(channel).toLowerCase(),
        String(assignedTo).trim(),
        toDate(lastCustomerMessageAt),
        historicalResolution ? String(historicalResolution) : null,
        slaDue,
      ],
    );
    ticketCount += 1;
  }
  console.log(`[workbook] imported ${ticketCount} tickets`);

  await dataSource.destroy();
  console.log('[workbook] done');
}

const KOLKATA_OFFSET = '+05:30';

function toDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value;
  const str = String(value);
  // "YYYY-MM-DD HH:MM" values in the workbook are Asia/Kolkata local times.
  const local = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})$/.exec(str);
  if (local) {
    const parsed = new Date(`${local[1]}T${local[2]}:00${KOLKATA_OFFSET}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});