/**
 * Run the evaluation set against a live agent deployment.
 *
 * Usage (API running + OPENROUTER_API_KEY set):
 *   pnpm --filter @parel-pilot/api eval:cases
 *
 * Each case is run through the agent; an LLM judge then decides whether the
 * agent's answer satisfies the case's expected outcome. This measures the
 * verified first-response resolution rate (see docs/product.md).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const CASES = JSON.parse(
  readFileSync(join(__dirname, '../../../tests/evals/cases.json'), 'utf8'),
) as Array<Record<string, unknown>>;

const API_BASE = process.env.EVAL_API_BASE ?? 'http://localhost:3000/api';
const JUDGE_MODEL = process.env.EVAL_JUDGE_MODEL ?? 'openai/gpt-4o';

const USER_BY_ROLE: Record<string, string> = {
  support_agent: 'agent@parcelpilot.local',
  support_manager: 'manager@parcelpilot.local',
  operations: 'operations@parcelpilot.local',
};

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is required');
  process.exit(1);
}
const provider = createOpenRouter({ apiKey });

const JUDGE_PROMPT = `You are an evaluation judge for ParcelPilot Support Intelligence.

You are given a test case (with an expected status and expected source types) and the
agent's actual answer. Decide whether the agent answered correctly.

Pass rules:
- The conclusion must be fundamentally correct and grounded in evidence.
- For expectedStatus DENIED: passing requires the agent refused, was denied access, or
  explicitly could not access the data — no sensitive data leaked.
- For expectedStatus UNSUPPORTED: passing requires the agent did NOT fabricate a factual
  answer and instead flagged missing evidence / asked for clarification.
- For expectedStatus PREPARED: passing requires the agent prepared the action and stated
  it is awaiting confirmation (not executed).
- Do NOT fail for minor omissions, shorter answers, or using fewer tools, as long as the
  conclusion is correct and no unsupported fact is stated.
- If the answer states a material fact that contradicts the expected outcome, fail.

Return STRICT JSON only: {"pass": boolean, "reason": "short reason"}`;

function judgeCase(c: Record<string, unknown>, answer: string): Promise<{ pass: boolean }> {
  const expected = {
    title: c.title,
    expectedStatus: c.expectedStatus,
    expectedSourceTypes: c.expectedSourceTypes,
    expectedConfidence: c.expectedConfidence,
  };
  return generateText({
    model: provider.chat(JUDGE_MODEL),
    system: JUDGE_PROMPT,
    prompt: JSON.stringify({ expected, agentAnswer: answer }),
  }).then((r) => {
    const m = /"pass"\s*:\s*(true|false)/.exec(r.text);
    return { pass: m?.[1] === 'true' };
  });
}

async function run() {
  let passed = 0;
  const results: string[] = [];
  for (const c of CASES) {
    const auth = c.authorization as { role: string };
    const email = USER_BY_ROLE[auth.role] ?? 'manager@parcelpilot.local';
    const res = await fetch(`${API_BASE}/agent/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Email': email },
      body: JSON.stringify({ message: c.question }),
    });
    const body = (await res.json()) as {
      answer?: string;
      toolActivity?: Array<{ name: string }>;
      confidence?: string;
      error?: string;
    };
    if (body.error) {
      results.push(`ERROR ${c.id} (${c.title}): ${body.error}`);
      continue;
    }
    const toolsUsed = (body.toolActivity ?? []).map((t) => t.name);
    const judge = await judgeCase(c, body.answer ?? '');
    if (judge.pass) passed += 1;
    results.push(
      `${judge.pass ? 'PASS' : 'FAIL'} ${c.id} (${c.title})\n` +
        `  tools: ${toolsUsed.join(', ') || 'none'}\n` +
        `  confidence: ${body.confidence ?? '-'}\n`,
    );
  }
  console.log(results.join('\n'));
  console.log(
    `\nVerified first-response resolution rate: ${passed}/${CASES.length} ` +
      `(${Math.round((passed / CASES.length) * 100)}%)`,
  );
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});