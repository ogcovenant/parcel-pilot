import { Account } from 'src/accounts/account.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum TICKET_STATUS {
  OPEN = 'open',
  CLOSED = 'closed',
}

export enum TICKET_CHANNEL {
  EMAIL = 'email',
  CHAT = 'chat',
}

Entity('tickets');
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ name: 'ticket_id', type: 'varchar', nullable: false })
  ticketId: string;

  @ManyToOne(() => Account, (account) => account.ticket)
  account: Account;

  @Column({ name: 'created_at', type: 'timestamp', nullable: false })
  createdAt: Date;

  @Column({
    name: 'status',
    type: 'enum',
    enum: TICKET_STATUS,
    nullable: false,
  })
  status: TICKET_STATUS;

  @Column({ name: 'subject', type: 'varchar', nullable: false })
  subject: string;

  @Column({ name: 'description', type: 'text', nullable: false })
  description: string;

  @Column({
    name: 'channel',
    type: 'enum',
    enum: TICKET_CHANNEL,
    nullable: false,
  })
  channel: string;

  @Column({ name: 'assigned_to', type: 'varchar', nullable: false })
  assignedTo: string;

  @Column({
    name: 'last_customer_message_at',
    type: 'timestamp',
    nullable: false,
  })
  lastCustomerMessageAt: Date;

  @Column({
    name: 'historical_resolution',
    type: 'text',
  })
  historicalResolution: string;
}
