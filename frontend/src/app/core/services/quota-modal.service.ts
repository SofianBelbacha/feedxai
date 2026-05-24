import { Injectable, signal } from '@angular/core';
import { QuotaExceededData } from '../../shared/components/quota-exceeded-modal/quota-exceeded-modal';

@Injectable({ providedIn: 'root' })
export class QuotaModalService {
  readonly modalData = signal<QuotaExceededData | null>(null);

  show(data: QuotaExceededData): void {
    this.modalData.set(data);
  }

  dismiss(): void {
    this.modalData.set(null);
  }
}