import 'reflect-metadata';
/**
 * Ingest the six supplied PDFs: extract text, clean it, chunk by section,
 * embed with OpenAI, and write documents + document_chunks into pgvector.
 *
 * Usage: pnpm --filter @parel-pilot/api ingest:documents
 */
import 'dotenv/config';
import { PDFParse } from 'pdf-parse';
import { embedMany } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

const PDFS_DIR = join(__dirname, '../../../data/pdfs');
const SCHEMA = join(__dirname, '../src/database/schema.sql');

interface DocMeta {
  file: string;
  documentId: string;
  title: string;
  sourceType: 'policy' | 'sop' | 'product' | 'agreement';
  customerAccountId: string | null;
  version: string;
  status: 'current' | 'deprecated' | 'active';
  effectiveFrom: string | null;
  effectiveTo: string | null;
  authorityRank: number;
}

const DOC_METADATA: DocMeta[] = [
  {
    file: '01_Support_Policy_v3_CURRENT.pdf',
    documentId: 'DOC-001',
    title: 'Support Policy v3',
    sourceType: 'policy',
    customerAccountId: null,
    version: 'v3',
    status: 'current',
    effectiveFrom: '2026-05-01',
    effectiveTo: null,
    authorityRank: 90,
  },
  {
    file: '02_Support_Policy_v2_DEPRECATED.pdf',
    documentId: 'DOC-002',
    title: 'Support Policy v2',
    sourceType: 'policy',
    customerAccountId: null,
    version: 'v2',
    status: 'deprecated',
    effectiveFrom: '2025-01-01',
    effectiveTo: '2026-04-30',
    authorityRank: 40,
  },
  {
    file: '03_Cancellation_and_Service_Credit_SOP_v4.pdf',
    documentId: 'DOC-003',
    title: 'Cancellation & Service Credit SOP v4',
    sourceType: 'sop',
    customerAccountId: null,
    version: 'v4',
    status: 'current',
    effectiveFrom: '2026-06-15',
    effectiveTo: null,
    authorityRank: 85,
  },
  {
    file: '04_Product_Operations_Guide_and_Known_Issues.pdf',
    documentId: 'DOC-004',
    title: 'Product Operations Guide and Known Issues',
    sourceType: 'product',
    customerAccountId: null,
    version: 'current',
    status: 'current',
    effectiveFrom: null,
    effectiveTo: null,
    authorityRank: 80,
  },
  {
    file: '05_Northstar_Logistics_Enterprise_Agreement.pdf',
    documentId: 'DOC-005',
    title: 'Northstar Logistics Enterprise Agreement',
    sourceType: 'agreement',
    customerAccountId: 'ACCT-001',
    version: '2026',
    status: 'active',
    effectiveFrom: '2026-01-01',
    effectiveTo: '2026-12-31',
    authorityRank: 100,
  },
  {
    file: '06_LumenWorks_Service_Agreement.pdf',
    documentId: 'DOC-006',
    title: 'LumenWorks Service Agreement',
    sourceType: 'agreement',
    customerAccountId: 'ACCT-002',
    version: '2026',
    status: 'active',
    effectiveFrom: '2026-03-01',
    effectiveTo: '2027-02-28',
    authorityRank: 100,
  },
];

const SECTION_HEADER = /^\s*(\d+\.)\s+\S|^\s*(KI-\d+\s*-)/i;

interface Section {
  name: string;
  lines: string[];
}

function extractText(file: string): Promise<string> {
  const buf = readFileSync(join(PDFS_DIR, file));
  const parser = new PDFParse({ data: buf });
  return parser.getText().then((res: { pages: Array<{ text: string }> }) =>
    res.pages.map((p) => p.text).join('\n'),
  );
}

