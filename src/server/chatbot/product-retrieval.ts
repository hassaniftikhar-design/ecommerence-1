import 'server-only';

import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  CHATBOT_RAG_TOP_K,
  CHATBOT_STRONG_MATCH_THRESHOLD,
  CHATBOT_RELATED_MATCH_THRESHOLD
} from '@/constants/chatbot';
import { getProductByIdServer } from '@/server/services/product.service';

import { embedQuery } from '@/server/ai/embeddings';
import type { Product } from '@/types/product.types';

export type ProductMatchConfidence = 'EXACT_MATCH' | 'STRONG_SEMANTIC_MATCH' | 'RELATED_MATCH' | 'NO_MEANINGFUL_MATCH';

export type QueryWordGroup = {
  original: string;
  variants: string[];
};

export interface LexicalFieldBreakdown {
  titleScore: number;
  categoryScore: number;
  descriptionScore: number;
  lexicalScore: number;
}

type Candidate = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  productCode: string | null;
  categoryName: string;
  semanticScore: number;
};

const ignoredTerms = new Set([
  'a', 'an', 'the', 'for', 'of', 'to', 'in', 'on', 'under', 'below', 'less', 'than', 'up', 'max', 'maximum', 'between', 'and', 'with', 'do', 'you', 'have', 'is', 'are', 'can', 'there', 'any', 'me', 'my', 'i', 'need', 'want', 'looking', 'find', 'show', 'please', 'hi', 'hello',
  'jsut', 'just', 'only', 'one', 'or', 'other', 'styles', 'brands', 'aswell', 'as', 'well', 'all', 'more', 'types', 'give', 'tell', 'about',
  'product', 'products', 'prodcut', 'prodcuts', 'item', 'items', 'thing', 'things', 'stuff', 'collection', 'catalog', 'shop', 'store', 'something', 'anything', 'good', 'best', 'cheap', 'cheaper', 'cheapest', 'expensive', 'costly', 'least', 'most', 'affordable', 'lowest', 'highest', 'price', 'prices',
  'mujhe', 'mughe', 'mujy', 'mujay', 'humein', 'hamen', 'ap', 'aap', 'tum', 'bhai', 'janab', 'achi', 'ache', 'acha', 'achha', 'achhe', 'achhi', 'si', 'sa', 'se', 'kuch', 'zara', 'thora', 'bhi', 'aur', 'wali', 'wala', 'wale', 'walay', 'mein', 'me', 'm', 'main', 'par', 'pe', 'ka', 'ke', 'ki', 'ko', 'liye', 'chahiye', 'chahye', 'kya', 'kia', 'hai', 'hain', 'he', 'hoon', 'hun', 'dikhao', 'dikhayein', 'batao', 'batayein', 'dhoond', 'search', 'koi', 'sasta', 'sasti', 'saste', 'mehnga', 'mehngi', 'mehngay', 'mehngi',
  'مجھے', 'چاہیے', 'کوئی', 'اچھی', 'اچھا', 'سی', 'سا', 'دکھائیں', 'دکھاؤ', 'بتائیں', 'کے', 'کی', 'کا', 'کو', 'میں', 'سے', 'پر', 'ہے', 'ہیں', 'کچھ'
]);

