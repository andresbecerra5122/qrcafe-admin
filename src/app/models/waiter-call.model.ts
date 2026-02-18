export interface WaiterCall {
  id: string;
  tableNumber: number | null;
  status: string;
  createdAt: string;
  attendedAt: string | null;
}
