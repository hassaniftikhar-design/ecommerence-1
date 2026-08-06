import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Redirect logged-in admin away from home page or auth pages to admin products
    if (token && token.role === "ADMIN") {
      if (pathname === "/" || pathname === "/login" || pathname === "/signup") {
        return NextResponse.redirect(new URL("/admin/products", req.url));
      }
    } else if (token && (pathname === "/login" || pathname === "/signup")) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    // Admin routes protection
    if (pathname.startsWith("/admin")) {
      if (token?.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        if (pathname.startsWith("/admin") || pathname.startsWith("/orders") || pathname.startsWith("/profile")) {
          return Boolean(token);
        }
        return true;
      },
    },
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: ["/", "/admin/:path*", "/orders/:path*", "/profile/:path*", "/login", "/signup"],
};
