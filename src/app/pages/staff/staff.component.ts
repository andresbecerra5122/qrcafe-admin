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
  passwordError = signal<string | null>(null);
  passwordSuccess = signal<string | null>(null);
  changingPassword = signal(false);
  resettingUserId = signal<string | null>(null);
  resetPasswordValue = '';
  resetError = signal<string | null>(null);
  resetSuccess = signal<string | null>(null);

  fullName = '';
  email = '';
  password = '';
  role = 'Waiter';
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

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

  startResetPassword(user: StaffUser): void {
    this.resetError.set(null);
    this.resetSuccess.set(null);
    this.resetPasswordValue = '';
    this.resettingUserId.set(user.id);
  }

  cancelResetPassword(): void {
    this.resetPasswordValue = '';
    this.resettingUserId.set(null);
  }

  saveResetPassword(user: StaffUser): void {
    if (!this.canManage(user)) return;

    const nextPassword = this.resetPasswordValue.trim();
    this.resetError.set(null);
    this.resetSuccess.set(null);

    if (!nextPassword) {
      this.resetError.set('Ingresa una nueva contraseña para este usuario.');
      return;
    }
    if (nextPassword.length < 8) {
      this.resetError.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    this.saving.set(true);
    this.staffService.update(user.id, { password: nextPassword }).subscribe({
      next: () => {
        this.saving.set(false);
        this.resetSuccess.set(`Contraseña actualizada para ${user.fullName}.`);
        this.cancelResetPassword();
      },
      error: (err) => {
        this.saving.set(false);
        this.resetError.set(err?.error?.error ?? 'No se pudo actualizar la contraseña.');
      }
    });
  }

  saveResetPasswordById(userId: string): void {
    const user = this.staff().find(s => s.id === userId);
    if (!user) {
      this.resetError.set('No se encontró el usuario seleccionado.');
      return;
    }
    this.saveResetPassword(user);
  }

  changeMyPassword(): void {
    if (this.changingPassword()) return;

    this.passwordError.set(null);
    this.passwordSuccess.set(null);

    if (!this.currentPassword || !this.newPassword) {
      this.passwordError.set('Debes ingresar tu contraseña actual y la nueva.');
      return;
    }
    if (this.newPassword.length < 8) {
      this.passwordError.set('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.passwordError.set('La confirmación no coincide con la nueva contraseña.');
      return;
    }

    this.changingPassword.set(true);
    this.staffService.changeMyPassword({
      currentPassword: this.currentPassword,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.passwordSuccess.set('Contraseña actualizada correctamente.');
        this.changingPassword.set(false);
      },
      error: (err) => {
        this.passwordError.set(err?.error?.error ?? 'No se pudo actualizar la contraseña.');
        this.changingPassword.set(false);
      }
    });
  }
}
