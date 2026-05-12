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

  // ─── Expose userId en lecture directe (utilisé par DashboardContextService) ──
  readonly userId = computed(() => this._profile()?.id ?? null);

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

      const id = payload[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
      ] ?? payload.sub ?? '';

      const email = payload[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'
      ] ?? payload.email ?? '';

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