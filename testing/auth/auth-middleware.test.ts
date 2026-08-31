jest.mock("next/server", () => {
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
    cookies: {
      delete: (name: string) => void;
      set: (name: string, value: string) => void;
    };

    constructor(data?: any, init?: { status?: number; headers?: any }) {
      this._data = data;
      this.status = init?.status ?? 200;
      this._headerMap = new Map();
      if (init?.headers) {
        if (typeof init.headers.forEach === "function") {
          init.headers.forEach((v: string, k: string) => this._headerMap.set(k.toLowerCase(), v));
        } else if (typeof init.headers === "object") {
          Object.entries(init.headers).forEach(([k, v]) => this._headerMap.set(k.toLowerCase(), String(v)));
        }
      }
      this.headers = {
        get: (key: string) => this._headerMap.get(key.toLowerCase()) ?? null,
        set: (key: string, value: string) => this._headerMap.set(key.toLowerCase(), value),
        has: (key: string) => this._headerMap.has(key.toLowerCase()),
        delete: (key: string) => this._headerMap.delete(key.toLowerCase()),
      };
      this.cookies = {
        delete: (name: string) => {
          this.headers.set("set-cookie", `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
        },
        set: (name: string, value: string) => {
          this.headers.set("set-cookie", `${name}=${value}; Path=/`);
        },
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
      res.headers.set("location", url.toString());
      return res;
    }

    static next() {
      return new MockNextResponse(null, { status: 200 });
    }
  }

  return {
    NextResponse: MockNextResponse,
    NextRequest: class MockNextRequest { },
  };
});

import { middleware } from "@/middleware";
import { getToken } from "next-auth/jwt";
import {
  mockAuthTokenUser,
  mockAuthTokenAdmin,
} from "../../testing/mocks/auth.mock";

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

function createMockNextRequest(pathname: string, origin = "http://localhost:3000") {
  const url = new URL(pathname, origin);
  return {
    url: url.toString(),
    nextUrl: url,
    cookies: {
      get: jest.fn(),
      delete: jest.fn(),
    },
    headers: new Headers(),
  } as any;
}

describe("Next.js Edge Auth Middleware (middleware.ts)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /*                            UNAUTHENTICATED ACCESS                          */
  /* -------------------------------------------------------------------------- */
  describe("Unauthenticated access (No Token)", () => {
    beforeEach(() => {
      (getToken as jest.Mock).mockResolvedValue(null);
    });

    it("should allow public routes like / without redirect", async () => {
      const req = createMockNextRequest("/");
      const res = await middleware(req);

      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(200);
    });

    it("should allow auth pages like /login and /signup without redirect", async () => {
      const reqLogin = createMockNextRequest("/login");
      const resLogin = await middleware(reqLogin);
      expect(resLogin.headers.get("location")).toBeNull();

      const reqSignup = createMockNextRequest("/signup");
      const resSignup = await middleware(reqSignup);
      expect(resSignup.headers.get("location")).toBeNull();
    });

    it("should redirect protected route /admin to /login with callbackUrl", async () => {
      const req = createMockNextRequest("/admin/products");
      const res = await middleware(req);

      const location = res.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("callbackUrl=%2Fadmin%2Fproducts");
    });

    it("should redirect protected route /orders to /login with callbackUrl", async () => {
      const req = createMockNextRequest("/orders");
      const res = await middleware(req);

      const location = res.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("callbackUrl=%2Forders");
    });

    it("should redirect protected route /cart to /login with callbackUrl", async () => {
      const req = createMockNextRequest("/cart");
      const res = await middleware(req);

      const location = res.headers.get("location");
      expect(location).toContain("/login");
      expect(location).toContain("callbackUrl=%2Fcart");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                               EXPIRED SESSION                              */
  /* -------------------------------------------------------------------------- */
  describe("Expired session token", () => {
    beforeEach(() => {
      (getToken as jest.Mock).mockResolvedValue({
        ...mockAuthTokenUser,
        sessionExpiresAt: Date.now() - 1000 * 60 * 5, // Expired 5 minutes ago
      });
    });

    it("should redirect protected routes to login and delete session cookies", async () => {
      const req = createMockNextRequest("/cart");
      const res = await middleware(req);

      const location = res.headers.get("location");
      expect(location).toContain("/login?callbackUrl=%2Fcart");

      // Verify session cookie deletion header
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toBeDefined();
    });

    it("should allow public route and clear session cookie when session is expired", async () => {
      const req = createMockNextRequest("/");
      const res = await middleware(req);

      expect(res.headers.get("location")).toBeNull();
      const setCookie = res.headers.get("set-cookie");
      expect(setCookie).toBeDefined();
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                            ADMIN AUTHENTICATION                            */
  /* -------------------------------------------------------------------------- */
  describe("Authenticated ADMIN user", () => {
    beforeEach(() => {
      (getToken as jest.Mock).mockResolvedValue(mockAuthTokenAdmin);
    });

    it("should redirect root / to /admin/products", async () => {
      const req = createMockNextRequest("/");
      const res = await middleware(req);

      const location = res.headers.get("location");
      expect(location).toBe("http://localhost:3000/admin/products");
    });

    it("should redirect /login or /signup to /admin/products", async () => {
      const reqLogin = createMockNextRequest("/login");
      const resLogin = await middleware(reqLogin);
      expect(resLogin.headers.get("location")).toBe("http://localhost:3000/admin/products");

      const reqSignup = createMockNextRequest("/signup");
      const resSignup = await middleware(reqSignup);
      expect(resSignup.headers.get("location")).toBe("http://localhost:3000/admin/products");
    });

    it("should allow admin accessing /admin/* routes", async () => {
      const req = createMockNextRequest("/admin/products");
      const res = await middleware(req);

      expect(res.headers.get("location")).toBeNull();
      expect(res.status).toBe(200);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                            USER AUTHENTICATION                             */
  /* -------------------------------------------------------------------------- */
  describe("Authenticated Regular USER", () => {
    beforeEach(() => {
      (getToken as jest.Mock).mockResolvedValue(mockAuthTokenUser);
    });

    it("should redirect /login or /signup to /", async () => {
      const reqLogin = createMockNextRequest("/login");
      const resLogin = await middleware(reqLogin);
      expect(resLogin.headers.get("location")).toBe("http://localhost:3000/");

      const reqSignup = createMockNextRequest("/signup");
      const resSignup = await middleware(reqSignup);
      expect(resSignup.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("should block non-admin accessing /admin and redirect to /", async () => {
      const req = createMockNextRequest("/admin/orders");
      const res = await middleware(req);

      expect(res.headers.get("location")).toBe("http://localhost:3000/");
    });

    it("should allow regular user accessing /, /orders, /cart", async () => {
      const reqHome = createMockNextRequest("/");
      const resHome = await middleware(reqHome);
      expect(resHome.headers.get("location")).toBeNull();

      const reqOrders = createMockNextRequest("/orders");
      const resOrders = await middleware(reqOrders);
      expect(resOrders.headers.get("location")).toBeNull();

      const reqCart = createMockNextRequest("/cart");
      const resCart = await middleware(reqCart);
      expect(resCart.headers.get("location")).toBeNull();
    });
  });
});
