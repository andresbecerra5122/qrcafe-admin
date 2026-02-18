import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrdersService } from '../../services/orders.service';
import { RestaurantService } from '../../services/restaurant.service';
import { OpsOrder } from '../../models/order.model';
import { OrderCardComponent } from '../../components/order-card/order-card.component';

interface FilterTab {
  label: string;
  value: string;
  statusCsv: string | null;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, OrderCardComponent, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit, OnDestroy {
  restaurantId = '';
  restaurantName = signal('');
  orders = signal<OpsOrder[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  activeFilter = signal<string>('ACTIVE');

  filters: FilterTab[] = [
    { label: 'Activos',        value: 'ACTIVE',       statusCsv: 'CREATED,IN_PROGRESS,READY' },
    { label: 'Nuevos',         value: 'CREATED',      statusCsv: 'CREATED' },
    { label: 'En preparación', value: 'IN_PROGRESS',  statusCsv: 'IN_PROGRESS' },
    { label: 'Listos',         value: 'READY',        statusCsv: 'READY' },
    { label: 'Entregados',     value: 'DELIVERED',    statusCsv: 'DELIVERED' },
    { label: 'Todos',          value: 'ALL',            statusCsv: null },
  ];

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private ordersService: OrdersService,
    private restaurantService: RestaurantService
  ) {}

  ngOnInit() {
    this.restaurantId = this.route.snapshot.queryParamMap.get('restaurantId') ?? '';

    if (!this.restaurantId) {
      this.error.set('Falta el parámetro restaurantId. Ejemplo: /dashboard?restaurantId=...');
      this.loading.set(false);
      return;
    }

    this.restaurantService.getInfo(this.restaurantId).subscribe({
      next: (info) => this.restaurantName.set(info.name)
    });

    this.fetchOrders();
    this.pollTimer = setInterval(() => this.fetchOrders(), 10_000);
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  setFilter(value: string) {
    this.activeFilter.set(value);
    this.fetchOrders();
  }

  fetchOrders() {
    if (!this.restaurantId) return;

    const filter = this.filters.find(f => f.value === this.activeFilter());
    const statusCsv = filter?.statusCsv ?? undefined;

    this.ordersService.getOrders(this.restaurantId, statusCsv).subscribe({
      next: (list) => {
        this.orders.set(list);
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        if (this.loading()) {
          this.error.set('No se pudieron cargar las órdenes');
          this.loading.set(false);
        }
      }
    });
  }

  onStatusChange(event: { orderId: string; newStatus: string }) {
    this.ordersService.updateStatus(event.orderId, event.newStatus).subscribe({
      next: () => this.fetchOrders(),
      error: (err) => {
        console.error('Failed to update status', err);
      }
    });
  }

  get orderCount(): number {
    return this.orders().length;
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
