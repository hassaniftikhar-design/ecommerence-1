import 'server-only';

import { CHATBOT_EMBEDDING } from '@/constants/chatbot';

import { getEmbeddingModel } from './model';
import type { EmbeddingVector } from './types';

async function embed(text: string): Promise<EmbeddingVector> {
  const model = await getEmbeddingModel();
  const output = await model(text, { pooling: 'mean', normalize: true });
  const vector = Array.from(output.data as Float32Array);

  if (vector.length !== CHATBOT_EMBEDDING.dimension) {
    throw new Error(`Embedding dimension mismatch: expected ${CHATBOT_EMBEDDING.dimension}`);
  }

  return vector;
}

export function embedQuery(text: string): Promise<EmbeddingVector> {
  return embed(`query: ${text.trim()}`);
}

export function embedDocument(text: string): Promise<EmbeddingVector> {
  return embed(`passage: ${text.trim()}`);
}
