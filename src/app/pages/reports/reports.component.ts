import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReportsService } from '../../services/reports.service';
import { RestaurantService } from '../../services/restaurant.service';
import { AuthService } from '../../services/auth.service';
import { ProductSalesSummary, SalesSummary, SalesSummaryBasis, SalesSummaryPeriod } from '../../models/report.model';

interface PeriodTab {
  label: string;
  value: SalesSummaryPeriod;
}

interface BasisTab {
  label: string;
  value: SalesSummaryBasis;
}

type ReportView = 'orders' | 'products';

interface ViewTab {
  label: string;
  value: ReportView;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss'
})
export class ReportsComponent implements OnInit {
  restaurantId = '';
  restaurantName = signal('');
  loading = signal(true);
  error = signal<string | null>(null);
  selectedPeriod = signal<SalesSummaryPeriod>('day');
  selectedBasis = signal<SalesSummaryBasis>('paid');
  selectedView = signal<ReportView>('orders');
  anchorDate = signal(this.currentLocalDateIso());
  summary = signal<SalesSummary | null>(null);
  productSummary = signal<ProductSalesSummary | null>(null);

  periodTabs: PeriodTab[] = [
    { label: 'Día', value: 'day' },
    { label: 'Semana', value: 'week' },
    { label: 'Mes', value: 'month' }
  ];

  basisTabs: BasisTab[] = [
    { label: 'Ventas cobradas', value: 'paid' },
    { label: 'Valor de comandas', value: 'orders' }
  ];

  viewTabs: ViewTab[] = [
    { label: 'Por órdenes', value: 'orders' },
    { label: 'Por producto', value: 'products' }
  ];

  constructor(
    private route: ActivatedRoute,
    private reportsService: ReportsService,
    private restaurantService: RestaurantService,
    private authService: AuthService
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

    this.fetchSummary();
  }

  setPeriod(period: SalesSummaryPeriod): void {
    if (this.selectedPeriod() === period || this.loading()) return;
    this.selectedPeriod.set(period);
    this.fetchSummary();
  }

  setBasis(basis: SalesSummaryBasis): void {
    if (this.selectedBasis() === basis || this.loading()) return;
    this.selectedBasis.set(basis);
    this.fetchSummary();
  }

  setView(view: ReportView): void {
    this.selectedView.set(view);
  }

  goToPreviousPeriod(): void {
    this.anchorDate.set(this.shiftPeriod(this.anchorDate(), this.selectedPeriod(), -1));
    this.fetchSummary();
  }

  goToNextPeriod(): void {
    if (!this.canGoNext()) return;
    this.anchorDate.set(this.shiftPeriod(this.anchorDate(), this.selectedPeriod(), 1));
    this.fetchSummary();
  }

  canGoNext(): boolean {
    const today = this.currentLocalDateIso();
    const currentStart = this.periodStartIso(today, this.selectedPeriod());
    const selectedStart = this.periodStartIso(this.anchorDate(), this.selectedPeriod());
    return selectedStart < currentStart;
  }

  periodLabel(): string {
    const anchor = this.parseIsoDate(this.anchorDate());
    if (this.selectedPeriod() === 'day') {
      return anchor.toLocaleDateString('es-CO');
    }
    if (this.selectedPeriod() === 'week') {
      const start = this.periodStartDate(anchor, 'week');
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return `${start.toLocaleDateString('es-CO')} - ${end.toLocaleDateString('es-CO')}`;
    }
    return anchor.toLocaleDateString('es-CO', { year: 'numeric', month: 'long' });
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 2
    }).format(value);
  }

  formatUtcRange(isoDate: string): string {
    return new Date(isoDate).toLocaleString('es-CO', { timeZone: 'UTC' }) + ' UTC';
  }

  formatPaymentMethod(methodLabel: string | null, methodCode: string | null): string {
    if (methodLabel?.trim()) return methodLabel;
    if (methodCode?.trim()) return methodCode;
    return 'N/A';
  }

  trackByOrderId(_index: number, item: { orderId: string }): string {
    return item.orderId;
  }

  trackByProductId(_index: number, item: { productId: string }): string {
    return item.productId;
  }

  private fetchSummary(): void {
    if (!this.restaurantId) return;
    this.loading.set(true);
    this.reportsService.getSalesSummary(this.restaurantId, this.selectedPeriod(), this.selectedBasis(), this.anchorDate()).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.reportsService.getProductSalesSummary(
          this.restaurantId,
          this.selectedPeriod(),
          this.selectedBasis(),
          this.anchorDate()
        ).subscribe({
          next: (productSummary) => {
            this.productSummary.set(productSummary);
            this.error.set(null);
            this.loading.set(false);
          },
          error: () => {
            this.error.set('No se pudo cargar el resumen por producto.');
            this.loading.set(false);
          }
        });
      },
      error: () => {
        this.error.set('No se pudo cargar el resumen de ventas.');
        this.loading.set(false);
      }
    });
  }

  private shiftPeriod(anchorIso: string, period: SalesSummaryPeriod, direction: -1 | 1): string {
    const date = this.parseIsoDate(anchorIso);
    if (period === 'day') {
      date.setDate(date.getDate() + direction);
    } else if (period === 'week') {
      date.setDate(date.getDate() + (7 * direction));
    } else {
      date.setMonth(date.getMonth() + direction);
    }
    return this.toIsoDate(date);
  }

  private periodStartIso(anchorIso: string, period: SalesSummaryPeriod): string {
    const start = this.periodStartDate(this.parseIsoDate(anchorIso), period);
    return this.toIsoDate(start);
  }

  private periodStartDate(date: Date, period: SalesSummaryPeriod): Date {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (period === 'day') return start;
    if (period === 'week') {
      const day = start.getDay();
      const daysFromMonday = (day + 6) % 7;
      start.setDate(start.getDate() - daysFromMonday);
      return start;
    }
    start.setDate(1);
    return start;
  }

  private parseIsoDate(isoDate: string): Date {
    const [y, m, d] = isoDate.split('-').map(v => Number(v));
    return new Date(y, (m || 1) - 1, d || 1);
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private currentLocalDateIso(): string {
    return this.toIsoDate(new Date());
  }
}

