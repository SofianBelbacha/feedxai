import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { QuotaStateService } from '../services/quota-state.service';
import { QuotaModalService } from '../services/quota-modal.service';

export const quotaInterceptor: HttpInterceptorFn = (req, next) => {
  const quotaState = inject(QuotaStateService);
  const quotaModal = inject(QuotaModalService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 429 && error.error?.type === 'QuotaExceededException') {
        // Afficher le modal avec les données du backend
        quotaModal.show({
          current: error.error.current,
          limit: error.error.limit,
          resetDate: error.error.resetDate
        });

        // Rafraîchir le quota affiché dans la sidebar
        quotaState.refresh();
      }
      return throwError(() => error);
    })
  );
};