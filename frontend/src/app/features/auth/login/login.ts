import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { GoogleAuthService } from '../../../core/services/google-auth.service';
import { parseApiError } from '../../../core/utils/api-error.utils';

@Component({
  selector: 'app-login',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements AfterViewInit, OnDestroy {
  private readonly auth       = inject(AuthService);
  private readonly router     = inject(Router);
  private readonly googleAuth = inject(GoogleAuthService);

  email         = signal('');
  password      = signal('');
  loading       = signal(false);
  showPass      = signal(false);
  error         = signal('');
  googleLoading = signal(true);

  ngAfterViewInit(): void {
    this.googleAuth.load().then(() => {
      this.googleAuth.renderButton(
        'google-btn-login',
        (response) => this.handleGoogleResponse(response),
        'continue_with'
      );
      this.googleLoading.set(false);
    });
  }

  ngOnDestroy(): void {}

  private handleGoogleResponse(response: google.accounts.id.CredentialResponse): void {
    if (!response.credential) {
      this.error.set('Échec de la connexion Google.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    // loginWithGoogle() appelle déjà saveTokens() via tap() dans AuthService.
    // Ne PAS rappeler saveTokens() ici.
    this.auth.loginWithGoogle(response.credential).subscribe({
      next: (result) => {
        this.router.navigate([result.isNewUser ? '/onboarding' : '/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Échec de la connexion Google. Réessayez.');
      }
    });
  }

  togglePassword(): void {
    this.showPass.update(v => !v);
  }

  onSubmit(): void {
    this.error.set('');

    if (!this.email() || !this.password()) {
      this.error.set('Veuillez remplir tous les champs.');
      return;
    }

    this.loading.set(true);

    // login() appelle déjà saveTokens() via tap() dans AuthService.
    // Ne PAS rappeler saveTokens() ici.
    this.auth.login(this.email(), this.password()).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(parseApiError(err));
      }
    });
  }
}