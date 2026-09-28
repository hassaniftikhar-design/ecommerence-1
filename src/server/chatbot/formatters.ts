import 'server-only';

export type ChatLanguage = 'URDU_SCRIPT' | 'ROMAN_URDU' | 'ENGLISH';

export function detectUserLanguage(text: string): ChatLanguage {
  if (/[\u0600-\u06FF]/.test(text)) return 'URDU_SCRIPT';
  if (/\b(bhai|mujhe|mughe|mujy|mujay|kya|kia|kaise|kese|keso|kaisa|hain|hai|he|hoon|hun|theek|thik|acha|achha|achi|ache|achhe|dikhao|dikhayein|batao|batayein|chahiye|chahye|karo|shukriya|mere|mera|meri|meray|ap|aap|tum|kuch|wali|wala|walay|wale|topi|joote|jootay|chappal|kapre|kapray|ghari|botal|khareedna|lena)\b/i.test(text)) {
    return 'ROMAN_URDU';
  }
  return 'ENGLISH';
}

export function formatRevenueAndOrderStats(
  stats: {
    period?: string;
    totalOrders: number;
    totalProducts: number;
    totalRevenue: number;
    validOrdersCount: number;
    activeProducts: number;
    averageOrderValue?: number;
    ordersByStatus: {
      IN_PROGRESS: number;
      DISPATCHED: number;
      DELIVERED: number;
      REJECTED: number;
    };
    message?: string;
  },
  lang: ChatLanguage
): string {
  if (stats.message) {
    return `ℹ️ ${stats.message}`;
  }

  const formattedRevenue = stats.totalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const aovFormatted = typeof stats.averageOrderValue === 'number'
    ? stats.averageOrderValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : null;
  const fulfillmentRate = stats.validOrdersCount > 0
    ? Math.round((stats.ordersByStatus.DELIVERED / stats.validOrdersCount) * 100)
    : 0;
  const periodLabel = stats.period || 'All Time';

  if (lang === 'URDU_SCRIPT') {
    return [
      `📊 **اسٹور ریوینیو اور آرڈرز کی سمری (${periodLabel}):**`,
      '',
      `• **کل ریوینیو (Gross Revenue):** ${formattedRevenue}`,
      aovFormatted ? `• **اوسط آرڈر ویلیو (AOV):** ${aovFormatted}` : null,
      `• **کامیاب آرڈرز (Valid Orders):** ${stats.validOrdersCount} (کل میں سے ${stats.totalOrders})`,
      `• **ڈیلیور ہو چکے آرڈرز:** ${stats.ordersByStatus.DELIVERED} (${fulfillmentRate}% تکمیل)`,
      `• **جاری آرڈرز (In Progress):** ${stats.ordersByStatus.IN_PROGRESS}`,
      `• **بھیج دیے گئے (Dispatched):** ${stats.ordersByStatus.DISPATCHED}`,
      `• **کینسل شدہ (Rejected):** ${stats.ordersByStatus.REJECTED}`,
      `• **ایکٹو پروڈکٹس:** ${stats.activeProducts} (کل کیٹلاگ: ${stats.totalProducts})`
    ].filter(Boolean).join('\n');
  }

  if (lang === 'ROMAN_URDU') {
    return [
      `📊 **Store Revenue & Orders Summary (${periodLabel}):**`,
      '',
      `• **Total Revenue:** ${formattedRevenue}`,
      aovFormatted ? `• **Average Order Value (AOV):** ${aovFormatted}` : null,
      `• **Valid Orders:** ${stats.validOrdersCount} (${stats.totalOrders} total placed)`,
      `• **Delivered:** ${stats.ordersByStatus.DELIVERED} (${fulfillmentRate}% fulfillment rate)`,
      `• **In Progress:** ${stats.ordersByStatus.IN_PROGRESS}`,
      `• **Dispatched:** ${stats.ordersByStatus.DISPATCHED}`,
      `• **Rejected/Cancelled:** ${stats.ordersByStatus.REJECTED}`,
      `• **Active Catalog Products:** ${stats.activeProducts} of ${stats.totalProducts}`
    ].filter(Boolean).join('\n');
  }

  return [
    `📊 **Store Revenue & Analytics Overview (${periodLabel}):**`,
    '',
    `• **Total Revenue:** ${formattedRevenue}`,
    aovFormatted ? `• **Average Order Value (AOV):** ${aovFormatted}` : null,
    `• **Valid Completed Orders:** ${stats.validOrdersCount} (out of ${stats.totalOrders} total placed)`,
    `• **Delivered:** ${stats.ordersByStatus.DELIVERED} (${fulfillmentRate}% fulfillment rate)`,
    `• **In Progress:** ${stats.ordersByStatus.IN_PROGRESS}`,
    `• **Dispatched:** ${stats.ordersByStatus.DISPATCHED}`,
    `• **Rejected/Cancelled:** ${stats.ordersByStatus.REJECTED}`,
    `• **Active Catalog Products:** ${stats.activeProducts} of ${stats.totalProducts} total`
  ].filter(Boolean).join('\n');
}

