import { Account } from 'src/accounts/account.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

export enum ORDER_STATUS {
  BOOKED = 'booked',
  PICKED_UP = 'picked_up',
  DELIVERED = 'delivered',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  uuid: string;

  @Column({ name: 'order_id', type: 'varchar', nullable: false })
  orderId: string;

  @ManyToOne(() => Account, (account) => account.order)
  account: Account;

  @Column({ name: 'carrier', type: 'varchar', nullable: false })
  carrier: string;

  @Column({ name: 'status', type: 'enum', enum: ORDER_STATUS, nullable: false })
  status: ORDER_STATUS;

  @Column({ name: 'booked_at', type: 'timestamp', nullable: false })
  bookedAt: Date;

  @Column({ name: 'pickup_window_start', type: 'timestamp', nullable: false })
  pickupWindowStart: Date;

  @Column({ name: 'pickup_window_end', type: 'timestamp', nullable: false })
  pickupWindowEnd: Date;

  @Column({ name: 'pickup_actual_at', type: 'timestamp', nullable: false })
  pickupActualAt: Date;

  @Column({ name: 'shipment_fee_inr', type: 'integer', nullable: false })
  shipmentFeeInr: Date;

  @Column({ name: 'carrier_fault', type: 'boolean', nullable: false })
  carrierFault: boolean;

  @Column({ name: 'customer_fault', type: 'boolean', nullable: false })
  customerFault: boolean;

  @Column({
    name: 'cancellation_requested_at',
    type: 'timestamp',
    nullable: false,
  })
  cancellationRequestedAt: Date;

  @Column({ name: 'notes', type: 'text', nullable: false })
  notes: boolean;
}
