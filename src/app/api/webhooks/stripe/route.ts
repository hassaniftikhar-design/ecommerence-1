import { headers } from 'next/headers';

import { processStripeWebhookServer } from '@/server/services/webhook.service';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.text();
  const headerList = await headers();
  const signature = headerList.get('stripe-signature');

  const result = await processStripeWebhookServer(body, signature);

  if (!result.success) {
    return new Response(result.message, { status: result.status });
  }

  return new Response(
    JSON.stringify({
      received: true,
      ...(result.isDuplicate ? { duplicate: true } : {})
    }),
    {
      status: result.status,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

