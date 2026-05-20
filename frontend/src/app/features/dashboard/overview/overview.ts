import {
  Component, computed, inject,
  OnInit, OnDestroy, signal
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { interval, Subscription, switchMap, takeWhile } from 'rxjs';

import { DashboardData, OverviewService } from './overview.service';
import { UserService }            from '../../../core/services/user.service';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';
import { RecentFeedback, TrendPoint } from './overview.types';

@Component({
  selector: 'app-overview',
  imports: [CommonModule, DatePipe, RouterLink],
  templateUrl: './overview.html',
  styleUrl:    './overview.scss',
})
export class Overview implements OnInit, OnDestroy {

  // ─── Services ─────────────────────────────────────────────────────────────
  private readonly overviewService  = inject(OverviewService);
  private readonly userService      = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  readonly router                   = inject(Router);

  private pollSubscription?: Subscription;

  // ─── State ────────────────────────────────────────────────────────────────
  loading = signal(true);
  error   = signal('');
  data    = signal<DashboardData | null>(null);

  // ─── Computed — user ──────────────────────────────────────────────────────
  readonly firstName      = computed(() => this.userService.profile()?.firstName ?? '');
  readonly currentProject = this.dashboardContext.selectedProject;

  // ─── Computed — stats ─────────────────────────────────────────────────────
  readonly stats = computed(() => this.data()?.stats ?? {
    totalFeedbacks:    0,
    todoCount:         0,
    inProgressCount:   0,
    resolvedCount:     0,
    highPriorityCount: 0,
  });

  // Feedbacks récents triés : urgents/critiques en premier, puis par date
  readonly recentFeedbacks = computed(() => {
    const list = this.data()?.recentFeedbacks ?? [];
    const priorityOrder: Record<string, number> = {
      Critical: 0, High: 1, Normal: 2, Low: 3
    };
    return [...list].sort((a, b) => {
      const pa = priorityOrder[a.priority] ?? 4;
      const pb = priorityOrder[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  // Feedbacks urgents non résolus (alerte banner)
  readonly urgentCount = computed(() =>
    this.recentFeedbacks().filter(
      f => (f.priority === 'Critical' || f.priority === 'High') && f.status !== 'Done'
    ).length
  );

  // À traiter uniquement (pour le feed Inbox)
  readonly todoFeedbacks = computed(() =>
    this.recentFeedbacks().filter(f => f.status === 'Todo').slice(0, 8)
  );

  // Sparkline 7 jours
  readonly trends     = computed(() => this.data()?.trends ?? []);
  readonly sparkline7 = computed(() => {
    const all = this.trends();
    return all.slice(-7);
  });
  readonly sparklineMax = computed(() =>
    Math.max(...this.sparkline7().map(t => t.count), 1)
  );

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit():    void { this.load(); }
  ngOnDestroy(): void { this.pollSubscription?.unsubscribe(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    const projectId = this.currentProject()?.id;

    this.overviewService.getDashboard(projectId).subscribe({
      next: data => {
        this.data.set(data);
        this.loading.set(false);
        this.startPollingIfNeeded();
      },
      error: () => {
        this.error.set('Impossible de charger le tableau de bord.');
        this.loading.set(false);
      }
    });
  }

  private startPollingIfNeeded(): void {
    const hasPending = (this.data()?.recentFeedbacks ?? []).some(
      f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
    );
    if (!hasPending || this.pollSubscription) return;

    const projectId = this.currentProject()?.id;

    this.pollSubscription = interval(3000).pipe(
      switchMap(() => this.overviewService.getDashboard(projectId)),
      takeWhile(data =>
        data.recentFeedbacks.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        ), true
      )
    ).subscribe({
      next: data => {
        this.data.set(data);
        const stillPending = data.recentFeedbacks.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        );
        if (!stillPending) {
          this.pollSubscription?.unsubscribe();
          this.pollSubscription = undefined;
        }
      }
    });
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  goToFeedbacks(): void {
    this.router.navigate(['/dashboard/feedbacks']);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      Bug:            '🐛 Bug',
      FeatureRequest: '✨ Fonctionnalité',
      Question:       '❓ Question',
      Uncategorized:  '📝 Non catégorisé',
    };
    return labels[category] ?? category;
  }

  getPriorityConfig(priority: string): { label: string; cls: string } {
    const map: Record<string, { label: string; cls: string }> = {
      Critical: { label: 'Critique', cls: 'critical' },
      High:     { label: 'Haute',    cls: 'high'     },
      Normal:   { label: 'Normale',  cls: 'normal'   },
      Low:      { label: 'Basse',    cls: 'low'       },
    };
    return map[priority] ?? { label: priority, cls: 'normal' };
  }

  getSparklineHeight(count: number): number {
    return Math.max(Math.round((count / this.sparklineMax()) * 100), 4);
  }

  trackByDate(_: number, item: TrendPoint):    string { return item.date; }
  trackById(_:   number, item: RecentFeedback): string { return item.id;   }
}