import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { roleGuard } from './guards/role.guard';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { WaitersComponent } from './pages/waiters/waiters.component';
import { ProductsComponent } from './pages/products/products.component';
import { NewOrderComponent } from './pages/new-order/new-order.component';
import { QrCodesComponent } from './pages/qr-codes/qr-codes.component';
import { LoginComponent } from './pages/login/login.component';
import { StaffComponent } from './pages/staff/staff.component';
import { DeliveryComponent } from './pages/delivery/delivery.component';
import { PlatformOnboardingComponent } from './pages/platform-onboarding/platform-onboarding.component';
import { ReportsComponent } from './pages/reports/reports.component';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['kitchen', 'admin', 'manager'] }
  },
  {
    path: 'waiters',
    component: WaitersComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['waiter', 'admin', 'manager'] }
  },
  {
    path: 'delivery',
    component: DeliveryComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['delivery', 'admin', 'manager'] }
  },
  {
    path: 'products',
    component: ProductsComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['kitchen', 'admin', 'manager'], adminPanel: false }
  },
  {
    path: 'products-admin',
    component: ProductsComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'manager'], adminPanel: true }
  },
  {
    path: 'new-order',
    component: NewOrderComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['kitchen', 'waiter', 'admin', 'manager'] }
  },
  {
    path: 'qr-codes',
    component: QrCodesComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'manager'] }
  },
  {
    path: 'staff',
    component: StaffComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'manager'] }
  },
  {
    path: 'reports',
    component: ReportsComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['admin', 'manager'] }
  },
  {
    path: 'platform/onboarding',
    component: PlatformOnboardingComponent,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['superadmin'] }
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: 'login'
  }
];
