import {
  Component, OnInit, OnDestroy, inject, signal, computed,
  effect, Injector
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Subject, debounceTime, distinctUntilChanged,
  interval, switchMap, takeWhile, Subscription
} from 'rxjs';
import { FeedbacksService } from './feedbacks.service';
import {
  Feedback, FeedbackCategory, FeedbackFilters,
  FeedbackPriority, FeedbackStatus
} from './feedbacks.types';
import { UserService } from '../../../core/services/user.service';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';
import { FeedbackDrawer } from '../../../shared/components/feedback-drawer/feedback-drawer';

@Component({
  selector: 'app-feedbacks',
  imports: [CommonModule, FormsModule, DatePipe, FeedbackDrawer],
  templateUrl: './feedbacks.html',
  styleUrl: './feedbacks.scss',
})
export class Feedbacks implements OnInit, OnDestroy {
  private readonly service = inject(FeedbacksService);
  private readonly injector = inject(Injector);
  private readonly userService = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly search$ = new Subject<string>();
  private pollSub?: Subscription;

  readonly isPro = computed(() => this.userService.profile()?.plan !== 'Free');

  // ─── State ────────────────────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  feedbacks = signal<Feedback[]>([]);
  totalCount = signal(0);
  dragging = signal<Feedback | null>(null);
  exporting = signal(false);

  // ─── Drawer ───────────────────────────────────────────────────────────────
  selectedFeedback = signal<Feedback | null>(null);
  drawerOpen = signal(false);

  // ─── Filtres ──────────────────────────────────────────────────────────────
  searchValue = signal('');
  categoryFilter = signal<FeedbackCategory | ''>('');
  priorityFilter = signal<FeedbackPriority | ''>('');
  currentPage = signal(1);
  readonly pageSize = 50;

  // ─── Colonnes kanban ──────────────────────────────────────────────────────
  readonly columns: { status: FeedbackStatus; label: string; color: string }[] = [
    { status: 'Todo', label: 'À traiter', color: 'amber' },
    { status: 'InProgress', label: 'En cours', color: 'violet' },
    { status: 'Done', label: 'Résolus', color: 'emerald' },
  ];

  readonly todoFeedbacks = computed(() => this.feedbacks().filter(f => f.status === 'Todo'));
  readonly inProgressFeedbacks = computed(() => this.feedbacks().filter(f => f.status === 'InProgress'));
  readonly doneFeedbacks = computed(() => this.feedbacks().filter(f => f.status === 'Done'));

  readonly hasActiveFilters = computed(() =>
    !!this.searchValue() || !!this.categoryFilter() || !!this.priorityFilter()
  );

