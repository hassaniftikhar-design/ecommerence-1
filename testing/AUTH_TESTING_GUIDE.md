# Authentication System Testing Guide & Test Case Specification

This document provides a detailed mapping of every test file in the `testing/` folder, the source code it targets, the exact test cases/edge cases it handles, the mocks utilized, and architectural/security considerations.

---

## 📊 Summary & Coverage Overview

- **Total Test Suites**: 8 / 8 passing (`100%`)
- **Total Test Cases**: 142 / 142 passing (`100%`)
- **Type Checking (`npx tsc --noEmit`)**: 0 errors
- **Database Dependency**: `0` real database queries made (100% isolated with `testing/mocks/prisma.mock.ts` and `testing/mocks/auth.mock.ts`).
- **External Network Dependency**: `0` external requests (SMTP, Google OAuth, and fetch are fully mocked).

---

## 📁 Test Files Breakdown & Specifications

### 1. [`testing/auth/server-auth.service.test.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/testing/auth/server-auth.service.test.ts)
- **Target Source Code Tested**: [`src/server/services/auth.service.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/src/server/services/auth.service.ts)
- **Total Tests**: **37 tests**

#### Scenarios & Edge Cases Covered:
1. **`signupUserServer`**:
   - **Validation Rejections**: Incomplete payload, short name, invalid email, weak password.
   - **409 Duplicate Email Conflict**: Attempting registration when email already exists.
   - **Email Normalization & Case-Insensitivity**: Testing mixed-case `"Test@Email.com"` and uppercase `"TEST@EMAIL.COM"` to ensure lowercase storage and duplicate detection.
   - **Database Unique Constraint Violation (`P2002`)**: Simulating race conditions when two concurrent signups pass the initial `findUnique` check.
   - **Password Hashing**: Verifying raw password is never stored plain and is hashed with `bcryptjs` (salt rounds 12).
   - **Optional Fields**: Handling missing or empty mobile phone strings.
   - **Database Connection Failures**: Safe error throwing when `prisma.user.findUnique` or `prisma.user.create` rejects.

2. **`forgotPasswordServer`**:
   - **Input Validation**: Malformed email validation failure (`400`).
   - **Non-existent Email**: Returns `404 Not Found` with message `"This email does not exist in our Store."`.
   - **Secure Token Generation**: Generates 32-byte hex random token and sets 1-hour expiration timestamp.
   - **Multiple Reset Requests**: Overwrites previous token when a new request is made, invalidating older tokens.
   - **SMTP Failure**: Gracefully returns `500 Server Error` if email transport fails.
   - **Database Update Errors**: Handles unexpected database update rejection safely.

3. **`validateResetTokenServer`**:
   - **Missing / Blank Token**: Returns `400 Bad Request`.
   - **Unrecognized Token**: Returns `400 Bad Request` if token not found in DB.
   - **Deterministic Expiration Boundaries (using `jest.useFakeTimers`)**:
     - `expiresAt < now`: Rejected with `400` ("This password reset link has expired.").
     - `expiresAt === now`: Valid with `200` (boundary condition `expires.getTime() < now` is false).
     - `expiresAt > now`: Valid with `200`.
   - **Inactive Account**: Rejects token validation if `user.isActive: false`.
   - **Database Connection Failure**: Throws safely on DB query rejection.

4. **`resetPasswordServer`**:
   - **Password Mismatch / Weak Password**: Rejected with `400`.
   - **Token Reuse Prevention**:
     - **First Usage**: Validates token, hashes new password, updates DB, and sets `resetToken: null` and `resetTokenExpires: null`.
     - **Second Usage (with exact same token)**: Rejects with `400 Bad Request` since token is no longer in DB.
   - **Token Invalidation on Multiple Requests**: Token A fails after Token B was generated; Token B succeeds.
   - **Database Failure**: Safe error propagation on database update error.

5. **`changePasswordServer`**:
   - **Validation Failures**: Missing current password or password confirmation mismatch.
   - **404 Not Found**: User ID not found in database or user is inactive.
   - **OAuth-Only Account**: Returns `400` if account has no password set (`user.password === null`).
   - **Incorrect Current Password**: Fails bcrypt comparison and returns `400 Bad Request`.
   - **Same Password as Current Password**: Verifies application behavior when `currentPassword === newPassword` (allows re-hashing and DB update).
   - **Successful Password Change**: Re-hashes new password and updates DB record.
   - **Database Connection Failure**: Throws safely on DB failure.

6. **`verifyEmailServer`**:
   - **Empty / Invalid Token**: Rejected with `400`.
   - **Non-existent or Expired Token**: Rejected with `400`.
   - **Successful Verification**: Updates user `emailVerified: Date` and deletes verification token record.
   - **Deletion Failure**: Safe handling if token deletion rejects.

---

### 2. [`testing/auth/nextauth-config.test.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/testing/auth/nextauth-config.test.ts)
- **Target Source Code Tested**: [`src/lib/auth.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/src/lib/auth.ts)
- **Total Tests**: **20 tests**

#### Scenarios & Edge Cases Covered:
1. **Credentials Provider (`authorize`)**:
   - **Missing Credentials**: Rejects missing `email` or `password` without DB query.
   - **Email Case Normalization**: Normalizes email input to lowercase during database query.
   - **Non-existent User**: Returns `null` if user not found in DB.
   - **Inactive User**: Returns `null` if `user.isActive: false`.
   - **OAuth-Only User**: Returns `null` if user has no password (`user.password: null`).
   - **Password Comparison Mismatch**: Returns `null` if bcrypt comparison fails.
   - **`rememberMe` Option Variants**:
     - `rememberMe: true` or `"1"`: Returns user with `rememberMe: true`.
     - `rememberMe: false` or omitted: Returns user with `rememberMe: false`.
   - **Database Query Error**: Propagates DB errors during authorize.

2. **Google OAuth Callback (`signIn`)**:
   - **Non-Google Providers**: Directly allowed without DB lookup.
   - **Missing Email in OAuth Profile**: Google sign-in rejected (`false`).
   - **First-Time Google Login**: Auto-creates user with `emailVerified = Date`, `role = "USER"`, and upserts OAuth provider account tokens (`access_token`, `id_token`, `refresh_token`, `expires_at`, `scope`).
   - **Existing Credentials User (Account Linking)**:
     - Detects existing user by email.
     - Does **not** call `prisma.user.create`.
     - Links Google account to existing user ID and preserves existing password.
   - **Missing Optional OAuth Tokens**: Handles responses where `refresh_token`, `expires_at`, `scope`, or `id_token` are missing without crashing.
   - **Inactive Account**: Rejects Google sign-in if existing account has `isActive: false`.
   - **Database Errors**: Safe error propagation if account upsert fails.

3. **JWT Callback (`jwt`)**:
   - **Credentials Login with `rememberMe: true`**: Injects `rememberMe = true` and sets extended 5-day expiration (`SESSION_DURATION_REMEMBER_ME_MS`).
   - **Credentials Login with `rememberMe: false`**: Injects `rememberMe = false` and sets default 1-day expiration (`SESSION_DURATION_DEFAULT_MS`).
   - **Google OAuth Login**: Queries user from DB and attaches `id`, `role`, `email`, and default expiration.
   - **Subsequent Requests**: Preserves existing token payload without redundant DB queries.

4. **Session Callback (`session`)**:
   - Injects `id`, `role`, `rememberMe`, and `sessionExpiresAt` from token into `session.user`.

---

### 3. [`testing/auth/auth-api-routes.test.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/testing/auth/auth-api-routes.test.ts)
- **Target Source Code Tested**: [`src/app/api/auth/*`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/src/app/api/auth)
- **Total Tests**: **19 tests**

