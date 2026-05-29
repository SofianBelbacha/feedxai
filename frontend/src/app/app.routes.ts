import { Routes } from '@angular/router';
import { DashboardShell } from './features/dashboard/shell/dashboard-shell';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';


export const routes: Routes = [
    {
        path: '',
        loadComponent: () =>
            import('./features/landing/landing').then(m => m.Landing)
    },
    {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login/login').then(m => m.Login)
    },
    {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register/register').then(m => m.Register)
    },
    {
        path: 'legal',
        children: [
            { path: 'terms', loadComponent: () => import('./features/legal/terms/terms').then(m => m.Terms) },
            { path: 'privacy', loadComponent: () => import('./features/legal/privacy/privacy').then(m => m.Privacy) },
            { path: 'legal-notice', loadComponent: () => import('./features/legal/legal-notice/legal-notice').then(m => m.LegalNotice) }
        ]
    },
    {
        path: 'dashboard',
        canActivate: [authGuard],
        component: DashboardShell,
        children: [
            { path: '', loadComponent: () => import('./features/dashboard/overview/overview').then(m => m.Overview) },
            { path: 'projects', loadComponent: () => import('./features/dashboard/projects/projects').then(m => m.Projects) },
            { path: 'feedbacks', loadComponent: () => import('./features/dashboard/feedbacks/feedbacks').then(m => m.Feedbacks) },
            { path: 'projects/:projectId/feedbacks', loadComponent: () => import('./features/dashboard/feedbacks/feedbacks').then(m => m.Feedbacks) },
            { path: 'trends', loadComponent: () => import('./features/dashboard/trends/trends').then(m => m.Trends) },
            { path: 'widget', loadComponent: () => import('./features/dashboard/widget/widget').then(m => m.Widget)},
            { path: 'billing', loadComponent: () => import('./shared/components/billing/billing').then(m => m.Billing), }

        ]
    },
    {
        path: 'payment-success',
        loadComponent: () => import('./shared/components/payment-success/payment-success').then(m => m.PaymentSuccess)
    }

];
