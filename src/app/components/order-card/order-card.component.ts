import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OpsOrder, OpsOrderItem } from '../../models/order.model';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-card.component.html',
  styleUrl: './order-card.component.scss'
})
export class OrderCardComponent {
  @Input({ required: true }) order!: OpsOrder;
  @Input() mode: 'kitchen' | 'waiter' = 'kitchen';
  @Output() statusChange = new EventEmitter<{ orderId: string; newStatus: string }>();
  @Output() collectOrder = new EventEmitter<{ orderId: string; paymentMethod: string }>();

  showCollectOptions = signal(false);
  itemsExpanded = signal(false);
  checkedItems = signal<Set<number>>(new Set());

  private readonly MAX_VISIBLE = 4;

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
    return this.order.orderType === 'DINE_IN' ? 'Mesa' : 'Para llevar';
  }

  get tableLabel(): string {
    return this.order.tableNumber != null ? `Mesa ${this.order.tableNumber}` : 'Sin mesa';
  }

  get paymentMethodLabel(): string {
    if (!this.order.paymentMethod) return '';
    return this.order.paymentMethod === 'CASH' ? 'Efectivo' : 'Tarjeta';
  }

  get statusLabel(): string {
    const labels: Record<string, string> = {
      CREATED: 'Nuevo',
      IN_PROGRESS: 'En preparación',
      READY: 'Listo',
      DELIVERED: 'Entregado',
      PAYMENT_PENDING: 'Pago pendiente',
      PAID: 'Pagado',
      CANCELLED: 'Cancelado'
    };
    return labels[this.order.status] ?? this.order.status;
  }

  get nextAction(): { label: string; status: string } | null {
    if (this.mode === 'kitchen') {
      switch (this.order.status) {
        case 'CREATED':      return { label: 'Preparar', status: 'IN_PROGRESS' };
        case 'IN_PROGRESS':  return { label: 'Listo', status: 'READY' };
        default:             return null;
      }
    } else {
      switch (this.order.status) {
        case 'READY':           return { label: 'Entregado', status: 'DELIVERED' };
        case 'PAYMENT_PENDING': return { label: 'Cobrado', status: 'PAID' };
        default:                return null;
      }
    }
  }

  get canCancel(): boolean {
    if (this.mode === 'kitchen') {
      return ['CREATED', 'IN_PROGRESS', 'READY'].includes(this.order.status);
    }
    return false;
  }

  get showCollectBtn(): boolean {
    return this.mode === 'waiter' && this.order.status === 'DELIVERED';
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

  toggleCollectOptions() {
    this.showCollectOptions.update(v => !v);
  }

  onCollect(method: string) {
    this.collectOrder.emit({ orderId: this.order.orderId, paymentMethod: method });
    this.showCollectOptions.set(false);
  }

  get visibleItems(): OpsOrderItem[] {
    const items = this.order.items ?? [];
    if (this.itemsExpanded() || items.length <= this.MAX_VISIBLE) return items;
    return items.slice(0, this.MAX_VISIBLE);
  }

  get hasMoreItems(): boolean {
    return (this.order.items?.length ?? 0) > this.MAX_VISIBLE;
  }

  get hiddenItemCount(): number {
    return (this.order.items?.length ?? 0) - this.MAX_VISIBLE;
  }

  toggleItemsExpanded() {
    this.itemsExpanded.update(v => !v);
  }

  get checkboxesEnabled(): boolean {
    return this.mode === 'kitchen'
      && (this.order.status === 'IN_PROGRESS' || this.order.status === 'READY');
  }

  isChecked(index: number): boolean {
    return this.checkedItems().has(index);
  }

  toggleCheck(index: number) {
    this.checkedItems.update(s => {
      const next = new Set(s);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  formatMoney(value: number): string {
    const currency = this.order.currency ?? 'COP';
    const locale = currency === 'EUR' ? 'es-ES' : 'es-CO';
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
  }
}
