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
  description: string | null;
  productCode: string | null;
  categoryName: string;
  semanticScore: number;
  exact: boolean;
};

const ignoredTerms = new Set([
  'a', 'an', 'the', 'for', 'of', 'to', 'in', 'on', 'under', 'below', 'less', 'than', 'up', 'max', 'maximum', 'between', 'and', 'with', 'do', 'you', 'have', 'is', 'are', 'can', 'there', 'any', 'me', 'my', 'i', 'need', 'want', 'looking', 'find', 'show', 'please', 'hi', 'hello',
  'jsut', 'just', 'only', 'one', 'or', 'other', 'styles', 'brands', 'aswell', 'as', 'well', 'all', 'more', 'types', 'give', 'tell', 'about',
  'mujhe', 'ke', 'ki', 'liye', 'chahiye', 'kya', 'hai', 'hain', 'dikhao', 'batao', 'koi', 'wali', 'wala', 'wale'
]);

function getQueryTerms(query: string): string[] {
  const rawTerms = [...new Set(query.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])]
    .filter((term) => term.length > 1 && !/^\d+$/.test(term) && !ignoredTerms.has(term));

  const expandedTerms = new Set<string>();
  for (const term of rawTerms) {
    expandedTerms.add(term);
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

  return [...expandedTerms].slice(0, 12);
}

function getPriceBounds(query: string): { min?: number; max?: number } {
  const range = query.match(/\bbetween\s+\$?([\d,]+)\s+(?:and|to)\s+\$?([\d,]+)/i);
  if (range) return { min: Number(range[1]?.replaceAll(',', '')), max: Number(range[2]?.replaceAll(',', '')) };
  const maximum = query.match(/\b(?:under|below|less than|up to|max(?:imum)?|within)\s+(?:rs\.?|pkr|usd|\$)?\s*([\d,]+)/i);
  if (maximum) return { max: Number(maximum[1]?.replaceAll(',', '')) };
  const minimum = query.match(/\b(?:over|above|more than|at least)\s+(?:rs\.?|pkr|usd|\$)?\s*([\d,]+)/i);
  if (minimum) return { min: Number(minimum[1]?.replaceAll(',', '')) };
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
  const priceBounds = getPriceBounds(normalizedQuery);
  const priceFilter = {
    ...(priceBounds.min !== undefined ? { gte: priceBounds.min } : {}),
    ...(priceBounds.max !== undefined ? { lte: priceBounds.max } : {})
  };
  const [exactRows, lexicalRows] = await Promise.all([
    prisma.product.findMany({
      where: {
        isActive: true,
        ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
        OR: [
          { name: { equals: normalizedQuery, mode: 'insensitive' } },
          { productCode: { equals: normalizedQuery, mode: 'insensitive' } },
          { variants: { some: { sku: { equals: normalizedQuery, mode: 'insensitive' } } } }
        ]
      },
      select: { id: true, name: true, description: true, productCode: true, category: { select: { name: true } } },
      take: CHATBOT_RAG_TOP_K
    }),
    terms.length
    ? await prisma.product.findMany({
      where: {
        isActive: true,
        ...(Object.keys(priceFilter).length ? { price: priceFilter } : {}),
          OR: terms.flatMap((term) => [
            { name: { contains: term, mode: 'insensitive' as const } },
            { description: { contains: term, mode: 'insensitive' as const } },
            { productCode: { contains: term, mode: 'insensitive' as const } },
            { category: { name: { contains: term, mode: 'insensitive' as const } } },
            { variants: { some: { sku: { contains: term, mode: 'insensitive' as const } } } }
          ])
        },
        select: {
          id: true,
          name: true,
          description: true,
          productCode: true,
          category: { select: { name: true } }
        },
      take: CHATBOT_RAG_TOP_K * 4
      })
    : Promise.resolve([])
  ]);

  const candidates = new Map<string, Candidate>();
  for (const row of [
    ...exactRows.map((row) => ({ ...row, exactQuery: true })),
    ...lexicalRows.map((row) => ({ ...row, exactQuery: false }))
  ]) {
    const exact = row.name.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase() ||
      row.productCode?.toLocaleLowerCase() === normalizedQuery.toLocaleLowerCase() || row.exactQuery;
    const previous = candidates.get(row.id);
    candidates.set(row.id, {
      id: row.id,
      name: row.name,
      description: row.description,
      productCode: row.productCode,
      categoryName: row.category.name,
      semanticScore: previous?.semanticScore || 0,
      exact: exact || Boolean(previous?.exact)
    });
  }

  try {
    const vector = await embedQuery(normalizedQuery);
    const vectorLiteral = `[${vector.map((value) => value.toFixed(8)).join(',')}]`;
    const semanticRows = await prisma.$queryRaw<Array<{
      id: string;
      name: string;
      description: string | null;
      productCode: string | null;
      categoryName: string;
      similarity: number;
    }>>`
      SELECT p."id", p."name", p."description", p."productCode",
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
        description: row.description,
        productCode: row.productCode,
        categoryName: row.categoryName,
        semanticScore: 0,
        exact: false
      };
      candidate.semanticScore = row.similarity;
      candidates.set(row.id, candidate);
    }
  } catch (error) {
    // Exact and lexical results remain available when the vector subsystem is degraded.
    console.error('[ShopFast Assistant] Semantic product retrieval unavailable', error);
  }

  const ranked = [...candidates.values()]
    .map((candidate) => ({ candidate, coverage: lexicalCoverage(candidate, terms) }))
    .sort((a, b) => {
      const scoreA = a.candidate.semanticScore * 0.7 + a.coverage * 0.3 + (a.candidate.exact ? 0.5 : 0);
      const scoreB = b.candidate.semanticScore * 0.7 + b.coverage * 0.3 + (b.candidate.exact ? 0.5 : 0);
      return scoreB - scoreA;
    });

  const meaningful = ranked.filter(({ candidate, coverage }) =>
    candidate.exact || coverage > 0 ||
    candidate.semanticScore >= CHATBOT_SIMILARITY_THRESHOLD
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
