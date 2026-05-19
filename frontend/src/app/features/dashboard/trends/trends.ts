import { Component, OnInit, inject, signal, computed, ElementRef, AfterViewInit, ViewChild } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { TrendsService } from './trends.service';
import { TrendsData, Period, ChartType, TrendPoint } from './trends.types';
import { RouterLink } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
import { Paywall } from '../../../shared/components/paywall/paywall';

@Component({
  selector: 'app-trends',
  imports: [CommonModule, DatePipe, RouterLink, Paywall],
  templateUrl: './trends.html',
  styleUrl: './trends.scss',
})
export class Trends implements OnInit, AfterViewInit {
  private readonly service = inject(TrendsService);
  private readonly userService = inject(UserService);

  @ViewChild('lineCanvas') lineCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('barCanvas') barCanvas!: ElementRef<HTMLCanvasElement>;

  // ─── State ────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  data = signal<TrendsData | null>(null);
  period = signal<Period>(30);
  chartType = signal<ChartType>('bar');

  readonly periods: { value: Period; label: string }[] = [
    { value: 7, label: '7 jours' },
    { value: 30, label: '30 jours' },
    { value: 90, label: '90 jours' },
  ];

  // ─── Accès plan ───────────────────────────────────────────────────────────
  readonly isPro = computed(() => {
    const plan = this.userService.profile()?.plan ?? 'Free';
    return plan === 'Pro' || plan === 'Team';
  });


  // ─── Computed ─────────────────────────────────────────────
  readonly summary = computed(() => this.data()?.summary);
  readonly volume = computed(() => this.data()?.dailyVolume ?? []);
  readonly categories = computed(() => this.data()?.categoryBreakdown ?? []);
  readonly priorities = computed(() => this.data()?.priorityBreakdown ?? []);

  readonly maxVolume = computed(() =>
    Math.max(...this.volume().map(d => d.count), 1));

  readonly growthPositive = computed(() =>
    (this.summary()?.growthRate ?? 0) >= 0);

  readonly growthLabel = computed(() => {
    const rate = this.summary()?.growthRate ?? 0;
    return rate >= 0 ? `+${rate}%` : `${rate}%`;
  });

  // ─── Chart path pour la courbe SVG ───────────────────────
  readonly linePath = computed(() => {
    const points = this.volume();
    if (points.length < 2) return '';
    return this.buildLinePath(points, 600, 160);
  });

  readonly areaPath = computed(() => {
    const points = this.volume();
    if (points.length < 2) return '';
    return this.buildAreaPath(points, 600, 160);
  });

  readonly linePoints = computed(() => {
    const points = this.volume();
    return this.buildPoints(points, 600, 160);
  });

  // ─── Lifecycle ────────────────────────────────────────────
  ngOnInit(): void { this.load(); }
  ngAfterViewInit(): void { }

  load(): void {
    if (!this.isPro()) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');

    this.service.get(this.period()).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les tendances.');
        this.loading.set(false);
      }
    });
  }

  setPeriod(p: Period): void {
    this.period.set(p);
    this.load();
  }

  setChartType(t: ChartType): void {
    this.chartType.set(t);
  }

  // ─── SVG helpers ──────────────────────────────────────────
  private buildPoints(
    points: TrendPoint[], w: number, h: number
  ): { x: number; y: number; count: number; date: string }[] {
    const max = Math.max(...points.map(p => p.count), 1);
    const pad = 10;
    const step = (w - pad * 2) / Math.max(points.length - 1, 1);

    return points.map((p, i) => ({
      x: pad + i * step,
      y: h - pad - ((p.count / max) * (h - pad * 2)),
      count: p.count,
      date: p.date,
    }));
  }

  private buildLinePath(points: TrendPoint[], w: number, h: number): string {
    const pts = this.buildPoints(points, w, h);
    if (pts.length < 2) return '';

    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
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

  // ─── Helpers ──────────────────────────────────────────────
  getCategoryColor(category: string): string {
    const map: Record<string, string> = {
      Bug: '#F43F5E',
      FeatureRequest: '#3B82F6',
      Question: '#F59E0B',
      Uncategorized: '#9CA3AF',
    };
    return map[category] ?? '#9CA3AF';
  }

  getCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      Bug: '🐛 Bug',
      FeatureRequest: '✨ Fonctionnalité',
      Question: '❓ Question',
      Uncategorized: '📝 Autre',
    };
    return map[category] ?? category;
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

  getPriorityLabel(priority: string): string {
    const map: Record<string, string> = {
      Critical: '🔴 Critique',
      High: '🟠 Haute',
      Normal: '🔵 Normale',
      Low: '⚪ Basse',
    };
    return map[priority] ?? priority;
  }

  formatPeakDate(date: string): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long'
    });
  }

  getBarHeight(count: number): number {
    return Math.round((count / this.maxVolume()) * 100);
  }

  showLabel(index: number): boolean {
    const total = this.volume().length;
    if (total <= 7) return true;
    if (total <= 30) return index % 5 === 0 || index === total - 1;
    return index % 15 === 0 || index === total - 1;
  }

  trackByDate(_: number, item: TrendPoint): string {
    return item.date;
  }
}