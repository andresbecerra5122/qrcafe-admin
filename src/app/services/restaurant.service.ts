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
}
