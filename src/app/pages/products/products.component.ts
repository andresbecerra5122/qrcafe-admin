import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProductsService } from '../../services/products.service';
import { RestaurantService } from '../../services/restaurant.service';
import { OpsProduct } from '../../models/product.model';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss'
})
export class ProductsComponent implements OnInit {
  restaurantId = '';
  restaurantName = signal('');
  products = signal<OpsProduct[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  togglingId = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    private productsService: ProductsService,
    private restaurantService: RestaurantService
  ) {}

  ngOnInit() {
    this.restaurantId = this.route.snapshot.queryParamMap.get('restaurantId') ?? '';

    if (!this.restaurantId) {
      this.error.set('Falta el parámetro restaurantId.');
      this.loading.set(false);
      return;
    }

    this.restaurantService.getInfo(this.restaurantId).subscribe({
      next: (info) => this.restaurantName.set(info.name)
    });

    this.fetchProducts();
  }

  fetchProducts() {
    this.productsService.getProducts(this.restaurantId).subscribe({
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
    if (this.togglingId()) return;

    this.togglingId.set(product.id);
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
}
