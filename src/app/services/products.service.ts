import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OpsProduct } from '../models/product.model';

export interface CreateProductRequest {
  name: string;
  description?: string | null;
  categoryName?: string | null;
  price: number;
  imageUrl?: string | null;
  sort: number;
  isAvailable: boolean;
}

export interface UpdateProductRequest {
  name?: string;
  description?: string | null;
  categoryName?: string | null;
  price?: number;
  imageUrl?: string | null;
  sort?: number;
  isAvailable?: boolean;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getProducts(restaurantId: string, includeInactive = false): Observable<OpsProduct[]> {
    return this.http.get<OpsProduct[]>(
      `${this.baseUrl}/ops/products?restaurantId=${restaurantId}&includeInactive=${includeInactive}`
    );
  }

  toggleAvailability(productId: string, isAvailable: boolean): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/ops/products/${productId}/availability`,
      { isAvailable }
    );
  }

  createProduct(body: CreateProductRequest): Observable<OpsProduct> {
    return this.http.post<OpsProduct>(`${this.baseUrl}/ops/products`, body);
  }

  updateProduct(productId: string, body: UpdateProductRequest): Observable<OpsProduct> {
    return this.http.patch<OpsProduct>(`${this.baseUrl}/ops/products/${productId}`, body);
  }

  deleteProduct(productId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/ops/products/${productId}`);
  }
}
