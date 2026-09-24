import type { ChatActor } from './tools';

export type ChatIntent =
  | 'PRODUCT_SEARCH' | 'PRODUCT_DETAILS' | 'PRODUCT_AVAILABILITY' | 'PRODUCT_RECOMMENDATION'
  | 'ORDER_SEARCH' | 'ORDER_STATUS' | 'ORDER_HISTORY' | 'CART_VIEW' | 'CART_ADD'
  | 'STORE_POLICY' | 'SHIPPING' | 'RETURNS' | 'ADMIN_REVENUE' | 'ADMIN_SALES'
  | 'ADMIN_INVENTORY' | 'ADMIN_ORDER_ANALYTICS' | 'GREETING' | 'CLOSING' | 'CHITCHAT' | 'OUT_OF_SCOPE' | 'SECURITY_INJECTION';

const adminPatterns: Array<[ChatIntent, RegExp]> = [
  ['ADMIN_REVENUE', /\b(revenue|income|earnings|sales total|how much did we make|total revenue)\b/i],
  ['ADMIN_SALES', /\b(top|best|lowest)\s+selling products?\b|\bsales analytics\b|\bsales report\b/i],
  ['ADMIN_INVENTORY', /\b(inventory report|stock report|low-stock report|low stock analytics|all inventory)\b/i],
  ['ADMIN_ORDER_ANALYTICS', /\b(order analytics|orders by status|order counts|how many orders|number of orders)\b/i]
];

