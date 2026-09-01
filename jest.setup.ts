import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Polyfill TextEncoder / TextDecoder if missing
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
  // @ts-expect-error polyfill node vs dom types
  global.TextDecoder = TextDecoder;
}

if (typeof global.fetch === "undefined") {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({}),
    text: async () => "",
  });
}

// Set up mock test environment variables
process.env.NEXTAUTH_SECRET = "mock-secret-key-for-unit-testing-32-chars";
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/mockdb";
Object.assign(process.env, { NODE_ENV: "test" });

// Polyfill window.dispatchEvent and CustomEvent if needed in jsdom
if (typeof window !== "undefined" && typeof window.CustomEvent !== "function") {
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

// Global mock for Stripe server
jest.mock("@/lib/stripe/stripe-server", () => ({
  stripe: {
    customers: {
      create: jest.fn().mockResolvedValue({ id: "cus_mock_123" }),
      retrieve: jest.fn().mockResolvedValue({ id: "cus_mock_123" }),
      update: jest.fn().mockResolvedValue({ id: "cus_mock_123" }),
    },
    paymentIntents: {
      create: jest.fn().mockResolvedValue({ id: "pi_mock_123", client_secret: "pi_mock_123_secret_xyz" }),
      retrieve: jest.fn().mockResolvedValue({ id: "pi_mock_123", status: "succeeded" }),
    },
    setupIntents: {
      create: jest.fn().mockResolvedValue({ id: "seti_mock_123", client_secret: "seti_mock_123_secret_xyz" }),
    },
    paymentMethods: {
      attach: jest.fn().mockResolvedValue({ id: "pm_mock_123" }),
      detach: jest.fn().mockResolvedValue({ id: "pm_mock_123" }),
      list: jest.fn().mockResolvedValue({ data: [] }),
    },
    webhooks: {
      constructEvent: jest.fn().mockReturnValue({ id: "evt_mock_123", type: "payment_intent.succeeded" }),
    },
  },
  createOrGetStripeCustomer: jest.fn().mockResolvedValue("cus_mock_123"),
}));

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});
