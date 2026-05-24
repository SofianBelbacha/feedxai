import { Component, computed, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface QuotaExceededData {
  current: number;
  limit: number;
  resetDate: string;
}

@Component({
  selector: 'app-quota-exceeded-modal',
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="onDismiss.emit()">
      <div class="modal" (click)="$event.stopPropagation()" role="dialog"
           aria-modal="true" aria-labelledby="quota-modal-title">

        <div class="modal__icon">📊</div>

        <h2 id="quota-modal-title" class="modal__title">
          Limite mensuelle atteinte
        </h2>

        <p class="modal__body">
          Tu as utilisé <strong>{{ data().current }}/{{ data().limit }}</strong>
          feedbacks ce mois-ci.
          @if (resetDate()) {
            <br>Ton quota se renouvelle le <strong>{{ resetDate() }}</strong>.
          }
        </p>

        <div class="modal__features">
          <p class="modal__features-title">Avec le plan Pro :</p>
          <ul>
            <li>✓ 2 000 feedbacks / mois</li>
            <li>✓ 10 projets</li>
            <li>✓ 500 analyses IA / jour</li>
          </ul>
        </div>

        <div class="modal__actions">
          <button class="btn btn--primary" (click)="goToBilling()">
            Voir les plans →
          </button>
          <button class="btn btn--ghost" (click)="onDismiss.emit()">
            Plus tard
          </button>
        </div>

      </div>
    </div>
  `,
  styleUrl: './quota-exceeded-modal.scss'
})
export class QuotaExceededModal {
  private readonly router = inject(Router);

  readonly data = input.required<QuotaExceededData>();
  readonly onDismiss = output<void>();

  readonly resetDate = computed(() => {
    const d = this.data().resetDate;
    if (!d) return null;
    return new Date(d).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long'
    });
  });

  goToBilling(): void {
    this.router.navigate(['/dashboard/billing']);
    this.onDismiss.emit();
  }
}