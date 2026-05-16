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

  createCheckoutSession(priceId: string): Observable<CheckoutSessionResponse> {
    const successUrl = `${window.location.origin}/dashboard/billing?success=true`;
    const cancelUrl  = `${window.location.origin}/dashboard/billing?canceled=true`;
    return this.http.post<CheckoutSessionResponse>(`${this.api}/checkout`, {
      priceId, successUrl, cancelUrl
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