
export const ROUTES = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  forgotEmail: "/forgot-email",
  resetPassword: "/reset-password",
  cart: "/cart",
  checkout: "/checkout",
  orders: "/orders",
  orderDetail: (orderId: string) => `/orders/${orderId}`,
  paymentStatus: (orderId: string) => `/orders/${orderId}/payment-status`,
  paymentMethods: "/account/payment-methods",
  addresses: "/account/addresses",

  // Admin Routes
  adminProducts: "/admin/products",
  adminAddSingleProduct: "/admin/products/new",
  adminAddMultipleProducts: "/admin/products/bulk",
  adminOrders: "/admin/orders",
  adminOrderDetail: (orderId: string) => `/admin/orders/${orderId}`,
} as const;
