// import { getToken } from "next-auth/jwt";
// import type { NextRequest } from "next/server";
// import type { Role } from "@prisma/client";

// const secret = process.env.NEXTAUTH_SECRET;

// export type AuthToken = {
//   id?: string;
//   sub?: string;
//   email?: string;
//   role?: Role;
// };

// export async function getCurrentUser(
//   request: Request | NextRequest
// ): Promise<AuthToken | null> {
//   const token = (await getToken({
//     req: request as unknown as NextRequest,
//     secret,
//   })) as AuthToken | null;

//   if (!token?.sub || !token?.email) {
//     return null;
//   }
//   return token;
// }

// export function isAdmin(user: AuthToken | null): boolean {
//   return Boolean(user?.role === "ADMIN");
// }



import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

import { isSessionExpired } from "@/constants";

const secret = process.env.NEXTAUTH_SECRET;

export type AuthToken = {
  id?: string;
  sub?: string;
  email?: string;
  role?: Role;
  rememberMe?: boolean;
  sessionExpiresAt?: number;
};

export async function getCurrentUser(
  request: Request | NextRequest
): Promise<AuthToken | null> {
  const token = (await getToken({
    req: request as unknown as NextRequest,
    secret,
  })) as AuthToken | null;

  /*
   * No valid JWT.
   */
  if (!token?.sub || !token?.email) {
    return null;
  }

  /*
   * Application-level session expiration.
   *
   * The NextAuth cookie can still exist for up to 5 days,
   * but our custom session expiration determines whether
   * the user is actually authenticated.
   */
  if (isSessionExpired(token.sessionExpiresAt)) {
    return null;
  }

  return token;
}

export function isAdmin(user: AuthToken | null): boolean {
  return user?.role === "ADMIN";
}