export function formatOrderAnalytics(
  stats: {
    period?: string;
    totalOrders: number;
    inProgress: number;
    dispatched: number;
    delivered: number;
    rejected: number;
    message?: string;
  },
  lang: ChatLanguage
): string {
  if (stats.message) {
    return `ℹ️ ${stats.message}`;
  }

  const periodLabel = stats.period || 'All Time';
  const validOrders = stats.totalOrders - stats.rejected;
  const fulfillmentRate = validOrders > 0
    ? Math.round((stats.delivered / validOrders) * 100)
    : 0;

  if (lang === 'URDU_SCRIPT') {
    return [
      `📦 **آرڈرز اینالیٹکس اور اسٹیٹس بریک ڈاؤن (${periodLabel}):**`,
      '',
      `• **کل آرڈرز:** ${stats.totalOrders}`,
      `• **ڈیلیور ہو چکے آرڈرز:** ${stats.delivered} (${fulfillmentRate}% تکمیل)`,
      `• **جاری آرڈرز (In Progress):** ${stats.inProgress}`,
      `• **بھیج دیے گئے (Dispatched):** ${stats.dispatched}`,
      `• **کینسل شدہ (Rejected):** ${stats.rejected}`
    ].join('\n');
  }

  if (lang === 'ROMAN_URDU') {
    return [
      `📦 **Store Orders & Fulfillment Status (${periodLabel}):**`,
      '',
      `• **Total Orders:** ${stats.totalOrders}`,
      `• **Delivered:** ${stats.delivered} (${fulfillmentRate}% fulfillment rate)`,
      `• **In Progress:** ${stats.inProgress}`,
      `• **Dispatched:** ${stats.dispatched}`,
      `• **Rejected/Cancelled:** ${stats.rejected}`
    ].join('\n');
  }

  return [
    `📦 **Store Orders Analytics & Fulfillment (${periodLabel}):**`,
    '',
    `• **Total Orders Placed:** ${stats.totalOrders}`,
    `• **Delivered:** ${stats.delivered} (${fulfillmentRate}% fulfillment rate)`,
    `• **In Progress / Processing:** ${stats.inProgress}`,
    `• **Dispatched / In Transit:** ${stats.dispatched}`,
    `• **Rejected / Cancelled:** ${stats.rejected}`
  ].join('\n');
}

export function formatSalesRanking(
  items: Array<{ id: string; name: string; productCode: string | null; unitsSold: number }>,
  direction: 'top' | 'lowest',
  lang: ChatLanguage
): string {
  if (!items || items.length === 0) {
    return lang === 'URDU_SCRIPT'
      ? 'اس وقت کیٹلاگ میں سیلز کا ڈیٹا دستیاب نہیں ہے۔'
      : lang === 'ROMAN_URDU'
        ? 'Filhal sales ka koi record mojood nahi hai.'
        : 'No sales data is available yet for products in the catalog.';
  }

  const title = direction === 'top'
    ? (lang === 'URDU_SCRIPT' ? '🏆 **سب سے زیادہ فروخت ہونے والی پروڈکٹس (Top Sellers):**' : lang === 'ROMAN_URDU' ? '🏆 **Top Selling Products (Units Sold):**' : '🏆 **Top Selling Products:**')
    : (lang === 'URDU_SCRIPT' ? '📉 **کم ترین فروخت ہونے والی پروڈکٹس (Lowest Selling):**' : lang === 'ROMAN_URDU' ? '📉 **Lowest Selling Products:**' : '📉 **Lowest Selling Products:**');

  const lines = items.slice(0, 5).map((item, idx) => {
    const code = item.productCode ? ` (${item.productCode})` : '';
    return `${idx + 1}. **${item.name}**${code} — ${item.unitsSold} units sold`;
  });

  return `${title}\n\n${lines.join('\n')}`;
}

