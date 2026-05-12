import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpBackend } from '@angular/common/http';
import { AuthService } from './auth.service';
import { catchError, of, firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SessionRestoreService {
  private readonly auth    = inject(AuthService);
  private readonly backend = inject(HttpBackend);

  private restorePromise: Promise<void> | null = null;

  restore(): Promise<void> {
    if (this.restorePromise) return this.restorePromise;
    this.restorePromise = this.doRestore();
    return this.restorePromise;
  }

  private async doRestore(): Promise<void> {
    if (this.auth.getAccessToken()) return;

    const rawHttp = new HttpClient(this.backend);

    await firstValueFrom(
      this.auth.refreshTokens(rawHttp).pipe(
        catchError(() => of(null))
      )
    );
  }
}