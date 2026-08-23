import { Account } from '../accounts/account.entity';
import { Document } from './document.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('document_chunks')
export class DocumentChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Document, (document) => document.chunks, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @Column({ type: 'integer', name: 'chunk_index' })
  chunkIndex: number;

  @Column({ type: 'varchar', nullable: true })
  section: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'vector', precision: 1536, nullable: true })
  embedding: string | null;

  @Column({ name: 'doc_title', type: 'varchar' })
  docTitle: string;

  @Column({ name: 'doc_source_type', type: 'varchar' })
  docSourceType: string;

  @Column({ name: 'doc_version', type: 'varchar' })
  docVersion: string;

  @Column({ name: 'doc_status', type: 'varchar' })
  docStatus: string;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'doc_customer_account_id' })
  docCustomerAccount: Account | null;

  @Column({ type: 'date', nullable: true, name: 'doc_effective_from' })
  docEffectiveFrom: string | null;

  @Column({ type: 'date', nullable: true, name: 'doc_effective_to' })
  docEffectiveTo: string | null;

  @Column({ type: 'integer', name: 'doc_authority_rank' })
  docAuthorityRank: number;

  @Column({ type: 'jsonb' })
  metadata: Record<string, unknown>;
}
