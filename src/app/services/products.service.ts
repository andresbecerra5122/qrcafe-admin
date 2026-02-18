import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OpsProduct } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getProducts(restaurantId: string): Observable<OpsProduct[]> {
    return this.http.get<OpsProduct[]>(
      `${this.baseUrl}/ops/products?restaurantId=${restaurantId}`
    );
  }

  toggleAvailability(productId: string, isAvailable: boolean): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/ops/products/${productId}/availability`,
      { isAvailable }
    );
  }
}
