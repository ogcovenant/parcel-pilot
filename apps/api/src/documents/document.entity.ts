import { Account } from '../accounts/account.entity';
import { DocumentChunk } from './document-chunk.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const DOCUMENT_SOURCE_TYPES = [
  'policy',
  'sop',
  'product',
  'agreement',
] as const;
export const DOCUMENT_STATUSES = ['current', 'deprecated', 'active'] as const;

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'document_id', type: 'varchar' })
  documentId: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar', name: 'source_type' })
  sourceType: (typeof DOCUMENT_SOURCE_TYPES)[number];

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'customer_account_id' })
  customerAccount: Account | null;

  @Column({ type: 'varchar' })
  version: string;

  @Column({ type: 'varchar' })
  status: (typeof DOCUMENT_STATUSES)[number];

  @Column({ type: 'date', nullable: true, name: 'effective_from' })
  effectiveFrom: string | null;

  @Column({ type: 'date', nullable: true, name: 'effective_to' })
  effectiveTo: string | null;

  @Column({ type: 'integer', name: 'authority_rank' })
  authorityRank: number;

  @Column({ name: 'source_file', type: 'varchar' })
  sourceFile: string;

  @Column({ type: 'text' })
  content: string;

  @OneToMany(() => DocumentChunk, (chunk) => chunk.document)
  chunks: DocumentChunk[];
}
