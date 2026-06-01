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
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';


@Component({
  selector: 'app-overview',
  imports: [CommonModule, DatePipe, RouterLink, BaseChartDirective],
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
    resolvedCount: 0, highPriorityCount: 0, pendingAiCount: 0, 
    growthPercent: 0, resolvedRate: 0, previousPeriodTotal: 0, resolvedRateDelta: 0,
    previousResolvedRate: 0, averagePerDay: 0, averageResolutionDays: null
  });

  readonly categoryStats = computed(() => this.data()?.categoryStats ?? []);
  readonly projectStats  = computed(() => this.data()?.projectStats  ?? []);
  readonly autoInsights = computed(() => this.data()?.autoInsights ?? null);
  readonly hasDataInPeriod = computed(() => this.data()?.hasDataInPeriod ?? true);
  readonly statusStats  = computed(() => this.data()?.statusStats  ?? []);


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

  // données pour Chart.js
  readonly chartData = computed<ChartData<'line'>>(() => {
    const t = this.data()?.trends ?? [];
    return {
      labels: t.map(p => {
        const d = new Date(p.date);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      }),
      datasets: [{
        data:            t.map(p => p.count),
        borderColor:     '#0F0F11',
        backgroundColor: 'rgba(15, 15, 17, 0.05)',
        borderWidth:     1.5,
        pointRadius:     0,
        pointHoverRadius: 4,
        pointHoverBackgroundColor: '#0F0F11',
        fill:            true,
        tension:         0.4,  // courbe lissée
      }]
    };
  });

  readonly chartOptions: ChartOptions<'line'> = {
    responsive:          true,
    maintainAspectRatio: false,
    animation:           { duration: 400 },
    plugins: {
      legend:  { display: false },
      tooltip: {
        mode:      'index',
        intersect: false,
        backgroundColor: '#0F0F11',
        titleColor:      'rgba(255,255,255,0.5)',
        bodyColor:       '#fff',
        titleFont:       { size: 11 },
        bodyFont:        { size: 13, weight: 'bold' },
        padding:         10,
        displayColors:   false,
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (item)  => `${item.raw} feedback${Number(item.raw) > 1 ? 's' : ''}`,
        }
      }
    },
    scales: {
      x: {
        grid:   { display: false },
        border: { display: false },
        ticks:  {
          color:    '#94A3B8',
          font:     { size: 11 },
          maxTicksLimit: 8,
          maxRotation: 0,
        }
      },
      y: {
        grid:   { color: 'rgba(0,0,0,0.04)' },
        border: { display: false },
        ticks:  {
          color:     '#94A3B8',
          font:      { size: 11 },
          precision: 0,
          maxTicksLimit: 4,
        },
        min: 0,
      }
    }
  };

  readonly donutData = computed<ChartData<'doughnut'>>(() => {
    const s = this.statusStats();
    return {
      labels: ['À traiter', 'En cours', 'Résolus'],
      datasets: [{
        data:            [
          s.find(x => x.status === 'Todo')?.count       ?? 0,
          s.find(x => x.status === 'InProgress')?.count ?? 0,
          s.find(x => x.status === 'Done')?.count       ?? 0,
        ],
        backgroundColor: ['#F59E0B', '#8B5CF6', '#16A34A'],
        borderWidth:     0,
        hoverOffset:     4,
      }]
    };
  });

  readonly donutOptions: ChartOptions<'doughnut'> = {
    responsive:          true,
    maintainAspectRatio: false,
    cutout:              '72%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F0F11',
        titleColor:      'rgba(255,255,255,0.5)',
        bodyColor:       '#fff',
        bodyFont:        { size: 13, weight: 'bold' },
        padding:         10,
        displayColors:   true,
        callbacks: {
          label: (item) => ` ${item.label} : ${item.raw}`
        }
      }
    }
  };


  // ── Empty state ───────────────────────────────────────────────────────────
  // Modifier isEmpty : seulement si aucune donnée du tout (jamais)
  readonly isEmpty = computed(() =>
    !this.loading() && !this.error() &&
    !this.data()?.hasAnyFeedbacks
  );

  // état "aucune donnée sur la période" (données historiques existent mais pas sur la période)
  readonly isEmptyPeriod = computed(() =>
    !this.loading() && !this.error() &&
    (this.data()?.hasAnyFeedbacks ?? false) &&
    !(this.data()?.hasDataInPeriod ?? true)
  );

  // ─── Sparkline ────────────────────────────────────────────────────────────
  readonly sparkline7 = computed(() => (this.data()?.trends ?? []).slice(-7));
  readonly sparklineMax = computed(() =>
    Math.max(...this.trends().map(t => t.count), 1)
  );

  // tous les points de la période pour le graphique volume
  readonly trends = computed(() => this.data()?.trends ?? []);

  // QueryParams pour les liens filtrés
  readonly todoParams    = { status: 'Todo' };
  readonly urgentParams  = { status: 'Todo', priority: 'High' };


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

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      Todo: 'À traiter', InProgress: 'En cours', Done: 'Résolus'
    };
    return map[status] ?? status;
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
    const prev = this.stats().previousPeriodTotal;
    const total = this.stats().totalFeedbacks;
    if (g === null) return prev === 0 && total > 0 ? 'Première activité' : '';
    if (g === 0) return `${prev} précédemment`;
    const diff = total - prev;
    const sign = diff > 0 ? '+' : '';
    return `${g > 0 ? '+' : ''}${g}% (${sign}${diff} vs ${prev})`;
  }

  getGrowthClass(): string {
    const g = this.stats().growthPercent;
    if (g === null) return 'growth--new';
    if (g > 0) return 'growth--up';
    if (g < 0) return 'growth--down';
    return '';
  }

  getResolvedDeltaLabel(): string {
    const d = this.stats().resolvedRateDelta;
    if (d === null) return '';
    return d >= 0 ? `↑ +${d} pts` : `↓ ${d} pts`;
  }

  getResolvedDeltaClass(): string {
    const d = this.stats().resolvedRateDelta;
    if (d === null || d === 0) return '';
    return d > 0 ? 'growth--up' : 'growth--down';
  }

  trackByDate(_: number, item: TrendPoint):    string { return item.date; }
  trackById(_:   number, item: RecentFeedback): string { return item.id;   }
}
