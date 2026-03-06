import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, map, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthUser, LoginResponse } from '../models/auth.model';

interface AuthSession {
  token: string;
  user: AuthUser;
}

interface JwtPayload {
  exp?: number;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly storageKey = 'qrcafe_admin_auth';
  private readonly session$ = new BehaviorSubject<AuthSession | null>(null);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router
  ) {
    this.restoreSession();
  }

  login(email: string, password: string): Observable<AuthUser> {
    return this.http
      .post<LoginResponse>(`${this.baseUrl}/ops/auth/login`, { email, password })
      .pipe(
        tap((response) => {
          this.setSession({
            token: response.accessToken,
            user: response.user
          });
        }),
        map((response) => response.user)
      );
  }

  logout(navigate = true): void {
    localStorage.removeItem(this.storageKey);
    this.session$.next(null);

    if (navigate) {
      this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    return this.session$.value?.token ?? null;
  }

  getCurrentUser(): AuthUser | null {
    return this.session$.value?.user ?? null;
  }

  getRestaurantId(): string {
    return this.session$.value?.user.restaurantId ?? '';
  }

  getRole(): string {
    return (this.session$.value?.user.role ?? '').toLowerCase();
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  hasAnyRole(roles: string[]): boolean {
    const currentRole = this.getRole();
    return roles.some((role) => role.toLowerCase() === currentRole);
  }

  enforceRestaurantContext(routeRestaurantId: string | null): string {
    const tokenRestaurantId = this.getRestaurantId();
    if (!tokenRestaurantId) {
      return '';
    }

    if (routeRestaurantId && routeRestaurantId !== tokenRestaurantId) {
      return '';
    }

    return routeRestaurantId || tokenRestaurantId;
  }

  private setSession(session: AuthSession): void {
    localStorage.setItem(this.storageKey, JSON.stringify(session));
    this.session$.next(session);
  }

  private restoreSession(): void {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw) as AuthSession;
      if (!parsed?.token || !parsed?.user) {
        this.logout(false);
        return;
      }

      if (this.isExpired(parsed.token)) {
        this.logout(false);
        return;
      }

      this.session$.next(parsed);
    } catch {
      this.logout(false);
    }
  }

  private isExpired(token: string): boolean {
    const payload = this.decodePayload(token);
    if (!payload?.exp) {
      return true;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowSeconds;
  }

  private decodePayload(token: string): JwtPayload | null {
    const chunks = token.split('.');
    if (chunks.length !== 3) {
      return null;
    }

    try {
      const base64 = chunks[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
      const json = atob(padded);
      return JSON.parse(json) as JwtPayload;
    } catch {
      return null;
    }
  }
}
