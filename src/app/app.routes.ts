import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { WaitersComponent } from './pages/waiters/waiters.component';
import { ProductsComponent } from './pages/products/products.component';
import { NewOrderComponent } from './pages/new-order/new-order.component';

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
    path: 'new-order',
    component: NewOrderComponent
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  }
];
