export const generateText = jest.fn(async () => ({ text: 'mocked', steps: [], toolCalls: [], toolResults: [] }));
export const isStepCount = () => () => false;
export const tool = jest.fn((def: unknown) => def);
export const embed = jest.fn();
export const embedMany = jest.fn();
export type ToolSet = Record<string, unknown>;
export type Tool = { description: string };