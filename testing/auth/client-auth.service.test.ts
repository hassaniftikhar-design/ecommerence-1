import {
  login,
  logout,
  signup,
  forgotPassword,
  resetPassword,
  verifyResetToken,
} from "@/services/auth.service";
import { signIn, signOut } from "next-auth/react";
import {
  mockLoginPayload,
  mockSignupPayload,
  mockForgotPasswordPayload,
  mockResetPasswordPayload,
} from "../../testing/mocks/auth.mock";

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
  signOut: jest.fn(),
}));

describe("Client Auth Service (src/services/auth.service.ts)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /* -------------------------------------------------------------------------- */
  /*                                    login                                   */
  /* -------------------------------------------------------------------------- */
  describe("login", () => {
    it("should call signIn with credentials and resolve on success", async () => {
      (signIn as jest.Mock).mockResolvedValueOnce({
        error: null,
        status: 200,
        ok: true,
        url: "",
      });

      await expect(login(mockLoginPayload)).resolves.toBeUndefined();
      expect(signIn).toHaveBeenCalledWith("credentials", {
        redirect: false,
        email: mockLoginPayload.email,
        password: mockLoginPayload.password,
        rememberMe: "true",
      });
    });

    it("should throw friendly error when CredentialsSignin error is returned", async () => {
      (signIn as jest.Mock).mockResolvedValueOnce({
        error: "CredentialsSignin",
        status: 401,
        ok: false,
        url: null,
      });

      await expect(login(mockLoginPayload)).rejects.toThrow(
        "Wrong username password, please enter correct credentials"
      );
    });

    it("should throw generic error message when another error occurs", async () => {
      (signIn as jest.Mock).mockResolvedValueOnce({
        error: "CustomAuthError",
        status: 400,
        ok: false,
        url: null,
      });

      await expect(login(mockLoginPayload)).rejects.toThrow("CustomAuthError");
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                   logout                                   */
  /* -------------------------------------------------------------------------- */
  describe("logout", () => {
    it("should call signOut with /login callbackUrl", async () => {
      (signOut as jest.Mock).mockResolvedValueOnce(undefined);

      await logout();

      expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                   signup                                   */
  /* -------------------------------------------------------------------------- */
  describe("signup", () => {
    it("should send POST request to /api/auth/signup and succeed", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          success: true,
          message: "Account created successfully",
        }),
      });

      await expect(signup(mockSignupPayload)).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockSignupPayload),
      });
    });

    it("should throw error message from API response on failure", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          success: false,
          message: "A user with this email already exists",
        }),
      });

      await expect(signup(mockSignupPayload)).rejects.toThrow(
        "A user with this email already exists"
      );
    });

    it("should parse multiple error strings in response", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          errors: ["Invalid email", "Password too weak"],
        }),
      });

      await expect(signup(mockSignupPayload)).rejects.toThrow(
        "Invalid email, Password too weak"
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                               forgotPassword                               */
  /* -------------------------------------------------------------------------- */
  describe("forgotPassword", () => {
    it("should send POST request to /api/auth/forgot-password and succeed", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: "Password reset instructions sent",
        }),
      });

      await expect(forgotPassword(mockForgotPasswordPayload)).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockForgotPasswordPayload),
      });
    });

    it("should throw error on failure", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          message: "This email does not exist in our Store.",
        }),
      });

      await expect(forgotPassword(mockForgotPasswordPayload)).rejects.toThrow(
        "This email does not exist in our Store."
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                resetPassword                               */
  /* -------------------------------------------------------------------------- */
  describe("resetPassword", () => {
    it("should send POST request to /api/auth/reset-password and succeed", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: "Password changed successfully",
        }),
      });

      await expect(resetPassword(mockResetPasswordPayload)).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockResetPasswordPayload),
      });
    });

    it("should throw error if reset fails", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: "The reset link is invalid or has expired",
        }),
      });

      await expect(resetPassword(mockResetPasswordPayload)).rejects.toThrow(
        "The reset link is invalid or has expired"
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                              verifyResetToken                              */
  /* -------------------------------------------------------------------------- */
  describe("verifyResetToken", () => {
    it("should send GET request to /api/auth/reset-password?token=... and succeed", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { valid: true },
        }),
      });

      await expect(verifyResetToken("test-token-123")).resolves.toBeUndefined();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/auth/reset-password?token=test-token-123"
      );
    });

    it("should throw error if token is expired or invalid", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          message: "This password reset link has expired.",
        }),
      });

      await expect(verifyResetToken("expired-token")).rejects.toThrow(
        "This password reset link has expired."
      );
    });
  });
});
