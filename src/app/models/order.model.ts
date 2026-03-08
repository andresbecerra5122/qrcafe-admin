export interface OpsOrderItem {
  productName: string;
  qty: number;
  notes: string | null;
}

export interface OpsOrder {
  orderId: string;
  orderType: string;
  tableNumber: number | null;
  customerName: string | null;
  deliveryAddress: string | null;
  deliveryReference: string | null;
  deliveryPhone: string | null;
  status: string;
  paymentMethod: string | null;
  paymentRequestedAt: string | null;
  currency: string;
  total: number;
  createdAt: string;
  items: OpsOrderItem[];
}