export function formatInventoryAnalytics(
  items: Array<{ productId: string; name: string; stock: number }>,
  lang: ChatLanguage
): string {
  if (!items || items.length === 0) {
    return lang === 'URDU_SCRIPT'
      ? 'کیٹلاگ میں کوئی انوینٹری ریکارڈ نہیں ملا۔'
      : lang === 'ROMAN_URDU'
        ? 'Catalog mein inventory records nahi milay.'
        : 'No inventory records found in the catalog.';
  }

  const outOfStock = items.filter((p) => p.stock === 0);
  const lowStock = items.filter((p) => p.stock > 0 && p.stock <= 5);
  const inStock = items.filter((p) => p.stock > 5);

  const lines = [
    '📦 **Inventory & Stock Health Report:**',
    '',
    `• **Total Products Analyzed:** ${items.length}`,
    `• **Adequately Stocked (>5 units):** ${inStock.length}`,
    `• **Low Stock Alert (1-5 units):** ${lowStock.length}`,
    `• **Out of Stock:** ${outOfStock.length}`
  ];

  if (lowStock.length > 0) {
    lines.push('', '⚠️ **Low Stock Items:**');
    for (const p of lowStock.slice(0, 5)) {
      lines.push(`• **${p.name}** — ${p.stock} units remaining`);
    }
  }

  if (outOfStock.length > 0) {
    lines.push('', '🚨 **Out of Stock Items:**');
    for (const p of outOfStock.slice(0, 5)) {
      lines.push(`• **${p.name}** (0 units)`);
    }
  }

  return lines.join('\n');
}

export function formatProductStockCheck(
  result: {
    found: boolean;
    query?: string;
    message?: string;
    product?: {
      id: string;
      name: string;
      productCode: string | null;
      price: number;
      imageUrl?: string | null;
      category: string;
      isActive: boolean;
      totalStock: number;
      variantsCount: number;
      requestedVariant: {
        id: string;
        sku: string;
        stock: number;
        attributes: Record<string, string>;
      } | null;
      variants: Array<{ id: string; sku: string; stock: number; attributes: Record<string, string> }>;
    };
  },
  lang: ChatLanguage
): string {
  if (!result.found || !result.product) {
    return lang === 'URDU_SCRIPT'
      ? `معذرت، کیٹلاگ میں "${result.query || 'پروڈکٹ'}" سے متعلق کوئی ریکارڈ نہیں ملا۔`
      : lang === 'ROMAN_URDU'
        ? `Catalog mein "${result.query || 'product'}" se related koi product nahi mila.`
        : (result.message || `No product matching "${result.query || 'query'}" was found in the store catalog.`);
  }

  const p = result.product;
  const req = p.requestedVariant;

  const formatVariantAttrs = (attrs: Record<string, string>) => {
    return Object.entries(attrs).map(([k, v]) => `${k}: ${v}`).join(', ');
  };

  if (req) {
    const attrText = formatVariantAttrs(req.attributes) || req.sku;
    const stockStatus = req.stock > 5 ? '✅ In Stock' : req.stock > 0 ? '⚠️ Low Stock' : '🚨 Out of Stock';
    const otherVariants = p.variants.filter((v) => v.id !== req.id);

    if (lang === 'URDU_SCRIPT') {
      const lines = [
        `📦 **${p.name} — ویریئنٹ اسٹاک کی تفصیل:**`,
        '',
        `• **مطلوبہ ویریئنٹ:** ${attrText} (${req.sku})`,
        `• **اسٹاک کی مقدار:** **${req.stock} یونٹس** (${stockStatus})`,
        `• **کل پراڈکٹ اسٹاک:** تمام ${p.variantsCount} ویریئنٹس میں کل **${p.totalStock} یونٹس** دستیاب ہیں۔`
      ];
      if (otherVariants.length > 0) {
        lines.push('', '**دیگر دستیاب ویریئنٹس:**');
        for (const ov of otherVariants.slice(0, 6)) {
          const ovAttrs = formatVariantAttrs(ov.attributes) || ov.sku;
          lines.push(`• ${ovAttrs} (${ov.sku}) — **${ov.stock} units**`);
        }
      }
      return lines.join('\n');
    }

    if (lang === 'ROMAN_URDU') {
      const lines = [
        `📦 **${p.name} — Variant Stock Status:**`,
        '',
        `• **Requested Variant:** ${attrText} (${req.sku})`,
        `• **Available Stock:** **${req.stock} units** (${stockStatus})`,
        `• **Total Product Stock:** Total **${p.totalStock} units** across all ${p.variantsCount} variants.`
      ];
      if (otherVariants.length > 0) {
        lines.push('', '**Other Variants:**');
        for (const ov of otherVariants.slice(0, 6)) {
          const ovAttrs = formatVariantAttrs(ov.attributes) || ov.sku;
          lines.push(`• ${ovAttrs} (${ov.sku}) — **${ov.stock} units**`);
        }
      }
      return lines.join('\n');
    }

    const lines = [
      `📦 **${p.name} — Stock Details:**`,
      '',
      `• **Requested Variant:** ${attrText} (${req.sku})`,
      `• **Current Stock:** **${req.stock} units** (${stockStatus})`,
      `• **Total Product Stock:** **${p.totalStock} units** across all ${p.variantsCount} variants.`
    ];
    if (otherVariants.length > 0) {
      lines.push('', '**Other Variants Breakdown:**');
      for (const ov of otherVariants.slice(0, 6)) {
        const ovAttrs = formatVariantAttrs(ov.attributes) || ov.sku;
        lines.push(`• ${ovAttrs} (${ov.sku}) — **${ov.stock} units**`);
      }
    }
    return lines.join('\n');
  }

  // If general product stock asked
  const variantLines = p.variants.map((v) => {
    const attrText = formatVariantAttrs(v.attributes) || v.sku;
    return `• **${attrText}** (${v.sku}) — ${v.stock > 0 ? `${v.stock} in stock` : 'Out of stock'}`;
  });

  if (lang === 'URDU_SCRIPT') {
    return [
      `📦 **${p.name} کی مکمل انوینٹری سمری:**`,
      '',
      `• **کل دستیاب اسٹاک:** **${p.totalStock} units**`,
      `• **قیمت:** $${p.price.toFixed(2)} | **کیٹیگری:** ${p.category}`,
      '',
      `**ویریئنٹس کی تفصیل (${p.variantsCount}):**`,
      ...variantLines
    ].join('\n');
  }

  if (lang === 'ROMAN_URDU') {
    return [
      `📦 **${p.name} Stock Breakdown:**`,
      '',
      `• **Total Stock:** **${p.totalStock} units**`,
      `• **Price:** $${p.price.toFixed(2)} | **Category:** ${p.category}`,
      '',
      `**Variants Breakdown (${p.variantsCount}):**`,
      ...variantLines
    ].join('\n');
  }

  return [
    `📦 **${p.name} — Complete Stock Breakdown:**`,
    '',
    `• **Total In Stock:** **${p.totalStock} units**`,
    `• **Unit Price:** $${p.price.toFixed(2)} | **Category:** ${p.category}`,
    '',
    `**Variants Breakdown (${p.variantsCount}):**`,
    ...variantLines
  ].join('\n');
}

