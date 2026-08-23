export const createOpenRouter = jest.fn(() => ({
  chat: jest.fn(() => ({ modelId: 'mocked-chat' })),
  textEmbeddingModel: jest.fn(() => ({ modelId: 'mocked-embedding' })),
}));
export const openrouter = createOpenRouter;