import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RestaurantInfo {
  id: string;
  name: string;
  currency: string;
  enableDineIn: boolean;
  enableDelivery: boolean;
  enableDeliveryCash: boolean;
  enableDeliveryCard: boolean;
  enablePayAtCashier: boolean;
  enableKitchenBarSplit: boolean;
  enableTableReassignment: boolean;
  avgPreparationMinutes: number;
  suggestedTipPercent: number;
  paymentMethods: PaymentMethodOption[];
}

export interface PaymentMethodOption {
  id: string;
  code: string;
  label: string;
  sort: number;
}

@Injectable({ providedIn: 'root' })
export class RestaurantService {
  private baseUrl = environment.apiBaseUrl;
  private cache = new Map<string, RestaurantInfo>();

  constructor(private http: HttpClient) {}

  getInfo(restaurantId: string): Observable<RestaurantInfo> {
    const cached = this.cache.get(restaurantId);
    if (cached) return of(cached);

    return this.http
      .get<RestaurantInfo>(`${this.baseUrl}/ops/restaurant?restaurantId=${restaurantId}`)
      .pipe(tap(info => this.cache.set(restaurantId, info)));
  }

  updateSettings(
    restaurantId: string,
    payload: {
      enableDineIn?: boolean;
      enableDelivery?: boolean;
      enableDeliveryCash?: boolean;
      enableDeliveryCard?: boolean;
      enablePayAtCashier?: boolean;
      enableKitchenBarSplit?: boolean;
      enableTableReassignment?: boolean;
      avgPreparationMinutes?: number;
      suggestedTipPercent?: number;
    }
  ): Observable<RestaurantInfo> {
    return this.http
      .patch<RestaurantInfo>(`${this.baseUrl}/ops/restaurant/settings?restaurantId=${restaurantId}`, payload)
      .pipe(tap(info => {
        const current = this.cache.get(restaurantId);
        if (current) {
          this.cache.set(restaurantId, { ...current, ...info });
        }
      }));
  }

  getPaymentMethods(restaurantId: string): Observable<PaymentMethodOption[]> {
    return this.http.get<PaymentMethodOption[]>(
      `${this.baseUrl}/ops/restaurant/payment-methods?restaurantId=${restaurantId}`
    ).pipe(tap(methods => {
      const current = this.cache.get(restaurantId);
      if (current) {
        this.cache.set(restaurantId, { ...current, paymentMethods: methods });
      }
    }));
  }

  addPaymentMethod(restaurantId: string, label: string): Observable<PaymentMethodOption> {
    return this.http.post<PaymentMethodOption>(
      `${this.baseUrl}/ops/restaurant/payment-methods?restaurantId=${restaurantId}`,
      { label }
    ).pipe(tap(item => {
      const current = this.cache.get(restaurantId);
      if (current) {
        const next = [...(current.paymentMethods ?? []), item].sort((a, b) => a.sort - b.sort);
        this.cache.set(restaurantId, { ...current, paymentMethods: next });
      }
    }));
  }

  deletePaymentMethod(restaurantId: string, methodId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/ops/restaurant/payment-methods/${methodId}?restaurantId=${restaurantId}`
    ).pipe(tap(() => {
      const current = this.cache.get(restaurantId);
      if (current) {
        this.cache.set(restaurantId, {
          ...current,
          paymentMethods: (current.paymentMethods ?? []).filter(x => x.id !== methodId)
        });
      }
    }));
  }
}
