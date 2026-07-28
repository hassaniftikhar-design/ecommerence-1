export interface CartItemColor {
  name: string;
  /** Swatch dot color -- product data, not a design token, so it's a
   * raw hex per item rather than a Tailwind class. */
  hex: string;
}

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  imageUrl: string;
  color: CartItemColor;
  size: string;
  price: number;
  quantity: number;
}

export interface CartTotals {
  subTotal: number;
  tax: number;
  total: number;
}
