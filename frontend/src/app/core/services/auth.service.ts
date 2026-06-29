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
        //.subscribe({ error: () => {} });
        .subscribe({ error: (err) => { console.warn('Revoke token failed (ignored):', err)} });
    } else {
      completeLogout();
    }
  }
}
