import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const ISSUE_TYPES = [
  'sla_risk',
  'recurring_complaint',
  'cross_customer',
  'unusual_activity',
] as const;

export const ISSUE_STATUSES = [
  'open',
  'investigating',
  'resolved',
  'dismissed',
] as const;

@Entity('issue_clusters')
export class IssueCluster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'issue_id', type: 'varchar' })
  issueId: string;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'varchar' })
  severity: string;

  @Column({ type: 'numeric' })
  confidence: string;

  @Column({ type: 'jsonb', default: [], name: 'affected_customers' })
  affectedCustomers: Record<string, unknown>[];

  @Column({ type: 'jsonb', default: [], name: 'related_tickets' })
  relatedTickets: Record<string, unknown>[];

  @Column({ type: 'jsonb', default: [], name: 'related_orders' })
  relatedOrders: Record<string, unknown>[];

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'timestamptz', name: 'detected_at' })
  detectedAt: Date;

  @Column({ type: 'varchar' })
  status: string;
}
