# app\app.config.ts

```ts
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { SessionRestoreService } from './core/services/session-restore.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => {
          const sessionRestore = inject(SessionRestoreService);
          return sessionRestore.restore();
        })  
    ]
};

```

# app\app.html

```html
<router-outlet></router-outlet>
```

# app\app.routes.ts

```ts
import { Routes } from '@angular/router';
import { DashboardShell } from './features/dashboard/shell/dashboard-shell';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';


export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./features/landing/landing').then(m => m.Landing)
    },
    {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
    },
    {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register/register').then(m => m.Register)
    },
    {
        path: 'dashboard',
        canActivate: [authGuard],
        component: DashboardShell,
        children: [
            { path: '', loadComponent: () => import('./features/dashboard/overview/overview').then(m => m.Overview) },
            { path: 'projects', loadComponent: () => import('./features/dashboard/projects/projects').then(m => m.Projects) },
            { path: 'feedbacks', loadComponent: () => import('./features/dashboard/feedbacks/feedbacks').then(m => m.Feedbacks) },
            { path: 'projects/:projectId/feedbacks', loadComponent: () => import('./features/dashboard/feedbacks/feedbacks').then(m => m.Feedbacks) },
            { path: 'trends', loadComponent: () => import('./features/dashboard/trends/trends').then(m => m.Trends) },
            { path: 'widget', loadComponent: () => import('./features/dashboard/widget/widget').then(m => m.Widget)},
            { path: 'billing', loadComponent: () => import('./shared/components/billing/billing').then(m => m.Billing), }

        ]
    },
    {
        path: 'payment-success',
        loadComponent: () => import('./shared/components/payment-success/payment-success').then(m => m.PaymentSuccess)
    }

];

```

# app\app.scss

```scss

```

# app\app.spec.ts

```ts
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Hello, frontend');
  });
});

```

# app\app.ts

```ts
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
}





```

# app\core\guards\auth.guard.ts

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Protège les routes privées — redirige vers /login si non connecté
export const authGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/login']);
};
```

# app\core\guards\guest.guard.ts

```ts
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Protège les routes publiques — redirige vers /dashboard si déjà connecté
export const guestGuard: CanActivateFn = () => {
  const auth   = inject(AuthService);
  const router = inject(Router);

  if (!auth.isAuthenticated()) return true;
  return router.createUrlTree(['/dashboard']);
};
```

# app\core\interceptors\auth.interceptor.ts

```ts
import { HttpInterceptorFn, HttpErrorResponse, HttpBackend, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';
import { RawHttpService } from '../services/raw-http.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth    = inject(AuthService);
  const storage = inject(TokenStorageService);
  const rawHttpSvc = inject(RawHttpService); // ← singleton, pas recréé à chaque requête

  // Bypass pour les routes publiques
  const publicRoutes = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh'];
  if (publicRoutes.some(route => req.url.includes(route))) {
    return next(req);
  }

  const token = auth.getAccessToken();

  // Refresh proactif — token expire dans moins de 60s
  if (token && storage.isTokenExpiringSoon(60)) {
    return auth.refreshTokens(rawHttpSvc.client).pipe(
      switchMap(tokens => {
        const proactiveReq = req.clone({
          setHeaders: { Authorization: `Bearer ${tokens.accessToken}` }
        });
        return next(proactiveReq);
      }),
      catchError(() => {
        auth.logout(false);
        return throwError(() => new Error('Session expired'));
      })
    );
  }

  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && auth.getAccessToken()) {
        return auth.refreshTokens(rawHttpSvc.client).pipe(
          switchMap(tokens => {
            const retried = req.clone({
              setHeaders: { Authorization: `Bearer ${tokens.accessToken}` }
            });
            return next(retried);
          }),
          catchError(refreshError => {
            auth.logout(false);
            return throwError(() => refreshError);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
```

# app\core\services\auth.service.ts

```ts
import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, Subject, throwError, filter, take, switchMap, of } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from './token-storage.service';
import { UserService } from './user.service';
import { DashboardContextService } from './dashboard-context.service';
import { RawHttpService } from './raw-http.service';

export interface AuthTokens { accessToken: string; }
export interface GoogleAuthResponse extends AuthTokens { isNewUser: boolean; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http             = inject(HttpClient);
  private readonly rawHttpSvc       = inject(RawHttpService); // ← singleton
  private readonly router           = inject(Router);
  private readonly storage          = inject(TokenStorageService);
  private readonly userService      = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly API = environment.apiUrl;

  isAuthenticated = signal(!!this.storage.getAccessToken());

  private readonly _logout$ = new Subject<void>();
  readonly logout$ = this._logout$.asObservable();

  private isRefreshing = false;
  private refreshSubject = new BehaviorSubject<AuthTokens | null>(null);

  login(email: string, password: string): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(`${this.API}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(tap(tokens => this.saveTokens(tokens)));
  }

  register(email: string, password: string, firstName: string, lastName: string): Observable<AuthTokens> {
    return this.http
      .post<AuthTokens>(`${this.API}/auth/register`, { email, password, firstName, lastName }, { withCredentials: true })
      .pipe(tap(tokens => this.saveTokens(tokens)));
  }

  loginWithGoogle(idToken: string): Observable<GoogleAuthResponse> {
    return this.http
      .post<GoogleAuthResponse>(`${this.API}/auth/google`, { idToken }, { withCredentials: true })
      .pipe(tap(result => this.saveTokens(result)));
  }

  // ─── refreshTokens ─────────────────────────────────────────────────────────
  // Accepte un HttpClient externe pour SessionRestoreService (app init),
  // utilise le singleton interne par défaut pour tous les autres cas.
  refreshTokens(rawHttp = this.rawHttpSvc.client): Observable<AuthTokens> {
    if (this.isRefreshing) {
      return this.refreshSubject.pipe(filter(t => t !== null), take(1), switchMap(t => of(t!)));
    }
    this.isRefreshing = true;
    this.refreshSubject.next(null);

    return rawHttp
      .post<AuthTokens>(`${this.API}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(tokens => {
          this.saveTokens(tokens);
          this.refreshSubject.next(tokens);
          this.isRefreshing = false;
        }),
        catchError(error => {
          this.isRefreshing = false;
          this.refreshSubject.complete();
          this.refreshSubject = new BehaviorSubject<AuthTokens | null>(null);

          this.dashboardContext.clearForCurrentUser();
          this.userService.clear();
          this.storage.clearAll();
          this.isAuthenticated.set(false);

          return throwError(() => error);
        })
      );
  }

  // ─── Ordre garanti : storage → userService → dashboardContext ──────────────
  saveTokens(tokens: AuthTokens): void {
    this.storage.saveAccessToken(tokens.accessToken); // 1
    this.userService.refresh();                        // 2 — userId disponible
    this.dashboardContext.loadForUser();               // 3 — charge clé _userId
    this.isAuthenticated.set(true);
  }

  getAccessToken(): string | null {
    return this.storage.getAccessToken();
  }

  // ─── Ordre garanti : clearForCurrentUser → clear → clearAll → navigate ─────
  logout(revokeOnServer = true): void {
    const completeLogout = () => {
      this.dashboardContext.clearForCurrentUser(); // 1 — userId encore dispo
      this.userService.clear();                    // 2 — userId devient null
      this.storage.clearAll();                     // 3
      this.isAuthenticated.set(false);
      this.isRefreshing = false;
      this.refreshSubject.next(null);
      this._logout$.next();                        // 4 — composants se vident
      this.router.navigate(['/login']);            // 5
    };

    if (revokeOnServer) {
      this.rawHttpSvc.client
        .post(`${this.API}/auth/revoke`, { revokeAll: false }, { withCredentials: true })
        .pipe(finalize(completeLogout))
        .subscribe({ error: () => {} });
    } else {
      completeLogout();
    }
  }
}
```

# app\core\services\dashboard-context.service.ts

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { UserService } from './user.service';
import { Project } from '../../features/dashboard/projects/projects.types';

@Injectable({ providedIn: 'root' })
export class DashboardContextService {
  private readonly userService = inject(UserService);

  readonly selectedProject = signal<Project | null>(null);

  private storageKey(userId: string): string {
    return `selectedProject_${userId}`;
  }

  // ─── Appelé par AuthService.saveTokens(), APRÈS userService.refresh() ──────
  //
  // CRITIQUE : set(null) en PREMIER, toujours, avant toute lecture localStorage.
  // Sans ce reset explicite, si la session précédente avait un projet en mémoire
  // via setProject() mais que le nouvel utilisateur n'a rien en localStorage,
  // le signal garde l'ancienne valeur et la sidebar affiche l'ancien projet.
  //
  loadForUser(): void {
    this.selectedProject.set(null); // reset immédiat, sans condition

    const userId = this.userService.userId();
    if (!userId) return;

    const raw = localStorage.getItem(this.storageKey(userId));
    if (!raw) return;

    try {
      this.selectedProject.set(JSON.parse(raw));
    } catch {
      localStorage.removeItem(this.storageKey(userId));
    }
  }

  // ─── Appelé par AuthService.logout(), AVANT userService.clear() ────────────
  clearForCurrentUser(): void {
    const userId = this.userService.userId();
    if (userId) {
      localStorage.removeItem(this.storageKey(userId));
    }
    // Efface le signal immédiatement — la sidebar voit null avant la navigation
    this.selectedProject.set(null);
  }

  setProject(project: Project): void {
    const userId = this.userService.userId();
    if (!userId) return;
    this.selectedProject.set(project);
    localStorage.setItem(this.storageKey(userId), JSON.stringify(project));
  }

  readonly plan = computed(() =>
    this.userService.profile()?.plan ?? 'Free'
  );

  readonly projectLimit = computed(() => {
    switch (this.plan()) {
      case 'Team': return Infinity;
      case 'Pro':  return 10;
      default:     return 1;
    }
  });
}
```

# app\core\services\google-auth.service.ts

```ts
import { Injectable, NgZone, inject } from '@angular/core';
import { environment } from '../../../environments/environment';

export type GoogleButtonText =
  | 'signin_with'
  | 'signup_with'
  | 'continue_with'
  | 'signin';

@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private readonly zone = inject(NgZone);
  private initialized  = false;  
  private activeCallback?: (response: google.accounts.id.CredentialResponse) => void;

  load(): Promise<void> {
    return new Promise(resolve => {
      if (typeof google !== 'undefined') {
        resolve();
        return;
      }

      const interval = setInterval(() => {
        if (typeof google !== 'undefined') {
          clearInterval(interval);
          resolve();
        }
      }, 100);

      setTimeout(() => clearInterval(interval), 10_000);
    });
  }

  private ensureInitialized(): void {
    if (this.initialized) return;

    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      // Le callback dispatch vers le callback actif
      callback: (response) => {
        this.zone.run(() => this.activeCallback?.(response));
      },
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    this.initialized = true;
  }

  // ─── Rendu du bouton avec callback spécifique ─────────────
  renderButton(
    elementId: string,
    callback: (response: google.accounts.id.CredentialResponse) => void,
    text: GoogleButtonText = 'continue_with'
  ): void {
    // Enregistre le callback actif pour ce bouton
    this.activeCallback = callback;

    this.ensureInitialized();

    const el = document.getElementById(elementId);
    if (!el) {
      console.warn(`[GoogleAuth] Element #${elementId} not found`);
      return;
    }

    google.accounts.id.renderButton(el, {
      type: 'standard',
      shape: 'rectangular',
      theme: 'outline',
      text,
      size: 'large',
      logo_alignment: 'left',
    });
  }
  // ─── Reset au logout ──────────────────────────────────────
  reset(): void {
    this.initialized = false;
    this.activeCallback = undefined;

    if (typeof google !== 'undefined') {
      google.accounts.id.cancel();
    }
  }
}

```

# app\core\services\raw-http.service.ts

```ts
import { Injectable, inject } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';

/**
 * Fournit un HttpClient singleton qui bypasse tous les intercepteurs.
 * Utilisé pour les appels auth (refresh, revoke) qui ne doivent pas
 * être interceptés par authInterceptor — évite les boucles infinies
 * et les race conditions dues à la recréation de HttpClient dans l'intercepteur.
 */
@Injectable({ providedIn: 'root' })
export class RawHttpService {
  readonly client = new HttpClient(inject(HttpBackend));
}
```

# app\core\services\session-restore.service.ts

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { AuthService } from './auth.service';
import { catchError, of, firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionRestoreService {
  private readonly auth    = inject(AuthService);
  private readonly backend = inject(HttpBackend);

  async restore(): Promise<void> {
    // Access token déjà en mémoire — pas besoin de refresh
    if (this.auth.getAccessToken()) return;

    const rawHttp = new HttpClient(this.backend);

    await firstValueFrom(
      this.auth.refreshTokens(rawHttp).pipe(
        catchError(() => of(null)) // pas de cookie valide — utilisateur non connecté
      )
    );
  }
}
```

# app\core\services\token-storage.service.ts

```ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  // Access token en mémoire — perdu au refresh de page (normal)
  private accessToken: string | null = null;

  // ─── Access token (mémoire) ───────────────────────────────
  saveAccessToken(token: string): void {
    this.accessToken = token;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  clearAccessToken(): void {
    this.accessToken = null;
  }

  // ─── Refresh token (httpOnly cookie géré par le navigateur) ──
  // Le refresh token est envoyé automatiquement par le navigateur
  // via withCredentials — on ne le lit jamais côté JS

  // ─── JWT decode pour expiration proactive ─────────────────
  getTokenExpiration(): Date | null {
    if (!this.accessToken) return null;

    try {
      const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
      return payload.exp ? new Date(payload.exp * 1000) : null;
    } catch {
      return null;
    }
  }

  isTokenExpiringSoon(thresholdSeconds = 60): boolean {
    const exp = this.getTokenExpiration();
    if (!exp) return false;
    return (exp.getTime() - Date.now()) < thresholdSeconds * 1000;
  }

  // ─── Clear complet ─────────────────────────────────────────
  clearAll(): void {
    this.accessToken = null;
    // Le cookie refresh_token est supprimé par le backend via /auth/revoke
  }
}
```

# app\core\services\user.service.ts

```ts
import { Injectable, inject, signal, computed } from '@angular/core';
import { TokenStorageService } from './token-storage.service';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly storage = inject(TokenStorageService);

  private readonly _profile = signal<UserProfile | null>(this.decodeProfile());

  readonly profile  = this._profile.asReadonly();
  readonly userId   = computed(() => this._profile()?.id ?? null);

  readonly fullName = computed(() => {
    const p = this._profile();
    if (!p) return '';
    return `${p.firstName} ${p.lastName}`.trim();
  });

  readonly initials = computed(() => {
    const p = this._profile();
    if (!p) return '??';
    return `${p.firstName[0] ?? ''}${p.lastName[0] ?? ''}`.toUpperCase();
  });

  refresh(): void {
    this._profile.set(this.decodeProfile());
  }

  clear(): void {
    this._profile.set(null);
  }

  private decodeProfile(): UserProfile | null {
    const token = this.storage.getAccessToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const id = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier']
        ?? payload.sub ?? '';
      const email = payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
        ?? payload.email ?? '';
      return {
        id,
        email,
        firstName: payload['firstName'] ?? '',
        lastName:  payload['lastName']  ?? '',
        plan:      payload['plan']      ?? 'Free',
      };
    } catch {
      return null;
    }
  }
}
```

# app\core\types\google.d.ts

```ts
declare namespace google.accounts.id {
  interface IdConfiguration {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }

  interface CredentialResponse {
    credential: string;
    select_by?: string;
  }

  interface GsiButtonConfiguration {
    type?: 'standard' | 'icon';
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    logo_alignment?: 'left' | 'center';
    width?: string | number;
  }

  function initialize(config: IdConfiguration): void;
  function renderButton(parent: HTMLElement, config: GsiButtonConfiguration): void;
  function cancel(): void;
}
```

# app\core\utils\api-error.utils.ts

```ts
import { HttpErrorResponse } from '@angular/common/http';

export function parseApiError(err: HttpErrorResponse): string {
  switch (err.status) {
    case 400:
      if (err.error?.errors) {
        const messages = Object.values(err.error.errors).flat() as string[];
        return messages[0] ?? 'Données invalides.';
      }
      return 'Requête invalide.';
    case 401:
      return 'Email ou mot de passe incorrect.';
    case 409:
      return 'Cette adresse email est déjà utilisée.';
    case 429:
      return 'Trop de tentatives. Réessayez dans quelques minutes.';
    case 0:
    case 503:
      return 'Service indisponible. Vérifiez votre connexion.';
    default:
      return 'Une erreur est survenue. Veuillez réessayer.';
  }
}
```

# app\features\auth\login\login.html

```html
<div class="auth-layout">

  <!-- =============================================
       PANNEAU GAUCHE — Branding
       ============================================= -->
  <aside class="auth-brand">

    <!-- Logo -->
    <a routerLink="/" class="auth-brand__logo" aria-label="AI Review Hub — accueil">
      <svg class="auth-brand__logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"
           fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M32 6c-9 0-16 7-16 16 0 5 2 9 5 12v6h22v-6c3-3 5-7 5-12 0-9-7-16-16-16z"/>
        <path d="M24 40h16M26 46h12"/>
        <circle cx="20" cy="28" r="2"/>
        <circle cx="44" cy="28" r="2"/>
        <circle cx="32" cy="22" r="2"/>
        <line x1="22" y1="28" x2="30" y2="22"/>
        <line x1="42" y1="28" x2="34" y2="22"/>
      </svg>
      <span class="auth-brand__logo-text">AI Review Hub</span>
    </a>

    <!-- Accroche centrale -->
    <div class="auth-brand__body">
      <blockquote class="auth-brand__quote">
        Fini les retours clients perdus dans les emails. Tout est là, trié, priorisé.
      </blockquote>
      <div class="auth-brand__author">
        <div class="auth-brand__avatar">JD</div>
        <div>
          <p class="auth-brand__author-name">Jean Dupont</p>
          <p class="auth-brand__author-role">Directeur technique, Agence Pixel</p>
        </div>
      </div>
    </div>

    <!-- Stats en bas -->
    <div class="auth-brand__stats">
      <div class="auth-brand__stat">
        <span class="auth-brand__stat-value">2 400+</span>
        <span class="auth-brand__stat-label">Équipes actives</span>
      </div>
      <div class="auth-brand__stat-sep" aria-hidden="true"></div>
      <div class="auth-brand__stat">
        <span class="auth-brand__stat-value">98%</span>
        <span class="auth-brand__stat-label">Satisfaction client</span>
      </div>
      <div class="auth-brand__stat-sep" aria-hidden="true"></div>
      <div class="auth-brand__stat">
        <span class="auth-brand__stat-value">‹ 3s</span>
        <span class="auth-brand__stat-label">Analyse IA</span>
      </div>
    </div>

  </aside>


  <!-- =============================================
       PANNEAU DROIT — Formulaire
       ============================================= -->
  <main class="auth-form-panel">
    <div class="auth-form-wrap">

      <!-- En-tête -->
      <div class="auth-form__header">
        <h1 class="auth-form__title">Bon retour.</h1>
        <p class="auth-form__subtitle">Connectez-vous à votre espace.</p>
      </div>

      <!-- Formulaire -->
      <form class="auth-form" (ngSubmit)="onSubmit()" novalidate>

        <!-- Email -->
        <div class="auth-field">
          <label class="auth-field__label" for="email">Adresse email</label>
          <div class="auth-field__input-wrap">
            <svg class="auth-field__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="2" y="4" width="16" height="12" rx="2"/>
              <polyline points="2,4 10,11 18,4"/>
            </svg>
            <input
              id="email"
              name="email"
              class="auth-field__input"
              type="email"
              placeholder="vous@exemple.com"
              autocomplete="email"
              [ngModel]="email()"
              (ngModelChange)="email.set($event)"
              required>
          </div>
        </div>

        <!-- Mot de passe -->
        <div class="auth-field">
          <div class="auth-field__label-row">
            <label class="auth-field__label" for="password">Mot de passe</label>
            <a routerLink="/forgot-password" class="auth-field__forgot">Mot de passe oublié ?</a>
          </div>
          <div class="auth-field__input-wrap">
            <svg class="auth-field__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <rect x="4" y="8" width="12" height="10" rx="2"/>
              <path d="M7 8V6a3 3 0 0 1 6 0v2"/>
            </svg>
            <input
              id="password"
              name="password"
              class="auth-field__input"
              [type]="showPass() ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="current-password"
              [ngModel]="password()"
              (ngModelChange)="password.set($event)"
              required>
            <button
              type="button"
              class="auth-field__toggle"
              (click)="togglePassword()"
              [attr.aria-label]="showPass() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'">
              @if (showPass()) {
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"/>
                  <circle cx="10" cy="10" r="3"/>
                  <line x1="2" y1="2" x2="18" y2="18"/>
                </svg>
              } @else {
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"/>
                  <circle cx="10" cy="10" r="3"/>
                </svg>
              }
            </button>
          </div>
        </div>

        <!-- Erreur -->
        @if (error()) {
          <p class="auth-form__error" role="alert">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="8" cy="8" r="7"/>
              <line x1="8" y1="5" x2="8" y2="8.5"/>
              <circle cx="8" cy="11" r="0.5" fill="currentColor"/>
            </svg>
            {{ error() }}
          </p>
        }

        <!-- Submit -->
        <button
          type="submit"
          class="auth-form__submit"
          [disabled]="loading()"
          [class.auth-form__submit--loading]="loading()">
          @if (loading()) {
            <span class="auth-form__spinner" aria-hidden="true"></span>
            Connexion…
          } @else {
            Se connecter
          }
        </button>

      </form>

      <!-- Séparateur -->
      <div class="auth-sep">
        <span class="auth-sep__line" aria-hidden="true"></span>
        <span class="auth-sep__label">ou</span>
        <span class="auth-sep__line" aria-hidden="true"></span>
      </div>

      <!-- OAuth Google -->
      <button type="button" class="auth-oauth">
        <svg class="auth-oauth__icon" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.39a4.62 4.62 0 0 1-2 3.03v2.52h3.23c1.89-1.74 2.98-4.3 2.98-7.34z" fill="#4285F4"/>
          <path d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.23-2.52c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H1.09v2.6A10 10 0 0 0 10 20z" fill="#34A853"/>
          <path d="M4.41 11.89A6.02 6.02 0 0 1 4.1 10c0-.65.11-1.29.31-1.89V5.51H1.09A10 10 0 0 0 0 10c0 1.61.39 3.14 1.09 4.49l3.32-2.6z" fill="#FBBC05"/>
          <path d="M10 3.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87C14.96.99 12.7 0 10 0A10 10 0 0 0 1.09 5.51l3.32 2.6C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335"/>
        </svg>
        Continuer avec Google
      </button>

      <!-- Bouton Google avec skeleton -->
      <div class="auth-oauth">
        <div id="google-btn-login" [class.auth-oauth-skeleton]="googleLoading()"></div>     
      </div>

      <!-- Lien inscription -->
      <p class="auth-form__switch">
        Pas encore de compte ?
        <a routerLink="/register" class="auth-form__switch-link">Créer un compte</a>
      </p>

    </div>
  </main>

</div>
```

# app\features\auth\login\login.scss

```scss
/* =============================================
   AUTH LAYOUT — page de connexion
   ============================================= */

// Layout split-screen pleine hauteur

.auth-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}


// =============================================
// PANNEAU GAUCHE — Branding sombre
// =============================================

.auth-brand {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 48px;
  background-color: var(--color-dark);
  color: var(--color-white);
  position: relative;
  overflow: hidden;

  // Motif de fond subtil
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle at 20% 20%, rgba(255,255,255,.04) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(255,255,255,.03) 0%, transparent 50%);
    pointer-events: none;
  }

  // Grille de points décorative
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,.08) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    mask-image: linear-gradient(to bottom, transparent, rgba(0,0,0,.4) 30%, rgba(0,0,0,.4) 70%, transparent);
  }
}

// Logo

.auth-brand__logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--color-white);
  text-decoration: none;
  position: relative;
  z-index: 1;
}

.auth-brand__logo-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.auth-brand__logo-text {
  font-family: var(--font-medium);
  font-size: 16px;
  font-weight: 500;
}

// Corps central — citation

.auth-brand__body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  position: relative;
  z-index: 1;
}

.auth-brand__quote {
  font-family: var(--font-base);
  font-size: 26px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--color-white);
  quotes: none;

  &::before { content: '"'; }
  &::after  { content: '"'; }
}

.auth-brand__author {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auth-brand__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-family: var(--font-medium);
  font-size: 13px;
  color: var(--color-white);
  flex-shrink: 0;
}

.auth-brand__author-name {
  font-family: var(--font-medium);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-white);
}

.auth-brand__author-role {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  margin-top: 2px;
}

// Stats en bas

.auth-brand__stats {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 24px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 1;
}

.auth-brand__stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.auth-brand__stat-value {
  font-family: var(--font-medium);
  font-size: 22px;
  font-weight: 500;
  color: var(--color-white);
  line-height: 1;
}

.auth-brand__stat-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.auth-brand__stat-sep {
  width: 1px;
  height: 32px;
  background-color: rgba(255, 255, 255, 0.1);
  margin: 0 24px;
  flex-shrink: 0;
}


// =============================================
// PANNEAU DROIT — Formulaire
// =============================================

.auth-form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 48px;
  background-color: var(--color-white);
}

.auth-form-wrap {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

// En-tête

.auth-form__header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.auth-form__title {
  font-family: var(--font-base);
  font-size: 36px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--color-dark);
}

.auth-form__subtitle {
  font-size: 15px;
  color: var(--color-muted);
}

// Formulaire

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

// Champ

.auth-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.auth-field__label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.auth-field__label {
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-dark);
}

.auth-field__forgot {
  font-size: 13px;
  color: var(--color-muted);
  text-decoration: none;
  transition: color 0.15s ease;

  &:hover { color: var(--color-dark); }
}

.auth-field__input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.auth-field__icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--color-muted);
  pointer-events: none;
  flex-shrink: 0;
}

.auth-field__input {
  width: 100%;
  height: 42px;
  padding: 0 40px 0 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-inner);
  background-color: var(--color-white);
  font-family: var(--font-base);
  font-size: 14px;
  color: var(--color-dark);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &::placeholder { color: rgba(108, 110, 120, 0.6); }

  &:focus {
    border-color: var(--color-dark);
    box-shadow: 0 0 0 3px rgba(20, 21, 26, 0.06);
  }
}

.auth-field__toggle {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted);
  padding: 0;
  transition: color 0.15s ease;

  svg { width: 16px; height: 16px; }

  &:hover { color: var(--color-dark); }
}

// Message d'erreur

.auth-form__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-inner);
  background-color: #FEF2F2;
  border: 1px solid #FECACA;
  font-size: 13px;
  color: #B91C1C;

  svg { width: 14px; height: 14px; flex-shrink: 0; }
}

// Bouton de soumission

.auth-form__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  padding: 0 24px;
  margin-top: 4px;
  border-radius: var(--radius-inner);
  background-color: var(--color-dark);
  color: var(--color-white);
  border: none;
  font-family: var(--font-medium);
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover:not(:disabled) { opacity: 0.85; }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &--loading { opacity: 0.75; }
}

// Spinner

.auth-form__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--color-white);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// Séparateur

.auth-sep {
  display: flex;
  align-items: center;
  gap: 12px;
}

.auth-sep__line {
  flex: 1;
  height: 1px;
  background-color: var(--color-border);
}

.auth-sep__label {
  font-size: 12px;
  color: var(--color-muted);
  white-space: nowrap;
}

// Bouton OAuth

.auth-oauth {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 42px;
  padding: 0 24px;
  border-radius: var(--radius-inner);
  background-color: var(--color-white);
  border: 1px solid var(--color-border);
  font-family: var(--font-medium);
  font-size: 14px;
  color: var(--color-dark);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  &:hover {
    background-color: var(--color-surface-lt);
    border-color: rgba(0, 0, 0, 0.15);
  }
}

// login.scss
.auth-oauth-skeleton {
  height: 44px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  overflow: hidden;

}

@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.auth-oauth__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

// Lien inscription

.auth-form__switch {
  text-align: center;
  font-size: 13px;
  color: var(--color-muted);
}

.auth-form__switch-link {
  font-family: var(--font-medium);
  color: var(--color-dark);
  text-decoration: none;
  font-weight: 500;
  margin-left: 4px;

  &:hover { text-decoration: underline; }
}


// =============================================
// RESPONSIVE
// =============================================

@media (max-width: 1023px) {
  .auth-layout {
    grid-template-columns: 1fr;
  }

  .auth-brand {
    padding: 32px;
    min-height: auto;

    // Cache la citation et les stats sur petit écran
    .auth-brand__body { display: none; }
    .auth-brand__stats { display: none; }
  }

  .auth-form-panel {
    padding: 48px 24px;
  }
}

@media (max-width: 767px) {
  .auth-brand {
    padding: 24px;
  }

  .auth-form__title {
    font-size: 28px;
  }
}
```

# app\features\auth\login\login.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\auth\login\login.ts

```ts
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
```

# app\features\auth\register\register.html

```html
<div class="auth-layout">

  <!-- =============================================
       PANNEAU GAUCHE — Branding
       ============================================= -->
  <aside class="auth-brand">

    <a routerLink="/" class="auth-brand__logo" aria-label="AI Review Hub — accueil">
      <svg class="auth-brand__logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"
           fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
        <path d="M32 6c-9 0-16 7-16 16 0 5 2 9 5 12v6h22v-6c3-3 5-7 5-12 0-9-7-16-16-16z"/>
        <path d="M24 40h16M26 46h12"/>
        <circle cx="20" cy="28" r="2"/>
        <circle cx="44" cy="28" r="2"/>
        <circle cx="32" cy="22" r="2"/>
        <line x1="22" y1="28" x2="30" y2="22"/>
        <line x1="42" y1="28" x2="34" y2="22"/>
      </svg>
      <span class="auth-brand__logo-text">AI Review Hub</span>
    </a>

    <div class="auth-brand__body">

      <!-- Checklist des avantages -->
      <div class="auth-brand__perks">
        <h2 class="auth-brand__perks-title">Tout ce dont vous avez besoin,<br>dès le premier jour.</h2>
        <ul class="auth-brand__perks-list">
          <li class="auth-brand__perk">
            <span class="auth-brand__perk-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 8 6 11.5 13.5 4"/></svg>
            </span>
            1 projet gratuit, sans carte bancaire
          </li>
          <li class="auth-brand__perk">
            <span class="auth-brand__perk-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 8 6 11.5 13.5 4"/></svg>
            </span>
            Analyse IA en moins de 3 secondes
          </li>
          <li class="auth-brand__perk">
            <span class="auth-brand__perk-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 8 6 11.5 13.5 4"/></svg>
            </span>
            Widget intégrable en 2 minutes
          </li>
          <li class="auth-brand__perk">
            <span class="auth-brand__perk-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 8 6 11.5 13.5 4"/></svg>
            </span>
            Tableau kanban prêt à l'emploi
          </li>
          <li class="auth-brand__perk">
            <span class="auth-brand__perk-icon" aria-hidden="true">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="2.5 8 6 11.5 13.5 4"/></svg>
            </span>
            Annulation à tout moment
          </li>
        </ul>
      </div>

      <!-- Avatars sociaux -->
      <div class="auth-brand__social-proof">
        <div class="auth-brand__avatars">
          <div class="auth-brand__av" style="background: #6366f1;">ML</div>
          <div class="auth-brand__av" style="background: #0ea5e9;">SC</div>
          <div class="auth-brand__av" style="background: #10b981;">AR</div>
          <div class="auth-brand__av" style="background: #f59e0b;">PD</div>
          <div class="auth-brand__av auth-brand__av--more">+2k</div>
        </div>
        <p class="auth-brand__social-label">Rejoignez 2 400+ équipes qui font confiance à AI Review Hub</p>
      </div>

    </div>

    <div class="auth-brand__stats">
      <div class="auth-brand__stat">
        <span class="auth-brand__stat-value">Gratuit</span>
        <span class="auth-brand__stat-label">Pour démarrer</span>
      </div>
      <div class="auth-brand__stat-sep" aria-hidden="true"></div>
      <div class="auth-brand__stat">
        <span class="auth-brand__stat-value">50</span>
        <span class="auth-brand__stat-label">Feedbacks offerts</span>
      </div>
      <div class="auth-brand__stat-sep" aria-hidden="true"></div>
      <div class="auth-brand__stat">
        <span class="auth-brand__stat-value">0€</span>
        <span class="auth-brand__stat-label">Sans CB requise</span>
      </div>
    </div>

  </aside>


  <!-- =============================================
       PANNEAU DROIT — Formulaire multi-étapes
       ============================================= -->
  <main class="auth-form-panel">
    <div class="auth-form-wrap">

      <!-- Indicateur d'étapes -->
      <div class="auth-steps" aria-label="Étapes d'inscription">
        <div class="auth-step" [class.auth-step--active]="step() === 1" [class.auth-step--done]="step() > 1">
          <div class="auth-step__dot">
            @if (step() > 1) {
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1.5 6 4.5 9 10.5 3"/></svg>
            } @else {
              <span>1</span>
            }
          </div>
          <span class="auth-step__label">Votre identité</span>
        </div>
        <div class="auth-step__connector" [class.auth-step__connector--done]="step() > 1" aria-hidden="true"></div>
        <div class="auth-step" [class.auth-step--active]="step() === 2">
          <div class="auth-step__dot"><span>2</span></div>
          <span class="auth-step__label">Vos accès</span>
        </div>
      </div>

      <!-- ---- ÉTAPE 1 : Prénom + Nom ---- -->
      @if (step() === 1) {
        <div class="auth-form__header">
          <h1 class="auth-form__title">Faisons connaissance.</h1>
          <p class="auth-form__subtitle">Comment devons-nous vous appeler ?</p>
        </div>

        <div class="auth-form">

          <div class="auth-fields-row">
            <div class="auth-field">
              <label class="auth-field__label" for="firstName">Prénom</label>
              <div class="auth-field__input-wrap">
                <input
                  id="firstName"
                  name="firstName"
                  class="auth-field__input auth-field__input--no-icon"
                  type="text"
                  placeholder="Marie"
                  autocomplete="given-name"
                  [ngModel]="firstName()"
                  (ngModelChange)="firstName.set($event)">
              </div>
            </div>

            <div class="auth-field">
              <label class="auth-field__label" for="lastName">Nom</label>
              <div class="auth-field__input-wrap">
                <input
                  id="lastName"
                  name="lastName"
                  class="auth-field__input auth-field__input--no-icon"
                  type="text"
                  placeholder="Dupont"
                  autocomplete="family-name"
                  [ngModel]="lastName()"
                  (ngModelChange)="lastName.set($event)">
              </div>
            </div>
          </div>

          @if (error()) {
            <p class="auth-form__error" role="alert">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="7"/><line x1="8" y1="5" x2="8" y2="8.5"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/></svg>
              {{ error() }}
            </p>
          }

          <button type="button" class="auth-form__submit" (click)="nextStep()">
            Continuer
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="8" x2="13" y2="8"/><polyline points="9 4 13 8 9 12"/></svg>
          </button>

        </div>
      }

      <!-- ---- ÉTAPE 2 : Email + Mot de passe ---- -->
      @if (step() === 2) {
        <div class="auth-form__header">
          <h1 class="auth-form__title">Bienvenue, {{ firstName() }}.</h1>
          <p class="auth-form__subtitle">Créez vos identifiants de connexion.</p>
        </div>

        <form class="auth-form" (ngSubmit)="onSubmit()" novalidate>

          <!-- Email -->
          <div class="auth-field">
            <label class="auth-field__label" for="email">Adresse email</label>
            <div class="auth-field__input-wrap">
              <svg class="auth-field__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="16" height="12" rx="2"/>
                <polyline points="2,4 10,11 18,4"/>
              </svg>
              <input
                id="email"
                name="email"
                class="auth-field__input"
                type="email"
                placeholder="marie@exemple.com"
                autocomplete="email"
                [ngModel]="email()"
                (ngModelChange)="email.set($event)"
                required>
            </div>
          </div>

          <!-- Mot de passe -->
          <div class="auth-field">
            <label class="auth-field__label" for="password">Mot de passe</label>
            <div class="auth-field__input-wrap">
              <svg class="auth-field__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="4" y="8" width="12" height="10" rx="2"/>
                <path d="M7 8V6a3 3 0 0 1 6 0v2"/>
              </svg>
              <input
                id="password"
                name="password"
                class="auth-field__input"
                [type]="showPass() ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="new-password"
                [ngModel]="password()"
                (ngModelChange)="password.set($event)"
                required>
              <button type="button" class="auth-field__toggle" (click)="togglePassword()" [attr.aria-label]="showPass() ? 'Masquer' : 'Afficher'">
                @if (showPass()) {
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"/><circle cx="10" cy="10" r="3"/>
                    <line x1="2" y1="2" x2="18" y2="18"/>
                  </svg>
                } @else {
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M1 10s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7z"/><circle cx="10" cy="10" r="3"/>
                  </svg>
                }
              </button>
            </div>

            <!-- Jauge de force du mot de passe -->
            @if (password()) {
              <div class="password-strength">
                <div class="password-strength__bars">
                  <div class="password-strength__bar" [class.password-strength__bar--active]="passwordStrength() >= 1" [class]="'password-strength__bar ' + (passwordStrength() >= 1 ? passwordStrengthClass() : '')"></div>
                  <div class="password-strength__bar" [class.password-strength__bar--active]="passwordStrength() >= 2" [class]="'password-strength__bar ' + (passwordStrength() >= 2 ? passwordStrengthClass() : '')"></div>
                  <div class="password-strength__bar" [class.password-strength__bar--active]="passwordStrength() >= 3" [class]="'password-strength__bar ' + (passwordStrength() >= 3 ? passwordStrengthClass() : '')"></div>
                  <div class="password-strength__bar" [class.password-strength__bar--active]="passwordStrength() >= 4" [class]="'password-strength__bar ' + (passwordStrength() >= 4 ? passwordStrengthClass() : '')"></div>
                </div>
                <span class="password-strength__label" [class]="'password-strength__label--' + passwordStrengthClass()">
                  {{ passwordStrengthLabel() }}
                </span>
              </div>
            }
          </div>

          @if (error()) {
            <p class="auth-form__error" role="alert">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="7"/><line x1="8" y1="5" x2="8" y2="8.5"/><circle cx="8" cy="11" r="0.5" fill="currentColor"/></svg>
              {{ error() }}
            </p>
          }

          <div class="auth-form__actions">
            <button type="button" class="auth-form__back" (click)="prevStep()">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="13" y1="8" x2="3" y2="8"/><polyline points="7 12 3 8 7 4"/></svg>
              Retour
            </button>

            <button
              type="submit"
              class="auth-form__submit"
              [disabled]="loading()"
              [class.auth-form__submit--loading]="loading()">
              @if (loading()) {
                <span class="auth-form__spinner" aria-hidden="true"></span>
                Création…
              } @else {
                Créer mon compte
              }
            </button>
          </div>

          <p class="auth-form__legal">
            En créant un compte, vous acceptez nos
            <a routerLink="/terms" class="auth-form__legal-link">Conditions d'utilisation</a>
            et notre
            <a routerLink="/privacy" class="auth-form__legal-link">Politique de confidentialité</a>.
          </p>

        </form>
      }

      <!-- Séparateur + OAuth (étape 1 uniquement) -->
      @if (step() === 1) {
        <div class="auth-sep">
          <span class="auth-sep__line" aria-hidden="true"></span>
          <span class="auth-sep__label">ou</span>
          <span class="auth-sep__line" aria-hidden="true"></span>
        </div>

        <button type="button" class="auth-oauth">
          <svg class="auth-oauth__icon" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M19.6 10.23c0-.68-.06-1.36-.18-2H10v3.79h5.39a4.62 4.62 0 0 1-2 3.03v2.52h3.23c1.89-1.74 2.98-4.3 2.98-7.34z" fill="#4285F4"/>
            <path d="M10 20c2.7 0 4.96-.9 6.62-2.43l-3.23-2.52c-.9.6-2.04.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H1.09v2.6A10 10 0 0 0 10 20z" fill="#34A853"/>
            <path d="M4.41 11.89A6.02 6.02 0 0 1 4.1 10c0-.65.11-1.29.31-1.89V5.51H1.09A10 10 0 0 0 0 10c0 1.61.39 3.14 1.09 4.49l3.32-2.6z" fill="#FBBC05"/>
            <path d="M10 3.96c1.47 0 2.79.51 3.83 1.5l2.87-2.87C14.96.99 12.7 0 10 0A10 10 0 0 0 1.09 5.51l3.32 2.6C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335"/>
          </svg>
          Continuer avec Google
        </button>

        <div class="auth-oauth-wrap">
          <div id="google-btn-register" [class.auth-oauth-skeleton]="googleLoading()"></div>
        </div>
      }

      <!-- Lien connexion -->
      <p class="auth-form__switch">
        Déjà un compte ?
        <a routerLink="/login" class="auth-form__switch-link">Se connecter</a>
      </p>

    </div>
  </main>

</div>
```

# app\features\auth\register\register.scss

```scss
/* =============================================
   REGISTER — reprend le design system auth
   ============================================= */

// Layout identique à la page login

.auth-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}


// =============================================
// PANNEAU GAUCHE
// =============================================

.auth-brand {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 40px 48px;
  background-color: var(--color-dark);
  color: var(--color-white);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(circle at 20% 20%, rgba(255,255,255,.04) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(255,255,255,.03) 0%, transparent 50%);
    pointer-events: none;
  }

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,.08) 1px, transparent 1px);
    background-size: 28px 28px;
    pointer-events: none;
    mask-image: linear-gradient(to bottom, transparent, rgba(0,0,0,.4) 30%, rgba(0,0,0,.4) 70%, transparent);
  }
}

.auth-brand__logo {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: var(--color-white);
  text-decoration: none;
  position: relative;
  z-index: 1;
}

.auth-brand__logo-icon { width: 28px; height: 28px; flex-shrink: 0; }

.auth-brand__logo-text {
  font-family: var(--font-medium);
  font-size: 16px;
  font-weight: 500;
}

.auth-brand__body {
  display: flex;
  flex-direction: column;
  gap: 40px;
  position: relative;
  z-index: 1;
}

// Checklist

.auth-brand__perks { display: flex; flex-direction: column; gap: 20px; }

.auth-brand__perks-title {
  font-family: var(--font-base);
  font-size: 26px;
  font-weight: 400;
  line-height: 1.35;
  color: var(--color-white);
}

.auth-brand__perks-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.auth-brand__perk {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.8);
}

.auth-brand__perk-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background-color: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.15);
  flex-shrink: 0;

  svg { width: 12px; height: 12px; color: var(--color-white); }
}

// Social proof — avatars

.auth-brand__social-proof {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-brand__avatars {
  display: flex;
  align-items: center;
}

.auth-brand__av {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid var(--color-dark);
  font-family: var(--font-medium);
  font-size: 11px;
  font-weight: 500;
  color: var(--color-white);
  margin-left: -8px;
  flex-shrink: 0;

  &:first-child { margin-left: 0; }

  &--more {
    background-color: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.2);
    font-size: 10px;
  }
}

.auth-brand__social-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
}

// Stats

.auth-brand__stats {
  display: flex;
  align-items: center;
  padding: 24px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  z-index: 1;
}

.auth-brand__stat { display: flex; flex-direction: column; gap: 4px; flex: 1; }

.auth-brand__stat-value {
  font-family: var(--font-medium);
  font-size: 20px;
  font-weight: 500;
  color: var(--color-white);
  line-height: 1;
}

.auth-brand__stat-label { font-size: 12px; color: rgba(255, 255, 255, 0.5); }

.auth-brand__stat-sep {
  width: 1px;
  height: 32px;
  background-color: rgba(255, 255, 255, 0.1);
  margin: 0 24px;
  flex-shrink: 0;
}


// =============================================
// PANNEAU DROIT
// =============================================

.auth-form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 48px;
  background-color: var(--color-white);
}

.auth-form-wrap {
  width: 100%;
  max-width: 420px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

// Indicateur d'étapes

.auth-steps {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 8px;
}

.auth-step {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auth-step__dot {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1.5px solid var(--color-border);
  background-color: var(--color-white);
  font-family: var(--font-medium);
  font-size: 12px;
  color: var(--color-muted);
  flex-shrink: 0;
  transition: all 0.2s ease;

  svg { width: 12px; height: 12px; }

  .auth-step--active & {
    border-color: var(--color-dark);
    background-color: var(--color-dark);
    color: var(--color-white);
  }

  .auth-step--done & {
    border-color: var(--color-dark);
    background-color: var(--color-dark);
    color: var(--color-white);
  }
}

.auth-step__label {
  font-size: 13px;
  color: var(--color-muted);
  transition: color 0.2s ease;

  .auth-step--active & { color: var(--color-dark); font-family: var(--font-medium); }
  .auth-step--done &   { color: var(--color-dark); }
}

.auth-step__connector {
  flex: 1;
  height: 1px;
  background-color: var(--color-border);
  margin: 0 12px;
  transition: background-color 0.2s ease;

  &--done { background-color: var(--color-dark); }
}

// En-tête

.auth-form__header { display: flex; flex-direction: column; gap: 6px; }

.auth-form__title {
  font-family: var(--font-base);
  font-size: 36px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--color-dark);
}

.auth-form__subtitle { font-size: 15px; color: var(--color-muted); }

// Formulaire

.auth-form { display: flex; flex-direction: column; gap: 16px; }

// 2 champs côte à côte

.auth-fields-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

// Champ

.auth-field { display: flex; flex-direction: column; gap: 6px; }

.auth-field__label-row { display: flex; align-items: center; justify-content: space-between; }

.auth-field__label {
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-dark);
}

.auth-field__input-wrap { position: relative; display: flex; align-items: center; }

.auth-field__icon {
  position: absolute;
  left: 12px;
  width: 16px;
  height: 16px;
  color: var(--color-muted);
  pointer-events: none;
}

.auth-field__input {
  width: 100%;
  height: 42px;
  padding: 0 40px 0 40px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-inner);
  background-color: var(--color-white);
  font-family: var(--font-base);
  font-size: 14px;
  color: var(--color-dark);
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;

  &--no-icon { padding-left: 14px; }

  &::placeholder { color: rgba(108, 110, 120, 0.6); }

  &:focus {
    border-color: var(--color-dark);
    box-shadow: 0 0 0 3px rgba(20, 21, 26, 0.06);
  }
}

.auth-field__toggle {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted);
  padding: 0;
  transition: color 0.15s ease;
  svg { width: 16px; height: 16px; }
  &:hover { color: var(--color-dark); }
}

// Jauge de force du mot de passe

.password-strength {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
}

.password-strength__bars {
  display: flex;
  gap: 4px;
  flex: 1;
}

.password-strength__bar {
  flex: 1;
  height: 3px;
  border-radius: 2px;
  background-color: var(--color-border);
  transition: background-color 0.2s ease;

  &.weak   { background-color: #EF4444; }
  &.fair   { background-color: #F59E0B; }
  &.good   { background-color: #3B82F6; }
  &.strong { background-color: #10B981; }
}

.password-strength__label {
  font-size: 12px;
  white-space: nowrap;
  color: var(--color-muted);

  &--weak   { color: #EF4444; }
  &--fair   { color: #F59E0B; }
  &--good   { color: #3B82F6; }
  &--strong { color: #10B981; }
}

// Erreur

.auth-form__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: var(--radius-inner);
  background-color: #FEF2F2;
  border: 1px solid #FECACA;
  font-size: 13px;
  color: #B91C1C;
  svg { width: 14px; height: 14px; flex-shrink: 0; }
}

// Actions étape 2 : bouton retour + submit

.auth-form__actions {
  display: flex;
  gap: 10px;
  margin-top: 4px;
}

.auth-form__back {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 42px;
  padding: 0 16px;
  border-radius: var(--radius-inner);
  background-color: transparent;
  border: 1px solid var(--color-border);
  font-family: var(--font-medium);
  font-size: 14px;
  color: var(--color-dark);
  cursor: pointer;
  transition: background-color 0.15s ease;
  flex-shrink: 0;
  svg { width: 14px; height: 14px; }
  &:hover { background-color: var(--color-surface-lt); }
}

// Bouton submit

.auth-form__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 42px;
  padding: 0 24px;
  border-radius: var(--radius-inner);
  background-color: var(--color-dark);
  color: var(--color-white);
  border: none;
  font-family: var(--font-medium);
  font-size: 14px;
  cursor: pointer;
  transition: opacity 0.15s ease;

  svg { width: 14px; height: 14px; }

  &:hover:not(:disabled) { opacity: 0.85; }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
  &--loading { opacity: 0.75; }
}

.auth-form__actions .auth-form__submit {
  flex: 1;
}

.auth-form__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: var(--color-white);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.auth-oauth-skeleton {
  height: 44px;
  border-radius: 4px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s infinite;
  overflow: hidden;

}

@keyframes skeleton-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}


// Mention légale

.auth-form__legal {
  font-size: 12px;
  line-height: 1.6;
  color: var(--color-muted);
  text-align: center;
}

.auth-form__legal-link {
  color: var(--color-dark);
  text-decoration: underline;
  text-underline-offset: 2px;
}

// Séparateur

.auth-sep { display: flex; align-items: center; gap: 12px; }
.auth-sep__line { flex: 1; height: 1px; background-color: var(--color-border); }
.auth-sep__label { font-size: 12px; color: var(--color-muted); white-space: nowrap; }

// OAuth Google

.auth-oauth {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  height: 42px;
  padding: 0 24px;
  border-radius: var(--radius-inner);
  background-color: var(--color-white);
  border: 1px solid var(--color-border);
  font-family: var(--font-medium);
  font-size: 14px;
  color: var(--color-dark);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
  &:hover { background-color: var(--color-surface-lt); border-color: rgba(0,0,0,.15); }
}

.auth-oauth__icon { width: 18px; height: 18px; flex-shrink: 0; }

// Lien connexion

.auth-form__switch { text-align: center; font-size: 13px; color: var(--color-muted); }

.auth-form__switch-link {
  font-family: var(--font-medium);
  color: var(--color-dark);
  text-decoration: none;
  font-weight: 500;
  margin-left: 4px;
  &:hover { text-decoration: underline; }
}


// =============================================
// RESPONSIVE
// =============================================

@media (max-width: 1023px) {
  .auth-layout { grid-template-columns: 1fr; }

  .auth-brand {
    padding: 32px;
    .auth-brand__body  { display: none; }
    .auth-brand__stats { display: none; }
  }

  .auth-form-panel { padding: 48px 24px; }
}

@media (max-width: 767px) {
  .auth-brand { padding: 24px; }
  .auth-form__title { font-size: 28px; }
  .auth-fields-row { grid-template-columns: 1fr; }
}
```

# app\features\auth\register\register.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Register } from './register';

describe('Register', () => {
  let component: Register;
  let fixture: ComponentFixture<Register>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Register],
    }).compileComponents();

    fixture = TestBed.createComponent(Register);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\auth\register\register.ts

```ts
import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';
import { GoogleAuthService } from '../../../core/services/google-auth.service';
import { parseApiError } from '../../../core/utils/api-error.utils';


@Component({
  selector: 'app-register',
  imports: [CommonModule, RouterLink, FormsModule],
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

```

# app\features\dashboard\feedbacks\feedbacks.html

```html
<!-- feedbacks.html -->
<div class="feedbacks">

  <!-- ── En-tête ──────────────────────────────────────────── -->
  <header class="feedbacks__header">
    <div>
      <h1 class="feedbacks__title">Feedbacks</h1>
      <p class="feedbacks__subtitle">
        {{ totalCount() }} feedback{{ totalCount() > 1 ? 's' : '' }} au total
      </p>
    </div>

    <div class="feedbacks__export-wrap" [title]="!isPro ? 'Disponible à partir du plan Pro (9€/mois)' : ''">
      <button class="feedbacks__export-btn" [disabled]="exporting() || totalCount() === 0"
        [class.feedbacks__export-btn--loading]="exporting()" (click)="exportCsv()" title="Exporter en CSV">
    @if (exporting()) {
    <span class="feedbacks__export-spinner"></span>
    Export…
    } @else {
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M8 2v9" />
      <polyline points="4 8 8 12 12 8" />
      <line x1="2" y1="14" x2="14" y2="14" />
    </svg>
    Exporter CSV
    }</button>
    </div>
  </header>

  <!-- ── Filtres ───────────────────────────────────────────── -->
  <div class="feedbacks__filters">

    <!-- Recherche -->
    <div class="filter-search">
      <svg class="filter-search__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <line x1="13" y1="13" x2="18" y2="18" />
      </svg>
      <input class="filter-search__input" type="search" placeholder="Rechercher un feedback…" [value]="searchValue()"
        (input)="onSearch($any($event.target).value)">
    </div>

    <!-- Catégorie -->
    <select class="filter-select" [value]="categoryFilter()" (change)="onCategoryChange($any($event.target).value)">
      <option value="">Toutes les catégories</option>
      @for (cat of categories; track cat) {
      <option [value]="cat">{{ getCategoryFilterLabel(cat) }}</option>
      }
    </select>

    <!-- Priorité -->
    <select class="filter-select" [value]="priorityFilter()" (change)="onPriorityChange($any($event.target).value)">
      <option value="">Toutes les priorités</option>
      @for (pri of priorities; track pri) {
      <option [value]="pri">{{ getPriorityLabel(pri) }}</option>
      }
    </select>

    <!-- Reset -->
    @if (hasActiveFilters()) {
    <button class="filter-reset" (click)="clearFilters()">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
        stroke-linejoin="round">
        <line x1="2" y1="2" x2="14" y2="14" />
        <line x1="14" y1="2" x2="2" y2="14" />
      </svg>
      Réinitialiser
    </button>
    }
  </div>

  <!-- ── Loading ───────────────────────────────────────────── -->
  @if (loading()) {
  <div class="feedbacks__loading">
    @for (col of columns; track col.status) {
    <div class="kanban-skeleton">
      <div class="kanban-skeleton__header"></div>
      @for (i of [1,2,3]; track i) {
      <div class="kanban-skeleton__card"></div>
      }
    </div>
    }
  </div>
  }

  <!-- ── Erreur ─────────────────────────────────────────────── -->
  @if (error()) {
  <div class="feedbacks__error">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
      stroke-linejoin="round">
      <circle cx="10" cy="10" r="8" />
      <line x1="10" y1="6" x2="10" y2="10.5" />
      <circle cx="10" cy="14" r="0.5" fill="currentColor" />
    </svg>
    {{ error() }}
    <button class="feedbacks__error-retry" (click)="load()">Réessayer</button>
  </div>
  }

  <!-- ── Kanban ─────────────────────────────────────────────── -->
  @if (!loading() && !error()) {
  <div class="kanban">

    @for (col of columns; track col.status) {
    <div class="kanban__col" [class.kanban__col--dragover]="dragging() && dragging()!.status !== col.status"
      (dragover)="onDragOver($event)" (drop)="onDrop(col.status)">

      <!-- Header colonne -->
      <div class="kanban__col-header" [attr.data-color]="col.color">
        <div class="kanban__col-title">
          <span class="kanban__col-dot" [attr.data-color]="col.color"></span>
          {{ col.label }}
        </div>
        <span class="kanban__col-count">
          {{ getColumnFeedbacks(col.status).length }}
        </span>
      </div>

      <!-- Cards -->
      <div class="kanban__cards">

        @if (getColumnFeedbacks(col.status).length === 0) {
        <div class="kanban__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="9" y1="12" x2="15" y2="12" />
          </svg>
          Aucun feedback
        </div>
        }

        @for (fb of getColumnFeedbacks(col.status); track trackById($index, fb)) {
        <article class="fb-card" [class.fb-card--dragging]="dragging()?.id === fb.id"
          [class.fb-card--done]="fb.status === 'Done'" [attr.data-priority]="fb.priority" draggable="true"
          (dragstart)="onDragStart(fb)" (dragend)="onDragEnd()">

          <!-- Badge IA -->
          @if (fb.aiAnalysisStatus !== 'Completed') {
          <div class="fb-card__ai">
            @switch (fb.aiAnalysisStatus) {
            @case ('Pending') {
            <span class="ai-badge ai-badge--pending">
              <span class="ai-badge__dot"></span>
              En attente
            </span>
            }
            @case ('Processing') {
            <span class="ai-badge ai-badge--processing">
              <span class="ai-badge__spinner"></span>
              Analyse IA…
            </span>
            }
            @case ('Failed') {
            <span class="ai-badge ai-badge--failed">
              ⚠️ Échec IA
            </span>
            }
            @default { }
            }
          </div>
          }

          <!-- Contenu -->
          <p class="fb-card__summary">
            {{ fb.aiSummary || fb.content }}
          </p>

          <!-- Contenu original si résumé IA disponible -->
          @if (fb.aiSummary && fb.aiAnalysisStatus === 'Completed') {
          <p class="fb-card__original">{{ fb.content }}</p>
          }

          <!-- fb-card — section Pro/Team -->
          @if (fb.aiAnalysisStatus === 'Completed' && fb.priorityScore !== null) {

            <!-- Score de priorité Pro -->
            <div class="fb-card__pro-info">

              <!-- Barre de score -->
              <div class="fb-card__score">
                <span class="fb-card__score-label">Score</span>
                <div class="fb-card__score-bar">
                  <div
                    class="fb-card__score-fill"
                    [style.width.%]="fb.priorityScore"
                    [class.fb-card__score-fill--critical]="(fb.priorityScore ?? 0) >= 76"
                    [class.fb-card__score-fill--high]="(fb.priorityScore ?? 0) >= 51 && (fb.priorityScore ?? 0) < 76"
                    [class.fb-card__score-fill--normal]="(fb.priorityScore ?? 0) < 51">
                  </div>
                </div>
                <span class="fb-card__score-value">{{ fb.priorityScore }}/100</span>
              </div>

              <!-- Sentiment -->
              @if (fb.sentiment) {
                <span class="fb-card__sentiment" [attr.data-sentiment]="fb.sentiment">
                  {{ getSentimentEmoji(fb.sentiment) }} {{ fb.sentiment }}
                </span>
              }

              <!-- Action required -->
              @if (fb.actionRequired) {
                <span class="fb-card__action-badge">⚡ Action requise</span>
              }

              <!-- Key topics -->
              @if (fb.keyTopics && fb.keyTopics.length > 0) {
                <div class="fb-card__topics">
                  @for (topic of fb.keyTopics; track topic) {
                    <span class="fb-card__topic">{{ topic }}</span>
                  }
                </div>
              }

            </div>
          }

          <!-- Meta -->
          <div class="fb-card__meta">
            <span class="fb-card__category">
              {{ getCategoryLabel(fb.category) }}
            </span>
            <span class="fb-card__priority" [attr.data-priority]="fb.priority">
              {{ fb.priority }}
            </span>
            <span class="fb-card__date">
              {{ fb.createdAt | date:'dd/MM' }}
            </span>
          </div>

        </article>
        }

      </div>
    </div>
    }

  </div>
  }

</div>
```

# app\features\dashboard\feedbacks\feedbacks.scss

```scss
// feedbacks.scss
.feedbacks {
  padding: 2rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: fadeIn 0.25s ease;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

// ── En-tête ────────────────────────────────────────────────
.feedbacks__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.feedbacks__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem;
}

.feedbacks__subtitle {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0;
}

// ── Filtres ────────────────────────────────────────────────
.feedbacks__filters {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-search {
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 320px;

  &__icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: var(--color-text-secondary);
    pointer-events: none;
  }

  &__input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
    background: var(--color-background-primary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s ease;

    &:focus { border-color: var(--color-accent, #3B82F6); }
    &::placeholder { color: var(--color-text-secondary); }
  }
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease;

  &:focus { border-color: var(--color-accent, #3B82F6); }
}

.filter-reset {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;

  svg { width: 12px; height: 12px; }

  &:hover {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
  }
}

// ── Kanban ─────────────────────────────────────────────────
.kanban {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}

.kanban__col {
  display: flex;
  flex-direction: column;
  background: var(--color-background-secondary);
  border-radius: 12px;
  border: 2px solid transparent;
  overflow: hidden;
  transition: border-color 0.15s ease, background 0.15s ease;

  &--dragover {
    border-color: var(--color-accent, #3B82F6);
    background: color-mix(in srgb, var(--color-accent, #3B82F6) 5%, var(--color-background-secondary));
  }
}

.kanban__col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border-tertiary);
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 1;
}

.kanban__col-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.kanban__col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &[data-color="amber"]   { background: #F59E0B; }
  &[data-color="violet"]  { background: #8B5CF6; }
  &[data-color="emerald"] { background: #10B981; }
}

.kanban__col-count {
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--color-background-primary);
  border-radius: 20px;
  padding: 0.15rem 0.6rem;
  color: var(--color-text-secondary);
}

.kanban__cards {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-primary) transparent;
}

.kanban__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  text-align: center;

  svg { width: 24px; height: 24px; opacity: 0.4; }
}

// ── Cards ──────────────────────────────────────────────────
.fb-card {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-left: 3px solid transparent;
  border-radius: 8px;
  padding: 0.75rem;
  cursor: grab;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  animation: cardIn 0.2s ease both;

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 12px rgba(0,0,0,0.1);
  }

  &:active { cursor: grabbing; }

  &--dragging {
    opacity: 0.4;
    transform: scale(0.98);
  }

  &--done { opacity: 0.65; }

  // Priorité — bordure gauche colorée
  &[data-priority="Critical"] { border-left-color: #F43F5E; }
  &[data-priority="High"]     { border-left-color: #F59E0B; }
  &[data-priority="Normal"]   { border-left-color: #3B82F6; }
  &[data-priority="Low"]      { border-left-color: #9CA3AF; }
}

.fb-card__ai {
  margin-bottom: 0.4rem;
}

.fb-card__summary {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 0.4rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fb-card__original {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-style: italic;
  margin: 0 0 0.5rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fb-card__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.fb-card__category {
  font-size: 0.68rem;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.fb-card__priority {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;

  &[data-priority="Critical"] { background: #FFF1F2; color: #F43F5E; }
  &[data-priority="High"]     { background: #FFF7ED; color: #F59E0B; }
  &[data-priority="Normal"]   { background: #EFF6FF; color: #3B82F6; }
  &[data-priority="Low"]      { background: #F9FAFB; color: #9CA3AF; }
}

.fb-card__date {
  font-size: 0.68rem;
  color: var(--color-text-secondary);
  margin-left: auto;
}

// ── Badges IA ──────────────────────────────────────────────
.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  font-weight: 500;
  padding: 0.15rem 0.45rem;
  border-radius: 20px;

  &--pending {
    background: #FFF7ED;
    color: #C2410C;

    .ai-badge__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #F97316;
    }
  }

  &--processing {
    background: #EFF6FF;
    color: #1D4ED8;

    .ai-badge__spinner {
      width: 8px;
      height: 8px;
      border: 1.5px solid #93C5FD;
      border-top-color: #1D4ED8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  }

  &--failed {
    background: #FFF1F2;
    color: #BE123C;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// ── Skeletons ──────────────────────────────────────────────
.feedbacks__loading {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  flex: 1;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

@mixin shimmer {
  background: linear-gradient(
    90deg,
    var(--color-background-primary) 25%,
    var(--color-border-tertiary) 50%,
    var(--color-background-primary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.kanban-skeleton {
  background: var(--color-background-secondary);
  border-radius: 12px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__header {
    height: 36px;
    border-radius: 6px;
    @include shimmer;
  }

  &__card {
    height: 80px;
    border-radius: 8px;
    @include shimmer;
  }
}
// ── Erreur ─────────────────────────────────────────────────
.feedbacks__error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  border-radius: 8px;
  color: #BE123C;
  font-size: 0.875rem;

  svg { width: 18px; height: 18px; flex-shrink: 0; }
}

.feedbacks__error-retry {
  margin-left: auto;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #FECDD3;
  background: white;
  color: #BE123C;
  font-size: 0.8rem;
  cursor: pointer;

  &:hover { background: #FFF1F2; }
}

// feedbacks.scss — ajouter
.feedbacks__export-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  svg { width: 14px; height: 14px; }

  &:hover:not(:disabled) {
    background: var(--color-background-secondary);
    border-color: var(--color-accent, #3B82F6);
    color: var(--color-accent, #3B82F6);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--loading { cursor: wait; }
}

.feedbacks__export-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-primary);
  border-top-color: var(--color-accent, #3B82F6);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;

  @keyframes spin { to { transform: rotate(360deg); } }
}


// styles Pro
.fb-card__pro-info {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-border-tertiary);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.fb-card__score {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fb-card__score-label {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.fb-card__score-bar {
  flex: 1;
  height: 4px;
  background: var(--color-background-secondary);
  border-radius: 2px;
  overflow: hidden;
}

.fb-card__score-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;

  &--critical { background: #F43F5E; }
  &--high     { background: #F59E0B; }
  &--normal   { background: #3B82F6; }
}

.fb-card__score-value {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.fb-card__sentiment {
  font-size: 0.7rem;
  color: var(--color-text-secondary);

  &[data-sentiment="Frustrated"] { color: #F43F5E; }
  &[data-sentiment="Negative"]   { color: #F59E0B; }
  &[data-sentiment="Positive"]   { color: #10B981; }
}

.fb-card__action-badge {
  font-size: 0.65rem;
  font-weight: 600;
  background: #FFF7ED;
  color: #C2410C;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  display: inline-block;
}

.fb-card__topics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.fb-card__topic {
  font-size: 0.65rem;
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  padding: 0.15rem 0.4rem;
  border-radius: 20px;
  border: 1px solid var(--color-border-tertiary);
}
```

# app\features\dashboard\feedbacks\feedbacks.service.ts

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Feedback, FeedbackFilters, FeedbackStatus, PagedResult } from './feedbacks.types';

@Injectable({ providedIn: 'root' })
export class FeedbacksService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getAll(projectId: string, filters: FeedbackFilters): Observable<PagedResult<Feedback>> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);

    if (filters.category) params = params.set('category', filters.category);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.search) params = params.set('search', filters.search);

    return this.http.get<PagedResult<Feedback>>(
      `${this.API}/projects/${projectId}/feedbacks`,
      { params, withCredentials: true }
    );
  }

  updateStatus(
    projectId: string,
    feedbackId: string,
    newStatus: FeedbackStatus
  ): Observable<void> {
    return this.http.patch<void>(
      `${this.API}/projects/${projectId}/feedbacks/${feedbackId}/status`,
      { newStatus },
      { withCredentials: true }
    );
  }

  exportCsv(
    projectId: string,
    filters: Partial<FeedbackFilters>
  ): Observable<Blob> {
    let params = new HttpParams();
    if (filters.category) params = params.set('category', filters.category);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.status) params = params.set('status', filters.status);

    return this.http.get(
      `${this.API}/projects/${projectId}/feedbacks/export`,
      {
        params,
        responseType: 'blob',
        withCredentials: true
      }
    );
  }
}
```

# app\features\dashboard\feedbacks\feedbacks.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Feedbacks } from './feedbacks';

describe('Feedbacks', () => {
  let component: Feedbacks;
  let fixture: ComponentFixture<Feedbacks>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Feedbacks],
    }).compileComponents();

    fixture = TestBed.createComponent(Feedbacks);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\dashboard\feedbacks\feedbacks.ts

```ts
import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  effect, Injector
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Subject, debounceTime, distinctUntilChanged,
  interval, switchMap, takeWhile, Subscription
} from 'rxjs';
import { FeedbacksService } from './feedbacks.service';
import {
  Feedback, FeedbackCategory, FeedbackFilters,
  FeedbackPriority, FeedbackStatus
} from './feedbacks.types';
import { UserService } from '../../../core/services/user.service';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';

@Component({
  selector: 'app-feedbacks',
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './feedbacks.html',
  styleUrl: './feedbacks.scss',
})
export class Feedbacks implements OnInit, OnDestroy {
  private readonly service = inject(FeedbacksService);
  private readonly injector = inject(Injector);
  private readonly userService = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly search$ = new Subject<string>();
  private pollSub?: Subscription;

  readonly isPro = computed(() => this.userService.profile()?.plan !== 'Free');

  // ─── State ────────────────────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  feedbacks = signal<Feedback[]>([]);
  totalCount = signal(0);
  dragging = signal<Feedback | null>(null);
  exporting = signal(false);

  // ─── Filtres ──────────────────────────────────────────────────────────────
  searchValue = signal('');
  categoryFilter = signal<FeedbackCategory | ''>('');
  priorityFilter = signal<FeedbackPriority | ''>('');
  currentPage = signal(1);
  readonly pageSize = 50;

  // ─── Colonnes kanban ──────────────────────────────────────────────────────
  readonly columns: { status: FeedbackStatus; label: string; color: string }[] = [
    { status: 'Todo', label: 'À traiter', color: 'amber' },
    { status: 'InProgress', label: 'En cours', color: 'violet' },
    { status: 'Done', label: 'Résolus', color: 'emerald' },
  ];

  readonly todoFeedbacks = computed(() => this.feedbacks().filter(f => f.status === 'Todo'));
  readonly inProgressFeedbacks = computed(() => this.feedbacks().filter(f => f.status === 'InProgress'));
  readonly doneFeedbacks = computed(() => this.feedbacks().filter(f => f.status === 'Done'));

  readonly hasActiveFilters = computed(() =>
    !!this.searchValue() || !!this.categoryFilter() || !!this.priorityFilter()
  );

  readonly categories: FeedbackCategory[] = ['Bug', 'FeatureRequest', 'Question', 'Uncategorized'];
  readonly priorities: FeedbackPriority[] = ['Critical', 'High', 'Normal', 'Low'];

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // effect() déclaré dans ngOnInit avec { injector } — compatible Angular 18/19.
    // Dans le constructor, le contexte d'injection n'est plus garanti pour effect()
    // depuis Angular 18, ce qui génère une erreur en mode strict.
    effect(() => {
      const project = this.dashboardContext.selectedProject();

      if (!project?.id) {
        this.feedbacks.set([]);
        this.totalCount.set(0);
        this.loading.set(false);
        return;
      }

      this.currentPage.set(1);
      this.load();
    }, { injector: this.injector });

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage.set(1);
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.search$.complete();
  }

  // ─── Chargement ───────────────────────────────────────────────────────────
  get projectId(): string {
    return this.dashboardContext.selectedProject()?.id ?? '';
  }

  load(): void {
    if (!this.projectId) {
      this.feedbacks.set([]);
      this.totalCount.set(0);
      this.loading.set(false);
      this.error.set('Aucun projet sélectionné.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const filters: FeedbackFilters = {
      search: this.searchValue(),
      category: this.categoryFilter() || undefined,
      priority: this.priorityFilter() || undefined,
      page: this.currentPage(),
      pageSize: this.pageSize,
    };

    this.service.getAll(this.projectId, filters).subscribe({
      next: (result) => {
        this.feedbacks.set(result.data);
        this.totalCount.set(result.meta.total);
        this.loading.set(false);
        this.startPollingIfNeeded();
      },
      error: () => {
        this.error.set('Impossible de charger les feedbacks.');
        this.loading.set(false);
      }
    });
  }

  // ─── Polling IA ───────────────────────────────────────────────────────────
  private startPollingIfNeeded(): void {
    const hasPending = this.feedbacks().some(
      f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
    );

    if (!hasPending || this.pollSub) return;

    const filters: FeedbackFilters = {
      search: this.searchValue(),
      category: this.categoryFilter() || undefined,
      priority: this.priorityFilter() || undefined,
      page: this.currentPage(),
      pageSize: this.pageSize,
    };

    this.pollSub = interval(3000).pipe(
      switchMap(() => this.service.getAll(this.projectId, filters)),
      takeWhile(result =>
        result.data.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        ), true)
    ).subscribe({
      next: (result) => {
        this.feedbacks.set(result.data);
        const stillPending = result.data.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        );
        if (!stillPending) {
          this.pollSub?.unsubscribe();
          this.pollSub = undefined;
        }
      }
    });
  }

  // ─── Filtres ──────────────────────────────────────────────────────────────
  onSearch(value: string): void {
    this.searchValue.set(value);
    this.search$.next(value);
  }

  onCategoryChange(value: string): void {
    this.categoryFilter.set(value as FeedbackCategory | '');
    this.currentPage.set(1);
    this.load();
  }

  onPriorityChange(value: string): void {
    this.priorityFilter.set(value as FeedbackPriority | '');
    this.currentPage.set(1);
    this.load();
  }

  clearFilters(): void {
    this.searchValue.set('');
    this.categoryFilter.set('');
    this.priorityFilter.set('');
    this.currentPage.set(1);
    this.load();
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  onDragStart(feedback: Feedback): void { this.dragging.set(feedback); }
  onDragEnd(): void { this.dragging.set(null); }

  onDrop(status: FeedbackStatus): void {
    const fb = this.dragging();
    if (!fb || fb.status === status) { this.dragging.set(null); return; }

    this.feedbacks.update(list => list.map(f => f.id === fb.id ? { ...f, status } : f));
    this.dragging.set(null);

    this.service.updateStatus(this.projectId, fb.id, status).subscribe({
      error: () => {
        this.feedbacks.update(list =>
          list.map(f => f.id === fb.id ? { ...f, status: fb.status } : f)
        );
        this.error.set('Impossible de mettre à jour le statut.');
      }
    });
  }

  onDragOver(event: DragEvent): void { event.preventDefault(); }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      Bug: '🐛 Bug', FeatureRequest: '✨ Feature',
      Question: '❓ Question', Uncategorized: '📝 Autre',
    };
    return map[category] ?? category;
  }

  getCategoryFilterLabel(category: string): string {
    const map: Record<string, string> = {
      Bug: '🐛 Bug', FeatureRequest: '✨ Fonctionnalité',
      Question: '❓ Question', Uncategorized: '📝 Non catégorisé',
    };
    return map[category] ?? category;
  }

  getPriorityLabel(priority: string): string {
    const map: Record<string, string> = {
      Critical: '🔴 Critique', High: '🟠 Haute',
      Normal: '🔵 Normale', Low: '⚪ Basse',
    };
    return map[priority] ?? priority;
  }

  getColumnFeedbacks(status: FeedbackStatus): Feedback[] {
    return this.feedbacks().filter(f => f.status === status);
  }

  trackById(_: number, item: Feedback): string { return item.id; }

  exportCsv(): void {
    if (this.exporting()) return;
    this.exporting.set(true);

    this.service.exportCsv(this.projectId, {
      category: this.categoryFilter() || undefined,
      priority: this.priorityFilter() || undefined,
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `feedbacks_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: (err) => {
        this.exporting.set(false);
        this.error.set(
          err.status === 403
            ? 'L\'export CSV est disponible à partir du plan Pro.'
            : 'Erreur lors de l\'export. Réessayez.'
        );
      }
    });
  }

  // helper sentiment
  getSentimentEmoji(sentiment: string): string {
    const map: Record<string, string> = {
      Positive: '😊',
      Neutral: '😐',
      Negative: '😞',
      Frustrated: '😤',
    };
    return map[sentiment] ?? '😐';
  }
}
```

# app\features\dashboard\feedbacks\feedbacks.types.ts

```ts
export type FeedbackStatus = 'Todo' | 'InProgress' | 'Done';
export type FeedbackPriority = 'Low' | 'Normal' | 'High' | 'Critical';
export type FeedbackCategory = 'Bug' | 'FeatureRequest' | 'Question' | 'Uncategorized';
export type AiStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface Feedback {
    id:               string;
    content:          string;
    aiSummary:        string;
    category:         FeedbackCategory;
    priority:         FeedbackPriority;
    status:           FeedbackStatus;
    aiAnalysisStatus: AiStatus;
    // Champs Pro
    priorityScore?:   number;
    sentiment?:       string;
    sentimentScore?:  number;
    keyTopics?:       string[];
    actionRequired?:  boolean;
    urgency?:         string;
    createdAt:        string;
    updatedAt?:       string;
}

export interface FeedbackFilters {
    category?: FeedbackCategory;
    priority?: FeedbackPriority;
    search: string;
    page: number;
    pageSize: number;
    status?: FeedbackStatus;
}

export interface PagedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}
```

# app\features\dashboard\home\dashboard-home.html

```html
<p>dashboard-home works!</p>

```

# app\features\dashboard\home\dashboard-home.scss

```scss

```

# app\features\dashboard\home\dashboard-home.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardHome } from './dashboard-home';

describe('DashboardHome', () => {
  let component: DashboardHome;
  let fixture: ComponentFixture<DashboardHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardHome],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardHome);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\dashboard\home\dashboard-home.ts

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard-home',
  imports: [],
  templateUrl: './dashboard-home.html',
  styleUrl: './dashboard-home.scss',
})
export class DashboardHome {}

```

# app\features\dashboard\overview\overview.html

```html
<!-- overview.html -->
<div class="overview">

  <!-- ── En-tête ─────────────────────────────────────────── -->
  <header class="overview__header">
    <div class="overview__greeting">
      <h1 class="overview__title">
        Bonjour, {{ firstName() }}.
        <span class="overview__title-wave" aria-hidden="true">👋</span>
      </h1>
      <p class="overview__subtitle">Voici ce qui s'est passé sur vos projets.</p>
    </div>
    <a routerLink="/dashboard/feedbacks" class="overview__cta">
      Voir tous les feedbacks
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
        stroke-linejoin="round">
        <line x1="3" y1="8" x2="13" y2="8" />
        <polyline points="9 4 13 8 9 12" />
      </svg>
    </a>
  </header>

  <!-- ── Loading ─────────────────────────────────────────── -->
  @if (loading()) {
  <div class="overview__loading">
    <div class="overview__skeleton overview__skeleton--stats"></div>
    <div class="overview__skeleton overview__skeleton--chart"></div>
    <div class="overview__skeleton overview__skeleton--kanban"></div>
  </div>
  }

  <!-- ── Erreur ───────────────────────────────────────────── -->
  @if (error()) {
  <div class="overview__error">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
      stroke-linejoin="round">
      <circle cx="10" cy="10" r="8" />
      <line x1="10" y1="6" x2="10" y2="10.5" />
      <circle cx="10" cy="14" r="0.5" fill="currentColor" />
    </svg>
    {{ error() }}
    <button class="overview__error-retry" (click)="loadDashboard()">
      Réessayer
    </button>
  </div>
  }

  @if (!loading() && !error()) {

  <!-- ── Stats ────────────────────────────────────────────── -->
  <section class="overview__stats" aria-label="Statistiques">

    <div class="stat-card stat-card--total">
      <div class="stat-card__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4l-4 4V5z" />
        </svg>
      </div>
      <div class="stat-card__body">
        <span class="stat-card__value">{{ stats().totalFeedbacks }}</span>
        <span class="stat-card__label">Feedbacks totaux</span>
      </div>
    </div>

    <div class="stat-card stat-card--todo">
      <div class="stat-card__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round">
          <circle cx="10" cy="10" r="8" />
          <line x1="10" y1="6" x2="10" y2="10" />
          <line x1="10" y1="10" x2="13" y2="13" />
        </svg>
      </div>
      <div class="stat-card__body">
        <span class="stat-card__value">{{ stats().todoCount }}</span>
        <span class="stat-card__label">À traiter</span>
      </div>
    </div>

    <div class="stat-card stat-card--progress">
      <div class="stat-card__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M4 4h12v12H4z" />
          <path d="M4 10h8" />
        </svg>
      </div>
      <div class="stat-card__body">
        <span class="stat-card__value">{{ stats().inProgressCount }}</span>
        <span class="stat-card__label">En cours</span>
      </div>
    </div>

    <div class="stat-card stat-card--resolved">
      <div class="stat-card__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round">
          <polyline points="3 10 8 15 17 5" />
        </svg>
      </div>
      <div class="stat-card__body">
        <span class="stat-card__value">{{ stats().resolvedCount }}</span>
        <span class="stat-card__label">Résolus</span>
      </div>
    </div>

    <div class="stat-card stat-card--urgent">
      <div class="stat-card__icon" aria-hidden="true">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round">
          <path d="M10 2L2 17h16L10 2z" />
          <line x1="10" y1="9" x2="10" y2="12" />
          <circle cx="10" cy="15" r="0.5" fill="currentColor" />
        </svg>
      </div>
      <div class="stat-card__body">
        <span class="stat-card__value">{{ stats().highPriorityCount }}</span>
        <span class="stat-card__label">Priorité haute</span>
      </div>
    </div>

  </section>

  <!-- ── Graphique de tendance ─────────────────────────── -->
  <section class="overview__chart" aria-label="Tendance des 30 derniers jours">
    <div class="chart-header">
      <h2 class="chart-header__title">Volume de feedbacks</h2>
      <span class="chart-header__period">30 derniers jours</span>
    </div>

    @if (trendBars().length === 0) {
    <div class="chart-empty">
      Aucune donnée disponible pour cette période.
    </div>
    } @else {
    <div class="chart-bars" role="img" aria-label="Graphique en barres">
      @for (bar of trendBars(); track trackByDate($index, bar)) {
      <div class="chart-bar-wrap">
        <div class="chart-bar" [style.height.%]="bar.height" [title]="bar.date + ' : ' + bar.count + ' feedback(s)'">
        </div>
        @if ($index % 5 === 0) {
        <span class="chart-bar__label">
          {{ bar.date | date:'dd/MM' }}
        </span>
        }
      </div>
      }
    </div>
    }
  </section>

  <!-- ── Kanban des feedbacks récents ─────────────────── -->
  <section class="overview__kanban" aria-label="Feedbacks récents">
    <h2 class="overview__section-title">Feedbacks récents</h2>

    <div class="kanban">

      <!-- À traiter -->
      <div class="kanban__col">
        <div class="kanban__col-header kanban__col-header--todo">
          <span class="kanban__col-dot" aria-hidden="true"></span>
          À traiter
          <span class="kanban__col-count">{{ todoFeedbacks().length }}</span>
        </div>
        <div class="kanban__cards">
          @for (fb of todoFeedbacks(); track trackById($index, fb)) {
          <article class="kanban-card" [class]="getPriorityClass(fb.priority)">

            @if (fb.aiAnalysisStatus !== 'Completed') {
            <div class="kanban-card__ai-status">
              @switch (fb.aiAnalysisStatus) {
              @case ('Pending') {
              <span class="ai-badge ai-badge--pending">
                <span class="ai-badge__dot"></span>
                En attente
              </span>
              }
              @case ('Processing') {
              <span class="ai-badge ai-badge--processing">
                <span class="ai-badge__spinner"></span>
                Analyse IA…
              </span>
              }
              @case ('Failed') {
              <span class="ai-badge ai-badge--failed">
                ⚠️ Échec IA
              </span>
              }
              @default { }
              }
            </div>
            }

            <p class="kanban-card__summary">{{ fb.aiSummary || fb.content }}</p>
            <div class="kanban-card__meta">
              <span class="kanban-card__category">{{ getCategoryLabel(fb.category) }}</span>
              <span class="kanban-card__date">{{ fb.createdAt | date:'dd/MM' }}</span>
            </div>
          </article>
          }
        </div>
      </div>

      <!-- En cours -->
      <div class="kanban__col">
        <div class="kanban__col-header kanban__col-header--progress">
          <span class="kanban__col-dot" aria-hidden="true"></span>
          En cours
          <span class="kanban__col-count">{{ inProgressFeedbacks().length }}</span>
        </div>
        <div class="kanban__cards">
          @for (fb of inProgressFeedbacks(); track trackById($index, fb)) {
          <article class="kanban-card" [class]="getPriorityClass(fb.priority)">

            @if (fb.aiAnalysisStatus !== 'Completed') {
            <div class="kanban-card__ai-status">
              @switch (fb.aiAnalysisStatus) {
              @case ('Pending') {
              <span class="ai-badge ai-badge--pending">
                <span class="ai-badge__dot"></span>
                En attente
              </span>
              }
              @case ('Processing') {
              <span class="ai-badge ai-badge--processing">
                <span class="ai-badge__spinner"></span>
                Analyse IA…
              </span>
              }
              @case ('Failed') {
              <span class="ai-badge ai-badge--failed">
                ⚠️ Échec IA
              </span>
              }
              @default { }
              }
            </div>
            }

            <p class="kanban-card__summary">{{ fb.aiSummary || fb.content }}</p>
            <div class="kanban-card__meta">
              <span class="kanban-card__category">{{ getCategoryLabel(fb.category) }}</span>
              <span class="kanban-card__date">{{ fb.createdAt | date:'dd/MM' }}</span>
            </div>
          </article>
          }
        </div>
      </div>

      <!-- Résolus -->
      <div class="kanban__col">
        <div class="kanban__col-header kanban__col-header--done">
          <span class="kanban__col-dot" aria-hidden="true"></span>
          Résolus
          <span class="kanban__col-count">{{ doneFeedbacks().length }}</span>
        </div>
        <div class="kanban__cards">
          @for (fb of doneFeedbacks(); track trackById($index, fb)) {
            <article class="kanban-card kanban-card--done" [class]="getPriorityClass(fb.priority)">

              @if (fb.aiAnalysisStatus === 'Failed') {
                <div class="kanban-card__ai-status">
                  <span class="ai-badge ai-badge--failed">⚠️ Échec IA</span>
                </div>
              }

              <p class="kanban-card__summary">{{ fb.aiSummary || fb.content }}</p>
              <div class="kanban-card__meta">
                <span class="kanban-card__category">{{ getCategoryLabel(fb.category) }}</span>
                <span class="kanban-card__date">{{ fb.createdAt | date:'dd/MM' }}</span>
              </div>
            </article>
          }
        </div>
      </div>

    </div>
  </section>

  }

</div>
```

# app\features\dashboard\overview\overview.scss

```scss
// overview.scss
.overview {
  padding: 2rem;
  max-width: 1400px;
  animation: fadeIn 0.3s ease;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

// ── En-tête ────────────────────────────────────────────────
.overview__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.overview__title {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem;
}

.overview__title-wave {
  display: inline-block;
  animation: wave 1.5s ease-in-out;

  @keyframes wave {
    0%, 100% { transform: rotate(0deg); }
    20%       { transform: rotate(20deg); }
    40%       { transform: rotate(-10deg); }
    60%       { transform: rotate(15deg); }
    80%       { transform: rotate(-5deg); }
  }
}

.overview__subtitle {
  color: var(--color-text-secondary);
  margin: 0;
  font-size: 0.9rem;
}

.overview__cta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--color-border-primary);
  color: var(--color-text-primary);
  text-decoration: none;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.15s ease;
  white-space: nowrap;

  svg { width: 14px; height: 14px; }

  &:hover {
    background: var(--color-background-secondary);
    border-color: var(--color-border-secondary);
  }
}

// ── Stats ──────────────────────────────────────────────────
.overview__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid var(--color-border-tertiary);
  background: var(--color-background-primary);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  animation: slideUp 0.3s ease both;

  @for $i from 1 through 5 {
    &:nth-child(#{$i}) { animation-delay: #{$i * 0.05}s; }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  }
}

.stat-card__icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  svg { width: 20px; height: 20px; }

  .stat-card--total &    { background: #EFF6FF; color: #3B82F6; }
  .stat-card--todo &     { background: #FFF7ED; color: #F59E0B; }
  .stat-card--progress & { background: #F5F3FF; color: #8B5CF6; }
  .stat-card--resolved & { background: #F0FDF4; color: #22C55E; }
  .stat-card--urgent &   { background: #FFF1F2; color: #F43F5E; }
}

.stat-card__value {
  display: block;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: 1;
  color: var(--color-text-primary);
}

.stat-card__label {
  display: block;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-top: 0.2rem;
}

// ── Graphique ──────────────────────────────────────────────
.overview__chart {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.chart-header__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.chart-header__period {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
}

.chart-bars {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 120px;
  padding-bottom: 1.5rem;
  position: relative;
}

.chart-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  position: relative;
}

.chart-bar {
  width: 100%;
  min-height: 2px;
  background: var(--color-accent, #3B82F6);
  border-radius: 3px 3px 0 0;
  opacity: 0.7;
  transition: opacity 0.15s ease, transform 0.15s ease;
  cursor: default;

  &:hover {
    opacity: 1;
    transform: scaleY(1.03);
    transform-origin: bottom;
  }
}

.chart-bar__label {
  position: absolute;
  bottom: -1.4rem;
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

.chart-empty {
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

// ── Kanban ─────────────────────────────────────────────────
.overview__section-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 1rem;
}

.kanban {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.kanban__col {
  background: var(--color-background-secondary);
  border-radius: 12px;
  padding: 1rem;
  min-height: 200px;
}

.kanban__col-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
  color: var(--color-text-secondary);
}

.kanban__col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  .kanban__col-header--todo &     { background: #F59E0B; }
  .kanban__col-header--progress & { background: #8B5CF6; }
  .kanban__col-header--done &     { background: #22C55E; }
}

.kanban__col-count {
  margin-left: auto;
  background: var(--color-background-primary);
  border-radius: 20px;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
}

.kanban__cards {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.kanban__empty {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 1rem 0;
  margin: 0;
}

// ── Kanban cards ───────────────────────────────────────────
.kanban-card {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 8px;
  padding: 0.75rem;
  cursor: default;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  border-left: 3px solid transparent;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }

  &--done { opacity: 0.7; }

  &.priority--critical { border-left-color: #F43F5E; }
  &.priority--high     { border-left-color: #F59E0B; }
  &.priority--normal   { border-left-color: #3B82F6; }
  &.priority--low      { border-left-color: #6B7280; }
}

.kanban-card__summary {
  font-size: 0.8rem;
  color: var(--color-text-primary);
  margin: 0 0 0.5rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.kanban-card__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.kanban-card__category {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
}

.kanban-card__date {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
}

// ── Skeletons ──────────────────────────────────────────────
.overview__loading {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.overview__skeleton {
  border-radius: 12px;
  background: linear-gradient(
    90deg,
    var(--color-background-secondary) 25%,
    var(--color-background-tertiary, #e5e7eb) 50%,
    var(--color-background-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  &--stats  { height: 100px; }
  &--chart  { height: 180px; }
  &--kanban { height: 300px; }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
}

// ── Erreur ─────────────────────────────────────────────────
.overview__error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  border-radius: 8px;
  color: #BE123C;
  font-size: 0.875rem;

  svg { width: 18px; height: 18px; flex-shrink: 0; }
}

.overview__error-retry {
  margin-left: auto;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #FECDD3;
  background: white;
  color: #BE123C;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s ease;

  &:hover { background: #FFF1F2; }
}

// Badges IA
.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  font-weight: 500;
  padding: 0.15rem 0.5rem;
  border-radius: 20px;
  margin-bottom: 0.4rem;

  &--pending {
    background: #FFF7ED;
    color: #C2410C;

    .ai-badge__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #F97316;
    }
  }

  &--processing {
    background: #EFF6FF;
    color: #1D4ED8;

    .ai-badge__spinner {
      width: 8px;
      height: 8px;
      border: 1.5px solid #93C5FD;
      border-top-color: #1D4ED8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  }

  &--failed {
    background: #FFF1F2;
    color: #BE123C;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

# app\features\dashboard\overview\overview.service.ts

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardStats, TrendPoint, RecentFeedback } from './overview.types';

export interface DashboardData {
  stats: DashboardStats;
  trends: TrendPoint[];
  recentFeedbacks: RecentFeedback[];
}

@Injectable({ providedIn: 'root' })
export class OverviewService {
  private readonly http = inject(HttpClient);
  private readonly API  = environment.apiUrl;

  getDashboard(projectId?: string): Observable<DashboardData> {
    const params = projectId ? `?projectId=${projectId}` : '';
    return this.http.get<DashboardData>(
      `${this.API}/dashboard${params}`,
      { withCredentials: true }
    );
  }
}
```

# app\features\dashboard\overview\overview.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Overview } from './overview';

describe('Overview', () => {
  let component: Overview;
  let fixture: ComponentFixture<Overview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Overview],
    }).compileComponents();

    fixture = TestBed.createComponent(Overview);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\dashboard\overview\overview.ts

```ts
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DashboardData, OverviewService } from './overview.service';
import { UserService } from '../../../core/services/user.service';
import { RecentFeedback, TrendPoint } from './overview.types';
import { DatePipe } from '@angular/common';
import { interval, Subscription, switchMap, takeWhile } from 'rxjs';


@Component({
  selector: 'app-overview',
  imports: [DatePipe],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview implements OnInit {
  private readonly overviewService = inject(OverviewService);
  private readonly userService = inject(UserService);
  private pollSubscription?: Subscription;


  // ─── State ────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  data = signal<DashboardData | null>(null);

  // ─── Computed ─────────────────────────────────────────────
  readonly firstName = computed(() =>
    this.userService.profile()?.firstName ?? '');

  readonly stats = computed(() => this.data()?.stats ?? {
    totalFeedbacks: 0,
    todoCount: 0,
    inProgressCount: 0,
    resolvedCount: 0,
    highPriorityCount: 0,
  });

  readonly trends = computed(() => this.data()?.trends ?? []);
  readonly recentFeedbacks = computed(() => this.data()?.recentFeedbacks ?? []);

  // Feedbacks groupés par statut pour le kanban
  readonly todoFeedbacks = computed(() =>
    this.recentFeedbacks().filter(f => f.status === 'Todo').slice(0, 5));
  readonly inProgressFeedbacks = computed(() =>
    this.recentFeedbacks().filter(f => f.status === 'InProgress').slice(0, 5));
  readonly doneFeedbacks = computed(() =>
    this.recentFeedbacks().filter(f => f.status === 'Done').slice(0, 5));

  // ─── Graphique ────────────────────────────────────────────
  readonly maxTrendValue = computed(() => {
    const values = this.trends().map(t => t.count);
    return Math.max(...values, 1);
  });

  readonly trendBars = computed(() =>
    this.trends().map(t => ({
      ...t,
      height: Math.round((t.count / this.maxTrendValue()) * 100)
    }))
  );

  // ─── Lifecycle ────────────────────────────────────────────
  ngOnInit(): void {
    this.loadDashboard();
  }

  ngOnDestroy(): void {
    this.pollSubscription?.unsubscribe();
  }


  loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');

    this.overviewService.getDashboard().subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
        this.startPollingIfNeeded();
      },
      error: () => {
        this.error.set('Impossible de charger le tableau de bord.');
        this.loading.set(false);
      }
    });
  }

  private startPollingIfNeeded(): void {
    const hasPending = this.recentFeedbacks().some(
      f => f.aiAnalysisStatus === 'Pending' ||
        f.aiAnalysisStatus === 'Processing'
    );

    if (!hasPending) {
      this.pollSubscription?.unsubscribe();
      return;
    }

    // Évite de créer plusieurs pollings
    if (this.pollSubscription) return;

    this.pollSubscription = interval(3000).pipe(
      switchMap(() => this.overviewService.getDashboard()),
      takeWhile(data =>
        data.recentFeedbacks.some(
          f => f.aiAnalysisStatus === 'Pending' ||
            f.aiAnalysisStatus === 'Processing'
        ), true // inclut le dernier emit
      )
    ).subscribe({
      next: (data) => {
        this.data.set(data);
        // Arrête le polling quand tout est analysé
        const stillPending = data.recentFeedbacks.some(
          f => f.aiAnalysisStatus === 'Pending' ||
            f.aiAnalysisStatus === 'Processing'
        );
        if (!stillPending) {
          this.pollSubscription?.unsubscribe();
          this.pollSubscription = undefined;
        }
      }
    });
  }
  // ─── Helpers ──────────────────────────────────────────────
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      Bug: '🐛 Bug',
      FeatureRequest: '✨ Fonctionnalité',
      Question: '❓ Question',
      Uncategorized: '📝 Non catégorisé',
    };
    return labels[category] ?? category;
  }

  getPriorityClass(priority: string): string {
    const classes: Record<string, string> = {
      Critical: 'priority--critical',
      High: 'priority--high',
      Normal: 'priority--normal',
      Low: 'priority--low',
    };
    return classes[priority] ?? '';
  }

  trackByDate(_: number, item: TrendPoint): string {
    return item.date;
  }

  trackById(_: number, item: RecentFeedback): string {
    return item.id;
  }
}



```

# app\features\dashboard\overview\overview.types.ts

```ts
export interface DashboardStats {
  totalFeedbacks: number;
  todoCount: number;
  inProgressCount: number;
  resolvedCount: number;
  highPriorityCount: number;
}

export interface TrendPoint {
  date: string;
  count: number;
}

export interface RecentFeedback {
  id: string;
  content: string;
  aiSummary: string;
  category: string;
  priority: string;
  status: string;
  aiAnalysisStatus: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  createdAt: string;
}
```

# app\features\dashboard\projects\projects.html

```html
<div class="projects">

  <!-- ── En-tête ──────────────────────────────────────────── -->
  <header class="projects__header">
    <div>
      <h1 class="projects__title">Projets</h1>
      <p class="projects__subtitle">
        {{ activeProjects().length }} projet{{ activeProjects().length > 1 ? 's' : '' }} actif{{ activeProjects().length
        > 1 ? 's' : '' }}
        @if (plan() === 'Free' || plan() === 'Pro') {
        <span class="projects__limit-badge">
          Plan {{ plan() }} — {{ projects().length }}/{{ projectLimit() }}
        </span>
        } @else {
        <span class="projects__limit-badge">
          Plan {{ plan() }} — {{ activeProjects().length }}/ ∞ 
        </span>
        }
      </p>
    </div>

    <button class="projects__create-btn" [disabled]="!canCreateMore()"
      [title]="!canCreateMore() ? 'Limite de projets atteinte' : ''" (click)="openModal()">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
        stroke-linejoin="round">
        <line x1="8" y1="2" x2="8" y2="14" />
        <line x1="2" y1="8" x2="14" y2="8" />
      </svg>
      Nouveau projet
    </button>
  </header>

  <!-- ── Loading ───────────────────────────────────────────── -->
  @if (loading()) {
  <div class="projects__grid">
    @for (i of [1,2,3]; track i) {
    <div class="project-skeleton"></div>
    }
  </div>
  }

  <!-- ── Erreur ─────────────────────────────────────────────── -->
  @if (error()) {
  <div class="projects__error">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
      stroke-linejoin="round">
      <circle cx="10" cy="10" r="8" />
      <line x1="10" y1="6" x2="10" y2="10.5" />
      <circle cx="10" cy="14" r="0.5" fill="currentColor" />
    </svg>
    {{ error() }}
    <button class="projects__error-retry" (click)="load()">Réessayer</button>
  </div>
  }

  <!-- ── État vide ─────────────────────────────────────────── -->
  @if (!loading() && !error() && projects().length === 0) {
  <div class="projects__empty">
    <div class="projects__empty-icon">
      <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
        stroke-linejoin="round">
        <rect x="6" y="6" width="36" height="36" rx="6" />
        <line x1="24" y1="16" x2="24" y2="32" />
        <line x1="16" y1="24" x2="32" y2="24" />
      </svg>
    </div>
    <h2 class="projects__empty-title">Aucun projet pour l'instant</h2>
    <p class="projects__empty-desc">
      Créez votre premier projet pour commencer à collecter des feedbacks.
    </p>
    <button class="projects__create-btn" (click)="openModal()">
      Créer mon premier projet
    </button>
  </div>
  }

  <!-- ── Grille de projets ──────────────────────────────────── -->
  @if (!loading() && !error() && projects().length > 0) {
  <div class="projects__grid">

    @for (project of projects(); track trackById($index, project)) {
    <article class="project-card" [class.project-card--inactive]="!project.isActive" (click)="openFeedbacks(project)">

      <!-- Avatar couleur -->
      <div class="project-card__avatar" [style.background]="getProjectColor(project.id)">
        {{ getInitials(project.name) }}
      </div>

      <!-- Infos -->
      <div class="project-card__body">
        <h2 class="project-card__name">{{ project.name }}</h2>

        @if (project.description) {
        <p class="project-card__desc">{{ project.description }}</p>
        }

        <div class="project-card__stats">
          <span class="project-card__stat">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round">
              <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H5l-3 3V3z" />
            </svg>
            {{ project.feedbackCount }} feedback{{ project.feedbackCount > 1 ? 's' : '' }}
          </span>

          @if (!project.isActive) {
          <span class="project-card__inactive-badge">Inactif</span>
          }
        </div>
      </div>

      <!-- Actions -->
      <div class="project-card__actions" (click)="$event.stopPropagation()">

        <!-- Copier le token widget -->
        <button class="project-card__action" [class.project-card__action--copied]="copiedToken() === project.id"
          [title]="copiedToken() === project.id ? 'Copié !' : 'Copier le lien widget'" (click)="copyToken(project)">
          @if (copiedToken() === project.id) {
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <polyline points="2 8 6 12 14 4" />
          </svg>
          } @else {
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="5" y="5" width="9" height="9" rx="1.5" />
            <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
          </svg>
          }
        </button>

        <!-- Voir les feedbacks -->
        <button class="project-card__action project-card__action--primary" title="Voir les feedbacks"
          (click)="openFeedbacks(project)">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
            stroke-linejoin="round">
            <line x1="3" y1="8" x2="13" y2="8" />
            <polyline points="9 4 13 8 9 12" />
          </svg>
        </button>

      </div>

    </article>
    }

  </div>
  }

  <!-- ── Upgrade banner pour Free ──────────────────────────── -->
  @if (plan() === 'Free' && projects().length >= 1) {
  <div class="projects__upgrade">
    <div class="projects__upgrade-text">
      <strong>Passez à Pro</strong> pour gérer jusqu'à 10 projets et des feedbacks illimités.
    </div>
    <a href="/pricing" class="projects__upgrade-btn">
      Voir les plans →
    </a>
  </div>
  }

</div>

<!-- ── Modal création ─────────────────────────────────────── -->
@if (showModal()) {
<div class="modal-overlay" (click)="closeModal()">
  <div class="modal" (click)="$event.stopPropagation()">

    <div class="modal__header">
      <h2 class="modal__title">Nouveau projet</h2>
      <button class="modal__close" (click)="closeModal()">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round">
          <line x1="2" y1="2" x2="14" y2="14" />
          <line x1="14" y1="2" x2="2" y2="14" />
        </svg>
      </button>
    </div>

    <div class="modal__body">

      <div class="modal-field">
        <label class="modal-field__label" for="proj-name">
          Nom du projet <span class="modal-field__required">*</span>
        </label>
        <input id="proj-name" class="modal-field__input" type="text" placeholder="Ex : Refonte site e-commerce"
          maxlength="100" [ngModel]="newName()" (ngModelChange)="newName.set($event)" autofocus>
        <span class="modal-field__counter">
          {{ newName().length }}/100
        </span>
      </div>

      <div class="modal-field">
        <label class="modal-field__label" for="proj-desc">
          Description
          <span class="modal-field__optional">(optionnel)</span>
        </label>
        <textarea id="proj-desc" class="modal-field__textarea" placeholder="Décrivez brièvement ce projet…"
          maxlength="500" rows="3" [ngModel]="newDescription()" (ngModelChange)="newDescription.set($event)">
          </textarea>
        <span class="modal-field__counter">
          {{ newDescription().length }}/500
        </span>
      </div>

      @if (createError()) {
      <p class="modal__error">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
          stroke-linejoin="round">
          <circle cx="8" cy="8" r="7" />
          <line x1="8" y1="5" x2="8" y2="8.5" />
          <circle cx="8" cy="11" r="0.5" fill="currentColor" />
        </svg>
        {{ createError() }}
      </p>
      }

    </div>

    <div class="modal__footer">
      <button class="modal__cancel" (click)="closeModal()">
        Annuler
      </button>
      <button class="modal__submit" [disabled]="creating() || !newName().trim()" (click)="onCreate()">
        @if (creating()) {
        <span class="modal__spinner"></span>
        Création…
        } @else {
        Créer le projet
        }
      </button>
    </div>

  </div>
</div>
}
@if (showSnippetModal()) {
<div class="modal-overlay" (click)="closeSnippetModal()">
  <div class="modal" (click)="$event.stopPropagation()">

    <div class="modal__header">
      <h2 class="modal__title">Snippet d'intégration</h2>
      <button class="modal__close" (click)="closeSnippetModal()">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round">
          <line x1="2" y1="2" x2="14" y2="14" />
          <line x1="14" y1="2" x2="2" y2="14" />
        </svg>
      </button>
    </div>

    <div class="modal__body">
      <p class="modal__hint">
        La copie automatique n'est pas disponible sur ce navigateur.
        Sélectionnez et copiez le code ci-dessous manuellement.
      </p>
      <pre class="modal__snippet"><code>{{ snippetToCopy() }}</code></pre>
    </div>

    <div class="modal__footer">
      <button class="modal__cancel" (click)="closeSnippetModal()">Fermer</button>
    </div>

  </div>
</div>
}
```

# app\features\dashboard\projects\projects.scss

```scss
.projects {
  padding: 2rem;
  max-width: 1200px;
  animation: fadeIn 0.25s ease;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

// ── En-tête ────────────────────────────────────────────────
.projects__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.projects__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem;
}

.projects__subtitle {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.projects__limit-badge {
  font-size: 0.7rem;
  background: #FFF7ED;
  color: #C2410C;
  padding: 0.15rem 0.5rem;
  border-radius: 20px;
  font-weight: 500;
}

.projects__create-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.25rem;
  background: var(--color-accent, #3B82F6);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  svg { width: 14px; height: 14px; }

  &:hover:not(:disabled) {
    filter: brightness(1.1);
    transform: translateY(-1px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
}

// ── Grille ─────────────────────────────────────────────────
.projects__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

// ── Cards ──────────────────────────────────────────────────
.project-card {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  animation: cardIn 0.3s ease both;
  position: relative;

  @for $i from 1 through 12 {
    &:nth-child(#{$i}) { animation-delay: #{$i * 0.04}s; }
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  &:hover {
    border-color: var(--color-accent, #3B82F6);
    box-shadow: 0 4px 20px rgba(59, 130, 246, 0.1);
    transform: translateY(-2px);
  }

  &--inactive {
    opacity: 0.6;
    filter: grayscale(0.3);
  }
}

.project-card__avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 700;
  color: white;
  flex-shrink: 0;
  letter-spacing: 0.05em;
}

.project-card__body {
  flex: 1;
  min-width: 0;
}

.project-card__name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 0.3rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-card__desc {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 0 0 0.6rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-card__stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.project-card__stat {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  color: var(--color-text-secondary);

  svg { width: 12px; height: 12px; }
}

.project-card__inactive-badge {
  font-size: 0.7rem;
  background: #F1F5F9;
  color: #64748B;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
}

.project-card__actions {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex-shrink: 0;
}

.project-card__action {
  width: 32px;
  height: 32px;
  border-radius: 7px;
  border: 1px solid var(--color-border-primary);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  svg { width: 14px; height: 14px; }

  &:hover {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
  }

  &--primary {
    background: var(--color-accent, #3B82F6);
    border-color: var(--color-accent, #3B82F6);
    color: white;

    &:hover { filter: brightness(1.1); }
  }

  &--copied {
    background: #F0FDF4;
    border-color: #86EFAC;
    color: #16A34A;
  }
}

// ── État vide ──────────────────────────────────────────────
.projects__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  gap: 1rem;
}

.projects__empty-icon {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: var(--color-background-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);

  svg { width: 32px; height: 32px; }
}

.projects__empty-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.projects__empty-desc {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
  max-width: 300px;
}

// ── Upgrade banner ─────────────────────────────────────────
.projects__upgrade {
  margin-top: 2rem;
  padding: 1rem 1.25rem;
  background: linear-gradient(135deg, #EFF6FF, #F5F3FF);
  border: 1px solid #BFDBFE;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.projects__upgrade-text {
  font-size: 0.875rem;
  color: #1E40AF;
}

.projects__upgrade-btn {
  font-size: 0.8rem;
  font-weight: 600;
  color: #1D4ED8;
  text-decoration: none;
  white-space: nowrap;

  &:hover { text-decoration: underline; }
}

// ── Erreur ─────────────────────────────────────────────────
.projects__error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  border-radius: 8px;
  color: #BE123C;
  font-size: 0.875rem;
  svg { width: 18px; height: 18px; }
}

.projects__error-retry {
  margin-left: auto;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #FECDD3;
  background: white;
  color: #BE123C;
  font-size: 0.8rem;
  cursor: pointer;
  &:hover { background: #FFF1F2; }
}

// ── Skeleton ───────────────────────────────────────────────
.project-skeleton {
  height: 100px;
  border-radius: 12px;
  background: linear-gradient(
    90deg,
    var(--color-background-secondary) 25%,
    var(--color-border-tertiary) 50%,
    var(--color-background-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
}

// ── Modal ──────────────────────────────────────────────────
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: overlayIn 0.15s ease;

  @keyframes overlayIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
}

.modal {
  background: var(--color-white);
  border-radius: 16px;
  width: 100%;
  max-width: 480px;
  margin: 1rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  animation: modalIn 0.2s ease;

  @keyframes modalIn {
    from { opacity: 0; transform: translateY(16px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--color-border-tertiary);
}

.modal__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.modal__close {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease;

  svg { width: 12px; height: 12px; }
  &:hover { background: var(--color-background-secondary); }
}

.modal__body {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  position: relative;
}

.modal-field__label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.modal-field__required { color: #F43F5E; }
.modal-field__optional {
  color: var(--color-text-secondary);
  font-weight: 400;
}

.modal-field__input,
.modal-field__textarea {
  padding: 0.6rem 0.875rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s ease;
  font-family: inherit;
  resize: vertical;

  &:focus { border-color: var(--color-accent, #3B82F6); }
  &::placeholder { color: var(--color-text-secondary); }
}

.modal-field__counter {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  text-align: right;
}

.modal__error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.875rem;
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  border-radius: 6px;
  color: #BE123C;
  font-size: 0.8rem;
  margin: 0;

  svg { width: 14px; height: 14px; flex-shrink: 0; }
}

.modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--color-border-tertiary);
}

.modal__cancel {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover { background: var(--color-background-secondary); }
}

.modal__submit {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  background: var(--color-accent, #3B82F6);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover:not(:disabled) { filter: brightness(1.1); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

.modal__spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;

  @keyframes spin { to { transform: rotate(360deg); } }
}

.modal__hint {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 0 0 0.75rem;
}

.modal__snippet {
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.75rem;
  font-family: var(--font-mono, monospace);
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  color: var(--color-text-primary);
  user-select: all; // sélectionne tout au clic
}
```

# app\features\dashboard\projects\projects.service.ts

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Project, CreateProjectRequest } from './projects.types';

export interface PagedResult<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly API  = environment.apiUrl;

  getAll(): Observable<PagedResult<Project>> {
    return this.http.get<PagedResult<Project>>(
      `${this.API}/projects`,
      { withCredentials: true }
    );
  }

  create(request: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>(
      `${this.API}/projects`,
      request,
      { withCredentials: true }
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.API}/projects/${id}`,
      { withCredentials: true }
    );
  }

  regenerateToken(id: string): Observable<{ publicToken: string }> {
    return this.http.post<{ publicToken: string }>(
      `${this.API}/projects/${id}/regenerate-token`,
      {},
      { withCredentials: true }
    );
  }
}
```

# app\features\dashboard\projects\projects.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Projects } from './projects';

describe('Projects', () => {
  let component: Projects;
  let fixture: ComponentFixture<Projects>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Projects],
    }).compileComponents();

    fixture = TestBed.createComponent(Projects);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\dashboard\projects\projects.ts

```ts
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Project } from './projects.types';
import { ProjectsService } from './projects.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects implements OnInit {
  private readonly service          = inject(ProjectsService);
  private readonly router           = inject(Router);
  private readonly dashboardContext = inject(DashboardContextService);

  // ─── State ────────────────────────────────────────────────────────────────
  loading          = signal(true);
  error            = signal('');
  projects         = signal<Project[]>([]);
  showModal        = signal(false);
  creating         = signal(false);
  createError      = signal('');
  copiedToken      = signal<string | null>(null);
  showSnippetModal = signal(false);
  snippetToCopy    = signal('');

  newName        = signal('');
  newDescription = signal('');

  // ─── Plan & limites — source unique : DashboardContextService ─────────────
  // UserService n'est plus injecté ici : évite deux sources de vérité pour plan/limit.
  readonly plan         = this.dashboardContext.plan;
  readonly projectLimit = this.dashboardContext.projectLimit;

  readonly canCreateMore = computed(() =>
    this.projects().length < this.projectLimit()
  );

  readonly activeProjects = computed(() =>
    this.projects().filter(p => p.isActive)
  );

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.service.getAll().subscribe({
      next: (result) => {
        this.projects.set(result.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les projets.');
        this.loading.set(false);
      }
    });
  }

  // ─── Création ─────────────────────────────────────────────────────────────
  openModal(): void {
    this.newName.set('');
    this.newDescription.set('');
    this.createError.set('');
    this.showModal.set(true);
  }

  closeModal():        void { this.showModal.set(false); }
  closeSnippetModal(): void { this.showSnippetModal.set(false); this.snippetToCopy.set(''); }

  onCreate(): void {
    this.createError.set('');

    const name = this.newName().trim();
    if (!name) { this.createError.set('Le nom du projet est requis.'); return; }
    if (name.length > 100) { this.createError.set('Le nom ne peut pas dépasser 100 caractères.'); return; }

    this.creating.set(true);

    this.service.create({ name, description: this.newDescription().trim() }).subscribe({
      next: (project) => {
        this.projects.update(list => [project, ...list]);
        this.creating.set(false);
        this.closeModal();
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(
          err.status === 403
            ? `Votre plan ${this.plan()} est limité à ${this.projectLimit()} projet(s). Passez à Pro pour en créer plus.`
            : 'Erreur lors de la création. Réessayez.'
        );
      }
    });
  }

  // ─── Navigation ───────────────────────────────────────────────────────────
  openFeedbacks(project: Project): void {
    this.dashboardContext.setProject(project);
    this.router.navigate(['/dashboard/feedbacks']);
  }

  // ─── Copier le token ──────────────────────────────────────────────────────
  copyToken(project: Project): void {
    const snippet = `<script src="http://localhost:3000/widget.iife.js"></script>
<ai-review-hub
    token="${project.publicToken}"
    api-url="${environment.apiUrl}"
    mode="floating">
</ai-review-hub>`;
    this.writeToClipboard(snippet, project.id);
  }

  private async writeToClipboard(text: string, projectId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.onCopied(projectId);
    } catch {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) })
        ]);
        this.onCopied(projectId);
      } catch {
        this.showManualCopy(text);
      }
    }
  }

  private onCopied(projectId: string): void {
    this.copiedToken.set(projectId);
    setTimeout(() => this.copiedToken.set(null), 2000);
  }

  private showManualCopy(text: string): void {
    this.snippetToCopy.set(text);
    this.showSnippetModal.set(true);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  getProjectColor(id: string): string {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#F43F5E'];
    return colors[id.charCodeAt(0) % colors.length];
  }

  trackById(_: number, item: Project): string { return item.id; }
}
```

# app\features\dashboard\projects\projects.types.ts

```ts
export interface Project {
  id:           string;
  name:         string;
  description:  string;
  publicToken:  string;
  isActive:     boolean;
  feedbackCount: number;
  createdAt:    string;
}

export interface CreateProjectRequest {
  name:        string;
  description: string;
}
```

# app\features\dashboard\shell\dashboard-shell.html

```html
<div class="shell" [class.shell--collapsed]="sidebarCollapsed()">

  <!-- =============================================
       SIDEBAR
       ============================================= -->
  <aside class="sidebar" [class.sidebar--open]="mobileMenuOpen()">

    <!-- Logo -->
    <div class="sidebar__logo">
      @if (!sidebarCollapsed()) {
        <a routerLink="/dashboard" class="sidebar__logo-link" aria-label="AI Review Hub — accueil" (click)="closeMobileMenu()">
          <img class="sidebar__logo-icon" src="assets/feedxai.svg" viewBox="400 500 1200 900" alt="Logo AI Review Hub"/>
        </a>
      }
      @else {
        <a routerLink="/dashboard" class="sidebar__logo-link" aria-label="AI Review Hub — accueil" (click)="closeMobileMenu()">
          <img class="sidebar__logo-icon" src="assets/feedxai-logo.svg" viewBox="0 0 24 24" alt="Logo AI Review Hub"/>
        </a>
      }
      @if (!sidebarCollapsed()) {
        <button
          class="sidebar__collapse-btn"
          type="button"
          aria-label="Réduire la sidebar"
          (click)="toggleSidebar()">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="10 4 6 8 10 12"/>
          </svg>
        </button>
      }
    </div>

    <!-- Sélecteur de projet -->
    @if (!sidebarCollapsed()) {
      <div class="sidebar__project">
        <div class="sidebar__project-info">
          <div class="sidebar__project-avatar" aria-hidden="true">
            {{ currentProject()?.name?.charAt(0) }}
          </div>
          <div class="sidebar__project-meta">
            <span class="sidebar__project-name">{{ currentProject()?.name || 'Aucun projet sélectionné' }}</span>
            <span class="sidebar__project-plan">{{ currentPlan() }}</span>
          </div>
        </div>
        <button class="sidebar__project-switch" type="button" aria-label="Changer de projet">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z"/>
            <path d="M8 2v14"/>
          </svg>
        </button>
      </div>
    }

    <!-- Navigation principale -->
    <nav class="sidebar__nav" aria-label="Navigation principale">
      @if (!sidebarCollapsed()) {
        <p class="sidebar__nav-group-label">Navigation</p>
      }

      @for (item of navItems; track item.path) {
        <a
          [routerLink]="item.path"
          routerLinkActive="sidebar__nav-item--active"
          [routerLinkActiveOptions]="{ exact: item.path === '/dashboard' }"
          class="sidebar__nav-item"
          [class.sidebar__nav-item--collapsed]="sidebarCollapsed()"
          [attr.title]="sidebarCollapsed() ? item.label : null"
          (click)="closeMobileMenu()">

          <span class="sidebar__nav-icon" aria-hidden="true">
            <ng-container [ngSwitch]="item.icon">
              <ng-container *ngSwitchCase="'home'">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 9.5L10 3l7 6.5V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
                  <path d="M7 18V12h6v6"/>
                </svg>
              </ng-container>
              <ng-container *ngSwitchCase="'folder'">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 15.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2z"/>
                </svg>
              </ng-container>
              <ng-container *ngSwitchCase="'messages'">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13a2 2 0 0 1-2 2H6l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8z"/>
                </svg>
              </ng-container>
              <ng-container *ngSwitchCase="'chart'">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="18 10 15 10 12.5 17.5 7.5 2.5 5 10 2 10"/>
                </svg>
              </ng-container>
              <ng-container *ngSwitchCase="'code'">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="13 15 18 10 13 5"/>
                  <polyline points="7 5 2 10 7 15"/>
                </svg>
              </ng-container>
            </ng-container>
          </span>

          @if (!sidebarCollapsed()) {
            <span class="sidebar__nav-label">{{ item.label }}</span>
            @if (item.badge) {
              <span class="sidebar__nav-badge">{{ item.badge }}</span>
            }
          }

        </a>
      }
    </nav>

    <!-- Spacer -->
    <div class="sidebar__spacer"></div>

    <!-- Navigation bas -->
    <nav class="sidebar__nav sidebar__nav--bottom" aria-label="Navigation secondaire">
      @if (!sidebarCollapsed()) {
        <p class="sidebar__nav-group-label">Compte</p>
      }

      @for (item of bottomNavItems; track item.path) {
        <a
          [routerLink]="item.path"
          routerLinkActive="sidebar__nav-item--active"
          class="sidebar__nav-item"
          [class.sidebar__nav-item--collapsed]="sidebarCollapsed()"
          [attr.title]="sidebarCollapsed() ? item.label : null"
          (click)="closeMobileMenu()">

          <span class="sidebar__nav-icon" aria-hidden="true">
            <ng-container [ngSwitch]="item.icon">
              <ng-container *ngSwitchCase="'settings'">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="10" cy="10" r="3"/>
                  <path d="M16.2 12.5a1.4 1.4 0 0 0 .28 1.54l.05.05a1.7 1.7 0 0 1-2.4 2.4l-.05-.05a1.4 1.4 0 0 0-1.54-.28 1.4 1.4 0 0 0-.85 1.28V18a1.7 1.7 0 0 1-3.4 0v-.08a1.4 1.4 0 0 0-.92-1.28 1.4 1.4 0 0 0-1.54.28l-.05.05a1.7 1.7 0 0 1-2.4-2.4l.05-.05a1.4 1.4 0 0 0 .28-1.54 1.4 1.4 0 0 0-1.28-.85H2a1.7 1.7 0 0 1 0-3.4h.08a1.4 1.4 0 0 0 1.28-.92 1.4 1.4 0 0 0-.28-1.54l-.05-.05a1.7 1.7 0 0 1 2.4-2.4l.05.05a1.4 1.4 0 0 0 1.54.28h.07a1.4 1.4 0 0 0 .85-1.28V2a1.7 1.7 0 0 1 3.4 0v.08a1.4 1.4 0 0 0 .85 1.28 1.4 1.4 0 0 0 1.54-.28l.05-.05a1.7 1.7 0 0 1 2.4 2.4l-.05.05a1.4 1.4 0 0 0-.28 1.54v.07a1.4 1.4 0 0 0 1.28.85H18a1.7 1.7 0 0 1 0 3.4h-.08a1.4 1.4 0 0 0-1.28.85z"/>
                </svg>
              </ng-container>
              <ng-container *ngSwitchCase="'help'">
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="10" cy="10" r="8"/>
                  <path d="M7.5 7.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2.5-2.5 4"/>
                  <circle cx="10" cy="15" r=".5" fill="currentColor"/>
                </svg>
              </ng-container>
            </ng-container>
          </span>

          @if (!sidebarCollapsed()) {
            <span class="sidebar__nav-label">{{ item.label }}</span>
          }
        </a>
      }
      <a routerLink="/dashboard/billing"
        routerLinkActive="sidebar__nav-item--active"
        class="sidebar__nav-item"
        [class.sidebar__nav-item--collapsed]="sidebarCollapsed()">
        <span class="sidebar__nav-icon">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
              stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="14" height="10" rx="1.5"/>
            <line x1="1" y1="6.5" x2="15" y2="6.5"/>
            <line x1="4" y1="10" x2="6" y2="10"/>
          </svg>
        </span>
        @if (!sidebarCollapsed()) {
          <span class="sidebar__nav-label">Abonnement</span>
        }
      </a>

      @if (quota()) {
        <div class="sidebar__quota">
          <div class="sidebar__quota-label">
            <span>Feedbacks ce mois</span>
            <span class="sidebar__quota-count">
              @if (quota()!.feedbacksLimit === -1) {
                {{ quota()!.feedbacksThisMonth }} / ∞
              } @else {
                {{ quota()!.feedbacksThisMonth }} / {{ quota()!.feedbacksLimit }}
              }
            </span>
          </div>
          <div class="sidebar__quota-bar">
            <div
              class="sidebar__quota-fill"
              [style.width.%]="quota()!.usagePercent"
              [class.sidebar__quota-fill--warning]="quota()!.usagePercent >= 80"
              [class.sidebar__quota-fill--danger]="quota()!.usagePercent >= 100">
            </div>
          </div>
          @if (quota()!.usagePercent >= 80 && quota()!.feedbacksLimit !== -1) {
            <a routerLink="/dashboard/billing" class="sidebar__quota-upgrade">
              Passer au Pro →
            </a>
          }
        </div>
      }

      <!-- Profil utilisateur -->
      <div class="sidebar__user" [class.sidebar__user--collapsed]="sidebarCollapsed()">
        <div class="sidebar__user-avatar" aria-hidden="true">{{ initials()}}</div>
        @if (!sidebarCollapsed()) {
          <div class="sidebar__user-info">
            <span class="sidebar__user-name">{{ fullName() }}</span>
            <span class="sidebar__user-email">{{ profile()?.email }}</span>
          </div>
          <button
            class="sidebar__user-logout"
            type="button"
            aria-label="Se déconnecter"
            [disabled]="logoutLoading()"
            [class.sidebar__user-logout--loading]="logoutLoading()"
            (click)="logout()">

            @if (logoutLoading()) {
              <!-- Spinner pendant le revoke -->
              <svg class="sidebar__logout-spinner" viewBox="0 0 16 16" fill="none"
                  stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke-opacity="0.3"/>
                <path d="M8 2a6 6 0 0 1 6 6"/>
              </svg>
            } @else {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
                  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M6 14H3a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1h3"/>
                <polyline points="10 11 14 8 10 5"/>
                <line x1="14" y1="8" x2="5" y2="8"/>
              </svg>
            }
          </button>
        }
      </div>
    </nav>
  </aside>

  <!-- Backdrop mobile -->
  @if (mobileMenuOpen()) {
    <div class="sidebar-backdrop" (click)="closeMobileMenu()" aria-hidden="true"></div>
  }

  <!-- =============================================
       ZONE PRINCIPALE
       ============================================= -->
  <div class="shell__main">

    <!-- Topbar -->
    <header class="topbar">

    <!-- Burger mobile (caché sur desktop) -->
    <button
        class="topbar__burger"
        type="button"
        [attr.aria-label]="mobileMenuOpen() ? 'Fermer le menu' : 'Ouvrir le menu'"
        [attr.aria-expanded]="mobileMenuOpen()"
        (click)="toggleMobileMenu()">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" aria-hidden="true">
        @if (mobileMenuOpen()) {
            <line x1="4" y1="4" x2="16" y2="16"/>
            <line x1="16" y1="4" x2="4" y2="16"/>
        } @else {
            <line x1="3" y1="6" x2="17" y2="6"/>
            <line x1="3" y1="10" x2="17" y2="10"/>
            <line x1="3" y1="14" x2="17" y2="14"/>
        }
        </svg>
    </button>

    <!-- Bouton expand (desktop, visible uniquement quand sidebar collapsed) -->
    @if (sidebarCollapsed()) {
        <button
        class="topbar__expand-btn"
        type="button"
        aria-label="Étendre la sidebar"
        (click)="toggleSidebar()">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 4 10 8 6 12"/>
        </svg>
        </button>
    }

    <!-- Fil d'Ariane -->
    <nav class="topbar__breadcrumb" aria-label="Fil d'Ariane">
        <span class="topbar__breadcrumb-root">AI Review Hub</span>
        <svg class="topbar__breadcrumb-sep" viewBox="0 0 12 12" fill="none" stroke="currentColor"
            stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="4 2 8 6 4 10"/>
        </svg>
        <span class="topbar__breadcrumb-current" aria-current="page">Vue d'ensemble</span>
    </nav>

    <!-- Actions (poussées à droite par le breadcrumb flex:1) -->
    <div class="topbar__actions">

        <button class="topbar__action-btn topbar__action-btn--primary" type="button">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="8" y1="3" x2="8" y2="13"/>
            <line x1="3" y1="8" x2="13" y2="8"/>
        </svg>
        <span>Nouveau projet</span>
        </button>

        <button class="topbar__icon-btn" type="button" aria-label="Notifications">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M10 2a6 6 0 0 1 6 6c0 5 2 6 2 6H2s2-1 2-6a6 6 0 0 1 6-6z"/>
            <path d="M11.7 18a1.7 1.7 0 0 1-3.4 0"/>
        </svg>
        <span class="topbar__icon-btn-dot" aria-hidden="true"></span>
        </button>

        <button class="topbar__avatar" type="button" aria-label="Menu utilisateur">JD</button>

    </div>
    </header>
    
    <!-- Contenu de la page (router-outlet) -->
    <main class="shell__content">
      <router-outlet></router-outlet>
    </main>

  </div>

</div>
```

# app\features\dashboard\shell\dashboard-shell.scss

```scss
/* =============================================
   DASHBOARD SHELL — Layout sidebar + topbar
   ============================================= */

// ── Variables locales ─────────────────────────

$sidebar-width:           240px;
$sidebar-width-collapsed: 64px;
$topbar-height:           56px;
$transition-speed:        0.22s;
$transition-ease:         cubic-bezier(0.4, 0, 0.2, 1);


// =============================================
// SHELL — grille principale
// =============================================

.shell {
  display: flex;  
  min-height: 100vh;
  background-color: var(--color-surface-lt);
}


// =============================================
// SIDEBAR
// =============================================

.sidebar {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: $sidebar-width;
  background-color: var(--color-white);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 50;
  overflow: hidden;
  transition: width $transition-speed $transition-ease;

  .shell--collapsed & {
    width: $sidebar-width-collapsed;
  }
}

// ── Logo ──────────────────────────────────────

.sidebar__logo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: $topbar-height;
  padding: 0 12px 0 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;

  // Centrage de l'icône seule quand collapsed
  .shell--collapsed & {
    justify-content: center;
    padding: 0;
    cursor: pointer;
  }
}

.sidebar__logo-link {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-dark);
  text-decoration: none;
  overflow: hidden;
  min-width: 0;
  flex: 1;

  // En mode collapsed : centré, pas de flex-grow
  .shell--collapsed & {
    flex: none;
  }
}

.sidebar__logo-icon {
  width: 120px;
  flex-shrink: 0;
}

.shell--collapsed .sidebar__logo-icon {
  width: 25px;
}

.sidebar__logo-text {
  font-family: var(--font-medium);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
}

.sidebar__collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted);
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;

  svg { width: 14px; height: 14px; }

  &:hover {
    background-color: var(--color-surface-lt);
    color: var(--color-dark);
  }
}

// ── Sélecteur de projet ───────────────────────

.sidebar__project {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  margin: 8px;
  border-radius: var(--radius-inner);
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-lt);
  flex-shrink: 0;
}

.sidebar__project-info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.sidebar__project-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background-color: var(--color-dark);
  color: var(--color-white);
  font-family: var(--font-medium);
  font-size: 12px;
  font-weight: 500;
  flex-shrink: 0;
}

.sidebar__project-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  overflow: hidden;
}

.sidebar__project-name {
  font-family: var(--font-medium);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__project-plan {
  font-size: 11px;
  color: var(--color-muted);
}

.sidebar__project-switch {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted);
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;

  svg { width: 14px; height: 14px; }

  &:hover {
    background-color: var(--color-border);
    color: var(--color-dark);
  }
}

// ── Navigation ────────────────────────────────

.sidebar__nav {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 2px;
}

.sidebar__nav-group-label {
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--color-muted);
  padding: 6px 8px 4px;
  white-space: nowrap;
}

.sidebar__nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 36px;
  padding: 0 8px;
  border-radius: var(--radius-inner);
  color: var(--color-muted);
  text-decoration: none;
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  transition: background-color 0.12s ease, color 0.12s ease;
  position: relative;

  &:hover {
    background-color: var(--color-surface-lt);
    color: var(--color-dark);
  }

  &--active {
    background-color: var(--color-surface);
    color: var(--color-dark);

    .sidebar__nav-icon svg {
      color: var(--color-dark);
    }
  }

  // Mode collapsed : centré, sans label
  &--collapsed {
    justify-content: center;
    padding: 0;
    width: 40px;
    height: 40px;
    margin-inline: auto;
  }
}

.sidebar__nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;

  svg { width: 16px; height: 16px; color: currentColor; }
}

.sidebar__nav-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__nav-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background-color: var(--color-dark);
  color: var(--color-white);
  font-size: 10px;
  font-weight: 500;
  flex-shrink: 0;
}

// Spacer

.sidebar__spacer { flex: 1; }

// Navigation bottom

.sidebar__nav--bottom {
  border-top: 1px solid var(--color-border);
  padding-top: 8px;
}

// ── Profil utilisateur ────────────────────────

.sidebar__user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 8px;
  border-radius: var(--radius-inner);
  margin: 4px 8px 8px;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-lt);

  &--collapsed {
    justify-content: center;
    padding: 0;
    width: 40px;
    height: 40px;
    border: none;
    background: none;
    margin-inline: auto;
    margin-bottom: 12px;
  }
}

.sidebar__user-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: var(--color-dark);
  color: var(--color-white);
  font-family: var(--font-medium);
  font-size: 11px;
  font-weight: 500;
  flex-shrink: 0;
}

.sidebar__user-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.sidebar__user-name {
  font-family: var(--font-medium);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__user-email {
  font-size: 11px;
  color: var(--color-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__user-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted);
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;

  svg { width: 14px; height: 14px; }

  &:hover {
    background-color: var(--color-border);
    color: var(--color-dark);
  }
}


// =============================================
// ZONE PRINCIPALE
// =============================================

.shell__main {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-width: 0;
  flex: 1;

  // Compense la sidebar fixed
  margin-left: $sidebar-width;
  transition: margin-left $transition-speed $transition-ease;

  .shell--collapsed & {
    margin-left: $sidebar-width-collapsed;
  }
}



// =============================================
// TOPBAR
// =============================================

.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 8px;
  height: $topbar-height;
  padding: 0 24px;
  background-color: var(--color-white);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

// Burger mobile (caché sur desktop)

.topbar__burger {
  display: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-dark);
  flex-shrink: 0;

  svg { width: 18px; height: 18px; }
  &:hover { background-color: var(--color-surface-lt); }
}

.topbar__expand-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted);
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;

  svg { width: 14px; height: 14px; }

  &:hover {
    background-color: var(--color-surface-lt);
    color: var(--color-dark);
  }
}

// Fil d'Ariane

.topbar__breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;               // ← pousse les actions vers la droite
  min-width: 0;
}

.topbar__breadcrumb-sep {
  width: 10px;
  height: 10px;
  color: var(--color-border);
  flex-shrink: 0;
}

.topbar__breadcrumb-root {
  font-size: 13px;
  color: var(--color-muted);
  white-space: nowrap;
}

.topbar__breadcrumb-current {
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-dark);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

// Actions

.topbar__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.topbar__action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border-radius: var(--radius-inner);
  font-family: var(--font-medium);
  font-size: 13px;
  cursor: pointer;
  border: none;
  white-space: nowrap;
  transition: opacity 0.15s ease;

  svg { width: 14px; height: 14px; }

  &:hover { opacity: 0.85; }

  &--primary {
    background-color: var(--color-dark);
    color: var(--color-white);
  }
}

.topbar__icon-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: none;
  border: 1px solid var(--color-border);
  cursor: pointer;
  color: var(--color-muted);
  transition: background-color 0.15s ease, color 0.15s ease;

  svg { width: 16px; height: 16px; }

  &:hover {
    background-color: var(--color-surface-lt);
    color: var(--color-dark);
  }
}

.topbar__icon-btn-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #EF4444;
  border: 1.5px solid var(--color-white);
}

.topbar__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background-color: var(--color-dark);
  color: var(--color-white);
  font-family: var(--font-medium);
  font-size: 11px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover { opacity: 0.85; }
}

// =============================================
// QUOTA UTILISATION
// =============================================

.sidebar__quota {
  padding: 8px 12px;
  margin: 0 8px 8px;
  border-radius: var(--radius-inner);
  border: 1px solid var(--color-border);
  background: var(--color-surface-lt);
  display: flex;
  flex-direction: column;
  gap: 6px;

  .shell--collapsed & { display: none; }
}

.sidebar__quota-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--color-muted);
}

.sidebar__quota-count {
  font-family: var(--font-medium);
  color: var(--color-dark);
}

.sidebar__quota-bar {
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);
  overflow: hidden;
}

.sidebar__quota-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--color-dark);
  transition: width 0.4s ease;

  &--warning { background: #F59E0B; }
  &--danger  { background: #EF4444; }
}

.sidebar__quota-upgrade {
  font-size: 11px;
  font-family: var(--font-medium);
  color: #F59E0B;
  text-decoration: none;
  &:hover { text-decoration: underline; }
}


// =============================================
// CONTENU
// =============================================

.shell__content {
  flex: 1;
  padding: 28px 24px;
  min-width: 0;
  overflow-x: hidden;
}


// =============================================
// BACKDROP MOBILE
// =============================================

.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 40;
  backdrop-filter: blur(2px);
  animation: backdropIn 0.2s ease;
}

@keyframes backdropIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}


// =============================================
// RESPONSIVE
// =============================================


@media (max-width: 1023px) {
  .shell__main {
    margin-left: 0;
  }

  .sidebar {
    width: $sidebar-width;
    transform: translateX(-100%);
    transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
    box-shadow: none;

    &--open {
      transform: translateX(0);
      box-shadow: 4px 0 24px rgba(0, 0, 0, 0.1);
    }
  }

  .shell--collapsed .sidebar { width: $sidebar-width; }

  .sidebar__collapse-btn { display: none; }
  .topbar__expand-btn    { display: none; } // ← masqué sur mobile aussi
  .topbar__burger        { display: flex; }

  .topbar__action-btn span { display: none; }
}

@media (max-width: 767px) {
  .shell__content          { padding: 20px 16px; }
  .topbar                  { padding: 0 16px; }
  .topbar__breadcrumb-root { display: none; }
}

```

# app\features\dashboard\shell\dashboard-shell.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardShell } from './dashboard-shell';

describe('DashboardShell', () => {
  let component: DashboardShell;
  let fixture: ComponentFixture<DashboardShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardShell],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\dashboard\shell\dashboard-shell.ts

```ts
import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';
import { BillingService, QuotaResult } from '../../../shared/components/billing/billing.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
}

@Component({
  selector: 'app-dashboard-shell',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-shell.html',
  styleUrl: './dashboard-shell.scss',
})
export class DashboardShell implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly billingService = inject(BillingService);

  readonly profile = this.userService.profile;
  readonly fullName = this.userService.fullName;
  readonly initials = this.userService.initials;
  readonly currentProject = this.dashboardContext.selectedProject;
  readonly currentPlan = this.dashboardContext.plan;

  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  logoutLoading = signal(false);
  quota = signal<QuotaResult | null>(null);

  navItems: NavItem[] = [
    { label: 'Vue d\'ensemble', path: '/dashboard', icon: 'home' },
    { label: 'Projets', path: '/dashboard/projects', icon: 'folder', badge: 3 },
    { label: 'Feedbacks', path: '/dashboard/feedbacks', icon: 'messages', badge: 12 },
    { label: 'Tendances', path: '/dashboard/trends', icon: 'chart' },
    { label: 'Widget', path: '/dashboard/widget', icon: 'code' },
  ];

  bottomNavItems: NavItem[] = [
    { label: 'Paramètres', path: '/dashboard/settings', icon: 'settings' },
    { label: 'Aide', path: '/dashboard/help', icon: 'help' },
  ];

  ngOnInit(): void {
    this.billingService.getQuota().subscribe({
      next: quota => this.quota.set(quota),
      error: () => { /* silencieux — la sidebar reste sans barre de quota */ }
    });
  }

  logout(): void {
    if (this.logoutLoading()) return;
    this.logoutLoading.set(true);
    this.auth.logout();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
    document.body.style.overflow = this.mobileMenuOpen() ? 'hidden' : '';
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    document.body.style.overflow = '';
  }

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.closeMobileMenu();
  }
}
```

# app\features\dashboard\trends\trends.html

```html
<div class="trends">

  <!-- ═══════════════════════════════════════════════════════
       PAYWALL — utilisateur Free
       ═══════════════════════════════════════════════════════ -->
  @if (!isPro()) {
    <app-paywall [title]="'Graphique de tendances'" [subtitle]="'L\'accès aux graphiques de tendances est disponible à partir du plan'">
    </app-paywall>

  } @else {
    <!-- ── En-tête ──────────────────────────────────────────── -->
    <header class="trends__header">
      <div>
        <h1 class="trends__title">Tendances</h1>
        <p class="trends__subtitle">Évolution de vos feedbacks dans le temps</p>
      </div>

      <!-- Sélecteur de période -->
      <div class="period-toggle">
        @for (p of periods; track p.value) {
          <button
            class="period-toggle__btn"
            [class.period-toggle__btn--active]="period() === p.value"
            (click)="setPeriod(p.value)">
            {{ p.label }}
          </button>
        }
      </div>
    </header>

    <!-- ── Loading ───────────────────────────────────────────── -->
    @if (loading()) {
      <div class="trends__loading">
        <div class="skeleton skeleton--summary"></div>
        <div class="skeleton skeleton--chart"></div>
        <div class="skeleton skeleton--breakdown"></div>
      </div>
    }

    <!-- ── Erreur ─────────────────────────────────────────────── -->
    @if (error()) {
      <div class="trends__error">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor"
            stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10" cy="10" r="8"/>
          <line x1="10" y1="6" x2="10" y2="10.5"/>
          <circle cx="10" cy="14" r="0.5" fill="currentColor"/>
        </svg>
        {{ error() }}
        <button class="trends__error-retry" (click)="load()">Réessayer</button>
      </div>
    }

    @if (!loading() && !error() && data()) {

      <!-- ── KPI Cards ─────────────────────────────────────────── -->
      <div class="kpi-grid">

        <div class="kpi-card">
          <span class="kpi-card__label">Total sur la période</span>
          <span class="kpi-card__value">{{ summary()?.totalPeriod }}</span>
          <div class="kpi-card__trend" [class.kpi-card__trend--up]="growthPositive()"
              [class.kpi-card__trend--down]="!growthPositive()">
            @if (growthPositive()) {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2 12 8 6 12 10 14 4"/>
              </svg>
            } @else {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
                  stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2 4 8 10 12 6 14 12"/>
              </svg>
            }
            {{ growthLabel() }} vs période précédente
          </div>
        </div>

        <div class="kpi-card">
          <span class="kpi-card__label">Moyenne par jour</span>
          <span class="kpi-card__value">{{ summary()?.avgPerDay }}</span>
          <span class="kpi-card__sub">feedbacks / jour</span>
        </div>

        <div class="kpi-card kpi-card--accent">
          <span class="kpi-card__label">Pic de la période</span>
          <span class="kpi-card__value">{{ summary()?.peakCount }}</span>
          <span class="kpi-card__sub">{{ formatPeakDate(summary()?.peakDate ?? '') }}</span>
        </div>

        <div class="kpi-card">
          <span class="kpi-card__label">Période précédente</span>
          <span class="kpi-card__value">{{ summary()?.totalPrevious }}</span>
          <span class="kpi-card__sub">feedbacks</span>
        </div>

      </div>

      <!-- ── Graphique principal ────────────────────────────── -->
      <section class="chart-section">

        <div class="chart-section__header">
          <h2 class="chart-section__title">Volume journalier</h2>

          <!-- Toggle bar / line -->
          <div class="chart-type-toggle">
            <button
              class="chart-type-btn"
              [class.chart-type-btn--active]="chartType() === 'bar'"
              (click)="setChartType('bar')"
              title="Barres">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="8"  width="4" height="7" rx="1"/>
                <rect x="6" y="4"  width="4" height="11" rx="1"/>
                <rect x="11" y="1" width="4" height="14" rx="1"/>
              </svg>
            </button>
            <button
              class="chart-type-btn"
              [class.chart-type-btn--active]="chartType() === 'line'"
              (click)="setChartType('line')"
              title="Courbe">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
                  stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="1 12 5 7 9 9 15 3"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Graphique en barres -->
        @if (chartType() === 'bar') {
          <div class="bar-chart">
            @if (volume().length === 0 || maxVolume() === 0) {
              <div class="chart-empty">Aucune donnée sur cette période.</div>
            } @else {
              <div class="bar-chart__bars">
                @for (point of volume(); track trackByDate($index, point)) {
                  <div class="bar-chart__item">
                    <div class="bar-chart__bar-wrap">
                      <div
                        class="bar-chart__bar"
                        [style.height.%]="getBarHeight(point.count)"
                        [title]="point.date + ' : ' + point.count + ' feedback(s)'">
                        @if (point.count > 0) {
                          <span class="bar-chart__value">{{ point.count }}</span>
                        }
                      </div>
                    </div>
                    @if (showLabel($index)) {
                      <span class="bar-chart__label">
                        {{ point.date | date:'dd/MM' }}
                      </span>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Graphique en courbe SVG -->
        @if (chartType() === 'line') {
          <div class="line-chart">
            @if (volume().length === 0 || maxVolume() === 0) {
              <div class="chart-empty">Aucune donnée sur cette période.</div>
            } @else {
              <svg
                class="line-chart__svg"
                viewBox="0 0 600 160"
                preserveAspectRatio="none"
                xmlns="http://www.w3.org/2000/svg">

                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stop-color="#3B82F6" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="#3B82F6" stop-opacity="0"/>
                  </linearGradient>
                </defs>

                <!-- Aire sous la courbe -->
                <path
                  [attr.d]="areaPath()"
                  fill="url(#areaGrad)"
                  class="line-chart__area"/>

                <!-- Ligne de la courbe -->
                <path
                  [attr.d]="linePath()"
                  fill="none"
                  stroke="#3B82F6"
                  stroke-width="2.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="line-chart__line"/>

                <!-- Points interactifs -->
                @for (pt of linePoints(); track pt.date) {
                  <g class="line-chart__point-group">
                    <circle
                      [attr.cx]="pt.x"
                      [attr.cy]="pt.y"
                      r="4"
                      fill="white"
                      stroke="#3B82F6"
                      stroke-width="2"
                      class="line-chart__dot">
                      <title>{{ pt.date | date:'dd/MM/yyyy' }} — {{ pt.count }} feedback(s)</title>
                    </circle>
                  </g>
                }
              </svg>

              <!-- Labels X -->
              <div class="line-chart__labels">
                @for (point of volume(); track point.date; let i = $index) {
                  @if (showLabel(i)) {
                    <span class="line-chart__label">
                      {{ point.date | date:'dd/MM' }}
                    </span>
                  }
                }
              </div>
            }
          </div>
        }

      </section>

      <!-- ── Breakdowns ─────────────────────────────────────── -->
      <div class="breakdowns">

        <!-- Catégories -->
        <section class="breakdown-card">
          <h2 class="breakdown-card__title">Par catégorie</h2>

          @if (categories().length === 0) {
            <p class="breakdown-card__empty">Aucune donnée.</p>
          } @else {
            <div class="breakdown-list">
              @for (cat of categories(); track cat.category) {
                <div class="breakdown-item">
                  <div class="breakdown-item__header">
                    <span class="breakdown-item__label">
                      {{ getCategoryLabel(cat.category) }}
                    </span>
                    <span class="breakdown-item__count">
                      {{ cat.count }}
                      <span class="breakdown-item__pct">{{ cat.percentage }}%</span>
                    </span>
                  </div>
                  <div class="breakdown-item__bar-bg">
                    <div
                      class="breakdown-item__bar"
                      [style.width.%]="cat.percentage"
                      [style.background]="getCategoryColor(cat.category)">
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Priorités -->
        <section class="breakdown-card">
          <h2 class="breakdown-card__title">Par priorité</h2>

          @if (priorities().length === 0) {
            <p class="breakdown-card__empty">Aucune donnée.</p>
          } @else {
            <div class="breakdown-list">
              @for (pri of priorities(); track pri.priority) {
                <div class="breakdown-item">
                  <div class="breakdown-item__header">
                    <span class="breakdown-item__label">
                      {{ getPriorityLabel(pri.priority) }}
                    </span>
                    <span class="breakdown-item__count">
                      {{ pri.count }}
                      <span class="breakdown-item__pct">{{ pri.percentage }}%</span>
                    </span>
                  </div>
                  <div class="breakdown-item__bar-bg">
                    <div
                      class="breakdown-item__bar"
                      [style.width.%]="pri.percentage"
                      [style.background]="getPriorityColor(pri.priority)">
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </section>

      </div>

    }
  }
</div>
```

# app\features\dashboard\trends\trends.scss

```scss
.trends {
  padding: 2rem;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: fadeIn 0.25s ease;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

// ── En-tête ────────────────────────────────────────────────
.trends__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.trends__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem;
}

.trends__subtitle {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0;
}

// ── Toggle période ─────────────────────────────────────────
.period-toggle {
  display: flex;
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}

.period-toggle__btn {
  padding: 0.4rem 0.875rem;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  &--active {
    background: var(--color-background-primary);
    color: var(--color-text-primary);
    font-weight: 600;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  &:hover:not(&--active) {
    color: var(--color-text-primary);
  }
}

// ── KPI Grid ───────────────────────────────────────────────
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.kpi-card {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  animation: slideUp 0.3s ease both;

  @for $i from 1 through 4 {
    &:nth-child(#{$i}) { animation-delay: #{$i * 0.05}s; }
  }

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  &--accent {
    background: linear-gradient(135deg, #EFF6FF, #F5F3FF);
    border-color: #BFDBFE;
  }
}

.kpi-card__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.kpi-card__value {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-text-primary);
  line-height: 1;
}

.kpi-card__sub {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

.kpi-card__trend {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.75rem;
  font-weight: 500;
  margin-top: 0.2rem;

  svg { width: 14px; height: 14px; }

  &--up   { color: #16A34A; }
  &--down { color: #DC2626; }
}

// ── Section graphique ──────────────────────────────────────
.chart-section {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 12px;
  padding: 1.5rem;
}

.chart-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.chart-section__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

// ── Toggle chart type ──────────────────────────────────────
.chart-type-toggle {
  display: flex;
  gap: 4px;
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 7px;
  padding: 3px;
}

.chart-type-btn {
  width: 32px;
  height: 32px;
  border-radius: 5px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  svg { width: 14px; height: 14px; }

  &--active {
    background: var(--color-background-primary);
    color: var(--color-accent, #3B82F6);
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }

  &:hover:not(&--active) { color: var(--color-text-primary); }
}

// ── Bar chart ──────────────────────────────────────────────
.bar-chart {
  height: 200px;
  display: flex;
  align-items: flex-end;
}

.bar-chart__bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  width: 100%;
  height: 100%;
  padding-bottom: 1.5rem;
  position: relative;
}

.bar-chart__item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  height: 100%;
  position: relative;
}

.bar-chart__bar-wrap {
  width: 100%;
  flex: 1;
  display: flex;
  align-items: flex-end;
}

.bar-chart__bar {
  width: 100%;
  min-height: 2px;
  background: var(--color-accent, #3B82F6);
  border-radius: 3px 3px 0 0;
  opacity: 0.8;
  transition: opacity 0.15s ease, transform 0.15s ease;
  cursor: default;
  position: relative;
  animation: barIn 0.4s ease both;

  @keyframes barIn {
    from { transform: scaleY(0); transform-origin: bottom; }
    to   { transform: scaleY(1); transform-origin: bottom; }
  }

  &:hover {
    opacity: 1;
    transform: scaleY(1.02);
    transform-origin: bottom;
  }
}

.bar-chart__value {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  font-weight: 600;
  color: var(--color-text-secondary);
  white-space: nowrap;
  opacity: 0;
  transition: opacity 0.15s ease;

  .bar-chart__bar:hover & { opacity: 1; }
}

.bar-chart__label {
  position: absolute;
  bottom: -1.4rem;
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  white-space: nowrap;
}

// ── Line chart ─────────────────────────────────────────────
.line-chart {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.line-chart__svg {
  width: 100%;
  height: 160px;
  overflow: visible;
}

.line-chart__line {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: drawLine 1.2s ease forwards;

  @keyframes drawLine {
    to { stroke-dashoffset: 0; }
  }
}

.line-chart__area {
  animation: fadeArea 1.2s ease forwards;
  opacity: 0;

  @keyframes fadeArea {
    to { opacity: 1; }
  }
}

.line-chart__dot {
  transition: r 0.15s ease;
  &:hover { r: 6; }
}

.line-chart__labels {
  display: flex;
  justify-content: space-between;
  padding: 0 10px;
}

.line-chart__label {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
}

// ── Chart empty ────────────────────────────────────────────
.chart-empty {
  width: 100%;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

// ── Breakdowns ─────────────────────────────────────────────
.breakdowns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

.breakdown-card {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 12px;
  padding: 1.25rem;
}

.breakdown-card__title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 1rem;
}

.breakdown-card__empty {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.breakdown-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.35rem;
}

.breakdown-item__label {
  font-size: 0.8rem;
  color: var(--color-text-primary);
  font-weight: 500;
}

.breakdown-item__count {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.breakdown-item__pct {
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--color-text-secondary);
  margin-left: 0.3rem;
}

.breakdown-item__bar-bg {
  height: 6px;
  background: var(--color-background-secondary);
  border-radius: 3px;
  overflow: hidden;
}

.breakdown-item__bar {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
  animation: barGrow 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both;

  @keyframes barGrow {
    from { width: 0 !important; }
  }
}

// ── Loading skeletons ──────────────────────────────────────
.trends__loading {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.skeleton {
  border-radius: 12px;
  background: linear-gradient(
    90deg,
    var(--color-background-secondary) 25%,
    var(--color-border-tertiary) 50%,
    var(--color-background-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  &--summary   { height: 100px; }
  &--chart     { height: 240px; }
  &--breakdown { height: 180px; }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
}

// ── Erreur ─────────────────────────────────────────────────
.trends__error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  border-radius: 8px;
  color: #BE123C;
  font-size: 0.875rem;

  svg { width: 18px; height: 18px; flex-shrink: 0; }
}

.trends__error-retry {
  margin-left: auto;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #FECDD3;
  background: white;
  color: #BE123C;
  font-size: 0.8rem;
  cursor: pointer;

  &:hover { background: #FFF1F2; }
}
```

# app\features\dashboard\trends\trends.service.ts

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TrendsData } from './trends.types';

@Injectable({ providedIn: 'root' })
export class TrendsService {
  private readonly http = inject(HttpClient);
  private readonly API  = environment.apiUrl;

  get(days: number, projectId?: string): Observable<TrendsData> {
    let params = new HttpParams().set('days', days);
    if (projectId) params = params.set('projectId', projectId);

    return this.http.get<TrendsData>(
      `${this.API}/trends`,
      { params, withCredentials: true }
    );
  }
}
```

# app\features\dashboard\trends\trends.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Trends } from './trends';

describe('Trends', () => {
  let component: Trends;
  let fixture: ComponentFixture<Trends>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Trends],
    }).compileComponents();

    fixture = TestBed.createComponent(Trends);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\dashboard\trends\trends.ts

```ts
import { Component, OnInit, inject, signal, computed, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TrendsService } from './trends.service';
import { TrendsData, Period, ChartType, TrendPoint } from './trends.types';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { Paywall } from '../../../shared/components/paywall/paywall';

@Component({
  selector: 'app-trends',
  imports: [CommonModule, DatePipe, RouterLink, Paywall],
  templateUrl: './trends.html',
  styleUrl: './trends.scss',
})
export class Trends implements OnInit, AfterViewInit {
  private readonly service = inject(TrendsService);
  private readonly userService = inject(UserService);

  @ViewChild('lineCanvas') lineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;

  // ─── State ────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  data = signal<TrendsData | null>(null);
  period = signal<Period>(30);
  chartType = signal<ChartType>('bar');

  readonly periods: { value: Period; label: string }[] = [
    { value: 7, label: '7 jours' },
    { value: 30, label: '30 jours' },
    { value: 90, label: '90 jours' },
  ];

  // ─── Accès plan ───────────────────────────────────────────────────────────
  readonly isPro = computed(() => {
    const plan = this.userService.profile()?.plan ?? 'Free';
    return plan === 'Pro' || plan === 'Team';
  });


  // ─── Computed ─────────────────────────────────────────────
  readonly summary = computed(() => this.data()?.summary);
  readonly volume = computed(() => this.data()?.dailyVolume ?? []);
  readonly categories = computed(() => this.data()?.categoryBreakdown ?? []);
  readonly priorities = computed(() => this.data()?.priorityBreakdown ?? []);

  readonly maxVolume = computed(() =>
    Math.max(...this.volume().map(d => d.count), 1));

  readonly growthPositive = computed(() =>
    (this.summary()?.growthRate ?? 0) >= 0);

  readonly growthLabel = computed(() => {
    const rate = this.summary()?.growthRate ?? 0;
    return rate >= 0 ? `+${rate}%` : `${rate}%`;
  });

  // ─── Chart path pour la courbe SVG ───────────────────────
  readonly linePath = computed(() => {
    const points = this.volume();
    if (points.length < 2) return '';
    return this.buildLinePath(points, 600, 160);
  });

  readonly areaPath = computed(() => {
    const points = this.volume();
    if (points.length < 2) return '';
    return this.buildAreaPath(points, 600, 160);
  });

  readonly linePoints = computed(() => {
    const points = this.volume();
    return this.buildPoints(points, 600, 160);
  });

  // ─── Lifecycle ────────────────────────────────────────────
  ngOnInit(): void { this.load(); }
  ngAfterViewInit(): void { }

  load(): void {
    if (!this.isPro()) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.service.get(this.period()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les tendances.');
        this.loading.set(false);
      }
    });
  }

  setPeriod(p: Period): void {
    this.period.set(p);
    this.load();
  }

  setChartType(t: ChartType): void {
    this.chartType.set(t);
  }

  // ─── SVG helpers ──────────────────────────────────────────
  private buildPoints(
    points: TrendPoint[], w: number, h: number
  ): { x: number; y: number; count: number; date: string }[] {
    const max = Math.max(...points.map(p => p.count), 1);
    const pad = 10;
    const step = (w - pad * 2) / Math.max(points.length - 1, 1);

    return points.map((p, i) => ({
      x: pad + i * step,
      y: h - pad - ((p.count / max) * (h - pad * 2)),
      count: p.count,
      date: p.date,
    }));
  }

  private buildLinePath(points: TrendPoint[], w: number, h: number): string {
    const pts = this.buildPoints(points, w, h);
    if (pts.length < 2) return '';

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
    }
    return d;
  }

  private buildAreaPath(points: TrendPoint[], w: number, h: number): string {
    const line = this.buildLinePath(points, w, h);
    const pts = this.buildPoints(points, w, h);
    if (!line || pts.length < 2) return '';
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.x} ${h} L ${first.x} ${h} Z`;
  }

  // ─── Helpers ──────────────────────────────────────────────
  getCategoryColor(category: string): string {
    const map: Record<string, string> = {
      Bug: '#F43F5E',
      FeatureRequest: '#3B82F6',
      Question: '#F59E0B',
      Uncategorized: '#9CA3AF',
    };
    return map[category] ?? '#9CA3AF';
  }

  getCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      Bug: '🐛 Bug',
      FeatureRequest: '✨ Fonctionnalité',
      Question: '❓ Question',
      Uncategorized: '📝 Autre',
    };
    return map[category] ?? category;
  }

  getPriorityColor(priority: string): string {
    const map: Record<string, string> = {
      Critical: '#F43F5E',
      High: '#F59E0B',
      Normal: '#3B82F6',
      Low: '#9CA3AF',
    };
    return map[priority] ?? '#9CA3AF';
  }

  getPriorityLabel(priority: string): string {
    const map: Record<string, string> = {
      Critical: '🔴 Critique',
      High: '🟠 Haute',
      Normal: '🔵 Normale',
      Low: '⚪ Basse',
    };
    return map[priority] ?? priority;
  }

  formatPeakDate(date: string): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long'
    });
  }

  getBarHeight(count: number): number {
    return Math.round((count / this.maxVolume()) * 100);
  }

  showLabel(index: number): boolean {
    const total = this.volume().length;
    if (total <= 7) return true;
    if (total <= 30) return index % 5 === 0 || index === total - 1;
    return index % 15 === 0 || index === total - 1;
  }

  trackByDate(_: number, item: TrendPoint): string {
    return item.date;
  }
}
```

# app\features\dashboard\trends\trends.types.ts

```ts
export type Period = 7 | 30 | 90;
export type ChartType = 'bar' | 'line';

export interface TrendPoint {
  date:  string;
  count: number;
}

export interface CategoryBreakdown {
  category:   string;
  count:      number;
  percentage: number;
}

export interface PriorityBreakdown {
  priority:   string;
  count:      number;
  percentage: number;
}

export interface TrendSummary {
  totalPeriod:   number;
  totalPrevious: number;
  growthRate:    number;
  avgPerDay:     number;
  peakCount:     number;
  peakDate:      string;
}

export interface TrendsData {
  dailyVolume:       TrendPoint[];
  categoryBreakdown: CategoryBreakdown[];
  priorityBreakdown: PriorityBreakdown[];
  summary:           TrendSummary;
}
```

# app\features\dashboard\widget\widget-config.service.ts

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { WidgetConfig } from './widget.types';

@Injectable({ providedIn: 'root' })
export class WidgetConfigService {
  private readonly http = inject(HttpClient);
  private readonly API  = environment.apiUrl;

  getConfig(projectId: string): Observable<WidgetConfig> {
    return this.http.get<WidgetConfig>(
      `${this.API}/projects/${projectId}/widget-config`,
      { withCredentials: true }
    );
  }

  saveConfig(projectId: string, config: WidgetConfig): Observable<void> {
    return this.http.put<void>(
      `${this.API}/projects/${projectId}/widget-config`,
      config,
      { withCredentials: true }
    );
  }
}
```

# app\features\dashboard\widget\widget.html

```html
<!-- widget-configurator.html -->
<div class="widget-page">

  <!-- ═══════════════════════════════════════════════════════
       PAYWALL — utilisateur Free
       ═══════════════════════════════════════════════════════ -->
  @if (!isPro()) {
    <app-paywall [title]="'Personnalisation du widget'" [subtitle]="'La personnalisation et l\'intégration du widget sont disponibles à partir du plan'">
    </app-paywall>
  } @else {

    <!-- ═══════════════════════════════════════════════════════
        CONTENU NORMAL — Pro / Team
        ═══════════════════════════════════════════════════════ -->

    <!-- ── En-tête ──────────────────────────────────────────── -->
    <header class="widget-page__header">
      <div>
        <h1 class="widget-page__title">Configuration du widget</h1>
        <p class="widget-page__subtitle">
          Personnalisez l'apparence et le comportement de votre widget de feedback.
        </p>
      </div>

      <div class="widget-page__actions">
        <button class="widget-page__reset" (click)="reset()">
          Réinitialiser
        </button>
        <button class="widget-page__save" [disabled]="saving()" [class.widget-page__save--saved]="saved()"
          (click)="save()">
          @if (saving()) {
          <span class="btn-spinner"></span>
          Sauvegarde…
          } @else if (saved()) {
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <polyline points="2 8 6 12 14 4" />
          </svg>
          Sauvegardé !
          } @else {
          Sauvegarder
          }
        </button>
      </div>
    </header>

    @if (error()) {
    <div class="widget-page__error">{{ error() }}</div>
    }

    @if (loading()) {
    <div class="widget-page__loading">
      <div class="skeleton skeleton--panel"></div>
      <div class="skeleton skeleton--preview"></div>
    </div>
    }

    @if (!loading()) {
    <div class="widget-layout">

      <!-- ── Panneau de configuration ─────────────────────── -->
      <div class="config-panel">

        <!-- Mode d'affichage -->
        <section class="config-section">
          <h2 class="config-section__title">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
              stroke-linejoin="round">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <line x1="6" y1="2" x2="6" y2="14" />
            </svg>
            Mode d'affichage
          </h2>

          <div class="mode-grid">
            @for (mode of modes; track mode.value) {
            <button class="mode-card" [class.mode-card--active]="config().mode === mode.value"
              (click)="updateConfig({ mode: mode.value })">
              <svg class="mode-card__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"
                stroke-linecap="round" stroke-linejoin="round">
                <path [attr.d]="mode.icon" />
              </svg>
              <span class="mode-card__label">{{ mode.label }}</span>
              <span class="mode-card__desc">{{ mode.desc }}</span>
            </button>
            }
          </div>
        </section>

        <!-- Position -->
        @if (config().mode !== 'inline') {
        <section class="config-section">
          <h2 class="config-section__title">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
              stroke-linejoin="round">
              <circle cx="8" cy="8" r="6" />
              <line x1="8" y1="4" x2="8" y2="8" />
              <line x1="8" y1="8" x2="11" y2="11" />
            </svg>
            Position
          </h2>

          <div class="position-toggle">
            @for (pos of positions; track pos.value) {
            <button class="position-btn" [class.position-btn--active]="config().position === pos.value"
              (click)="updateConfig({ position: pos.value })">
              {{ pos.label }}
            </button>
            }
          </div>
        </section>
        }

        <!-- Couleur -->
        <section class="config-section">
          <h2 class="config-section__title">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
              stroke-linejoin="round">
              <circle cx="8" cy="8" r="6" />
              <path d="M8 2a6 6 0 0 1 0 12" />
            </svg>
            Couleur principale
          </h2>

          <div class="color-picker">
            <div class="color-presets">
              @for (preset of presetColors; track preset.value) {
              <button class="color-preset" [style.background]="preset.value"
                [class.color-preset--active]="config().primaryColor === preset.value" [title]="preset.label"
                (click)="updateConfig({ primaryColor: preset.value })">
                @if (config().primaryColor === preset.value) {
                <svg viewBox="0 0 12 12" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round">
                  <polyline points="1.5 6 4.5 9 10.5 3" />
                </svg>
                }
              </button>
              }
            </div>

            <div class="color-custom">
              <label class="color-custom__label">Personnalisée</label>
              <div class="color-custom__input-wrap">
                <input type="color" class="color-custom__picker" [value]="config().primaryColor"
                  (input)="updateConfig({ primaryColor: $any($event.target).value })">
                <input type="text" class="color-custom__hex" [value]="config().primaryColor" maxlength="7"
                  placeholder="#3B82F6" (change)="updateConfig({ primaryColor: $any($event.target).value })">
              </div>
            </div>
          </div>
        </section>

        <!-- Textes -->
        <section class="config-section">
          <h2 class="config-section__title">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
              stroke-linejoin="round">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="10" y2="8" />
              <line x1="2" y1="12" x2="12" y2="12" />
            </svg>
            Textes
          </h2>

          <div class="text-fields">

            <div class="text-field">
              <label class="text-field__label" for="widget-title">
                Titre du panneau
              </label>
              <input id="widget-title" class="text-field__input" type="text" placeholder="Votre avis compte"
                maxlength="60" [value]="config().title" (input)="updateConfig({ title: $any($event.target).value })">
              <span class="text-field__counter">
                {{ config().title.length }}/60
              </span>
            </div>

            <div class="text-field">
              <label class="text-field__label" for="widget-placeholder">
                Placeholder du textarea
              </label>
              <input id="widget-placeholder" class="text-field__input" type="text" placeholder="Décrivez votre retour…"
                maxlength="120" [value]="config().placeholder"
                (input)="updateConfig({ placeholder: $any($event.target).value })">
              <span class="text-field__counter">
                {{ config().placeholder.length }}/120
              </span>
            </div>

            <div class="text-field">
              <label class="text-field__label" for="widget-btn-label">
                Label du bouton flottant
              </label>
              <input id="widget-btn-label" class="text-field__input" type="text" placeholder="Feedback" maxlength="30"
                [value]="config().buttonLabel" (input)="updateConfig({ buttonLabel: $any($event.target).value })">
              <span class="text-field__counter">
                {{ config().buttonLabel.length }}/30
              </span>
            </div>

          </div>
        </section>

      </div>

      <!-- ── Prévisualisation ──────────────────────────────── -->
      <div class="preview-panel">

        <div class="preview-panel__header">
          <h2 class="preview-panel__title">Aperçu en temps réel</h2>
          <span class="preview-panel__badge">Live</span>
        </div>

        <div class="preview-frame">
          <!-- Fausse page cliente -->
          <div class="fake-page">
            <div class="fake-page__bar">
              <div class="fake-page__dots">
                <span></span><span></span><span></span>
              </div>
              <div class="fake-page__url">monsite.com</div>
            </div>
            <div class="fake-page__content">
              <div class="fake-line fake-line--title"></div>
              <div class="fake-line fake-line--text"></div>
              <div class="fake-line fake-line--text fake-line--short"></div>
              <div class="fake-line fake-line--text"></div>
            </div>

            <!-- Widget preview inline -->
            @if (config().mode === 'inline' || config().mode === 'both') {
            <div class="widget-preview widget-preview--inline">
              <div class="widget-preview__form">
                <p class="widget-preview__title" [style.color]="config().primaryColor">
                  {{ config().title || 'Votre avis compte' }}
                </p>
                <div class="widget-preview__textarea">
                  {{ config().placeholder || 'Décrivez votre retour…' }}
                </div>
                <div class="widget-preview__categories">
                  <span class="widget-preview__cat">🐛 Bug</span>
                  <span class="widget-preview__cat">✨ Idée</span>
                  <span class="widget-preview__cat">❓ Question</span>
                </div>
                <button class="widget-preview__submit" [style.background]="config().primaryColor">
                  Envoyer
                </button>
              </div>
            </div>
            }

            <!-- Widget preview flottant -->
            @if (config().mode === 'floating' || config().mode === 'both') {
            <button class="widget-preview__trigger"
              [class.widget-preview__trigger--left]="config().position === 'bottom-left'"
              [style.background]="config().primaryColor" (click)="previewOpen.update(v => !v)">
              @if (!previewOpen()) {
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                stroke-linejoin="round">
                <path d="M2 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6l-4 4V5z" />
              </svg>
              {{ config().buttonLabel || 'Feedback' }}
              } @else {
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round">
                <line x1="4" y1="4" x2="16" y2="16" />
                <line x1="16" y1="4" x2="4" y2="16" />
              </svg>
              Fermer
              }
            </button>

            @if (previewOpen()) {
            <div class="widget-preview__panel" [class.widget-preview__panel--left]="config().position === 'bottom-left'">
              <div class="widget-preview__panel-header" [style.background]="config().primaryColor">
                <p class="widget-preview__panel-title">
                  {{ config().title || 'Votre avis compte' }}
                </p>
                <p class="widget-preview__panel-sub">
                  Aidez-nous à améliorer votre expérience
                </p>
              </div>
              <div class="widget-preview__form widget-preview__form--small">
                <div class="widget-preview__textarea widget-preview__textarea--small">
                  {{ config().placeholder || 'Décrivez votre retour…' }}
                </div>
                <div class="widget-preview__categories">
                  <span class="widget-preview__cat">🐛 Bug</span>
                  <span class="widget-preview__cat">✨ Idée</span>
                </div>
                <button class="widget-preview__submit widget-preview__submit--small"
                  [style.background]="config().primaryColor">
                  Envoyer
                </button>
              </div>
            </div>
            }
            }

          </div>
        </div>

        <!-- ── Snippet d'intégration ───────────────────────── -->
        <div class="snippet-box">
          <div class="snippet-box__tabs">
            <button class="snippet-box__tab" [class.snippet-box__tab--active]="activeSnippetTab() === 'cdn'"
              (click)="activeSnippetTab.set('cdn')">
              Script CDN
            </button>
            <button class="snippet-box__tab" [class.snippet-box__tab--active]="activeSnippetTab() === 'npm'"
              (click)="activeSnippetTab.set('npm')">
              npm module
            </button>

            <button class="snippet-box__copy" [class.snippet-box__copy--copied]="copiedSnippet()" (click)="copySnippet()">
              @if (copiedSnippet()) {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="2 8 6 12 14 4" />
              </svg>
              Copié !
              } @else {
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                stroke-linejoin="round">
                <rect x="5" y="5" width="9" height="9" rx="1.5" />
                <path d="M11 5V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H5" />
              </svg>
              Copier
              }
            </button>
          </div>

          <pre class="snippet-box__code"><code>{{
              activeSnippetTab() === 'cdn' ? snippet() : snippetNpmModule()
            }}</code></pre>
        </div>

      </div>

    </div>
    }
  }
</div>
```

# app\features\dashboard\widget\widget.scss

```scss
.widget-page {
  padding: 2rem;
  max-width: 1400px;
  animation: fadeIn 0.25s ease;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

// ── En-tête ────────────────────────────────────────────────
.widget-page__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.widget-page__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem;
}

.widget-page__subtitle {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.widget-page__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.widget-page__reset {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease;

  &:hover {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
  }
}

.widget-page__save {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1.25rem;
  background: var(--color-accent, #3B82F6);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;

  svg { width: 14px; height: 14px; }

  &:hover:not(:disabled) { filter: brightness(1.1); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }

  &--saved {
    background: #10B981;
    animation: pulse 0.3s ease;

    @keyframes pulse {
      0%   { transform: scale(1); }
      50%  { transform: scale(1.04); }
      100% { transform: scale(1); }
    }
  }
}

.widget-page__error {
  padding: 0.75rem 1rem;
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  border-radius: 8px;
  color: #BE123C;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

// ── Layout ─────────────────────────────────────────────────
.widget-layout {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 1.5rem;
  align-items: start;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
}

// ── Config panel ───────────────────────────────────────────
.config-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.config-section {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 12px;
  padding: 1.25rem;
}

.config-section__title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  svg { width: 14px; height: 14px; color: var(--color-text-secondary); }
}

// ── Mode grid ──────────────────────────────────────────────
.mode-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.875rem 0.5rem;
  border: 1.5px solid var(--color-border-primary);
  border-radius: 10px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;

  &:hover {
    border-color: var(--color-accent, #3B82F6);
    background: #EFF6FF;
  }

  &--active {
    border-color: var(--color-accent, #3B82F6);
    background: #EFF6FF;

    .mode-card__label { color: var(--color-accent, #3B82F6); }
  }
}

.mode-card__icon {
  width: 22px;
  height: 22px;
  color: var(--color-text-secondary);

  .mode-card--active & { color: var(--color-accent, #3B82F6); }
}

.mode-card__label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.mode-card__desc {
  font-size: 0.68rem;
  color: var(--color-text-secondary);
  line-height: 1.3;
}

// ── Position toggle ────────────────────────────────────────
.position-toggle {
  display: flex;
  gap: 4px;
  background: var(--color-background-secondary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 8px;
  padding: 3px;
}

.position-btn {
  flex: 1;
  padding: 0.4rem;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  &--active {
    background: var(--color-background-primary);
    color: var(--color-text-primary);
    font-weight: 600;
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
}

// ── Color picker ───────────────────────────────────────────
.color-presets {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 0.875rem;
}

.color-preset {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;

  svg { width: 14px; height: 14px; }

  &--active { border-color: var(--color-text-primary); }
  &:hover   { transform: scale(1.15); }
}

.color-custom__label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  display: block;
  margin-bottom: 0.4rem;
}

.color-custom__input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.color-custom__picker {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 1px solid var(--color-border-primary);
  padding: 2px;
  cursor: pointer;
  background: none;
}

.color-custom__hex {
  flex: 1;
  padding: 0.4rem 0.75rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  font-family: var(--font-mono, monospace);
  font-size: 0.8rem;
  color: var(--color-text-primary);
  background: var(--color-background-primary);
  outline: none;

  &:focus { border-color: var(--color-accent, #3B82F6); }
}

// ── Text fields ────────────────────────────────────────────
.text-fields { display: flex; flex-direction: column; gap: 0.875rem; }

.text-field { display: flex; flex-direction: column; gap: 0.35rem; }

.text-field__label {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.text-field__input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  outline: none;
  transition: border-color 0.15s ease;

  &:focus { border-color: var(--color-accent, #3B82F6); }
  &::placeholder { color: var(--color-text-secondary); }
}

.text-field__counter {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  text-align: right;
}

// ── Preview panel ──────────────────────────────────────────
.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: sticky;
  top: 1rem;
}

.preview-panel__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.preview-panel__title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.preview-panel__badge {
  font-size: 0.65rem;
  font-weight: 600;
  background: #FEF3C7;
  color: #D97706;
  padding: 0.15rem 0.5rem;
  border-radius: 20px;
  animation: livePulse 2s ease infinite;

  @keyframes livePulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.6; }
  }
}

// ── Preview frame ──────────────────────────────────────────
.preview-frame {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 12px;
  overflow: hidden;
}

.fake-page {
  background: #F8FAFC;
  min-height: 280px;
  position: relative;
}

.fake-page__bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: white;
  border-bottom: 1px solid #E2E8F0;
}

.fake-page__dots {
  display: flex;
  gap: 4px;

  span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #E2E8F0;

    &:nth-child(1) { background: #F87171; }
    &:nth-child(2) { background: #FCD34D; }
    &:nth-child(3) { background: #4ADE80; }
  }
}

.fake-page__url {
  font-size: 0.7rem;
  color: #94A3B8;
  background: #F1F5F9;
  padding: 0.2rem 0.75rem;
  border-radius: 20px;
  flex: 1;
  text-align: center;
}

.fake-page__content {
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.fake-line {
  height: 10px;
  border-radius: 4px;
  background: #E2E8F0;

  &--title { height: 16px; width: 60%; background: #CBD5E1; }
  &--text  { width: 100%; }
  &--short { width: 70%; }
}

// ── Widget preview ─────────────────────────────────────────
.widget-preview {
  &--inline {
    margin: 0 1rem 1rem;
    border-radius: 10px;
    border: 1px solid #E2E8F0;
    background: white;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  }
}

.widget-preview__trigger {
  position: absolute;
  bottom: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 50px;
  color: white;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 3px 12px rgba(0,0,0,0.2);
  transition: all 0.2s ease;

  svg { width: 14px; height: 14px; }
  &:hover { transform: translateY(-1px); }

  &--left { right: auto; left: 12px; }
}

.widget-preview__panel {
  position: absolute;
  bottom: 52px;
  right: 12px;
  width: 220px;
  background: white;
  border-radius: 10px;
  border: 1px solid #E2E8F0;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  overflow: hidden;
  animation: panelIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);

  @keyframes panelIn {
    from { opacity: 0; transform: scale(0.9) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  &--left { right: auto; left: 12px; }
}

.widget-preview__panel-header {
  padding: 10px 12px;
  color: white;
}

.widget-preview__panel-title {
  font-size: 11px;
  font-weight: 700;
  margin: 0 0 2px;
}

.widget-preview__panel-sub {
  font-size: 9px;
  opacity: 0.85;
  margin: 0;
}

.widget-preview__form {
  padding: 12px;

  &--small { padding: 8px 10px; }
}

.widget-preview__title {
  font-size: 12px;
  font-weight: 700;
  margin: 0 0 8px;
}

.widget-preview__textarea {
  width: 100%;
  min-height: 60px;
  border-radius: 6px;
  border: 1.5px solid #E2E8F0;
  background: #F8FAFC;
  padding: 8px;
  font-size: 10px;
  color: #94A3B8;
  margin-bottom: 8px;
  display: flex;
  align-items: flex-start;

  &--small { min-height: 40px; font-size: 9px; }
}

.widget-preview__categories {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.widget-preview__cat {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 20px;
  border: 1px solid #E2E8F0;
  color: #64748B;
  background: white;
}

.widget-preview__submit {
  width: 100%;
  padding: 7px;
  border: none;
  border-radius: 6px;
  color: white;
  font-size: 10px;
  font-weight: 600;
  cursor: default;
}

// ── Snippet box ────────────────────────────────────────────
.snippet-box {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-radius: 12px;
  overflow: hidden;
}

.snippet-box__tabs {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--color-border-tertiary);
  padding: 0 0.5rem;
  background: var(--color-background-secondary);
}

.snippet-box__tab {
  padding: 0.6rem 0.875rem;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s ease;

  &--active {
    color: var(--color-accent, #3B82F6);
    border-bottom-color: var(--color-accent, #3B82F6);
  }
}

.snippet-box__copy {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  border: 1px solid var(--color-border-primary);
  background: var(--color-background-primary);
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;

  svg { width: 12px; height: 12px; }

  &:hover {
    border-color: var(--color-accent, #3B82F6);
    color: var(--color-accent, #3B82F6);
  }

  &--copied {
    border-color: #86EFAC;
    color: #16A34A;
    background: #F0FDF4;
  }
}

.snippet-box__code {
  padding: 1rem;
  font-family: var(--font-mono, 'Fira Code', monospace);
  font-size: 0.72rem;
  line-height: 1.6;
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  background: #1E293B;
  color: #E2E8F0;
  max-height: 180px;
  overflow-y: auto;
}

// ── Spinner ────────────────────────────────────────────────
.btn-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;

  @keyframes spin { to { transform: rotate(360deg); } }
}

// ── Skeletons ──────────────────────────────────────────────
.widget-page__loading {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 1.5rem;

  @media (max-width: 1024px) { grid-template-columns: 1fr; }
}

.skeleton {
  border-radius: 12px;
  background: linear-gradient(
    90deg,
    var(--color-background-secondary) 25%,
    var(--color-border-tertiary) 50%,
    var(--color-background-secondary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;

  &--panel   { height: 500px; }
  &--preview { height: 400px; }

  @keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
}
```

# app\features\dashboard\widget\widget.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Widget } from './widget';

describe('Widget', () => {
  let component: Widget;
  let fixture: ComponentFixture<Widget>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Widget],
    }).compileComponents();

    fixture = TestBed.createComponent(Widget);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\dashboard\widget\widget.ts

```ts
import {
  Component, OnInit, inject, signal, computed,
  effect, Injector
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WidgetConfigService } from './widget-config.service';
import { WidgetConfig, WidgetMode, WidgetPosition, DEFAULT_CONFIG, PRESET_COLORS } from './widget.types';
import { environment } from '../../../../environments/environment';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';
import { RouterLink } from '@angular/router';
import { Paywall } from '../../../shared/components/paywall/paywall';

@Component({
  selector: 'app-widget',
  imports: [CommonModule, FormsModule, RouterLink, Paywall],
  templateUrl: './widget.html',
  styleUrl: './widget.scss',
})
export class Widget implements OnInit {
  private readonly service          = inject(WidgetConfigService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly injector         = inject(Injector);

  // ─── State ────────────────────────────────────────────────────────────────
  loading = signal(true);
  saving  = signal(false);
  saved   = signal(false);
  error   = signal('');
  config  = signal<WidgetConfig>({ ...DEFAULT_CONFIG });

  readonly project = this.dashboardContext.selectedProject;

    // ─── Accès plan ───────────────────────────────────────────────────────────
  readonly isPro = computed(() => {
    const plan = this.dashboardContext.plan();
    return plan === 'Pro' || plan === 'Team';
  });

  // ─── Preview ──────────────────────────────────────────────────────────────
  previewOpen = signal(false);

  // ─── Constantes ───────────────────────────────────────────────────────────
  readonly presetColors = PRESET_COLORS;

  readonly modes: { value: WidgetMode; label: string; desc: string; icon: string }[] = [
    { value: 'floating', label: 'Flottant',  desc: 'Bouton fixe en bas de page', icon: 'M12 2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6l-4 4V4a2 2 0 0 1 2-2h8z' },
    { value: 'inline',   label: 'Intégré',   desc: 'Formulaire dans la page',    icon: 'M3 5h18M3 10h18M3 15h10' },
    { value: 'both',     label: 'Les deux',  desc: 'Bouton + formulaire',         icon: 'M4 6h16M4 12h8m-8 6h16' },
  ];

  readonly positions: { value: WidgetPosition; label: string }[] = [
    { value: 'bottom-right', label: 'Bas droite' },
    { value: 'bottom-left',  label: 'Bas gauche' },
  ];

  // ─── Snippet généré ───────────────────────────────────────────────────────
  readonly snippet = computed(() => {
    const c = this.config();
    return `<script src="${environment.widgetCdnUrl}"></script>
<ai-review-hub
    token="${this.project()?.publicToken}"
    api-url="${environment.apiUrl}"
    mode="${c.mode}"
    title="${c.title}"
    placeholder="${c.placeholder}"
    primary-color="${c.primaryColor}"
    position="${c.position}">
</ai-review-hub>`;
  });

  readonly snippetNpmModule = computed(() => {
    const c = this.config();
    return `import 'ai-review-hub-widget';
// Dans votre composant HTML :
// <ai-review-hub
//   token="${this.project()?.publicToken}"
//   mode="${c.mode}"
//   primary-color="${c.primaryColor}">
// </ai-review-hub>`;
  });

  activeSnippetTab = signal<'cdn' | 'npm'>('cdn');
  copiedSnippet    = signal(false);

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Recharge la config à chaque changement de projet — comme feedbacks.ts
    effect(() => {
      const projectId = this.dashboardContext.selectedProject()?.id;

      // Reset immédiat pour éviter d'afficher la config de l'ancien projet
      this.config.set({ ...DEFAULT_CONFIG });
      this.error.set('');

      if (!projectId || !this.isPro()) {
        this.loading.set(false);
        return;
      }

      this.loading.set(true);

      this.service.getConfig(projectId).subscribe({
        next: (config) => {
          this.config.set(config);
          this.loading.set(false);
        },
        error: () => {
          // Pas de config sauvegardée — on reste sur DEFAULT_CONFIG
          this.loading.set(false);
        }
      });
    }, { injector: this.injector });
  }

  // ─── Config updates ───────────────────────────────────────────────────────
  updateConfig(partial: Partial<WidgetConfig>): void {
    this.config.update(c => ({ ...c, ...partial }));
  }

  // ─── Sauvegarde ───────────────────────────────────────────────────────────
  save(): void {
    const projectId = this.project()?.id;
    if (!projectId) return;

    this.saving.set(true);
    this.error.set('');

    this.service.saveConfig(projectId, this.config()).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2500);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Erreur lors de la sauvegarde.');
      }
    });
  }

  reset(): void {
    this.config.set({ ...DEFAULT_CONFIG });
  }

  async copySnippet(): Promise<void> {
    const text = this.activeSnippetTab() === 'cdn'
      ? this.snippet()
      : this.snippetNpmModule();

    try {
      await navigator.clipboard.writeText(text);
      this.copiedSnippet.set(true);
      setTimeout(() => this.copiedSnippet.set(false), 2000);
    } catch {
      // fallback silencieux
    }
  }
}
```

# app\features\dashboard\widget\widget.types.ts

```ts
export type WidgetMode = 'floating' | 'inline' | 'both';
export type WidgetPosition = 'bottom-right' | 'bottom-left';

export interface WidgetConfig {
    publicToken: string;
    mode: WidgetMode;
    position: WidgetPosition;
    primaryColor: string;
    title: string;
    placeholder: string;
    buttonLabel: string;
}

export const DEFAULT_CONFIG: WidgetConfig = {
    publicToken:  '',
    mode: 'floating',
    position: 'bottom-right',
    primaryColor: '#3B82F6',
    title: 'Votre avis compte',
    placeholder: 'Décrivez votre retour, bug ou suggestion…',
    buttonLabel: 'Feedback',
};

export const PRESET_COLORS = [
    { label: 'Bleu', value: '#3B82F6' },
    { label: 'Violet', value: '#8B5CF6' },
    { label: 'Emeraude', value: '#10B981' },
    { label: 'Rose', value: '#F43F5E' },
    { label: 'Orange', value: '#F59E0B' },
    { label: 'Ardoise', value: '#64748B' },
];
```

# app\features\landing\landing.html

```html
<app-navbar></app-navbar>
<main>
  <!-- =============================================
      HERO
      ============================================= -->
  <section class="hero">
    <div class="container">

      <!-- Texte + CTA -->
      <div class="hero-content">
        <div class="hero__text">
          <div class="badge">
            <a class="badge-content" target="_blank" rel="noopener noreferrer">
              <span class="badge__tag">
                <img class="badge__tag-icon" src="icon/ai.png" alt="ai icon" srcset="">
              </span>
              <span class="badge__text">Released project template and custom branding</span>
              <span class="badge__arrow" aria-hidden="true">
                <svg viewBox="0 0 12 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 4.5h10M7.5 1l3.5 3.5L7.5 8" stroke="currentColor" stroke-width="1.3"
                    stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </span>
            </a>
          </div>
          <h1 class="hero__title">Centralisez vos retours clients avec l'IA</h1>
          <p class="hero__subtitle">
            AI Review Hub collecte, catégorise et priorise automatiquement les feedbacks de vos clients,
            pour que vous puissiez vous concentrer sur ce qui compte vraiment.
          </p>
        </div>

        <div class="hero__actions">
          <a routerLink="/register" class="btn btn--primary">Commencer gratuitement</a>
          <a routerLink="/demo" class="btn btn--secondary">Voir la démo</a>
        </div>
      </div>

      <!-- Aperçu de l'app -->
      <div class="hero__preview">
        <nav class="preview__tabs" aria-label="Sections de l'application">
          @for (tab of tabs; track tab) {
          <button class="preview__tab" [class.preview__tab--active]="activeTab() === tab" (click)="setActiveTab(tab)">
            {{ tab }}
          </button>
          }
        </nav>

        <div class="preview__screen">
          <img src="https://framerusercontent.com/images/bAsadDlMyvGtPLrtxtIqvdEeE.png"
            alt="Tableau de bord AI Review Hub — vue kanban des feedbacks." width="1200" height="750" loading="eager"
            decoding="async">
        </div>
      </div>

      <!-- Social proof -->
      <div class="trust">
        <p class="trust__label">Adopté par des équipes innovantes partout dans le monde</p>
        <div class="trust__container">
          <div class="trust__logos">
            <img src="https://framerusercontent.com/images/c0hI1bbMHhU5EFJZ7kGSjpoaw.png" alt="Accenture"
              class="trust__logo">
            <img src="https://framerusercontent.com/images/JKiVrgSpVxkaCsrrWcEv8NWmKA.png" alt="Procurify"
              class="trust__logo">
            <img src="https://framerusercontent.com/images/RDFvpM8oV0XiXpoKL71Zu1xHr4M.png" alt="Cloudstaff"
              class="trust__logo">
            <img src="https://framerusercontent.com/images/dY7wKtAxE7tS89SKDTT12QLDlg.png" alt="KPMG"
              class="trust__logo">
            <img src="https://framerusercontent.com/images/P1UJMMnBwzachlcwnaE7VXPBzVs.png" alt="Amber"
              class="trust__logo">
          </div>
          <div class="trust__logos">
            <img src="https://framerusercontent.com/images/ZfvXT9v9k0ZU3MLcabPstm7jho.png" alt="Apress"
              class="trust__logo">
            <img src="https://framerusercontent.com/images/WrNigRJQqmF58VOtqCPpjUangw.png" alt="10up"
              class="trust__logo">
            <img src="https://framerusercontent.com/images/rXKXRsDqKVxw6122ZmSUMyOtVbg.png" alt="Partywave"
              class="trust__logo">
          </div>
        </div>
      </div>

    </div>
  </section>


  <!-- =============================================
       PROBLEM 
       ============================================= -->
  <section class="problem">
    <div class="container">

      <div class="problem__header">
        <span class="problem__label">
          <span class="problem__label-dot" aria-hidden="true"></span>
          Le problème
        </span>
        <h2 class="problem__title">
          Vos retours clients arrivent de <em>partout</em>.<br>Rien n'est priorisé.
        </h2>
        <p class="problem__subtitle">
          Emails, Slack, Notion, WhatsApp… Chaque feedback se perd dans un canal différent.
          Résultat : votre équipe passe plus de temps à trier qu'à corriger.
        </p>
      </div>

      <!-- Layout 40/60 : liste accordéon | panneau détail -->
      <div class="problem__layout">

        <!-- Colonne gauche : liste des problèmes -->
        <div class="problem__list" role="tablist" aria-label="Problèmes">
          @for (item of problemItems; track item.id; let i = $index) {
          <button class="problem__item" [class.problem__item--active]="activeProblem().id === item.id" role="tab"
            [attr.aria-selected]="activeProblem().id === item.id" [attr.aria-controls]="'problem-panel-' + item.id"
            type="button" (click)="setActiveProblem(item.id)">

            <!-- Numéro + icône -->
            <span class="problem__item-icon" [class.problem__item-icon--red]="item.accent === 'red'"
              [class.problem__item-icon--amber]="item.accent === 'amber'" aria-hidden="true">
              <ng-container [ngSwitch]="item.icon">
                <ng-container *ngSwitchCase="'chat'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                    stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'alert'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'clock'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'users'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                    stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'chart'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                    stroke-linejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'grid'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
                    stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                </ng-container>
              </ng-container>
            </span>

            <!-- Titre -->
            <span class="problem__item-title">{{ item.title }}</span>

            <!-- Flèche -->
            <svg class="problem__item-arrow" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"
              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>

            <!-- Barre de progression active -->
            @if (activeProblem().id === item.id) {
            <div class="problem__item-bar" aria-hidden="true"></div>
            }

          </button>
          }
        </div>

        <!-- Colonne droite : panneau de détail -->
        <div class="problem__panel" role="tabpanel" [attr.id]="'problem-panel-' + activeProblem()?.id"
          [attr.aria-label]="activeProblem()?.title">

          @if (activeProblem(); as p) {
          <div class="problem__panel-content" [attr.data-id]="p.id">

            <!-- Icône large -->
            <div class="problem__panel-icon" [class.problem__panel-icon--red]="p.accent === 'red'"
              [class.problem__panel-icon--amber]="p.accent === 'amber'" aria-hidden="true">
              <ng-container [ngSwitch]="p.icon">
                <ng-container *ngSwitchCase="'chat'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                    stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'alert'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'clock'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                    stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'users'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                    stroke-linejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'chart'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                    stroke-linejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'grid'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
                    stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18M9 21V9" />
                  </svg>
                </ng-container>
              </ng-container>
            </div>

            <h3 class="problem__panel-title">{{ p.title }}</h3>
            <p class="problem__panel-body">{{ p.body }}</p>

            <blockquote class="problem__panel-quote">
              <svg class="problem__panel-quote-mark" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M11.192 15.757c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.95.78-3 .53-.81 1.24-1.48 2.13-2.02L9.67 6c-1.35.6-2.48 1.5-3.38 2.7-.9 1.2-1.35 2.57-1.35 4.1 0 1.4.46 2.56 1.38 3.48.93.93 2.06 1.39 3.39 1.39 1.05 0 1.92-.36 2.61-1.08.7-.72 1.04-1.6 1.04-2.64v-.22zm8.43 0c0-.88-.23-1.618-.69-2.217-.326-.41-.77-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.1-1.95.78-3 .53-.81 1.24-1.48 2.13-2.02L18.1 6c-1.35.6-2.48 1.5-3.38 2.7-.9 1.2-1.35 2.57-1.35 4.1 0 1.4.46 2.56 1.38 3.48.93.93 2.06 1.39 3.39 1.39 1.05 0 1.92-.36 2.61-1.08.7-.72 1.04-1.6 1.04-2.64v-.22z" />
              </svg>
              {{ p.quote }}
            </blockquote>

          </div>
          }

        </div>
      </div>

      <!-- Bannière de conclusion -->
      <div class="problem__cta-banner">
        <p class="problem__cta-text">
          <strong>Vous vous reconnaissez ?</strong>
          AI Review Hub résout exactement ces problèmes — en moins de 5 minutes d'intégration.
        </p>
        <a routerLink="/register" class="problem__cta-link">
          Essayer gratuitement
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round" aria-hidden="true">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </a>
      </div>

    </div>
  </section>

  <!-- =============================================
      SOLUTION
      ============================================= -->
  <section class="solution">
    <div class="container">

      <div class="solution__header">
        <span class="solution__label">
          <span class="solution__label-dot" aria-hidden="true"></span>
          La solution
        </span>
        <h2 class="solution__title">
          Un seul endroit.<br>Tout est clair, tout est priorisé.
        </h2>
        <p class="solution__subtitle">
          AI Review Hub centralise chaque retour client, laisse l'IA faire le tri,
          et vous présente exactement ce qu'il faut corriger en premier.
        </p>
      </div>

      <div class="solution__bento">
        @for (step of solutionSteps; track step.id; let isEven = $even) {
        <div class="solution-bento-row" [class.solution-bento-row--reverse]="isEven">

          <!-- Bloc visuel -->
          <div class="solution-bento-visual">
            <div class="solution-bento-visual__number" aria-hidden="true">{{ step.number }}</div>
            <div class="solution-bento-visual__icon">
              <ng-container [ngSwitch]="step.icon">
                <ng-container *ngSwitchCase="'widget'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
                    stroke-linejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'ai'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
                    stroke-linejoin="round">
                    <path
                      d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 0 6h-1v1a4 4 0 0 1-8 0v-1H7a3 3 0 0 1 0-6h1V6a4 4 0 0 1 4-4z" />
                    <path d="M9 12h6M12 9v6" />
                  </svg>
                </ng-container>
                <ng-container *ngSwitchCase="'kanban'">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"
                    stroke-linejoin="round">
                    <rect x="3" y="3" width="5" height="10" rx="1" />
                    <rect x="10" y="3" width="5" height="6" rx="1" />
                    <rect x="17" y="3" width="5" height="14" rx="1" />
                    <rect x="10" y="11" width="5" height="6" rx="1" />
                    <rect x="3" y="15" width="5" height="6" rx="1" />
                  </svg>
                </ng-container>
              </ng-container>
            </div>
            <!-- Éléments décoratifs shimmer -->
            <div class="solution-bento-visual__deco" aria-hidden="true">
              <div class="solution-bento-visual__bar solution-bento-visual__bar--wide"></div>
              <div class="solution-bento-visual__bar solution-bento-visual__bar--mid"></div>
              <div class="solution-bento-visual__bar solution-bento-visual__bar--short"></div>
            </div>
          </div>

          <!-- Bloc texte -->
          <div class="solution-bento-text">
            <span class="solution-bento-text__step">Étape {{ step.number }}</span>
            <h3 class="solution-bento-text__title">{{ step.title }}</h3>
            <p class="solution-bento-text__desc">{{ step.description }}</p>
            <ul class="solution-bento-text__details">
              @for (detail of step.details; track detail) {
              <li class="solution-bento-text__detail">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                  stroke-linejoin="round" aria-hidden="true">
                  <polyline points="2.5 8 6 11.5 13.5 4" />
                </svg>
                {{ detail }}
              </li>
              }
            </ul>
          </div>

        </div>
        }
      </div>

    </div>
  </section>

  <!-- =============================================
      FEATURES E — Tabs visuels (style "Linear")
      ============================================= -->
  <section class="feat-tabs-section">
    <div class="container">

      <div class="feat-tabs-section__header">
        <span class="section-label">
          <span class="section-label__dot" aria-hidden="true"></span>
          Fonctionnalités
        </span>
        <h2 class="feat-tabs-section__title">
          Tout ce dont vous avez besoin,<br>dans un seul outil.
        </h2>
        <p class="feat-tabs-section__subtitle">
          De la collecte à la résolution — AI Review Hub couvre chaque étape
          du traitement de vos retours clients.
        </p>
      </div>

      <div class="feat-tabs">

        <!-- Navigation verticale gauche -->
        <nav class="feat-tabs__nav" aria-label="Fonctionnalités">
          @for (tab of featureTabs; track tab.id) {
            <button
              class="feat-tabs__nav-item"
              [class.feat-tabs__nav-item--active]="activeFeatureTab() === tab.id"
              type="button"
              [attr.aria-selected]="activeFeatureTab() === tab.id"
              (click)="setActiveFeatureTab(tab.id)">

              <span class="feat-tabs__nav-icon" aria-hidden="true">
                <ng-container [ngSwitch]="tab.icon">
                  <ng-container *ngSwitchCase="'brain'">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10h6M10 7v6"/>
                    </svg>
                  </ng-container>
                  <ng-container *ngSwitchCase="'kanban'">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="2" width="4" height="9" rx="1"/><rect x="8" y="2" width="4" height="5" rx="1"/><rect x="14" y="2" width="4" height="12" rx="1"/><rect x="8" y="9" width="4" height="5" rx="1"/><rect x="2" y="13" width="4" height="5" rx="1"/>
                    </svg>
                  </ng-container>
                  <ng-container *ngSwitchCase="'code'">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="13 15 18 10 13 5"/><polyline points="7 5 2 10 7 15"/>
                    </svg>
                  </ng-container>
                  <ng-container *ngSwitchCase="'chart'">
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="18 10 15 10 12.5 17.5 7.5 2.5 5 10 2 10"/>
                    </svg>
                  </ng-container>
                </ng-container>
              </span>

              <span class="feat-tabs__nav-label">{{ tab.label }}</span>

              <!-- Barre active -->
              @if (activeFeatureTab() === tab.id) {
                <span class="feat-tabs__nav-bar" aria-hidden="true"></span>
              }

            </button>
          }
        </nav>

        <!-- Panneau droit : contenu + visuel -->
        @if (activeFeatureTabData(); as tab) {
          <div class="feat-tabs__panel" [attr.data-tab]="tab.id">

            <!-- Texte -->
            <div class="feat-tabs__panel-text">
              <h3 class="feat-tabs__panel-title">{{ tab.title }}</h3>
              <p class="feat-tabs__panel-desc">{{ tab.description }}</p>
              <ul class="feat-tabs__panel-list">
                @for (detail of tab.details; track detail) {
                  <li>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <polyline points="2.5 8 6 11.5 13.5 4"/>
                    </svg>
                    {{ detail }}
                  </li>
                }
              </ul>
            </div>

            <!-- Visuel mockup -->
            <div class="feat-tabs__panel-visual" [style.background-color]="tab.accentColor">

              <!-- Mockup : liste de feedbacks analysés -->
              @if (tab.mockType === 'feedback-list') {
                <div class="feat-mock-list">
                  <div class="feat-mock-list__item feat-mock-list__item--high">
                    <div class="feat-mock-list__tags">
                      <span class="feat-mock-list__tag feat-mock-list__tag--bug">Bug</span>
                      <span class="feat-mock-list__tag feat-mock-list__tag--high">Haute priorité</span>
                    </div>
                    <p class="feat-mock-list__text">"Le formulaire de paiement plante sur mobile"</p>
                    <p class="feat-mock-list__summary">Crash critique bloquant les conversions mobiles.</p>
                  </div>
                  <div class="feat-mock-list__item">
                    <div class="feat-mock-list__tags">
                      <span class="feat-mock-list__tag feat-mock-list__tag--feature">Feature</span>
                      <span class="feat-mock-list__tag feat-mock-list__tag--medium">Priorité normale</span>
                    </div>
                    <p class="feat-mock-list__text">"Ajouter un filtre par date dans les exports"</p>
                    <p class="feat-mock-list__summary">Demande d'amélioration du module export.</p>
                  </div>
                  <div class="feat-mock-list__item feat-mock-list__item--muted">
                    <div class="feat-mock-list__tags">
                      <span class="feat-mock-list__tag feat-mock-list__tag--question">Question</span>
                      <span class="feat-mock-list__tag feat-mock-list__tag--low">Basse priorité</span>
                    </div>
                    <p class="feat-mock-list__text">"Comment modifier mon profil ?"</p>
                    <p class="feat-mock-list__summary">Demande d'aide navigation — FAQ candidate.</p>
                  </div>
                </div>
              }

              <!-- Mockup : kanban -->
              @if (tab.mockType === 'kanban') {
                <div class="feat-mock-kanban">
                  <div class="feat-mock-kanban__col">
                    <div class="feat-mock-kanban__col-header">À traiter <span>3</span></div>
                    <div class="feat-mock-kanban__card feat-mock-kanban__card--high">Bug critique · Haute priorité</div>
                    <div class="feat-mock-kanban__card">Feature export · Normale</div>
                    <div class="feat-mock-kanban__card feat-mock-kanban__card--muted">Question doc · Basse</div>
                  </div>
                  <div class="feat-mock-kanban__col">
                    <div class="feat-mock-kanban__col-header">En cours <span>1</span></div>
                    <div class="feat-mock-kanban__card feat-mock-kanban__card--active">Refonte checkout · Haute</div>
                  </div>
                  <div class="feat-mock-kanban__col">
                    <div class="feat-mock-kanban__col-header">Résolu <span>2</span></div>
                    <div class="feat-mock-kanban__card feat-mock-kanban__card--done">Erreur 404 page contact</div>
                    <div class="feat-mock-kanban__card feat-mock-kanban__card--done">Lenteur chargement</div>
                  </div>
                </div>
              }

              <!-- Mockup : widget -->
              @if (tab.mockType === 'widget') {
                <div class="feat-mock-widget">
                  <div class="feat-mock-widget__window">
                    <div class="feat-mock-widget__win-bar">
                      <span class="feat-mock-widget__dot r"></span>
                      <span class="feat-mock-widget__dot a"></span>
                      <span class="feat-mock-widget__dot g"></span>
                      <span class="feat-mock-widget__win-url">client-site.fr</span>
                    </div>
                    <div class="feat-mock-widget__win-body">
                      <div class="feat-mock-widget__form">
                        <p class="feat-mock-widget__form-title">Envoyer un retour</p>
                        <div class="feat-mock-widget__field">Votre message…</div>
                        <div class="feat-mock-widget__submit">Envoyer →</div>
                      </div>
                    </div>
                  </div>
                  <div class="feat-mock-widget__snippet">
                    <span class="feat-mock-widget__snippet-kw">&#60;script&#62;</span>
                    <span class="feat-mock-widget__snippet-fn"> AIReviewHub</span>
                    <span class="feat-mock-widget__snippet-str">('proj_xxx')</span>
                    <span class="feat-mock-widget__snippet-kw">&#60;/script&#62;</span>
                  </div>
                </div>
              }

              <!-- Mockup : graphique tendances -->
              @if (tab.mockType === 'trends') {
                <div class="feat-mock-trends">
                  <div class="feat-mock-trends__header">
                    <span class="feat-mock-trends__label">Feedbacks · 30 derniers jours</span>
                    <span class="feat-mock-trends__value">+34%</span>
                  </div>
                  <div class="feat-mock-trends__chart">
                    @for (h of [30,45,28,60,42,75,52,88,65,72,48,90]; track $index) {
                      <div class="feat-mock-trends__bar" [style.height.%]="h"></div>
                    }
                  </div>
                  <div class="feat-mock-trends__legend">
                    <span>J-30</span>
                    <span>Aujourd'hui</span>
                  </div>
                </div>
              }

            </div>

          </div>
        }

      </div>
    </div>
  </section>

  <!-- =============================================
      FEATURES D — Tableau comparatif
      ============================================= -->
  <section class="feat-compare">
  <div class="container">

    <div class="feat-compare__header">
      <h2 class="feat-compare__title">Avant. Après.</h2>
      <p class="feat-compare__subtitle">
        Ce que ça change concrètement dans votre quotidien.
      </p>
    </div>

    <div class="feat-compare__table" role="table" aria-label="Comparaison avant/après AI Review Hub">

      <!-- En-tête -->
      <div class="feat-compare__thead" role="row">
        <div class="feat-compare__th feat-compare__th--topic" role="columnheader"></div>
        <div class="feat-compare__th feat-compare__th--before" role="columnheader">
          <span class="feat-compare__th-badge feat-compare__th-badge--before">Sans AI Review Hub</span>
        </div>
        <div class="feat-compare__th feat-compare__th--after" role="columnheader">
          <span class="feat-compare__th-badge feat-compare__th-badge--after">Avec AI Review Hub</span>
        </div>
      </div>

      <!-- Lignes -->
      @for (row of compareRows; track row.topic; let odd = $odd) {
        <div class="feat-compare__row" [class.feat-compare__row--odd]="odd" role="row">

          <div class="feat-compare__cell feat-compare__cell--topic" role="cell">
            {{ row.topic }}
          </div>

          <div class="feat-compare__cell feat-compare__cell--before" role="cell">
            <svg class="feat-compare__icon feat-compare__icon--x" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
              <line x1="4" y1="4" x2="12" y2="12"/><line x1="12" y1="4" x2="4" y2="12"/>
            </svg>
            {{ row.before }}
          </div>

          <div class="feat-compare__cell feat-compare__cell--after" role="cell">
            <svg class="feat-compare__icon feat-compare__icon--check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="2.5 8 6 11.5 13.5 4"/>
            </svg>
            {{ row.after }}
          </div>

        </div>
      }

    </div>

  </div>
  </section>

  <!-- =============================================
      VIDEO FEATURES — 3 colonnes média + légende
      ============================================= -->
  <section class="vf">
    <div class="container">

      <h2 class="vf__title">De la soumission à la résolution.</h2>

      <div class="vf__grid">
        @for (feat of videoFeatures; track feat.id; let isEven = $even) {
        <figure class="vf__item" [class.vf__item--even]="isEven">

          <!-- Zone média -->
          <div class="vf__media" [style.background-color]="feat.accent">
            @if (feat.videoSrc) {
            <!-- Vraie vidéo quand disponible -->
            <video class="vf__video" autoplay loop muted playsinline disablepictureinpicture
              [poster]="feat.posterSrc ?? ''">
              <source [src]="feat.videoSrc" type="video/mp4">
            </video>
            } @else {
            <!-- Placeholder animé -->
            <div class="vf__placeholder">
              <div class="vf__placeholder-ui">
                <div class="vf__ph-bar vf__ph-bar--wide"></div>
                <div class="vf__ph-bar vf__ph-bar--mid"></div>
                <div class="vf__ph-row">
                  <div class="vf__ph-card"></div>
                  <div class="vf__ph-card"></div>
                </div>
                <div class="vf__ph-bar vf__ph-bar--short"></div>
              </div>
            </div>
            }
          </div>

          <!-- Légende -->
          <figcaption class="vf__caption">
            <p class="vf__caption-title">{{ feat.title }}</p>
            <p class="vf__caption-desc">{{ feat.description }}</p>
          </figcaption>

        </figure>
        }
      </div>

    </div>
  </section>

  <!-- =============================================
      PRICING
      ============================================= -->
  <app-pricing></app-pricing>

  <!-- =============================================
      FAQ
      ============================================= -->
  <section class="faq">
    <div class="container">

      <div class="faq__layout">

        <!-- Colonne gauche : titre fixe -->
        <div class="faq__aside">
          <h2 class="faq__title">Questions<br>fréquentes</h2>
          <p class="faq__subtitle">
            Vous ne trouvez pas ce que vous cherchez ?
          </p>
          <a routerLink="/contact" class="faq__contact">
            Contactez-nous
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
              stroke-linejoin="round" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </a>
        </div>

        <!-- Colonne droite : accordéon -->
        <div class="faq__list" role="list">
          @for (faq of faqs; track faq.id) {
          <div class="faq-item" [class.faq-item--open]="openFaqId() === faq.id" role="listitem">

            <button class="faq-item__trigger" type="button" [attr.aria-expanded]="openFaqId() === faq.id"
              [attr.aria-controls]="faq.id" (click)="toggleFaq(faq.id)">
              <span class="faq-item__question">{{ faq.question }}</span>
              <span class="faq-item__icon" aria-hidden="true">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                  stroke-linejoin="round">
                  <path d="M4 6l4 4 4-4" />
                </svg>
              </span>
            </button>

            <div class="faq-item__body" [id]="faq.id" role="region">
              <p class="faq-item__answer">{{ faq.answer }}</p>
            </div>

          </div>
          }
        </div>

      </div>
    </div>
  </section>

  <!-- =============================================
      CTA — grande carte finale
      ============================================= -->
  <section class="cta">
    <div class="container">
      <div class="cta-container-card">

        <div class="cta__card">

          <!-- Colonne gauche : texte + boutons -->
          <div class="cta__content">
            <div class="cta__text">
              <h2 class="cta__title">
                Built for the future. Available today.
              </h2>
              <p class="cta__description">
                Unlock advanced features for streamlined efficiency and enhanced team collaboration. Upgrade now to
                transform the way you work.
              </p>
            </div>
            <div class="cta__actions">
              <a routerLink="/register" class="btn btn--primary">Get Started</a>
              <a routerLink="/demo" class="btn btn--secondary">See Demo</a>
            </div>
          </div>

          <!-- Séparateur vertical -->
          <div class="cta__divider" aria-hidden="true"></div>

          <!-- Colonne droite : aperçu de l'app -->
          <div class="cta__preview">
            <div class="cta__preview-inner">
              <div class="cta__preview-frame">
                <img src="https://framerusercontent.com/images/45M5KpkkXFKaZ84AXuicnKyfrHQ.png"
                  alt="Aperçu du tableau de bord AI Review Hub." loading="lazy" decoding="async">
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </section>

  <app-footer></app-footer>

</main>
```

# app\features\landing\landing.scss

```scss
/* =============================================
   HERO SECTION — styles scopés au composant
   ============================================= */

.hero {
  overflow: hidden;
  background-color: rgb(247, 247, 248);
}

.hero-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  padding: 184px 152px 80px;
}

.hero__text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  max-width: 800px;
  margin-inline: auto;
  text-align: center;
}

.hero__title {
  font-family: var(--font-base);
  font-size: 64px;
  font-weight: 400;
  line-height: 1.125;
  color: var(--color-dark);
}

.hero__subtitle {
  font-size: 20px;
  font-weight: 400;
  line-height: 1.4;
  color: var(--color-muted);
}

/* CTA buttons */

.hero__actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

/* =============================================
   ANNOUNCEMENT BADGE
   ============================================= */
.badge {
    border: 1px solid rgb(239, 239, 240);
    border-radius: 20px;
    padding: 4px;

  
}
.badge-content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  border-radius: 20px;
  border: 1px solid rgb(220, 220, 221);
  background-color: rgb(239, 239, 240);
  text-decoration: none;
  color: var(--color-dark);
  cursor: pointer;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;

  &:hover {
    border-color: rgba(0, 0, 0, 0.18);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.07);

    .badge__arrow {
      transform: translateX(2px);
    }
  }
}

/* Pastille colorée "Nouveau" à gauche */


.badge__tag-icon {
  width: 20px;
  color: var(--color-dark);
  flex-shrink: 0;
}

/* Texte principal */

.badge__text {
  font-family: var(--font-base);
  font-size: 14px;
  line-height: 1.2;
  color: var(--color-dark);
  white-space: nowrap;
}

/* Flèche droite */

.badge__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 4px;
  flex-shrink: 0;
  transition: transform 0.2s ease;

  svg {
    width: 12px;
    height: 9px;
    color: var(--color-muted);
  }
}

/* =============================================
   APP PREVIEW
   ============================================= */

.preview__tabs {
  display: flex;
  gap: 4px;
  width: fit-content;
  margin-inline: auto;
  padding: 6px 6px 0;
  background-color: var(--color-surface-lt);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  list-style: none;
}

.preview__tab {
  padding: 7px 16px;
  border-radius: 14px 14px 14px 0;
  font-family: var(--font-medium);
  font-size: 14px;
  line-height: 22px;
  color: var(--color-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  &--active {
    background-color: var(--color-white);
    color: var(--color-dark);
    border: 0.5px solid var(--color-border);
  }
}

.preview__screen {
  background-color: var(--color-surface);
  border-radius: var(--radius-card);
  padding: 6px;

  img {
    width: 100%;
    height: auto;
    border-radius: var(--radius-inner);
    border: 0.5px solid var(--color-border);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    object-fit: cover;
  }
}

/* =============================================
   TRUST / SOCIAL PROOF
   ============================================= */

.trust {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding-block: 64px;
}

.trust__label {
  font-size: 20px;
  line-height: 24px;
  color: var(--color-dark);
  text-align: center;
}

.trust__container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.trust__logos {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 24px 40px;
}

.trust__logo {
  width: 115px;
  object-fit: contain;
  opacity: 0.75;
}


// =============================================
// PROBLEM — Accordéon interactif Option C
// =============================================
 
.problem { padding: 96px 0; }
 
// En-tête
 
.problem__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 640px;
  margin: 0 auto 64px;
  text-align: center;
}
 
.problem__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 0.5px solid var(--color-border);
  font-family: var(--font-medium);
  font-size: 11px;
  color: var(--color-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
 
.problem__label-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #EF4444;
  flex-shrink: 0;
  animation: pulse 2s ease-in-out infinite;
}
 
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%       { opacity: 0.5; transform: scale(0.8); }
}
 
.problem__title {
  font-family: var(--font-base);
  font-size: 48px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--color-dark);
 
  em {
    font-style: normal;
    position: relative;
 
    // Soulignement ondulé sous le mot clé
    &::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #EF4444, #F97316);
      border-radius: 2px;
    }
  }
}
 
.problem__subtitle {
  font-size: 18px;
  line-height: 1.55;
  color: var(--color-muted);
}
 
// ── Layout 40/60 ──────────────────────────────
 
.problem__layout {
  display: grid;
  grid-template-columns: 2fr 3fr;
  gap: 0;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
  margin-bottom: 16px;
  min-height: 480px;
}
 
// ── Colonne gauche : liste accordéon ──────────
 
.problem__list {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
}
 
.problem__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;
  overflow: hidden;
 
  &:last-child { border-bottom: none; }
 
  &:hover:not(.problem__item--active) {
    background-color: var(--color-surface-lt);
  }
 
  // État actif
  &--active {
    background-color: var(--color-white);
  }
}
 
// Icône de l'item
 
.problem__item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  transition: background-color 0.2s ease, border-color 0.2s ease;
 
  svg { width: 16px; height: 16px; color: var(--color-dark); }
 
  // Accent rouge
  &--red {
    background-color: #FEF2F2;
    border-color: #FECACA;
    svg { color: #EF4444; }
  }
 
  // Accent amber
  &--amber {
    background-color: #FFFBEB;
    border-color: #FDE68A;
    svg { color: #D97706; }
  }
 
  .problem__item--active & {
    background-color: var(--color-dark);
    border-color: var(--color-dark);
    svg { color: var(--color-white); }
  }
 
  .problem__item--active.problem__item--red & {
    background-color: #EF4444;
    border-color: #EF4444;
    svg { color: var(--color-white); }
  }
 
  .problem__item--active.problem__item--amber & {
    background-color: #D97706;
    border-color: #D97706;
    svg { color: var(--color-white); }
  }
}
 
// Titre de l'item
 
.problem__item-title {
  flex: 1;
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  color: var(--color-muted);
  transition: color 0.15s ease;
 
  .problem__item--active & { color: var(--color-dark); }
}
 
// Flèche
 
.problem__item-arrow {
  width: 14px;
  height: 14px;
  color: var(--color-border);
  flex-shrink: 0;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.2s ease, transform 0.2s ease, color 0.2s ease;
 
  .problem__item--active &,
  .problem__item:hover & {
    opacity: 1;
    transform: translateX(0);
    color: var(--color-muted);
  }
 
  .problem__item--active & { color: var(--color-dark); }
}
 
// Barre de progression en bas de l'item actif
 
.problem__item-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-dark), rgba(20,21,26,.3));
  border-radius: 1px;
  animation: barGrow 0s linear forwards; // pas d'auto-play, juste la présence
 
  @keyframes barGrow {
    from { width: 0; }
    to   { width: 100%; }
  }
}
 
// ── Colonne droite : panneau de détail ────────
 
.problem__panel {
  background-color: var(--color-surface-lt);
  display: flex;
  align-items: flex-start;
  padding: 40px 40px;
}
 
.problem__panel-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
  animation: panelFadeIn 0.25s ease;
}
 
@keyframes panelFadeIn {
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
}
 
// Icône large dans le panneau
 
.problem__panel-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background-color: var(--color-white);
  border: 1px solid var(--color-border);
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
  flex-shrink: 0;
 
  svg { width: 26px; height: 26px; color: var(--color-dark); }
 
  &--red {
    background-color: #FEF2F2;
    border-color: #FECACA;
    svg { color: #EF4444; }
  }
 
  &--amber {
    background-color: #FFFBEB;
    border-color: #FDE68A;
    svg { color: #D97706; }
  }
}
 
.problem__panel-title {
  font-family: var(--font-medium);
  font-size: 22px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--color-dark);
}
 
.problem__panel-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-muted);
}
 
// Citation dans le panneau
 
.problem__panel-quote {
  display: flex;
  gap: 14px;
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-inner);
  border: 1px solid var(--color-border);
  margin: 0;
}
 
.problem__panel-quote-mark {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  color: var(--color-border);
  margin-top: 2px;
}
 
.problem__panel-quote p,
.problem__panel-quote {
  font-size: 14px;
  font-style: italic;
  line-height: 1.65;
  color: var(--color-muted);
}
 
// ── Bannière de conclusion ────────────────────
 
.problem__cta-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 20px 28px;
  background-color: var(--color-surface-lt);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
}
 
.problem__cta-text {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-muted);
  strong { color: var(--color-dark); font-weight: 500; }
}
 
.problem__cta-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 8px 18px;
  border-radius: var(--radius-pill);
  background-color: var(--color-dark);
  color: var(--color-white);
  font-family: var(--font-medium);
  font-size: 14px;
  text-decoration: none;
  transition: opacity 0.15s ease, gap 0.15s ease;
  svg { width: 14px; height: 14px; }
  &:hover { opacity: 0.85; gap: 10px; }
}

// =============================================
// SOLUTION 
// =============================================

.solution { padding: 96px 0; }

.solution__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 640px;
  margin: 0 auto 72px;
  text-align: center;
}

.solution__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 0.5px solid var(--color-border);
  font-family: var(--font-medium);
  font-size: 11px;
  color: var(--color-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.solution__label-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-dark);
  flex-shrink: 0;
}

.solution__title {
  font-family: var(--font-base);
  font-size: 48px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--color-dark);
}

.solution__subtitle {
  font-size: 18px;
  line-height: 1.55;
  color: var(--color-muted);
}

// ── Bento rows ────────────────────────────────

.solution__bento {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.solution-bento-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
  min-height: 320px;

  // Ligne paire : visuel à droite, texte à gauche
  &--reverse {
    .solution-bento-visual { order: 2; }
    .solution-bento-text   { order: 1; }
  }
}

// ── Bloc visuel ───────────────────────────────

.solution-bento-visual {
  position: relative;
  background-color: var(--color-dark);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 48px;

  // Motif de points
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, rgba(255,255,255,.07) 1px, transparent 1px);
    background-size: 24px 24px;
    pointer-events: none;
  }
}

// Grand numéro décoratif en arrière-plan
.solution-bento-visual__number {
  position: absolute;
  bottom: -24px;
  right: -8px;
  font-family: var(--font-medium);
  font-size: 160px;
  font-weight: 500;
  line-height: 1;
  color: rgba(255, 255, 255, 0.04);
  pointer-events: none;
  user-select: none;
  letter-spacing: -8px;
}

// Icône centrale
.solution-bento-visual__icon {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 88px;
  height: 88px;
  border-radius: 22px;
  background-color: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(8px);

  svg {
    width: 44px;
    height: 44px;
    color: rgba(255, 255, 255, 0.9);
  }
}

// Barres décoratives shimmer en bas du bloc
.solution-bento-visual__deco {
  position: absolute;
  bottom: 24px;
  left: 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 1;
}

.solution-bento-visual__bar {
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    90deg,
    rgba(255,255,255,.06) 0%,
    rgba(255,255,255,.18) 50%,
    rgba(255,255,255,.06) 100%
  );
  background-size: 200% 100%;
  animation: solutionShimmer 2.4s ease-in-out infinite;

  &--wide  { width: 80px; }
  &--mid   { width: 56px; animation-delay: 0.3s; }
  &--short { width: 36px; animation-delay: 0.6s; }
}

@keyframes solutionShimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}

// ── Bloc texte ────────────────────────────────

.solution-bento-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  padding: 48px 48px;
  background-color: var(--color-white);
}

.solution-bento-text__step {
  font-family: var(--font-medium);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-muted);
}

.solution-bento-text__title {
  font-family: var(--font-base);
  font-size: 28px;
  font-weight: 400;
  line-height: 1.25;
  color: var(--color-dark);
}

.solution-bento-text__desc {
  font-size: 15px;
  line-height: 1.7;
  color: var(--color-muted);
  max-width: 380px;
}

.solution-bento-text__details {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}

.solution-bento-text__detail {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  line-height: 1.4;
  color: var(--color-muted);

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    color: var(--color-dark);
  }
}

/* =============================================
   FEATURES E — Tabs visuels
   ============================================= */

.feat-tabs-section { padding: 96px 0; }

// En-tête

.section-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  border: 0.5px solid var(--color-border);
  font-family: var(--font-medium);
  font-size: 11px;
  color: var(--color-muted);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.section-label__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-dark);
  flex-shrink: 0;
}

.feat-tabs-section__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 640px;
  margin: 0 auto 64px;
  text-align: center;
}

.feat-tabs-section__title {
  font-family: var(--font-base);
  font-size: 48px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--color-dark);
}

.feat-tabs-section__subtitle {
  font-size: 18px;
  line-height: 1.55;
  color: var(--color-muted);
}

// Layout principal

.feat-tabs {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 0;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
  min-height: 420px;
}

// ── Navigation verticale ──────────────────────

.feat-tabs__nav {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border);
  background-color: var(--color-surface-lt);
}

.feat-tabs__nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  background: none;
  border: none;
  border-bottom: 1px solid var(--color-border);
  cursor: pointer;
  text-align: left;
  transition: background-color 0.15s ease;

  &:last-child { border-bottom: none; }

  &:hover:not(.feat-tabs__nav-item--active) {
    background-color: rgba(0,0,0,.03);
  }

  &--active {
    background-color: var(--color-white);
  }
}

.feat-tabs__nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  transition: background-color 0.15s ease, border-color 0.15s ease;

  svg {
    width: 15px;
    height: 15px;
    color: var(--color-muted);
    transition: color 0.15s ease;
  }

  .feat-tabs__nav-item--active & {
    background-color: var(--color-dark);
    border-color: var(--color-dark);
    svg { color: var(--color-white); }
  }
}

.feat-tabs__nav-label {
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-muted);
  flex: 1;
  transition: color 0.15s ease;

  .feat-tabs__nav-item--active & { color: var(--color-dark); }
}

.feat-tabs__nav-bar {
  position: absolute;
  right: 0;
  top: 20%;
  bottom: 20%;
  width: 2px;
  background-color: var(--color-dark);
  border-radius: 1px 0 0 1px;
}

// ── Panneau droit ──────────────────────────────

.feat-tabs__panel {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 420px;
  animation: tabPanelIn 0.2s ease;
}

@keyframes tabPanelIn {
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
}

.feat-tabs__panel-text {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  padding: 40px 36px;
  background-color: var(--color-white);
  border-right: 1px solid var(--color-border);
}

.feat-tabs__panel-title {
  font-family: var(--font-base);
  font-size: 22px;
  font-weight: 400;
  line-height: 1.3;
  color: var(--color-dark);
}

.feat-tabs__panel-desc {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-muted);
}

.feat-tabs__panel-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
  padding-top: 14px;
  border-top: 1px solid var(--color-border);

  li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--color-muted);
    line-height: 1.4;

    svg { width: 13px; height: 13px; flex-shrink: 0; color: var(--color-dark); }
  }
}

.feat-tabs__panel-visual {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  transition: background-color 0.3s ease;
}

// ── Mockups ───────────────────────────────────

// Feedback list

.feat-mock-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.feat-mock-list__item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: var(--radius-inner);
  background-color: var(--color-white);
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
  transition: box-shadow 0.15s ease;

  &--muted { opacity: 0.6; }
}

.feat-mock-list__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.feat-mock-list__tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 5px;
  font-family: var(--font-medium);
  font-size: 10px;
  font-weight: 500;

  &--bug      { background: #FEF2F2; color: #B91C1C; border: 1px solid #FECACA; }
  &--feature  { background: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE; }
  &--question { background: #F0FDF4; color: #15803D; border: 1px solid #BBF7D0; }
  &--high     { background: #FFF7ED; color: #C2410C; border: 1px solid #FED7AA; }
  &--medium   { background: #FAFAFA; color: #6B7280; border: 1px solid #E5E7EB; }
  &--low      { background: #FAFAFA; color: #9CA3AF; border: 1px solid #F3F4F6; }
}

.feat-mock-list__text {
  font-size: 12px;
  color: var(--color-dark);
  line-height: 1.4;
  font-style: italic;
}

.feat-mock-list__summary {
  font-size: 11px;
  color: var(--color-muted);
  line-height: 1.4;
}

// Kanban

.feat-mock-kanban {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
}

.feat-mock-kanban__col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.feat-mock-kanban__col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: var(--font-medium);
  font-size: 10px;
  font-weight: 500;
  color: var(--color-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 0 2px 6px;
  border-bottom: 1px solid var(--color-border);

  span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: 4px;
    background-color: var(--color-surface);
    font-size: 10px;
    color: var(--color-muted);
  }
}

.feat-mock-kanban__card {
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background-color: var(--color-white);
  font-size: 11px;
  color: var(--color-dark);
  line-height: 1.4;

  &--high   { border-left: 3px solid #EF4444; }
  &--active { border-left: 3px solid #3B82F6; background-color: #EFF6FF; }
  &--done   { opacity: 0.45; text-decoration: line-through; }
  &--muted  { opacity: 0.6; }
}

// Widget

.feat-mock-widget {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 260px;
}

.feat-mock-widget__window {
  border-radius: 10px;
  border: 1px solid var(--color-border);
  overflow: hidden;
  background-color: var(--color-white);
  box-shadow: 0 4px 16px rgba(0,0,0,.08);
}

.feat-mock-widget__win-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 8px 12px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.feat-mock-widget__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  &.r { background: #EF4444; opacity: 0.7; }
  &.a { background: #F59E0B; opacity: 0.7; }
  &.g { background: #10B981; opacity: 0.7; }
}

.feat-mock-widget__win-url {
  margin-left: 6px;
  font-size: 10px;
  color: var(--color-muted);
}

.feat-mock-widget__win-body { padding: 12px; }

.feat-mock-widget__form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feat-mock-widget__form-title {
  font-family: var(--font-medium);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-dark);
}

.feat-mock-widget__field {
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 11px;
  color: var(--color-muted);
  background-color: var(--color-surface-lt);
  height: 52px;
}

.feat-mock-widget__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 7px;
  border-radius: 6px;
  background-color: var(--color-dark);
  color: var(--color-white);
  font-family: var(--font-medium);
  font-size: 11px;
}

.feat-mock-widget__snippet {
  padding: 10px 14px;
  border-radius: 8px;
  background-color: rgba(20,21,26,.9);
  font-size: 11px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
  align-items: center;
}

.feat-mock-widget__snippet-kw  { color: #93C5FD; }
.feat-mock-widget__snippet-fn  { color: #C4B5FD; }
.feat-mock-widget__snippet-str { color: #86EFAC; }

// Trends

.feat-mock-trends {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 20px;
  background-color: var(--color-white);
  border-radius: var(--radius-inner);
  border: 1px solid var(--color-border);
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
}

.feat-mock-trends__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.feat-mock-trends__label {
  font-size: 11px;
  color: var(--color-muted);
  font-family: var(--font-medium);
}

.feat-mock-trends__value {
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  color: #10B981;
}

.feat-mock-trends__chart {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 72px;
}

.feat-mock-trends__bar {
  flex: 1;
  background-color: var(--color-dark);
  border-radius: 3px 3px 0 0;
  opacity: 0.15;
  transition: opacity 0.15s ease;

  &:nth-child(8), &:nth-child(12) { opacity: 0.85; }
  &:nth-child(9), &:nth-child(11) { opacity: 0.55; }
  &:nth-child(10)                 { opacity: 0.7; }
}

.feat-mock-trends__legend {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 10px;
  color: var(--color-muted);
}


/* =============================================
   FEATURES D — Tableau comparatif
   ============================================= */

.feat-compare { padding: 96px 0; }

.feat-compare__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: 0 auto 56px;
  text-align: center;
}

.feat-compare__title {
  font-family: var(--font-base);
  font-size: 52px;
  font-weight: 400;
  line-height: 1.1;
  color: var(--color-dark);
}

.feat-compare__subtitle {
  font-size: 18px;
  line-height: 1.5;
  color: var(--color-muted);
}

// Table

.feat-compare__table {
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

// En-tête

.feat-compare__thead {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-bottom: 1px solid var(--color-border);
  background-color: var(--color-surface-lt);
}

.feat-compare__th {
  padding: 16px 20px;
  display: flex;
  align-items: center;

  & + & { border-left: 1px solid var(--color-border); }
}

.feat-compare__th-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  font-family: var(--font-medium);
  font-size: 12px;
  font-weight: 500;

  &--before {
    background-color: #FEF2F2;
    color: #B91C1C;
    border: 1px solid #FECACA;
  }

  &--after {
    background-color: #F0FDF4;
    color: #15803D;
    border: 1px solid #BBF7D0;
  }
}

// Ligne

.feat-compare__row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  border-bottom: 1px solid var(--color-border);
  transition: background-color 0.12s ease;

  &:last-child { border-bottom: none; }

  &--odd { background-color: var(--color-surface-lt); }

  &:hover { background-color: rgba(0,0,0,.015); }
}

.feat-compare__cell {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px 20px;
  font-size: 14px;
  line-height: 1.5;

  & + & { border-left: 1px solid var(--color-border); }

  &--topic {
    font-family: var(--font-medium);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-dark);
    align-items: center;
  }

  &--before { color: var(--color-muted); }
  &--after  { color: var(--color-dark); }
}

.feat-compare__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  margin-top: 2px;

  &--x     { color: #EF4444; }
  &--check { color: #10B981; }
}

// =============================================
// VIDEO FEATURES — 3 colonnes média + légende
// =============================================
 
.vf {
  padding: 96px 0;
}
 
.vf__title {
  font-family: var(--font-base);
  font-size: 52px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--color-dark);
  text-align: center;
  max-width: 600px;
  margin: 0 auto 80px;
}
 
// Grille 3 colonnes
 
.vf__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px;
  align-items: start;
}
 
// Item — figure
 
.vf__item {
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
 
  // Sur tablette : 2 colonnes (média | légende), alternées
  @media (min-width: 720px) and (max-width: 1279px) {
    grid-template-columns: 1fr 1fr;
    align-items: center;
    gap: 24px;
 
    // Items pairs : légende à gauche, média à droite
    &--even .vf__caption {
      order: -1;
    }
  }
}
 
// Zone médias
 
.vf__media {
  width: 100%;
  aspect-ratio: 1 / 1.1;
  border-radius: 24px;
  overflow: hidden;
  display: grid;
  place-items: center;
  position: relative;
}
 
.vf__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
 
// Placeholder animé
 
.vf__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
 
.vf__placeholder-ui {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}
 
.vf__ph-bar {
  height: 10px;
  border-radius: 6px;
  background: linear-gradient(90deg,
    rgba(0,0,0,.06) 0%,
    rgba(0,0,0,.12) 50%,
    rgba(0,0,0,.06) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
 
  &--wide  { width: 80%; }
  &--mid   { width: 60%; }
  &--short { width: 40%; }
}
 
.vf__ph-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 4px 0;
}
 
.vf__ph-card {
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(90deg,
    rgba(0,0,0,.06) 0%,
    rgba(0,0,0,.12) 50%,
    rgba(0,0,0,.06) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.6s ease-in-out infinite;
 
  &:nth-child(2) { animation-delay: 0.2s; }
}
 
@keyframes shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
 
// Légende
 
.vf__caption {
  text-align: center;
 
  @media (min-width: 720px) and (max-width: 1279px) {
    text-align: left;
  }
}
 
.vf__caption-title {
  font-family: var(--font-medium);
  font-size: 18px;
  font-weight: 500;
  line-height: 1.3;
  color: var(--color-dark);
}
 
.vf__caption-desc {
  margin-top: 8px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-muted);
  max-width: 270px;
  margin-inline: auto;
 
  @media (min-width: 720px) and (max-width: 1279px) {
    margin-inline: 0;
  }
}

// =============================================
// PRICING
// =============================================
 
.pricing { padding: 96px 0; }
 
.pricing__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 560px;
  margin: 0 auto 64px;
  text-align: center;
}
 
.pricing__title {
  font-family: var(--font-base);
  font-size: 48px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--color-dark);
}
 
.pricing__subtitle {
  font-size: 18px;
  line-height: 1.55;
  color: var(--color-muted);
}
 
// Grille des 3 cartes
 
.pricing__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  align-items: start;
}
 
// Carte
 
.pricing-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background-color: var(--color-white);
  padding: 28px;
  position: relative;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
 
  &:hover {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.07);
    transform: translateY(-2px);
  }
 
  // Carte mise en avant (Pro)
  &--featured {
    border-color: var(--color-dark);
    background-color: var(--color-dark);
    color: var(--color-white);
    transform: translateY(-8px); // légèrement surélevée
 
    &:hover {
      transform: translateY(-12px);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
    }
  }
}
 
// Badge "Le plus populaire"
 
.pricing-card__badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 4px 10px;
  margin-bottom: 16px;
  border-radius: var(--radius-pill);
  background-color: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-family: var(--font-medium);
  font-size: 12px;
  color: var(--color-white);
}
 
// En-tête de la carte
 
.pricing-card__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}
 
.pricing-card__name {
  font-family: var(--font-medium);
  font-size: 18px;
  font-weight: 500;
  color: var(--color-dark);
 
  .pricing-card--featured & {
    color: var(--color-white);
  }
}
 
.pricing-card__price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
 
.pricing-card__amount {
  font-family: var(--font-base);
  font-size: 40px;
  font-weight: 400;
  line-height: 1;
  color: var(--color-dark);
 
  .pricing-card--featured & {
    color: var(--color-white);
  }
}
 
.pricing-card__period {
  font-size: 14px;
  color: var(--color-muted);
 
  .pricing-card--featured & {
    color: rgba(255, 255, 255, 0.6);
  }
}
 
.pricing-card__description {
  font-size: 14px;
  line-height: 1.55;
  color: var(--color-muted);
 
  .pricing-card--featured & {
    color: rgba(255, 255, 255, 0.7);
  }
}
 
// Bouton CTA
 
.pricing-card__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  font-family: var(--font-medium);
  font-size: 14px;
  text-decoration: none;
  transition: opacity 0.15s ease;
  margin-bottom: 24px;
 
  &:hover { opacity: 0.85; }
 
  &--primary {
    background-color: var(--color-white);
    color: var(--color-dark);
    border: none;
  }
 
  &--secondary {
    background-color: transparent;
    color: var(--color-dark);
    border: 1px solid var(--color-border);
  }
}
 
// Séparateur
 
.pricing-card__divider {
  height: 1px;
  background-color: var(--color-border);
  margin-bottom: 24px;
 
  .pricing-card--featured & {
    background-color: rgba(255, 255, 255, 0.15);
  }
}
 
// Liste des fonctionnalités
 
.pricing-card__features {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 0;
}
 
.pricing-card__feature {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--color-dark);
 
  .pricing-card--featured & {
    color: rgba(255, 255, 255, 0.85);
  }
}
 
.pricing-card__check {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-dark);
 
  .pricing-card--featured & {
    color: var(--color-white);
  }
}

// =============================================
// FAQ
// =============================================
 
.faq { padding: 96px 0; }
 
.faq__layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 64px;
  align-items: start;
}
 
// Colonne gauche sticky
 
.faq__aside {
  position: sticky;
  top: 96px;        // compense la navbar fixe
  display: flex;
  flex-direction: column;
  gap: 16px;
}
 
.faq__title {
  font-family: var(--font-base);
  font-size: 40px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--color-dark);
}
 
.faq__subtitle {
  font-size: 15px;
  line-height: 1.55;
  color: var(--color-muted);
}
 
.faq__contact {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-medium);
  font-size: 14px;
  color: var(--color-dark);
  text-decoration: none;
  transition: gap 0.15s ease;
 
  svg { width: 14px; height: 14px; flex-shrink: 0; }
 
  &:hover { gap: 10px; }
}
 
// Liste accordéon
 
.faq__list {
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
}
 
.faq-item {
  border-bottom: 1px solid var(--color-border);
 
  &:last-child { border-bottom: none; }
}
 
// Trigger (bouton question)
 
.faq-item__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  width: 100%;
  padding: 20px 24px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease;
 
  &:hover { background-color: var(--color-surface-lt); }
}
 
.faq-item__question {
  font-family: var(--font-medium);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--color-dark);
}
 
.faq-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  transition: transform 0.2s ease, background 0.15s ease;
 
  svg { width: 14px; height: 14px; color: var(--color-dark); }
 
  .faq-item--open & {
    transform: rotate(180deg);
    background-color: var(--color-dark);
    border-color: var(--color-dark);
    svg { color: var(--color-white); }
  }
}
 
// Corps (réponse)
 
.faq-item__body {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease;
  padding: 0 24px;
 
  .faq-item--open & {
    max-height: 400px;    // valeur suffisamment grande pour le contenu
    padding: 0 24px 20px;
  }
}
 
.faq-item__answer {
  font-size: 14px;
  line-height: 1.7;
  color: var(--color-muted);
  padding-top: 4px;
  border-top: 1px solid var(--color-border);
  padding-top: 16px;
}
 


// =============================================
// CTA
// =============================================

.cta { padding: 96px 0; }

.cta .container .cta-container-card {
  position: relative;
  padding: 100px 0;
  background-color: rgb(247, 247, 248);
  border-radius: 36px;
  overflow: hidden;
}

.cta__card {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  border-block: 1px solid var(--color-border);
  padding: 64px 100px;
  min-height: 400px;
}

// Colonne gauche — contenu texte + boutons

.cta__content {
  position: relative;
  z-index: 1;                   // ← passe au-dessus de l'image
  display: flex;
  flex-direction: column;
  gap: 32px;
  width: 472px;
  flex-shrink: 0;
  padding-right: 24px;
}

.cta__text {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cta__title {
  font-family: var(--font-base);
  font-size: 48px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--color-dark);
}

.cta__description {
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-muted);
}

.cta__actions {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

// Image positionnée en absolu — déborde volontairement

.cta__preview {
  position: absolute;           // ← sort du flux comme dans Framer
  top: 101px;
  left: 572px;                  // ← alignée juste après la colonne texte
  padding: 16px;
  background-color: var(--color-surface);
  z-index: 0;
}

.cta__preview-frame {
  width: 1104px;                // ← volontairement énorme, clippée par overflow: hidden
  border-radius: var(--radius-inner);
  border: 1px solid var(--color-border);
  overflow: hidden;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);

  img {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
    object-position: top left;  // ← on voit le coin supérieur gauche du dashboard
  }
}

.cta__divider {
    align-content: center;
    align-items: center;
    bottom: -391px;
    display: flex;
    flex: none;
    flex-direction: row;
    flex-wrap: nowrap;
    gap: 10px;
    justify-content: center;
    overflow: hidden;
    padding: 124px 0 0;
    position: absolute;
    right: -571px;
    top: -100px;
    width: 1136px;
    border-left: 1px solid var(--color-border);
}

// =============================================
// RESPONSIVE
// =============================================
 
@media (max-width: 1199px) {
  .hero__title          { font-size: 48px; line-height: 1.167; }
  .hero__subtitle       { font-size: 18px; }
  .problem__title { font-size: 40px; }
  .problem__grid  { grid-template-columns: 1fr 1fr; }
  .features__title      { font-size: 40px; }
  .faq__title           { font-size: 32px; }
  .faq__layout          { grid-template-columns: 240px 1fr; gap: 40px; }
  .cta__title           { font-size: 36px; }
  .cta__preview         { left: 500px; }
 
  .features__row--3 {
    grid-template-columns: 1fr 1fr;
    .feature-card:last-child { grid-column: 1 / -1; .feature-card__image { height: 180px; } }
  }

}
 
@media (max-width: 767px) {
  .hero-content         { padding: 100px 0 48px; }
  .hero__title          { font-size: 40px; line-height: 1.2; }
  .hero__subtitle       { font-size: 16px; }
  .preview__tabs        { display: none; }
  .trust__logo          { height: 22px; width: auto; }

  .problem             { padding: 64px 0; }
  .problem__header     { margin-bottom: 40px; }
  .problem__title      { font-size: 32px; }
  .problem__subtitle   { font-size: 16px; }
  .problem__layout     { grid-template-columns: 1fr; min-height: auto; }
  .problem__list       { border-right: none; border-bottom: 1px solid var(--color-border); }
  .problem__panel      { padding: 28px 24px; }
  .problem__cta-banner { flex-direction: column; align-items: flex-start; gap: 16px; }

  .vf                  { padding: 64px 0; }
  .vf__title           { font-size: 32px; margin-bottom: 48px; }
  .vf__item            { grid-template-columns: 1fr; }
  .vf__item--even .vf__caption { order: unset; }
  .vf__caption         { text-align: center; }
  .vf__caption-desc    { margin-inline: auto; }
  
  .faq                  { padding: 64px 0; }
  .faq__layout          { grid-template-columns: 1fr; gap: 32px; }
  .faq__aside           { position: static; }
  .faq__title           { font-size: 32px; }
 
  .cta                  { padding: 64px 0; }
  .cta .container .cta-container-card { padding: 48px 0; border-radius: 24px; }
  .cta__card            { flex-direction: column; padding: 40px 28px 0; min-height: unset; overflow: hidden; }
  .cta__content         { width: 100%; padding-right: 0; align-items: center; text-align: center; }
  .cta__title           { font-size: 28px; }
  .cta__actions         { justify-content: center; }
  .cta__preview         { position: relative; top: auto; bottom: auto; left: auto; width: 100%; margin-top: 32px; padding: 16px 16px 0; }
  .cta__preview-frame   { width: 100%; }
}



/* =============================================
   RESPONSIVE — Sections Feature
   ============================================= */

@media (max-width: 1199px) {
  .feat-tabs-section__title { font-size: 40px; }
  .feat-compare__title      { font-size: 40px; }

  .feat-tabs                { grid-template-columns: 180px 1fr; }
  .feat-tabs__panel         { grid-template-columns: 1fr; }
  .feat-tabs__panel-visual  { border-top: 1px solid var(--color-border); min-height: 200px; }
  .feat-tabs__panel-text    { border-right: none; }
}

@media (max-width: 767px) {
  .feat-tabs-section  { padding: 64px 0; }
  .feat-compare       { padding: 64px 0; }

  .feat-tabs-section__title { font-size: 32px; }
  .feat-tabs-section__subtitle { font-size: 16px; }
  .feat-compare__title      { font-size: 32px; }
  .feat-compare__subtitle   { font-size: 16px; }
  .feat-compare__header     { margin-bottom: 36px; }

  .feat-tabs                { grid-template-columns: 1fr; }
  .feat-tabs__nav           { flex-direction: row; overflow-x: auto; border-right: none; border-bottom: 1px solid var(--color-border); }
  .feat-tabs__nav-item      { border-bottom: none; border-right: 1px solid var(--color-border); white-space: nowrap; flex-shrink: 0; &:last-child { border-right: none; } }
  .feat-tabs__nav-bar       { top: auto; right: auto; left: 20%; right: 20%; bottom: 0; width: auto; height: 2px; border-radius: 1px 1px 0 0; }
  .feat-tabs__panel         { grid-template-columns: 1fr; }
  .feat-tabs__panel-visual  { min-height: 220px; border-top: 1px solid var(--color-border); }
  .feat-tabs__panel-text    { border-right: none; padding: 28px 24px; }

  .feat-compare__thead      { grid-template-columns: 1fr 1fr; }
  .feat-compare__th--topic  { display: none; }
  .feat-compare__row        { grid-template-columns: 1fr 1fr; }
  .feat-compare__cell--topic { display: none; }
}

/* =============================================
   RESPONSIVE — Sections Solution
   ============================================= */


@media (max-width: 1199px) {
  .solution__title              { font-size: 40px; }
  .solution-bento-text          { padding: 36px 36px; }
  .solution-bento-text__title   { font-size: 24px; }
}

@media (max-width: 767px) {
  .solution                     { padding: 64px 0; }
  .solution__header             { margin-bottom: 40px; }
  .solution__title              { font-size: 32px; }
  .solution__subtitle           { font-size: 16px; }

  .solution-bento-row {
    grid-template-columns: 1fr;
    min-height: auto;

    // Annule l'alternance sur mobile — visuel toujours en haut
    &--reverse {
      .solution-bento-visual { order: 0; }
      .solution-bento-text   { order: 1; }
    }
  }

  .solution-bento-visual        { min-height: 200px; padding: 32px; }
  .solution-bento-visual__number { font-size: 100px; }
  .solution-bento-visual__icon  { width: 64px; height: 64px; border-radius: 16px; svg { width: 32px; height: 32px; } }
  .solution-bento-text          { padding: 28px 24px; }
  .solution-bento-text__title   { font-size: 22px; }
}

```

# app\features\landing\landing.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Landing } from './landing';

describe('Landing', () => {
  let component: Landing;
  let fixture: ComponentFixture<Landing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Landing],
    }).compileComponents();

    fixture = TestBed.createComponent(Landing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\features\landing\landing.ts

```ts
import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Footer } from '../../shared/components/footer/footer';
import { Navbar } from '../../shared/components/navbar/navbar';
import { Pricing } from '../../shared/components/pricing/pricing';


export interface ProblemItem {
  id: string;
  icon: string;
  title: string;
  body: string;
  quote: string;
  accent: 'neutral' | 'red' | 'amber';
}

export interface SolutionStep {
  id: string;
  number: string;
  title: string;
  description: string;
  icon: string;
  details: string[];
}

export interface FeatureTab {
  id: string;
  icon: string;
  label: string;
  title: string;
  description: string;
  details: string[];
  accentColor: string;
  mockType: 'feedback-list' | 'kanban' | 'widget' | 'trends';
}

export interface CompareRow {
  topic: string;
  before: string;
  after: string;
}

export interface VideoFeature {
  id: string;
  title: string;
  description: string;
  videoSrc?: string;
  posterSrc?: string;
  accent: string;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}


@Component({
  selector: 'app-landing',
  imports: [CommonModule, RouterLink, Navbar, Footer, Pricing],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {

  // --- Hero tabs ---
  activeTab = signal<string>('Project');

  tabs = ['Project', 'Task', 'Message', 'Invoice', 'Clients', 'Timer'];

  setActiveTab(tab: string): void {
    this.activeTab.set(tab);
  }

  // ── Problem — Accordéon ───────────────────────────────
  activeProblем = signal<string>('scattered');

  problemItems: ProblemItem[] = [
    {
      id: 'scattered',
      icon: 'chat',
      title: 'Les retours arrivent de partout',
      body: 'Email, Slack, Notion, WhatsApp, post-its… Chaque client utilise un canal différent. Résultat : vous passez votre temps à consolider avant même de commencer à corriger.',
      quote: '"Je retrouve encore des retours dans ma boîte mail d\'il y a 3 semaines que j\'avais complètement oubliés."',
      accent: 'neutral',
    },
    {
      id: 'priority',
      icon: 'alert',
      title: 'Rien n\'est priorisé',
      body: 'Un bug bloquant côtoie une demande cosmétique sans distinction. Sans hiérarchisation, l\'équipe traite ce qui arrive en premier — pas ce qui compte le plus.',
      quote: '"On a passé une journée à corriger la couleur d\'un bouton pendant qu\'un formulaire planté bloquait les ventes."',
      accent: 'red',
    },
    {
      id: 'time',
      icon: 'clock',
      title: 'Le tri manuel prend des heures',
      body: 'Lire, catégoriser, résumer, répondre, reporter dans un fichier… La phase de recettage dure 2x plus longtemps que nécessaire à cause de cette friction invisible.',
      quote: '"Je passe facilement 3h à préparer la réunion de suivi client. C\'est du temps pas facturé."',
      accent: 'amber',
    },
    {
      id: 'context',
      icon: 'users',
      title: 'Le contexte se perd',
      body: 'Un développeur reçoit un ticket sans savoir si c\'est urgent, à quel projet ça appartient, ni ce que le client voulait vraiment dire. Il doit relancer. Le client s\'impatiente.',
      quote: '"On a corrigé le mauvais bug parce que le retour client était flou et on a interprété trop vite."',
      accent: 'neutral',
    },
    {
      id: 'visibility',
      icon: 'chart',
      title: 'Aucune visibilité sur l\'avancement',
      body: 'Le client ne sait pas où en est son retour. L\'équipe non plus, clairement. Il faut un échange pour avoir un statut — ce qui génère encore plus de retours.',
      quote: '"Mon client m\'appelle chaque semaine pour savoir où en est la correction qu\'il a demandée il y a 10 jours."',
      accent: 'neutral',
    },
    {
      id: 'tools',
      icon: 'grid',
      title: 'Trop d\'outils, pas de solution',
      body: 'Trello, Notion, Jira, email, Google Sheets… Chaque équipe bricole son propre système. Aucun n\'est pensé pour la relation client et la gestion des feedbacks en recettage.',
      quote: '"On utilise 5 outils différents pour gérer un seul projet. C\'est un problème de coordination permanent."',
      accent: 'neutral',
    },
  ];

  activeProblem = computed(() =>
    this.problemItems.find(p => p.id === this.activeProblем()) ?? this.problemItems[0]
  );

  setActiveProblem(id: string): void {
    this.activeProblем.set(id);
  }

  // Solution section 
  solutionSteps: SolutionStep[] = [
    {
      id: 'collect', number: '01', icon: 'widget',
      title: 'Collectez sans friction',
      description: 'Un widget JS à coller une fois sur le site de votre client. Vos retours arrivent directement dans votre tableau de bord, sans compte requis pour le client.',
      details: ['Intégration en moins de 2 minutes', 'Formulaire personnalisable', 'Aucune connexion requise pour le client'],
    },
    {
      id: 'analyze', number: '02', icon: 'ai',
      title: 'L\'IA analyse et priorise',
      description: 'Chaque retour est automatiquement catégorisé (bug, feature, question), résumé en une phrase et scoré selon l\'urgence détectée dans le message.',
      details: ['Catégorisation automatique', 'Résumé IA en une phrase', 'Score de priorité basé sur le sentiment'],
    },
    {
      id: 'resolve', number: '03', icon: 'kanban',
      title: 'Traitez et résolvez',
      description: 'Votre équipe voit immédiatement quoi traiter en premier. Déplacez les cartes du kanban au fil de l\'avancement, filtrez par projet ou par catégorie.',
      details: ['Kanban À traiter → En cours → Résolu', 'Filtres par projet et catégorie', 'Graphique de tendances 30 jours'],
    },
  ];
  // --- Features ---
  // Section E — Feature tabs
  activeFeatureTab = signal<string>('ai');

  featureTabs: FeatureTab[] = [
    {
      id: 'ai',
      icon: 'brain',
      label: 'Analyse IA',
      title: 'L\'IA analyse chaque retour en moins de 3 secondes',
      description: 'Catégorie, résumé, score de priorité — tout est calculé automatiquement dès qu\'un feedback arrive. Votre équipe ne voit que l\'essentiel.',
      details: ['Catégorie : bug, feature ou question', 'Résumé en une phrase claire', 'Score de priorité basé sur le sentiment'],
      accentColor: '#EEF2FF',
      mockType: 'feedback-list',
    },
    {
      id: 'kanban',
      icon: 'kanban',
      label: 'Kanban',
      title: 'Votre workflow client en un coup d\'œil',
      description: 'Trois colonnes, zéro confusion. Déplacez les cartes de "À traiter" à "Résolu" au fil de votre avancement. Filtrez par projet, catégorie ou priorité.',
      details: ['Colonnes : À traiter · En cours · Résolu', 'Filtres par projet et catégorie', 'Déplacement par glisser-déposer'],
      accentColor: '#F0FDF4',
      mockType: 'kanban',
    },
    {
      id: 'widget',
      icon: 'code',
      label: 'Widget',
      title: 'Vos clients soumettent sans créer de compte',
      description: 'Un snippet JS à coller une seule fois sur le site. Vos clients voient un formulaire propre, sans friction. Leurs retours arrivent directement dans votre tableau de bord.',
      details: ['Intégration en moins de 2 minutes', 'Formulaire personnalisable aux couleurs du projet', 'Aucun compte requis pour le client final'],
      accentColor: '#FFF7ED',
      mockType: 'widget',
    },
    {
      id: 'trends',
      icon: 'chart',
      label: 'Tendances',
      title: 'Détectez les pics avant qu\'ils deviennent des crises',
      description: 'Un graphique des 30 derniers jours vous montre l\'évolution du volume de feedbacks par projet. Idéal pour repérer une livraison qui génère trop de retours.',
      details: ['Graphique sur 30 jours glissants', 'Volume par projet et par catégorie', 'Alerte si volume anormal détecté'],
      accentColor: '#FDF4FF',
      mockType: 'trends',
    },
  ];

  setActiveFeatureTab(id: string): void {
    this.activeFeatureTab.set(id);
  }

  activeFeatureTabData = computed(() =>
    this.featureTabs.find(t => t.id === this.activeFeatureTab()) ?? this.featureTabs[0]
  );

  // Section D — Tableau comparatif
  compareRows: CompareRow[] = [
    { topic: 'Collecte des retours', before: 'Email, Slack, WhatsApp, Notion… dispersés', after: 'Un seul formulaire, tout centralisé' },
    { topic: 'Catégorisation', before: 'Manuelle, chronophage, souvent oubliée', after: 'Automatique par l\'IA en < 3 secondes' },
    { topic: 'Priorisation', before: 'Aucune — on traite ce qui arrive en premier', after: 'Score calculé selon le sentiment détecté' },
    { topic: 'Résumé du retour', before: 'À lire en entier, souvent flou', after: 'Une phrase claire générée par l\'IA' },
    { topic: 'Suivi de l\'avancement', before: 'Fichier partagé ou Post-it', after: 'Kanban visuel en temps réel' },
    { topic: 'Détection des anomalies', before: 'Jamais — sauf quand c\'est trop tard', after: 'Graphique 30 jours + alertes de volume' },
  ];

  // -----------------------------------------------
  // Video Features — section 3 colonnes avec média
  // -----------------------------------------------
  videoFeatures: VideoFeature[] = [
    {
      id: 'widget-embed',
      title: 'Intégrez le widget en 2 minutes',
      description: 'Copiez un snippet JS, collez-le sur le site de votre client. Vos retours arrivent instantanément.',
      accent: '#EEF2FF',
      videoSrc: 'https://bytescale.mobbin.com/FW25bBB/video/mobbin.com/prod/assets/file.mp4?enc=1.BQnbdJK6.NGEe6x9i9aOYzTwJ.DK1BKCNO6aQVJATLtV2MuCmrTRrmN6IeXY1MHD5g_TSXfti0oVE0Uxn-SsfdscCUw3P6wmNBksSzSPgNkJYwBlWgIft1ekFhexHCiQB-fTq_rigQuRQCxgKSha-LXmhDrXgTH8mxVkmI4wmRWIP8_R9s57g2zCOvho7ALvbdcv9bYFQBbgCa_J4vk6K40y-j_gJFJPdIiTNje05WZHaEj34Tkrhh1oiVmVhBtR2Yzx5Lgbx9TVd91tUKxT6oevSRYWaiTwnlLbUk77rdjnDqt9ojWbM2v7tIM3-a5G-JNpu-qWT_yjMurZovYbhnkBOSWQ',
    },
    {
      id: 'ai-triage',
      title: 'L\'IA trie à votre place',
      description: 'Catégorie, résumé, score de priorité — chaque feedback est enrichi en moins de 3 secondes.',
      accent: '#F0FDF4',
      videoSrc: 'https://bytescale.mobbin.com/FW25bBB/video/mobbin.com/prod/assets/file.mp4?enc=1.BQnbdJK6.9kH0UglFp7TtiXRV.1UVODMWIhz8S5i1qazUyqCAqQKAfI_-KgUG0dQNbPscKw9lLySH3Gow1rhPyqmXnC80XXuPYEUQfS8BRcdgdDkDX5CKIcCkTO46i1gxtMk7PzKo6w_x7wUICj4axruWL0N0UFYVHlYVU0CdSK9Ks5eAEBqbACpZ2DtM5H8ifavKZSZ-zb6Slnvy7a33lYzWiGb71hzbyJQdIXmFKLznT-BymOXgqRGkTbSvN5slZlFS1ZoXMxKJMgmk6uu1UBODz-sE2OHDKc6oL4rBVhkk7yIz2m7_wyGsGmkMlDMmQfJMJyLrXoNjcQfpggcjAMGDjAKteXZ48GQ',
    },
    {
      id: 'kanban-flow',
      title: 'Du feedback au resolved',
      description: 'Glissez les cartes de "À traiter" à "Résolu". Votre workflow, visualisé en temps réel.',
      accent: '#FFF7ED',
      videoSrc: 'https://bytescale.mobbin.com/FW25bBB/video/mobbin.com/prod/assets/file.mp4?enc=1.BQnbdJK6.fzCCFro2Ta7vlIT3.8j-Yv5SpGXhrOEjiHLg2es1HzA05kSarikmKP2VM7Hu4AlUdpwBVz5E3RzoP5F272sFHC5e_dEit9W7R6EAMre_8XTGFsZBkWBabNoKIqOpdwawNYB1rig9CAyyw7VZdhQLhRRyjd3CxljNVb67mUUCiRQk1NMuDM-bHL4JR46jkG6y8r-pSEjcNW2QleZn7f-nTy1qGYZpO0qF2P97js89b-3js2BdIZLd7jbJ0wRW0yn-gf_dZaxGFm6U2OtXcR3Q6zMXjOCgxxV4mCB1N70uTwLKE1WYfrFhtqzLyfs_LZcU08-ppMR_Lu7Q',
    },
  ];

  // -----------------------------------------------
  // FAQ — état d'ouverture géré avec un signal
  // -----------------------------------------------
  openFaqId = signal<string | null>(null);

  toggleFaq(id: string): void {
    this.openFaqId.update(current => current === id ? null : id);
  }

  faqs: FaqItem[] = [
    {
      id: 'faq-1',
      question: 'Comment fonctionne l\'analyse IA des feedbacks ?',
      answer: 'Dès qu\'un retour est soumis via le widget ou le lien public, notre backend l\'envoie à l\'API OpenAI. En quelques secondes, l\'IA retourne trois informations : la catégorie du retour (bug, feature request ou question), un résumé en une phrase claire, et un score de priorité calculé à partir de l\'analyse du sentiment. Ces données enrichissent automatiquement votre kanban.',
    },
    {
      id: 'faq-2',
      question: 'Mes clients ont-ils besoin de créer un compte pour soumettre un retour ?',
      answer: 'Non, c\'est l\'un de nos partis pris forts. Votre client accède à un lien public ou interagit avec un widget JavaScript intégré directement sur son site. Il remplit un simple formulaire et soumet son retour — sans inscription, sans mot de passe, sans friction.',
    },
    {
      id: 'faq-3',
      question: 'Quelle est la différence entre le plan Free et le plan Pro ?',
      answer: 'Le plan Free autorise 1 projet actif et jusqu\'à 50 feedbacks par mois, ce qui est suffisant pour tester la plateforme avec un premier client. Le plan Pro (9 €/mois) débloque 10 projets, les feedbacks illimités, les filtres avancés, l\'export CSV et le graphique de tendances. Le plan Team ajoute la gestion multi-membres et les intégrations tierces.',
    },
    {
      id: 'faq-4',
      question: 'Puis-je annuler mon abonnement à tout moment ?',
      answer: 'Oui, sans engagement ni frais cachés. Vous pouvez annuler depuis votre espace compte en un clic. Votre accès Pro reste actif jusqu\'à la fin de la période déjà facturée, puis bascule automatiquement sur le plan Free.',
    },
    {
      id: 'faq-5',
      question: 'Le widget est-il compatible avec tous les types de sites ?',
      answer: 'Oui. Le widget est un simple snippet JavaScript universel — il fonctionne sur n\'importe quel site web, qu\'il soit construit avec WordPress, Webflow, un framework React ou Vue, ou même du HTML statique. L\'intégration prend moins de deux minutes.',
    },
    {
      id: 'faq-6',
      question: 'Mes données sont-elles sécurisées ?',
      answer: 'Les données sont hébergées sur une infrastructure cloud certifiée (Railway / Supabase) avec chiffrement en transit (TLS) et au repos. L\'authentification utilise un système JWT avec refresh tokens. Nous ne revendons jamais vos données ni celles de vos clients à des tiers.',
    },
  ];


}

```

# app\shared\components\billing\billing.html

```html
<!-- frontend/src/app/features/dashboard/billing/billing.html -->
<div class="billing">

  <header class="billing__header">
    <div>
      <h1 class="billing__title">Abonnement & facturation</h1>
      <p class="billing__subtitle">
        Plan actuel : <strong>{{ currentPlan() }}</strong>
      </p>
    </div>

    @if (isPro()) {
      <button class="billing__portal-btn"
              [disabled]="portalLoading()"
              (click)="openPortal()">
        @if (portalLoading()) {
          <span class="billing__spinner"></span>Chargement…
        } @else {
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
               stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="3" width="12" height="10" rx="1.5"/>
            <line x1="2" y1="6" x2="14" y2="6"/>
            <line x1="5" y1="9.5" x2="7" y2="9.5"/>
          </svg>
          Gérer ma facturation
        }
      </button>
    }
  </header>

  <!-- Alertes -->
  @if (successMessage()) {
    <div class="billing__alert billing__alert--success">{{ successMessage() }}</div>
  }
  @if (errorMessage()) {
    <div class="billing__alert billing__alert--error">{{ errorMessage() }}</div>
  }

  <!-- Plans -->
  <div class="billing__plans">
    @for (plan of plans; track plan.id) {
      <div class="billing-plan"
           [class.billing-plan--highlight]="plan.highlight"
           [class.billing-plan--active]="isPlanActive(plan.id)">

        @if (plan.highlight) {
          <span class="billing-plan__badge">Recommandé</span>
        }
        @if (isPlanActive(plan.id)) {
          <span class="billing-plan__badge billing-plan__badge--active">Plan actuel</span>
        }

        <div class="billing-plan__header">
          <h2 class="billing-plan__name">{{ plan.name }}</h2>
          <div class="billing-plan__price">
            <span class="billing-plan__amount">{{ plan.price }}</span>
            <span class="billing-plan__period">{{ plan.period }}</span>
          </div>
          <p class="billing-plan__desc">{{ plan.description }}</p>
        </div>

        <ul class="billing-plan__features">
          @for (feature of plan.features; track feature) {
            <li class="billing-plan__feature">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2.5 8 6 11.5 13.5 4"/>
              </svg>
              {{ feature }}
            </li>
          }
        </ul>

        <button class="billing-plan__cta"
                [class.billing-plan__cta--primary]="plan.highlight && !isPlanActive(plan.id)"
                [class.billing-plan__cta--current]="isPlanActive(plan.id)"
                [disabled]="isPlanActive(plan.id) || loading()"
                (click)="selectPlan(plan)">
          @if (loading() && !isPlanActive(plan.id) && plan.priceId) {
            <span class="billing__spinner"></span>
          }
          @if (isPlanActive(plan.id)) { Plan actuel }
          @else { {{ plan.cta }} }
        </button>

      </div>
    }
  </div>

  <!-- FAQ rapide -->
  <div class="billing__faq">
    <h3 class="billing__faq-title">Questions fréquentes</h3>
    <div class="billing__faq-grid">
      <div class="billing__faq-item">
        <strong>Puis-je annuler à tout moment ?</strong>
        <p>Oui, sans engagement. Votre accès Pro reste actif jusqu'à la fin de la période facturée.</p>
      </div>
      <div class="billing__faq-item">
        <strong>Quels moyens de paiement sont acceptés ?</strong>
        <p>Carte bancaire (Visa, Mastercard, Amex) via Stripe. Vos données de paiement ne transitent jamais par nos serveurs.</p>
      </div>
      <div class="billing__faq-item">
        <strong>Que se passe-t-il si je dépasse les limites Free ?</strong>
        <p>Vous ne pouvez plus soumettre de nouveaux feedbacks. Vos données existantes sont conservées.</p>
      </div>
      <div class="billing__faq-item">
        <strong>Comment obtenir une facture ?</strong>
        <p>Toutes vos factures sont accessibles depuis le portail de facturation Stripe en cliquant sur "Gérer ma facturation".</p>
      </div>
    </div>
  </div>

</div>
```

# app\shared\components\billing\billing.scss

```scss
// frontend/src/app/features/dashboard/billing/billing.scss
.billing {
  padding: 2rem;
  max-width: 1100px;
  animation: fadeIn 0.25s ease;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

// ── Header ─────────────────────────────────────────────────
.billing__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.billing__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem;
}

.billing__subtitle {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.billing__portal-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 16px;
  border-radius: var(--radius-inner);
  border: 1px solid var(--color-border);
  background: var(--color-white);
  color: var(--color-dark);
  font-size: 13px;
  font-family: var(--font-medium);
  cursor: pointer;
  transition: background-color 0.15s ease;
  svg { width: 14px; height: 14px; }
  &:hover { background-color: var(--color-surface-lt); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
}

// ── Alertes ────────────────────────────────────────────────
.billing__alert {
  padding: 12px 16px;
  border-radius: var(--radius-inner);
  font-size: 14px;
  margin-bottom: 1.5rem;

  &--success {
    background-color: #F0FDF4;
    color: #166534;
    border: 1px solid #BBF7D0;
  }
  &--error {
    background-color: #FEF2F2;
    color: #991B1B;
    border: 1px solid #FECACA;
  }
}

// ── Plans ──────────────────────────────────────────────────
.billing__plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin-bottom: 2.5rem;
}

.billing-plan {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  border-radius: var(--radius-outer, 12px);
  border: 1px solid var(--color-border);
  background: var(--color-white);
  transition: box-shadow 0.2s ease;

  &:hover { box-shadow: 0 4px 16px rgba(0,0,0,.06); }

  &--highlight {
    border-color: var(--color-dark);
    box-shadow: 0 0 0 2px var(--color-dark);
  }

  &--active {
    border-color: #10B981;
    box-shadow: 0 0 0 2px #10B981;
  }
}

.billing-plan__badge {
  position: absolute;
  top: -11px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 12px;
  border-radius: 20px;
  font-size: 11px;
  font-family: var(--font-medium);
  font-weight: 600;
  background-color: var(--color-dark);
  color: var(--color-white);
  white-space: nowrap;

  &--active {
    background-color: #10B981;
  }
}

.billing-plan__header { margin-bottom: 1.25rem; }

.billing-plan__name {
  font-size: 1.125rem;
  font-weight: 700;
  color: var(--color-dark);
  margin: 0 0 0.5rem;
}

.billing-plan__price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 0.5rem;
}

.billing-plan__amount {
  font-size: 2rem;
  font-weight: 800;
  color: var(--color-dark);
}

.billing-plan__period {
  font-size: 0.875rem;
  color: var(--color-muted);
}

.billing-plan__desc {
  font-size: 0.8125rem;
  color: var(--color-text-secondary);
  margin: 0;
}

.billing-plan__features {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.billing-plan__feature {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: var(--color-text-primary);

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    margin-top: 2px;
    color: #10B981;
  }
}

.billing-plan__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  border-radius: var(--radius-inner);
  font-size: 14px;
  font-family: var(--font-medium);
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-surface-lt);
  color: var(--color-dark);
  transition: opacity 0.15s ease, background-color 0.15s ease;

  &--primary {
    background: var(--color-dark);
    color: var(--color-white);
    border-color: var(--color-dark);
    &:hover { opacity: 0.88; }
  }

  &--current {
    background: #F0FDF4;
    color: #166534;
    border-color: #BBF7D0;
    cursor: default;
  }

  &:disabled { opacity: 0.55; cursor: not-allowed; }
}

// ── Spinner ────────────────────────────────────────────────
.billing__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// ── FAQ ────────────────────────────────────────────────────
.billing__faq { margin-top: 2rem; }

.billing__faq-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-dark);
  margin: 0 0 1rem;
}

.billing__faq-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1rem;
}

.billing__faq-item {
  padding: 1rem;
  border-radius: var(--radius-inner);
  border: 1px solid var(--color-border);
  background: var(--color-surface-lt);

  strong {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-dark);
    margin-bottom: 6px;
  }

  p {
    font-size: 12.5px;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.55;
  }
}

// ── Responsive ─────────────────────────────────────────────
@media (max-width: 767px) {
  .billing { padding: 1rem; }
  .billing__plans { grid-template-columns: 1fr; }
}
```

# app\shared\components\billing\billing.service.ts

```ts
import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CheckoutSessionResponse { url: string; }
export interface BillingPortalResponse   { url: string; }
export interface QuotaResult {
  plan: string;
  feedbacksThisMonth: number;
  feedbacksLimit: number;
  projectCount: number;
  projectsLimit: number;
  usagePercent: number;
}


@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly api  = `${environment.apiUrl}/billing`;

  createCheckoutSession(priceId: string, planId: 'pro' | 'team'): Observable<CheckoutSessionResponse> {
    const successUrl = `${window.location.origin}/payment-success?plan=${planId}`;
    const cancelUrl  = `${window.location.origin}/dashboard/billing?canceled=true`;
    return this.http.post<CheckoutSessionResponse>(`${this.api}/checkout`, {
      priceId, planName: planId, successUrl, cancelUrl
    });
  }

  createBillingPortalSession(): Observable<BillingPortalResponse> {
    const returnUrl = `${window.location.origin}/dashboard/billing`;
    return this.http.post<BillingPortalResponse>(`${this.api}/portal`, { returnUrl });
  }

  getQuota(): Observable<QuotaResult> {
    return this.http.get<QuotaResult>(`${environment.apiUrl}/quota`);
  }

}
```

# app\shared\components\billing\billing.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Billing } from './billing';

describe('Billing', () => {
  let component: Billing;
  let fixture: ComponentFixture<Billing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Billing],
    }).compileComponents();

    fixture = TestBed.createComponent(Billing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\shared\components\billing\billing.ts

```ts
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { BillingService } from './billing.service';
import { UserService } from '../../../core/services/user.service';
import { environment } from '../../../../environments/environment';

type PaidPlanId = 'pro' | 'team';

type PricingPlan = {
  id: 'free' | PaidPlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  priceId: string | null;
  highlight: boolean;
  cta: string;
};

@Component({
  selector: 'app-billing',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './billing.html',
  styleUrl: './billing.scss',
})
export class Billing implements OnInit {
  private readonly billing = inject(BillingService);
  private readonly userService = inject(UserService);
  private readonly route = inject(ActivatedRoute);

  loading = signal(false);
  portalLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  user = this.userService.profile;
  currentPlan = computed(() => this.user()?.plan ?? 'Free');
  isPro = computed(() => ['Pro', 'Team'].includes(this.currentPlan()));
  isTeam = computed(() => this.currentPlan() === 'Team');

  readonly plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: '0€',
      period: '',
      description: 'Pour tester la plateforme avec un premier client.',
      features: [
        '1 projet actif',
        '50 feedbacks / mois',
        'Analyse IA : catégorie + résumé',
        'Tableau kanban',
        'Widget intégrable',
        'Documentation & communauté',
      ],
      priceId: null,
      highlight: false,
      cta: 'Plan actuel',
    },
    {
      id: 'pro' as 'pro' | 'team',
      name: 'Pro',
      price: '9€',
      period: '/ mois',
      description: 'Pour les freelances et agences actives.',
      features: [
        '10 projets actifs',
        "Jusqu'à 2 000 feedbacks / mois",
        'Analyse IA complète : score de priorité, sentiment, topics',
        'Filtres avancés & tri par priorité',
        'Widget personnalisable (couleurs, texte, position)',
        'Graphique de tendances 30 jours',
        'Export CSV',
        'Réponse support sous 24h',
      ],
      priceId: environment.stripePrices.pro,
      highlight: true,
      cta: 'Passer au Pro',
    },
    {
      id: 'team' as 'pro' | 'team',
      name: 'Team',
      price: '29€',
      period: '/ mois',
      description: 'Pour les agences qui travaillent à plusieurs.',
      features: [
        'Projets illimités',
        "Jusqu'à 10 000 feedbacks / mois",
        'Tout le plan Pro',
        "Membres d'équipe illimités",
        'Gestion des rôles & permissions',
        'Tableau de bord partagé',
        'Réponse support sous 4h',
      ],
      priceId: environment.stripePrices.team,
      highlight: false,
      cta: 'Passer au Team',
    },
  ];

  ngOnInit(): void {
    const queryParams = this.route.snapshot.queryParamMap;
    if (queryParams.get('success') === 'true') {
      this.successMessage.set('🎉 Votre abonnement est actif ! Bienvenue sur le plan Pro.');
    } else if (queryParams.get('canceled') === 'true') {
      this.errorMessage.set('Le paiement a été annulé. Vous pouvez réessayer à tout moment.');
    }
  }

  upgrade(priceId: string | null, planId: 'pro' | 'team'): void {
    if (!priceId || this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');

    this.billing.createCheckoutSession(priceId, planId).subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => {
        this.loading.set(false);
        this.errorMessage.set('Erreur lors de la création de la session de paiement.');
      }
    });
  }

  openPortal(): void {
    if (this.portalLoading()) return;
    this.portalLoading.set(true);
    this.errorMessage.set('');

    this.billing.createBillingPortalSession().subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => {
        this.portalLoading.set(false);
        this.errorMessage.set('Erreur lors de l\'ouverture du portail de facturation.');
      }
    });
  }

  isPlanActive(planId: string): boolean {
    return this.currentPlan().toLowerCase() === planId;
  }

  selectPlan(plan: PricingPlan): void {
    if (plan.id === 'free' || !plan.priceId) return;

    this.upgrade(plan.priceId, plan.id);
  }
}
```

# app\shared\components\footer\footer.html

```html
<footer class="footer">
  <div class="container">

    <!-- Contenu principal -->
    <div class="footer__body">

      <!-- Colonne gauche : logo + description + socials -->
      <div class="footer__brand">
        <a routerLink="/" class="footer__logo" aria-label="AI Review Hub — accueil">
          <svg class="footer__logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"
               fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M32 6c-9 0-16 7-16 16 0 5 2 9 5 12v6h22v-6c3-3 5-7 5-12 0-9-7-16-16-16z"/>
            <path d="M24 40h16M26 46h12"/>
            <circle cx="20" cy="28" r="2"/>
            <circle cx="44" cy="28" r="2"/>
            <circle cx="32" cy="22" r="2"/>
            <line x1="22" y1="28" x2="30" y2="22"/>
            <line x1="42" y1="28" x2="34" y2="22"/>
          </svg>
          <span class="footer__logo-text">AI Review Hub</span>
        </a>

        <p class="footer__tagline">
          Centralisez, analysez et priorisez les retours de vos clients grâce à l'IA.
        </p>

        <!-- Icônes sociales -->
        <div class="footer__socials">
          @for (social of socials; track social.id) {
            <a
              [href]="social.href"
              class="footer__social-link"
              target="_blank"
              rel="noopener noreferrer"
              [attr.aria-label]="social.label">
              <ng-container [ngSwitch]="social.icon">

                <ng-container *ngSwitchCase="'linkedin'">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
                    <rect x="2" y="9" width="4" height="12"/>
                    <circle cx="4" cy="4" r="2"/>
                  </svg>
                </ng-container>

                <ng-container *ngSwitchCase="'twitter'">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                </ng-container>

                <ng-container *ngSwitchCase="'github'">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                </ng-container>

                <ng-container *ngSwitchCase="'youtube'">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.95-1.96C18.88 4 12 4 12 4s-6.88 0-8.59.46A2.78 2.78 0 0 0 1.46 6.42 29 29 0 0 0 1 12a29 29 0 0 0 .46 5.58 2.78 2.78 0 0 0 1.95 1.96C5.12 20 12 20 12 20s6.88 0 8.59-.46a2.78 2.78 0 0 0 1.95-1.96A29 29 0 0 0 23 12a29 29 0 0 0-.46-5.58z"/>
                    <polygon fill="white" points="9.75 15.02 15.5 12 9.75 8.98 9.75 15.02"/>
                  </svg>
                </ng-container>

              </ng-container>
            </a>

            <!-- Séparateur entre icônes (sauf après la dernière) -->
            @if (!$last) {
              <span class="footer__social-sep" aria-hidden="true"></span>
            }
          }
        </div>
      </div>

      <!-- Colonnes de liens -->
      <nav class="footer__nav" aria-label="Liens du pied de page">
        @for (col of columns; track col.title) {
          <div class="footer__col">
            <h3 class="footer__col-title">{{ col.title }}</h3>
            <ul class="footer__col-links">
              @for (link of col.links; track link.label) {
                <li>
                  @if (link.path) {
                    <a [routerLink]="link.path" class="footer__link">{{ link.label }}</a>
                  } @else {
                    <a [href]="link.href" class="footer__link" target="_blank" rel="noopener noreferrer">{{ link.label }}</a>
                  }
                </li>
              }
            </ul>
          </div>
        }
      </nav>

    </div>

    <!-- Barre de copyright -->
    <div class="footer__bottom">
      <p class="footer__copyright">
        © {{ currentYear }} AI Review Hub. Tous droits réservés.
      </p>
      <div class="footer__bottom-links">
        <a routerLink="/terms"   class="footer__link">Conditions d'utilisation</a>
        <span aria-hidden="true">·</span>
        <a routerLink="/privacy" class="footer__link">Politique de confidentialité</a>
      </div>
    </div>

  </div>
</footer>
```

# app\shared\components\footer\footer.scss

```scss
/* =============================================
   FOOTER — styles scopés au composant
   ============================================= */

.footer {
  padding: 64px 0 0;
}

// -----------------------------------------------
// Corps principal : brand | colonnes de liens
// -----------------------------------------------

.footer__body {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 64px;
  padding-bottom: 56px;
}

// Colonne gauche

.footer__brand {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.footer__logo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-dark);
  text-decoration: none;
}

.footer__logo-icon {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.footer__logo-text {
  font-family: var(--font-medium);
  font-size: 15px;
  font-weight: 500;
}

.footer__tagline {
  font-size: 14px;
  line-height: 1.6;
  color: var(--color-muted);
  max-width: 240px;
}

// Icônes sociales

.footer__socials {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}

.footer__social-link {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  color: var(--color-dark);
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    background-color: var(--color-surface);
    color: var(--color-dark);
  }
}

.footer__social-sep {
  width: 1px;
  height: 20px;
  background-color: var(--color-border);
  margin: 0 2px;
  flex-shrink: 0;
}

// Colonnes de navigation

.footer__nav {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 32px;
}

.footer__col {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer__col-title {
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-dark);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.footer__col-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
}

.footer__link {
  font-size: 14px;
  line-height: 1.4;
  color: var(--color-muted);
  text-decoration: none;
  transition: color 0.15s ease;

  &:hover {
    color: var(--color-dark);
  }
}

// -----------------------------------------------
// Barre de copyright
// -----------------------------------------------

.footer__bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 0;
  border-top: 1px solid var(--color-border);
}

.footer__copyright {
  font-size: 13px;
  color: var(--color-muted);
}

.footer__bottom-links {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--color-muted);

  .footer__link {
    font-size: 13px;
  }
}

// =============================================
// RESPONSIVE
// =============================================

@media (max-width: 1199px) {
  .footer__body {
    grid-template-columns: 220px 1fr;
    gap: 40px;
  }

  .footer__nav {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 767px) {
  .footer {
    padding-top: 48px;
  }

  .footer__body {
    grid-template-columns: 1fr;
    gap: 40px;
    padding-bottom: 40px;
  }

  .footer__tagline {
    max-width: 100%;
  }

  .footer__nav {
    grid-template-columns: repeat(2, 1fr);
    gap: 28px 16px;
  }

  .footer__bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .footer__bottom-links {
    flex-wrap: wrap;
  }
}
```

# app\shared\components\footer\footer.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\shared\components\footer\footer.ts

```ts
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FooterLink {
  label: string;
  path?: string;   // routerLink interne
  href?: string;   // lien externe
}

interface FooterColumn {
  title: string;
  links: FooterLink[];
}

@Component({
  selector: 'app-footer',
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer {

  currentYear = new Date().getFullYear();

  socials = [
    { id: 'linkedin', label: 'LinkedIn', href: 'https://linkedin.com', icon: 'linkedin' },
    { id: 'twitter', label: 'Twitter/X', href: 'https://x.com', icon: 'twitter' },
    { id: 'github', label: 'GitHub', href: 'https://github.com', icon: 'github' },
    { id: 'youtube', label: 'YouTube', href: 'https://youtube.com', icon: 'youtube' },
  ];

  columns: FooterColumn[] = [
    {
      title: 'Produit',
      links: [
        { label: 'Feedbacks', path: '/feedbacks' },
        { label: 'Projets', path: '/projects' },
        { label: 'Tableau de bord', path: '/dashboard' },
        { label: 'Widget client', path: '/widget' },
        { label: 'Intégrations', path: '/integrations' },
      ],
    },
    {
      title: 'Solutions',
      links: [
        { label: 'Agences web', path: '/solutions/agencies' },
        { label: 'Freelances', path: '/solutions/freelancers' },
        { label: 'Équipes IT', path: '/solutions/it-teams' },
        { label: 'PME', path: '/solutions/smb' },
      ],
    },
    {
      title: 'Ressources',
      links: [
        { label: 'Blog', path: '/blog' },
        { label: 'Documentation', path: '/docs' },
        { label: 'API', href: 'https://api.ai-review-hub.app' },
        { label: 'Roadmap', path: '/roadmap' },
        { label: 'Centre d\'aide', path: '/help' },
      ],
    },
    {
      title: 'Entreprise',
      links: [
        { label: 'Tarifs', path: '/pricing' },
        { label: 'Nous contacter', path: '/contact' },
        { label: 'Conditions d\'utilisation', path: '/terms' },
        { label: 'Politique de confidentialité', path: '/privacy' },
      ],
    },
  ];

}

```

# app\shared\components\navbar\navbar.html

```html
<header class="site-header" [class.site-header--scrolled]="scrolled()">
  <div class="navbar">

    <!-- Logo -->
    <a routerLink="/" class="navbar__logo" aria-label="AI Review Hub — accueil" (click)="closeMenu()">
      <img class="navbar__logo-icon" src="assets/feedxai.svg" viewBox="400 500 1200 900" alt="Logo AI Review Hub"/>
    </a>

    <!-- Navigation principale (desktop) -->
    <nav class="navbar__nav" aria-label="Navigation principale">
      @for (item of navItems; track item.label) {

        @if (item.megaMenu) {
          <!-- Lien avec mega-menu -->
          <div class="navbar__item" (mouseenter)="openMenu(item.label)" (mouseleave)="closeMenu()">
            <button
              class="navbar__link"
              [class.navbar__link--active]="activeMenu() === item.label"
              type="button"
              [attr.aria-expanded]="activeMenu() === item.label"
              aria-haspopup="true"
              (click)="toggleMenu(item.label)">
              {{ item.label }}
              <svg class="navbar__chevron" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="2 4 6 8 10 4"/>
              </svg>
            </button>

            <!-- Mega-menu dropdown -->
            @if (activeMenu() === item.label) {
              <div class="mega-menu" role="dialog" [attr.aria-label]="item.label">
                @for (col of item.megaMenu; track col.title) {
                  <div class="mega-menu__col">
                    <p class="mega-menu__col-title">{{ col.title }}</p>
                    @for (link of col.links; track link.path) {
                      <a [routerLink]="link.path" class="mega-menu__link" (click)="closeMenu()">
                        <span class="mega-menu__link-icon" aria-hidden="true">
                          <ng-container [ngSwitch]="link.icon">
                            <ng-container *ngSwitchCase="'brain'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 10h6M10 7v6"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'kanban'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="4" height="9" rx="1"/><rect x="8" y="2" width="4" height="5" rx="1"/><rect x="14" y="2" width="4" height="12" rx="1"/><rect x="8" y="9" width="4" height="5" rx="1"/><rect x="2" y="13" width="4" height="5" rx="1"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'code'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 15 18 10 13 5"/><polyline points="7 5 2 10 7 15"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'chart'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 10 15 10 12.5 17.5 7.5 2.5 5 10 2 10"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'folder'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15.5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2z"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'users'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 17v-1.5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3V17"/><circle cx="8" cy="6" r="3.5"/><path d="M19 17v-1.5a3 3 0 0 0-2.5-2.97"/><path d="M13 2.13a3.5 3.5 0 0 1 0 6.74"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'plug'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2v4M13 2v4M5 6h10l-1 7H6L5 6zM8 13v5M12 13v5"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'building'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="16" height="16" rx="1"/><path d="M2 8h16M7 8v11M13 8v11"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'user'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="7" r="4"/><path d="M3 18c0-4 3-6 7-6s7 2 7 6"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'check'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 10 8 15 17 5"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'headset'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10a7 7 0 0 1 14 0"/><rect x="2" y="10" width="3" height="5" rx="1"/><rect x="15" y="10" width="3" height="5" rx="1"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'edit'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 3.5l2 2-9 9-3 1 1-3 9-9z"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'book'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z"/><path d="M7 3v15M10 7h4M10 10h4M10 13h4"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'map'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 5 7 2 13 5 19 2 19 16 13 19 7 16 1 19 1 5"/><line x1="7" y1="2" x2="7" y2="16"/><line x1="13" y1="5" x2="13" y2="19"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'lifering'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/><circle cx="10" cy="10" r="3.5"/><line x1="3" y1="3" x2="7" y2="7"/><line x1="13" y1="13" x2="17" y2="17"/><line x1="17" y1="3" x2="13" y2="7"/><line x1="7" y1="13" x2="3" y2="17"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchCase="'mail'">
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="16" height="12" rx="2"/><polyline points="2,4 10,11 18,4"/></svg>
                            </ng-container>
                            <ng-container *ngSwitchDefault>
                              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="8"/></svg>
                            </ng-container>
                          </ng-container>
                        </span>
                        <span class="mega-menu__link-body">
                          <span class="mega-menu__link-label">{{ link.label }}</span>
                          <span class="mega-menu__link-desc">{{ link.description }}</span>
                        </span>
                      </a>
                    }
                  </div>
                }
              </div>
            }
          </div>

        } @else {
          <!-- Lien simple -->
          <a
            [routerLink]="item.path"
            class="navbar__link"
            routerLinkActive="navbar__link--active">
            {{ item.label }}
          </a>
        }
      }
    </nav>

    <!-- Actions auth (desktop) -->
    <div class="navbar__actions">
      <a routerLink="/login"    class="navbar__link">Connexion</a>
      <a routerLink="/register" class="btn btn--nav-primary">Commencer gratuitement</a>
    </div>

    <!-- Burger (mobile) -->
    <button
      class="navbar__burger"
      type="button"
      [attr.aria-label]="drawerOpen() ? 'Fermer le menu' : 'Ouvrir le menu'"
      [attr.aria-expanded]="drawerOpen()"
      (click)="drawerOpen() ? closeDrawer() : openDrawer()">
      <span [class.navbar__burger-bar--top-open]="drawerOpen()"></span>
      <span [class.navbar__burger-bar--mid-open]="drawerOpen()"></span>
      <span [class.navbar__burger-bar--bot-open]="drawerOpen()"></span>
    </button>

  </div>
</header>


<!-- =============================================
     DRAWER MOBILE
     ============================================= -->
@if (drawerOpen()) {
  <!-- Backdrop -->
  <div class="drawer-backdrop" (click)="closeDrawer()" aria-hidden="true"></div>

  <!-- Drawer -->
  <nav class="drawer" aria-label="Menu mobile">

    <!-- Header drawer -->
    <div class="drawer__header">
      <a routerLink="/" class="drawer__logo" (click)="closeDrawer()">
        <svg class="navbar__logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"
             fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M32 6c-9 0-16 7-16 16 0 5 2 9 5 12v6h22v-6c3-3 5-7 5-12 0-9-7-16-16-16z"/>
          <path d="M24 40h16M26 46h12"/>
          <circle cx="20" cy="28" r="2"/>
          <circle cx="44" cy="28" r="2"/>
          <circle cx="32" cy="22" r="2"/>
          <line x1="22" y1="28" x2="30" y2="22"/>
          <line x1="42" y1="28" x2="34" y2="22"/>
        </svg>
        <span class="navbar__logo-text">AI Review Hub</span>
      </a>
      <button class="drawer__close" type="button" aria-label="Fermer le menu" (click)="closeDrawer()">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <line x1="4" y1="4" x2="16" y2="16"/>
          <line x1="16" y1="4" x2="4" y2="16"/>
        </svg>
      </button>
    </div>

    <!-- Liens du drawer -->
    <div class="drawer__body">
      @for (item of navItems; track item.label) {

        @if (item.megaMenu) {
          <!-- Section accordéon -->
          <div class="drawer__section">
            <button
              class="drawer__section-btn"
              type="button"
              [attr.aria-expanded]="drawerSection() === item.label"
              (click)="toggleDrawerSection(item.label)">
              {{ item.label }}
              <svg class="drawer__section-chevron"
                   [class.drawer__section-chevron--open]="drawerSection() === item.label"
                   viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="2 4 6 8 10 4"/>
              </svg>
            </button>

            @if (drawerSection() === item.label) {
              <div class="drawer__section-body">
                @for (col of item.megaMenu; track col.title) {
                  <p class="drawer__col-title">{{ col.title }}</p>
                  @for (link of col.links; track link.path) {
                    <a [routerLink]="link.path" class="drawer__link" (click)="closeDrawer()">
                      {{ link.label }}
                    </a>
                  }
                }
              </div>
            }
          </div>

        } @else {
          <a
            [routerLink]="item.path"
            class="drawer__link drawer__link--top"
            (click)="closeDrawer()">
            {{ item.label }}
          </a>
        }
      }
    </div>

    <!-- Footer drawer -->
    <div class="drawer__footer">
      <a routerLink="/login"    class="drawer__auth-link" (click)="closeDrawer()">Connexion</a>
      <a routerLink="/register" class="btn btn--primary drawer__cta" (click)="closeDrawer()">Commencer gratuitement</a>
    </div>

  </nav>
}
```

# app\shared\components\navbar\navbar.scss

```scss
/* =============================================
   NAVBAR — plein largeur, scroll-aware, mega-menus
   ============================================= */

// ── Header ────────────────────────────────────────────────

.site-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  transition: background-color 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;

  // État initial : transparent
  background-color: transparent;
  border-bottom: 1px solid transparent;

  // État scrollé : blanc + ombre
  &--scrolled {
    background-color: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border-bottom-color: var(--color-border);
    box-shadow: 0 1px 12px rgba(0, 0, 0, 0.06);
  }
}


// ── Barre de navigation ────────────────────────────────────

.navbar {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 40px;
  gap: 0;
  max-width: 1440px;
  margin-inline: auto;
}


// ── Logo ──────────────────────────────────────────────────

.navbar__logo {
  color: var(--color-dark);
  text-decoration: none;
  flex-shrink: 0;
  margin-right: 32px;
}

.navbar__logo-icon {
  width: 150px;
}

// ── Nav links ─────────────────────────────────────────────

.navbar__nav {
  display: flex;
  align-items: center;
  flex: 1;
}

.navbar__item {
  position: relative;
}

.navbar__link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 64px;
  padding: 0 14px;
  font-family: var(--font-medium);
  font-size: 14px;
  color: var(--color-dark);
  text-decoration: none;
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  transition: color 0.15s ease;

  // Trait de soulignement actif
  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 14px;
    right: 14px;
    height: 2px;
    background-color: var(--color-dark);
    border-radius: 1px 1px 0 0;
    opacity: 0;
    transform: scaleX(0.4);
    transform-origin: left;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  &:hover::after,
  &--active::after {
    opacity: 1;
    transform: scaleX(1);
  }

  &:hover { color: var(--color-dark); }
}

.navbar__chevron {
  width: 10px;
  height: 10px;
  transition: transform 0.2s ease;
  color: var(--color-muted);

  .navbar__link--active & {
    transform: rotate(180deg);
  }
}


// ── Actions auth ──────────────────────────────────────────

.navbar__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  flex-shrink: 0;

  .navbar__link {
    height: auto;
    padding: 6px 14px;

    &::after { display: none; }
  }
}


// ── Burger ────────────────────────────────────────────────

.navbar__burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 40px;
  height: 40px;
  padding: 10px;
  margin-left: auto;
  background: none;
  border: none;
  cursor: pointer;

  span {
    display: block;
    width: 100%;
    height: 1.5px;
    background-color: var(--color-dark);
    border-radius: 2px;
    transition: transform 0.25s ease, opacity 0.25s ease;
    transform-origin: center;
  }

  // Croix quand ouvert
  .navbar__burger-bar--top-open { transform: translateY(6.5px) rotate(45deg); }
  .navbar__burger-bar--mid-open { opacity: 0; transform: scaleX(0); }
  .navbar__burger-bar--bot-open { transform: translateY(-6.5px) rotate(-45deg); }
}


// =============================================
// MEGA-MENU
// =============================================

.mega-menu {
  position: absolute;
  top: calc(100% + 1px); // colle sous la bordure bottom du header
  left: 0;
  display: flex;
  gap: 0;
  background-color: var(--color-white);
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 var(--radius-card) var(--radius-card);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  min-width: 520px;
  animation: megaMenuIn 0.15s ease;
  z-index: 10;
}

@keyframes megaMenuIn {
  from { opacity: 0; transform: translateY(-6px); }
  to   { opacity: 1; transform: translateY(0); }
}

.mega-menu__col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 20px 20px 20px;
  flex: 1;

  & + & {
    border-left: 1px solid var(--color-border);
  }
}

.mega-menu__col-title {
  font-family: var(--font-medium);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  padding: 0 8px;
  margin-bottom: 6px;
}

.mega-menu__link {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-inner);
  text-decoration: none;
  transition: background-color 0.12s ease;

  &:hover {
    background-color: var(--color-surface-lt);
  }
}

.mega-menu__link-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  flex-shrink: 0;
  margin-top: 1px;

  svg {
    width: 16px;
    height: 16px;
    color: var(--color-dark);
  }
}

.mega-menu__link-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mega-menu__link-label {
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-dark);
  line-height: 1.3;
}

.mega-menu__link-desc {
  font-size: 12px;
  color: var(--color-muted);
  line-height: 1.4;
}


// =============================================
// DRAWER MOBILE
// =============================================

.drawer-backdrop {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.3);
  z-index: 300;
  backdrop-filter: blur(2px);
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(360px, 90vw);
  background-color: var(--color-white);
  border-left: 1px solid var(--color-border);
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.1);
  z-index: 400;
  display: flex;
  flex-direction: column;
  animation: slideIn 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  overflow-y: auto;
}

@keyframes slideIn {
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
}

// En-tête du drawer

.drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.drawer__logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-dark);
  text-decoration: none;

  .navbar__logo-icon { width: 24px; height: 24px; }
  .navbar__logo-text { font-size: 14px; }
}

.drawer__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-muted);
  transition: background-color 0.15s ease, color 0.15s ease;

  svg { width: 16px; height: 16px; }

  &:hover {
    background-color: var(--color-surface-lt);
    color: var(--color-dark);
  }
}

// Corps du drawer

.drawer__body {
  flex: 1;
  padding: 8px 12px;
  overflow-y: auto;
}

.drawer__link {
  display: block;
  padding: 10px 12px;
  border-radius: var(--radius-inner);
  font-family: var(--font-medium);
  font-size: 15px;
  color: var(--color-dark);
  text-decoration: none;
  transition: background-color 0.12s ease;

  &:hover { background-color: var(--color-surface-lt); }

  &--top { margin-bottom: 2px; }
}

// Section accordéon

.drawer__section { margin-bottom: 2px; }

.drawer__section-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-inner);
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-medium);
  font-size: 15px;
  color: var(--color-dark);
  text-align: left;
  transition: background-color 0.12s ease;

  &:hover { background-color: var(--color-surface-lt); }
}

.drawer__section-chevron {
  width: 14px;
  height: 14px;
  color: var(--color-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;

  &--open { transform: rotate(180deg); }
}

.drawer__section-body {
  padding: 4px 4px 8px 12px;
  animation: accordionIn 0.15s ease;
}

@keyframes accordionIn {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}

.drawer__col-title {
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  padding: 8px 12px 4px;
}

.drawer__link {
  // Les liens dans la section sont légèrement indentés
  .drawer__section-body & {
    font-size: 14px;
    padding: 8px 12px;
    color: var(--color-dark);
  }
}

// Footer du drawer

.drawer__footer {
  padding: 16px 20px;
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex-shrink: 0;
}

.drawer__auth-link {
  display: block;
  text-align: center;
  padding: 10px;
  border-radius: var(--radius-inner);
  font-family: var(--font-medium);
  font-size: 14px;
  color: var(--color-dark);
  text-decoration: none;
  border: 1px solid var(--color-border);
  transition: background-color 0.15s ease;

  &:hover { background-color: var(--color-surface-lt); }
}

.drawer__cta {
  display: block;
  text-align: center;
  width: 100%;
}


// =============================================
// RESPONSIVE
// =============================================

@media (max-width: 1023px) {
  .navbar { padding: 0 24px; }
  .navbar__nav,
  .navbar__actions { display: none; }
  .navbar__burger { display: flex; }
}

@media (max-width: 767px) {
  .navbar { padding: 0 16px; }
}
```

# app\shared\components\navbar\navbar.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Navbar } from './navbar';

describe('Navbar', () => {
  let component: Navbar;
  let fixture: ComponentFixture<Navbar>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Navbar],
    }).compileComponents();

    fixture = TestBed.createComponent(Navbar);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\shared\components\navbar\navbar.ts

```ts
import { Component, ElementRef, HostListener, inject, OnDestroy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface MegaMenuColumn {
  title: string;
  links: { label: string; description: string; path: string; icon: string }[];
}
 
export interface NavItem {
  label: string;
  path?: string;
  megaMenu?: MegaMenuColumn[];
}

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnDestroy {
  private el = inject(ElementRef);

  // ── État scroll ────────────────────────────────────────
  scrolled = signal(false);
  scrollY = signal(0);

  @HostListener('window:scroll')
  onScroll(): void {
    this.scrollY.set(window.scrollY);
    this.scrolled.set(window.scrollY > 24);
    // Ferme les mega-menus au scroll
    if (window.scrollY > 24) this.activeMenu.set(null);
  }

  // ── Mega-menus ─────────────────────────────────────────
  activeMenu = signal<string | null>(null);

  openMenu(label: string): void { this.activeMenu.set(label); }
  closeMenu(): void { this.activeMenu.set(null); }
  toggleMenu(label: string): void {
    this.activeMenu.update(v => v === label ? null : label);
  }

  // Ferme si clic en dehors
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.el.nativeElement.contains(e.target)) {
      this.activeMenu.set(null);
    }
  }

  // ── Drawer mobile ──────────────────────────────────────
  drawerOpen = signal(false);
  drawerSection = signal<string | null>(null);

  openDrawer(): void {
    this.drawerOpen.set(true);
    document.body.style.overflow = 'hidden';
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    this.drawerSection.set(null);
    document.body.style.overflow = '';
  }

  toggleDrawerSection(label: string): void {
    this.drawerSection.update(v => v === label ? null : label);
  }

  ngOnDestroy(): void {
    document.body.style.overflow = '';
  }

  // ── Données de navigation ──────────────────────────────
  navItems: NavItem[] = [
    {
      label: 'Produit',
      megaMenu: [
        {
          title: 'Fonctionnalités',
          links: [
            { label: 'Analyse IA', description: 'Catégorisation et priorisation automatique', path: '/features/ai', icon: 'brain' },
            { label: 'Kanban', description: 'Visualisez et gérez vos retours clients', path: '/features/kanban', icon: 'kanban' },
            { label: 'Widget client', description: 'Formulaire intégrable en 2 minutes', path: '/features/widget', icon: 'code' },
            { label: 'Tendances', description: 'Graphiques et insights sur 30 jours', path: '/features/trends', icon: 'chart' },
          ],
        },
        {
          title: 'Gestion',
          links: [
            { label: 'Multi-projets', description: 'Centralisez tous vos clients en un endroit', path: '/features/projects', icon: 'folder' },
            { label: 'Équipe', description: 'Invitez et collaborez avec vos collègues', path: '/features/team', icon: 'users' },
            { label: 'Intégrations', description: 'Slack, Notion, Zapier et plus encore', path: '/integrations', icon: 'plug' },
          ],
        },
      ],
    },
    {
      label: 'Solutions',
      megaMenu: [
        {
          title: 'Par profil',
          links: [
            { label: 'Agences web', description: 'Gérez les retours de plusieurs clients', path: '/solutions/agencies', icon: 'building' },
            { label: 'Freelances', description: 'Un outil léger adapté aux indépendants', path: '/solutions/freelancers', icon: 'user' },
            { label: 'Équipes IT', description: 'Triez les bugs des demandes de features', path: '/solutions/it-teams', icon: 'code' },
          ],
        },
        {
          title: 'Par besoin',
          links: [
            { label: 'Recettage client', description: 'Structurez la phase de validation', path: '/solutions/uat', icon: 'check' },
            { label: 'Support produit', description: 'Centralisez les tickets utilisateurs', path: '/solutions/support', icon: 'headset' },
          ],
        },
      ],
    },
    {
      label: 'Ressources',
      megaMenu: [
        {
          title: 'Apprendre',
          links: [
            { label: 'Blog', description: 'Conseils et bonnes pratiques', path: '/blog', icon: 'edit' },
            { label: 'Documentation', description: 'Guides techniques et API', path: '/docs', icon: 'book' },
            { label: 'Roadmap', description: 'Nos prochaines fonctionnalités', path: '/roadmap', icon: 'map' },
          ],
        },
        {
          title: 'Aide',
          links: [
            { label: 'Centre d\'aide', description: 'FAQ et support', path: '/help', icon: 'lifering' },
            { label: 'Nous contacter', description: 'Parlez à un humain', path: '/contact', icon: 'mail' },
          ],
        },
      ],
    },
    {
      label: 'Tarifs',
      path: '/pricing',
    },
  ];
}

```

# app\shared\components\payment-success\payment-success.html

```html
@if (refreshing()) {
<div class="ps__loading" aria-label="Mise à jour de votre compte…">
    <div class="ps__loading-spinner"></div>
</div>
} @else {
<div class="ps" [class.ps--step-1]="animationStep() >= 1" ...>
    <div class="ps" [class.ps--step-1]="animationStep() >= 1" [class.ps--step-2]="animationStep() >= 2"
        [class.ps--step-3]="animationStep() >= 3">

        <!-- Fond animé -->
        <div class="ps__bg" aria-hidden="true">
            <div class="ps__bg-ring ps__bg-ring--1"></div>
            <div class="ps__bg-ring ps__bg-ring--2"></div>
            <div class="ps__bg-ring ps__bg-ring--3"></div>
            <div class="ps__bg-dots"></div>
        </div>

        <div class="ps__wrapper">

            <!-- Icône de succès -->
            <div class="ps__icon-wrap">
                <div class="ps__icon">
                    <svg class="ps__icon-check" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle class="ps__icon-circle" cx="26" cy="26" r="24" stroke="currentColor"
                            stroke-width="2.5" />
                        <polyline class="ps__icon-tick" points="14,27 22,35 38,18" stroke="currentColor"
                            stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                </div>
            </div>

            <!-- Titre & sous-titre -->
            <div class="ps__header">
                <div class="ps__plan-badge">
                    <span>{{ currentPlan().emoji }}</span>
                    <span>Plan {{ currentPlan().name }}</span>
                </div>
                <h1 class="ps__title">Paiement confirmé</h1>
                <p class="ps__subtitle">
                    Bienvenue dans le plan <strong>{{ currentPlan().name }}</strong>.
                    Votre compte a été mis à niveau instantanément.
                </p>
            </div>

            <!-- Carte des fonctionnalités débloquées -->
            <div class="ps__card">
                <p class="ps__card-label">Ce qui vient d'être débloqué</p>
                <ul class="ps__features">
                    @for (feature of currentPlan().features; track feature; let i = $index) {
                    <li class="ps__feature" [style.--i]="i">
                        <span class="ps__feature-dot" aria-hidden="true"></span>
                        {{ feature }}
                    </li>
                    }
                </ul>
            </div>

            <!-- Actions -->
            <div class="ps__actions">
                <a routerLink="/dashboard" class="ps__btn ps__btn--primary">
                    Accéder au tableau de bord
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
                        stroke-linejoin="round" aria-hidden="true">
                        <path d="M3 8h10M9 4l4 4-4 4" />
                    </svg>
                </a>
                <a routerLink="/" class="ps__btn ps__btn--ghost">Retour à l'accueil</a>
            </div>

            <!-- Note de confirmation email -->
            <p class="ps__note">
                Un reçu a été envoyé à votre adresse email.
            </p>

        </div>
    </div>
</div>
}
```

# app\shared\components\payment-success\payment-success.scss

```scss
/* =============================================
   PAYMENT SUCCESS — page complète
   ============================================= */

// Variables locales
$duration-fast:   0.4s;
$duration-normal: 0.6s;
$duration-slow:   0.8s;
$ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1);
$ease-out:        cubic-bezier(0.16, 1, 0.3, 1);

// -----------------------------------------------
// Conteneur principal
// -----------------------------------------------

.ps__loading {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ps__loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-dark);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.ps {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 80px 24px;
  background-color: var(--color-white);
  overflow: hidden;
}

// -----------------------------------------------
// Fond animé — anneaux concentriques
// -----------------------------------------------

.ps__bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.ps__bg-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) scale(0);
  border-radius: 50%;
  border: 1px solid var(--color-border);
  opacity: 0;
  transition: transform $duration-slow $ease-out, opacity $duration-slow ease;

  &--1 { width: 320px;  height: 320px;  }
  &--2 { width: 560px;  height: 560px;  }
  &--3 { width: 840px;  height: 840px;  }
}

.ps__bg-dots {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle, var(--color-border) 1px, transparent 1px);
  background-size: 28px 28px;
  opacity: 0;
  transition: opacity $duration-slow ease 0.2s;
}

// Activation des anneaux à l'étape 1
.ps--step-1 {
  .ps__bg-ring {
    opacity: 1;

    &--1 { transform: translate(-50%, -50%) scale(1); transition-delay: 0s; }
    &--2 { transform: translate(-50%, -50%) scale(1); transition-delay: 0.1s; }
    &--3 { transform: translate(-50%, -50%) scale(1); transition-delay: 0.2s; }
  }

  .ps__bg-dots { opacity: 0.5; }
}

// -----------------------------------------------
// Wrapper du contenu
// -----------------------------------------------

.ps__wrapper {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  max-width: 480px;
  width: 100%;
  text-align: center;
}

// -----------------------------------------------
// Icône de succès
// -----------------------------------------------

.ps__icon-wrap {
  opacity: 0;
  transform: scale(0.5);
  transition: opacity $duration-normal $ease-spring,
              transform $duration-normal $ease-spring;
}

.ps--step-1 .ps__icon-wrap {
  opacity: 1;
  transform: scale(1);
}

.ps__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background-color: var(--color-dark);
  color: var(--color-white);
  box-shadow:
    0 0 0 8px rgba(20, 21, 26, 0.06),
    0 0 0 16px rgba(20, 21, 26, 0.03);
}

.ps__icon-check {
  width: 40px;
  height: 40px;
}

// Animation du cercle SVG
.ps__icon-circle {
  stroke-dasharray: 157;
  stroke-dashoffset: 157;
  transition: stroke-dashoffset $duration-slow $ease-out 0.1s;
}

.ps--step-1 .ps__icon-circle {
  stroke-dashoffset: 0;
}

// Animation du tick SVG
.ps__icon-tick {
  stroke-dasharray: 36;
  stroke-dashoffset: 36;
  transition: stroke-dashoffset $duration-normal $ease-out 0.5s;
}

.ps--step-1 .ps__icon-tick {
  stroke-dashoffset: 0;
}

// -----------------------------------------------
// En-tête : badge + titre + sous-titre
// -----------------------------------------------

.ps__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity $duration-normal $ease-out,
              transform $duration-normal $ease-out;
}

.ps--step-2 .ps__header {
  opacity: 1;
  transform: translateY(0);
}

.ps__plan-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-lt);
  font-family: var(--font-medium);
  font-size: 13px;
  color: var(--color-dark);
}

.ps__title {
  font-family: var(--font-base);
  font-size: 40px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--color-dark);
}

.ps__subtitle {
  font-size: 16px;
  line-height: 1.6;
  color: var(--color-muted);
  max-width: 360px;

  strong {
    color: var(--color-dark);
    font-family: var(--font-medium);
    font-weight: 500;
  }
}

// -----------------------------------------------
// Carte des fonctionnalités
// -----------------------------------------------

.ps__card {
  width: 100%;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-lt);
  padding: 24px;
  opacity: 0;
  transform: translateY(16px);
  transition: opacity $duration-normal $ease-out 0.1s,
              transform $duration-normal $ease-out 0.1s;
}

.ps--step-2 .ps__card {
  opacity: 1;
  transform: translateY(0);
}

.ps__card-label {
  font-family: var(--font-medium);
  font-size: 12px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  margin-bottom: 16px;
  text-align: left;
}

.ps__features {
  display: flex;
  flex-direction: column;
  gap: 0;
  list-style: none;
  padding: 0;
  margin: 0;
}

// Chaque feature apparaît en cascade (étape 3)
.ps__feature {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  font-size: 14px;
  line-height: 1.4;
  color: var(--color-dark);
  text-align: left;
  border-bottom: 1px solid var(--color-border);
  opacity: 0;
  transform: translateX(-8px);
  transition: opacity 0.35s $ease-out calc(var(--i) * 0.08s),
              transform 0.35s $ease-out calc(var(--i) * 0.08s);

  &:last-child { border-bottom: none; }
}

.ps--step-3 .ps__feature {
  opacity: 1;
  transform: translateX(0);
}

.ps__feature-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--color-dark);
  flex-shrink: 0;
}

// -----------------------------------------------
// Actions
// -----------------------------------------------

.ps__actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  width: 100%;
  opacity: 0;
  transform: translateY(12px);
  transition: opacity $duration-normal $ease-out 0.2s,
              transform $duration-normal $ease-out 0.2s;
}

.ps--step-3 .ps__actions {
  opacity: 1;
  transform: translateY(0);
}

.ps__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 12px 24px;
  border-radius: var(--radius-pill);
  font-family: var(--font-medium);
  font-size: 15px;
  text-decoration: none;
  transition: opacity 0.15s ease, transform 0.15s ease;

  svg {
    width: 16px;
    height: 16px;
    transition: transform 0.2s ease;
  }

  &:hover {
    opacity: 0.88;
    svg { transform: translateX(3px); }
  }

  &--primary {
    background-color: var(--color-dark);
    color: var(--color-white);
    border: none;
  }

  &--ghost {
    background-color: transparent;
    color: var(--color-muted);
    border: none;
    font-size: 14px;
    width: auto;
    padding: 8px 16px;

    &:hover { color: var(--color-dark); opacity: 1; }
  }
}

// -----------------------------------------------
// Note email
// -----------------------------------------------

.ps__note {
  font-size: 13px;
  color: var(--color-muted);
  opacity: 0;
  transition: opacity $duration-normal ease 0.4s;
}

.ps--step-3 .ps__note {
  opacity: 1;
}

// -----------------------------------------------
// Responsive
// -----------------------------------------------

@media (max-width: 767px) {
  .ps__title   { font-size: 32px; }
  .ps__bg-ring--3 { width: 560px; height: 560px; }
}
```

# app\shared\components\payment-success\payment-success.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaymentSuccess } from './payment-success';

describe('PaymentSuccess', () => {
  let component: PaymentSuccess;
  let fixture: ComponentFixture<PaymentSuccess>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaymentSuccess],
    }).compileComponents();

    fixture = TestBed.createComponent(PaymentSuccess);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\shared\components\payment-success\payment-success.ts

```ts
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

type Plan = 'pro' | 'team';

interface PlanDetails {
  name: string;
  emoji: string;
  color: string;
  features: string[];
}

@Component({
  selector: 'app-payment-success',
  imports: [CommonModule, RouterLink],
  templateUrl: './payment-success.html',
  styleUrl: './payment-success.scss'
})
export class PaymentSuccess implements OnInit {

  private readonly auth  = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  plan          = signal<Plan>('pro');
  animationStep = signal(0);
  refreshing    = signal(true);   // on attend le refresh avant d'afficher

  plans: Record<Plan, PlanDetails> = {
    pro: {
      name: 'Pro',
      emoji: '⚡',
      color: '#14151a',
      features: [
        '10 projets actifs débloqués',
        "Jusqu'à 2 000 feedbacks / mois",
        'Score de priorité IA activé',
        'Analyse de sentiment + topics clés',
        'Graphique de tendances 30 jours',
        'Export CSV disponible',
        'Réponse support sous 24h',
      ],
    },
    team: {
      name: 'Team',
      emoji: '🚀',
      color: '#14151a',
      features: [
        'Projets illimités',
        "Jusqu'à 10 000 feedbacks / mois",
        "Membres d'équipe illimités",
        'Gestion des rôles & permissions',
        'Tableau de bord partagé',
        'Réponse support sous 4h',
      ],
    },
  };

  currentPlan = computed(() => this.plans[this.plan()]);

  ngOnInit(): void {
    const planParam = this.route.snapshot.queryParamMap.get('plan');
    if (planParam === 'team') this.plan.set('team');

    // Rafraîchit le JWT pour que l'app connaisse le nouveau plan
    this.auth.refreshTokens().subscribe({
      next: () => this.startAnimation(),
      error: () => this.startAnimation(), // on affiche quand même en cas d'erreur
    });
  }

  private startAnimation(): void {
    this.refreshing.set(false);
    setTimeout(() => this.animationStep.set(1), 300);
    setTimeout(() => this.animationStep.set(2), 1000);
    setTimeout(() => this.animationStep.set(3), 1600);
  }
}
```

# app\shared\components\paywall\paywall.html

```html
<div class="paywall">

    <!-- Icône -->
    <div class="paywall__icon" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="8" y="20" width="32" height="22" rx="3" />
            <path d="M16 20v-6a8 8 0 0 1 16 0v6" />
            <circle cx="24" cy="31" r="3" fill="currentColor" stroke="none" />
            <line x1="24" y1="34" x2="24" y2="37" />
        </svg>
    </div>

    <!-- Titre + sous-titre -->
    <h1 class="paywall__title">
         {{ title() }} 
    </h1>
    <p class="paywall__subtitle">
         {{ subtitle() }} <strong>Pro</strong>.
    </p>

    <!-- Liste des avantages -->
    <ul class="paywall__features">
        <li class="paywall__feature">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="2.5 8 6 11.5 13.5 4" />
            </svg>
            Widget JS personnalisable (couleur, titre, position)
        </li>
        <li class="paywall__feature">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="2.5 8 6 11.5 13.5 4" />
            </svg>
            Snippet prêt à coller en 2 minutes sur n'importe quel site
        </li>
        <li class="paywall__feature">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="2.5 8 6 11.5 13.5 4" />
            </svg>
            10 projets actifs et feedbacks illimités
        </li>
        <li class="paywall__feature">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="2.5 8 6 11.5 13.5 4" />
            </svg>
            Analyse IA avancée — score, sentiment, topics clés
        </li>
        <li class="paywall__feature">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round">
                <polyline points="2.5 8 6 11.5 13.5 4" />
            </svg>
            Export CSV et graphique de tendances 30 jours
        </li>
    </ul>

    <!-- Prix + CTA -->
    <div class="paywall__pricing">
        <span class="paywall__price">9€</span>
        <span class="paywall__period">/ mois, sans engagement</span>
    </div>

    <a routerLink="/dashboard/billing" class="paywall__cta">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
        Passer au plan Pro
    </a>

    <p class="paywall__hint">
        Déjà abonné ?
        <a routerLink="/dashboard/billing" class="paywall__hint-link">
            Vérifier mon abonnement
        </a>
    </p>

</div>
```

# app\shared\components\paywall\paywall.scss

```scss
// ══════════════════════════════════════════════════════════
// PAYWALL — plan Free
// ══════════════════════════════════════════════════════════

.paywall {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 4rem 2rem;
  max-width: 520px;
  margin: 0 auto;
  animation: fadeIn 0.3s ease;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

// ── Icône cadenas ──────────────────────────────────────────
.paywall__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: var(--color-surface-lt, #F8F9FA);
  border: 1px solid var(--color-border);
  color: var(--color-muted);
  margin-bottom: 1.5rem;

  svg { width: 36px; height: 36px; }
}

// ── Titre ──────────────────────────────────────────────────
.paywall__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-dark);
  margin: 0 0 0.75rem;
}

// ── Sous-titre ─────────────────────────────────────────────
.paywall__subtitle {
  font-size: 0.9375rem;
  color: var(--color-text-secondary, #6B7280);
  line-height: 1.6;
  margin: 0 0 2rem;

  strong { color: var(--color-dark); }
}

// ── Liste des avantages ────────────────────────────────────
.paywall__features {
  list-style: none;
  padding: 0;
  margin: 0 0 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: 100%;
  max-width: 380px;
  text-align: left;
}

.paywall__feature {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 0.875rem;
  color: var(--color-text-primary, #111827);

  svg {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    margin-top: 2px;
    color: #10B981;
  }
}

// ── Prix ───────────────────────────────────────────────────
.paywall__pricing {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 1.25rem;
}

.paywall__price {
  font-size: 2.25rem;
  font-weight: 800;
  color: var(--color-dark);
  line-height: 1;
}

.paywall__period {
  font-size: 0.875rem;
  color: var(--color-muted);
}

// ── CTA principal ──────────────────────────────────────────
.paywall__cta {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 44px;
  padding: 0 28px;
  border-radius: var(--radius-inner, 8px);
  background-color: var(--color-dark);
  color: var(--color-white);
  font-family: var(--font-medium);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  transition: opacity 0.15s ease;
  margin-bottom: 1rem;

  svg { width: 14px; height: 14px; }

  &:hover { opacity: 0.88; }
}

// ── Hint ───────────────────────────────────────────────────
.paywall__hint {
  font-size: 13px;
  color: var(--color-muted);
  margin: 0;
}

.paywall__hint-link {
  color: var(--color-dark);
  text-decoration: underline;
  text-underline-offset: 2px;
  font-family: var(--font-medium);

  &:hover { opacity: 0.75; }
}
```

# app\shared\components\paywall\paywall.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Paywall } from './paywall';

describe('Paywall', () => {
  let component: Paywall;
  let fixture: ComponentFixture<Paywall>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Paywall],
    }).compileComponents();

    fixture = TestBed.createComponent(Paywall);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\shared\components\paywall\paywall.ts

```ts
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-paywall',
  imports: [],
  templateUrl: './paywall.html',
  styleUrl: './paywall.scss',
})
export class Paywall {

  title = input('titre');

  subtitle = input(
    'sous titre'
  );

}
```

# app\shared\components\pricing\pricing.html

```html
  <!-- =============================================
      PRICING
      ============================================= -->
  <section class="pricing">
    <div class="container">

      <div class="pricing__header">
        <h2 class="pricing__title">Un tarif simple,<br>pas de surprises</h2>
        <p class="pricing__subtitle">
          Commencez gratuitement. Évoluez quand vous en avez besoin.
          Pas d'engagement, annulation à tout moment.
        </p>
      </div>

      <div class="pricing__grid">
        @for (plan of plans; track plan.id) {
        <div class="pricing-card" [class.pricing-card--featured]="plan.featured">

          @if (plan.featured) {
          <div class="pricing-card__badge">Le plus populaire</div>
          }

          <div class="pricing-card__header">
            <h3 class="pricing-card__name">{{ plan.name }}</h3>
            <div class="pricing-card__price">
              @if (plan.price === 0) {
              <span class="pricing-card__amount">Gratuit</span>
              } @else {
              <span class="pricing-card__amount">{{ plan.price }}€</span>
              <span class="pricing-card__period">/ mois</span>
              }
            </div>
            <p class="pricing-card__description">{{ plan.description }}</p>
          </div>

          <a [routerLink]="plan.ctaPath" class="pricing-card__cta" [class.pricing-card__cta--primary]="plan.featured"
            [class.pricing-card__cta--secondary]="!plan.featured">
            {{ plan.cta }}
          </a>

          <div class="pricing-card__divider"></div>

          <ul class="pricing-card__features">
            @for (feature of plan.features; track feature) {
            <li class="pricing-card__feature">
              <svg class="pricing-card__check" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
                stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="2.5 8 6 11.5 13.5 4" />
              </svg>
              {{ feature }}
            </li>
            }
          </ul>

        </div>
        }
      </div>

    </div>
  </section>

```

# app\shared\components\pricing\pricing.scss

```scss
// =============================================
// PRICING
// =============================================
 
.pricing { padding: 96px 0; }
 
.pricing__header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  max-width: 560px;
  margin: 0 auto 64px;
  text-align: center;
}
 
.pricing__title {
  font-family: var(--font-base);
  font-size: 48px;
  font-weight: 400;
  line-height: 1.15;
  color: var(--color-dark);
}
 
.pricing__subtitle {
  font-size: 18px;
  line-height: 1.55;
  color: var(--color-muted);
}
 
// Grille des 3 cartes
 
.pricing__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  align-items: start;
}
 
// Carte
 
.pricing-card {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  background-color: var(--color-white);
  padding: 28px;
  position: relative;
  transition: box-shadow 0.2s ease, transform 0.2s ease;
 
  &:hover {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.07);
    transform: translateY(-2px);
  }
 
  // Carte mise en avant (Pro)
  &--featured {
    border-color: var(--color-dark);
    background-color: var(--color-dark);
    color: var(--color-white);
    transform: translateY(-8px); // légèrement surélevée
 
    &:hover {
      transform: translateY(-12px);
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.2);
    }
  }
}
 
// Badge "Le plus populaire"
 
.pricing-card__badge {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  padding: 4px 10px;
  margin-bottom: 16px;
  border-radius: var(--radius-pill);
  background-color: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.2);
  font-family: var(--font-medium);
  font-size: 12px;
  color: var(--color-white);
}
 
// En-tête de la carte
 
.pricing-card__header {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}
 
.pricing-card__name {
  font-family: var(--font-medium);
  font-size: 18px;
  font-weight: 500;
  color: var(--color-dark);
 
  .pricing-card--featured & {
    color: var(--color-white);
  }
}
 
.pricing-card__price {
  display: flex;
  align-items: baseline;
  gap: 4px;
}
 
.pricing-card__amount {
  font-family: var(--font-base);
  font-size: 40px;
  font-weight: 400;
  line-height: 1;
  color: var(--color-dark);
 
  .pricing-card--featured & {
    color: var(--color-white);
  }
}
 
.pricing-card__period {
  font-size: 14px;
  color: var(--color-muted);
 
  .pricing-card--featured & {
    color: rgba(255, 255, 255, 0.6);
  }
}
 
.pricing-card__description {
  font-size: 14px;
  line-height: 1.55;
  color: var(--color-muted);
 
  .pricing-card--featured & {
    color: rgba(255, 255, 255, 0.7);
  }
}
 
// Bouton CTA
 
.pricing-card__cta {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 20px;
  border-radius: var(--radius-pill);
  font-family: var(--font-medium);
  font-size: 14px;
  text-decoration: none;
  transition: opacity 0.15s ease;
  margin-bottom: 24px;
 
  &:hover { opacity: 0.85; }
 
  &--primary {
    background-color: var(--color-white);
    color: var(--color-dark);
    border: none;
  }
 
  &--secondary {
    background-color: transparent;
    color: var(--color-dark);
    border: 1px solid var(--color-border);
  }
}
 
// Séparateur
 
.pricing-card__divider {
  height: 1px;
  background-color: var(--color-border);
  margin-bottom: 24px;
 
  .pricing-card--featured & {
    background-color: rgba(255, 255, 255, 0.15);
  }
}
 
// Liste des fonctionnalités
 
.pricing-card__features {
  display: flex;
  flex-direction: column;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 0;
}
 
.pricing-card__feature {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 14px;
  line-height: 1.45;
  color: var(--color-dark);
 
  .pricing-card--featured & {
    color: rgba(255, 255, 255, 0.85);
  }
}
 
.pricing-card__check {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-dark);
 
  .pricing-card--featured & {
    color: var(--color-white);
  }
}


@media (max-width: 1199px) {
  .pricing__title       { font-size: 40px; }
}

@media (max-width: 767px) { 
  .pricing              { padding: 64px 0; }
  .pricing__header      { margin-bottom: 40px; }
  .pricing__title       { font-size: 32px; }
  .pricing__subtitle    { font-size: 16px; }
  .pricing__grid        { grid-template-columns: 1fr; }
  .pricing-card--featured { transform: none; }
 
}


```

# app\shared\components\pricing\pricing.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Pricing } from './pricing';

describe('Pricing', () => {
  let component: Pricing;
  let fixture: ComponentFixture<Pricing>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Pricing],
    }).compileComponents();

    fixture = TestBed.createComponent(Pricing);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# app\shared\components\pricing\pricing.ts

```ts
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface PricingPlan {
  id: string;
  name: string;
  price: number | null;
  priceLabel?: string;
  description: string;
  cta: string;
  ctaPath: string;
  featured: boolean;
  features: string[];
}

@Component({
  selector: 'app-pricing',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './pricing.html',
  styleUrl: './pricing.scss',
})
export class Pricing {

  plans: PricingPlan[] = [
    {
      id: 'free',
      name: 'Free',
      price: 0,
      description: 'Pour découvrir la plateforme avec un premier client.',
      cta: 'Commencer gratuitement',
      ctaPath: '/register',
      featured: false,
      features: [
        '1 projet actif',
        '50 feedbacks / mois',
        'Analyse IA : catégorie + résumé',
        'Tableau kanban',
        'Widget intégrable',
        'Documentation & communauté',
      ],
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 9,
      description: 'Pour les freelances qui gèrent plusieurs clients en parallèle.',
      cta: 'Passer au Pro',
      ctaPath: '/register?plan=pro',
      featured: true,
      features: [
        '10 projets actifs',
        "Jusqu'à 2 000 feedbacks / mois",
        'Analyse IA complète : score de priorité, sentiment, topics',
        'Filtres avancés & tri par priorité',
        'Widget personnalisable (couleurs, texte, position)',
        'Graphique de tendances 30 jours',
        'Export CSV',
        'Réponse support sous 24h',
      ],
    },
    {
      id: 'team',
      name: 'Team',
      price: 29,
      description: 'Pour les agences qui livrent des projets à plusieurs.',
      cta: 'Passer au Team',
      ctaPath: '/register?plan=team',
      featured: false,
      features: [
        'Projets illimités',
        "Jusqu'à 10 000 feedbacks / mois",
        'Tout le plan Pro',
        "Membres d'équipe illimités",
        'Gestion des rôles & permissions',
        'Tableau de bord partagé',
        'Réponse support sous 4h',
      ],
    },
  ];
}



```

# environments\environment.production.ts

```ts
export const environment = {
  production: true,
  apiUrl: 'https://ton-domaine.com/api',
  googleClientId: 'ton-client-id.apps.googleusercontent.com'
};
```

# environments\environment.ts

```ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
  widgetCdnUrl:    'http://localhost:3000/widget.iife.js',
  googleClientId: '1027937941865-squt6gpfdlkrfs9euhia6dvjvu9soljo.apps.googleusercontent.com',
  stripePrices: {
    pro: 'price_1TXfFRGgFL6l11dBfjXMXASz',
    team: 'price_1TXfHjGgFL6l11dBG1rxtr2I'
  }

};



```

# index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Frontend</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
<body>
  <app-root></app-root>
</body>
</html>

```

# main.ts

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));

```

# styles.scss

```scss
/* =============================================
   FONTS
   ============================================= */

@font-face {
  font-family: "Geist Regular";
  src: url(https://web.archive.org/web/20250108182158im_/https://framerusercontent.com/assets/fmgcvoo7Pvi75XN7wkBOp5g4i4s.woff2);
  font-display: swap;
}

@font-face {
  font-family: "Geist Regular Placeholder";
  src: local("Arial");
  ascent-override: 85.77%;
  descent-override: 20.51%;
  line-gap-override: 9.32%;
  size-adjust: 107.26%;
}

@font-face {
  font-family: "Geist Medium Placeholder";
  src: local("Arial");
  ascent-override: 83.78%;
  descent-override: 20.03%;
  line-gap-override: 9.11%;
  size-adjust: 109.82%;
}

/* =============================================
   DESIGN TOKENS
   ============================================= */

:root {
  --color-dark:       rgb(20, 21, 26);
  --color-white:      rgb(255, 255, 255);
  --color-muted:      rgb(108, 110, 120);
  --color-border:     rgb(205, 205, 205);
  --color-surface:    rgb(239, 239, 240);
  --color-surface-lt: rgb(244, 244, 245);

  --font-base:   "Geist Regular",   "Geist Regular Placeholder",   sans-serif;
  --font-medium: "Geist Medium",    "Geist Medium Placeholder",    sans-serif;

  --radius-pill:  36px;
  --radius-card:  16px;
  --radius-inner: 12px;
}

/* =============================================
   RESET
   ============================================= */

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-base);
  font-size: 16px;
  color: var(--color-dark);
  background: var(--color-white);
}

img {
  display: block;
  max-width: 100%;
}

/* =============================================
   LAYOUT — CONTAINER (utilitaire global)
   ============================================= */

.container {
  width: 100%;
  max-width: 1200px;
  margin-inline: auto;
  padding-inline: 2rem;
}

/* =============================================
   BOUTONS (utilitaires globaux)
   ============================================= */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 24px;
  border-radius: var(--radius-pill);
  font-family: var(--font-medium);
  font-size: 16px;
  line-height: 24px;
  font-weight: 400;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.85;
  }
}

.btn--primary {
  background-color: var(--color-dark);
  color: var(--color-white);
  border: none;
}

.btn--secondary {
  background-color: var(--color-white);
  color: var(--color-dark);
  border: 0.5px solid var(--color-border);
}

.btn--nav-primary {
  display: inline-flex;
  align-items: center;
  padding: 7px 16px;
  border-radius: 17px;
  font-family: var(--font-medium);
  font-size: 16px;
  line-height: 24px;
  color: var(--color-white);
  background-color: var(--color-dark);
  text-decoration: none;
  border: none;
  cursor: pointer;
  transition: opacity 0.15s ease;

  &:hover {
    opacity: 0.85;
  }
}
```

