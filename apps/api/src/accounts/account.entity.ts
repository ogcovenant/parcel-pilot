import { Order } from '../orders/order.entity';
import { Ticket } from '../tickets/ticket.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

export const ACCOUNT_PLANS = ['standard', 'growth', 'enterprise'] as const;
export const ACCOUNT_STATUSES = ['active', 'inactive'] as const;

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'account_id', type: 'varchar' })
  accountId: string;

  @Column({ name: 'account_name', type: 'varchar' })
  accountName: string;

  @Column({ type: 'varchar' })
  plan: (typeof ACCOUNT_PLANS)[number];

  @Column({ type: 'varchar' })
  status: (typeof ACCOUNT_STATUSES)[number];

  @Column({ type: 'varchar' })
  csm: string;

  @Column({ type: 'varchar', nullable: true, name: 'contract_file' })
  contractFile: string | null;

  @Column({ type: 'boolean', default: false, name: 'premium_support' })
  premiumSupport: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @OneToMany(() => Order, (order) => order.account)
  orders: Order[];

  @OneToMany(() => Ticket, (ticket) => ticket.account)
  tickets: Ticket[];
}
