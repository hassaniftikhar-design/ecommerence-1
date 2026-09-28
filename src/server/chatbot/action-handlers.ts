import 'server-only';

import { getProductByIdServer } from '@/server/services/product.service';
import type { ChatOrderSummary } from '@/server/services/order.service';
import type { CartResponse } from '@/server/services/cart.service';

import type { ChatActor } from './tools';
import { executeChatbotTool } from './tools';
import { searchProductsHybridServer } from './product-retrieval';
import { getMyOrdersServer, searchMyOrdersServer } from './order-retrieval';
import type { LlmDecision, ValidatedChatResponse } from './response-validator';
import type { ConversationState, AuthoritativeStateEntities, ChatContextMessage } from './conversation-state';
import {
  resolveProductVariant,
  extractQuantityFromMessage
} from './variant-resolution';
import {
  formatRevenueAndOrderStats,
  formatOrderAnalytics,
  formatSalesRanking,
  formatInventoryAnalytics,
  formatProductStockCheck,
  formatAdminOrdersList,
  formatAdminCustomerList,
  formatAdminNotificationsList,
  type ChatLanguage
} from './formatters';

export type ProductCardItem = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  stock: number;
  category: string;
  reason: string;
  variants: Array<{ id: string; sku: string; stock: number; attributes: Record<string, string> }>;
};

export type ActionExecutionResult = {
  message: string;
  productCards: ProductCardItem[];
  actions: ValidatedChatResponse['actions'];
  nextState: ConversationState;
};

export async function executeCatalogSearchAction(args: {
  decision: LlmDecision;
  message: string;
  lang: ChatLanguage;
  state: ConversationState;
}): Promise<ActionExecutionResult> {
  const { decision, message, lang, state } = args;
  const nextState: ConversationState = { ...state };
  const searchTerms = decision.action.searchParams?.query || message;
  const retrieval = await searchProductsHybridServer(searchTerms);
  const topMatches = retrieval.products.slice(0, 4);

  if (topMatches.length === 0) {
    const finalMessage = lang === 'URDU_SCRIPT'
      ? `معذرت، مجھے "${searchTerms}" سے متعلق کوئی پروڈکٹ نہیں ملا۔ کیا آپ مزید تفصیل بتا سکتے ہیں کہ آپ کس قسم کی پروڈکٹ تلاش کر رہے ہیں؟`
      : lang === 'ROMAN_URDU'
        ? `Maazrat, mujhe "${searchTerms}" se related koi product nahi mila. Aap kis tarah ki product dhoond rahe hain? Mazeed detail bataiye.`
        : `I couldn't find any products matching "${searchTerms}" in our catalog. Could you please specify more details about the item you're looking for?`;

    return {
      message: finalMessage,
      productCards: [],
      actions: [],
      nextState
    };
  }

  const productCards: ProductCardItem[] = topMatches.map(({ product, similarity }) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    stock: product.totalStock ?? product.stock ?? 0,
    category: product.category.name,
    reason: similarity >= 0.85 ? 'Top match for your search' : 'Matches your request',
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      stock: v.stock,
      attributes: v.attributes || {}
    }))
  }));

  if (topMatches.length > 0 && topMatches[0]) {
    nextState.activeProductId = topMatches[0].product.id;
    nextState.activeProductIds = topMatches.map((m) => m.product.id);
  }

  return {
    message: decision.message,
    productCards,
    actions: [],
    nextState
  };
}

