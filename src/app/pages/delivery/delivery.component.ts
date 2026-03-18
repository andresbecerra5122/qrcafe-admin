import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrdersService } from '../../services/orders.service';
import { RestaurantService } from '../../services/restaurant.service';
import { AuthService } from '../../services/auth.service';
import { OpsOrder } from '../../models/order.model';
import { OrderCardComponent } from '../../components/order-card/order-card.component';

interface FilterTab {
  label: string;
  value: string;
  statusCsv: string | null;
}

@Component({
  selector: 'app-delivery',
  standalone: true,
  imports: [CommonModule, RouterLink, OrderCardComponent],
  templateUrl: './delivery.component.html',
  styleUrl: './delivery.component.scss'
})
export class DeliveryComponent implements OnInit, OnDestroy {
  restaurantId = '';
  restaurantName = signal('');
  orders = signal<OpsOrder[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  activeFilter = signal<string>('ACTIVE');

  filters: FilterTab[] = [
    { label: 'Activos', value: 'ACTIVE', statusCsv: 'CREATED,IN_PROGRESS,READY,OUT_FOR_DELIVERY,DELIVERED,PAYMENT_PENDING' },
    { label: 'Por confirmar', value: 'CREATED', statusCsv: 'CREATED' },
    { label: 'En cocina', value: 'IN_PROGRESS', statusCsv: 'IN_PROGRESS' },
    { label: 'Listos', value: 'READY', statusCsv: 'READY' },
    { label: 'En reparto', value: 'OUT_FOR_DELIVERY', statusCsv: 'OUT_FOR_DELIVERY' },
    { label: 'Entregados', value: 'DELIVERED', statusCsv: 'DELIVERED' },
    { label: 'Por cobrar', value: 'PAYMENT_PENDING', statusCsv: 'PAYMENT_PENDING' },
    { label: 'Pagados', value: 'PAID', statusCsv: 'PAID' },
    { label: 'Todos', value: 'ALL', statusCsv: null }
  ];

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly ordersService: OrdersService,
    private readonly restaurantService: RestaurantService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    const routeRestaurantId = this.route.snapshot.queryParamMap.get('restaurantId');
    this.restaurantId = this.authService.enforceRestaurantContext(routeRestaurantId);
    if (!this.restaurantId) {
      this.error.set('No tienes permiso para acceder a este restaurante.');
      this.loading.set(false);
      return;
    }

    this.restaurantService.getInfo(this.restaurantId).subscribe({
      next: (info) => this.restaurantName.set(info.name)
    });

    this.fetchOrders();
    this.pollTimer = setInterval(() => this.fetchOrders(), 10_000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  setFilter(value: string): void {
    this.activeFilter.set(value);
    this.fetchOrders();
  }

  fetchOrders(): void {
    if (!this.restaurantId) return;
    const filter = this.filters.find((f) => f.value === this.activeFilter());
    const statusCsv = filter?.statusCsv ?? undefined;
    this.ordersService.getOrders(this.restaurantId, statusCsv, 'DELIVERY').subscribe({
      next: (list) => {
        this.orders.set(list);
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        if (this.loading()) {
          this.error.set('No se pudieron cargar las órdenes de delivery.');
          this.loading.set(false);
        }
      }
    });
  }

  onStatusChange(event: { orderId: string; newStatus: string }): void {
    this.ordersService.updateStatus(event.orderId, event.newStatus).subscribe({
      next: () => this.fetchOrders()
    });
  }

  onDeliveryFeeChange(event: { orderId: string; deliveryFee: number }): void {
    this.ordersService.setDeliveryFee(event.orderId, event.deliveryFee).subscribe({
      next: () => this.fetchOrders()
    });
  }

  trackByOrderId(_index: number, order: OpsOrder): string {
    return order.orderId;
  }

  logout(): void {
    this.authService.logout();
  }
}
