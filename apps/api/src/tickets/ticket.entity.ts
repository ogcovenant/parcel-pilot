import { Account } from '../accounts/account.entity';
import { Order } from '../orders/order.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const TICKET_STATUSES = ['open', 'closed'] as const;
export const TICKET_CHANNELS = ['email', 'chat'] as const;
export const TICKET_SEVERITIES = ['P1', 'P2', 'P3'] as const;

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'ticket_id', type: 'varchar' })
  ticketId: string;

  @ManyToOne(() => Account, (account) => account.tickets)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @ManyToOne(() => Order, { nullable: true })
  @JoinColumn({ name: 'order_id' })
  order: Order | null;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'varchar' })
  status: (typeof TICKET_STATUSES)[number];

  @Column({ type: 'varchar', nullable: true })
  severity: (typeof TICKET_SEVERITIES)[number] | null;

  @Column({ type: 'varchar' })
  subject: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar' })
  channel: (typeof TICKET_CHANNELS)[number];

  @Column({ name: 'assigned_to', type: 'varchar' })
  assignedTo: string;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'last_customer_message_at',
  })
  lastCustomerMessageAt: Date | null;

  @Column({ type: 'text', nullable: true, name: 'historical_resolution' })
  historicalResolution: string | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'sla_due_at' })
  slaDueAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'resolved_at' })
  resolvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
