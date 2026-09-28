import 'server-only';

import type { ChatActor } from './tools';
import type { ConversationState } from './conversation-state';
import type { ChatLanguage } from './formatters';
import type { LlmDecision } from './response-validator';

export function generateFallbackDecision(args: {
  actor: ChatActor;
  message: string;
  state: ConversationState;
  lang: ChatLanguage;
}): LlmDecision {
  const { actor, message, state, lang } = args;

  const isCartView = /(?:what(?:'s|\s+is)\s+in\s+(?:my\s+)?(?:cart|bag)|view\s+cart|show\s+(?:my\s+)?(?:cart|bag)|^cart$|^bag$|mera\s*cart|mera\s*bag|cart\s*mein\s*kya\s*hai|cart\s*dikhao|کارٹ\s*دکھاؤ|کارٹ\s*دیکھیں)/i.test(message);
  const isCartAdd = /(?:add|put|dalo|daal\s*do|cart\s*mein|کارٹ|شامل\s*کر)/i.test(message);
  const isOrderQuery = /(?:order|status|delivery|mera\s*order|آرڈر)\b/i.test(message) || (/\b(?:track|tracking)\b/i.test(message) && !/\btrack\s*suits?\b/i.test(message));
  const isGreetingOrFiller = /^(?:hi|hello|hey|salam|assalam|aao|kia haal|kaise ho|who are you|kya kar sakte|hmm|ok|cool|aha|acha|thanks|thank you|thanks a lot|shukriya|bye|goodbye|allah hafiz|perfect|ok perfect|great)[\s!.,?]*$/i.test(message.trim());

  if (actor.role === 'ADMIN') {
    const isOffTopicQuery = /^(?:what\s+is\s+(?:the\s+)?capital|who\s+is\s+(?:the\s+)?(?:president|prime\s*minister|ceo)|tell\s+me\s+a\s+joke|write\s+(?:a\s+)?(?:poem|essay|code|story)|solve\s+\d+|calculate\s+\d+|weather\s+in|recipe\s+for)\b/i.test(message.trim());

    if (isOffTopicQuery) {
      return {
        message: lang === 'URDU_SCRIPT'
          ? 'میں شاپ فاسٹ ایڈمن اسسٹنٹ ہوں۔ میں اسٹور اینالیٹکس، ریونیو، انوینٹری، آرڈرز اور پروڈکٹس کے لیے حاضر ہوں۔'
          : lang === 'ROMAN_URDU'
            ? 'Main ShopFast admin assistant hoon. Main store analytics, revenue, inventory, orders aur products ke hawale se madad kar sakta hoon.'
            : 'I\'m the ShopFast admin assistant. I can help with store analytics, revenue, variant inventory, orders, and product lookups.',
        action: { type: 'NONE' }
      };
    }

    const isCapabilityOrMetaQuery = /^(?:can\s+you|could\s+you|are\s+you\s+able\s+to|do\s+you\s+support|is\s+it\s+possible\s+to|what\s+can\s+you\s+do|how\s+can\s+you\s+help|what\s+are\s+your\s+capabilities|kya\s+aap|kya\s+tum|کیا\s+آپ)\b/i.test(message.trim()) &&
      !/\b(check|find|get|show|search|calculate|tell|give|list|dalo|daal)\s+(?:me\s+)?(?:the\s+)?(?:revenue|sales?|stock|orders?|products?|inventory|customers?|notifications?|aov)\s+(?:for|of|on|in|from|between|with|sku|id)\b/i.test(message.trim());

    if (isCapabilityOrMetaQuery) {
      return {
        message: lang === 'URDU_SCRIPT'
          ? 'جی ہاں، بالکل! آپ کسی بھی مخصوص تاریخ یا ٹائم فریم کے لیے اسٹور ریوینیو، آرڈرز کی گنتی، اسٹیٹس بریک ڈاؤن یا آرڈرز کی لسٹ معلوم کر سکتے ہیں (مثلاً "last 2 weeks orders", "sales on 2026-09-15", "orders between Sept 1 and Sept 15")۔'
          : lang === 'ROMAN_URDU'
            ? 'Jee bilkul! Aap kisi bhi specific date ya custom date range ke mutabiq store revenue analytics, order counts, status breakdown ya orders ki list check kar sakte hain (jaise "last 2 weeks orders", "sales on 2026-09-15", "orders between Sept 1 and Sept 15").'
            : 'Yes, absolutely! You can query store revenue analytics, total order counts, fulfillment breakdown, and search order records across any date range, specific date, or relative timeframe (e.g. "orders in last 2 weeks", "revenue between Sept 1 and Sept 15", "orders on 2026-09-15"). What date or period would you like to inspect?',
        action: { type: 'NONE' }
      };
    }

    const isSpecificStock = /\b(stock|inventory|kitna|kitne|units?|pieces?)\b/i.test(message) &&
      (/\b(suit|shirt|jacket|shoes?|glasses|bag|bracel?et|pant|toy|watch|counter|gripper|red|blue|black|white|yellow|green|s|m|l|xl|medium|small|large)\b/i.test(message) || Boolean(state.activeProductId));
    const isStoreInventory = /\b(low\s*stock|out\s*of\s*stock|inventory\s*report|stock\s*report|store\s*inventory)\b/i.test(message);
    const isTopSelling = /\b(top\s*sellers?|top\s*selling|best\s*selling|best\s*sellers?|highest\s*sales)\b/i.test(message);
    const isLowestSelling = /\b(lowest\s*sellers?|lowest\s*selling|least\s*sold|zero\s*sales)\b/i.test(message);

    // Q1 Option C: Smart hybrid — Counts/totals/stats/revenue vs list/search orders
    const isOrderCountOrStats = /\b(how\s+many\s+orders?|total\s+orders?|order\s+count|kitne\s+orders?|kitna\s+order|number\s+of\s+orders?|orders?\s+stats?|orders?\s+summary|orders?\s+breakdown)\b/i.test(message);
    const isRevenue = /\b(revenue|income|sales?|earnings?|sale\s*hui|kitni\s*sale|aov|average\s*order)\b/i.test(message) || isOrderCountOrStats;
    const isSearchOrders = /\b(find\s*orders?|search\s*orders?|show\s*orders?|list\s*orders?|get\s*orders?|view\s*orders?|orders?\s*list|today(?:'s)?\s*orders|pending\s*orders|shipped\s*orders|orders\s*status)\b/i.test(message) || (/\b\d{4,}\b/.test(message) && !isCartAdd);
    const isSearchCustomers = /\b(find\s*customer|search\s*customer|customer\s*spending|customer\s*orders|user\s*lookup)\b/i.test(message);
    const isNotifications = /\b(notifications?|alerts?|import\s*errors?|failed\s*jobs?)\b/i.test(message);

    if (isSpecificStock) {
      return {
        message: 'Checking product stock.',
        action: {
          type: 'ADMIN_CHECK_PRODUCT_STOCK',
          adminProductStockParams: { query: message }
        }
      };
    }
    if (isStoreInventory) {
      return {
        message: 'Generating store inventory health report.',
        action: {
          type: 'ADMIN_CHECK_INVENTORY',
          adminInventoryParams: { filter: /out\s*of\s*stock/i.test(message) ? 'out_of_stock' : /low\s*stock/i.test(message) ? 'low_stock' : 'all' }
        }
      };
    }
    if (isTopSelling) {
      return { message: 'Fetching top selling products.', action: { type: 'ADMIN_GET_TOP_SELLING' } };
    }
    if (isLowestSelling) {
      return { message: 'Fetching lowest selling products.', action: { type: 'ADMIN_GET_LOWEST_SELLING' } };
    }
    if (isRevenue) {
      return { message: 'Calculating revenue metrics.', action: { type: 'ADMIN_GET_REVENUE', adminRevenueParams: { period: message } } };
    }
    if (isSearchOrders) {
      const directNum = message.match(/\b\d{4,}\b/)?.[0];
      return { message: 'Searching store orders.', action: { type: 'ADMIN_SEARCH_ORDERS', adminSearchOrdersParams: { orderNumber: directNum, query: message } } };
    }
    if (isSearchCustomers) {
      return { message: 'Searching customers.', action: { type: 'ADMIN_SEARCH_CUSTOMERS', adminSearchCustomersParams: { query: message } } };
    }
    if (isNotifications) {
      return { message: 'Retrieving system notifications.', action: { type: 'ADMIN_GET_NOTIFICATIONS' } };
    }
    if (isGreetingOrFiller) {
      return {
        message: lang === 'URDU_SCRIPT'
          ? 'میں شاپ فاسٹ ایڈمن اسسٹنٹ ہوں۔ آپ اسٹور کا ریوینیو، مخصوص آئٹمز کا اسٹاک، ٹاپ سیلرز یا آرڈرز کی تفصیلات معلوم کر سکتے ہیں۔'
          : lang === 'ROMAN_URDU'
            ? 'Main ShopFast admin assistant hoon. Aap store revenue, specific product/variant stock, top sellers ya store orders check kar sakte hain.'
            : 'I\'m the ShopFast admin assistant. I can provide live store revenue, check variant stocks, analyze top/lowest sellers, look up store orders, or check customer spending.',
        action: { type: 'NONE' }
      };
    }

    return {
      message: 'Searching our catalog.',
      action: { type: 'SEARCH_CATALOG', searchParams: { query: message } }
    };
  }

  // Guest or Customer fallback
  const isAdminQuery = /\b(revenue|sales?|income|earnings?|aov|inventory\s*report|stock\s*report|store\s*orders|customer\s*spending)\b/i.test(message);

  if (isAdminQuery) {
    return {
      message: 'Store administrative tools, revenue figures, and store reports are restricted to authorized administrators.',
      action: { type: 'ADMIN_GET_REVENUE' }
    };
  }
  const isOptionQuery = /\b(colou?rs?|sizes?|options?|variants?|available|in\s*stock|konsa|konse|رنگ|سائز)\b/i.test(message);
  const isCandidateOrdinal = /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|doosra|dusra|teesra|pehla|دوسرا|پہلا|تیسرا)\b/i.test(message);
  const isVariantAnswer = /\b(black|white|red|blue|green|yellow|gray|grey|brown|beige|orange|pink|purple|small|medium|large|extra large|s|m|l|xl|xxl|3xl|kala|safed|lal|neela|sabz|peela|chota|bara)\b/i.test(message);

  if ((state.activeProductIds && state.activeProductIds.length > 1) && isCandidateOrdinal) {
    return {
      message: 'Selecting option.',
      action: {
        type: 'ADD_TO_CART',
        cartParams: { quantity: 1 }
      }
    };
  }

  if ((state.activeProductId || state.pendingAction?.productId) && (isOptionQuery || isVariantAnswer) && !/(?:order|orders|track)\b/i.test(message)) {
    return {
      message: 'Checking product options.',
      action: {
        type: 'ADD_TO_CART',
        cartParams: {
          productId: state.activeProductId || state.pendingAction?.productId,
          productQuery: state.pendingAction?.productQuery,
          quantity: 1
        }
      }
    };
  }
  if (isCartView) {
    return { message: 'Here is what is in your cart.', action: { type: 'VIEW_CART' } };
  }
  if (isCartAdd) {
    const rawQuery = message.replace(/\b(add|put|dalo|daal\s*do|cart\s*mein|cart|bag|basket|in|to|my|the|please|bhai)\b/gi, '').trim();
    return {
      message: 'Adding to your cart.',
      action: {
        type: 'ADD_TO_CART',
        cartParams: {
          productId: state.activeProductId,
          productQuery: rawQuery.length >= 2 ? rawQuery : undefined,
          quantity: 1
        }
      }
    };
  }
  if (isOrderQuery) {
    const isLatest = /\b(last|latest|recent|aakhri|آخری)\b/i.test(message);
    const directNum = message.match(/\b\d{4,}\b/)?.[0];
    return { message: 'Checking your order.', action: { type: 'GET_ORDER', orderParams: { orderNumber: directNum, latest: isLatest } } };
  }
  const isOffTopicQuery = /^(?:what\s+is\s+(?:the\s+)?capital|who\s+is\s+(?:the\s+)?(?:president|prime\s*minister|ceo)|tell\s+me\s+a\s+joke|write\s+(?:a\s+)?(?:poem|essay|code|story)|solve\s+\d+|calculate\s+\d+|weather\s+in|recipe\s+for)\b/i.test(message.trim());

  if (isOffTopicQuery) {
    return {
      message: lang === 'URDU_SCRIPT'
        ? 'میں خاص طور پر شاپ فاسٹ کی مصنوعات، آرڈرز اور اسٹور کی معلومات کے متعلق مدد کے لیے حاضر ہوں۔ میں آپ کی شاپنگ میں کس طرح مدد کر سکتا ہوں؟'
        : lang === 'ROMAN_URDU'
          ? 'Main sirf ShopFast products, orders aur store policies ke hawale se madad kar sakta hoon. Aapko shopping mein kis cheez ki zaroorat hai?'
          : 'I\'m here specifically to help you with ShopFast products, orders, and store questions. How can I assist with your shopping today?',
      action: { type: 'NONE' }
    };
  }
  const isCustomerCapabilityQuery = /^(?:can\s+you|could\s+you|are\s+you\s+able\s+to|what\s+can\s+you\s+do|how\s+can\s+you\s+help|what\s+are\s+your\s+capabilities|kya\s+aap|kya\s+tum|کیا\s+آپ)\b/i.test(message.trim()) &&
    !/\b(find|search|show|get|add|put|dalo|daal)\b/i.test(message.trim());

  if (isCustomerCapabilityQuery) {
    return {
      message: lang === 'URDU_SCRIPT'
        ? 'میں شاپ فاسٹ کسٹمر اسسٹنٹ ہوں۔ میں پروڈکٹس تلاش کرنے، قیمتیں معلوم کرنے یا آرڈر کی معلومات حاصل کرنے میں آپ کی مدد کر سکتا ہوں۔'
        : lang === 'ROMAN_URDU'
          ? 'Main ShopFast assistant hoon. Main products search karne, prices check karne ya store policies mein aapki madad kar sakta hoon. Aapko kya chahiye?'
          : 'I\'m the ShopFast customer assistant. I can help you search for products, find sizes/colors, view your cart, or track your orders. How can I assist you today?',
      action: { type: 'NONE' }
    };
  }
  if (isGreetingOrFiller) {
    return {
      message: lang === 'URDU_SCRIPT'
        ? 'میں شاپ فاسٹ کسٹمر اسسٹنٹ ہوں۔ میں پروڈکٹس تلاش کرنے، قیمتیں معلوم کرنے یا آرڈر کی معلومات حاصل کرنے میں آپ کی مدد کر سکتا ہوں۔'
        : lang === 'ROMAN_URDU'
          ? 'Main ShopFast assistant hoon. Main products search karne, prices check karne ya store policies mein aapki madad kar sakta hoon. Aapko kya chahiye?'
          : 'I\'m the ShopFast assistant. I can help you search for products, view your cart, or answer store questions. How can I help you today?',
      action: { type: 'NONE' }
    };
  }
  return {
    message: 'Searching our catalog.',
    action: { type: 'SEARCH_CATALOG', searchParams: { query: message } }
  };
}
