import {
  Component, OnInit, inject,
  signal, computed
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

import { TrendsService } from './trends.service';
import { TrendsData, Period, ChartType, TrendPoint } from './trends.types';
import { UserService } from '../../../core/services/user.service';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';
import { Paywall } from '../../../shared/components/paywall/paywall';

export interface AiInsight {
  type: 'info' | 'warning' | 'success';
  emoji: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-trends',
  standalone: true,
  imports: [CommonModule, DatePipe, RouterLink, Paywall],
  templateUrl: './trends.html',
  styleUrl: './trends.scss',
})
export class Trends implements OnInit {

  // ─── Services ─────────────────────────────────────────────────────────────
  private readonly service = inject(TrendsService);
  private readonly userService = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);

  // ─── State ────────────────────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  data = signal<TrendsData | null>(null);
  period = signal<Period>(30);
  chartType = signal<ChartType>('bar');

  readonly periods: { value: Period; label: string }[] = [
    { value: 7, label: '7 j' },
    { value: 30, label: '30 j' },
    { value: 90, label: '90 j' },
  ];

  // ─── Plan ─────────────────────────────────────────────────────────────────
  readonly isPro = computed(() => {
    const plan = this.userService.profile()?.plan ?? 'Free';
    return plan === 'Pro' || plan === 'Team';
  });

  readonly currentProject = this.dashboardContext.selectedProject;

  // ─── Computed — données ───────────────────────────────────────────────────
  readonly summary = computed(() => this.data()?.summary);
  readonly volume = computed(() => this.data()?.dailyVolume ?? []);
  readonly categories = computed(() => this.data()?.categoryBreakdown ?? []);
  readonly priorities = computed(() => this.data()?.priorityBreakdown ?? []);
  readonly maxVolume = computed(() => Math.max(...this.volume().map(d => d.count), 1));

  readonly growthPositive = computed(() => (this.summary()?.growthRate ?? 0) >= 0);
  readonly growthLabel = computed(() => {
    const r = this.summary()?.growthRate ?? 0;
    return r >= 0 ? `+${r}%` : `${r}%`;
  });

  // ─── Données suffisantes pour afficher les graphiques ────────────────────
  // Active dès J1 : même 2 feedbacks génèrent des insights
  readonly totalFeedbacks = computed(() => this.summary()?.totalPeriod ?? 0);
  readonly hasData = computed(() => this.totalFeedbacks() > 0);
  readonly hasEnoughData = computed(() => this.totalFeedbacks() >= 5);

  // ─── AI Insights — calculés depuis les données brutes ────────────────────
  readonly dominantCategory = computed(() => {
    const cats = this.categories();
    if (!cats.length) return null;
    return cats.reduce((a, b) => a.count > b.count ? a : b);
  });

  readonly dominantPriority = computed(() => {
    const pris = this.priorities();
    if (!pris.length) return null;
    return pris.reduce((a, b) => a.count > b.count ? a : b);
  });

  readonly aiInsights = computed((): AiInsight[] => {
    const insights: AiInsight[] = [];
    const total = this.totalFeedbacks();
    const summary = this.summary();
    const domCat = this.dominantCategory();
    const domPri = this.dominantPriority();
    const growth = summary?.growthRate ?? 0;

    if (!total) return insights;

    // Insight 1 : catégorie dominante
    if (domCat && domCat.percentage >= 40) {
      const labels: Record<string, string> = {
        Bug: 'Bug', FeatureRequest: 'Fonctionnalité',
        Question: 'Question', Uncategorized: 'Non catégorisé',
      };
      const emojis: Record<string, string> = {
        Bug: '🐛', FeatureRequest: '✨', Question: '❓', Uncategorized: '📝',
      };
      insights.push({
        type: domCat.category === 'Bug' ? 'warning' : 'info',
        emoji: emojis[domCat.category] ?? '📝',
        title: `${domCat.percentage}% de ${labels[domCat.category] ?? domCat.category}`,
        desc: domCat.category === 'Bug'
          ? 'Les bugs dominent vos retours — prioriser la correction.'
          : `La catégorie "${labels[domCat.category] ?? domCat.category}" représente la majorité de vos retours.`,
      });
    }

    // Insight 2 : croissance forte
    if (growth >= 30) {
      insights.push({
        type: 'warning',
        emoji: '📈',
        title: `Volume en hausse de ${growth}%`,
        desc: 'Le volume de feedbacks a fortement augmenté vs la période précédente — vérifiez si un problème est à l\'origine.',
      });
    } else if (growth <= -20) {
      insights.push({
        type: 'success',
        emoji: '📉',
        title: `Volume en baisse de ${Math.abs(growth)}%`,
        desc: 'Moins de retours cette période — signe positif si les bugs ont été corrigés.',
      });
    }

    // Insight 3 : priorité critique dominante
    const criticalPri = this.priorities().find(p => p.priority === 'Critical');
    if (criticalPri && criticalPri.percentage >= 25) {
      insights.push({
        type: 'warning',
        emoji: '🚨',
        title: `${criticalPri.percentage}% de feedbacks critiques`,
        desc: 'Une part importante de vos retours est classée Critique — traitement urgent recommandé.',
      });
    }

    // Insight 4 : pic détecté
    const peak = summary?.peakCount ?? 0;
    const avg = summary?.avgPerDay ?? 0;
    if (peak > 0 && avg > 0 && peak >= avg * 3) {
      insights.push({
        type: 'info',
        emoji: '⚡',
        title: `Pic à ${peak} feedbacks`,
        desc: `Un pic anormal a été détecté — ${Math.round(peak / avg)}× la moyenne quotidienne.`,
      });
    }

    // Insight par défaut si données insuffisantes
    if (insights.length === 0 && total > 0) {
      insights.push({
        type: 'info',
        emoji: '🤖',
        title: 'Analyse en cours',
        desc: `${total} feedback${total > 1 ? 's' : ''} collecté${total > 1 ? 's' : ''} sur cette période. Continuez à recevoir des retours pour obtenir des insights plus précis.`,
      });
    }

    return insights.slice(0, 3); // max 3 insights affichés
  });

  // ─── SVG — courbe ─────────────────────────────────────────────────────────
  readonly linePath = computed(() => {
    const pts = this.volume();
    return pts.length < 2 ? '' : this.buildLinePath(pts, 600, 160);
  });

  readonly areaPath = computed(() => {
    const pts = this.volume();
    return pts.length < 2 ? '' : this.buildAreaPath(pts, 600, 160);
  });

  readonly linePoints = computed(() =>
    this.buildPoints(this.volume(), 600, 160)
  );

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void { this.load(); }

  load(): void {
    if (!this.isPro()) { this.loading.set(false); return; }
    this.loading.set(true);
    this.error.set('');

    const projectId = this.currentProject()?.id;

    this.service.get(this.period(), projectId).subscribe({
      next: data => { this.data.set(data); this.loading.set(false); },
      error: () => {
        this.error.set('Impossible de charger les tendances.');
        this.loading.set(false);
      }
    });
  }

  setPeriod(p: Period): void { this.period.set(p); this.load(); }
  setChartType(t: ChartType): void { this.chartType.set(t); }

  // ─── SVG helpers ──────────────────────────────────────────────────────────
  private buildPoints(
    points: TrendPoint[], w: number, h: number
  ): { x: number; y: number; count: number; date: string }[] {
    const max = Math.max(...points.map(p => p.count), 1);
    const pad = 10;
    const step = (w - pad * 2) / Math.max(points.length - 1, 1);
    return points.map((p, i) => ({
      x: pad + i * step,
      y: h - pad - (p.count / max) * (h - pad * 2),
      count: p.count,
      date: p.date,
    }));
  }

  private buildLinePath(points: TrendPoint[], w: number, h: number): string {
    const pts = this.buildPoints(points, w, h);
    if (pts.length < 2) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], curr = pts[i];
      const cpx = (prev.x + curr.x) / 2;
      d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
    }
    return d;
  }

  private buildAreaPath(points: TrendPoint[], w: number, h: number): string {
    const line = this.buildLinePath(points, w, h);
    const pts = this.buildPoints(points, w, h);
    if (!line || pts.length < 2) return '';
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L ${last.x} ${h} L ${first.x} ${h} Z`;
  }

  // ─── Helpers visuels ──────────────────────────────────────────────────────
  getBarHeight(count: number): number {
    return Math.max(Math.round((count / this.maxVolume()) * 100), count > 0 ? 4 : 0);
  }

  showLabel(index: number): boolean {
    const len = this.volume().length;
    if (len <= 10) return true;
    if (len <= 30) return index % 3 === 0;
    return index % 7 === 0 || index === len - 1;
  }

  formatPeakDate(date: string): string {
    if (!date) return '—';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  getCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      Bug: '🐛 Bug',
      FeatureRequest: '✨ Fonctionnalité',
      Question: '❓ Question',
      Uncategorized: '📝 Non catégorisé',
    };
    return map[category] ?? category;
  }

  getCategoryColor(category: string): string {
    const map: Record<string, string> = {
      Bug: '#F43F5E',
      FeatureRequest: '#3B82F6',
      Question: '#F59E0B',
      Uncategorized: '#9CA3AF',
    };
    return map[category] ?? '#9CA3AF';
  }

  getPriorityLabel(priority: string): string {
    const map: Record<string, string> = {
      Critical: '🔴 Critique',
      High: '🟠 Haute',
      Normal: '🔵 Normale',
      Low: '⚪ Basse',
    };
    return map[priority] ?? priority;
  }

  getPriorityColor(priority: string): string {
    const map: Record<string, string> = {
      Critical: '#F43F5E',
      High: '#F59E0B',
      Normal: '#3B82F6',
      Low: '#9CA3AF',
    };
    return map[priority] ?? '#9CA3AF';
  }

  trackByDate(_: number, item: TrendPoint): string { return item.date; }
}