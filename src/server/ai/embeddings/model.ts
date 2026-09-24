import 'server-only';

import { pipeline } from '@huggingface/transformers';
import type { FeatureExtractionPipelineType } from '@huggingface/transformers';

import { CHATBOT_EMBEDDING } from '@/constants/chatbot';

let modelPromise: Promise<FeatureExtractionPipelineType> | undefined;
let modelStatus: 'not-loaded' | 'loading' | 'ready' | 'error' = 'not-loaded';

export function getEmbeddingModelStatus() {
  return modelStatus;
}

export function getEmbeddingModel(): Promise<FeatureExtractionPipelineType> {
  if (!modelPromise) {
    modelStatus = 'loading';
    modelPromise = pipeline(
      'feature-extraction',
      CHATBOT_EMBEDDING.modelName,
      { dtype: 'q8' }
    ).then((model) => {
      modelStatus = 'ready';
      return model;
    }).catch((error: unknown) => {
      // Let a later health check or request retry initialization after a transient failure.
      modelStatus = 'error';
      modelPromise = undefined;
      throw error;
    }) as Promise<FeatureExtractionPipelineType>;
  }

  return modelPromise;
}
