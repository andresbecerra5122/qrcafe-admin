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
  restaurants = signal<PlatformRestaurantListItem[]>([]);
  restaurantsLoading = signal(true);
  restaurantsError = signal<string | null>(null);
  restaurantActionLoading = signal<string | null>(null);

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
}
