import { Ticket } from '../tickets/ticket.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const FOLLOW_UP_STATUSES = [
  'prepared',
  'confirmed',
  'executed',
  'cancelled',
] as const;

@Entity('follow_up_tasks')
export class FollowUpTask {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'task_id', type: 'varchar' })
  taskId: string;

  @ManyToOne(() => Ticket, { nullable: true })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket | null;

  @Column({ type: 'varchar' })
  assignee: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'due_at' })
  dueAt: Date | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar' })
  status: (typeof FOLLOW_UP_STATUSES)[number];

  @Column({ name: 'created_by', type: 'varchar' })
  createdBy: string;

  @Column({ type: 'timestamptz', nullable: true, name: 'confirmed_at' })
  confirmedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true, name: 'executed_at' })
  executedAt: Date | null;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
