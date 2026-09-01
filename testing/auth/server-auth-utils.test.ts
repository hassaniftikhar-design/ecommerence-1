import { getCurrentUser, isAdmin } from "@/lib/server-auth";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import {
  mockAuthTokenUser,
  mockAuthTokenAdmin,
} from "../../testing/mocks/auth.mock";

jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

describe("Server Auth Utilities (lib/server-auth.ts)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /*                              getCurrentUser                                */
  /* -------------------------------------------------------------------------- */
  describe("getCurrentUser", () => {
    const mockRequest = {
      url: "http://localhost:3000/api/test",
      headers: new Headers(),
    } as unknown as NextRequest;

    it("should return null if getToken returns null", async () => {
      (getToken as jest.Mock).mockResolvedValueOnce(null);

      const user = await getCurrentUser(mockRequest);

      expect(user).toBeNull();
      expect(getToken).toHaveBeenCalledWith({
        req: mockRequest,
        secret: expect.any(String),
      });
    });

    it("should return null if token is missing sub or email", async () => {
      // Missing sub
      (getToken as jest.Mock).mockResolvedValueOnce({
        email: "test@example.com",
        role: "USER",
      });
      const userWithoutSub = await getCurrentUser(mockRequest);
      expect(userWithoutSub).toBeNull();

      // Missing email
      (getToken as jest.Mock).mockResolvedValueOnce({
        sub: "user-id",
        role: "USER",
      });
      const userWithoutEmail = await getCurrentUser(mockRequest);
      expect(userWithoutEmail).toBeNull();
    });

    it("should return null if session is expired", async () => {
      (getToken as jest.Mock).mockResolvedValueOnce({
        ...mockAuthTokenUser,
        sessionExpiresAt: Date.now() - 1000 * 60, // 1 minute in the past
      });

      const user = await getCurrentUser(mockRequest);

      expect(user).toBeNull();
    });

    it("should return valid AuthToken if token is valid and session is active", async () => {
      (getToken as jest.Mock).mockResolvedValueOnce(mockAuthTokenUser);

      const user = await getCurrentUser(mockRequest);

      expect(user).toEqual(mockAuthTokenUser);
      expect(user?.email).toBe(mockAuthTokenUser.email);
      expect(user?.role).toBe(mockAuthTokenUser.role);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                 isAdmin                                    */
  /* -------------------------------------------------------------------------- */
  describe("isAdmin", () => {
    it("should return true when user role is ADMIN", () => {
      expect(isAdmin(mockAuthTokenAdmin)).toBe(true);
    });

    it("should return false when user role is USER", () => {
      expect(isAdmin(mockAuthTokenUser)).toBe(false);
    });

    it("should return false when user is null or undefined", () => {
      expect(isAdmin(null)).toBe(false);
      expect(isAdmin(undefined as never)).toBe(false);
    });
  });
});