export async function executeAddToCartAction(args: {
  actor: ChatActor;
  decision: LlmDecision;
  message: string;
  context: ChatContextMessage[];
  entities: AuthoritativeStateEntities;
  state: ConversationState;
  lang: ChatLanguage;
}): Promise<ActionExecutionResult> {
  const { actor, decision, message, context, entities, state, lang } = args;
  const nextState: ConversationState = { ...state };
  let targetProductId = decision.action.cartParams?.productId;

  // 1. Resolve ordinal candidate references (e.g. "add the second one", "2nd one", "3rd option", "the Nike one")
  if (!targetProductId && entities.activeProductCandidates && entities.activeProductCandidates.length > 0) {
    const ordinalMatch = message.match(/\b(?:first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th|doosra|dusra|teesra|pehla|دوسرا|پہلا|تیسرا)\b/i);
    if (ordinalMatch) {
      const ord = ordinalMatch[0].toLowerCase();
      let idx = 0;
      if (/^(first|1st|pehla|پہلا)$/i.test(ord)) idx = 0;
      else if (/^(second|2nd|doosra|dusra|دوسرا)$/i.test(ord)) idx = 1;
      else if (/^(third|3rd|teesra|تیسرا)$/i.test(ord)) idx = 2;
      else if (/^(fourth|4th)$/i.test(ord)) idx = 3;
      else if (/^(fifth|5th)$/i.test(ord)) idx = 4;

      const candidate = entities.activeProductCandidates[idx];
      if (candidate) {
        targetProductId = candidate.id;
      }
    } else {
      const matchedCandidate = entities.activeProductCandidates.find((c) =>
        message.toLowerCase().includes(c.name.toLowerCase())
      );
      if (matchedCandidate) {
        targetProductId = matchedCandidate.id;
      }
    }
  }

  // 2. Fall back to active product in entities or state
  if (!targetProductId && entities.activeProduct) {
    targetProductId = entities.activeProduct.id;
  }
  if (!targetProductId && state.activeProductId) {
    targetProductId = state.activeProductId;
  }

  // 3. If still no active product in state, attempt hybrid search for requested item
  if (!targetProductId) {
    const rawQuery = decision.action.cartParams?.productQuery || message;
    const cleanQuery = rawQuery
      .replace(/\b(add|put|in|to|my|the|cart|bag|basket|please|can\s+you|mujhe|dalo|daal\s*do|mein|karo|batao)\b/gi, ' ')
      .replace(/[?!.,]/g, '')
      .trim();

    const searchQuery = cleanQuery.length >= 2 ? cleanQuery : rawQuery;
    const searchRes = await searchProductsHybridServer(searchQuery);

    if (searchRes.products.length === 0) {
      const finalMessage = lang === 'URDU_SCRIPT'
        ? `معذرت، مجھے کیٹلاگ میں "${searchQuery}" سے متعلق کوئی پروڈکٹ نہیں ملی۔ براہ کرم درست نام بتائیں۔`
        : lang === 'ROMAN_URDU'
          ? `Maazrat, catalog mein "${searchQuery}" se mutaliq koi product nahi mila. Barah-e-karam product ka naam bataiye.`
          : `Sorry, I couldn't find any products matching "${searchQuery}" in our catalog. Please specify the product name.`;

      nextState.pendingAction = undefined;
      return {
        message: finalMessage,
        productCards: [],
        actions: [],
        nextState
      };
    }

    if (searchRes.products.length > 1) {
      const candidates = searchRes.products.slice(0, 4).map((p) => p.product);
      nextState.activeProductIds = candidates.map((p) => p.id);
      nextState.activeProductId = candidates[0]?.id;
      nextState.pendingAction = {
        type: 'ADD_TO_CART',
        productQuery: searchQuery,
        missingOptions: ['product_selection']
      };

      const candidateList = candidates.map((c, i) => `${i + 1}. **${c.name}** ($${c.price.toFixed(2)})`).join('\n');
      const finalMessage = lang === 'URDU_SCRIPT'
        ? `مجھے کیٹلاگ میں "${searchQuery}" کے لیے ${candidates.length} پروڈکٹس ملیں:\n\n${candidateList}\n\nآپ کون سی پروڈکٹ پسند کریں گے؟`
        : lang === 'ROMAN_URDU'
          ? `Mujhe "${searchQuery}" ke liye ${candidates.length} products milay:\n\n${candidateList}\n\nAap konsa wala add karna chahte hain?`
          : `I found ${candidates.length} products matching "${searchQuery}":\n\n${candidateList}\n\nWhich one would you like?`;

      return {
        message: finalMessage,
        productCards: candidates.map((c) => ({
          id: c.id,
          name: c.name,
          price: c.price,
          imageUrl: c.imageUrl,
          stock: c.totalStock ?? c.stock ?? 0,
          category: c.category.name,
          reason: 'Matching option',
          variants: c.variants.map((v) => ({
            id: v.id,
            sku: v.sku,
            stock: v.stock,
            attributes: v.attributes || {}
          }))
        })),
        actions: [],
        nextState
      };
    }

    if (searchRes.products[0]?.product) {
      targetProductId = searchRes.products[0].product.id;
    }
  }

  if (!targetProductId) {
    const finalMessage = lang === 'URDU_SCRIPT'
      ? 'معذرت، کارٹ میں شامل کرنے کے لیے کوئی پروڈکٹ نہیں ملا۔ براہ کرم پروڈکٹ کا نام بتائیں۔'
      : lang === 'ROMAN_URDU'
        ? 'Maazrat, cart mein add karne ke liye product nahi mila. Barah-e-karam product ka naam bataiye.'
        : 'Sorry, I could not find that product in our catalog to add to your cart. Please specify the product name.';

    return {
      message: finalMessage,
      productCards: [],
      actions: [],
      nextState
    };
  }

  const product = await getProductByIdServer(targetProductId, false);

  if (!product || !product.isActive) {
    const finalMessage = lang === 'URDU_SCRIPT'
      ? 'معذرت، یہ پروڈکٹ فی الحال دستیاب نہیں ہے۔'
      : lang === 'ROMAN_URDU'
        ? 'Maazrat, yeh product is waqt available nahi hai.'
        : 'Sorry, this product is currently unavailable.';

    return {
      message: finalMessage,
      productCards: [],
      actions: [],
      nextState
    };
  }

  const resolution = resolveProductVariant(product, message, decision.action.cartParams, context);

  if (resolution.status === 'MISSING_OPTIONS' || resolution.status === 'AMBIGUOUS') {
    const colors = [...new Set(
      product.variants.flatMap((v) => {
        const c = v.attributes?.color || v.attributes?.Color || v.attributes?.colour || v.attributes?.Colour;
        return c ? [c] : [];
      })
    )];
    const sizes = [...new Set(
      product.variants.flatMap((v) => {
        const s = v.attributes?.size || v.attributes?.Size;
        return s ? [s] : [];
      })
    )];

    const optionsText = resolution.availableOptionsSummary
      .map((opt) => `${opt.name} (${opt.values.join(', ')})`)
      .join(' | ');

    let finalMessage = '';
    const missingOptionNames = resolution.status === 'MISSING_OPTIONS'
      ? resolution.missingOptionNames
      : resolution.availableOptionsSummary.map((o) => o.name.toLowerCase());
    const isColorMissing = missingOptionNames.some((o: string) => /colou?r/i.test(o));
    const isSizeMissing = missingOptionNames.some((o: string) => /size/i.test(o));

    if (colors.length > 0 && sizes.length > 0) {
      if (isColorMissing && isSizeMissing) {
        finalMessage = lang === 'URDU_SCRIPT'
          ? `میں نے **${product.name}** تلاش کر لی ہے۔ یہ **${colors.join('، ')}** رنگوں اور **${sizes.join('، ')}** سائزز میں دستیاب ہے۔ آپ کون سا رنگ اور سائز پسند کریں گے؟`
          : lang === 'ROMAN_URDU'
            ? `Maine **${product.name}** dhoond liya hai. Yeh **${colors.join(', ')}** colors aur **${sizes.join(', ')}** sizes mein available hai. Aapko konsa color aur size chahiye?`
            : `I found **${product.name}**. It comes in **${colors.join(', ')}** (sizes: **${sizes.join(', ')}**). Which color and size would you like?`;
      } else if (isColorMissing) {
        finalMessage = lang === 'URDU_SCRIPT'
          ? `**${product.name}** **${colors.join('، ')}** رنگوں میں دستیاب ہے۔ آپ کون سا رنگ پسند کریں گے؟`
          : lang === 'ROMAN_URDU'
            ? `**${product.name}** **${colors.join(', ')}** colors mein available hai. Aapko konsa color chahiye?`
            : `I found **${product.name}**. It comes in **${colors.join(', ')}**. Which color would you like?`;
      } else if (isSizeMissing) {
        finalMessage = lang === 'URDU_SCRIPT'
          ? `**${product.name}** سائز **${sizes.join('، ')}** میں دستیاب ہے۔ آپ کون سا سائز پسند کریں گے؟`
          : lang === 'ROMAN_URDU'
            ? `**${product.name}** sizes **${sizes.join(', ')}** mein available hai. Aapko konsa size chahiye?`
            : `**${product.name}** is available in sizes **${sizes.join(', ')}**. Which size would you like?`;
      }
    }

    if (!finalMessage) {
      const missingNames = missingOptionNames.join(' and ');

      finalMessage = lang === 'URDU_SCRIPT'
        ? `براہ کرم **${product.name}** کے لیے ${missingNames ? missingNames : 'سائز اور رنگ'} بتائیں۔ دستیاب آپشنز: ${optionsText}۔ آپ کون سا پسند کریں گے؟`
        : lang === 'ROMAN_URDU'
          ? `Please **${product.name}** ke liye ${missingNames ? missingNames : 'color aur size'} bataiye. Available options: ${optionsText}. Aapko konsa chahiye?`
          : `I found **${product.name}**. Available options: ${optionsText}. Which ${missingNames ? missingNames : 'one'} would you like?`;
    }

    nextState.activeProductId = product.id;
    nextState.activeProductIds = [product.id];
    nextState.pendingAction = {
      type: 'ADD_TO_CART',
      productId: product.id,
      productQuery: decision.action.cartParams?.productQuery || product.name,
      missingOptions: missingOptionNames as ('color' | 'size')[]
    };

    return {
      message: finalMessage,
      productCards: [{
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        stock: product.totalStock ?? product.stock ?? 0,
        category: product.category.name,
        reason: 'Requires variant selection',
        variants: product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          stock: v.stock,
          attributes: v.attributes || {}
        }))
      }],
      actions: [],
      nextState
    };
  }

  if (resolution.status === 'NOT_FOUND') {
    const optionsText = resolution.availableOptionsSummary
      .map((opt) => `${opt.name} (${opt.values.join(', ')})`)
      .join(' | ');

    const finalMessage = lang === 'URDU_SCRIPT'
      ? `معذرت، مطلوبہ ویرینٹ **${product.name}** میں دستیاب نہیں ہے۔ دستیاب آپشنز: ${optionsText}۔ آپ کون سا پسند کریں گے؟`
      : lang === 'ROMAN_URDU'
        ? `Maazrat, yeh variant **${product.name}** mein available nahi hai. Available options: ${optionsText}. Aapko konsa chahiye?`
        : `Sorry, that specific variant is not available for **${product.name}**. Available options are: ${optionsText}. Which one would you prefer?`;

    nextState.activeProductId = product.id;
    nextState.activeProductIds = [product.id];
    nextState.pendingAction = {
      type: 'ADD_TO_CART',
      productId: product.id,
      missingOptions: resolution.availableOptionsSummary.map((o) => o.name.toLowerCase()) as ('color' | 'size')[]
    };

    return {
      message: finalMessage,
      productCards: [{
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        stock: product.totalStock ?? product.stock ?? 0,
        category: product.category.name,
        reason: 'Catalog options',
        variants: product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          stock: v.stock,
          attributes: v.attributes || {}
        }))
      }],
      actions: [],
      nextState
    };
  }

  // EXACT variant matched -> proceed with server-authoritative tool execution
  const targetVariant = resolution.variant;
  const requestedQuantity = decision.action.cartParams?.quantity || extractQuantityFromMessage(message);

  if (targetVariant.stock >= requestedQuantity) {
    await executeChatbotTool(
      actor,
      'addToCart',
      {
        productId: product.id,
        variantId: targetVariant.id,
        quantity: requestedQuantity
      },
      { userConfirmed: true }
    );

    const specEntries = Object.entries(targetVariant.attributes || {});
    const specDesc = specEntries.length > 0
      ? ` (${specEntries.map(([k, v]) => `${k}: ${v}`).join(', ')})`
      : '';

    const finalMessage = lang === 'URDU_SCRIPT'
      ? `✅ **${product.name}${specDesc}** (تعداد: ${requestedQuantity}) کو آپ کے کارٹ میں شامل کر دیا گیا ہے۔`
      : lang === 'ROMAN_URDU'
        ? `✅ **${product.name}${specDesc}** (Qty: ${requestedQuantity}) aapke cart mein add kar diya gaya hai.`
        : `✅ Added **${product.name}${specDesc}** (Quantity: ${requestedQuantity}) to your shopping cart.`;

    nextState.activeProductId = product.id;
    nextState.activeVariantId = targetVariant.id;
    nextState.pendingAction = undefined; // Action completed

    return {
      message: finalMessage,
      productCards: [{
        id: product.id,
        name: product.name,
        price: product.price,
        imageUrl: product.imageUrl,
        stock: product.totalStock ?? product.stock ?? 0,
        category: product.category.name,
        reason: 'Added to your cart',
        variants: product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          stock: v.stock,
          attributes: v.attributes || {}
        }))
      }],
      actions: [{
        type: 'ADD_TO_CART',
        productId: product.id,
        variantId: targetVariant.id,
        quantity: requestedQuantity
      }],
      nextState
    };
  }

  const finalMessage = lang === 'URDU_SCRIPT'
    ? `معذرت، ${product.name} اس وقت آؤٹ آف اسٹاک ہے یا کارٹ میں شامل نہیں ہو سکا۔`
    : lang === 'ROMAN_URDU'
      ? `Maazrat, ${product.name} is waqt out of stock hai ya cart mein add nahi ho saka.`
      : `Sorry, ${product.name} is currently out of stock or could not be added to your cart.`;

  return {
    message: finalMessage,
    productCards: [],
    actions: [],
    nextState
  };
}