const urduToEnglishMap: Record<string, string[]> = {
  sneaker: ['sneaker', 'sneakers', 'shoes'],
  sneakers: ['sneaker', 'sneakers', 'shoes'],
  اسنیکر: ['sneaker', 'sneakers', 'shoes'],
  اسنیکرز: ['sneaker', 'sneakers', 'shoes'],
  بلیک: ['black'],
  سیاہ: ['black'],
  سفید: ['white'],
  لال: ['red'],
  سرخ: ['red'],
  نیلا: ['blue'],
  سبز: ['green'],
  پیلا: ['yellow'],
  سرمئی: ['gray', 'grey'],
  topi: ['cap', 'caps', 'hat', 'hats', 'beanie'],
  topiyan: ['caps', 'hats', 'beanies'],
  ٹوپی: ['cap', 'caps', 'hat', 'beanie'],
  ٹوپیاں: ['caps', 'hats'],
  joota: ['shoe', 'shoes', 'footwear', 'sneakers'],
  jootay: ['shoes', 'sneakers', 'footwear'],
  joote: ['shoes', 'sneakers', 'footwear'],
  جوتے: ['shoes', 'sneakers', 'footwear'],
  جوتا: ['shoe', 'shoes'],
  chappal: ['slippers', 'flip flops', 'sandals'],
  chappalain: ['slippers', 'sandals'],
  chappalein: ['slippers', 'sandals'],
  چپل: ['slippers', 'sandals'],
  ghari: ['watch', 'watches', 'digital watch'],
  ghariyan: ['watches', 'digital watches'],
  گھڑی: ['watch', 'watches'],
  گھڑیاں: ['watches'],
  kapray: ['clothes', 'clothing', 'apparel'],
  kapre: ['clothes', 'clothing', 'apparel'],
  کپڑے: ['clothes', 'clothing'],
  chashma: ['glasses', 'sunglasses', 'eyewear'],
  ainaq: ['glasses', 'sunglasses'],
  چشمہ: ['glasses', 'sunglasses'],
  عینک: ['glasses', 'sunglasses'],
  botal: ['bottle', 'water bottle'],
  بوتل: ['bottle', 'water bottle'],
  thela: ['bag', 'bags'],
  basta: ['bag', 'bags', 'backpack'],
  baste: ['bags', 'backpacks'],
  thailay: ['bags'],
  بیگ: ['bag', 'bags'],
  تھیلا: ['bag', 'bags'],
  anguthi: ['ring', 'jewelry'],
  انگوٹھی: ['ring'],
  khilona: ['toy', 'play'],
  khilone: ['toys', 'play'],
  کھلونا: ['toy', 'play'],
  کھلونے: ['toys', 'play'],
  kot: ['jacket', 'coat'],
  kotey: ['jackets', 'coats'],
  jacket: ['jacket', 'outerwear'],
  hoodie: ['hoodie', 'hoodies', 'sweatshirt'],
  trimmer: ['trimmer', 'shaver', 'hair trimmer'],
  earbuds: ['earbuds', 'headphones', 'earphones'],
  gripper: ['gripper', 'hand gripper']
};

export function enrichProductSearchQuery(query: string): string {
  const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const extras = new Set<string>();
  for (const w of words) {
    if (urduToEnglishMap[w]) {
      for (const syn of urduToEnglishMap[w]) {
        extras.add(syn);
      }
    }
  }
  return extras.size > 0 ? `${query} ${[...extras].join(' ')}` : query;
}

export type PriceExtremeIntent = 'BOTH_EXTREMES' | 'CHEAPEST' | 'EXPENSIVE' | 'NONE';

export function detectPriceExtreme(query: string): PriceExtremeIntent {
  const hasCheapest = /\b(cheapest|lowest\s*price|least\s*expensive|most\s*affordable|budget\s*friendly|sast[ai]|sab\s*se\s*sast[ai]|sasta\s*tareen|سب\s*سے\s*سستا)\b/i.test(query);
  const hasExpensive = /\b(most\s*expensive|highest\s*price|most\s*costly|expensive|luxury|premium|mehng[ai]|sab\s*se\s*mehng[ai]|mehnga\s*tareen|سب\s*سے\s*مہنگا)\b/i.test(query);

  if (hasCheapest && hasExpensive) return 'BOTH_EXTREMES';
  if (hasCheapest) return 'CHEAPEST';
  if (hasExpensive && !/\b(less|not)\s+expensive\b/i.test(query)) return 'EXPENSIVE';
  return 'NONE';
}

