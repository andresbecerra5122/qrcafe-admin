export interface OpsOrder {
  orderId: string;
  orderType: string;
  tableNumber: number | null;
  customerName: string | null;
  status: string;
  paymentMethod: string | null;
  paymentRequestedAt: string | null;
  currency: string;
  total: number;
  createdAt: string;
}
