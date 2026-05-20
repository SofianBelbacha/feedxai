import { Component, HostListener, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';
import { BillingService, QuotaResult } from '../../../shared/components/billing/billing.service';
import { ProjectSwitcher } from '../../../shared/components/project-switcher/project-switcher';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  badge?: number;
}

@Component({
  selector: 'app-dashboard-shell',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ProjectSwitcher],
  templateUrl: './dashboard-shell.html',
  styleUrl: './dashboard-shell.scss',
})
export class DashboardShell implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly billingService = inject(BillingService);

  readonly profile = this.userService.profile;
  readonly fullName = this.userService.fullName;
  readonly initials = this.userService.initials;
  readonly currentProject = this.dashboardContext.selectedProject;
  readonly currentPlan = this.dashboardContext.plan;

  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  logoutLoading = signal(false);
  quota = signal<QuotaResult | null>(null);

  navItems: NavItem[] = [
    { label: 'Vue d\'ensemble', path: '/dashboard', icon: 'home' },
    { label: 'Projets', path: '/dashboard/projects', icon: 'folder', badge: 3 },
    { label: 'Feedbacks', path: '/dashboard/feedbacks', icon: 'messages', badge: 12 },
    { label: 'Tendances', path: '/dashboard/trends', icon: 'chart' },
    { label: 'Widget', path: '/dashboard/widget', icon: 'code' },
  ];

  bottomNavItems: NavItem[] = [
    { label: 'Paramètres', path: '/dashboard/settings', icon: 'settings' },
    { label: 'Aide', path: '/dashboard/help', icon: 'help' },
  ];

  ngOnInit(): void {
    this.billingService.getQuota().subscribe({
      next: quota => this.quota.set(quota),
      error: () => { /* silencieux — la sidebar reste sans barre de quota */ }
    });
  }

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

  @HostListener('window:keydown.escape')
  onEscape(): void {
    this.closeMobileMenu();
  }
}