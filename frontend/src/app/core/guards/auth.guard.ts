import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SessionRestoreService } from '../services/session-restore.service';

// Protège les routes privées — redirige vers /login si non connecté
export const authGuard: CanActivateFn = async () => {
  const auth   = inject(AuthService);
  const router = inject(Router);
  const sessionRestore = inject(SessionRestoreService);

  await sessionRestore.restore();


  if (auth.isAuthenticated()) return true;

  return router.createUrlTree(['/login']);
};