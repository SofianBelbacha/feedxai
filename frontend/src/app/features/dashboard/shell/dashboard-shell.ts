import {
  Component, HostListener, inject,
  OnInit, signal, computed
} from '@angular/core';
import { CommonModule, TitleCasePipe } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';
import { BillingService, QuotaResult } from '../../../shared/components/billing/billing.service';
import { ProjectSwitcher } from '../../../shared/components/project-switcher/project-switcher';
import { QuotaStateService } from '../../../core/services/quota-state.service';
import { QuotaModalService } from '../../../core/services/quota-modal.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
}

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  imports: [CommonModule, TitleCasePipe, RouterLink, RouterLinkActive, RouterOutlet, ProjectSwitcher],
  templateUrl: './dashboard-shell.html',
  styleUrl: './dashboard-shell.scss',
})
export class DashboardShell implements OnInit {

  // ─── Services ─────────────────────────────────────────────────────────────
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly billingService = inject(BillingService);
  private readonly router = inject(Router);

  // ─── Signals exposés ──────────────────────────────────────────────────────
  readonly profile = this.userService.profile;
  readonly fullName = this.userService.fullName;
  readonly initials = this.userService.initials;
  readonly currentProject = this.dashboardContext.selectedProject;
  readonly currentPlan = this.dashboardContext.plan;
  readonly quotaState = inject(QuotaStateService);


  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  logoutLoading = signal(false);
  currentUrl = signal('');
  readonly quotaModal = inject(QuotaModalService);

  // ─── Quota helpers ────────────────────────────────────────────────────────

  // ─── Label page courante (breadcrumb topbar) ──────────────────────────────
  readonly currentPageLabel = computed(() => {
    const url = this.currentUrl();
    const map: Record<string, string> = {
      '/dashboard': 'Vue d\'ensemble',
      '/dashboard/projects': 'Projets',
      '/dashboard/feedbacks': 'Feedbacks',
      '/dashboard/trends': 'Tendances',
      '/dashboard/widget': 'Widget',
      '/dashboard/settings': 'Paramètres',
      '/dashboard/help': 'Aide',
      '/dashboard/billing': 'Facturation',
    };
    // Correspondance exacte d'abord, puis par préfixe
    if (map[url]) return map[url];
    const match = Object.entries(map).find(([k]) => url.startsWith(k) && k !== '/dashboard');
    return match ? match[1] : 'Vue d\'ensemble';
  });

  // ─── Navigation principale ────────────────────────────────────────────────
  readonly navItems: NavItem[] = [
    { label: 'Vue d\'ensemble', path: '/dashboard', icon: 'home' },
    { label: 'Projets', path: '/dashboard/projects', icon: 'folder' },
    { label: 'Feedbacks', path: '/dashboard/feedbacks', icon: 'messages' },
    { label: 'Tendances', path: '/dashboard/trends', icon: 'chart' },
    { label: 'Widget', path: '/dashboard/widget', icon: 'code' },
  ];

  // ─── Navigation secondaire ────────────────────────────────────────────────
  readonly bottomNavItems: NavItem[] = [
    { label: 'Paramètres', path: '/dashboard/settings', icon: 'settings' },
    { label: 'Aide', path: '/dashboard/help', icon: 'help' },
    { label: 'Facturation', path: '/dashboard/billing', icon: 'billing' },
  ];

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.quotaState.refresh(); 
    // Suivre l'URL courante pour le breadcrumb
    this.currentUrl.set(this.router.url.split('?')[0]);
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(e => {
      this.currentUrl.set((e as NavigationEnd).urlAfterRedirects.split('?')[0]);
    });
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  logout(): void {
    if (this.logoutLoading()) return;
    this.logoutLoading.set(true);
    this.auth.logout();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
    document.body.style.overflow = this.mobileMenuOpen() ? 'hidden' : '';
  }

  closeMobileMenu(): void {
    this.mobileMenuOpen.set(false);
    document.body.style.overflow = '';
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  @HostListener('window:keydown.escape')
  onEscape(): void { this.closeMobileMenu(); }
}