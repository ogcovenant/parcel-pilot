import { Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { IssuesService } from './issues.service';
import { AccessControlService } from '../auth/access-control.service';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '../auth/user.decorator';

@Controller('issues')
export class IssuesController {
  constructor(
    private readonly issuesService: IssuesService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Get()
  async list(@CurrentUser() user: User) {
    const access = this.accessControl.canViewIssueDashboard(user);
    if (!access.allowed) throw new ForbiddenException(access.reason);
    return this.issuesService.listIssues();
  }

  @Post('detect')
  async detect(@CurrentUser() user: User) {
    const access = this.accessControl.canViewIssueDashboard(user);
    if (!access.allowed) throw new ForbiddenException(access.reason);
    const detected = await this.issuesService.detectIssues();
    const saved = await this.issuesService.saveIssues(detected);
    return { detected: detected.length, issues: saved };
  }
}
