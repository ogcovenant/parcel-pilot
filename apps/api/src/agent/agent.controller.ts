import { Body, Controller, Get, Post } from '@nestjs/common';
import { AgentService, AgentMessage } from './agent.service';
import { CurrentUser } from '../auth/user.decorator';
import type { User } from '../auth/user.decorator';
import { randomUUID } from 'node:crypto';
import { IssuesService } from '../issues/issues.service';
import { AccessControlService } from '../auth/access-control.service';
import { ForbiddenException } from '@nestjs/common';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly issuesService: IssuesService,
    private readonly accessControl: AccessControlService,
  ) {}

  @Post('chat')
  async chat(
    @Body()
    body: {
      message: string;
      history?: AgentMessage[];
      conversationId?: string;
    },
    @CurrentUser() user: User,
  ) {
    if (!body.message) {
      return { error: 'message is required' };
    }
    const conversationId = body.conversationId ?? randomUUID();
    try {
      const result = await this.agentService.run(
        user,
        body.history ?? [],
        body.message,
        conversationId,
      );
      return result;
    } catch (e) {
      const message = (e as Error).message;
      return {
        error: message,
        requiresConfiguration:
          message.includes('GOOGLE_API_KEY') || message.includes('API key'),
        conversationId,
      };
    }
  }

  @Post('investigate')
  async investigate(
    @Body() body: { issueId: string },
    @CurrentUser() user: User,
  ) {
    const access = this.accessControl.canViewIssueDashboard(user);
    if (!access.allowed) throw new ForbiddenException(access.reason);

    const issue = (await this.issuesService.listIssues()).find(
      (i) => i.issueId === body.issueId,
    );
    if (!issue) return { error: `Issue ${body.issueId} not found` };

    const context = [
      `Issue: ${issue.title}`,
      `Type: ${issue.type}`,
      `Severity: ${issue.severity}`,
      `Confidence: ${issue.confidence}`,
      `Affected customers: ${JSON.stringify(issue.affectedCustomers)}`,
      `Related tickets: ${JSON.stringify(issue.relatedTickets)}`,
      `Summary: ${issue.summary}`,
    ].join('\n');

    try {
      const result = await this.agentService.run(
        user,
        [],
        `Investigate the following detected issue independently using approved tools. Verify it, do not trust it.\n\n${context}`,
        randomUUID(),
      );
      return { issueId: body.issueId, ...result };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}
