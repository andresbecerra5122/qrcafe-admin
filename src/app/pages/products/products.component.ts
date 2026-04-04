import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CreateProductRequest, ProductsService } from '../../services/products.service';
import { PaymentMethodOption, RestaurantInfo, RestaurantService } from '../../services/restaurant.service';
import { TablesService } from '../../services/tables.service';
import { AuthService } from '../../services/auth.service';
import { OpsProduct } from '../../models/product.model';
import { forkJoin } from 'rxjs';

interface ProductGroup {
  category: string;
  rawCategoryName: string | null;
  categoryPrepStation: string;
  items: OpsProduct[];
}

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
  enablePayAtCashier = signal(false);
  enableKitchenBarSplit = signal(false);
  enableTableReassignment = signal(false);
  avgPreparationMinutes = signal(15);
  avgPreparationMinutesDraft = signal<number | null>(15);
  suggestedTipPercent = signal(10);
  suggestedTipPercentDraft = signal<number | null>(10);
  activeTablesCount = signal(0);
  desiredTablesCount = signal<number | null>(null);
  tablesSaving = signal(false);
  tablesError = signal<string | null>(null);
  bulkJsonText = '';
  bulkImportError = signal<string | null>(null);
  bulkImportSuccess = signal<string | null>(null);
  paymentMethods = signal<PaymentMethodOption[]>([]);
  paymentMethodDraft = '';
  paymentMethodsSaving = signal(false);
  deletingPaymentMethodId = signal<string | null>(null);

  newName = '';
  newDescription = '';
  newCategory = '';
  newPrice = 0;
  newSort = 0;
  newImageUrl = '';
  newPrepStation = 'KITCHEN';
  newAvailable = true;

  editName = '';
  editDescription = '';
  editCategory = '';
  editPrice = 0;
  editSort = 0;
  editImageUrl = '';
  editPrepStation = 'KITCHEN';
  editAvailable = true;
  categoryStationDrafts = signal<Record<string, string>>({});

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
        this.applyRestaurantInfo(info);
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
      prepStation: this.enableKitchenBarSplit() ? this.newPrepStation : 'KITCHEN',
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

  onBulkJsonFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.bulkImportError.set(null);
    this.bulkImportSuccess.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      this.bulkJsonText = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = () => {
      this.bulkImportError.set('No se pudo leer el archivo JSON.');
    };
    reader.readAsText(file);

    input.value = '';
  }

  importFromJson(): void {
    if (!this.adminPanel) return;
    if (this.saving()) return;

    this.bulkImportError.set(null);
    this.bulkImportSuccess.set(null);

    let parsedProducts: CreateProductRequest[];
    try {
      parsedProducts = this.parseBulkProductsJson(this.bulkJsonText);
    } catch (error) {
      this.bulkImportError.set(
        error instanceof Error ? error.message : 'JSON invalido. Revisa el formato.'
      );
      return;
    }

    this.saving.set(true);
    this.productsService.bulkCreateProducts({ products: parsedProducts }).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.bulkImportSuccess.set(`Se importaron ${res.createdCount} productos.`);
        this.fetchProducts();
      },
      error: (err) => {
        this.saving.set(false);
        this.bulkImportError.set(
          err?.error?.error
          ?? err?.error?.detail
          ?? 'No se pudo importar el JSON.'
        );
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
    this.editPrepStation = this.enableKitchenBarSplit() ? (product.prepStation ?? 'KITCHEN') : 'KITCHEN';
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
      prepStation: this.enableKitchenBarSplit() ? this.editPrepStation : 'KITCHEN',
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

  groupedProducts = computed<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>();
    for (const p of this.products()) {
      const displayCategory = p.categoryName ?? 'Sin categoría';
      const key = p.categoryName ?? '__uncategorized__';
      const existing = map.get(key);
      if (existing) {
        existing.items.push(p);
        continue;
      }
      map.set(key, {
        category: displayCategory,
        rawCategoryName: p.categoryName,
        categoryPrepStation: p.categoryPrepStation ?? 'KITCHEN',
        items: [p]
      });
    }
    return Array.from(map.values());
  });

  categoryStationSelection(group: ProductGroup): string {
    if (!group.rawCategoryName) return 'KITCHEN';
    return this.categoryStationDrafts()[group.rawCategoryName] ?? group.categoryPrepStation ?? 'KITCHEN';
  }

  onCategoryStationChange(group: ProductGroup, value: string): void {
    if (!group.rawCategoryName) return;
    this.categoryStationDrafts.update(prev => ({ ...prev, [group.rawCategoryName!]: value }));
  }

  applyCategoryStation(group: ProductGroup): void {
    if (!this.adminPanel || !group.rawCategoryName || !this.enableKitchenBarSplit() || this.saving()) return;
    const prepStation = this.categoryStationSelection(group);
    this.saving.set(true);
    this.productsService.updateCategoryStation({
      categoryName: group.rawCategoryName,
      prepStation
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.fetchProducts();
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }

  categoryVisible(group: ProductGroup): boolean {
    if (!this.adminPanel) return true;
    return group.items.some(p => p.isActive);
  }

  toggleCategoryVisibility(group: ProductGroup): void {
    if (!this.adminPanel || this.saving() || group.items.length === 0) return;
    const nextVisibility = !this.categoryVisible(group);
    this.saving.set(true);

    forkJoin(
      group.items.map(p => this.productsService.updateProduct(p.id, { isActive: nextVisibility }))
    ).subscribe({
      next: () => {
        this.products.update(list =>
          list.map(p => group.items.some(gp => gp.id === p.id) ? { ...p, isActive: nextVisibility } : p)
        );
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
      }
    });
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
        this.applyRestaurantInfo(info);
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

  onAvgPreparationMinutesInput(value: unknown): void {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
    if (!Number.isFinite(parsed)) {
      this.avgPreparationMinutesDraft.set(null);
      return;
    }
    this.avgPreparationMinutesDraft.set(Math.max(1, Math.min(600, parsed)));
  }

  saveAvgPreparationMinutes(): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;
    const nextValue = this.avgPreparationMinutesDraft();
    if (nextValue == null) return;
    if (nextValue === this.avgPreparationMinutes()) return;

    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { avgPreparationMinutes: nextValue }).subscribe({
      next: (info) => {
        this.applyRestaurantInfo(info);
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  onSuggestedTipPercentInput(value: unknown): void {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
    if (!Number.isFinite(parsed)) {
      this.suggestedTipPercentDraft.set(null);
      return;
    }
    const normalized = Math.max(0, Math.min(100, parsed));
    this.suggestedTipPercentDraft.set(Math.round(normalized * 100) / 100);
  }

  saveSuggestedTipPercent(): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;
    const nextValue = this.suggestedTipPercentDraft();
    if (nextValue == null) return;
    if (nextValue === this.suggestedTipPercent()) return;

    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { suggestedTipPercent: nextValue }).subscribe({
      next: (info) => {
        this.applyRestaurantInfo(info);
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  onToggleDelivery(nextValue: boolean): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;

    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { enableDelivery: nextValue }).subscribe({
      next: (info) => {
        this.applyRestaurantInfo(info);
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
        this.applyRestaurantInfo(info);
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
        this.applyRestaurantInfo(info);
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  onToggleKitchenBarSplit(nextValue: boolean): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;
    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { enableKitchenBarSplit: nextValue }).subscribe({
      next: (info) => {
        this.applyRestaurantInfo(info);
        if (!info.enableKitchenBarSplit) {
          this.newPrepStation = 'KITCHEN';
          this.editPrepStation = 'KITCHEN';
        }
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  onTogglePayAtCashier(nextValue: boolean): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;
    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { enablePayAtCashier: nextValue }).subscribe({
      next: (info) => {
        this.applyRestaurantInfo(info);
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  onToggleTableReassignment(nextValue: boolean): void {
    if (!this.canManageSettings() || this.settingsSaving()) return;
    this.settingsSaving.set(true);
    this.restaurantService.updateSettings(this.restaurantId, { enableTableReassignment: nextValue }).subscribe({
      next: (info) => {
        this.applyRestaurantInfo(info);
        this.settingsSaving.set(false);
      },
      error: () => this.settingsSaving.set(false)
    });
  }

  canAddPaymentMethod(): boolean {
    return this.canManageSettings()
      && this.paymentMethodDraft.trim().length > 0
      && this.paymentMethods().length < 6
      && !this.paymentMethodsSaving();
  }

  addPaymentMethod(): void {
    if (!this.canAddPaymentMethod()) return;
    this.paymentMethodsSaving.set(true);
    const label = this.paymentMethodDraft.trim();
    this.restaurantService.addPaymentMethod(this.restaurantId, label).subscribe({
      next: (item) => {
        this.paymentMethods.update(list => [...list, item].sort((a, b) => a.sort - b.sort));
        this.paymentMethodDraft = '';
        this.paymentMethodsSaving.set(false);
      },
      error: () => {
        this.paymentMethodsSaving.set(false);
      }
    });
  }

  removePaymentMethod(method: PaymentMethodOption): void {
    if (!this.canManageSettings() || this.paymentMethodsSaving()) return;
    if (!this.canDeletePaymentMethod(method)) return;
    const ok = confirm(`Eliminar metodo de pago "${method.label}"?`);
    if (!ok) return;
    this.deletingPaymentMethodId.set(method.id);
    this.restaurantService.deletePaymentMethod(this.restaurantId, method.id).subscribe({
      next: () => {
        this.paymentMethods.update(list => list.filter(x => x.id !== method.id));
        this.deletingPaymentMethodId.set(null);
      },
      error: () => {
        this.deletingPaymentMethodId.set(null);
      }
    });
  }

  canDeletePaymentMethod(method: PaymentMethodOption): boolean {
    return method.code !== 'CASH' && method.code !== 'CARD';
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

  private applyRestaurantInfo(info: RestaurantInfo): void {
    this.enableDineIn.set(info.enableDineIn);
    this.enableDelivery.set(info.enableDelivery);
    this.enableDeliveryCash.set(info.enableDeliveryCash);
    this.enableDeliveryCard.set(info.enableDeliveryCard);
    this.enablePayAtCashier.set(info.enablePayAtCashier);
    this.enableKitchenBarSplit.set(info.enableKitchenBarSplit);
    this.enableTableReassignment.set(info.enableTableReassignment ?? false);
    this.avgPreparationMinutes.set(info.avgPreparationMinutes ?? 15);
    this.avgPreparationMinutesDraft.set(info.avgPreparationMinutes ?? 15);
    this.suggestedTipPercent.set(info.suggestedTipPercent ?? 10);
    this.suggestedTipPercentDraft.set(info.suggestedTipPercent ?? 10);
    this.paymentMethods.set(info.paymentMethods ?? []);
  }

  private resetCreateForm() {
    this.newName = '';
    this.newDescription = '';
    this.newCategory = '';
    this.newPrice = 0;
    this.newSort = 0;
    this.newImageUrl = '';
    this.newPrepStation = 'KITCHEN';
    this.newAvailable = true;
  }

  private parseBulkProductsJson(raw: string): CreateProductRequest[] {
    if (!raw.trim()) {
      throw new Error('Pega un JSON o sube un archivo .json antes de importar.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('JSON invalido. Verifica comas, llaves y comillas.');
    }

    if (Array.isArray(parsed)) {
      return this.normalizeProductsArray(parsed);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Formato JSON no soportado.');
    }

    const root = parsed as Record<string, unknown>;
    if (Array.isArray(root['products'])) {
      return this.normalizeProductsArray(root['products']);
    }

    if (Array.isArray(root['menu'])) {
      const items: unknown[] = [];
      for (const categoryEntry of root['menu']) {
        if (typeof categoryEntry !== 'object' || categoryEntry === null) continue;
        const categoryObj = categoryEntry as Record<string, unknown>;
        const categoryName = typeof categoryObj['category'] === 'string' ? categoryObj['category'] : null;
        const categoryItems = Array.isArray(categoryObj['items']) ? categoryObj['items'] : [];
        for (const item of categoryItems) {
          if (typeof item !== 'object' || item === null) continue;
          const itemObj = { ...(item as Record<string, unknown>) };
          if (!itemObj['categoryName'] && categoryName) {
            itemObj['categoryName'] = categoryName;
          }
          items.push(itemObj);
        }
      }

      return this.normalizeProductsArray(items);
    }

    throw new Error('Formato no soportado. Usa un array de productos o { "products": [...] } o { "menu": [...] }.');
  }

  private normalizeProductsArray(items: unknown[]): CreateProductRequest[] {
    if (!items.length) {
      throw new Error('El JSON no contiene productos para importar.');
    }

    return items.map((item, index) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`Producto en posicion ${index + 1} no es un objeto valido.`);
      }

      const obj = item as Record<string, unknown>;
      const name = this.readString(obj['name']).trim();
      if (!name) {
        throw new Error(`El producto en posicion ${index + 1} no tiene nombre.`);
      }

      const priceRaw = obj['price'];
      const price = typeof priceRaw === 'number' ? priceRaw : Number(priceRaw);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Precio invalido para "${name}".`);
      }

      const prepStationRaw = this.readString(obj['prepStation'] ?? 'KITCHEN').toUpperCase();
      const prepStation = prepStationRaw === 'BAR' ? 'BAR' : 'KITCHEN';

      const sortRaw = obj['sort'];
      const sort = sortRaw == null ? index + 1 : Number(sortRaw);
      if (!Number.isFinite(sort) || sort < 0) {
        throw new Error(`Sort invalido para "${name}".`);
      }

      const imageCandidate = obj['imageUrl'] ?? obj['image'];
      const imageUrl = this.readOptionalString(imageCandidate);

      const availableRaw = obj['isAvailable'];
      const isAvailable = typeof availableRaw === 'boolean' ? availableRaw : true;

      return {
        name,
        description: this.readOptionalString(obj['description']),
        categoryName: this.readOptionalString(obj['categoryName'] ?? obj['category']),
        prepStation,
        price,
        imageUrl,
        sort: Math.trunc(sort),
        isAvailable
      };
    });
  }

  private readString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (typeof value === 'number') return String(value);
    return '';
  }

  private readOptionalString(value: unknown): string | null {
    const text = this.readString(value).trim();
    return text ? text : null;
  }
}