export function formatAdminOrdersList(
  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: Date | string;
    customerName: string;
    customerEmail: string;
    items: Array<{
      title: string;
      quantity: number;
      price: number;
      sku: string | null;
      attributes: Record<string, string> | null;
    }>;
  }>,
  lang: ChatLanguage
): string {
  if (!orders || orders.length === 0) {
    return lang === 'URDU_SCRIPT'
      ? 'کوئی متعلقہ اسٹور آرڈرز نہیں ملے۔'
      : lang === 'ROMAN_URDU'
        ? 'Koi matching store orders nahi milay.'
        : 'No matching store orders found for your search criteria.';
  }

  const lines = orders.map((o) => {
    const itemsText = o.items.map((it) => `${it.title} (x${it.quantity})`).join(', ');
    const dateStr = new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `• **Order #${o.orderNumber}** — **$${o.totalAmount.toFixed(2)}** [${o.status}]\n  - Customer: ${o.customerName} (${o.customerEmail})\n  - Date: ${dateStr}\n  - Items: ${itemsText}`;
  });

  if (lang === 'URDU_SCRIPT') {
    return `📋 **اسٹور آرڈرز کی تفاصیل (${orders.length} مل گئے):**\n\n${lines.join('\n\n')}`;
  }

  if (lang === 'ROMAN_URDU') {
    return `📋 **Store Orders Lookup (${orders.length} found):**\n\n${lines.join('\n\n')}`;
  }

  return `📋 **Store Orders Lookup (${orders.length} orders found):**\n\n${lines.join('\n\n')}`;
}

