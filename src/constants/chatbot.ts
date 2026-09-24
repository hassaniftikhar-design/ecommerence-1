export const CHATBOT_NAME = 'ShopFast Assistant';
export const CHATBOT_CONTEXT_MESSAGES = 7;

export const CHATBOT_EMBEDDING = {
  modelName: 'Xenova/multilingual-e5-small',
  dimension: 384,
  expectedWarmLatencyMs: 10,
  measuredModelLoadMs: 14_507,
  measuredPeakProcessRssMb: 571,
  similarityMetric: 'cosine'
} as const;

export const CHATBOT_RAG_TOP_K = 6;
export const CHATBOT_SIMILARITY_THRESHOLD = 0.75;
export const CHATBOT_RATE_LIMIT = { requests: 20, windowSeconds: 60 } as const;
