import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { SessionRestoreService } from './core/services/session-restore.service';
import { quotaInterceptor } from './core/interceptors/quota.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, quotaInterceptor])),
    provideAppInitializer(() => {
          const sessionRestore = inject(SessionRestoreService);
          return sessionRestore.restore();
        })  
    ]
};