export function buildQueryWordGroups(query: string): QueryWordGroup[] {
  const rawTerms = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])]
    .filter((term) => term.length > 1 && !/^\d+$/.test(term) && !ignoredTerms.has(term));

  return rawTerms.map((term) => {
    const variants = new Set<string>();
    variants.add(term);

    // Expand Urdu transliterations to English synonyms for SQL lexical search
    if (urduToEnglishMap[term]) {
      for (const syn of urduToEnglishMap[term]) {
        variants.add(syn);
      }
    }

    if (term.endsWith('ies') && term.length > 4) {
      variants.add(term.slice(0, -3) + 'y');
    } else if (term.endsWith('es') && term.length > 4) {
      variants.add(term.slice(0, -2));
      variants.add(term.slice(0, -1));
    } else if (term.endsWith('s') && term.length > 3) {
      variants.add(term.slice(0, -1));
    } else {
      variants.add(term + 's');
      variants.add(term + 'es');
    }

    return {
      original: term,
      variants: [...variants]
    };
  });
}

export function getQueryTerms(query: string): string[] {
  const wordGroups = buildQueryWordGroups(query);
  const allTerms = new Set<string>();
  for (const group of wordGroups) {
    for (const v of group.variants) {
      allTerms.add(v);
    }
  }
  return [...allTerms].slice(0, 16);
}

export function getPriceBounds(query: string): { min?: number; max?: number } {
  const range = query.match(/\b(?:between)\s*(?:rs\.?|pkr|usd|\$)?\s*([\d,]+)\s*(?:and|to|se|-)\s*(?:rs\.?|pkr|usd|\$)?\s*([\d,]+)|\$?([\d,]+)\s*(?:-|to)\s*\$?([\d,]+)/i);
  if (range) {
    const raw1 = range[1] || range[3];
    const raw2 = range[2] || range[4];
    if (raw1 && raw2) {
      const v1 = Number(raw1.replaceAll(',', ''));
      const v2 = Number(raw2.replaceAll(',', ''));
      if (Number.isFinite(v1) && Number.isFinite(v2)) {
        return { min: Math.min(v1, v2), max: Math.max(v1, v2) };
      }
    }
  }

  const maximum = query.match(/\b(?:under|below|less than|cheaper than|up to|max(?:imum)?|within)\s+(?:rs\.?|pkr|usd|\$)?\s*([\d,]+)|([\d,]+)\s*(?:se\s*kam|se\s*neeche|ke\s*andar)\b/i);
  if (maximum) {
    const val = Number((maximum[1] || maximum[2])?.replaceAll(',', ''));
    if (Number.isFinite(val)) return { max: val };
  }

  const minimum = query.match(/\b(?:over|above|more than|greater than|at least)\s+(?:rs\.?|pkr|usd|\$)?\s*([\d,]+)|([\d,]+)\s*(?:se\s*zyada|se\s*upar|se\s*oper)\b/i);
  if (minimum) {
    const val = Number((minimum[1] || minimum[2])?.replaceAll(',', ''));
    if (Number.isFinite(val)) return { min: val };
  }

  return {};
}

function calculateFieldScore(text: string | null | undefined, wordGroups: QueryWordGroup[]): number {
  if (!text || wordGroups.length === 0) return 0;
  const lowerText = text.toLocaleLowerCase();
  let matched = 0;
  for (const group of wordGroups) {
    const hasMatch = group.variants.some((v) => lowerText.includes(v.toLowerCase()));
    if (hasMatch) {
      matched++;
    }
  }
  return Math.min(1, matched / wordGroups.length);
}

export function calculateLexicalScore(
  candidate: { name: string; categoryName: string; description: string | null },
  wordGroups: QueryWordGroup[]
): LexicalFieldBreakdown {
  if (wordGroups.length === 0) {
    return { titleScore: 0, categoryScore: 0, descriptionScore: 0, lexicalScore: 0 };
  }

  const titleScore = calculateFieldScore(candidate.name, wordGroups);
  const categoryScore = calculateFieldScore(candidate.categoryName, wordGroups);
  const descriptionScore = calculateFieldScore(candidate.description, wordGroups);

  const lexicalScore = Number((0.60 * titleScore + 0.25 * categoryScore + 0.15 * descriptionScore).toFixed(4));

  return {
    titleScore,
    categoryScore,
    descriptionScore,
    lexicalScore
  };
}

