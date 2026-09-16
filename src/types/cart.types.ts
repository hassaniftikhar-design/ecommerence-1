export interface CartItemColor {
  name: string;
  hex?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string | null;
  name: string;
  imageUrl: string;
  color?: CartItemColor | string;
  size?: string;
  price: number;
  quantity: number;
  stock?: number;
  isActive?: boolean;
  isVariantDeleted?: boolean;
  totalPrice: number;
}

export interface CartTotals {
  subTotal: number;
  tax: number;
  total: number;
}
