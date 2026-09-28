import { getProductByIdServer } from '@/server/services/product.service';
import { getMyOrdersByIdsForChatServer, searchMyOrdersForChatServer, type ChatOrderSummary } from '@/server/services/order.service';
import type { Product } from '@/types/product.types';

export type PendingConversationAction = {
  type: 'ADD_TO_CART' | 'SEARCH_CATALOG';
  productQuery?: string;
  productId?: string;
  quantity?: number;
  missingOptions?: ('color' | 'size' | 'variant' | 'product_selection')[];
};

export type ConversationState = {
  activeProductId?: string;
  activeProductIds?: string[];
  activeVariantId?: string;
  activeOrderId?: string;
  activeOrderNumber?: string;
  pendingAction?: PendingConversationAction;
};

export type ChatContextMessage = {
  role: 'USER' | 'ASSISTANT';
  content: string;
  metadata?: unknown;
};

export type AuthoritativeStateEntities = {
  activeProduct: Product | null;
  activeProductCandidates: Product[];
  activeOrder: ChatOrderSummary | null;
};

export function extractConversationState(context: ChatContextMessage[] = []): ConversationState {
  const state: ConversationState = {};

  for (let i = context.length - 1; i >= 0; i--) {
    const msg = context[i];
    if (msg?.role === 'ASSISTANT' && msg.metadata && typeof msg.metadata === 'object' && !Array.isArray(msg.metadata)) {
      const meta = msg.metadata as Record<string, unknown>;

      if (meta.state && typeof meta.state === 'object' && !Array.isArray(meta.state)) {
        const saved = meta.state as Record<string, unknown>;
        if (!state.activeProductId && typeof saved.activeProductId === 'string' && saved.activeProductId) {
          state.activeProductId = saved.activeProductId;
        }
        if (!state.activeProductIds && Array.isArray(saved.activeProductIds)) {
          state.activeProductIds = saved.activeProductIds.filter((id): id is string => typeof id === 'string' && Boolean(id));
        }
        if (!state.activeVariantId && typeof saved.activeVariantId === 'string' && saved.activeVariantId) {
          state.activeVariantId = saved.activeVariantId;
        }
        if (!state.activeOrderId && typeof saved.activeOrderId === 'string' && saved.activeOrderId) {
          state.activeOrderId = saved.activeOrderId;
        }
        if (!state.activeOrderNumber && typeof saved.activeOrderNumber === 'string' && saved.activeOrderNumber) {
          state.activeOrderNumber = saved.activeOrderNumber;
        }
        if (!state.pendingAction && saved.pendingAction && typeof saved.pendingAction === 'object' && !Array.isArray(saved.pendingAction)) {
          const pa = saved.pendingAction as Record<string, unknown>;
          if (pa.type === 'ADD_TO_CART' || pa.type === 'SEARCH_CATALOG') {
            state.pendingAction = {
              type: pa.type,
              productQuery: typeof pa.productQuery === 'string' ? pa.productQuery : undefined,
              productId: typeof pa.productId === 'string' ? pa.productId : undefined,
              quantity: typeof pa.quantity === 'number' ? pa.quantity : undefined,
              missingOptions: Array.isArray(pa.missingOptions)
                ? pa.missingOptions.filter((o): o is ('color' | 'size' | 'variant' | 'product_selection') => typeof o === 'string')
                : undefined
            };
          }
        }
      }

      // Fallback extraction from productCards if state was not explicitly tagged
      if (!state.activeProductId && Array.isArray(meta.productCards) && meta.productCards.length > 0) {
        const firstCard = meta.productCards[0];
        if (firstCard && typeof firstCard === 'object' && 'id' in firstCard && typeof firstCard.id === 'string') {
          state.activeProductId = firstCard.id;
        }
      }

      if (!state.activeProductIds && Array.isArray(meta.productCards) && meta.productCards.length > 0) {
        state.activeProductIds = meta.productCards
          .flatMap((c) => c && typeof c === 'object' && 'id' in c && typeof c.id === 'string' ? [c.id] : []);
      }

      if (state.activeProductId && state.activeOrderId) {
        break;
      }
    }
  }

  return state;
}

export async function rehydrateConversationEntities(
  state: ConversationState,
  userId: string
): Promise<AuthoritativeStateEntities> {
  const candidateIds = [
    ...(state.activeProductId ? [state.activeProductId] : []),
    ...(state.pendingAction?.productId ? [state.pendingAction.productId] : []),
    ...(state.activeProductIds || [])
  ];
  const uniqueCandidateIds = [...new Set(candidateIds)].slice(0, 5);

  const [candidateProducts, activeOrders] = await Promise.all([
    uniqueCandidateIds.length > 0
      ? Promise.all(uniqueCandidateIds.map((id) => getProductByIdServer(id, false)))
      : Promise.resolve([]),
    state.activeOrderId
      ? getMyOrdersByIdsForChatServer(userId, [state.activeOrderId])
      : state.activeOrderNumber
        ? searchMyOrdersForChatServer(userId, state.activeOrderNumber)
        : Promise.resolve([])
  ]);

  const validProducts = candidateProducts.filter((p): p is Product => Boolean(p && p.isActive));
  const activeProduct = validProducts.find((p) => p.id === state.activeProductId) || validProducts[0] || null;

  return {
    activeProduct,
    activeProductCandidates: validProducts,
    activeOrder: activeOrders[0] || null
  };
}
