import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly route: ActivatedRoute,
    private readonly router: Router
  ) {}

  submit(): void {
    if (this.loading()) return;

    this.loading.set(true);
    this.error.set(null);

    this.authService.login(this.email, this.password).subscribe({
      next: (user) => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        if (returnUrl) {
          this.router.navigateByUrl(returnUrl);
          return;
        }

        const targetPath = user.role?.toLowerCase() === 'delivery' ? '/delivery' : '/dashboard';
        this.router.navigate([targetPath], {
          queryParams: { restaurantId: user.restaurantId }
        });
      },
      error: (err) => {
        const message = err?.error?.error ?? 'Credenciales inválidas.';
        this.error.set(message);
        this.loading.set(false);
      }
    });
  }
}
