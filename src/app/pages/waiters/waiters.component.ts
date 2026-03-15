import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { OrdersService } from '../../services/orders.service';
import { WaiterCallsService } from '../../services/waiter-calls.service';
import { RestaurantService } from '../../services/restaurant.service';
import { AuthService } from '../../services/auth.service';
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
  waiterAlert = signal<string | null>(null);
  private readonly orderTypeFilter = 'DINE_IN,TAKEAWAY';

  filters: FilterTab[] = [
    { label: 'Activos',     value: 'ACTIVE',          statusCsv: 'CREATED,IN_PROGRESS,READY,DELIVERED,PAYMENT_PENDING' },
    { label: 'Por cobrar',  value: 'PAYMENT_PENDING', statusCsv: 'PAYMENT_PENDING' },
    { label: 'Entregados',  value: 'DELIVERED',       statusCsv: 'DELIVERED' },
    { label: 'En cocina',   value: 'KITCHEN',         statusCsv: 'CREATED,IN_PROGRESS,READY' },
    { label: 'Cobrados',    value: 'PAID',            statusCsv: 'PAID' },
    { label: 'Todos',       value: 'ALL',             statusCsv: null },
  ];

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private preparedItemIds = new Set<string>();
  private preparedAlertInitialized = false;
  private paymentPendingOrderIds = new Set<string>();
  private paymentPendingAlertInitialized = false;
  private alertTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private ordersService: OrdersService,
    private waiterCallsService: WaiterCallsService,
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
    this.checkReadyAlerts();
  }

  fetchOrders() {
    if (!this.restaurantId) return;

    const filter = this.filters.find(f => f.value === this.activeFilter());
    const statusCsv = filter?.statusCsv ?? undefined;

    this.ordersService.getOrders(this.restaurantId, statusCsv, this.orderTypeFilter).subscribe({
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

  onItemDeliveredChange(event: { orderId: string; itemId: string; value: boolean }) {
    this.ordersService.updateItemDelivered(event.orderId, event.itemId, event.value).subscribe({
      next: () => this.fetchOrders(),
      error: (err) => console.error('Failed to update item delivered state', err)
    });
  }

  onAddProducts(event: { orderId: string; tableNumber: number | null }) {
    this.router.navigate(['/new-order'], {
      queryParams: {
        restaurantId: this.restaurantId,
        tableNumber: event.tableNumber ?? undefined,
        orderId: event.orderId
      }
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

  logout(): void {
    this.authService.logout();
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
    if (this.alertTimer) {
      clearTimeout(this.alertTimer);
      this.alertTimer = null;
    }
  }

  private checkReadyAlerts(): void {
    this.ordersService.getOrders(this.restaurantId, 'CREATED,IN_PROGRESS,READY,DELIVERED,PAYMENT_PENDING', this.orderTypeFilter).subscribe({
      next: (orders) => {
        const nextSet = new Set<string>();
        for (const order of orders) {
          for (const item of order.items ?? []) {
            if (item.isPrepared) {
              nextSet.add(item.itemId);
            }
          }
        }

        if (!this.preparedAlertInitialized) {
          this.preparedItemIds = nextSet;
          this.preparedAlertInitialized = true;
          return;
        }

        const hasNewPreparedItems = Array.from(nextSet).some(itemId => !this.preparedItemIds.has(itemId));
        this.preparedItemIds = nextSet;

        if (hasNewPreparedItems) {
          this.showWaiterAlert('Hay productos listos para entregar');
          this.playAlertTone();
        }
      }
    });

    this.ordersService.getOrders(this.restaurantId, 'PAYMENT_PENDING', this.orderTypeFilter).subscribe({
      next: (paymentPendingOrders) => {
        const nextSet = new Set(paymentPendingOrders.map(o => o.orderId));
        if (!this.paymentPendingAlertInitialized) {
          this.paymentPendingOrderIds = nextSet;
          this.paymentPendingAlertInitialized = true;
          return;
        }

        const hasNewPaymentPending = paymentPendingOrders.some(o => !this.paymentPendingOrderIds.has(o.orderId));
        this.paymentPendingOrderIds = nextSet;

        if (hasNewPaymentPending) {
          this.showWaiterAlert('Solicitud de pago recibida');
          this.playAlertTone();
        }
      }
    });
  }

  private showWaiterAlert(message: string): void {
    this.waiterAlert.set(message);
    if (this.alertTimer) {
      clearTimeout(this.alertTimer);
    }
    this.alertTimer = setTimeout(() => this.waiterAlert.set(null), 4500);
  }

  private playAlertTone(): void {
    try {
      const AudioContextCtor = window.AudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046, ctx.currentTime);
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
