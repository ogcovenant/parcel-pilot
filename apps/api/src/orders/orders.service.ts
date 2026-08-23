import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Order } from './order.entity';
import { Account } from '../accounts/account.entity';

export interface OrderDetail {
  orderId: string;
  accountId: string;
  carrier: string;
  status: string;
  bookedAt: string;
  pickupWindowStart: string;
  pickupWindowEnd: string;
  pickupActualAt: string | null;
  shipmentFeeInr: string;
  carrierFault: boolean;
  customerFault: boolean;
  cancellationRequestedAt: string | null;
  notes: string | null;
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly dataSource: DataSource,
  ) {}

  private repo() {
    return this.dataSource.getRepository(Order);
  }

  async findByOrderId(orderId: string): Promise<Order | null> {
    return this.repo().findOne({
      where: { orderId },
      relations: { account: true },
    });
  }

  async findAll(): Promise<Order[]> {
    return this.repo().find({ relations: { account: true } });
  }

  async findByAccount(accountId: string): Promise<Order[]> {
    return this.repo().find({
      relations: { account: true },
      where: { account: { accountId } },
    });
  }

  async accountIdForOrder(orderId: string): Promise<string | null> {
    const order = await this.findByOrderId(orderId);
    return order?.account?.accountId ?? null;
  }

  toDetail(order: Order): OrderDetail {
    const account = order.account as Account;
    return {
      orderId: order.orderId,
      accountId: account.accountId,
      carrier: order.carrier,
      status: order.status,
      bookedAt: order.bookedAt.toISOString(),
      pickupWindowStart: order.pickupWindowStart.toISOString(),
      pickupWindowEnd: order.pickupWindowEnd.toISOString(),
      pickupActualAt: order.pickupActualAt
        ? order.pickupActualAt.toISOString()
        : null,
      shipmentFeeInr: order.shipmentFeeInr.toString(),
      carrierFault: order.carrierFault,
      customerFault: order.customerFault,
      cancellationRequestedAt: order.cancellationRequestedAt
        ? order.cancellationRequestedAt.toISOString()
        : null,
      notes: order.notes,
    };
  }
}
