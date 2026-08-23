export const google = Object.assign(
  jest.fn(() => ({ modelId: 'mocked' })),
  {
    textEmbeddingModel: jest.fn(() => ({ modelId: 'mocked-embedding' })),
  },
);