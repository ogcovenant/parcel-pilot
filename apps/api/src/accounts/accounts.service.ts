import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Account } from './account.entity';

export interface AccountSummary {
  accountId: string;
  accountName: string;
  plan: string;
  status: string;
  csm: string;
  premiumSupport: boolean;
  hasContract: boolean;
  notes: string | null;
}

@Injectable()
export class AccountsService {
  constructor(
    @Inject('DATABASE_CONNECTION') private readonly dataSource: DataSource,
  ) {}

  private repo() {
    return this.dataSource.getRepository(Account);
  }

  async findByAccountId(accountId: string): Promise<Account | null> {
    return this.repo().findOne({ where: { accountId } });
  }

  async findAll(): Promise<Account[]> {
    return this.repo().find();
  }

  toSummary(account: Account): AccountSummary {
    return {
      accountId: account.accountId,
      accountName: account.accountName,
      plan: account.plan,
      status: account.status,
      csm: account.csm,
      premiumSupport: account.premiumSupport,
      hasContract: Boolean(account.contractFile),
      notes: account.notes,
    };
  }
}
