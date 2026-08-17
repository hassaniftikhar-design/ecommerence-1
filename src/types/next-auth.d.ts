import { Role } from "@prisma/client";
import { DefaultSession } from "next-auth";
import { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    name: string;
    email: string;
    role: Role;
    rememberMe?: boolean;
    sessionExpiresAt?: number;
  }

  interface Session {
    user: {
      id: string;
      role: Role;
      rememberMe?: boolean;
      sessionExpiresAt?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    role?: Role;
    rememberMe?: boolean;
    sessionExpiresAt?: number;
  }
} 