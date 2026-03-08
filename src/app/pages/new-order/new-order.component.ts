import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductsService } from '../../services/products.service';
import { OrdersService, CreateOpsOrderRequest } from '../../services/orders.service';
import { RestaurantService } from '../../services/restaurant.service';
import { AuthService } from '../../services/auth.service';
import { OpsProduct } from '../../models/product.model';

interface CartItem {
  product: OpsProduct;
  qty: number;
  notes: string;
}

@Component({
  selector: 'app-new-order',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './new-order.component.html',
  styleUrl: './new-order.component.scss'
})
export class NewOrderComponent implements OnInit {
  restaurantId = '';
  restaurantName = signal('');
  tableNumber = signal<number | null>(null);
  customerName = '';
  orderNotes = '';

  products = signal<OpsProduct[]>([]);
  cart = signal<CartItem[]>([]);
  loading = signal(true);
  submitting = signal(false);
  error = signal<string | null>(null);
  submitError = signal<string | null>(null);

  subtotal = computed(() =>
    this.cart().reduce((sum, item) => sum + item.product.price * item.qty, 0)
  );

  itemCount = computed(() =>
    this.cart().reduce((sum, item) => sum + item.qty, 0)
  );

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productsService: ProductsService,
    private ordersService: OrdersService,
    private restaurantService: RestaurantService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const routeRestaurantId = this.route.snapshot.queryParamMap.get('restaurantId');
    this.restaurantId = this.authService.enforceRestaurantContext(routeRestaurantId);
    const tn = this.route.snapshot.queryParamMap.get('tableNumber');
    if (tn) this.tableNumber.set(parseInt(tn, 10));

    if (!this.restaurantId) {
      this.error.set('No tienes permiso para acceder a este restaurante.');
      this.loading.set(false);
      return;
    }

    this.restaurantService.getInfo(this.restaurantId).subscribe({
      next: (info) => this.restaurantName.set(info.name)
    });

    this.productsService.getProducts(this.restaurantId).subscribe({
      next: (list) => {
        this.products.set(list.filter(p => p.isAvailable));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudieron cargar los productos.');
        this.loading.set(false);
      }
    });
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

  qtyOf(productId: string): number {
    return this.cart().find(i => i.product.id === productId)?.qty ?? 0;
  }

  addToCart(product: OpsProduct) {
    const current = this.cart();
    const existing = current.find(i => i.product.id === product.id);
    if (existing) {
      this.cart.set(current.map(i =>
        i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
      ));
    } else {
      this.cart.set([...current, { product, qty: 1, notes: '' }]);
    }
  }

  inc(productId: string) {
    this.cart.update(c => c.map(i =>
      i.product.id === productId ? { ...i, qty: i.qty + 1 } : i
    ));
  }

  dec(productId: string) {
    this.cart.update(c => {
      const item = c.find(i => i.product.id === productId);
      if (!item) return c;
      if (item.qty <= 1) return c.filter(i => i.product.id !== productId);
      return c.map(i =>
        i.product.id === productId ? { ...i, qty: i.qty - 1 } : i
      );
    });
  }

  updateItemNotes(productId: string, notes: string) {
    this.cart.update(c => c.map(i =>
      i.product.id === productId ? { ...i, notes } : i
    ));
  }

  itemNotesOf(productId: string): string {
    return this.cart().find(i => i.product.id === productId)?.notes ?? '';
  }

  formatPrice(price: number): string {
    return price.toLocaleString('es-CO', { minimumFractionDigits: 0 });
  }

  submitOrder() {
    if (this.submitting() || this.cart().length === 0) return;

    this.submitting.set(true);
    this.submitError.set(null);

    const body: CreateOpsOrderRequest = {
      restaurantId: this.restaurantId,
      tableNumber: this.tableNumber() ?? undefined,
      customerName: this.customerName.trim() || undefined,
      notes: this.orderNotes.trim() || undefined,
      items: this.cart().map(i => ({
        productId: i.product.id,
        qty: i.qty,
        notes: i.notes.trim() || undefined
      }))
    };

    this.ordersService.createOrder(body).subscribe({
      next: () => {
        this.router.navigate(['/waiters'], {
          queryParams: { restaurantId: this.restaurantId }
        });
      },
      error: (err) => {
        this.submitting.set(false);
        this.submitError.set(err?.error?.detail ?? err?.error ?? 'Error al crear la orden.');
      }
    });
  }
}
