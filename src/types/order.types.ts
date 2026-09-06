import type { PaymentStatus } from './payment.types';

export type OrderStatusType = 'IN_PROGRESS' | 'DISPATCHED' | 'DELIVERED' | 'REJECTED';

export interface OrderListItem {
  id: string;
  date: string;
  orderNumber: string;
  user: string;
  productsCount: number;
  amount: number;
  status: OrderStatusType;
  paymentStatus?: PaymentStatus | null;
  paymentMethod?: string;
}

export interface OrderProductLine {
  id: string;
  productId?: string;
  variantId?: string | null;
  title: string;
  imageUrl: string;
  price: number;
  quantity: number;
  stock: number;
  color?: string;
  size?: string;
}

export interface OrderPaymentSummary {
  id: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  paidAt?: string | null;
  errorMessage?: string | null;
}

export interface OrderDetail extends OrderListItem {
  subTotal: number;
  tax: number;
  totalAmount: number;
  shippingAddress?: string | null;
  paymentMethod?: string;
  products: OrderProductLine[];
  payment?: OrderPaymentSummary | null;
}
