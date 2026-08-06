export type OrderStatusType = "IN_PROGRESS" | "DISPATCHED" | "DELIVERED" | "REJECTED";

export interface OrderListItem {
  id: string;
  date: string;
  orderNumber: string;
  user: string;
  productsCount: number;
  amount: number;
  status: OrderStatusType;
}

export interface OrderProductLine {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  quantity: number;
  stock: number;
}

export interface OrderDetail extends OrderListItem {
  subTotal: number;
  tax: number;
  totalAmount: number;
  products: OrderProductLine[];
}
