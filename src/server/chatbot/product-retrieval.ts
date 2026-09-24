import 'server-only';

import { prisma } from '@/lib/prisma';
import { CHATBOT_RAG_TOP_K, CHATBOT_SIMILARITY_THRESHOLD } from '@/constants/chatbot';
import { getProductByIdServer } from '@/server/services/product.service';

import { embedQuery } from '@/server/ai/embeddings';
import type { Product } from '@/types/product.types';

export type ProductMatchConfidence = 'EXACT_MATCH' | 'STRONG_SEMANTIC_MATCH' | 'RELATED_MATCH' | 'NO_MEANINGFUL_MATCH';

type Candidate = {
  id: string;
  name: string;
  price: number;
  description: string | null;
  productCode: string | null;
  categoryName: string;
  semanticScore: number;
  exact: boolean;
};

const ignoredTerms = new Set([
  'a', 'an', 'the', 'for', 'of', 'to', 'in', 'on', 'under', 'below', 'less', 'than', 'up', 'max', 'maximum', 'between', 'and', 'with', 'do', 'you', 'have', 'is', 'are', 'can', 'there', 'any', 'me', 'my', 'i', 'need', 'want', 'looking', 'find', 'show', 'please', 'hi', 'hello',
  'jsut', 'just', 'only', 'one', 'or', 'other', 'styles', 'brands', 'aswell', 'as', 'well', 'all', 'more', 'types', 'give', 'tell', 'about',
  'product', 'products', 'prodcut', 'prodcuts', 'item', 'items', 'thing', 'things', 'stuff', 'collection', 'catalog', 'shop', 'store', 'something', 'anything', 'good', 'best', 'cheap', 'cheaper', 'cheapest', 'expensive', 'costly', 'least', 'most', 'affordable', 'lowest', 'highest', 'price', 'prices',
  'mujhe', 'mughe', 'mujy', 'mujay', 'humein', 'hamen', 'ap', 'aap', 'tum', 'bhai', 'janab', 'achi', 'ache', 'acha', 'achha', 'achhe', 'achhi', 'si', 'sa', 'se', 'kuch', 'zara', 'thora', 'bhi', 'aur', 'wali', 'wala', 'wale', 'walay', 'mein', 'me', 'm', 'main', 'par', 'pe', 'ka', 'ke', 'ki', 'ko', 'liye', 'chahiye', 'chahye', 'kya', 'kia', 'hai', 'hain', 'he', 'hoon', 'hun', 'dikhao', 'dikhayein', 'batao', 'batayein', 'dhoond', 'search', 'koi', 'sasta', 'sasti', 'saste', 'mehnga', 'mehngi', 'mehngay', 'mehngi',
  'مجھے', 'چاہیے', 'کوئی', 'اچھی', 'اچھا', 'سی', 'سا', 'دکھائیں', 'دکھاؤ', 'بتائیں', 'کے', 'کی', 'کا', 'کو', 'میں', 'سے', 'پر', 'ہے', 'ہیں', 'کچھ'
]);

const urduToEnglishMap: Record<string, string[]> = {
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

function getQueryTerms(query: string): string[] {
  const rawTerms = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])]
    .filter((term) => term.length > 1 && !/^\d+$/.test(term) && !ignoredTerms.has(term));

  const expandedTerms = new Set<string>();
  for (const term of rawTerms) {
    expandedTerms.add(term);

    // Expand Urdu transliterations to English synonyms for SQL lexical search
    if (urduToEnglishMap[term]) {
      for (const syn of urduToEnglishMap[term]) {
        expandedTerms.add(syn);
      }
    }

    if (term.endsWith('ies') && term.length > 4) {
      expandedTerms.add(term.slice(0, -3) + 'y');
    } else if (term.endsWith('es') && term.length > 4) {
      expandedTerms.add(term.slice(0, -2));
      expandedTerms.add(term.slice(0, -1));
    } else if (term.endsWith('s') && term.length > 3) {
      expandedTerms.add(term.slice(0, -1));
    } else {
      expandedTerms.add(term + 's');
      expandedTerms.add(term + 'es');
    }
  }

  return [...expandedTerms].slice(0, 16);
}

