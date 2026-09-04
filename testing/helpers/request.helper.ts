/* eslint-disable @typescript-eslint/no-explicit-any */

export function createTestRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Request {
  const method = (options?.method || 'GET').toUpperCase();
  const headers = new (global as any).Headers(options?.headers || {});
  if (options?.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  const body =
    options?.body !== undefined
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : undefined;

  return new (global as any).Request(url, {
    method,
    headers,
    body: method !== 'GET' && method !== 'HEAD' ? body : undefined
  }) as unknown as Request;
}
