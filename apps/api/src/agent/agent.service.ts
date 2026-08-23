import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, isStepCount, tool, type ToolSet } from 'ai';
import { User } from '../auth/user.decorator';
import { ToolRegistry } from './tools/tool-registry';
import { AiProvider } from '../ai/ai.provider';
import { AppConfig } from '../config/app.config';
import { AiConfig } from '../config/ai.config';
import { systemPrompt } from './prompts/system.prompt';
import { evidenceResolverPrompt } from './prompts/evidence-resolver.prompt';
import { responseGeneratorPrompt } from './prompts/response-generator.prompt';

export interface AgentMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolActivity {
  name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  ok: boolean;
  denied?: boolean;
}

export interface SourceRef {
  name: string;
  type: string;
  section?: string;
}

export interface EvidenceResolution {
  applicableEvidence: string[];
  conflictingEvidence: string[];
  decision: string;
  confidence: string;
  reason: string;
  recommendedAction: string;
}

export interface AgentRunResult {
  answer: string;
  toolActivity: ToolActivity[];
  sources: SourceRef[];
  confidence: string;
  evidence: EvidenceResolution | null;
  requiresHumanReview: boolean;
  preparedAction: Record<string, unknown> | null;
  conversationId: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly aiProvider: AiProvider,
    private readonly configService: ConfigService,
  ) {}

  private asOf(): Date {
    const config = this.configService.get<AppConfig>('app');
    return new Date(config?.datasetAsOf ?? Date.now());
  }

  private maxToolRounds(): number {
    return this.configService.get<AiConfig>('ai')?.maxToolRounds ?? 10;
  }

  async run(
    user: User,
    history: AgentMessage[],
    userMessage: string,
    conversationId: string,
  ): Promise<AgentRunResult> {
    const appConfig = this.configService.get<AppConfig>('app');
    const asOf = this.asOf().toISOString();

    const aiTools: ToolSet = {};
    for (const def of this.toolRegistry.list()) {
      aiTools[def.name] = tool({
        description: def.description,
        inputSchema: def.schema,
        execute: async (args: unknown) => def.handler(args, user),
      });
    }

    const result = await generateText({
      model: this.aiProvider.model(),
      system: systemPrompt(user.role, user.accountId, asOf),
      messages: [
        ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user' as const, content: userMessage },
      ],
      tools: aiTools,
      stopWhen: isStepCount(this.maxToolRounds()),
    });

    const { activity, sources, preparedAction } = this.collectSteps(result.steps ?? []);
    const transcript = this.buildTranscript(result.steps ?? [], result.text);
    const evidence = await this.resolveEvidence(transcript, userMessage);
    const finalAnswer = await this.generateResponse(
      userMessage,
      transcript,
      evidence,
      sources,
      preparedAction,
    );

    return {
      answer: finalAnswer,
      toolActivity: activity,
      sources,
      confidence: evidence?.confidence ?? 'LOW',
      evidence,
      requiresHumanReview:
        evidence?.recommendedAction === 'ESCALATE' || evidence?.confidence === 'LOW',
      preparedAction,
      conversationId,
    };
  }

  private collectSteps(steps: Array<Record<string, unknown>>): {
    activity: ToolActivity[];
    sources: SourceRef[];
    preparedAction: Record<string, unknown> | null;
  } {
    const activity: ToolActivity[] = [];
    const sources: SourceRef[] = [];
    let preparedAction: Record<string, unknown> | null = null;

    for (const step of steps) {
      const toolCalls = (step.toolCalls ?? []) as Array<Record<string, unknown>>;
      const toolResults = (step.toolResults ?? []) as Array<Record<string, unknown>>;

      const resultsByName = new Map<string, Record<string, unknown>>();
      for (const tr of toolResults) {
        resultsByName.set(tr.toolCallId as string, tr);
      }

      for (const call of toolCalls) {
        const name = call.toolName as string;
        const callId = call.toolCallId as string;
        const input = (call.input as Record<string, unknown>) ?? {};
        const resultRef = resultsByName.get(callId);
        const raw = resultRef?.output as
          | { ok: boolean; data?: unknown; error?: string }
          | undefined;
        const okFlag = raw?.ok ?? false;
        const denied = !okFlag && (raw?.error ?? '').startsWith('Access denied');
        const errorMessage = raw?.error ?? 'tool execution failed';

        activity.push({
          name,
          input,
          output: okFlag
            ? ((raw?.data as Record<string, unknown>) ?? {})
            : { error: errorMessage },
          ok: okFlag,
          denied,
        });

        this.captureSources(sources, name, okFlag, raw?.data);
        if (
          (name === 'prepare_escalation' ||
            name === 'prepare_ticket_update' ||
            name === 'prepare_follow_up_task') &&
          okFlag
        ) {
          preparedAction = raw?.data as Record<string, unknown>;
          this.logger.debug(
            `captured prepared action ${name}: ${JSON.stringify(preparedAction)?.slice(0, 120)}`,
          );
        }
      }
    }
    return { activity, sources, preparedAction };
  }

  private buildTranscript(
    steps: Array<Record<string, unknown>>,
    finalText: string,
  ): string {
    const parts: string[] = [];
    for (const step of steps) {
      const toolCalls = (step.toolCalls ?? []) as Array<Record<string, unknown>>;
      const toolResults = (step.toolResults ?? []) as Array<Record<string, unknown>>;
      if (toolCalls.length > 0) {
        parts.push(
          `toolCalls: ${toolCalls
            .map((c) => `${c.toolName}(${JSON.stringify(c.input)?.slice(0, 300)})`)
            .join('; ')}`,
        );
      }
      for (const tr of toolResults) {
        parts.push(`tool(${tr.toolName}): ${JSON.stringify(tr.output)?.slice(0, 2000)}`);
      }
    }
    parts.push(`final assistant: ${finalText}`);
    return parts.join('\n\n');
  }

  private async resolveEvidence(
    transcript: string,
    question: string,
  ): Promise<EvidenceResolution | null> {
    try {
      const response = await generateText({
        model: this.aiProvider.model(),
        system: evidenceResolverPrompt,
        prompt: `Question: ${question}\n\nInvestigation transcript:\n${transcript.slice(0, 12000)}`,
      });
      const parsed = JSON.parse(extractJson(response.text)) as EvidenceResolution;
      return parsed;
    } catch (e) {
      this.logger.warn(`Evidence resolution failed: ${(e as Error).message}`);
      return null;
    }
  }

  private async generateResponse(
    question: string,
    transcript: string,
    evidence: EvidenceResolution | null,
    sources: SourceRef[],
    preparedAction: Record<string, unknown> | null,
  ): Promise<string> {
    const evidenceBlock = evidence ? JSON.stringify(evidence) : 'not resolved';
    const response = await generateText({
      model: this.aiProvider.model(),
      system: responseGeneratorPrompt,
      prompt: [
        `Question: ${question}`,
        `Evidence resolution: ${evidenceBlock}`,
        `Sources: ${JSON.stringify(sources)}`,
        `Prepared action: ${preparedAction ? JSON.stringify(preparedAction) : 'none'}`,
        `Investigation transcript:\n${transcript.slice(0, 12000)}`,
        'Produce the final answer now using the required format.',
      ].join('\n\n'),
    });
    return response.text;
  }

  private captureSources(
    sources: SourceRef[],
    toolName: string,
    okFlag: boolean,
    data: unknown,
  ): void {
    if (!okFlag || !data) return;
    const record = data as Record<string, unknown>;

    if (toolName === 'search_documents' && Array.isArray(record)) {
      for (const hit of record as Array<Record<string, unknown>>) {
        sources.push({
          name: (hit.title as string) ?? 'document',
          type: (hit.sourceType as string) ?? 'document',
          section: (hit.section as string) ?? undefined,
        });
      }
      return;
    }
    if (toolName === 'get_order' && record.orderId) {
      sources.push({ name: record.orderId as string, type: 'Operational Data' });
    }
    if (toolName === 'get_ticket' && record.ticketId) {
      sources.push({ name: record.ticketId as string, type: 'Operational Data' });
    }
    if (toolName === 'get_account' && record.accountId) {
      sources.push({ name: (record.accountName as string) ?? record.accountId as string, type: 'Operational Data' });
    }
  }
}

function extractJson(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return text;
  return text.slice(start, end + 1);
}