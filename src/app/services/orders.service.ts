import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OpsOrder } from '../models/order.model';

export interface CreateOpsOrderRequest {
  restaurantId: string;
  orderType?: string;
  tableNumber?: number;
  customerName?: string;
  notes?: string;
  deliveryAddress?: string;
  deliveryReference?: string;
  deliveryPhone?: string;
  items: { productId: string; qty: number; notes?: string }[];
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getOrders(restaurantId: string, statusFilter?: string, orderTypeFilter?: string): Observable<OpsOrder[]> {
    let url = `${this.baseUrl}/ops/orders?restaurantId=${restaurantId}`;
    if (statusFilter) {
      url += `&status=${statusFilter}`;
    }
    if (orderTypeFilter) {
      url += `&orderType=${orderTypeFilter}`;
    }
    return this.http.get<OpsOrder[]>(url);
  }

  createOrder(body: CreateOpsOrderRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/ops/orders`, body);
  }

  updateStatus(orderId: string, status: string): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/ops/orders/${orderId}/status`,
      { status }
    );
  }

  setDeliveryFee(orderId: string, deliveryFee: number): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/ops/orders/${orderId}/delivery-fee`,
      { deliveryFee }
    );
  }

  collectOrder(orderId: string, paymentMethod: string, tipMode?: 'NONE' | 'SUGGESTED' | 'CUSTOM', tipAmount?: number): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/ops/orders/${orderId}/collect`,
      { paymentMethod, tipMode: tipMode ?? 'NONE', tipAmount: tipAmount ?? null }
    );
  }

  updateItemPrepared(orderId: string, itemId: string, value: boolean): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/ops/orders/${orderId}/items/${itemId}/prepared`,
      { value }
    );
  }

  updateItemDelivered(orderId: string, itemId: string, value: boolean): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/ops/orders/${orderId}/items/${itemId}/delivered`,
      { value }
    );
  }

  getWaiterTables(restaurantId: string): Observable<{ number: number; token: string }[]> {
    return this.http.get<{ number: number; token: string }[]>(
      `${this.baseUrl}/ops/waiter-tables?restaurantId=${restaurantId}`
    );
  }

  reassignOrderTable(orderId: string, tableNumber: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/ops/orders/${orderId}/table`, { tableNumber });
  }
}
