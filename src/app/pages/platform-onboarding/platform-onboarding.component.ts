import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PlatformOnboardingService } from '../../services/platform-onboarding.service';
import {
  CreateRestaurantOnboardingRequest,
  CreateRestaurantOnboardingResponse,
  OnboardingCategoryRequest,
  OnboardingProductRequest,
  OnboardingStaffUserRequest,
  PlatformRestaurantListItem
} from '../../models/platform-onboarding.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-platform-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './platform-onboarding.component.html',
  styleUrl: './platform-onboarding.component.scss'
})
export class PlatformOnboardingComponent implements OnInit {
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal<CreateRestaurantOnboardingResponse | null>(null);
  menuImportError = signal<string | null>(null);
  menuImportSuccess = signal<string | null>(null);
  restaurants = signal<PlatformRestaurantListItem[]>([]);
  restaurantsLoading = signal(true);
  restaurantsError = signal<string | null>(null);
  restaurantActionLoading = signal<string | null>(null);
  menuJsonText = '';

  model: CreateRestaurantOnboardingRequest = {
    name: '',
    slug: '',
    countryCode: 'CO',
    currency: 'COP',
    timeZone: 'America/Bogota',
    taxRate: 0.08,
    enableDineIn: true,
    enableDelivery: false,
    enableDeliveryCash: true,
    enableDeliveryCard: true,
    adminFullName: '',
    adminEmail: '',
    adminPassword: '',
    initialTablesCount: 0,
    staffUsers: [],
    categories: []
  };

  constructor(
    private readonly onboardingService: PlatformOnboardingService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.fetchRestaurants();
  }

  suggestSlug(): void {
    if (!this.model.name?.trim()) return;
    this.model.slug = this.model.name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  addStaffUser(): void {
    this.model.staffUsers.push({
      fullName: '',
      email: '',
      password: '',
      role: 'Waiter'
    });
  }

  removeStaffUser(index: number): void {
    this.model.staffUsers.splice(index, 1);
  }

  addCategory(): void {
    this.model.categories.push({
      name: '',
      sort: this.model.categories.length + 1,
      products: []
    });
  }

  removeCategory(index: number): void {
    this.model.categories.splice(index, 1);
  }

  addProduct(category: OnboardingCategoryRequest): void {
    category.products.push({
      name: '',
      description: '',
      price: 0,
      isActive: true,
      isAvailable: true,
      sort: category.products.length + 1,
      imageUrl: ''
    });
  }

  removeProduct(category: OnboardingCategoryRequest, index: number): void {
    category.products.splice(index, 1);
  }

  onMenuJsonFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.menuImportError.set(null);
    this.menuImportSuccess.set(null);

    const reader = new FileReader();
    reader.onload = () => {
      this.menuJsonText = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = () => {
      this.menuImportError.set('No se pudo leer el archivo JSON.');
    };
    reader.readAsText(file);
    input.value = '';
  }

  importMenuFromJson(): void {
    this.menuImportError.set(null);
    this.menuImportSuccess.set(null);

    let categories: OnboardingCategoryRequest[];
    try {
      categories = this.parseCategoriesFromJson(this.menuJsonText);
    } catch (err) {
      this.menuImportError.set(
        err instanceof Error ? err.message : 'JSON inválido para menú.'
      );
      return;
    }

    this.model.categories = categories;
    const productsCount = categories.reduce((acc, c) => acc + c.products.length, 0);
    this.menuImportSuccess.set(
      `Se cargaron ${categories.length} categorías y ${productsCount} productos al formulario.`
    );
  }

  submit(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    const payload: CreateRestaurantOnboardingRequest = {
      ...this.model,
      name: this.model.name.trim(),
      slug: this.model.slug.trim(),
      countryCode: this.model.countryCode.trim(),
      currency: this.model.currency.trim(),
      timeZone: this.model.timeZone.trim(),
      adminFullName: this.model.adminFullName.trim(),
      adminEmail: this.model.adminEmail.trim(),
      adminPassword: this.model.adminPassword,
      staffUsers: this.model.staffUsers.map((s: OnboardingStaffUserRequest) => ({
        fullName: s.fullName.trim(),
        email: s.email.trim(),
        password: s.password,
        role: s.role
      })),
      categories: this.model.categories.map((c: OnboardingCategoryRequest) => ({
        name: c.name.trim(),
        sort: c.sort,
        products: c.products.map((p: OnboardingProductRequest) => ({
          name: p.name.trim(),
          description: p.description?.trim() || null,
          price: Number(p.price),
          isActive: p.isActive,
          isAvailable: p.isAvailable,
          sort: p.sort,
          imageUrl: p.imageUrl?.trim() || null
        }))
      }))
    };

    this.onboardingService.createRestaurant(payload).subscribe({
      next: (result) => {
        this.success.set(result);
        this.loading.set(false);
        this.fetchRestaurants();
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? err?.error?.detail ?? 'No se pudo crear el restaurante.');
        this.loading.set(false);
      }
    });
  }

  fetchRestaurants(): void {
    this.restaurantsLoading.set(true);
    this.restaurantsError.set(null);
    this.onboardingService.getRestaurants().subscribe({
      next: (items) => {
        this.restaurants.set(items);
        this.restaurantsLoading.set(false);
      },
      error: () => {
        this.restaurantsError.set('No se pudo cargar la lista de restaurantes.');
        this.restaurantsLoading.set(false);
      }
    });
  }

