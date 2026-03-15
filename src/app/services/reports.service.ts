import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ProductSalesSummary, SalesSummary, SalesSummaryBasis, SalesSummaryPeriod } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getSalesSummary(
    restaurantId: string,
    period: SalesSummaryPeriod,
    basis: SalesSummaryBasis,
    anchorDate: string
  ): Observable<SalesSummary> {
    return this.http.get<SalesSummary>(
      `${this.baseUrl}/ops/reports/sales-summary?restaurantId=${restaurantId}&period=${period}&basis=${basis}&anchorDate=${anchorDate}`
    );
  }

  getProductSalesSummary(
    restaurantId: string,
    period: SalesSummaryPeriod,
    basis: SalesSummaryBasis,
    anchorDate: string
  ): Observable<ProductSalesSummary> {
    return this.http.get<ProductSalesSummary>(
      `${this.baseUrl}/ops/reports/product-sales-summary?restaurantId=${restaurantId}&period=${period}&basis=${basis}&anchorDate=${anchorDate}`
    );
  }
}

