import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
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