import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OpsOrder, OpsOrderItem, PrepStation } from '../../models/order.model';
import { PaymentMethodOption } from '../../services/restaurant.service';
import { OrdersService } from '../../services/orders.service';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-card.component.html',
  styleUrl: './order-card.component.scss'
})
export class OrderCardComponent {
  @Input({ required: true }) order!: OpsOrder;
  @Input() mode: 'kitchen' | 'waiter' | 'delivery' = 'kitchen';
  @Input() stationFilter: 'ALL' | PrepStation = 'ALL';
  @Input() paymentMethodOptions: PaymentMethodOption[] = [];
  /** Configured restaurant suggested tip % (dine-in collect modal). */
  @Input() suggestedTipPercent = 10;
  @Input() restaurantId = '';
  /** Product admin: allow waiter to move dine-in order to another table. */
  @Input() enableTableReassignment = false;
  @Output() statusChange = new EventEmitter<{ orderId: string; newStatus: string }>();
  @Output() collectOrder = new EventEmitter<{ orderId: string; paymentMethod: string; tipMode: 'NONE' | 'SUGGESTED' | 'CUSTOM'; tipAmount?: number }>();
  @Output() addProducts = new EventEmitter<{ orderId: string; tableNumber: number | null }>();
  @Output() itemPreparedChange = new EventEmitter<{ orderId: string; itemId: string; value: boolean }>();
  @Output() itemDeliveredChange = new EventEmitter<{ orderId: string; itemId: string; value: boolean }>();
  @Output() deliveryFeeChange = new EventEmitter<{ orderId: string; deliveryFee: number }>();
  @Output() tableReassigned = new EventEmitter<void>();

  showCollectOptions = signal(false);
  itemsExpanded = signal(false);
  expandedNotes = signal<Set<number>>(new Set());
  tipModalVisible = signal(false);
  pendingCollectMethod = signal<string | null>(null);
  tipManualOpen = signal(false);
  tipManualDraft = signal('');
  collectTipError = signal<string | null>(null);
  tableMoveModalVisible = signal(false);
  tableMoveOptions = signal<{ number: number; token: string }[]>([]);
  tableMoveTarget = signal<number | null>(null);
  tableMoveLoading = signal(false);
  tableMoveError = signal<string | null>(null);

  private readonly MAX_VISIBLE = 4;

  constructor(private readonly ordersService: OrdersService) {}