function cleanText(text: string): string {
  return text.replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function chunkBySections(text: string): Section[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const sections: Section[] = [];
  let current: Section = { name: 'Overview', lines: [] };

  for (const line of lines) {
    if (SECTION_HEADER.test(line)) {
      sections.push(current);
      current = { name: line, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections
    .map((s) => ({ name: s.name, lines: s.lines }))
    .filter((s) => s.lines.join(' ').trim().length > 20);
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

function splitLong(text: string, max = 1100, overlap = 120): string[] {
  if (text.length <= max) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + max, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf('\n', end);
      if (boundary > start + max / 2) end = boundary;
    }
    chunks.push(text.slice(start, end).trim());
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY is required');
    process.exit(1);
  }
  const provider = createOpenRouter({ apiKey });
  const embeddingModel = process.env.OPENROUTER_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small';

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

  const files = readdirSync(PDFS_DIR).filter((f) => f.endsWith('.pdf'));

  for (const meta of DOC_METADATA) {
    if (!files.includes(meta.file)) {
      console.warn(`[docs] missing file ${meta.file}, skipping`);
      continue;
    }

    const rawText = await extractText(meta.file);
    const text = cleanText(rawText);

    const docResult = await dataSource.query(
      `INSERT INTO documents (document_id, title, source_type, customer_account_id, version, status,
                              effective_from, effective_to, authority_rank, source_file, content)
       VALUES ($1, $2, $3, (SELECT id FROM accounts WHERE account_id = $4), $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (document_id) DO UPDATE SET
         content = EXCLUDED.content, status = EXCLUDED.status,
         effective_from = EXCLUDED.effective_from, effective_to = EXCLUDED.effective_to,
         authority_rank = EXCLUDED.authority_rank
       RETURNING id`,
      [
        meta.documentId,
        meta.title,
        meta.sourceType,
        meta.customerAccountId,
        meta.version,
        meta.status,
        meta.effectiveFrom,
        meta.effectiveTo,
        meta.authorityRank,
        meta.file,
        text,
      ],
    );
    const documentId = docResult[0].id as string;

    await dataSource.query(`DELETE FROM document_chunks WHERE document_id = $1`, [documentId]);

    const sections = chunkBySections(text);
    const chunks: Array<{ section: string; content: string }> = [];
    for (const section of sections) {
      const sectionText = section.lines.join('\n');
      const pieces = paragraphs(sectionText).flatMap((p) => splitLong(p));
      for (const piece of pieces) {
        chunks.push({ section: section.name, content: piece });
      }
    }

    console.log(`[docs] ${meta.file}: ${sections.length} sections, ${chunks.length} chunks`);

    const embeddings = await embedManyTexts(embeddingModel, chunks.map((c) => c.content), provider);
    const customerUuid = meta.customerAccountId
      ? (
          await dataSource.query(
            `SELECT id FROM accounts WHERE account_id = $1`,
            [meta.customerAccountId],
          )
        )[0]?.id
      : null;

    for (let i = 0; i < chunks.length; i += 1) {
      await dataSource.query(
        `INSERT INTO document_chunks (document_id, chunk_index, section, content, embedding,
                                      doc_title, doc_source_type, doc_version, doc_status,
                                      doc_customer_account_id, doc_effective_from, doc_effective_to,
                                      doc_authority_rank, metadata)
         VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          documentId,
          i,
          chunks[i].section,
          chunks[i].content,
          JSON.stringify(embeddings[i]),
          meta.title,
          meta.sourceType,
          meta.version,
          meta.status,
          customerUuid,
          meta.effectiveFrom,
          meta.effectiveTo,
          meta.authorityRank,
          JSON.stringify({ file: meta.file, documentId: meta.documentId }),
        ],
      );
    }
  }

  await dataSource.destroy();
  console.log('[docs] ingestion done');
}

async function embedManyTexts(
  model: string,
  texts: string[],
  provider: ReturnType<typeof createOpenRouter>,
): Promise<number[][]> {
  const BATCH = 32;
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await embedMany({
      model: provider.textEmbeddingModel(model),
      values: batch,
    });
    all.push(...res.embeddings);
  }
  return all;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});