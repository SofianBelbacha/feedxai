import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';

import { TrendsService } from './trends.service';
import { TrendsData, PeriodDays, CategoryEvolution } from './trends.types';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';

@Component({
  selector: 'app-trends',
  imports: [CommonModule, RouterLink, BaseChartDirective],
  templateUrl: './trends.html',
  styleUrl: './trends.scss',
})
export class Trends implements OnInit {

  private readonly service = inject(TrendsService);
  private readonly ctx = inject(DashboardContextService);

  // ── State ──────────────────────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  data = signal<TrendsData | null>(null);
  selectedDays = signal<PeriodDays>(30);
  filterCat = signal<string>('');
  filterPri = signal<string>('');

  readonly currentProject = this.ctx.selectedProject;

  readonly periods: { label: string; value: PeriodDays }[] = [
    { label: '7j', value: 7 },
    { label: '30j', value: 30 },
    { label: '90j', value: 90 },
    { label: '6 mois', value: 180 },
    { label: '1 an', value: 365 },
  ];

  readonly categories = ['Bug', 'FeatureRequest', 'Question', 'Uncategorized'];
  readonly priorities = ['Critical', 'High', 'Normal', 'Low'];

  // ── Computed ───────────────────────────────────────────────────────────────
  readonly volume = computed(() => this.data()?.volume);
  readonly cats = computed(() => this.data()?.categories ?? []);
  readonly emerging = computed(() => this.data()?.emergingCategories ?? []);
  readonly projects = computed(() => this.data()?.topProjects ?? []);
  readonly backlog = computed(() => this.data()?.backlog);
  readonly resolution = computed(() => this.data()?.resolution);
  readonly alerts = computed(() => this.data()?.alerts ?? []);

  // ── Chart : Volume (deux séries) ──────────────────────────────────────────
  readonly volumeChartData = computed<ChartData<'line'>>(() => {
    const v = this.volume();
    if (!v) return { labels: [], datasets: [] };

    const labels = v.received.map(p => {
      const d = new Date(p.date);
      return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    });

    return {
      labels,
      datasets: [
        {
          label: 'Reçus',
          data: v.received.map(p => p.count),
          borderColor: '#0F0F11',
          backgroundColor: 'rgba(15,15,17,0.06)',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Résolus',
          data: v.resolved.map(p => p.count),
          borderColor: '#16A34A',
          backgroundColor: 'rgba(22,163,74,0.06)',
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: true,
          tension: 0.4,
        },
      ]
    };
  });

  readonly volumeChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: { boxWidth: 10, boxHeight: 10, borderRadius: 5, useBorderRadius: true, font: { size: 12 }, color: '#64748B' }
      },
      tooltip: {
        backgroundColor: '#0F0F11',
        titleColor: 'rgba(255,255,255,0.5)',
        bodyColor: '#fff',
        padding: 12,
        displayColors: true,
        callbacks: {
          label: (item) => ` ${item.dataset.label} : ${item.raw}`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: '#94A3B8', font: { size: 11 }, maxTicksLimit: 10, maxRotation: 0 }
      },
      y: {
        grid: { color: 'rgba(0,0,0,0.04)' },
        border: { display: false },
        ticks: { color: '#94A3B8', font: { size: 11 }, precision: 0, maxTicksLimit: 5 },
        min: 0,
      }
    }
  };

  // ── Chart : Temps de résolution ───────────────────────────────────────────
  readonly resolutionChartData = computed<ChartData<'line'>>(() => {
    const r = this.resolution();
    if (!r?.dailyAverages.length) return { labels: [], datasets: [] };

    return {
      labels: r.dailyAverages.map(p => {
        const d = new Date(p.date);
        return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      }),
      datasets: [{
        label: 'Jours',
        data: r.dailyAverages.map(p => p.count),
        borderColor: '#8B5CF6',
        backgroundColor: 'rgba(139,92,246,0.06)',
        borderWidth: 1.5,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
        tension: 0.4,
      }]
    };
  });

  readonly resolutionChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#0F0F11',
        bodyColor: '#fff',
        padding: 10,
        displayColors: false,
        callbacks: { label: (item) => ` ${item.raw} jours` }
      }
    },
    scales: {
      x: { grid: { display: false }, border: { display: false }, ticks: { color: '#94A3B8', font: { size: 11 }, maxTicksLimit: 6 } },
      y: { grid: { color: 'rgba(0,0,0,0.04)' }, border: { display: false }, ticks: { color: '#94A3B8', font: { size: 11 }, precision: 1 }, min: 0 }
    }
  };

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.service.getTrends({
      days: this.selectedDays(),
      projectId: this.currentProject()?.id,
      category: this.filterCat() || undefined,
      priority: this.filterPri() || undefined,
    }).subscribe({
      next: data => { this.data.set(data); this.loading.set(false); },
      error: () => { this.error.set('Impossible de charger les tendances.'); this.loading.set(false); }
    });
  }

  setPeriod(days: PeriodDays): void {
    if (this.selectedDays() === days) return;
    this.selectedDays.set(days);
    this.load();
  }

  setFilter(type: 'cat' | 'pri', value: string): void {
    if (type === 'cat') this.filterCat.set(value);
    else this.filterPri.set(value);
    this.load();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  getCategoryLabel(cat: string): string {
    const map: Record<string, string> = {
      Bug: '🐛 Bugs', FeatureRequest: '✨ Features',
      Question: '❓ Questions', Uncategorized: '📝 Autres'
    };
    return map[cat] ?? cat;
  }

  getCategoryColor(cat: string): string {
    const map: Record<string, string> = {
      Bug: '#F43F5E', FeatureRequest: '#8B5CF6',
      Question: '#3B82F6', Uncategorized: '#94A3B8'
    };
    return map[cat] ?? '#94A3B8';
  }

  getDeltaClass(delta: number | null): string {
    if (delta === null) return '';
    if (delta > 0) return 'delta--up';
    if (delta < 0) return 'delta--down';
    return '';
  }

  getDeltaLabel(delta: number | null): string {
    if (delta === null) return 'Nouveau';
    return delta >= 0 ? `+${delta}%` : `${delta}%`;
  }

  getResolutionDeltaLabel(): string {
    const d = this.resolution()?.delta;
    if (d === null || d === undefined) return '';
    return d > 0 ? `+${d}j (dégradé)` : `${d}j (amélioré)`;
  }

  getResolutionDeltaClass(): string {
    const d = this.resolution()?.delta;
    if (!d) return '';
    return d > 0 ? 'delta--up' : 'delta--down';
  }

  getBarWidth(count: number): number {
    const max = Math.max(...this.cats().map(c => c.currentCount), 1);
    return Math.round((count / max) * 100);
  }

  getPrevBarWidth(count: number): number {
    const max = Math.max(...this.cats().map(c => Math.max(c.currentCount, c.previousCount)), 1);
    return Math.round((count / max) * 100);
  }
}