import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data?.['roles'] as string[] | undefined) ?? [];

  if (allowedRoles.length === 0 || auth.hasAnyRole(allowedRoles)) {
    return true;
  }

  if (auth.hasAnyRole(['superadmin'])) {
    return router.createUrlTree(['/platform/onboarding']);
  }

  const restaurantId = auth.getRestaurantId();
  return router.createUrlTree(['/dashboard'], {
    queryParams: restaurantId ? { restaurantId } : {}
  });
};
