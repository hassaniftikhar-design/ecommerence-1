import { z } from 'zod';

export const llmActionTypeSchema = z.enum([
  'SEARCH_CATALOG',
  'ADD_TO_CART',
  'GET_ORDER',
  'VIEW_CART',
  'ADMIN_GET_REVENUE',
  'ADMIN_GET_ORDER_ANALYTICS',
  'ADMIN_GET_TOP_SELLING',
  'ADMIN_GET_LOWEST_SELLING',
  'ADMIN_CHECK_INVENTORY',
  'ADMIN_CHECK_PRODUCT_STOCK',
  'ADMIN_SEARCH_ORDERS',
  'ADMIN_SEARCH_CUSTOMERS',
  'ADMIN_GET_NOTIFICATIONS',
  'ADMIN_METRICS',
  'NONE'
]);

export type LlmActionType = z.infer<typeof llmActionTypeSchema>;

export const llmDecisionSchema = z.object({
  message: z.string().trim().min(1).max(2500),
  action: z.object({
    type: llmActionTypeSchema.default('NONE'),
    searchParams: z.object({
      query: z.string().default(''),
      minPrice: z.number().optional(),
      maxPrice: z.number().optional()
    }).optional(),
    cartParams: z.object({
      productId: z.string().optional(),
      productQuery: z.string().optional(),
      color: z.string().optional(),
      size: z.string().optional(),
      variantId: z.string().optional(),
      quantity: z.number().int().min(1).max(20).default(1)
    }).optional(),
    orderParams: z.object({
      orderNumber: z.string().optional(),
      latest: z.boolean().optional()
    }).optional(),
    adminRevenueParams: z.object({
      period: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      days: z.number().int().optional(),
      date: z.string().optional(),
      query: z.string().optional()
    }).optional(),
    adminProductStockParams: z.object({
      query: z.string().optional(),
      color: z.string().optional(),
      size: z.string().optional(),
      sku: z.string().optional()
    }).optional(),
    adminSearchOrdersParams: z.object({
      query: z.string().optional(),
      orderNumber: z.string().optional(),
      customerName: z.string().optional(),
      status: z.string().optional(),
      period: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      days: z.number().int().optional(),
      date: z.string().optional(),
      limit: z.number().int().min(1).max(50).optional()
    }).optional(),
    adminSearchCustomersParams: z.object({
      query: z.string().optional(),
      limit: z.number().int().min(1).max(20).optional()
    }).optional(),
    adminInventoryParams: z.object({
      filter: z.enum(['all', 'low_stock', 'out_of_stock']).optional()
    }).optional(),
    adminParams: z.object({
      metric: z.enum(['REVENUE', 'TOP_SELLING', 'LOWEST_SELLING', 'INVENTORY', 'ORDERS']).optional(),
      dateRange: z.string().optional()
    }).optional()
  }).default({ type: 'NONE' })
});

export type LlmDecision = z.infer<typeof llmDecisionSchema>;

export function validateGroqDecision(output: string): LlmDecision | null {
  try {
    const cleaned = output.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed: unknown = JSON.parse(cleaned);
    const result = llmDecisionSchema.safeParse(parsed);
    if (result.success) return result.data;
    return null;
  } catch {
    return null;
  }
}

// Retain legacy response shape for API envelope compatibility
export type ValidatedChatResponse = {
  message: string;
  products: Array<{ productId: string; reason: string }>;
  actions: Array<{
    type: 'ADD_TO_CART';
    productId: string;
    variantId: string | null;
    quantity: number;
  }>;
};

export function validateGroqResponse(output: string): ValidatedChatResponse | null {
  try {
    const cleaned = output.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed: unknown = JSON.parse(cleaned);
    const schema = z.object({
      message: z.string().trim().min(1).max(2500),
      products: z.array(z.object({
        productId: z.string(),
        reason: z.string().default('Recommended')
      })).default([]),
      actions: z.array(z.object({
        type: z.literal('ADD_TO_CART'),
        productId: z.string(),
        variantId: z.string().nullable().default(null),
        quantity: z.number().int().min(1).default(1)
      })).default([])
    }).strict();
    const res = schema.safeParse(parsed);
    return res.success ? res.data : null;
  } catch {
    return null;
  }
}

