import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RestaurantInfo {
  id: string;
  name: string;
  currency: string;
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
}