function getPriceBounds(query: string): { min?: number; max?: number } {
  const range = query.match(/\b(?:between|\$)\s*([\d,]+)\s*(?:and|to|se|-)\s*\$?([\d,]+)/i);
  if (range && range[1] && range[2]) {
    const v1 = Number(range[1].replaceAll(',', ''));
    const v2 = Number(range[2].replaceAll(',', ''));
    if (Number.isFinite(v1) && Number.isFinite(v2)) {
      return { min: Math.min(v1, v2), max: Math.max(v1, v2) };
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

function lexicalCoverage(candidate: Candidate, terms: string[]): number {
  if (terms.length === 0) return 0;
  const searchable = [
    candidate.name,
    candidate.description || '',
    candidate.productCode || '',
    candidate.categoryName
  ].join(' ').toLocaleLowerCase();
  const matched = terms.filter((term) => searchable.includes(term)).length;
  return matched > 0 ? Math.min(1, matched / Math.min(terms.length, 3)) : 0;
}

export async function searchProductsHybridServer(query: string): Promise<{
  confidence: ProductMatchConfidence;
  products: Array<{ product: Product; similarity: number; match: ProductMatchConfidence }>;
}> {
  const normalizedQuery = query.trim().slice(0, 500);
  const terms = getQueryTerms(normalizedQuery);
  const priceExtreme = detectPriceExtreme(normalizedQuery);
  const priceBounds = getPriceBounds(normalizedQuery);
  const priceFilter = {
    ...(priceBounds.min !== undefined ? { gte: priceBounds.min } : {}),
    ...(priceBounds.max !== undefined ? { lte: priceBounds.max } : {})
  };
  const priceHasFilter = Object.keys(priceFilter).length > 0;

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
          { variants: { some: { sku: { equals: normalizedQuery, mode: 'insensitive' } } } }
        ]
      },
      select: productSelect,
      take: CHATBOT_RAG_TOP_K
    }),
    terms.length
      ? await prisma.product.findMany({
          where: {
            isActive: true,
            ...(priceHasFilter ? { price: priceFilter } : {}),
            OR: terms.flatMap((term) => [
              { name: { contains: term, mode: 'insensitive' as const } },
              { description: { contains: term, mode: 'insensitive' as const } },
              { productCode: { contains: term, mode: 'insensitive' as const } },
              { category: { name: { contains: term, mode: 'insensitive' as const } } },
              { variants: { some: { sku: { contains: term, mode: 'insensitive' as const } } } }
            ])
          },
          select: productSelect,
          orderBy: priceExtreme === 'CHEAPEST' ? { price: 'asc' } : priceExtreme === 'EXPENSIVE' ? { price: 'desc' } : undefined,
          take: CHATBOT_RAG_TOP_K * 4
        })
      : Promise.resolve([]),
    (terms.length === 0 && priceHasFilter)
      ? await prisma.product.findMany({
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
    ...exactRows.map((row) => ({ ...row, exactQuery: true })),
    ...lexicalRows.map((row) => ({ ...row, exactQuery: false })),
    ...priceOnlyRows.map((row) => ({ ...row, exactQuery: true })),
    ...extremeRows.map((row) => ({ ...row, exactQuery: true }))
  ]) {
    const exact = row.name.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase() ||
      row.productCode?.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase() || row.exactQuery;
    const previous = candidates.get(row.id);
    candidates.set(row.id, {
      id: row.id,
      name: row.name,
      price: Number(row.price),
      description: row.description,
      productCode: row.productCode,
      categoryName: row.category.name,
      semanticScore: previous?.semanticScore || (exact ? 1.0 : 0),
      exact: exact || Boolean(previous?.exact)
    });
  }

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
        semanticScore: 0,
        exact: false
      };
      candidate.semanticScore = Math.max(candidate.semanticScore, row.similarity);
      candidates.set(row.id, candidate);
    }
  } catch (error) {
    // Exact and lexical results remain available when the vector subsystem is degraded.
    console.error('[ShopFast Assistant] Semantic product retrieval unavailable', error);
  }

  const ranked = [...candidates.values()]
    .map((candidate) => ({ candidate, coverage: lexicalCoverage(candidate, terms) }))
    .sort((a, b) => {
      if (priceExtreme === 'BOTH_EXTREMES' && (a.candidate.exact || b.candidate.exact)) {
        return a.candidate.price - b.candidate.price;
      }
      if (priceExtreme === 'CHEAPEST') {
        if (a.candidate.exact && !b.candidate.exact) return -1;
        if (!a.candidate.exact && b.candidate.exact) return 1;
        return a.candidate.price - b.candidate.price;
      }
      if (priceExtreme === 'EXPENSIVE') {
        if (a.candidate.exact && !b.candidate.exact) return -1;
        if (!a.candidate.exact && b.candidate.exact) return 1;
        return b.candidate.price - a.candidate.price;
      }
      const scoreA = a.candidate.semanticScore * 0.7 + a.coverage * 0.3 + (a.candidate.exact ? 0.5 : 0);
      const scoreB = b.candidate.semanticScore * 0.7 + b.coverage * 0.3 + (b.candidate.exact ? 0.5 : 0);
      return scoreB - scoreA;
    });

  const meaningful = ranked.filter(({ candidate, coverage }) =>
    candidate.exact || coverage > 0 || priceHasFilter ||
    priceExtreme !== 'NONE' || candidate.semanticScore >= CHATBOT_SIMILARITY_THRESHOLD
  );

  const products = await Promise.all(meaningful.map(async ({ candidate, coverage }) => {
    const product = await getProductByIdServer(candidate.id, false);
    if (!product) return null;
    if (priceBounds.min !== undefined && product.price < priceBounds.min) return null;
    if (priceBounds.max !== undefined && product.price > priceBounds.max) return null;
    const match: ProductMatchConfidence = candidate.exact || coverage === 1
      ? 'EXACT_MATCH'
      : candidate.semanticScore >= 0.84
        ? 'STRONG_SEMANTIC_MATCH'
        : 'RELATED_MATCH';
    return { product, similarity: candidate.semanticScore, match };
  }));
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
