import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.getToken();

  const shouldAttachToken =
    req.url.startsWith(environment.apiBaseUrl) ||
    req.url.startsWith('/api/');

  const request = shouldAttachToken && token
    ? req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    })
    : req;

  return next(request).pipe(
    catchError((err) => {
      if (err?.status === 401) {
        auth.logout(false);
        router.navigate(['/login']);
      }

      return throwError(() => err);
    })
  );
};
