import { Controller, Get, Param } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { AccessControlService } from '../auth/access-control.service';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '../auth/user.decorator';
import { ForbiddenException } from '@nestjs/common';

@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  async list(@CurrentUser() user: User) {
    const accounts = await this.accountsService.findAll();
    return accounts.map((a) => this.accountsService.toSummary(a));
  }

  @Get(':accountId')
  async get(@Param('accountId') accountId: string, @CurrentUser() user: User) {
    const access = this.accessControl.canAccessAccount(user, accountId);
    if (!access.allowed) throw new ForbiddenException(access.reason);
    const account = await this.accountsService.findByAccountId(accountId);
    if (!account) return { found: false, accountId };
    return this.accountsService.toSummary(account);
  }
}
