import { prisma } from '../src/lib/prisma';
import { CHATBOT_EMBEDDING } from '../src/constants/chatbot';
import { syncProductEmbeddingServer } from '../src/server/ai/embeddings/product';
import { syncOrderEmbeddingServer } from '../src/server/ai/embeddings/order';

async function main() {
  console.log(`Starting upgrade to ${CHATBOT_EMBEDDING.modelName} (${CHATBOT_EMBEDDING.dimension}d)...`);

  // 1. Drop existing vector index on EmbeddingDocument if present
  console.log('1. Checking and dropping old vector index if exists...');
  await prisma.$executeRawUnsafe(`
    DROP INDEX IF EXISTS "EmbeddingDocument_embedding_idx";
  `);

  // 2. Clear old 384d embedding documents so column type can be altered
  console.log('2. Clearing old 384d EmbeddingDocument index table...');
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE "EmbeddingDocument";
  `);

  // 3. Alter column to vector(768)
  console.log(`3. Altering "EmbeddingDocument"."embedding" to vector(${CHATBOT_EMBEDDING.dimension})...`);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "EmbeddingDocument" ALTER COLUMN "embedding" TYPE vector(${CHATBOT_EMBEDDING.dimension});
  `);

  // 4. Create HNSW index for cosine similarity
  console.log('4. Recreating HNSW cosine vector index...');
  try {
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "EmbeddingDocument_embedding_hnsw_idx"
      ON "EmbeddingDocument"
      USING hnsw ("embedding" vector_cosine_ops);
    `);
    console.log('HNSW vector index created successfully.');
  } catch (err) {
    console.warn('HNSW index creation note:', err);
  }

  // 5. Verify column definition in database
  const columnInfo = await prisma.$queryRaw<Array<{
    column_name: string;
    udt_name: string;
    type_modifier: number;
  }>>`
    SELECT column_name, udt_name, atttypmod AS type_modifier
    FROM information_schema.columns
    JOIN pg_attribute ON pg_attribute.attname = information_schema.columns.column_name
    JOIN pg_class ON pg_class.oid = pg_attribute.attrelid
    WHERE table_name = 'EmbeddingDocument' AND column_name = 'embedding'
    LIMIT 1;
  `;
  console.log('Database vector column verified:', columnInfo);

  // 6. Regenerate all product embeddings
  console.log('6. Backfilling product embeddings with 768d model...');
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true }
  });
  console.log(`Found ${products.length} active products to embed.`);

  let productSuccess = 0;
  let productFailed = 0;
  for (const p of products) {
    try {
      await syncProductEmbeddingServer(p.id);
      productSuccess++;
      console.log(`  [Product ${productSuccess}/${products.length}] Embedded: ${p.name}`);
    } catch (err) {
      productFailed++;
      console.error(`  [Product ERROR] Failed for ${p.id} (${p.name}):`, err);
    }
  }

  // 7. Regenerate all order embeddings
  console.log('7. Backfilling order embeddings with 768d model...');
  const orders = await prisma.order.findMany({
    select: { id: true, orderNumber: true }
  });
  console.log(`Found ${orders.length} orders to embed.`);

  let orderSuccess = 0;
  let orderFailed = 0;
  for (const o of orders) {
    try {
      await syncOrderEmbeddingServer(o.id);
      orderSuccess++;
      console.log(`  [Order ${orderSuccess}/${orders.length}] Embedded: #${o.orderNumber}`);
    } catch (err) {
      orderFailed++;
      console.error(`  [Order ERROR] Failed for ${o.id} (#${o.orderNumber}):`, err);
    }
  }

  // 8. Verify final EmbeddingDocument rows
  const documentCount = await prisma.embeddingDocument.count();
  const sampleDoc = await prisma.embeddingDocument.findFirst({
    select: {
      entityType: true,
      entityId: true,
      embeddingModel: true,
      status: true
    }
  });

  console.log('\n================ UPGRADE SUMMARY ================');
  console.log(`Model: ${CHATBOT_EMBEDDING.modelName}`);
  console.log(`Dimension: ${CHATBOT_EMBEDDING.dimension}d`);
  console.log(`Products embedded: ${productSuccess} (failed: ${productFailed})`);
  console.log(`Orders embedded: ${orderSuccess} (failed: ${orderFailed})`);
  console.log(`Total EmbeddingDocuments in DB: ${documentCount}`);
  console.log(`Sample doc model: ${sampleDoc?.embeddingModel}`);
  console.log('=================================================\n');

  if (productFailed > 0 || orderFailed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error('Fatal upgrade error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