  get timeAgo(): string {
    const now = Date.now();
    const created = new Date(this.order.createdAt).getTime();
    const diffMs = now - created;
    const mins = Math.floor(diffMs / 60000);

    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m`;
    return `${Math.floor(hrs / 24)}d`;
  }

  get waitingSince(): string {
    if (!this.order.paymentRequestedAt) return '';
    const now = Date.now();
    const requested = new Date(this.order.paymentRequestedAt).getTime();
    const mins = Math.floor((now - requested) / 60000);
    if (mins < 1) return 'Ahora';
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  get orderTypeLabel(): string {
    if (this.order.orderType === 'DINE_IN') return 'Mesa';
    if (this.order.orderType === 'DELIVERY') return 'Delivery';
    return 'Para llevar';
  }

  get tableLabel(): string {
    return this.order.tableNumber != null ? `Mesa ${this.order.tableNumber}` : 'Sin mesa';
  }

  get paymentMethodLabel(): string {
    if (!this.order.paymentMethod) return '';
    return this.order.paymentMethod === 'CASH' ? 'Efectivo' : 'Tarjeta';
  }

  /** Customer finalized tip in app (including $0); waiter must not prompt again. */
  get customerResolvedTip(): boolean {
    return this.order.tipSource === 'CUSTOMER';
  }

  get hasCustomerTip(): boolean {
    return this.customerResolvedTip && (this.order.tipAmount ?? 0) > 0;
  }

  get statusLabel(): string {
    const labels: Record<string, string> = {
      CREATED: 'Nuevo',
      IN_PROGRESS: 'En preparación',
      READY: 'Listo',
      OUT_FOR_DELIVERY: 'En reparto',
      DELIVERED: 'Entregado',
      PAYMENT_PENDING: 'Pago pendiente',
      PAID: 'Pagado',
      CANCELLED: 'Cancelado'
    };
    return labels[this.order.status] ?? this.order.status;
  }

  get nextAction(): { label: string; status: string } | null {
    if (this.mode === 'kitchen') {
      return null;
    } else if (this.mode === 'waiter') {
      switch (this.order.status) {
        case 'READY':           return { label: 'Entregado', status: 'DELIVERED' };
        default:                return null;
      }
    } else {
      switch (this.order.status) {
        case 'CREATED': return { label: 'Enviar a cocina', status: 'IN_PROGRESS' };
        case 'READY': return { label: 'Salir a reparto', status: 'OUT_FOR_DELIVERY' };
        case 'OUT_FOR_DELIVERY': return { label: 'Entregado', status: 'DELIVERED' };
        default: return null;
      }
    }
  }

  get canCancel(): boolean {
    if (this.mode === 'kitchen') {
      return ['CREATED', 'IN_PROGRESS', 'READY'].includes(this.order.status);
    }
    if (this.mode === 'delivery') {
      return ['CREATED', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'PAYMENT_PENDING'].includes(this.order.status);
    }
    return false;
  }

  get showTableMoveBtn(): boolean {
    if (!this.enableTableReassignment || this.mode !== 'waiter') return false;
    if (this.order.orderType !== 'DINE_IN' || this.order.tableNumber == null) return false;
    return !['PAID', 'CANCELLED'].includes(this.order.status);
  }

  get showCollectBtn(): boolean {
    if (this.paymentMethodOptions.length === 0) return false;
    const paymentStatuses = this.order.status === 'DELIVERED' || this.order.status === 'PAYMENT_PENDING';
    return (this.mode === 'waiter' || this.mode === 'delivery') && paymentStatuses;
  }

  get showAddProductsBtn(): boolean {
    return this.mode === 'waiter'
      && this.order.orderType === 'DINE_IN'
      && this.order.tableNumber != null
      && ['CREATED', 'IN_PROGRESS', 'READY', 'DELIVERED'].includes(this.order.status);
  }

  get hasDeliveryInfo(): boolean {
    return this.order.orderType === 'DELIVERY'
      && (!!this.order.deliveryAddress || !!this.order.deliveryPhone || !!this.order.deliveryReference);
  }

  get canEditDeliveryFee(): boolean {
    return this.mode === 'delivery'
      && this.order.orderType === 'DELIVERY'
      && !['PAID', 'CANCELLED'].includes(this.order.status);
  }

  onAdvance() {
    const action = this.nextAction;
    if (action) {
      this.statusChange.emit({ orderId: this.order.orderId, newStatus: action.status });
    }
  }

  onCancel() {
    this.statusChange.emit({ orderId: this.order.orderId, newStatus: 'CANCELLED' });
  }

  onEditDeliveryFee() {
    if (!this.canEditDeliveryFee) return;
    const current = Number(this.order.deliveryFee ?? 0);
    const input = window.prompt('Ingresa el valor del domicilio (sin símbolos).', current.toFixed(0));
    if (input === null) return;
    const normalized = Number(input.replace(',', '.').trim());
    if (Number.isNaN(normalized) || normalized < 0) {
      window.alert('Valor de domicilio inválido. Debe ser un número mayor o igual a 0.');
      return;
    }
    this.deliveryFeeChange.emit({
      orderId: this.order.orderId,
      deliveryFee: normalized
    });
  }

  toggleCollectOptions() {
    this.showCollectOptions.update(v => !v);
  }

  onCollect(method: string) {
    if (this.customerResolvedTip) {
      this.finishCollect(method, 'NONE');
      return;
    }

    // Backend only applies waiter tip for dine-in; skip modal for other types.
    if (this.order.orderType !== 'DINE_IN') {
      this.finishCollect(method, 'NONE');
      return;
    }

    this.pendingCollectMethod.set(method);
    this.tipManualOpen.set(false);
    this.tipManualDraft.set('');
    this.collectTipError.set(null);
    this.tipModalVisible.set(true);
  }

  closeTipModal(): void {
    this.tipModalVisible.set(false);
    this.pendingCollectMethod.set(null);
    this.collectTipError.set(null);
    this.tipManualOpen.set(false);
  }

  chooseTipNone(): void {
    const method = this.pendingCollectMethod();
    if (!method) return;
    this.finishCollect(method, 'NONE');
  }

  chooseTipSuggested(): void {
    const method = this.pendingCollectMethod();
    if (!method) return;
    this.finishCollect(method, 'SUGGESTED');
  }

  toggleTipManual(): void {
    this.tipManualOpen.update((v) => !v);
    this.collectTipError.set(null);
  }

  applyTipManual(): void {
    const method = this.pendingCollectMethod();
    if (!method) return;
    const parsed = Number(this.tipManualDraft().replace(',', '.').trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      this.collectTipError.set('Valor de propina inválido.');
      return;
    }
    this.finishCollect(method, 'CUSTOM', parsed);
  }

  private finishCollect(
    method: string,
    tipMode: 'NONE' | 'SUGGESTED' | 'CUSTOM',
    tipAmount?: number
  ): void {
    this.closeTipModal();
    this.collectOrder.emit({
      orderId: this.order.orderId,
      paymentMethod: method,
      tipMode,
      tipAmount
    });
    this.showCollectOptions.set(false);
  }

  get visiblePaymentMethodOptions(): PaymentMethodOption[] {
    return [...this.paymentMethodOptions].sort((a, b) => a.sort - b.sort);
  }

  onAddProducts() {
    this.addProducts.emit({
      orderId: this.order.orderId,
      tableNumber: this.order.tableNumber
    });
  }

  get filteredItems(): OpsOrderItem[] {
    const items = this.order.items ?? [];
    if (this.stationFilter === 'ALL') return items;
    return items.filter(item => item.prepStation === this.stationFilter);
  }

  get visibleItems(): OpsOrderItem[] {
    const items = [...this.filteredItems].sort((a, b) => Number(a.isPrepared) - Number(b.isPrepared));
    if (this.itemsExpanded() || items.length <= this.MAX_VISIBLE) return items;
    return items.slice(0, this.MAX_VISIBLE);
  }

  get hasMoreItems(): boolean {
    return this.filteredItems.length > this.MAX_VISIBLE;
  }

  get hiddenItemCount(): number {
    return this.filteredItems.length - this.MAX_VISIBLE;
  }

  get filteredItemsCount(): number {
    return this.filteredItems.length;
  }

  toggleItemsExpanded() {
    this.itemsExpanded.update(v => !v);
  }

  get preparedCheckboxesEnabled(): boolean {
    return this.mode === 'kitchen'
      && (this.order.status === 'CREATED' || this.order.status === 'IN_PROGRESS' || this.order.status === 'READY');
  }

  get deliveredCheckboxesEnabled(): boolean {
    return this.mode === 'waiter'
      && (
        this.order.status === 'CREATED'
        || this.order.status === 'IN_PROGRESS'
        || this.order.status === 'READY'
        || this.order.status === 'DELIVERED'
        || this.order.status === 'PAYMENT_PENDING'
      );
  }

  isPrepared(item?: OpsOrderItem): boolean {
    return !!item?.isPrepared;
  }

  isDelivered(item?: OpsOrderItem): boolean {
    return !!item?.isDelivered;
  }

  togglePrepared(item?: OpsOrderItem) {
    if (!item) return;
    this.itemPreparedChange.emit({
      orderId: this.order.orderId,
      itemId: item.itemId,
      value: !item.isPrepared
    });
  }

  toggleDelivered(item?: OpsOrderItem) {
    if (!item) return;
    this.itemDeliveredChange.emit({
      orderId: this.order.orderId,
      itemId: item.itemId,
      value: !item.isDelivered
    });
  }

  shouldShowDoneDivider(index: number, item: OpsOrderItem, items: OpsOrderItem[]): boolean {
    if (this.mode !== 'kitchen' || !item.isPrepared) return false;
    if (index === 0) return true;
    return !items[index - 1]?.isPrepared;
  }

  isNoteExpanded(index: number): boolean {
    return this.expandedNotes().has(index);
  }

  toggleNote(index: number) {
    this.expandedNotes.update(s => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  shouldAllowNoteToggle(note: string | null | undefined): boolean {
    return (note?.trim().length ?? 0) > 80;
  }

  formatMoney(value: number): string {
    const currency = this.order.currency ?? 'COP';
    const locale = currency === 'EUR' ? 'es-ES' : 'es-CO';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  }

  openTableMoveModal(): void {
    if (!this.restaurantId || !this.showTableMoveBtn) return;
    this.tableMoveLoading.set(true);
    this.tableMoveError.set(null);
    this.ordersService.getWaiterTables(this.restaurantId).subscribe({
      next: (list) => {
        this.tableMoveOptions.set(list);
        this.tableMoveTarget.set(null);
        this.tableMoveLoading.set(false);
        this.tableMoveModalVisible.set(true);
      },
      error: () => {
        this.tableMoveLoading.set(false);
        this.tableMoveError.set('No se pudieron cargar las mesas.');
        this.tableMoveModalVisible.set(true);
      }
    });
  }

  closeTableMoveModal(): void {
    this.tableMoveModalVisible.set(false);
    this.tableMoveError.set(null);
  }

  onTableMoveSelect(event: Event): void {
    const v = (event.target as HTMLSelectElement).value;
    this.tableMoveTarget.set(v === '' ? null : Number(v));
  }

  confirmTableMove(): void {
    const n = this.tableMoveTarget();
    if (n == null || !this.restaurantId) return;
    this.tableMoveLoading.set(true);
    this.tableMoveError.set(null);
    this.ordersService.reassignOrderTable(this.order.orderId, n).subscribe({
      next: () => {
        this.tableMoveLoading.set(false);
        this.tableMoveModalVisible.set(false);
        this.tableReassigned.emit();
      },
      error: (err) => {
        this.tableMoveLoading.set(false);
        const raw = err?.error?.error;
        this.tableMoveError.set(
          typeof raw === 'string' ? raw : 'No se pudo mover la cuenta. Verifica que la mesa destino esté libre.'
        );
      }
    });
  }

  viewInvoice() {
    const invoicePath = `/invoice/${this.order.orderId}`;
    const origin = window.location.origin;
    // In Docker both apps share the same origin; in dev the customer app is on port 4200
    const url = origin.includes(':4201')
      ? origin.replace(':4201', ':4200') + invoicePath
      : invoicePath;
    window.open(url, '_blank');
  }
}
