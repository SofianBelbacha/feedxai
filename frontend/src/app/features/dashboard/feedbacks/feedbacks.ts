import {
  Component, OnInit, OnDestroy, inject, signal, computed, effect, Injector
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import {
  CdkDragDrop, CdkDrag, CdkDropList,
  CdkDropListGroup, moveItemInArray, transferArrayItem
} from '@angular/cdk/drag-drop';
import {
  Subject, debounceTime, distinctUntilChanged,
  interval, switchMap, takeWhile, Subscription
} from 'rxjs';
import { FeedbacksService } from './feedbacks.service';
import {
  Feedback, FeedbackCategory, FeedbackFilters,
  FeedbackPriority, FeedbackStatus, SortBy
} from './feedbacks.types';
import { UserService } from '../../../core/services/user.service';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';
import { FeedbackDrawer } from '../../../shared/components/feedback-drawer/feedback-drawer';

type FlowStep = 'collect' | 'analyze' | 'prioritize' | 'build';

@Component({
  selector: 'app-feedbacks',
  imports: [
    CommonModule, DatePipe, FeedbackDrawer,
    CdkDrag, CdkDropList, CdkDropListGroup
  ],
  templateUrl: './feedbacks.html',
  styleUrl: './feedbacks.scss',
})
export class Feedbacks implements OnInit, OnDestroy {
  private readonly service = inject(FeedbacksService);
  private readonly injector = inject(Injector);
  private readonly userService = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly search$ = new Subject<string>();
  private pollSub?: Subscription;

  readonly isPro = computed(() => this.userService.profile()?.plan !== 'Free');

  // ─── State ────────────────────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  feedbacks = signal<Feedback[]>([]);
  totalCount = signal(0);
  exporting = signal(false);

  // Listes Kanban CDK
  todoList = signal<Feedback[]>([]);
  inProgressList = signal<Feedback[]>([]);
  doneList = signal<Feedback[]>([]);

  // ─── Drawer ───────────────────────────────────────────────────────────────
  selectedFeedback = signal<Feedback | null>(null);
  drawerOpen = signal(false);

  // ─── Filtres ──────────────────────────────────────────────────────────────
  searchValue = signal('');
  statusFilter = signal<FeedbackStatus | ''>('');
  categoryFilter = signal<FeedbackCategory | ''>('');
  priorityFilter = signal<FeedbackPriority | ''>('');
  sortBy = signal<SortBy>('recent');
  filterAction = signal(false);
  filterSentiment = signal('');
  filterMinScore = signal<number | null>(null);
  showAiFilters = signal(false);
  criticalMode = signal(false);
  currentPage = signal(1);
  readonly pageSize = 50;

  // ─── Flow step ────────────────────────────────────────────────────────────
  activeFlowStep = signal<FlowStep>('collect');

  readonly flowSteps: { key: FlowStep; label: string; icon: string }[] = [
    { key: 'collect', label: 'Collecter', icon: 'ti-database' },
    { key: 'analyze', label: 'Analyser IA', icon: 'ti-sparkles' },
    { key: 'prioritize', label: 'Prioriser', icon: 'ti-sort-descending' },
    { key: 'build', label: 'Construire', icon: 'ti-hammer' },
  ];

  // ─── Colonnes Kanban ──────────────────────────────────────────────────────
  readonly columns: { status: FeedbackStatus; label: string; colorClass: string }[] = [
    { status: 'Todo', label: 'Nouveau', colorClass: 'col--new' },
    { status: 'InProgress', label: 'En cours', colorClass: 'col--prog' },
    { status: 'Done', label: 'Terminé', colorClass: 'col--done' },
  ];

  // ─── Computed ─────────────────────────────────────────────────────────────
  readonly criticalCount = computed(() =>
    this.feedbacks().filter(f =>
      (f.priorityScore ?? 0) > 80 || f.actionRequired || f.sentiment === 'Frustrated'
    ).length
  );

  readonly pendingAiCount = computed(() =>
    this.feedbacks().filter(f =>
      f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
    ).length
  );

  readonly highPriorityCount = computed(() =>
    this.feedbacks().filter(f =>
      f.priority === 'High' || f.priority === 'Critical'
    ).length
  );

  readonly doneCount = computed(() =>
    this.feedbacks().filter(f => f.status === 'Done').length
  );

  readonly newThisWeek = computed(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    return this.feedbacks().filter(f => new Date(f.createdAt) >= cutoff).length;
  });

  readonly hasActiveFilters = computed(() =>
    !!this.searchValue() || !!this.statusFilter() || !!this.categoryFilter() ||
    !!this.priorityFilter() || this.sortBy() !== 'recent' ||
    this.filterAction() || !!this.filterSentiment() ||
    this.filterMinScore() !== null || this.criticalMode()
  );

  // Vue IA — top topics depuis keyTopics
  readonly topTopics = computed(() => {
    const map = new Map<string, number>();
    this.feedbacks()
      .filter(f => f.keyTopics?.length)
      .forEach(f => f.keyTopics!.forEach(t => map.set(t, (map.get(t) ?? 0) + 1)));
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topic, count]) => ({ topic, count }));
  });

  readonly mainFrustration = computed(() => {
    const frustrated = this.feedbacks().filter(f => f.sentiment === 'Frustrated');
    if (!frustrated.length) return null;
    const byCategory = new Map<string, number>();
    frustrated.forEach(f => byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1));
    const [top] = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
    return top ? { category: top[0], count: top[1] } : null;
  });

  readonly categories: FeedbackCategory[] = ['Bug', 'FeatureRequest', 'Question', 'Uncategorized'];
  readonly priorities: FeedbackPriority[] = ['Critical', 'High', 'Normal', 'Low'];
  readonly sortOptions: { value: SortBy; label: string }[] = [
    { value: 'recent', label: 'Plus récents' },
    { value: 'oldest', label: 'Plus anciens' },
    { value: 'priority', label: 'Priorité' },
    { value: 'score', label: 'Score IA' },
    { value: 'action', label: 'Action requise' },
  ];

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['status']) this.statusFilter.set(params['status']);
      if (params['priority']) this.priorityFilter.set(params['priority']);
      if (params['sort']) this.sortBy.set(params['sort']);
      if (params['critical']) this.criticalMode.set(params['critical'] === 'true');
    });

    effect(() => {
      const project = this.dashboardContext.selectedProject();
      if (!project?.id) {
        this.feedbacks.set([]); this.totalCount.set(0); this.loading.set(false);
        return;
      }
      this.currentPage.set(1);
      this.load();
    }, { injector: this.injector });

    this.search$.pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => { this.currentPage.set(1); this.load(); });
  }

  ngOnDestroy(): void { this.pollSub?.unsubscribe(); this.search$.complete(); }

  // ─── URL sync ─────────────────────────────────────────────────────────────
  private syncUrl(): void {
    const params: Record<string, string> = {};
    if (this.statusFilter()) params['status'] = this.statusFilter()!;
    if (this.priorityFilter()) params['priority'] = this.priorityFilter()!;
    if (this.sortBy() !== 'recent') params['sort'] = this.sortBy();
    if (this.criticalMode()) params['critical'] = 'true';
    this.router.navigate([], { queryParams: params, replaceUrl: true });
  }

  // ─── Chargement ───────────────────────────────────────────────────────────
  get projectId(): string { return this.dashboardContext.selectedProject()?.id ?? ''; }

  load(): void {
    if (!this.projectId) {
      this.feedbacks.set([]); this.totalCount.set(0);
      this.loading.set(false); this.error.set('Aucun projet sélectionné.');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    const filters: FeedbackFilters = {
      search: this.searchValue(),
      category: this.categoryFilter() || undefined,
      priority: this.priorityFilter() || undefined,
      status: this.statusFilter() || undefined,
      sortBy: this.sortBy(),
      page: this.currentPage(),
      pageSize: this.pageSize,
    };
    if (this.criticalMode()) {
      filters.minScore = 80;
    } else {
      if (this.filterAction()) filters.actionRequired = true;
      if (this.filterSentiment()) filters.sentiment = this.filterSentiment();
      if (this.filterMinScore() !== null) filters.minScore = this.filterMinScore()!;
    }

    this.service.getAll(this.projectId, filters).subscribe({
      next: result => {
        this.feedbacks.set(result.data);
        this.totalCount.set(result.meta.total);
        this.updateKanbanLists(result.data);
        this.loading.set(false);
        this.startPollingIfNeeded();
      },
      error: () => { this.error.set('Impossible de charger les feedbacks.'); this.loading.set(false); }
    });
  }

  private updateKanbanLists(feedbacks: Feedback[]): void {
    this.todoList.set(feedbacks.filter(f => f.status === 'Todo'));
    this.inProgressList.set(feedbacks.filter(f => f.status === 'InProgress'));
    this.doneList.set(feedbacks.filter(f => f.status === 'Done'));
  }

  // ─── Polling IA ───────────────────────────────────────────────────────────
  private startPollingIfNeeded(): void {
    const hasPending = this.feedbacks().some(
      f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
    );
    if (!hasPending || this.pollSub) return;

    let pollCount = 0;
    const MAX_POLLS = 40;
    const filters: FeedbackFilters = {
      search: this.searchValue(), category: this.categoryFilter() || undefined,
      priority: this.priorityFilter() || undefined, status: this.statusFilter() || undefined,
      sortBy: this.sortBy(), page: this.currentPage(), pageSize: this.pageSize,
    };

    this.pollSub = interval(3000).pipe(
      switchMap(() => this.service.getAll(this.projectId, filters)),
      takeWhile(result => {
        pollCount++;
        return result.data.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        ) && pollCount < MAX_POLLS;
      }, true)
    ).subscribe({
      next: result => {
        this.feedbacks.set(result.data);
        this.updateKanbanLists(result.data);
        const stillPending = result.data.some(
          f => f.aiAnalysisStatus === 'Pending' || f.aiAnalysisStatus === 'Processing'
        );
        if (!stillPending || pollCount >= MAX_POLLS) {
          this.pollSub?.unsubscribe(); this.pollSub = undefined;
        }
      }
    });
  }

  // ─── CDK Drag & Drop ──────────────────────────────────────────────────────
  onDrop(event: CdkDragDrop<Feedback[]>, targetStatus: FeedbackStatus): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }
    const fb = event.previousContainer.data[event.previousIndex];
    const prevStatus = fb.status;

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex
    );
    this.feedbacks.update(list =>
      list.map(f => f.id === fb.id ? { ...f, status: targetStatus } : f)
    );

    this.service.updateStatus(this.projectId, fb.id, targetStatus).subscribe({
      error: () => {
        transferArrayItem(event.container.data, event.previousContainer.data, event.currentIndex, event.previousIndex);
        this.feedbacks.update(list =>
          list.map(f => f.id === fb.id ? { ...f, status: prevStatus } : f)
        );
        this.error.set('Impossible de mettre à jour le statut.');
      }
    });
  }

  // ─── Filtres ──────────────────────────────────────────────────────────────
  onSearch(value: string): void { this.searchValue.set(value); this.search$.next(value); }

  setStatusFilter(value: FeedbackStatus | ''): void {
    this.statusFilter.set(value); this.currentPage.set(1); this.syncUrl(); this.load();
  }

  onCategoryChange(value: string): void {
    this.categoryFilter.set(value as FeedbackCategory | '');
    this.currentPage.set(1); this.load();
  }

  onPriorityChange(value: string): void {
    this.priorityFilter.set(value as FeedbackPriority | '');
    this.currentPage.set(1); this.syncUrl(); this.load();
  }

  onSortChange(value: string): void {
    this.sortBy.set(value as SortBy);
    this.currentPage.set(1); this.syncUrl(); this.load();
  }

  toggleCriticalMode(): void {
    this.criticalMode.update(v => !v);
    if (this.criticalMode()) {
      this.filterAction.set(false); this.filterSentiment.set(''); this.filterMinScore.set(null);
    }
    this.currentPage.set(1); this.syncUrl(); this.load();
  }

  toggleActionFilter(): void { this.filterAction.update(v => !v); this.currentPage.set(1); this.load(); }

  onSentimentChange(value: string): void { this.filterSentiment.set(value); this.currentPage.set(1); this.load(); }

  clearFilters(): void {
    this.searchValue.set(''); this.statusFilter.set(''); this.categoryFilter.set('');
    this.priorityFilter.set(''); this.sortBy.set('recent'); this.filterAction.set(false);
    this.filterSentiment.set(''); this.filterMinScore.set(null); this.criticalMode.set(false);
    this.currentPage.set(1); this.syncUrl(); this.load();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getListForStatus(status: FeedbackStatus): Feedback[] {
    if (status === 'Todo') return this.todoList();
    if (status === 'InProgress') return this.inProgressList();
    return this.doneList();
  }

  getDropData(status: FeedbackStatus): Feedback[] {
    return this.getListForStatus(status);
  }

  getCategoryLabel(cat: string): string {
    const map: Record<string, string> = {
      Bug: 'Bug', FeatureRequest: 'Fonctionnalité', Question: 'Question', Uncategorized: 'Autre',
    };
    return map[cat] ?? cat;
  }

  getCategoryClass(cat: string): string {
    const map: Record<string, string> = {
      Bug: 'tag-bug', FeatureRequest: 'tag-feat', Question: 'tag-quest', Uncategorized: 'tag-other',
    };
    return map[cat] ?? 'tag-other';
  }

  getPriorityClass(priority: string): string {
    const map: Record<string, string> = {
      Critical: 'pb-crit', High: 'pb-high', Normal: 'pb-med', Low: 'pb-low',
    };
    return map[priority] ?? 'pb-low';
  }

  getPriorityTagClass(priority: string): string {
    const map: Record<string, string> = {
      Critical: 'tag-crit', High: 'tag-high', Normal: 'tag-med', Low: 'tag-low',
    };
    return map[priority] ?? 'tag-low';
  }

  getPriorityLabel(priority: string): string {
    const map: Record<string, string> = {
      Critical: 'Critique', High: 'Haute', Normal: 'Normale', Low: 'Basse',
    };
    return map[priority] ?? priority;
  }

  getSentimentClass(sentiment: string): string {
    const map: Record<string, string> = {
      Positive: 'sent-pos', Neutral: 'sent-neu', Negative: 'sent-neg', Frustrated: 'sent-frus',
    };
    return map[sentiment] ?? 'sent-neu';
  }

  getSentimentLabel(sentiment: string): string {
    const map: Record<string, string> = {
      Positive: 'Positif', Neutral: 'Neutre', Negative: 'Négatif', Frustrated: 'Frustré',
    };
    return map[sentiment] ?? sentiment;
  }

  getUserInitials(index: number): string {
    const initials = ['SA', 'MR', 'LC', 'PD', 'AM', 'TL', 'RK', 'NF', 'CB', 'JL'];
    return initials[index % initials.length];
  }

  getAvatarColor(index: number): string {
    const colors = [
      '#DBEAFE', '#D1FAE5', '#FEF3C7', '#EDE9FE',
      '#FCE7F3', '#E0E7FF', '#FEF9C3', '#F1F5F9'
    ];
    return colors[index % colors.length];
  }

  getAvatarTextColor(index: number): string {
    const colors = [
      '#1E40AF', '#065F46', '#92400E', '#5B21B6',
      '#9D174D', '#3730A3', '#713F12', '#475569'
    ];
    return colors[index % colors.length];
  }

  openDrawer(feedback: Feedback): void {
    this.selectedFeedback.set(feedback);
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);
    setTimeout(() => this.selectedFeedback.set(null), 320);
  }

  onDrawerStatusChanged(event: { id: string; status: FeedbackStatus }): void {
    this.feedbacks.update(list =>
      list.map(f => f.id === event.id ? { ...f, status: event.status } : f)
    );
    this.updateKanbanLists(this.feedbacks());
    this.selectedFeedback.update(f => f?.id === event.id ? { ...f, status: event.status } : f);
  }

  trackById(_: number, item: Feedback): string { return item.id; }

  exportCsv(): void {
    if (this.exporting()) return;
    this.exporting.set(true);
    this.service.exportCsv(this.projectId, {
      category: this.categoryFilter() || undefined,
      priority: this.priorityFilter() || undefined,
      status: this.statusFilter() || undefined,
    }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `feedbacks_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: err => {
        this.exporting.set(false);
        this.error.set(err.status === 403
          ? "L'export CSV est disponible à partir du plan Pro."
          : 'Erreur lors de l\'export.');
      }
    });
  }
}