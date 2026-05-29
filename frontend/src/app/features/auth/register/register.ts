import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { GoogleAuthService } from '../../../core/services/google-auth.service';
import { parseApiError } from '../../../core/utils/api-error.utils';
import { Terms } from '../../legal/terms/terms';
import { Privacy } from '../../legal/privacy/privacy';


@Component({
  selector: 'app-register',
  imports: [CommonModule, RouterLink, FormsModule, Terms, Privacy],
  templateUrl: './register.html',
  styleUrl: './register.scss',
})
export class Register implements AfterViewInit, OnDestroy {
  private readonly auth   = inject(AuthService);
  private readonly router = inject(Router);
  private readonly googleAuth = inject(GoogleAuthService);


  // ─── Champs ───────────────────────────────────────────────
  firstName = signal('');
  lastName  = signal('');
  email     = signal('');
  password  = signal('');

  // ─── UI state ─────────────────────────────────────────────
  loading      = signal(false);
  showPass     = signal(false);
  error        = signal('');
  step         = signal<1 | 2>(1);
  googleLoading = signal(true);

  // ─── Validation mot de passe ──────────────────────────────
  passwordStrength = computed(() => {
    const p = this.password();
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8)          score++;
    if (/[A-Z]/.test(p))        score++;
    if (/[0-9]/.test(p))        score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    return score;
  });

  passwordStrengthLabel = computed(() => {
    const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
    return labels[this.passwordStrength()] ?? '';
  });

  passwordStrengthClass = computed(() => {
    const classes = ['', 'weak', 'fair', 'good', 'strong'];
    return classes[this.passwordStrength()] ?? '';
  });

  // ─── Lifecycle ────────────────────────────────────────────

  ngAfterViewInit(): void {
    this.googleAuth.load().then(() => {
      this.googleAuth.renderButton(
        'google-btn-register',
        (response) => this.handleGoogleResponse(response),
        'signup_with'
      );
      this.googleLoading.set(false);
    });
  }

  ngOnDestroy(): void { }

  // ─── Navigation étapes ────────────────────────────────────
  togglePassword(): void {
    this.showPass.update(v => !v);
  }

  nextStep(): void {
    this.error.set('');

    if (!this.firstName().trim() || !this.lastName().trim()) {
      this.error.set('Veuillez renseigner votre prénom et votre nom.');
      return;
    }

    if (this.firstName().trim().length < 2) {
      this.error.set('Le prénom doit contenir au moins 2 caractères.');
      return;
    }

    if (this.lastName().trim().length < 2) {
      this.error.set('Le nom doit contenir au moins 2 caractères.');
      return;
    }

    this.step.set(2);
  }

  prevStep(): void {
    this.error.set('');
    this.step.set(1);
  }

  // ─── Soumission formulaire classique ─────────────────────
  onSubmit(): void {
    this.error.set('');

    if (!this.email() || !this.password()) {
      this.error.set('Veuillez remplir tous les champs.');
      return;
    }

    if (this.passwordStrength() < 2) {
      this.error.set('Votre mot de passe est trop faible.');
      return;
    }

    this.loading.set(true);

    this.auth.register(
      this.email(),
      this.password(),
      this.firstName().trim(),
      this.lastName().trim()
    ).subscribe({
      next: () => {
        // saveTokens déjà appelé dans AuthService via tap()
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);

        // retour étape 2 si email dupliqué
        if (err.status === 409) this.step.set(2);

        this.error.set(parseApiError(err));
      }
    });
  }

  // ─── Google OAuth ─────────────────────────────────────────
  private handleGoogleResponse(
    response: google.accounts.id.CredentialResponse
  ): void {
    if (!response.credential) {
      this.error.set('Échec de l\'inscription Google.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.loginWithGoogle(response.credential).subscribe({
      next: (result) => {
        this.router.navigate([result.isNewUser ? '/onboarding' : '/dashboard']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Échec de l\'inscription Google. Réessayez.');
      }
    });
  }
}
