import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { AccessControlService } from '../auth/access-control.service';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '../auth/user.decorator';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  async list(@CurrentUser() user: User) {
    const orders = await this.ordersService.findAll();
    return orders.map((o) => this.ordersService.toDetail(o));
  }

  @Get(':orderId')
  async get(@Param('orderId') orderId: string, @CurrentUser() user: User) {
    const order = await this.ordersService.findByOrderId(orderId);
    if (!order) return { found: false, orderId };
    const accountId = order.account.accountId;
    const access = this.accessControl.canAccessAccount(user, accountId);
    if (!access.allowed) throw new ForbiddenException(access.reason);
    return this.ordersService.toDetail(order);
  }
}