#### Scenarios & Edge Cases Covered:
1. **`POST /api/auth/signup`**:
   - Returns `201 Created` with sanitized user on successful registration.
   - Returns `409 Conflict` when email already exists.
   - Returns `500 Internal Server Error` on unexpected service/DB crash.
2. **`POST /api/auth/forgot-password`**:
   - Returns `200 OK` on successful reset email dispatch.
   - Returns `404 Not Found` when email is not registered.
   - Returns `500 Internal Server Error` on unexpected service crash.
3. **`GET /api/auth/reset-password` (Token Validation Endpoint)**:
   - Returns `200 OK` with `{ valid: true }` when query token is valid.
   - Returns `400 Bad Request` when query token is expired or invalid.
   - Returns `500 Internal Server Error` on unexpected service crash.
4. **`POST /api/auth/reset-password` (Password Reset Endpoint)**:
   - Returns `200 OK` on successful password reset.
   - Returns `400 Bad Request` on validation failure or token invalidation.
   - Returns `500 Internal Server Error` on unexpected service crash.
5. **`POST /api/auth/change-password`**:
   - Returns `401 Unauthorized` for unauthenticated requests (`getCurrentUser` returns `null`).
   - Returns `200 OK` on valid password change for authenticated session.
   - Returns `400 Bad Request` when current password is wrong.
   - Returns `500 Internal Server Error` on unexpected service crash.