  toggleRestaurantStatus(item: PlatformRestaurantListItem): void {
    if (this.restaurantActionLoading()) return;
    this.restaurantActionLoading.set(item.restaurantId);
    this.onboardingService.setRestaurantStatus(item.restaurantId, !item.isActive).subscribe({
      next: () => {
        this.restaurantActionLoading.set(null);
        this.fetchRestaurants();
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'No se pudo actualizar el estado del restaurante.');
        this.restaurantActionLoading.set(null);
      }
    });
  }

  formatDate(value: string): string {
    return new Date(value).toLocaleString('es-CO');
  }

  logout(): void {
    this.authService.logout();
  }

  private parseCategoriesFromJson(raw: string): OnboardingCategoryRequest[] {
    if (!raw.trim()) {
      throw new Error('Pega un JSON o sube un archivo antes de importar.');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error('JSON inválido. Verifica comillas, comas y llaves.');
    }

    if (Array.isArray(parsed)) {
      return this.categoriesFromFlatProducts(parsed);
    }

    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Formato JSON no soportado.');
    }

    const root = parsed as Record<string, unknown>;

    if (Array.isArray(root['categories'])) {
      return this.normalizeCategoriesArray(root['categories']);
    }

    if (Array.isArray(root['menu'])) {
      return this.categoriesFromMenuArray(root['menu']);
    }

    if (Array.isArray(root['products'])) {
      return this.categoriesFromFlatProducts(root['products']);
    }

    throw new Error('Formato no soportado. Usa { "menu": [...] }, { "categories": [...] } o { "products": [...] }.');
  }

  private categoriesFromMenuArray(menu: unknown[]): OnboardingCategoryRequest[] {
    const categories: OnboardingCategoryRequest[] = [];

    menu.forEach((entry, idx) => {
      if (typeof entry !== 'object' || entry === null) return;
      const obj = entry as Record<string, unknown>;
      const categoryName = this.readString(obj['category']).trim();
      if (!categoryName) return;

      const items = Array.isArray(obj['items']) ? obj['items'] : [];
      const products = this.normalizeProductsArray(items);

      categories.push({
        name: categoryName,
        sort: idx + 1,
        products
      });
    });

    if (!categories.length) {
      throw new Error('No se encontraron categorías válidas en "menu".');
    }

    return categories;
  }

  private normalizeCategoriesArray(rawCategories: unknown[]): OnboardingCategoryRequest[] {
    const categories: OnboardingCategoryRequest[] = [];

    rawCategories.forEach((entry, idx) => {
      if (typeof entry !== 'object' || entry === null) return;
      const obj = entry as Record<string, unknown>;
      const name = this.readString(obj['name'] ?? obj['category']).trim();
      if (!name) return;
      const products = Array.isArray(obj['products']) ? this.normalizeProductsArray(obj['products']) : [];
      categories.push({
        name,
        sort: this.readPositiveInt(obj['sort'], idx + 1),
        products
      });
    });

    if (!categories.length) {
      throw new Error('No se encontraron categorías válidas en "categories".');
    }

    return categories;
  }

  private categoriesFromFlatProducts(rawProducts: unknown[]): OnboardingCategoryRequest[] {
    const grouped = new Map<string, OnboardingProductRequest[]>();
    const normalizedProducts = this.normalizeFlatProductsArray(rawProducts);

    normalizedProducts.forEach(({ categoryName, product }) => {
      const category = categoryName && categoryName.trim() ? categoryName.trim() : 'Sin categoría';
      const bucket = grouped.get(category) ?? [];
      bucket.push(product);
      grouped.set(category, bucket);
    });

    const categories = Array.from(grouped.entries()).map(([name, products], index) => ({
      name,
      sort: index + 1,
      products: products.map((p, productIndex) => ({
        ...p,
        sort: p.sort > 0 ? p.sort : productIndex + 1
      }))
    }));

    if (!categories.length) {
      throw new Error('No se encontraron productos para importar.');
    }

    return categories;
  }

  private normalizeProductsArray(rawProducts: unknown[]): OnboardingProductRequest[] {
    return this.normalizeFlatProductsArray(rawProducts).map((x) => x.product);
  }

  private normalizeFlatProductsArray(rawProducts: unknown[]): { categoryName: string | null; product: OnboardingProductRequest }[] {
    return rawProducts.map((entry, index) => {
      if (typeof entry !== 'object' || entry === null) {
        throw new Error(`Producto inválido en posición ${index + 1}.`);
      }

      const obj = entry as Record<string, unknown>;
      const name = this.readString(obj['name']).trim();
      if (!name) {
        throw new Error(`Producto sin nombre en posición ${index + 1}.`);
      }

      const price = Number(obj['price']);
      if (!Number.isFinite(price) || price < 0) {
        throw new Error(`Precio inválido para "${name}".`);
      }

      return {
        categoryName: this.readOptionalString(obj['categoryName'] ?? obj['category']),
        product: {
          name,
          description: this.readOptionalString(obj['description']),
          price,
          isActive: typeof obj['isActive'] === 'boolean' ? obj['isActive'] : true,
          isAvailable: typeof obj['isAvailable'] === 'boolean' ? obj['isAvailable'] : true,
          sort: this.readPositiveInt(obj['sort'], index + 1),
          imageUrl: this.readOptionalString(obj['imageUrl'] ?? obj['image'])
        }
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

  private readPositiveInt(value: unknown, fallback: number): number {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return fallback;
    return Math.trunc(num);
  }
}
