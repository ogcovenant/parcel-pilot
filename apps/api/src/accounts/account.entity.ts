import { Order } from 'src/orders/order.entity';
import { Ticket } from 'src/tickets/ticket.entity';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

export enum ACCOUNT_PLAN {
  STANDARD = 'standard',
  GROWTH = 'growth',
  ENTERPRISE = 'enterprise',
}

export enum ACCOUNT_STATUS {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ name: 'account_id', type: 'varchar', nullable: false })
  accountId: string;

  @Column({ name: 'account_name', type: 'varchar', nullable: false })
  accountName: string;

  @Column({ name: 'plan', type: 'enum', enum: ACCOUNT_PLAN, nullable: false })
  plan: ACCOUNT_PLAN;

  @Column({
    name: 'status',
    type: 'enum',
    enum: ACCOUNT_STATUS,
    nullable: false,
  })
  status: ACCOUNT_STATUS;

  @Column({ name: 'csm', type: 'varchar', nullable: false })
  csm: string;

  @Column({ name: 'contract_file', type: 'varchar', nullable: false })
  contractFile: string;

  @Column({ name: 'premium_support', type: 'boolean', nullable: false })
  premiumSupport: boolean;

  @Column({ name: 'notes', type: 'text', nullable: false })
  notes: string;

  @OneToMany(() => Order, (order) => order.account)
  order: Order;

  @OneToMany(() => Ticket, (ticket) => ticket.account)
  ticket: Ticket;
}
