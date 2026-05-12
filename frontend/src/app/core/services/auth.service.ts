import { Injectable, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, BehaviorSubject, Subject, throwError, filter, take, switchMap, of } from 'rxjs';
import { tap, catchError, finalize } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TokenStorageService } from './token-storage.service';
import { UserService } from './user.service';
import { DashboardContextService } from './dashboard-context.service';

export interface AuthTokens {
  accessToken: string;
}

export interface GoogleAuthResponse extends AuthTokens {
  isNewUser: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http             = inject(HttpClient);
  private readonly rawHttp          = new HttpClient(inject(HttpBackend));
  private readonly router           = inject(Router);
  private readonly storage          = inject(TokenStorageService);
  private readonly userService      = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly API = environment.apiUrl;

  // ─── Signals publics ───────────────────────────────────────────────────────
  isAuthenticated = signal(!!this.storage.getAccessToken());

  // Émet à chaque logout — les composants/services qui ont des données
  // en mémoire s'y abonnent pour se vider sans couplage direct.
  private readonly _logout$ = new Subject<void>();
  readonly logout$ = this._logout$.asObservable();

  // ─── Refresh concurrent ────────────────────────────────────────────────────
  private isRefreshing = false;
  private refreshSubject = new BehaviorSubject<AuthTokens | null>(null);

  // ─── Auth classique ────────────────────────────────────────────────────────
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

  // ─── Google OAuth ──────────────────────────────────────────────────────────
  loginWithGoogle(idToken: string): Observable<GoogleAuthResponse> {
    return this.http
      .post<GoogleAuthResponse>(`${this.API}/auth/google`, { idToken }, { withCredentials: true })
      .pipe(tap(result => this.saveTokens(result)));
  }

  // ─── Refresh concurrent ────────────────────────────────────────────────────
  refreshTokens(rawHttp: HttpClient): Observable<AuthTokens> {
    if (this.isRefreshing) {
      return this.refreshSubject.pipe(
        filter(token => token !== null),
        take(1),
        switchMap(tokens => of(tokens!))
      );
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
          this.logout(false);
          return throwError(() => error);
        })
      );
  }

  // ─── saveTokens — ordre garanti ────────────────────────────────────────────
  // 1. Persiste le token
  // 2. userService.refresh() → userId disponible
  // 3. dashboardContext.loadForUser() → charge la bonne clé localStorage
  saveTokens(tokens: AuthTokens): void {
    this.storage.saveAccessToken(tokens.accessToken);
    this.userService.refresh();
    this.dashboardContext.loadForUser();
    this.isAuthenticated.set(true);
  }

  getAccessToken(): string | null {
    return this.storage.getAccessToken();
  }

  // ─── logout — ordre garanti ────────────────────────────────────────────────
  // 1. clearForCurrentUser() — userId encore dispo pour construire la clé localStorage
  // 2. userService.clear()   — userId devient null
  // 3. storage.clearAll()    — tokens supprimés
  // 4. _logout$.next()       — signal aux composants de vider leurs données
  // 5. navigate('/login')
  logout(revokeOnServer = true): void {
    const completeLogout = () => {
      this.dashboardContext.clearForCurrentUser();
      this.userService.clear();
      this.storage.clearAll();
      this.isAuthenticated.set(false);
      this.isRefreshing = false;
      this.refreshSubject.next(null);
      this._logout$.next();         // ← les composants/services écoutent ça
      this.router.navigate(['/login']);
    };

    if (revokeOnServer) {
      this.rawHttp
        .post(`${this.API}/auth/revoke`, { revokeAll: false }, { withCredentials: true })
        .pipe(finalize(completeLogout))
        .subscribe({ error: () => {} });
    } else {
      completeLogout();
    }
  }
}