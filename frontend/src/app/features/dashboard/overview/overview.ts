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
import { QuotaStateService } from '../../../core/services/quota-state.service';

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
  readonly quotaState               = inject(QuotaStateService);
  readonly router                   = inject(Router);

  private pollSubscription?: Subscription;

  // ─── State ────────────────────────────────────────────────────────────────
  loading        = signal(true);
  error          = signal('');
  data           = signal<DashboardData | null>(null);
  selectedDays   = signal<7 | 30 | 90>(30);

  // ─── Computed — user ──────────────────────────────────────────────────────
  readonly firstName      = computed(() => this.userService.profile()?.firstName ?? '');
  readonly currentProject = this.dashboardContext.selectedProject;
  readonly periods: readonly (7 | 30 | 90)[] = [7, 30, 90];

  // ─── Computed — stats ─────────────────────────────────────────────────────
  readonly stats = computed(() => this.data()?.stats ?? {
    totalFeedbacks: 0, todoCount: 0, inProgressCount: 0,
    resolvedCount: 0, highPriorityCount: 0, pendingAiCount: 0, growthPercent: 0, resolvedRate: 0, previousPeriodTotal: 0
  });

  readonly categoryStats = computed(() => this.data()?.categoryStats ?? []);
  readonly projectStats  = computed(() => this.data()?.projectStats  ?? []);
  readonly autoInsights = computed(() => this.data()?.autoInsights ?? null);
  readonly hasDataInPeriod = computed(() => this.data()?.hasDataInPeriod ?? true);


  readonly recentFeedbacks = computed(() => {
    const list = this.data()?.recentFeedbacks ?? [];
    const order: Record<string, number> = { Critical: 0, High: 1, Normal: 2, Low: 3 };
    return [...list].sort((a, b) => {
      const pa = order[a.priority] ?? 4;
      const pb = order[b.priority] ?? 4;
      if (pa !== pb) return pa - pb;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  });

  readonly urgentCount = computed(() =>
    this.recentFeedbacks().filter(
      f => (f.priority === 'Critical' || f.priority === 'High') && f.status !== 'Done'
    ).length
  );

  readonly todoFeedbacks = computed(() =>
    this.recentFeedbacks().filter(f => f.status === 'Todo').slice(0, 8)
  );
  

  // ── Quota alerts ──────────────────────────────────────────────────────────
  readonly quotaWarning = computed(() => {
    const q = this.quotaState.quota();
    if (!q || q.feedbacksLimit === -1) return null;
    const pct = this.quotaState.quotaPercent();
    if (pct >= 95) return { type: 'danger', message: `Limite atteinte — ${q.feedbacksThisMonth}/${q.feedbacksLimit} feedbacks utilisés ce mois.` };
    if (pct >= 80) return { type: 'warning', message: `${pct}% de votre quota mensuel utilisé — ${q.feedbacksThisMonth}/${q.feedbacksLimit} feedbacks.` };
    return null;
  });

  // ── Empty state ───────────────────────────────────────────────────────────
  // Modifier isEmpty : seulement si aucune donnée du tout (jamais)
  readonly isEmpty = computed(() =>
    !this.loading() && !this.error() &&
    this.stats().totalFeedbacks === 0 && !this.hasDataInPeriod()
  );

  // état "aucune donnée sur la période" (données historiques existent mais pas sur la période)
  readonly isEmptyPeriod = computed(() =>
    !this.loading() && !this.error() &&
    !this.hasDataInPeriod() && !this.isEmpty()
  );

  // ─── Sparkline ────────────────────────────────────────────────────────────
  readonly sparkline7 = computed(() => (this.data()?.trends ?? []).slice(-7));
  readonly sparklineMax = computed(() =>
    Math.max(...this.trends().map(t => t.count), 1)
  );

  // tous les points de la période pour le graphique volume
  readonly trends = computed(() => this.data()?.trends ?? []);

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit():    void { this.load(); }
  ngOnDestroy(): void { this.pollSubscription?.unsubscribe(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = undefined;

    const projectId = this.currentProject()?.id;

    this.overviewService.getDashboard(projectId, this.selectedDays()).subscribe({
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

  setDays(days: 7 | 30 | 90): void {
    if (this.selectedDays() === days) return;
    this.selectedDays.set(days);
    this.load();
  }

  private startPollingIfNeeded(): void {
    const hasPending = (this.data()?.recentFeedbacks ?? []).some(
      f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
    );
    if (!hasPending || this.pollSubscription) return;

    const projectId = this.currentProject()?.id;
    let pollCount = 0;
    const MAX_POLLS = 40;

    this.pollSubscription = interval(3000).pipe(
      switchMap(() => this.overviewService.getDashboard(projectId, this.selectedDays())),
      takeWhile(data => {
        pollCount++;
        return data.recentFeedbacks.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        ) && pollCount < MAX_POLLS;
      }, true)
    ).subscribe({
      next: data => {
        this.data.set(data);
        const stillPending = data.recentFeedbacks.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        );
        if (!stillPending || pollCount >= MAX_POLLS) {
          this.pollSubscription?.unsubscribe();
          this.pollSubscription = undefined;
          this.quotaState.refresh();
        }
      }
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getCategoryLabel(category: string): string {
    const labels: Record<string, string> = {
      Bug: '🐛 Bug', FeatureRequest: '✨ Fonctionnalité',
      Question: '❓ Question', Uncategorized: '📝 Non catégorisé',
    };
    return labels[category] ?? category;
  }

  getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      Bug: '#F43F5E', FeatureRequest: '#8B5CF6',
      Question: '#3B82F6', Uncategorized: '#94A3B8',
    };
    return colors[category] ?? '#94A3B8';
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

  getCategoryBarWidth(percent: number): number {
    const max = Math.max(...this.categoryStats().map(c => c.percent), 1);
    return Math.round((percent / max) * 100);
  }

  getGrowthLabel(): string {
    const g = this.stats().growthPercent;
    if (g === 0) return '';
    return g > 0 ? `+${g}%` : `${g}%`;
  }

  getGrowthClass(): string {
    const g = this.stats().growthPercent;
    if (g > 0) return 'growth--up';
    if (g < 0) return 'growth--down';
    return '';
  }

  trackByDate(_: number, item: TrendPoint):    string { return item.date; }
  trackById(_:   number, item: RecentFeedback): string { return item.id;   }
}
