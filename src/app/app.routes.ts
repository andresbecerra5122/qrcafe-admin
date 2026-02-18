import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { WaitersComponent } from './pages/waiters/waiters.component';
import { ProductsComponent } from './pages/products/products.component';

export const routes: Routes = [
  {
    path: 'dashboard',
    component: DashboardComponent
  },
  {
    path: 'waiters',
    component: WaitersComponent
  },
  {
    path: 'products',
    component: ProductsComponent
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
