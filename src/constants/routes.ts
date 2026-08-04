// Central route map. Every <Link> / redirect in the app should import
// from here instead of hardcoding strings, so if a route ever moves
// (e.g. "/login" -> "/auth/login") there is exactly one place to change it.
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  forgotEmail: "/forgot-email",
  resetPassword: "/reset-password",
  cart: "/cart",
  orders: "/orders",
  orderDetail: (orderId: string) => `/orders/${orderId}`,

  // Admin Routes
  adminProducts: "/admin/products",
  adminAddSingleProduct: "/admin/products/new",
  adminAddMultipleProducts: "/admin/products/bulk",
  adminOrders: "/admin/orders",
  adminOrderDetail: (orderId: string) => `/admin/orders/${orderId}`,
} as const;