6. **`GET /api/auth/verify-email`**:
   - Returns `200 OK` on successful email verification.
   - Returns `400 Bad Request` for invalid or expired token.
   - Returns `500 Internal Server Error` on unexpected service crash.

---

### 4. [`testing/auth/auth-middleware.test.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/testing/auth/auth-middleware.test.ts)
- **Target Source Code Tested**: [`src/middleware.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/src/middleware.ts)
- **Total Tests**: **11 tests**

#### Scenarios & Edge Cases Covered:
1. **Unauthenticated Access (No Token / Logged Out)**:
   - Allows public routes (`/`, `/products`, `/login`, `/signup`) with status `200`.
   - Protects and redirects `/admin/*`, `/orders`, and `/cart` to `/login?callbackUrl=...`.
2. **Expired Session Token**:
   - Detects `token.sessionExpiresAt < Date.now()`.
   - Redirects protected routes to `/login?callbackUrl=...`.
   - Clears session cookies via `Set-Cookie` expiration headers.
   - Allows public routes while clearing expired cookies.
3. **Role-Based Access: `ADMIN`**:
   - Allows admin access to `/admin/*` routes.
   - Redirects root `/` or auth pages (`/login`, `/signup`) to `/admin/products`.
4. **Role-Based Access: `USER`**:
   - Blocks regular users from accessing `/admin/*` and redirects to `/`.
   - Redirects `/login` or `/signup` to `/`.
   - Allows access to user protected routes (`/orders`, `/cart`) and public pages (`/`).

---

### 5. [`testing/auth/auth-validation.test.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/testing/auth/auth-validation.test.ts)
- **Target Source Code Tested**: [`src/server/middlewares/auth.middleware.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/src/server/middlewares/auth.middleware.ts) and [`src/lib/validators.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/src/lib/validators.ts)
- **Total Tests**: **24 tests**

#### Scenarios & Edge Cases Covered:
1. **Signup Validation (`validateSignupInput`)**:
   - Full name validation (< 2 characters rejected).
   - Email format validation.
   - Malformed extremely long email strings safely rejected.
   - Safe processing of extremely long valid inputs (5,000+ characters) without server crash.
   - **Password Whitespace Preservation**: Leading and trailing spaces (`" Password123! "`) are preserved without silent trimming.
   - **Password Complexity**:
     - Length < 8 characters rejected.
     - Lacks uppercase letter rejected.
     - Lacks number rejected.
     - Lacks special character rejected.
   - Password confirmation mismatch rejected.
   - Phone formatting: Accepts valid international numbers (e.g. `+1 555-123-4567`) or optional omission; rejects invalid characters / < 10 digits.
2. **Forgot Password Validation (`validateForgotPasswordInput`)**:
   - Valid email accepted; invalid format rejected.
   - Rejects untrimmed space email format in raw schema.
3. **Reset Password Validation (`validateResetPasswordInput`)**:
   - Missing token rejected.
   - Mismatched passwords rejected.
4. **Change Password Validation (`validateChangePasswordInput`)**:
   - Empty current password rejected.
   - Mismatched new password confirmation rejected.
5. **Token Validation (`validateResetTokenInput` & `validateVerificationTokenInput`)**:
   - Valid token string accepted.
   - Automatic trimming of surrounding whitespace.
   - Rejection of `null`, `undefined`, empty string, whitespace-only string, or non-string types.

---

### 6. [`testing/auth/client-auth.service.test.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/testing/auth/client-auth.service.test.ts)
- **Target Source Code Tested**: [`src/services/auth.service.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/src/services/auth.service.ts)
- **Total Tests**: **16 tests**

#### Scenarios & Edge Cases Covered:
1. **`login`**:
   - Calls NextAuth `signIn("credentials", { redirect: false, ... })`.
   - Translates `CredentialsSignin` error code into user-friendly message `"Wrong username password, please enter correct credentials"`.
   - Propagates custom error strings.
2. **`logout`**:
   - Calls NextAuth `signOut({ callbackUrl: "/login" })`.
3. **`signup`**:
   - Sends `POST /api/auth/signup`.
   - Resolves on success; throws API error message or parses multiple validation error messages.
4. **`forgotPassword`**:
   - Sends `POST /api/auth/forgot-password`.
   - Resolves on `200`; throws API error on `404`/`500`.
5. **`resetPassword`**:
   - Sends `POST /api/auth/reset-password`.
   - Resolves on `200`; throws API error on `400`.
6. **`verifyResetToken`**:
   - Sends `GET /api/auth/reset-password?token=...`.
   - Resolves on valid token; throws error on invalid/expired token.

---

### 7. [`testing/auth/server-auth-utils.test.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/testing/auth/server-auth-utils.test.ts)
- **Target Source Code Tested**: [`src/lib/server-auth.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/src/lib/server-auth.ts)
- **Total Tests**: **6 tests**

#### Scenarios & Edge Cases Covered:
1. **`getCurrentUser`**:
   - Returns `null` when `getToken` returns `null`.
   - Returns `null` when token lacks `sub` or `email`.
   - Returns `null` when token has expired (`sessionExpiresAt < Date.now()`).
   - Returns user object (`id`, `name`, `email`, `role`, `rememberMe`) for active tokens.
2. **`isAdmin`**:
   - Returns `true` when user has `role: "ADMIN"`.
   - Returns `false` when user has `role: "USER"` or user is `null`.

---

### 8. [`testing/sanity.test.ts`](file:///Users/hasssaniftikhar/Desktop/Training/Project/ecommerce-app/testing/sanity.test.ts)
- **Target**: Environment, Prisma mock, and auth fixture integrity.
- **Total Tests**: **4 tests**

---

## 🔒 Security & Architectural Analysis

### 1. Rate Limiting & Brute-Force Protection
- **Status in Codebase**: Not currently implemented.
- **Security Recommendation**: Before deploying to production, integrate rate limiting on authentication routes (e.g. max 5 failed attempts per 15 minutes on `/api/auth/signin` and max 3 requests per hour on `/api/auth/forgot-password`) using `@upstash/ratelimit` or Redis sliding window.

### 2. User Enumeration on Forgot Password
- **Status in Codebase**: `/api/auth/forgot-password` returns `404 Not Found` with `"This email does not exist in our Store."` when an email is unregistered.
- **Security Recommendation**: To prevent user enumeration attacks in production, return a generic `200 OK` message (e.g. `"If an account exists with that email, a reset link has been sent."`) regardless of whether the email was found.

### 3. Stateless JWT Multi-Device Session Invalidation
- **Status in Codebase**: NextAuth uses stateless JWT tokens (`strategy: "jwt"`). When a user changes their password on one device, other devices retain valid JWT tokens until `token.sessionExpiresAt` is reached.
- **Security Recommendation**: If immediate global revocation is required upon password change, store a `passwordChangedAt` or `tokenVersion` field on the `User` model and verify it inside NextAuth's `jwt` callback.

---

## 🚀 How to Run the Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npx jest --coverage

# Run specific test suite
npx jest testing/auth/server-auth.service.test.ts

# Run TypeScript type check across test files
npx tsc --noEmit
```
