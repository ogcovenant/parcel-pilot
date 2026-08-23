import { z } from 'zod';
import { User } from '../../auth/user.decorator';

export type ToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};

export type ToolHandler = (args: unknown, user: User) => Promise<ToolResult>;

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  handler: ToolHandler;
}

export function denied(reason: string): ToolResult {
  const normalized = reason.startsWith('Access denied:')
    ? reason
    : `Access denied: ${reason}`;
  return { ok: false, error: normalized };
}

export function ok(data: unknown): ToolResult {
  return { ok: true, data };
}

export function fail(error: string): ToolResult {
  return { ok: false, error };
}
