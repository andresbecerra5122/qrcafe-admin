import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { OrdersService } from '../../services/orders.service';
import { RestaurantService } from '../../services/restaurant.service';
import { AuthService } from '../../services/auth.service';
import { OpsOrder, PrepStation } from '../../models/order.model';
import { OrderCardComponent } from '../../components/order-card/order-card.component';

interface FilterTab {
  label: string;
  value: string;
  statusCsv: string | null;
}

type StationFilterValue = 'ALL' | PrepStation;

interface StationFilterTab {
  label: string;
  value: StationFilterValue;
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
  stationFilter = signal<StationFilterValue>('ALL');
  enableDineIn = signal(true);
  enableDelivery = signal(false);
  enableKitchenBarSplit = signal(false);
  kitchenAlert = signal<string | null>(null);

  filters: FilterTab[] = [
    { label: 'Activos',        value: 'ACTIVE',       statusCsv: 'CREATED,IN_PROGRESS,READY' },
    { label: 'Nuevos',         value: 'CREATED',      statusCsv: 'CREATED' },
    { label: 'En preparación', value: 'IN_PROGRESS',  statusCsv: 'IN_PROGRESS' },
    { label: 'Listos',         value: 'READY',        statusCsv: 'READY' },
    { label: 'Entregados',     value: 'DELIVERED',    statusCsv: 'DELIVERED' },
    { label: 'Todos',          value: 'ALL',            statusCsv: null },
  ];

  stationFilters: StationFilterTab[] = [
    { label: 'Todas', value: 'ALL' },
    { label: 'Cocina', value: 'KITCHEN' },
    { label: 'Barra', value: 'BAR' }
  ];

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private kitchenItemIds = new Set<string>();
  private kitchenItemsAlertInitialized = false;
  private alertTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private ordersService: OrdersService,
    private restaurantService: RestaurantService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const routeRestaurantId = this.route.snapshot.queryParamMap.get('restaurantId');
    this.restaurantId = this.authService.enforceRestaurantContext(routeRestaurantId);

    if (!this.restaurantId) {
      this.error.set('No tienes permiso para acceder a este restaurante.');
      this.loading.set(false);
      return;
    }

    this.restaurantService.getInfo(this.restaurantId).subscribe({
      next: (info) => {
        this.restaurantName.set(info.name);
        this.enableDineIn.set(info.enableDineIn);
        this.enableDelivery.set(info.enableDelivery);
        this.enableKitchenBarSplit.set(info.enableKitchenBarSplit);
        if (!info.enableKitchenBarSplit) {
          this.stationFilter.set('ALL');
        }
      }
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

  setStationFilter(value: StationFilterValue): void {
    this.stationFilter.set(value);
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
        this.checkKitchenAlerts();
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

  onItemPreparedChange(event: { orderId: string; itemId: string; value: boolean }) {
    this.ordersService.updateItemPrepared(event.orderId, event.itemId, event.value).subscribe({
      next: () => this.fetchOrders(),
      error: (err) => console.error('Failed to update item prepared state', err)
    });
  }

  trackByOrderId(_index: number, order: OpsOrder): string {
    return order.orderId;
  }

  get orderCount(): number {
    return this.visibleOrders.length;
  }

  get visibleOrders(): OpsOrder[] {
    return this.orders().filter(o => this.hasItemsForActiveStation(o));
  }

  get canFilterByStation(): boolean {
    return this.enableKitchenBarSplit();
  }

  get activeStationFilter(): StationFilterValue {
    return this.canFilterByStation ? this.stationFilter() : 'ALL';
  }

  hasItemsForActiveStation(order: OpsOrder): boolean {
    const filter = this.activeStationFilter;
    if (filter === 'ALL') return true;
    return (order.items ?? []).some(item => item.prepStation === filter);
  }

  canManageStaff(): boolean {
    return this.authService.hasAnyRole(['admin', 'manager']);
  }

  canManageProducts(): boolean {
    return this.authService.hasAnyRole(['admin', 'manager']);
  }

  canAccessReports(): boolean {
    return this.authService.hasAnyRole(['admin', 'manager']);
  }

  canControlAvailability(): boolean {
    return this.authService.hasAnyRole(['kitchen', 'admin', 'manager']);
  }

  canAccessWaiters(): boolean {
    return this.enableDineIn() && this.authService.hasAnyRole(['waiter', 'admin', 'manager']);
  }

  canAccessDelivery(): boolean {
    return this.enableDelivery() && this.authService.hasAnyRole(['delivery', 'admin', 'manager']);
  }

  logout(): void {
    this.authService.logout();
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.alertTimer) {
      clearTimeout(this.alertTimer);
      this.alertTimer = null;
    }
  }

  private checkKitchenAlerts(): void {
    this.ordersService.getOrders(this.restaurantId, 'CREATED,IN_PROGRESS,READY').subscribe({
      next: (activeOrders) => {
        const nextSet = new Set<string>();
        for (const order of activeOrders) {
          for (const item of order.items ?? []) {
            nextSet.add(item.itemId);
          }
        }

        if (!this.kitchenItemsAlertInitialized) {
          this.kitchenItemIds = nextSet;
          this.kitchenItemsAlertInitialized = true;
          return;
        }

        const hasNewItems = Array.from(nextSet).some(itemId => !this.kitchenItemIds.has(itemId));
        this.kitchenItemIds = nextSet;

        if (hasNewItems) {
          this.showKitchenAlert('Nuevos productos en cocina/barra');
          this.playAlertTone();
        }
      }
    });
  }

  private showKitchenAlert(message: string): void {
    this.kitchenAlert.set(message);
    if (this.alertTimer) {
      clearTimeout(this.alertTimer);
    }
    this.alertTimer = setTimeout(() => this.kitchenAlert.set(null), 4500);
  }

  private playAlertTone(): void {
    try {
      const AudioContextCtor = window.AudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      osc.onended = () => void ctx.close();
    } catch {
      // Ignore sound errors (browser autoplay or device restrictions).
    }
  }
}
