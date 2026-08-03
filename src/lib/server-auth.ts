import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import type { Role } from "@prisma/client";

const secret = process.env.NEXTAUTH_SECRET;

export type AuthToken = {
  id?: string;
  sub?: string;
  email?: string;
  role?: Role;
};

export async function getCurrentUser(
  request: Request | NextRequest
): Promise<AuthToken | null> {
  const token = (await getToken({
    req: request as unknown as NextRequest,
    secret,
  })) as AuthToken | null;

  if (!token?.sub || !token?.email) {
    return null;
  }
  return token;
}

export function isAdmin(user: AuthToken | null): boolean {
  return Boolean(user?.role === "ADMIN");
}
