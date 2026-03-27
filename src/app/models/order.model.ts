export type PrepStation = 'KITCHEN' | 'BAR';

export interface OpsOrderItem {
  itemId: string;
  productName: string;
  qty: number;
  notes: string | null;
  prepStation: PrepStation;
  isPrepared: boolean;
  isDelivered: boolean;
  isDone: boolean;
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
  deliveryFee: number;
  tipAmount: number;
  tipSource: string | null;
  total: number;
  createdAt: string;
  items: OpsOrderItem[];
}
