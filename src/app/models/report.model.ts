export type SalesSummaryPeriod = 'day' | 'week' | 'month';
export type SalesSummaryBasis = 'paid' | 'orders';

export interface PaymentMethodSummary {
  amount: number;
  ordersCount: number;
}

export interface SalesSummaryOrderItem {
  orderId: string;
  orderNumber: number;
  total: number;
  paymentMethod: string | null;
  occurredAtUtc: string;
}

export interface ProductSalesSummaryItem {
  productId: string;
  productName: string;
  qtySold: number;
  revenue: number;
}

export interface SalesSummary {
  period: SalesSummaryPeriod;
  basis: SalesSummaryBasis;
  timeZone: string;
  rangeStartUtc: string;
  rangeEndUtc: string;
  paidOrdersCount: number;
  totalSales: number;
  averageTicket: number;
  cash: PaymentMethodSummary;
  card: PaymentMethodSummary;
  orders: SalesSummaryOrderItem[];
}

export interface ProductSalesSummary {
  period: SalesSummaryPeriod;
  basis: SalesSummaryBasis;
  timeZone: string;
  rangeStartUtc: string;
  rangeEndUtc: string;
  totalItemsSold: number;
  totalRevenue: number;
  products: ProductSalesSummaryItem[];
}