export function formatAdminCustomerList(
  customers: Array<{
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    joinedAt: Date | string;
    ordersCount: number;
    totalSpent: number;
    lastOrder: {
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: number;
      createdAt: Date | string;
    } | null;
  }>,
  lang: ChatLanguage
): string {
  if (!customers || customers.length === 0) {
    return lang === 'URDU_SCRIPT'
      ? 'کوئی کسٹمر ریکارڈ نہیں ملا۔'
      : lang === 'ROMAN_URDU'
        ? 'Koi matching customer record nahi mila.'
        : 'No customer accounts matching your query were found.';
  }

  const lines = customers.map((c) => {
    const lastOrderText = c.lastOrder
      ? `Order #${c.lastOrder.orderNumber} ($${c.lastOrder.totalAmount.toFixed(2)}, ${c.lastOrder.status})`
      : 'No orders yet';
    return `• **${c.name || 'Customer'}** (${c.email})\n  - Total Orders: **${c.ordersCount}** | Total Spent: **$${c.totalSpent.toFixed(2)}**\n  - Last Order: ${lastOrderText}`;
  });

  if (lang === 'URDU_SCRIPT') {
    return `👤 **کسٹمر تفصیلات (${customers.length}):**\n\n${lines.join('\n\n')}`;
  }

  if (lang === 'ROMAN_URDU') {
    return `👤 **Customer Insights (${customers.length}):**\n\n${lines.join('\n\n')}`;
  }

  return `👤 **Customer Insights (${customers.length} found):**\n\n${lines.join('\n\n')}`;
}

export function formatAdminNotificationsList(
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: Date | string;
  }>,
  lang: ChatLanguage
): string {
  if (!notifications || notifications.length === 0) {
    return lang === 'URDU_SCRIPT'
      ? 'اس وقت کوئی نئے نوٹیفیکیشنز یا الرٹس نہیں ہیں۔'
      : lang === 'ROMAN_URDU'
        ? 'Is waqt koi pending notifications ya alerts nahi hain.'
        : 'There are no active notifications or system alerts at this time.';
  }

  const lines = notifications.map((n) => {
    const timeStr = new Date(n.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const statusIcon = n.isRead ? '⚪' : '🔔';
    return `${statusIcon} **${n.title}** (${timeStr})\n  ${n.message}`;
  });

  return `🔔 **Recent Admin Notifications & Alerts:**\n\n${lines.join('\n\n')}`;
}

export function formatLoginRequired(
  actionType: 'ADD_TO_CART' | 'VIEW_CART' | 'GET_ORDER' | 'GENERIC',
  lang: ChatLanguage
): string {
  if (lang === 'URDU_SCRIPT') {
    if (actionType === 'ADD_TO_CART') {
      return 'کارٹ میں چیزیں شامل کرنے کے لیے براہ کرم پہلے لاگ ان کریں کیونکہ اس عمل کے لیے لاگ ان کرنا ضروری ہے۔';
    }
    if (actionType === 'VIEW_CART') {
      return 'کارٹ دیکھنے کے لیے براہ کرم پہلے لاگ ان کریں کیونکہ اس عمل کے لیے لاگ ان کرنا ضروری ہے۔';
    }
    if (actionType === 'GET_ORDER') {
      return 'اپنے آرڈرز چیک اور ٹریک کرنے کے لیے براہ کرم پہلے لاگ ان کریں کیونکہ اس عمل کے لیے لاگ ان کرنا ضروری ہے۔';
    }
    return 'براہ کرم پہلے لاگ ان کریں کیونکہ اس عمل کے لیے لاگ ان کرنا ضروری ہے۔';
  }

  if (lang === 'ROMAN_URDU') {
    if (actionType === 'ADD_TO_CART') {
      return 'Cart mein items add karne ke liye barah-e-karam pehle login karein kyunki is action ke liye login zaroori hai.';
    }
    if (actionType === 'VIEW_CART') {
      return 'Cart dekhne ke liye barah-e-karam pehle login karein kyunki is action ke liye login zaroori hai.';
    }
    if (actionType === 'GET_ORDER') {
      return 'Apne orders check aur track karne ke liye barah-e-karam pehle login karein kyunki is action ke liye login zaroori hai.';
    }
    return 'Barah-e-karam pehle login karein kyunki is action ke liye login zaroori hai.';
  }

  if (actionType === 'ADD_TO_CART') {
    return 'Please login first as adding items to your cart requires you to login first.';
  }
  if (actionType === 'VIEW_CART') {
    return 'Please login first as viewing your cart requires you to login first.';
  }
  if (actionType === 'GET_ORDER') {
    return 'Please login first as tracking your orders requires you to login first.';
  }
  return 'Please login first as this action requires you to login first.';
}

