import { Account } from '../accounts/account.entity';
import { Ticket } from '../tickets/ticket.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const ESCALATION_STATUSES = [
  'prepared',
  'confirmed',
  'executed',
  'cancelled',
  'rejected',
] as const;

@Entity('escalations')
export class Escalation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'escalation_id', type: 'varchar' })
  escalationId: string;

  @ManyToOne(() => Ticket, { nullable: true })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket | null;

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'account_id' })
  account: Account | null;

  @Column({ type: 'varchar' })
  priority: string;

  @Column({ name: 'target_team', type: 'varchar' })
  targetTeam: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'varchar' })
  status: (typeof ESCALATION_STATUSES)[number];

  @Column({ name: 'created_by', type: 'varchar' })
  createdBy: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'confirmed_at' })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'executed_at' })
  executedAt: Date | null;

  @Column({ type: 'jsonb', default: [] })
  evidence: Record<string, unknown>[];

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
