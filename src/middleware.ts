
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isSessionExpired } from "@/constants";

const secret = process.env.NEXTAUTH_SECRET;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret,
  });

  const isAuthPage =
    pathname === "/login" || pathname === "/signup";

  const isProtectedRoute =
    pathname.startsWith("/admin") ||
    pathname.startsWith("/orders") ||
    //pathname.startsWith("/profile") ||
    pathname.startsWith("/cart");


  if (!token) {
    if (isProtectedRoute) {
      const loginUrl = new URL("/login", request.url);

      loginUrl.searchParams.set(
        "callbackUrl",
        pathname
      );

      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }


  if (isSessionExpired(token.sessionExpiresAt)) {
    const response = isProtectedRoute
      ? NextResponse.redirect(
        new URL(
          `/login?callbackUrl=${encodeURIComponent(pathname)}`,
          request.url
        )
      )
      : NextResponse.next();


    response.cookies.delete("next-auth.session-token");


    response.cookies.delete("__Secure-next-auth.session-token");

    return response;
  }


  if (token.role === "ADMIN") {
    if (pathname === "/") {
      return NextResponse.redirect(
        new URL("/admin/products", request.url)
      );
    }

    if (isAuthPage) {
      return NextResponse.redirect(
        new URL("/admin/products", request.url)
      );
    }
  }


  if (token.role !== "ADMIN" && isAuthPage) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }


  if (
    pathname.startsWith("/admin") &&
    token.role !== "ADMIN"
  ) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/orders/:path*",
    // "/profile/:path*",
    "/cart/:path*",
    "/login",
    "/signup",
  ],

};