import { inject, Injectable, signal, computed } from '@angular/core';
import { BillingService, QuotaResult } from '../../shared/components/billing/billing.service';

@Injectable({ providedIn: 'root' })
export class QuotaStateService {
  private readonly billingService = inject(BillingService);

  // État central du quota
  private readonly _quota = signal<QuotaResult | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal(false);

  // Exposés en lecture seule
  readonly quota = this._quota.asReadonly();
  readonly loading = this._loading.asReadonly();

  readonly quotaPercent = computed(() => {
    const q = this._quota();
    if (!q || q.feedbacksLimit === -1) return 0;
    return Math.min(Math.round(q.usagePercent), 100);
  });

  readonly isNearLimit = computed(() => this.quotaPercent() >= 80);
  readonly isAtLimit = computed(() => this.quotaPercent() >= 95);

  readonly resetDateFormatted = computed(() => {
    const q = this._quota();
    if (!q?.resetDate) return null;
    return new Date(q.resetDate).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long'
    });
  });

  refresh(): void {
    this._loading.set(true);
    this._error.set(false);

    this.billingService.getQuota().subscribe({
      next: quota => {
        this._quota.set(quota);
        this._loading.set(false);
      },
      error: () => {
        this._error.set(true);
        this._loading.set(false);
      }
    });
  }

  // Appelé après une soumission de feedback réussie
  incrementOptimistic(): void {
    const q = this._quota();
    if (!q || q.feedbacksLimit === -1) return;

    this._quota.set({
      ...q,
      feedbacksThisMonth: q.feedbacksThisMonth + 1,
      usagePercent: Math.min(
        Math.round(((q.feedbacksThisMonth + 1) / q.feedbacksLimit) * 100),
        100
      )
    });
  }
}