import { z } from 'zod';

const responseSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  products: z.array(z.object({
    productId: z.string().min(1).max(100),
    reason: z.string().trim().max(240)
  }).strict()).max(5),
  actions: z.array(z.object({
    type: z.literal('ADD_TO_CART'),
    productId: z.string().min(1).max(100),
    variantId: z.string().max(100).nullable(),
    quantity: z.number().int().min(1).max(10)
  }).strict()).max(3)
}).strict();

export type ValidatedChatResponse = z.infer<typeof responseSchema>;

export function validateGroqResponse(output: string): ValidatedChatResponse | null {
  try {
    const parsed: unknown = JSON.parse(output);
    const result = responseSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
