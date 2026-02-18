import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { WaiterCall } from '../models/waiter-call.model';

@Injectable({ providedIn: 'root' })
export class WaiterCallsService {
  private baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getCalls(restaurantId: string, status?: string): Observable<WaiterCall[]> {
    let url = `${this.baseUrl}/ops/waiter-calls?restaurantId=${restaurantId}`;
    if (status) {
      url += `&status=${status}`;
    }
    return this.http.get<WaiterCall[]>(url);
  }

  attend(callId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/ops/waiter-calls/${callId}/attend`, {});
  }
}
