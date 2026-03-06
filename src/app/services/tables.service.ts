import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { OpsTable } from '../models/table.model';

@Injectable({ providedIn: 'root' })
export class TablesService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getTables(restaurantId: string): Observable<OpsTable[]> {
    return this.http.get<OpsTable[]>(
      `${this.baseUrl}/ops/tables?restaurantId=${restaurantId}`
    );
  }
}
