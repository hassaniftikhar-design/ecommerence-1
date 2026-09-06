import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

// Polyfill TextEncoder / TextDecoder if missing
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
  // @ts-expect-error polyfill node vs dom types
  global.TextDecoder = TextDecoder;
}

if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
    text: async () => ''
  });
}

// Set up mock test environment variables
process.env.NEXTAUTH_SECRET = 'mock-secret-key-for-unit-testing-32-chars';
process.env.NEXTAUTH_URL = 'http://localhost:3000';
process.env.DATABASE_URL = 'postgresql://mock:mock@localhost:5432/mockdb';
Object.assign(process.env, { NODE_ENV: 'test' });

// Polyfill window.dispatchEvent and CustomEvent if needed in jsdom
if (typeof window !== 'undefined' && typeof window.CustomEvent !== 'function') {
  class CustomEvent<T = unknown> extends Event {
    detail: T;
    constructor(event: string, params?: { bubbles?: boolean; cancelable?: boolean; detail?: T }) {
      super(event, params);
      this.detail = params?.detail as T;
    }
  }
  // @ts-expect-error polyfill custom event
  window.CustomEvent = CustomEvent;
}

// Polyfill Web API Request, Response, and Headers in jsdom environment
if (typeof global.Headers === 'undefined') {
  class MockHeaders {
    private map = new Map<string, string>();
    constructor(init?: Record<string, string> | [string, string][] | MockHeaders) {
      if (init) {
        if (init instanceof MockHeaders || Array.isArray(init)) {
          for (const [k, v] of init as any) {
            this.set(k, v);
          }
        } else {
          for (const [k, v] of Object.entries(init)) {
            this.set(k, v);
          }
        }
      }
    }
    get(name: string) {
      return this.map.get(name.toLowerCase()) || null;
    }
    set(name: string, value: string) {
      this.map.set(name.toLowerCase(), String(value));
    }
    has(name: string) {
      return this.map.has(name.toLowerCase());
    }
    delete(name: string) {
      this.map.delete(name.toLowerCase());
    }
    forEach(callback: (value: string, key: string) => void) {
      this.map.forEach((v, k) => callback(v, k));
    }
  }
  // @ts-expect-error polyfill headers
  global.Headers = MockHeaders;
}

if (typeof global.Request === 'undefined') {
  class MockRequest {
    url: string;
    method: string;
    headers: any;
    private _body: any;
    constructor(input: string, init?: any) {
      this.url = input;
      this.method = (init?.method || 'GET').toUpperCase();
      this.headers = new (global as any).Headers(init?.headers);
      this._body = init?.body;
    }
    async json() {
      if (typeof this._body === 'string') {
        return JSON.parse(this._body);
      }
      return this._body || {};
    }
    async text() {
      if (typeof this._body === 'string') {
        return this._body;
      }
      return JSON.stringify(this._body || '');
    }
  }
  // @ts-expect-error polyfill request
  global.Request = MockRequest;
}

if (typeof global.Response === 'undefined') {
  class MockResponse {
    status: number;
    statusText: string;
    headers: any;
    private _body: any;
    constructor(body?: any, init?: any) {
      this._body = body;
      this.status = init?.status || 200;
      this.statusText = init?.statusText || 'OK';
      this.headers = new (global as any).Headers(init?.headers);
    }
    get ok() {
      return this.status >= 200 && this.status < 300;
    }
    async json() {
      if (typeof this._body === 'string') {
        try {
          return JSON.parse(this._body);
        } catch {
          return this._body;
        }
      }
      return this._body;
    }
    async text() {
      if (typeof this._body === 'string') {
        return this._body;
      }
      return JSON.stringify(this._body);
    }
    static json(data: any, init?: any) {
      return new MockResponse(data, init);
    }
  }
  // @ts-expect-error polyfill response
  global.Response = MockResponse;
}

// Global mock for next/server
jest.mock('next/server', () => {
  class MockNextResponse {
    status: number;
    headers: {
      get: (key: string) => string | null;
      set: (key: string, value: string) => void;
      has: (key: string) => boolean;
      delete: (key: string) => void;
    };
    private _data: any;
    private _headerMap: Map<string, string>;

    constructor(data?: any, init?: { status?: number; headers?: any }) {
      this._data = data;
      this.status = init?.status ?? 200;
      this._headerMap = new Map();
      if (init?.headers) {
        if (typeof init.headers.forEach === 'function') {
          init.headers.forEach((v: string, k: string) => this._headerMap.set(k.toLowerCase(), v));
        } else if (typeof init.headers === 'object') {
          Object.entries(init.headers).forEach(([k, v]) => this._headerMap.set(k.toLowerCase(), String(v)));
        }
      }
      this.headers = {
        get: (key: string) => this._headerMap.get(key.toLowerCase()) ?? null,
        set: (key: string, value: string) => this._headerMap.set(key.toLowerCase(), value),
        has: (key: string) => this._headerMap.has(key.toLowerCase()),
        delete: (key: string) => this._headerMap.delete(key.toLowerCase())
      };
    }

    async json() {
      return this._data;
    }

    static json(data: any, init?: { status?: number; headers?: any }) {
      return new MockNextResponse(data, init);
    }

    static redirect(url: string | URL, status = 307) {
      const res = new MockNextResponse(null, { status });
      res.headers.set('location', url.toString());
      return res;
    }

    static next() {
      return new MockNextResponse(null, { status: 200 });
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: class MockNextRequest { }
  };
});

// Global mock for Stripe server
jest.mock('@/lib/stripe/stripe-server', () => ({
  stripe: {
    customers: {
      create: jest.fn().mockResolvedValue({ id: 'cus_mock_123' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'cus_mock_123' }),
      update: jest.fn().mockResolvedValue({ id: 'cus_mock_123' })
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: 'pi_mock_123', client_secret: 'pi_mock_123_secret_xyz' }),
      retrieve: jest.fn().mockResolvedValue({ id: 'pi_mock_123', status: 'succeeded' })
    },
    setupIntents: {
      create: jest.fn().mockResolvedValue({ id: 'seti_mock_123', client_secret: 'seti_mock_123_secret_xyz' })
    },
    paymentMethods: {
      attach: jest.fn().mockResolvedValue({ id: 'pm_mock_123' }),
      detach: jest.fn().mockResolvedValue({ id: 'pm_mock_123' }),
      retrieve: jest.fn().mockResolvedValue({
        id: 'pm_mock_123',
        card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2028 }
      }),
      list: jest.fn().mockResolvedValue({ data: [] })
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({ id: 'evt_mock_123', type: 'payment_intent.succeeded' })
    }
  },
  createOrGetStripeCustomer: jest.fn().mockResolvedValue('cus_mock_123')
}));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
