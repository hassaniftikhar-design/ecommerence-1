import 'server-only';

import { createHash, randomUUID } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { CHATBOT_EMBEDDING } from '@/constants/chatbot';

import { embedDocument } from './service';

type ProductEmbeddingSource = {
  id: string;
  name: string;
  productCode: string | null;
  description: string | null;
  isActive: boolean;
  category: { name: string };
  options: Array<{ name: string; values: Array<{ value: string }> }>;
  variants: Array<{
    sku: string;
    variantOptions: Array<{
      optionValue: { value: string; option: { name: string } };
    }>;
  }>;
};

export function buildProductEmbeddingText(product: ProductEmbeddingSource): string {
  const options = product.options
    .map((option) => `${option.name}: ${[...option.values].map(({ value }) => value).sort().join(', ')}`)
    .sort((a, b) => a.localeCompare(b));

  const variants = product.variants
    .map((variant) => {
      const attributes = variant.variantOptions
        .map(({ optionValue }) => `${optionValue.option.name}: ${optionValue.value}`)
        .sort((a, b) => a.localeCompare(b));
      return `${attributes.join(', ')}${attributes.length ? ' — ' : ''}SKU: ${variant.sku}`;
    })
    .sort((a, b) => a.localeCompare(b));

  return [
    `Product: ${product.name.trim()}`,
    `Category: ${product.category.name.trim()}`,
    product.description?.trim() ? `Description: ${product.description.trim()}` : '',
    options.length ? `Options: ${options.join('; ')}` : '',
    variants.length ? `Variants: ${variants.join('; ')}` : '',
    product.productCode ? `Product Code: ${product.productCode.trim()}` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

export async function syncProductEmbeddingServer(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { name: true } },
      options: { include: { values: { select: { value: true } } } },
      variants: {
        include: {
          variantOptions: {
            include: { optionValue: { include: { option: { select: { name: true } } } } }
          }
        }
      }
    }
  });

  if (!product || !product.isActive) {
    await prisma.embeddingDocument.updateMany({
      where: { entityType: 'PRODUCT', entityId: productId },
      data: { status: 'INACTIVE' }
    });
    return;
  }

  const content = buildProductEmbeddingText(product);
  const contentHash = createHash('sha256').update(content).digest('hex');
  const current = await prisma.embeddingDocument.findUnique({
    where: { entityType_entityId: { entityType: 'PRODUCT', entityId: productId } },
    select: { contentHash: true, embeddingModel: true, status: true }
  });

  if (
    current?.contentHash === contentHash &&
    current.embeddingModel === CHATBOT_EMBEDDING.modelName &&
    current.status === 'ACTIVE'
  ) return;

  const embedding = await embedDocument(content);
  const vectorLiteral = `[${embedding.map((value) => value.toFixed(8)).join(',')}]`;
  const documentId = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO "EmbeddingDocument"
      ("id", "entityType", "entityId", "userId", "content", "embedding", "contentHash", "embeddingModel", "status", "createdAt", "updatedAt")
    VALUES
      (${documentId}, 'PRODUCT', ${product.id}, NULL, ${content}, ${vectorLiteral}::vector, ${contentHash}, ${CHATBOT_EMBEDDING.modelName}, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("entityType", "entityId") DO UPDATE SET
      "content" = EXCLUDED."content",
      "embedding" = EXCLUDED."embedding",
      "contentHash" = EXCLUDED."contentHash",
      "embeddingModel" = EXCLUDED."embeddingModel",
      "status" = 'ACTIVE',
      "updatedAt" = CURRENT_TIMESTAMP
  `;
}

export async function deactivateProductEmbeddingServer(productId: string): Promise<void> {
  await prisma.embeddingDocument.updateMany({
    where: { entityType: 'PRODUCT', entityId: productId },
    data: { status: 'INACTIVE' }
  });
}
