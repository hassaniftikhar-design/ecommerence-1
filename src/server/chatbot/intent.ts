import type { ChatActor } from './tools';

export type ChatIntent =
  | 'PRODUCT_SEARCH' | 'PRODUCT_DETAILS' | 'PRODUCT_AVAILABILITY' | 'PRODUCT_RECOMMENDATION'
  | 'ORDER_SEARCH' | 'ORDER_STATUS' | 'ORDER_HISTORY' | 'CART_VIEW' | 'CART_ADD'
  | 'STORE_POLICY' | 'SHIPPING' | 'RETURNS' | 'ADMIN_REVENUE' | 'ADMIN_SALES'
  | 'ADMIN_INVENTORY' | 'ADMIN_ORDER_ANALYTICS' | 'GREETING' | 'OUT_OF_SCOPE' | 'SECURITY_INJECTION';

const adminPatterns: Array<[ChatIntent, RegExp]> = [
  ['ADMIN_REVENUE', /\b(revenue|income|earnings|sales total|how much did we make|total revenue)\b/i],
  ['ADMIN_SALES', /\b(top|best|lowest)\s+selling products?\b|\bsales analytics\b|\bsales report\b/i],
  ['ADMIN_INVENTORY', /\b(inventory report|stock report|low-stock report|low stock analytics|all inventory)\b/i],
  ['ADMIN_ORDER_ANALYTICS', /\b(order analytics|orders by status|order counts|how many orders|number of orders)\b/i]
];

const customerPatterns: Array<[ChatIntent, RegExp]> = [
  // Greetings / Introduction
  ['GREETING', /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|assalam\s*o?\s*alaikum|aoa|salam|help|who are you|what can you do)\b/i],

  // Cart operations
  ['CART_ADD', /\b(add|put)\b.{0,35}\b(cart|bag)\b|\b(cart|bag)\b.{0,35}\b(add|put)\b/i],
  ['CART_VIEW', /\b(show|view|what is in|see|open|check)\b.{0,25}\b(my )?(cart|bag)\b|^cart$|^view cart$/i],

  // Order queries (Strictly require order context to prevent matching 'track suit')
  ['ORDER_HISTORY', /\b(my orders|previous orders|order history|past purchases|all my orders|what did i buy)\b/i],
  ['ORDER_STATUS', /\b(where is (my )?(last |latest |recent )?order|track (my )?(last |latest |recent )?(order|package|delivery|shipment)|(last |latest |recent |previous )orders?( status)?|order status|delivery (update|status)|what about (my )?(last |latest |recent )?order|status of (my )?(last |latest |recent )?order)\b|\b(order|tracking)\s*#?\s*\d{4,}|\bstatus of order\b/i],
  ['ORDER_SEARCH', /\border\s*#?\s*\d{4,}\b/i],

  // Policies / Support
  ['SHIPPING', /\b(shipping (time|cost|policy|fee)|delivery (time|charges|fee)|how long does (shipping|delivery) take|when will it arrive)\b/i],
  ['RETURNS', /\b(return policy|how (can|do) i return|refund policy|exchange policy|money back)\b/i],
  ['STORE_POLICY', /\b(store policy|payment methods|cash on delivery|cod available|store hours|contact support|customer care)\b/i],

  // Product Specific Details & Availability
  ['PRODUCT_AVAILABILITY', /\b(in stock|out of stock|available|availability|how many left|is .* in stock|are .* available)\b/i],
  ['PRODUCT_DETAILS', /\b(details of|specs of|specifications|price of|how much is|cost of|what size|what colou?rs?|product code|sku)\b/i],
  ['PRODUCT_RECOMMENDATION', /\b(recommend|suggest|best|top rated|looking for|want something|need something|something (?:comfortable|warm|lightweight)|gift idea)\b|\b(mujhe|chahiye|dikhao|batao|kuch acha)\b/i],

  // Common Product Search trigger words
  ['PRODUCT_SEARCH', /\b(do you have|do you sell|any|show me|find|search|browse|give me|is there|are there|i want|i need|buy|get|looking for|products?|items?|catalog|shop|clothes|clothing|shoes|slippers|bracel[a-z]*|glasses|trimmers?|watch(es)?|grippers?|track\s*suits?|hoodies?|shirts?|pants|jackets?)\b/i]
];

export function detectChatIntent(message: string, actor: ChatActor): ChatIntent {
  const trimmed = message.trim();
  if (!trimmed) return 'OUT_OF_SCOPE';

  // Check admin patterns if user is admin
  if (actor.role === 'ADMIN') {
    const adminMatch = adminPatterns.find(([, pattern]) => pattern.test(trimmed));
    if (adminMatch) return adminMatch[0];
  } else {
    const adminMatch = adminPatterns.find(([, pattern]) => pattern.test(trimmed));
    if (adminMatch) {
      if (adminMatch[0] === 'ADMIN_SALES') return 'PRODUCT_RECOMMENDATION';
      if (adminMatch[0] === 'ADMIN_ORDER_ANALYTICS') return 'ORDER_HISTORY';
      return 'OUT_OF_SCOPE';
    }
  }

  // Check customer intent patterns
  const customerMatch = customerPatterns.find(([, pattern]) => pattern.test(trimmed));
  if (customerMatch) return customerMatch[0];

  // In an e-commerce assistant, if a customer sends a query that is not a recognized policy/admin/cart/order query,
  // treat it as a product search query (e.g. typing "slippers", "braclet", "blue hoodie size M", "wooden watch", etc.)
  const alphanumericCount = (trimmed.match(/[\p{L}\p{N}]+/gu) || []).length;
  if (alphanumericCount >= 1) {
    return 'PRODUCT_SEARCH';
  }

  return 'OUT_OF_SCOPE';
}
