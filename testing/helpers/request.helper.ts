/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-extraneous-dependencies */
import fetch, {
  Headers as NodeFetchHeaders,
  Request as NodeFetchRequest,
  Response as NodeFetchResponse
} from 'node-fetch';

// Polyfill Web API Request, Response, and Headers in jsdom environment using node-fetch
if (typeof (global as any).Request === 'undefined') {
  (global as any).Request = NodeFetchRequest;
}

if (typeof (global as any).Response === 'undefined') {
  (global as any).Response = NodeFetchResponse;
}

if (typeof (global as any).Headers === 'undefined') {
  (global as any).Headers = NodeFetchHeaders;
}

if (typeof (global as any).fetch === 'undefined') {
  (global as any).fetch = fetch;
}

export function createTestRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): Request {
  const method = options?.method || 'GET';
  const headers = new NodeFetchHeaders(options?.headers || {});
  if (options?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const body =
    options?.body !== undefined
      ? typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
      : undefined;

  return new NodeFetchRequest(url, {
    method,
    headers,
    body: method !== 'GET' && method !== 'HEAD' ? body : undefined
  }) as unknown as Request;
}

/* eslint-enable @typescript-eslint/no-explicit-any */
/* eslint-enable import/no-extraneous-dependencies */