const customerPatterns: Array<[ChatIntent, RegExp]> = [
  // Greetings / Introduction (English, Urdu script, and Roman Urdu)
  ['GREETING', /^(hi|hello|hey|greetings|good\s*(morning|afternoon|evening)|assalam\s*o?\s*alaikum|assalamu\s*alaikum|asalamualaykum|salam|aoa|adaab|sup|yo|سلام|السلام\s*علیکم|آداب)\b|\b(keso\s*ho|kese\s*ho|kaise\s*ho|kaisa\s*hai|kese\s*hain|kaise\s*hain|kya\s*haal|kya\s*hal|kia\s*hal|kya\s*chal\s*raha|kia\s*chal\s*raha|bhai\s*(keso|kese|kaise|kaisa)\s*ho?|کیسے\s*ہو|کیسے\s*ہیں|کیا\s*حال\s*ہے|کیا\s*چل\s*رہا\s*ہے)\b/i],

  // Conversational acknowledgments & closings (English, Urdu script, and Roman Urdu)
  ['CLOSING', /^(thanks|thank\s*you|thx|tysm|okay|ok|great|awesome|perfect|got\s*it|sure|alright|cool|bye|goodbye|see\s*you|cya|take\s*care)\b|\b(shukriya|bohat\s*shukriya|mehrbani|theek\s*hai|thik\s*hai|theek\s*ho\s*gya|samajh\s*a\s*gayi|samjh\s*agayi|chalo\s*bye|allah\s*hafiz|khuda\s*hafiz|شکریہ|بہت\s*شکریہ|مہربانی|ٹھیک\s*ہے|اللہ\s*حافظ|خدا\s*حافظ)\b/i],

  // General chitchat, small talk, emotions, questions about the bot (English, Urdu script, and Roman Urdu)
  ['CHITCHAT', /\b(feeling|sad|happy|bored|tired|depressed|angry|excited|how\s*are\s*you|who\s*are\s*you|what\s*is\s*your\s*name|who\s*made\s*you|tell\s*me\s*a\s*joke|are\s*you\s*(real|human|ai|bot)|joke|weather|doing\s*today|can\s*we\s*talk|nice\s*to\s*meet\s*you|what\s*can\s*you\s*do|what\s*do\s*you\s*think)\b|\b(aap\s*kon\s*ho|ap\s*kon\s*ho|tum\s*kon\s*ho|aap\s*kon\s*hain|ap\s*kon\s*hein|aap\s*ka\s*naam|ap\s*ka\s*name|tumhara\s*naam|kya\s*kar\s*sakte\s*ho|kia\s*kr\s*skte\s*ho|hal\s*sunao|bhai\s*keso\s*ho|bhai\s*kese\s*ho|kese\s*ho\s*bhai|kaise\s*ho\s*bhai|bhai\s*jan|آپ\s*کون\s*ہیں|تم\s*کون\s*ہو|آپ\s*کا\s*نام|کیا\s*کر\s*سکتے\s*ہیں|حال\s*سنائیں)\b/i],

  // Cart operations
  ['CART_ADD', /\b(add|put)\b.{0,35}\b(cart|bag)\b|\b(cart|bag)\b.{0,35}\b(add|put)\b|\b(cart\s*m(ei)?n\s*(dalo|daal\s*do|add\s*karo)|cart\s*mein\s*add|کارٹ\s*میں\s*ڈالو)\b/i],
  ['CART_VIEW', /\b(show|view|what is in|see|open|check)\b.{0,25}\b(my )?(cart|bag)\b|^cart$|^view cart$|\b(mera\s*cart|cart\s*dikhao|cart\s*check\s*karo|کارٹ\s*دکھاؤ)\b/i],

  // Order queries (Strictly require order context to prevent matching 'track suit')
  ['ORDER_HISTORY', /\b(my orders|previous orders|order history|past purchases|all my orders|what did i buy)\b|\b(mere\s*orders|purane\s*orders|pehle\s*kya\s*kharida|meray\s*orders|میرے\s*آرڈرز)\b/i],
  ['ORDER_STATUS', /\b(where is (my )?(last |latest |recent )?order|track (my )?(last |latest |recent )?(order|package|delivery|shipment)|(last |latest |recent |previous )orders?( status)?|order status|delivery (update|status)|what about (my )?(last |latest |recent )?order|status of (my )?(last |latest |recent )?order)\b|\b(order|tracking)\s*#?\s*\d{4,}|\bstatus of order\b|\b(mera\s*order\s*kahan\s*hai|order\s*track\s*karo|order\s*status\s*batao|order\s*kab\s*aaye\s*ga|order\s*kab\s*tak\s*pohnchay\s*ga|آرڈر\s*کہاں\s*ہے|آرڈر\s*ٹریک\s*کرو|آرڈر\s*کی\s*معلومات)\b/i],
  ['ORDER_SEARCH', /\border\s*#?\s*\d{4,}\b/i],

  // Policies / Support
  ['SHIPPING', /\b(shipping (time|cost|policy|fee)|delivery (time|charges|fee)|how long does (shipping|delivery) take|when will it arrive)\b|\b(delivery\s*charges|delivery\s*time|kab\s*tak\s*deliver\s*hoga|shipping\s*charges\s*kitne\s*hain|ڈیلیوری\s*چارجز)\b/i],
  ['RETURNS', /\b(return policy|how (can|do) i return|refund policy|exchange policy|money back)\b|\b(return\s*kaise\s*karein|wapis\s*kaise\s*hoga|refund\s*milay\s*ga|exchange\s*policy|واپسی\s*کی\s*پالیسی|ریفنڈ)\b/i],
  ['STORE_POLICY', /\b(store policy|payment methods|cash on delivery|cod available|store hours|contact support|customer care)\b|\b(cash\s*on\s*delivery\s*hai|cod\s*hai|payment\s*kaise\s*karein|کیش\s*آن\s*ڈیلیوری)\b/i],

  // Product Specific Details & Availability
  ['PRODUCT_AVAILABILITY', /\b(in stock|out of stock|available|availability|how many left|is .* in stock|are .* available)\b|\b(stock\s*mein\s*hai|available\s*hai|kitne\s*bache\s*hain|دستیاب\s*ہے)\b/i],
  ['PRODUCT_DETAILS', /\b(details of|specs of|specifications|price of|how much is|cost of|what size|what colou?rs?|product code|sku)\b|\b(detail\s*batao|specs\s*batao|price\s*kya\s*hai|kitne\s*ka\s*hai|قیمت\s*کیا\s*ہے)\b/i],
  ['PRODUCT_RECOMMENDATION', /\b(recommend|suggest|best|top rated|looking for|want something|need something|something (?:comfortable|warm|lightweight)|gift idea)\b|\b(mujhe|chahiye|chahye|dikhao|batao|kuch acha|kuch naya|koi achi cheez|koi acha|کچھ\s*اچھا|دکھائیں|بتائیں|تجویز\s*کریں)\b/i],

  // Explicit Product Search & Catalog inquiry
  ['PRODUCT_SEARCH', /\b(do you have|do you sell|any|show me|find|search|browse|give me|is there|are there|i want|i need|buy|get|looking for|products?|items?|catalog|shop|clothes|clothing|shoes?|slippers?|sneakers?|footwear|bracel[a-z]*|bracl[a-z]*|glasses|sunglasses|trimmers?|watch(es)?|grippers?|track\s*suits?|hoodies?|shirts?|t-?shirts?|pants?|jackets?|caps?|hats?|bags?|bottles?|spinners?|rings?|earrings?|electronics?|accessories|under\s+\$?\d+|below\s+\$?\d+|between\s+\$?\d+|cheap(er)?|expensive)\b|\b(joote|jootay|chappal|kapre|kapray|t-shirt|shirt|hoodie|pant|khareedna|kharidna|kharidne|lena|lene|جوتے|کپڑے|خریدنا)\b/i]
];

export function detectChatIntent(message: string, actor: ChatActor, context?: Array<{ role: 'USER' | 'ASSISTANT'; content: string }>): ChatIntent {
  const trimmed = message.trim();
  if (!trimmed) return 'OUT_OF_SCOPE';

  // Check admin patterns if user is admin
  if (actor.role === 'ADMIN') {
    const adminMatch = adminPatterns.find(([, pattern]) => pattern.test(trimmed));
    if (adminMatch) return adminMatch[0];
  } else {
    const adminMatch = adminPatterns.find(([, pattern]) => pattern.test(trimmed));
    if (adminMatch) {
      if (adminMatch[0] === "ADMIN_SALES") return "PRODUCT_RECOMMENDATION";
      if (adminMatch[0] === "ADMIN_ORDER_ANALYTICS") return "ORDER_HISTORY";
      return "OUT_OF_SCOPE";
    }
  }

  // Check if previous context was about an order, and the current message is an order follow-up
  if (context && context.length > 0) {
    const lastContext = context.slice(-4);
    const hasOrderInContext = lastContext.some((c) =>
      /\b(order\s*#?\s*\d{4,}|\border\b|ordered|status|dispatched|delivered|tracking)\b/i.test(c.content)
    );
    const isOrderFollowUp = /\b(spec|specs|specification|specifications|items?|details?|size|color|colour|sku|when|arrive|delivery|status|cancel|refund|price|cost|track|in\s+(this|the|that|my)\s+order|of\s+(this|the|that|my)\s+order|these\s+items?|those\s+items?|what\s+about\s+(it|them|these))\b/i.test(trimmed);
    const isExplicitNewSearch = /\b(search|browse|recommend|buy\s+new|shop\s+for|other\s+products|show\s+me\s+other|new\s+products|catalog)\b/i.test(trimmed);

    if (hasOrderInContext && isOrderFollowUp && !isExplicitNewSearch) {
      return 'ORDER_STATUS';
    }
  }

  // Check customer intent patterns
  const customerMatch = customerPatterns.find(([, pattern]) => pattern.test(trimmed));
  if (customerMatch) return customerMatch[0];

  // If a short 1-4 word query (like "braclet", "blue hoodie M", "running shoes") without general question starters or conversational words
  const conversationalStarters = /^(why|how|who|where|what|when|can|could|would|is|are|am|i|bhai|kia|kya|kaise|kese|keso|kaisa|kon|kahan|kyun|kis|kab|hum|main|mera|meri|meray|ap|aap|tum|yeh|woh|ye|han|haan|nahi|nahin|suno|sunao|acha|achha|theek|thik|ok|okay)\b/i;
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 4 && !conversationalStarters.test(trimmed) && !/^[\u0600-\u06FF\s]+$/.test(trimmed)) {
    return 'PRODUCT_SEARCH';
  }

  return 'CHITCHAT';
}