export function calculateFinalScore(lexicalScore: number, semanticScore: number): number {
  const normLex = Math.max(0, Math.min(1, lexicalScore));
  const normSem = Math.max(0, Math.min(1, semanticScore));
  return Number((0.60 * normLex + 0.40 * normSem).toFixed(4));
}

export async function searchProductsHybridServer(query: string): Promise<{
  confidence: ProductMatchConfidence;
  products: Array<{ product: Product; similarity: number; match: ProductMatchConfidence }>;
}> {
  const normalizedQuery = query.trim().slice(0, 500);
  const priceBounds = getPriceBounds(normalizedQuery);
  const priceFilter = {
    ...(priceBounds.min !== undefined ? { gte: priceBounds.min } : {}),
    ...(priceBounds.max !== undefined ? { lte: priceBounds.max } : {})
  };
  const priceHasFilter = Object.keys(priceFilter).length > 0;

  // ==========================================
  // PHASE 1 — EXACT SKU MATCH
  // ==========================================
  // 1. Direct equality check on normalized query
  let exactSkuVariant = await prisma.productVariant.findFirst({
    where: {
      sku: { equals: normalizedQuery, mode: 'insensitive' },
      product: { isActive: true }
    },
    select: { productId: true }
  });

  // 2. Extract SKU patterns from query (e.g. "show me produt having sku GLAS-353" or "find GLAS-353")
  if (!exactSkuVariant) {
    const skuMatches = normalizedQuery.match(/\b[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+\b/g);
    if (skuMatches && skuMatches.length > 0) {
      for (const possibleSku of skuMatches) {
        const found = await prisma.productVariant.findFirst({
          where: {
            sku: { equals: possibleSku, mode: 'insensitive' },
            product: { isActive: true }
          },
          select: { productId: true }
        });
        if (found) {
          exactSkuVariant = found;
          break;
        }
      }
    }
  }

  if (exactSkuVariant) {
    const product = await getProductByIdServer(exactSkuVariant.productId, false);
    if (product && product.isActive) {
      const passesPrice = (priceBounds.min === undefined || product.price >= priceBounds.min) &&
                          (priceBounds.max === undefined || product.price <= priceBounds.max);
      if (passesPrice) {
        return {
          confidence: 'EXACT_MATCH',
          products: [{ product, similarity: 1.0, match: 'EXACT_MATCH' }]
        };
      }
    }
  }

  const wordGroups = buildQueryWordGroups(normalizedQuery);
  const terms = getQueryTerms(normalizedQuery);
  const priceExtreme = detectPriceExtreme(normalizedQuery);

  const productSelect = {
    id: true,
    name: true,
    price: true,
    description: true,
    productCode: true,
    category: { select: { name: true } }
  };

  const [exactRows, lexicalRows, priceOnlyRows, extremeRows] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        ...(priceHasFilter ? { price: priceFilter } : {}),
        OR: [
          { name: { equals: normalizedQuery, mode: 'insensitive' } },
          { productCode: { equals: normalizedQuery, mode: 'insensitive' } },
          ...(terms.length ? [{ name: { in: terms, mode: 'insensitive' as const } }] : [])
        ]
      },
      select: productSelect,
      take: CHATBOT_RAG_TOP_K
    }),
    terms.length
      ? prisma.product.findMany({
          where: {
            isActive: true,
            ...(priceHasFilter ? { price: priceFilter } : {}),
            OR: terms.flatMap((term) => [
              { name: { contains: term, mode: 'insensitive' as const } },
              { description: { contains: term, mode: 'insensitive' as const } },
              { productCode: { contains: term, mode: 'insensitive' as const } },
              { category: { name: { contains: term, mode: 'insensitive' as const } } }
            ])
          },
          select: productSelect,
          orderBy: priceExtreme === 'CHEAPEST' ? { price: 'asc' } : priceExtreme === 'EXPENSIVE' ? { price: 'desc' } : undefined,
          take: CHATBOT_RAG_TOP_K * 4
        })
      : Promise.resolve([]),
    (terms.length === 0 && priceHasFilter)
      ? prisma.product.findMany({
          where: {
            isActive: true,
            price: priceFilter
          },
          select: productSelect,
          orderBy: { price: 'asc' },
          take: CHATBOT_RAG_TOP_K * 2
        })
      : Promise.resolve([]),
    priceExtreme === 'BOTH_EXTREMES'
      ? Promise.all([
          prisma.product.findMany({
            where: { isActive: true, ...(priceHasFilter ? { price: priceFilter } : {}) },
            select: productSelect,
            orderBy: { price: 'asc' },
            take: 2
          }),
          prisma.product.findMany({
            where: { isActive: true, ...(priceHasFilter ? { price: priceFilter } : {}) },
            select: productSelect,
            orderBy: { price: 'desc' },
            take: 2
          })
        ]).then(([cheap, exp]) => [...cheap, ...exp])
      : priceExtreme === 'CHEAPEST' && terms.length === 0
        ? prisma.product.findMany({
            where: { isActive: true, ...(priceHasFilter ? { price: priceFilter } : {}) },
            select: productSelect,
            orderBy: { price: 'asc' },
            take: CHATBOT_RAG_TOP_K
          })
        : priceExtreme === 'EXPENSIVE' && terms.length === 0
          ? prisma.product.findMany({
              where: { isActive: true, ...(priceHasFilter ? { price: priceFilter } : {}) },
              select: productSelect,
              orderBy: { price: 'desc' },
              take: CHATBOT_RAG_TOP_K
            })
          : Promise.resolve([])
  ]);

  const candidates = new Map<string, Candidate>();
  for (const row of [
    ...exactRows,
    ...lexicalRows,
    ...priceOnlyRows,
    ...extremeRows
  ]) {
    const previous = candidates.get(row.id);
    candidates.set(row.id, {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      description: row.description,
      productCode: row.productCode,
      categoryName: row.category.name,
      semanticScore: previous?.semanticScore || 0
    });
  }

  // ==========================================
  // PHASE 4 — SEMANTIC CANDIDATE RETRIEVAL
  // ==========================================
  try {
    const enrichedQuery = enrichProductSearchQuery(normalizedQuery);
    const vector = await embedQuery(enrichedQuery);
    const vectorLiteral = `[${vector.map((value) => value.toFixed(8)).join(',')}]`;
    const semanticRows = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      price: number;
      description: string | null;
      productCode: string | null;
      categoryName: string;
      similarity: number;
    }>>`
      SELECT p."id", p."name", p."price", p."description", p."productCode",
             c."name" AS "categoryName",
             (1 - (ed."embedding" <=> ${vectorLiteral}::vector))::float8 AS "similarity"
      FROM "EmbeddingDocument" ed
      INNER JOIN "Product" p ON p."id" = ed."entityId"
      INNER JOIN "Category" c ON c."id" = p."categoryId"
      WHERE ed."entityType" = 'PRODUCT'
        AND ed."status" = 'ACTIVE'
        AND p."isActive" = true
        ${priceBounds.min !== undefined ? Prisma.sql`AND p."price" >= ${priceBounds.min}` : Prisma.empty}
        ${priceBounds.max !== undefined ? Prisma.sql`AND p."price" <= ${priceBounds.max}` : Prisma.empty}
      ORDER BY ed."embedding" <=> ${vectorLiteral}::vector
      LIMIT ${CHATBOT_RAG_TOP_K * 3}
    `;

    for (const row of semanticRows) {
      const candidate = candidates.get(row.id) || {
        id: row.id,
        name: row.name,
        price: Number(row.price),
        description: row.description,
        productCode: row.productCode,
        categoryName: row.categoryName,
        semanticScore: 0
      };
      candidate.semanticScore = Math.max(
        candidate.semanticScore,
        Math.max(0, Math.min(1, row.similarity))
      );
      candidates.set(row.id, candidate);
    }
  } catch (error) {
    // Exact and lexical results remain available when the vector subsystem is degraded.
    console.error('[ShopFast Assistant] Semantic product retrieval unavailable', error);
  }

  const queryLower = normalizedQuery.toLocaleLowerCase();

  // ==========================================
  // PHASE 2, 3, 5, 7 — RERANKING & TIE BREAKING
  // ==========================================
  const ranked = [...candidates.values()]
    .map((candidate) => {
      // Phase 2: Exact normalized product name match
      const isExactName = candidate.name.trim().toLocaleLowerCase() === queryLower;
      // Phase 3: Lexical field score
      const lexical = calculateLexicalScore(candidate, wordGroups);
      // Phase 4: Semantic score normalized to [0, 1]
      const semantic = Math.max(0, Math.min(1, candidate.semanticScore));
      // Phase 5: Final MVP score (0.60 * Lexical + 0.40 * Semantic)
      const finalScore = isExactName ? 1.0 : calculateFinalScore(lexical.lexicalScore, semantic);

      return {
        candidate,
        isExactName,
        lexicalScore: lexical.lexicalScore,
        semanticScore: semantic,
        finalScore
      };
    })
    .sort((a, b) => {
      // Phase 9: Special price search handling
      if (priceExtreme === 'BOTH_EXTREMES') {
        return a.candidate.price - b.candidate.price;
      }
      if (priceExtreme === 'CHEAPEST') {
        if (a.isExactName && !b.isExactName) return -1;
        if (!a.isExactName && b.isExactName) return 1;
        return a.candidate.price - b.candidate.price;
      }
      if (priceExtreme === 'EXPENSIVE') {
        if (a.isExactName && !b.isExactName) return -1;
        if (!a.isExactName && b.isExactName) return 1;
        return b.candidate.price - a.candidate.price;
      }

      // Phase 7: Deterministic tie breakers
      // Tier 1: Exact product name priority
      if (a.isExactName && !b.isExactName) return -1;
      if (!a.isExactName && b.isExactName) return 1;

      // Tier 2: FinalScore descending
      if (Math.abs(b.finalScore - a.finalScore) > 0.0001) {
        return b.finalScore - a.finalScore;
      }

      // Tier 3: LexicalScore descending
      if (Math.abs(b.lexicalScore - a.lexicalScore) > 0.0001) {
        return b.lexicalScore - a.lexicalScore;
      }

      // Tier 4: SemanticScore descending
      if (Math.abs(b.semanticScore - a.semanticScore) > 0.0001) {
        return b.semanticScore - a.semanticScore;
      }

      // Tier 5: Deterministic ID comparison
      return a.candidate.id.localeCompare(b.candidate.id);
    });

  // ==========================================
  // PHASE 6 — HARD FILTERS & THRESHOLDING
  // ==========================================
  const meaningful = ranked.filter(({ isExactName, finalScore, lexicalScore }) => {
    if (isExactName) return true;
    if (priceHasFilter || priceExtreme !== 'NONE') return true;
    return finalScore >= CHATBOT_RELATED_MATCH_THRESHOLD || lexicalScore >= 0.40;
  });

  // ==========================================
  // PHASE 8 — AUTHORITATIVE DB HYDRATION
  // ==========================================
  const products = await Promise.all(
    meaningful.map(async ({ candidate, isExactName, finalScore }) => {
      const product = await getProductByIdServer(candidate.id, false);
      if (!product || !product.isActive) return null;
      if (priceBounds.min !== undefined && product.price < priceBounds.min) return null;
      if (priceBounds.max !== undefined && product.price > priceBounds.max) return null;

      const match: ProductMatchConfidence = isExactName
        ? 'EXACT_MATCH'
        : finalScore >= CHATBOT_STRONG_MATCH_THRESHOLD
          ? 'STRONG_SEMANTIC_MATCH'
          : 'RELATED_MATCH';

      return { product, similarity: finalScore, match };
    })
  );

  const validProducts = products
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .slice(0, CHATBOT_RAG_TOP_K);

  return {
    confidence: validProducts.length === 0
      ? 'NO_MEANINGFUL_MATCH'
      : validProducts.some((item) => item.match === 'EXACT_MATCH')
        ? 'EXACT_MATCH'
        : validProducts.some((item) => item.match === 'STRONG_SEMANTIC_MATCH')
          ? 'STRONG_SEMANTIC_MATCH'
          : 'RELATED_MATCH',
    products: validProducts
  };
}
