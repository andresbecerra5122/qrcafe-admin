import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { StaffUser } from '../models/staff-user.model';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  getAll(): Observable<StaffUser[]> {
    return this.http.get<StaffUser[]>(`${this.baseUrl}/ops/staff`);
  }

  create(payload: {
    fullName: string;
    email: string;
    password: string;
    role: string;
  }): Observable<StaffUser> {
    return this.http.post<StaffUser>(`${this.baseUrl}/ops/staff`, payload);
  }

  update(staffId: string, payload: {
    fullName?: string;
    password?: string;
    role?: string;
    isActive?: boolean;
  }): Observable<StaffUser> {
    return this.http.patch<StaffUser>(`${this.baseUrl}/ops/staff/${staffId}`, payload);
  }

  changeMyPassword(payload: {
    currentPassword: string;
    newPassword: string;
  }): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/ops/staff/me/password`, payload);
  }
}
