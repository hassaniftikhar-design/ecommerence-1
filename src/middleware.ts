// import { withAuth } from "next-auth/middleware";
// import { NextResponse } from "next/server";

// export default withAuth(
//   function middleware(req) {
//     const token = req.nextauth.token;
//     const pathname = req.nextUrl.pathname;

//     // Redirect logged-in admin away from home page or auth pages to admin products
//     if (token && token.role === "ADMIN") {
//       if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
//         return NextResponse.redirect(new URL("/admin/products", req.url));
//       }
//     } else if (token && (pathname === "/login" || pathname === "/signup")) {
//       return NextResponse.redirect(new URL("/", req.url));
//     }

//     // Admin routes protection
//     if (pathname.startsWith("/admin")) {
//       if (token?.role !== "ADMIN") {
//         return NextResponse.redirect(new URL("/", req.url));
//       }
//     }

//     return NextResponse.next();
//   },
//   {
//     callbacks: {
//       authorized: ({ token, req }) => {
//         const pathname = req.nextUrl.pathname;
//         if (pathname.startsWith("/admin") || pathname.startsWith("/orders") || pathname.startsWith("/profile")) {
//           return Boolean(token);
//         }
//         return true;
//       },
//     },
//     pages: {
//       signIn: "/login",
//     },
//   }
// );

// export const config = {
//   matcher: ["/", "/admin/:path*", "/orders/:path*", "/profile/:path*", "/login", "/signup"],
// };







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

  /*
   * No authentication cookie/token.
   */
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

  /*
   * Token exists, but our custom session has expired.
   *
   * IMPORTANT:
   * Remove the NextAuth cookie so the browser becomes
   * completely unauthenticated.
   */
  if (isSessionExpired(token.sessionExpiresAt)) {
    const response = isProtectedRoute
      ? NextResponse.redirect(
        new URL(
          `/login?callbackUrl=${encodeURIComponent(pathname)}`,
          request.url
        )
      )
      : NextResponse.next();

    /*
     * Development cookie.
     */
    response.cookies.delete("next-auth.session-token");

    /*
     * Production NextAuth cookie.
     */
    response.cookies.delete("__Secure-next-auth.session-token");

    return response;
  }

  /*
   * ADMIN users.
   */
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

  /*
   * Normal authenticated users.
   */
  if (token.role !== "ADMIN" && isAuthPage) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  /*
   * ADMIN routes require ADMIN role.
   */
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