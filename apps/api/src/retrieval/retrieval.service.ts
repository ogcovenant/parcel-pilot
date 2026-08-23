import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AiProvider } from '../ai/ai.provider';

export interface SearchFilter {
  query: string;
  /** If provided, customer agreements are restricted to this account and general docs are allowed. */
  customerAccountId?: string;
  /** Optional doc type filter: policy | sop | product | agreement. */
  documentType?: string;
  /** When false (default), deprecated sources are excluded. */
  includeDeprecated?: boolean;
  limit?: number;
}

export interface RetrievalHit {
  chunkId: string;
  documentId: string;
  title: string;
  section: string | null;
  content: string;
  sourceType: string;
  version: string;
  status: string;
  authorityRank: number;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  customerAccountId: string | null;
  relevanceScore: number;
}

interface ChunkRow {
  id: string;
  document_id: string;
  section: string | null;
  content: string;
  doc_title: string;
  doc_source_type: string;
  doc_version: string;
  doc_status: string;
  doc_authority_rank: number;
  doc_effective_from: string | null;
  doc_effective_to: string | null;
  doc_customer_account_id: string | null;
  similarity: number;
}

@Injectable()
export class RetrievalService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly dataSource: DataSource,
    private readonly aiProvider: AiProvider,
  ) {}

  /**
   * Semantic search over document chunks with metadata-based reranking.
   * Candidate selection uses vector similarity; final ranking blends vector
   * relevance with source authority, currentness, and customer specificity.
   */
  async searchDocuments(filter: SearchFilter): Promise<RetrievalHit[]> {
    const limit = filter.limit ?? 8;
    const candidates = await this.candidates(filter, limit * 3);

    const reranked = candidates
      .map((row) => this.score(row, filter))
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);

    return reranked.map(({ row, finalScore }) => ({
      chunkId: row.id,
      documentId: row.document_id,
      title: row.doc_title,
      section: row.section,
      content: row.content,
      sourceType: row.doc_source_type,
      version: row.doc_version,
      status: row.doc_status,
      authorityRank: row.doc_authority_rank,
      effectiveFrom: row.doc_effective_from,
      effectiveTo: row.doc_effective_to,
      customerAccountId: row.doc_customer_account_id,
      relevanceScore: round(finalScore),
    }));
  }

  private async candidates(
    filter: SearchFilter,
    limit: number,
  ): Promise<ChunkRow[]> {
    const [embedding] = await this.aiProvider.embedManyTexts([filter.query]);

    const params: unknown[] = [JSON.stringify(embedding), limit];
    const where: string[] = [];
    let paramIndex = 3;

    if (filter.customerAccountId !== undefined) {
      where.push(
        `(dc.doc_customer_account_id IS NULL OR dc.doc_customer_account_id = $${paramIndex})`,
      );
      params.push(filter.customerAccountId);
      paramIndex += 1;
    } else {
      // No customer context: customer agreements are not applicable.
      where.push('dc.doc_customer_account_id IS NULL');
    }

    if (filter.documentType) {
      where.push(`dc.doc_source_type = $${paramIndex}`);
      params.push(filter.documentType);
      paramIndex += 1;
    }

    if (!filter.includeDeprecated) {
      where.push(`dc.doc_status <> 'deprecated'`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const sql = `
      SELECT dc.id, dc.document_id, dc.section, dc.content,
             dc.doc_title, dc.doc_source_type, dc.doc_version, dc.doc_status,
             dc.doc_authority_rank, dc.doc_effective_from, dc.doc_effective_to,
             dc.doc_customer_account_id,
             1 - (dc.embedding <=> $1::vector) AS similarity
      FROM document_chunks dc
      ${whereClause}
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2
    `;
    return (await this.dataSource.query(sql, params)) as ChunkRow[];
  }

  private score(
    row: ChunkRow,
    filter: SearchFilter,
  ): { row: ChunkRow; finalScore: number } {
    const sim = row.similarity ?? 0;
    const authorityBoost = row.doc_authority_rank / 100;
    const currentBoost = row.doc_status === 'deprecated' ? 0.3 : 1.0;
    const customerBoost =
      filter.customerAccountId &&
      row.doc_customer_account_id === filter.customerAccountId
        ? 1.2
        : 1.0;
    // Blend: relevance is primary, authority/currentness/customer-specificity adjust.
    const finalScore =
      (0.65 * sim + 0.35 * authorityBoost) * currentBoost * customerBoost;
    return { row, finalScore };
  }
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
