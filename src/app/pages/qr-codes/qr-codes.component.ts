import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QRCodeModule } from 'angularx-qrcode';

import { TablesService } from '../../services/tables.service';
import { RestaurantService } from '../../services/restaurant.service';
import { AuthService } from '../../services/auth.service';
import { OpsTable } from '../../models/table.model';

@Component({
  selector: 'app-qr-codes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, QRCodeModule],
  templateUrl: './qr-codes.component.html',
  styleUrl: './qr-codes.component.scss'
})
export class QrCodesComponent implements OnInit {
  restaurantId = '';
  restaurantName = signal('');
  tables = signal<OpsTable[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  enableDineIn = signal(true);
  enableDelivery = signal(false);

  menuBaseUrl = '';

  constructor(
    private route: ActivatedRoute,
    private tablesService: TablesService,
    private restaurantService: RestaurantService,
    private authService: AuthService
  ) {}

  ngOnInit() {
    const routeRestaurantId = this.route.snapshot.queryParamMap.get('restaurantId');
    this.restaurantId = this.authService.enforceRestaurantContext(routeRestaurantId);

    this.menuBaseUrl = window.location.origin.replace(':4201', ':4200');

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
        if (info.enableDineIn) {
          this.fetchTables();
        } else {
          this.loading.set(false);
          this.tables.set([]);
          this.error.set(null);
        }
      }
    });
  }

  fetchTables() {
    this.tablesService.getTables(this.restaurantId).subscribe({
      next: (list) => {
        this.tables.set(list);
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        this.error.set('No se pudieron cargar las mesas');
        this.loading.set(false);
      }
    });
  }

  getQrUrl(table: OpsTable): string {
    return `${this.menuBaseUrl}/menu?restaurantId=${this.restaurantId}&table=${table.token}`;
  }

  getDeliveryQrUrl(): string {
    return `${this.menuBaseUrl}/menu?restaurantId=${this.restaurantId}&mode=delivery`;
  }

  printQrs() {
    window.print();
  }
}
