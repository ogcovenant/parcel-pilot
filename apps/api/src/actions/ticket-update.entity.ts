import { Ticket } from '../tickets/ticket.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const TICKET_UPDATE_STATUSES = [
  'prepared',
  'confirmed',
  'executed',
  'cancelled',
  'rejected',
] as const;
export const TICKET_UPDATE_KINDS = ['note', 'status_change'] as const;

@Entity('ticket_updates')
export class TicketUpdate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'update_id', type: 'varchar' })
  updateId: string;

  @ManyToOne(() => Ticket, { nullable: false })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @Column({ type: 'varchar' })
  kind: (typeof TICKET_UPDATE_KINDS)[number];

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar' })
  status: (typeof TICKET_UPDATE_STATUSES)[number];

  @Column({ name: 'created_by', type: 'varchar' })
  createdBy: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'confirmed_at' })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'executed_at' })
  executedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
