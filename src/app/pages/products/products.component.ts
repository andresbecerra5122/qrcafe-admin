import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductsService } from '../../services/products.service';
import { RestaurantService } from '../../services/restaurant.service';
import { TablesService } from '../../services/tables.service';
import { AuthService } from '../../services/auth.service';
import { OpsProduct } from '../../models/product.model';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
  restaurantId = '';
  adminPanel = false;
  restaurantName = signal('');
  products = signal<OpsProduct[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  togglingId = signal<string | null>(null);
  saving = signal(false);
  settingsSaving = signal(false);
  deletingId = signal<string | null>(null);
  editingId = signal<string | null>(null);
  enableDineIn = signal(true);
  enableDelivery = signal(false);
  enableDeliveryCash = signal(true);
  enableDeliveryCard = signal(true);
  activeTablesCount = signal(0);
  desiredTablesCount = signal<number | null>(null);
  tablesSaving = signal(false);
  tablesError = signal<string | null>(null);

  newName = '';
  newDescription = '';
  newCategory = '';
  newPrice = 0;
  newSort = 0;
  newImageUrl = '';
  newAvailable = true;

  editName = '';
  editDescription = '';
  editCategory = '';
  editPrice = 0;
  editSort = 0;
  editImageUrl = '';
  editAvailable = true;

  constructor(
    private route: ActivatedRoute,
    private productsService: ProductsService,
    private restaurantService: RestaurantService,
    private tablesService: TablesService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.adminPanel = this.route.snapshot.data['adminPanel'] === true;
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
        this.enableDeliveryCash.set(info.enableDeliveryCash);
        this.enableDeliveryCard.set(info.enableDeliveryCard);
      }
    });

    this.fetchProducts();
    if (this.canManageSettings()) {
      this.fetchTablesCount();
    }
  }

  fetchProducts() {
    this.productsService.getProducts(this.restaurantId, this.adminPanel).subscribe({
      next: (list) => {
        this.products.set(list);
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        this.error.set('No se pudieron cargar los productos');
        this.loading.set(false);
      }
    });
  }

  toggleAvailability(product: OpsProduct) {
    if (this.togglingId() || this.saving()) return;

    this.togglingId.set(product.id);
    if (this.adminPanel) {
      const newVisibility = !product.isActive;
      this.productsService.updateProduct(product.id, { isActive: newVisibility }).subscribe({
        next: () => {
          this.products.update(list =>
            list.map(p => p.id === product.id ? { ...p, isActive: newVisibility } : p)
          );
          this.togglingId.set(null);
        },
        error: () => {
          this.togglingId.set(null);
        }
      });
      return;
    }

    const newValue = !product.isAvailable;
    this.productsService.toggleAvailability(product.id, newValue).subscribe({
      next: () => {
        this.products.update(list =>
          list.map(p => p.id === product.id ? { ...p, isAvailable: newValue } : p)
        );
        this.togglingId.set(null);
      },
      error: () => {
        this.togglingId.set(null);
      }
    });
  }

  createProduct() {
    if (!this.adminPanel) return;
    if (this.saving()) return;

    const name = this.newName.trim();
    if (!name) return;

    this.saving.set(true);
    this.productsService.createProduct({
      name,
      description: this.newDescription.trim() || null,
      categoryName: this.newCategory.trim() || null,
      price: this.newPrice,
      sort: this.newSort,
      imageUrl: this.newImageUrl.trim() || null,
      isAvailable: this.newAvailable
    }).subscribe({
      next: () => {
        this.resetCreateForm();
        this.saving.set(false);
        this.fetchProducts();
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }

  startEdit(product: OpsProduct) {
    if (!this.adminPanel) return;
    this.editingId.set(product.id);
    this.editName = product.name;
    this.editDescription = product.description ?? '';
    this.editCategory = product.categoryName ?? '';
    this.editPrice = product.price;
    this.editSort = product.sort;
    this.editImageUrl = product.imageUrl ?? '';
    this.editAvailable = product.isAvailable;
  }

  cancelEdit() {
    this.editingId.set(null);
  }

  saveEdit(productId: string) {
    if (!this.adminPanel) return;
    if (this.saving()) return;

    const name = this.editName.trim();
    if (!name) return;

    this.saving.set(true);
    this.productsService.updateProduct(productId, {
      name,
      description: this.editDescription.trim() || null,
      categoryName: this.editCategory.trim() || null,
      price: this.editPrice,
      sort: this.editSort,
      imageUrl: this.editImageUrl.trim() || null,
      isAvailable: this.editAvailable
    }).subscribe({
      next: () => {
        this.editingId.set(null);
        this.saving.set(false);
        this.fetchProducts();
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }

  deleteProduct(product: OpsProduct) {
    if (!this.adminPanel) return;
    if (this.saving()) return;

    const ok = confirm(`Eliminar "${product.name}" del listado activo?`);
    if (!ok) return;

    this.deletingId.set(product.id);
    this.productsService.deleteProduct(product.id).subscribe({
      next: () => {
        this.deletingId.set(null);
        this.fetchProducts();
      },
      error: () => {
        this.deletingId.set(null);
      }
    });
  }

  get availableCount(): number {
    return this.products().filter(p => p.isAvailable).length;
  }

  get totalCount(): number {
    return this.products().length;
  }

  get groupedProducts(): { category: string; items: OpsProduct[] }[] {
    const map = new Map<string, OpsProduct[]>();
    for (const p of this.products()) {
      const key = p.categoryName ?? 'Sin categoría';
      const arr = map.get(key) ?? [];
      arr.push(p);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  }

  formatPrice(price: number): string {
    return price.toLocaleString('es-CO', { minimumFractionDigits: 0 });
  }

  panelTitle(): string {
    return this.adminPanel ? 'Administración' : 'Disponibilidad';
  }

  isToggleOn(product: OpsProduct): boolean {
    return this.adminPanel ? product.isActive : product.isAvailable;
  }

  toggleLabel(product: OpsProduct): string {
    if (this.adminPanel) {
      return product.isActive ? 'Visible en menu' : 'Oculto del menu';
    }

    return product.isAvailable ? 'Disponible' : 'No disponible';
  }

  canManageSettings(): boolean {
    return this.adminPanel && this.authService.hasAnyRole(['admin', 'manager']);
  }

  onToggleDineIn(nextValue: boolean): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;

    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { enableDineIn: nextValue }).subscribe({
      next: (info) => {
        this.enableDineIn.set(info.enableDineIn);
        this.enableDelivery.set(info.enableDelivery);
        this.enableDeliveryCash.set(info.enableDeliveryCash);
        this.enableDeliveryCard.set(info.enableDeliveryCard);
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  onTablesCountInput(value: unknown): void {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed)) {
      this.desiredTablesCount.set(null);
      return;
    }

    const normalized = Math.max(0, Math.min(200, parsed));
    this.desiredTablesCount.set(normalized);
  }

  saveTablesCount(): void {
    if (!this.canManageSettings() || this.tablesSaving()) return;
    const nextCount = this.desiredTablesCount();
    if (nextCount == null) return;
    if (nextCount === this.activeTablesCount()) return;

    this.tablesSaving.set(true);
    this.tablesError.set(null);
    this.tablesService.updateActiveCount(this.restaurantId, nextCount).subscribe({
      next: (res) => {
        this.activeTablesCount.set(res.activeCount);
        this.desiredTablesCount.set(res.activeCount);
        this.tablesSaving.set(false);
      },
      error: (err) => {
        this.tablesSaving.set(false);
        this.tablesError.set(
          err?.error?.detail
          ?? err?.error?.error
          ?? 'No se pudo actualizar la cantidad de mesas.'
        );
      }
    });
  }

  onToggleDelivery(nextValue: boolean): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;

    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { enableDelivery: nextValue }).subscribe({
      next: (info) => {
        this.enableDineIn.set(info.enableDineIn);
        this.enableDelivery.set(info.enableDelivery);
        this.enableDeliveryCash.set(info.enableDeliveryCash);
        this.enableDeliveryCard.set(info.enableDeliveryCard);
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  onToggleDeliveryCash(nextValue: boolean): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;
    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { enableDeliveryCash: nextValue }).subscribe({
      next: (info) => {
        this.enableDineIn.set(info.enableDineIn);
        this.enableDelivery.set(info.enableDelivery);
        this.enableDeliveryCash.set(info.enableDeliveryCash);
        this.enableDeliveryCard.set(info.enableDeliveryCard);
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  onToggleDeliveryCard(nextValue: boolean): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;
    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { enableDeliveryCard: nextValue }).subscribe({
      next: (info) => {
        this.enableDineIn.set(info.enableDineIn);
        this.enableDelivery.set(info.enableDelivery);
        this.enableDeliveryCash.set(info.enableDeliveryCash);
        this.enableDeliveryCard.set(info.enableDeliveryCard);
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  private fetchTablesCount(): void {
    this.tablesError.set(null);
    this.tablesService.getTables(this.restaurantId).subscribe({
      next: (tables) => {
        this.activeTablesCount.set(tables.length);
        this.desiredTablesCount.set(tables.length);
      },
      error: () => {
        this.tablesError.set('No se pudo cargar la cantidad de mesas activas.');
      }
    });
  }

  private resetCreateForm() {
    this.newName = '';
    this.newDescription = '';
    this.newCategory = '';
    this.newPrice = 0;
    this.newSort = 0;
    this.newImageUrl = '';
    this.newAvailable = true;
  }
}