export async function executeGetOrderAction(args: {
  actor: ChatActor;
  decision: LlmDecision;
  lang: ChatLanguage;
  state: ConversationState;
}): Promise<ActionExecutionResult> {
  const { actor, decision, lang, state } = args;
  const nextState: ConversationState = { ...state };
  const orderParams = decision.action.orderParams;
  let orders: ChatOrderSummary[] = [];

  if (orderParams?.orderNumber) {
    orders = await searchMyOrdersServer(actor.userId, orderParams.orderNumber);
  } else if (orderParams?.latest) {
    orders = await getMyOrdersServer(actor.userId, 1);
  } else {
    orders = await getMyOrdersServer(actor.userId, 5);
  }

  if (orders.length === 0) {
    const finalMessage = lang === 'URDU_SCRIPT'
      ? 'آپ کے اکاؤنٹ میں فی الحال کوئی آرڈر موجود نہیں ہے۔'
      : lang === 'ROMAN_URDU'
        ? 'Aapke account mein filhal koi matching order nahi mila.'
        : 'I could not find any matching orders under your signed-in account.';

    return {
      message: finalMessage,
      productCards: [],
      actions: [],
      nextState
    };
  }

  nextState.activeOrderId = orders[0]?.id;
  const formatItem = (it: { title: string; quantity: number; price?: number; attributes?: Record<string, string> | null }) => {
    const attrStr = it.attributes && Object.keys(it.attributes).length > 0
      ? ` (${Object.entries(it.attributes).map(([k, v]) => `${k}: ${v}`).join(', ')})`
      : '';
    return `${it.title}${attrStr} (x${it.quantity})`;
  };

  let finalMessage: string;
  if (orderParams?.latest && orders[0]) {
    const ord = orders[0];
    const itemsStr = ord.items.map(formatItem).join(', ');
    finalMessage = lang === 'URDU_SCRIPT'
      ? `آپ کا تازہ ترین آرڈر #${ord.orderNumber} اس وقت **${ord.status}** ہے۔\n• تاریخ: ${new Date(ord.createdAt).toLocaleDateString()}\n• پروڈکٹس: ${itemsStr}\n• کل رقم: $${ord.totalAmount.toFixed(2)}`
      : lang === 'ROMAN_URDU'
        ? `Aapka latest order #${ord.orderNumber} is waqt **${ord.status}** hai.\n• Items: ${itemsStr}\n• Total: $${ord.totalAmount.toFixed(2)}`
        : `Your latest order #${ord.orderNumber} is currently **${ord.status}**.\n• Placed: ${new Date(ord.createdAt).toLocaleDateString()}\n• Items: ${itemsStr}\n• Total: $${ord.totalAmount.toFixed(2)}`;
  } else {
    const orderLines = orders.map((o) => `• Order #${o.orderNumber} (${o.status}) - Total: $${o.totalAmount.toFixed(2)} | Items: ${o.items.map(formatItem).join(', ')}`).join('\n\n');
    finalMessage = lang === 'URDU_SCRIPT'
      ? `آپ کے اکاؤنٹ کے آرڈرز کی تفصیلات:\n\n${orderLines}`
      : lang === 'ROMAN_URDU'
        ? `Aapke account ke orders yeh hain:\n\n${orderLines}`
        : `Here are the orders from your account:\n\n${orderLines}`;
  }

  return {
    message: finalMessage,
    productCards: [],
    actions: [],
    nextState
  };
}