  readonly categories: FeedbackCategory[] = ['Bug', 'FeatureRequest', 'Question', 'Uncategorized'];
  readonly priorities: FeedbackPriority[] = ['Critical', 'High', 'Normal', 'Low'];

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // effect() déclaré dans ngOnInit avec { injector } — compatible Angular 18/19.
    // Dans le constructor, le contexte d'injection n'est plus garanti pour effect()
    // depuis Angular 18, ce qui génère une erreur en mode strict.
    effect(() => {
      const project = this.dashboardContext.selectedProject();

      if (!project?.id) {
        this.feedbacks.set([]);
        this.totalCount.set(0);
        this.loading.set(false);
        return;
      }

      this.currentPage.set(1);
      this.load();
    }, { injector: this.injector });

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.currentPage.set(1);
      this.load();
    });
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.search$.complete();
  }

  // ─── Chargement ───────────────────────────────────────────────────────────
  get projectId(): string {
    return this.dashboardContext.selectedProject()?.id ?? '';
  }

  load(): void {
    if (!this.projectId) {
      this.feedbacks.set([]);
      this.totalCount.set(0);
      this.loading.set(false);
      this.error.set('Aucun projet sélectionné.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const filters: FeedbackFilters = {
      search: this.searchValue(),
      category: this.categoryFilter() || undefined,
      priority: this.priorityFilter() || undefined,
      page: this.currentPage(),
      pageSize: this.pageSize,
    };

    this.service.getAll(this.projectId, filters).subscribe({
      next: (result) => {
        this.feedbacks.set(result.data);
        this.totalCount.set(result.meta.total);
        this.loading.set(false);
        this.startPollingIfNeeded();
      },
      error: () => {
        this.error.set('Impossible de charger les feedbacks.');
        this.loading.set(false);
      }
    });
  }

  // ─── Polling IA ───────────────────────────────────────────────────────────
  private startPollingIfNeeded(): void {
    const hasPending = this.feedbacks().some(
      f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
    );

    if (!hasPending || this.pollSub) return;

    const filters: FeedbackFilters = {
      search: this.searchValue(),
      category: this.categoryFilter() || undefined,
      priority: this.priorityFilter() || undefined,
      page: this.currentPage(),
      pageSize: this.pageSize,
    };

    this.pollSub = interval(3000).pipe(
      switchMap(() => this.service.getAll(this.projectId, filters)),
      takeWhile(result =>
        result.data.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        ), true)
    ).subscribe({
      next: (result) => {
        this.feedbacks.set(result.data);
        const stillPending = result.data.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        );
        if (!stillPending) {
          this.pollSub?.unsubscribe();
          this.pollSub = undefined;
        }
      }
    });
  }

  // ─── Filtres ──────────────────────────────────────────────────────────────
  onSearch(value: string): void {
    this.searchValue.set(value);
    this.search$.next(value);
  }

  onCategoryChange(value: string): void {
    this.categoryFilter.set(value as FeedbackCategory | '');
    this.currentPage.set(1);
    this.load();
  }

  onPriorityChange(value: string): void {
    this.priorityFilter.set(value as FeedbackPriority | '');
    this.currentPage.set(1);
    this.load();
  }

  clearFilters(): void {
    this.searchValue.set('');
    this.categoryFilter.set('');
    this.priorityFilter.set('');
    this.currentPage.set(1);
    this.load();
  }

  // ─── Drag & Drop ──────────────────────────────────────────────────────────
  onDragStart(feedback: Feedback): void { this.dragging.set(feedback); }
  onDragEnd(): void { this.dragging.set(null); }

  onDrop(status: FeedbackStatus): void {
    const fb = this.dragging();
    if (!fb || fb.status === status) { this.dragging.set(null); return; }

    this.feedbacks.update(list => list.map(f => f.id === fb.id ? { ...f, status } : f));
    this.dragging.set(null);

    this.service.updateStatus(this.projectId, fb.id, status).subscribe({
      error: () => {
        this.feedbacks.update(list =>
          list.map(f => f.id === fb.id ? { ...f, status: fb.status } : f)
        );
        this.error.set('Impossible de mettre à jour le statut.');
      }
    });
  }

  onDragOver(event: DragEvent): void { event.preventDefault(); }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getCategoryLabel(category: string): string {
    const map: Record<string, string> = {
      Bug: '🐛 Bug', FeatureRequest: '✨ Feature',
      Question: '❓ Question', Uncategorized: '📝 Autre',
    };
    return map[category] ?? category;
  }

  getCategoryFilterLabel(category: string): string {
    const map: Record<string, string> = {
      Bug: '🐛 Bug', FeatureRequest: '✨ Fonctionnalité',
      Question: '❓ Question', Uncategorized: '📝 Non catégorisé',
    };
    return map[category] ?? category;
  }

  getPriorityLabel(priority: string): string {
    const map: Record<string, string> = {
      Critical: '🔴 Critique', High: '🟠 Haute',
      Normal: '🔵 Normale', Low: '⚪ Basse',
    };
    return map[priority] ?? priority;
  }

  getColumnFeedbacks(status: FeedbackStatus): Feedback[] {
    return this.feedbacks().filter(f => f.status === status);
  }

  trackById(_: number, item: Feedback): string { return item.id; }

  exportCsv(): void {
    if (this.exporting()) return;
    this.exporting.set(true);

    this.service.exportCsv(this.projectId, {
      category: this.categoryFilter() || undefined,
      priority: this.priorityFilter() || undefined,
    }).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `feedbacks_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: (err) => {
        this.exporting.set(false);
        this.error.set(
          err.status === 403
            ? 'L\'export CSV est disponible à partir du plan Pro.'
            : 'Erreur lors de l\'export. Réessayez.'
        );
      }
    });
  }

  // ─── Drawer ───────────────────────────────────────────────────────────────
  openDrawer(feedback: Feedback): void {
    this.selectedFeedback.set(feedback);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    // On laisse selectedFeedback en place pendant l'animation de fermeture (300ms)
    setTimeout(() => this.selectedFeedback.set(null), 320);
  }

  onDrawerStatusChanged(event: { id: string; status: FeedbackStatus }): void {
    this.feedbacks.update(list =>
      list.map(f => f.id === event.id ? { ...f, status: event.status } : f)
    );
    // Met à jour aussi le feedback ouvert dans le drawer
    this.selectedFeedback.update(f =>
      f?.id === event.id ? { ...f, status: event.status } : f
    );
  }

  // helper sentiment
  getSentimentEmoji(sentiment: string): string {
    const map: Record<string, string> = {
      Positive: '😊',
      Neutral: '😐',
      Negative: '😞',
      Frustrated: '😤',
    };
    return map[sentiment] ?? '😐';
  }
}