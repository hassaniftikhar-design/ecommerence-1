export interface OrderListItem {
  id: string;
  date: string;
  orderNumber: string;
  user: string;
  productsCount: number;
  amount: number;
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
  products: OrderProductLine[];
}
