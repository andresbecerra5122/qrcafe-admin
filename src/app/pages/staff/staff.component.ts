import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StaffService } from '../../services/staff.service';
import { StaffUser } from '../../models/staff-user.model';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-staff',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.scss'
})
export class StaffComponent implements OnInit {
  staff = signal<StaffUser[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal<string | null>(null);
  formError = signal<string | null>(null);

  fullName = '';
  email = '';
  password = '';
  role = 'Waiter';

  constructor(
    private readonly staffService: StaffService,
    private readonly authService: AuthService
  ) {}

  ngOnInit(): void {
    this.fetchStaff();
  }

  fetchStaff(): void {
    this.staffService.getAll().subscribe({
      next: (items) => {
        this.staff.set(items);
        this.loading.set(false);
        this.error.set(null);
      },
      error: () => {
        this.error.set('No se pudo cargar el personal.');
        this.loading.set(false);
      }
    });
  }

  createStaff(): void {
    if (this.saving()) return;

    this.saving.set(true);
    this.formError.set(null);

    this.staffService.create({
      fullName: this.fullName,
      email: this.email,
      password: this.password,
      role: this.role
    }).subscribe({
      next: () => {
        this.fullName = '';
        this.email = '';
        this.password = '';
        this.role = 'Waiter';
        this.saving.set(false);
        this.fetchStaff();
      },
      error: (err) => {
        this.formError.set(err?.error?.error ?? 'No se pudo crear el usuario.');
        this.saving.set(false);
      }
    });
  }

  toggleActive(user: StaffUser): void {
    if (this.saving()) return;
    this.saving.set(true);

    this.staffService.update(user.id, { isActive: !user.isActive }).subscribe({
      next: () => {
        this.saving.set(false);
        this.fetchStaff();
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }

  canManage(user: StaffUser): boolean {
    return this.authService.getCurrentUser()?.id !== user.id;
  }
}
