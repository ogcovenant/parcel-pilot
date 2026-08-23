import { Account } from '../accounts/account.entity';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const ORDER_STATUSES = ['BOOKED', 'PICKED_UP', 'DELIVERED'] as const;

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, name: 'order_id', type: 'varchar' })
  orderId: string;

  @ManyToOne(() => Account, (account) => account.orders)
  @JoinColumn({ name: 'account_id' })
  account: Account;

  @Column({ type: 'varchar' })
  carrier: string;

  @Column({ type: 'varchar' })
  status: (typeof ORDER_STATUSES)[number];

  @Column({ type: 'timestamptz', name: 'booked_at' })
  bookedAt: Date;

  @Column({ type: 'timestamptz', name: 'pickup_window_start' })
  pickupWindowStart: Date;

  @Column({ type: 'timestamptz', name: 'pickup_window_end' })
  pickupWindowEnd: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'pickup_actual_at' })
  pickupActualAt: Date | null;

  @Column({ type: 'numeric', name: 'shipment_fee_inr' })
  shipmentFeeInr: string;

  @Column({ type: 'boolean', default: false, name: 'carrier_fault' })
  carrierFault: boolean;

  @Column({ type: 'boolean', default: false, name: 'customer_fault' })
  customerFault: boolean;

  @Column({
    type: 'timestamptz',
    nullable: true,
    name: 'cancellation_requested_at',
  })
  cancellationRequestedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
