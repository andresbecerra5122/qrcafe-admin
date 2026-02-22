import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrdersService } from '../../services/orders.service';
import { WaiterCallsService } from '../../services/waiter-calls.service';
import { RestaurantService } from '../../services/restaurant.service';
import { OpsOrder } from '../../models/order.model';
import { WaiterCall } from '../../models/waiter-call.model';
import { OrderCardComponent } from '../../components/order-card/order-card.component';

interface FilterTab {
  label: string;
  value: string;
  statusCsv: string | null;
}

@Component({
  selector: 'app-waiters',
  standalone: true,
  imports: [CommonModule, OrderCardComponent, RouterLink],
  templateUrl: './waiters.component.html',
  styleUrl: './waiters.component.scss'
})
export class WaitersComponent implements OnInit, OnDestroy {
  restaurantId = '';
  restaurantName = signal('');
  orders = signal<OpsOrder[]>([]);
  waiterCalls = signal<WaiterCall[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  activeFilter = signal<string>('ACTIVE');

  filters: FilterTab[] = [
    { label: 'Activos',     value: 'ACTIVE',          statusCsv: 'CREATED,IN_PROGRESS,READY,DELIVERED,PAYMENT_PENDING' },
    { label: 'Por cobrar',  value: 'PAYMENT_PENDING', statusCsv: 'PAYMENT_PENDING' },
    { label: 'Entregados',  value: 'DELIVERED',       statusCsv: 'DELIVERED' },
    { label: 'En cocina',   value: 'KITCHEN',         statusCsv: 'CREATED,IN_PROGRESS,READY' },
    { label: 'Cobrados',    value: 'PAID',            statusCsv: 'PAID' },
    { label: 'Todos',       value: 'ALL',             statusCsv: null },
  ];

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private route: ActivatedRoute,
    private ordersService: OrdersService,
    private waiterCallsService: WaiterCallsService,
    private restaurantService: RestaurantService
  ) {}

  ngOnInit() {
    this.restaurantId = this.route.snapshot.queryParamMap.get('restaurantId') ?? '';

    if (!this.restaurantId) {
      this.error.set('Falta el parámetro restaurantId. Ejemplo: /waiters?restaurantId=...');
      this.loading.set(false);
      return;
    }

    this.restaurantService.getInfo(this.restaurantId).subscribe({
      next: (info) => this.restaurantName.set(info.name)
    });

    this.fetchAll();
    this.pollTimer = setInterval(() => this.fetchAll(), 10_000);
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  setFilter(value: string) {
    this.activeFilter.set(value);
    this.fetchOrders();
  }

  fetchAll() {
    this.fetchOrders();
    this.fetchWaiterCalls();
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

  fetchWaiterCalls() {
    if (!this.restaurantId) return;

    this.waiterCallsService.getCalls(this.restaurantId, 'PENDING').subscribe({
      next: (calls) => this.waiterCalls.set(calls),
      error: () => {}
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

  onCollect(event: { orderId: string; paymentMethod: string }) {
    this.ordersService.collectOrder(event.orderId, event.paymentMethod).subscribe({
      next: () => this.fetchOrders(),
      error: (err) => console.error('Failed to collect order', err)
    });
  }

  attendCall(callId: string) {
    this.waiterCallsService.attend(callId).subscribe({
      next: () => this.fetchWaiterCalls(),
      error: (err) => console.error('Failed to attend call', err)
    });
  }

  trackByOrderId(_index: number, order: OpsOrder): string {
    return order.orderId;
  }

  get orderCount(): number {
    return this.orders().length;
  }

  get pendingCallCount(): number {
    return this.waiterCalls().length;
  }

  timeAgoFromDate(dateStr: string): string {
    const now = Date.now();
    const created = new Date(dateStr).getTime();
    const mins = Math.floor((now - created) / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m`;
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