export async function executeViewCartAction(args: {
  actor: ChatActor;
  lang: ChatLanguage;
  state: ConversationState;
}): Promise<ActionExecutionResult> {
  const { actor, lang, state } = args;
  const nextState: ConversationState = { ...state };
  const cart = (await executeChatbotTool(actor, 'getMyCart')) as CartResponse;

  if (!cart || !cart.items || cart.items.length === 0) {
    const finalMessage = lang === 'URDU_SCRIPT'
      ? 'آپ کا کارٹ اس وقت خالی ہے۔ آپ پروڈکٹس براؤز کر سکتے ہیں یا مجھ سے کوئی بھی پروڈکٹ کارٹ میں شامل کرنے کو کہہ سکتے ہیں!'
      : lang === 'ROMAN_URDU'
        ? 'Aapka cart filhal khali hai. Aap shop se products dhoond sakte hain ya mujhse cart mein add karne ko keh sakte hain!'
        : 'Your cart is currently empty. Feel free to search for products or ask me to add items to your cart!';

    return {
      message: finalMessage,
      productCards: [],
      actions: [],
      nextState
    };
  }

  const itemLines = cart.items.map((it) => {
    const variantInfo = [
      it.color?.name ? `Color: ${it.color.name}` : null,
      it.size && it.size !== '-' ? `Size: ${it.size}` : null
    ].filter(Boolean).join(', ');
    const specText = variantInfo ? ` (${variantInfo})` : '';
    return `• ${it.name}${specText} — ${it.quantity}x ($${it.price.toFixed(2)} each = $${it.totalPrice.toFixed(2)})`;
  }).join('\n');

  const finalMessage = lang === 'URDU_SCRIPT'
    ? `آپ کے کارٹ میں موجود آئٹمز:\n${itemLines}\n\n**سب ٹوٹل**: $${cart.totals.subTotal.toFixed(2)} | **ٹیکس**: $${cart.totals.tax.toFixed(2)} | **کل رقم**: $${cart.totals.total.toFixed(2)}`
    : lang === 'ROMAN_URDU'
      ? `Aapke cart mein yeh items hain:\n${itemLines}\n\n**Subtotal**: $${cart.totals.subTotal.toFixed(2)} | **Tax**: $${cart.totals.tax.toFixed(2)} | **Total**: $${cart.totals.total.toFixed(2)}`
      : `Here is what is currently in your cart:\n${itemLines}\n\n**Subtotal**: $${cart.totals.subTotal.toFixed(2)} | **Tax**: $${cart.totals.tax.toFixed(2)} | **Total**: $${cart.totals.total.toFixed(2)}`;

  const cartProductDetails = await Promise.all(
    cart.items.map((it) => getProductByIdServer(it.productId, false))
  );
  const productCards: ProductCardItem[] = cartProductDetails
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      stock: product.totalStock ?? product.stock ?? 0,
      category: product.category.name,
      reason: 'In your cart',
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        stock: v.stock,
        attributes: v.attributes || {}
      }))
    }));

  return {
    message: finalMessage,
    productCards,
    actions: [],
    nextState
  };
}

export async function executeAdminAction(args: {
  actor: ChatActor;
  actionType: string;
  decision: LlmDecision;
  message: string;
  lang: ChatLanguage;
  state: ConversationState;
}): Promise<ActionExecutionResult> {
  const { actor, actionType, decision, message, lang, state } = args;
  const nextState: ConversationState = { ...state };
  let finalMessage = decision.message;
  let productCards: ProductCardItem[] = [];

  if (actionType === 'ADMIN_CHECK_PRODUCT_STOCK') {
    const stockParams = decision.action.adminProductStockParams;
    const query = stockParams?.query || message;
    const stockResult = (await executeChatbotTool(actor, 'checkProductStock', {
      query,
      color: stockParams?.color,
      size: stockParams?.size,
      sku: stockParams?.sku
    })) as Parameters<typeof formatProductStockCheck>[0];

    finalMessage = formatProductStockCheck(stockResult, lang);

    if (stockResult?.found && stockResult.product) {
      const prod = stockResult.product;
      nextState.activeProductId = prod.id;
      nextState.activeProductIds = [prod.id];
      productCards = [{
        id: prod.id,
        name: prod.name,
        price: prod.price,
        imageUrl: prod.imageUrl || '',
        stock: prod.totalStock,
        category: prod.category,
        reason: 'Stock Lookup',
        variants: prod.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          stock: v.stock,
          attributes: v.attributes
        }))
      }];
    }
  } else if (actionType === 'ADMIN_GET_REVENUE') {
    const revParams = decision.action.adminRevenueParams;
    const stats = (await executeChatbotTool(actor, 'getRevenue', {
      period: revParams?.period,
      from: revParams?.from,
      to: revParams?.to,
      days: revParams?.days,
      date: revParams?.date,
      query: revParams?.query || message
    })) as Parameters<typeof formatRevenueAndOrderStats>[0];
    finalMessage = formatRevenueAndOrderStats(stats, lang);
  } else if (actionType === 'ADMIN_GET_ORDER_ANALYTICS') {
    const revParams = decision.action.adminRevenueParams;
    const stats = (await executeChatbotTool(actor, 'getOrderAnalytics', {
      period: revParams?.period,
      from: revParams?.from,
      to: revParams?.to,
      days: revParams?.days,
      date: revParams?.date,
      query: revParams?.query || message
    })) as Parameters<typeof formatOrderAnalytics>[0];
    finalMessage = formatOrderAnalytics(stats, lang);
  } else if (actionType === 'ADMIN_GET_TOP_SELLING') {
    const topItems = (await executeChatbotTool(actor, 'getTopSellingProducts', { limit: 5 })) as Parameters<typeof formatSalesRanking>[0];
    finalMessage = formatSalesRanking(topItems, 'top', lang);
  } else if (actionType === 'ADMIN_GET_LOWEST_SELLING') {
    const lowestItems = (await executeChatbotTool(actor, 'getLowestSellingProducts', { limit: 5 })) as Parameters<typeof formatSalesRanking>[0];
    finalMessage = formatSalesRanking(lowestItems, 'lowest', lang);
  } else if (actionType === 'ADMIN_CHECK_INVENTORY') {
    const invParams = decision.action.adminInventoryParams;
    const invItems = (await executeChatbotTool(actor, 'getInventoryAnalytics', {
      filter: invParams?.filter || 'all'
    })) as Parameters<typeof formatInventoryAnalytics>[0];
    finalMessage = formatInventoryAnalytics(invItems, lang);
  } else if (actionType === 'ADMIN_SEARCH_ORDERS') {
    const searchParams = decision.action.adminSearchOrdersParams || {};
    const orders = (await executeChatbotTool(actor, 'searchAdminOrders', searchParams)) as Parameters<typeof formatAdminOrdersList>[0];
    finalMessage = formatAdminOrdersList(orders, lang);
  } else if (actionType === 'ADMIN_SEARCH_CUSTOMERS') {
    const custParams = decision.action.adminSearchCustomersParams;
    const customers = (await executeChatbotTool(actor, 'searchCustomers', {
      query: custParams?.query || message,
      limit: custParams?.limit || 5
    })) as Parameters<typeof formatAdminCustomerList>[0];
    finalMessage = formatAdminCustomerList(customers, lang);
  } else if (actionType === 'ADMIN_GET_NOTIFICATIONS') {
    const notifications = (await executeChatbotTool(actor, 'getAdminNotifications', { limit: 5 })) as Parameters<typeof formatAdminNotificationsList>[0];
    finalMessage = formatAdminNotificationsList(notifications, lang);
  } else if (actionType === 'ADMIN_METRICS') {
    const metric = decision.action.adminParams?.metric || 'REVENUE';
    const toolName = metric === 'REVENUE'
      ? 'getRevenue'
      : metric === 'TOP_SELLING'
        ? 'getTopSellingProducts'
        : metric === 'LOWEST_SELLING'
          ? 'getLowestSellingProducts'
          : metric === 'INVENTORY'
            ? 'getInventoryAnalytics'
            : 'getOrderAnalytics';
    const stats = await executeChatbotTool(actor, toolName);

    if (metric === 'REVENUE' || metric === 'ORDERS') {
      finalMessage = formatRevenueAndOrderStats(stats as Parameters<typeof formatRevenueAndOrderStats>[0], lang);
    } else if (metric === 'TOP_SELLING' || metric === 'LOWEST_SELLING') {
      finalMessage = formatSalesRanking(
        stats as Parameters<typeof formatSalesRanking>[0],
        metric === 'TOP_SELLING' ? 'top' : 'lowest',
        lang
      );
    } else if (metric === 'INVENTORY') {
      finalMessage = formatInventoryAnalytics(stats as Parameters<typeof formatInventoryAnalytics>[0], lang);
    }
  }

  return {
    message: finalMessage,
    productCards,
    actions: [],
    nextState
  };
}
