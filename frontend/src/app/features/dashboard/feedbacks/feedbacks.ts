import {
  Component, OnInit, OnDestroy, inject,
  signal, computed, effect, Injector
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
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
import { Project } from '../projects/projects.types';
import { ProjectsService } from '../projects/projects.service';

@Component({
  selector: 'app-feedbacks',
  standalone: true,
  imports: [
    CommonModule, DatePipe, RouterLink, FeedbackDrawer,
    CdkDrag, CdkDropList, CdkDropListGroup,
  ],
  templateUrl: './feedbacks.html',
  styleUrl: './feedbacks.scss',
})
export class Feedbacks implements OnInit, OnDestroy {

  private readonly service = inject(FeedbacksService);
  private readonly injector = inject(Injector);
  private readonly userService = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly projectsService  = inject(ProjectsService);
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
  projects = signal<Project[]>([]);
  

  // Listes par colonne
  todoList = signal<Feedback[]>([]);
  inReviewList = signal<Feedback[]>([]);
  plannedList = signal<Feedback[]>([]);
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
  readonly pageSize = 100; // on charge tout pour le kanban

  // ─── Flow step actif ──────────────────────────────────────────────────────
  activeFlow = signal<'collect' | 'analyze' | 'prioritize' | 'build'>('collect');

  // ─── Colonnes ─────────────────────────────────────────────────────────────
  readonly columns: {
    status: FeedbackStatus;
    label: string;
    dotColor: string;
    cssClass: string;
  }[] = [
      { status: 'Todo', label: 'Nouveau', dotColor: '#94A3B8', cssClass: 'col-new' },
      //{ status: 'InReview',   label: 'En révision', dotColor: '#F59E0B', cssClass: 'col-review' },
      //{ status: 'Planned',    label: 'Planifié',    dotColor: '#60A5FA', cssClass: 'col-plan'   },
      { status: 'InProgress', label: 'En cours', dotColor: '#8B5CF6', cssClass: 'col-prog' },
      { status: 'Done', label: 'Terminé', dotColor: '#34D399', cssClass: 'col-done' },
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

  readonly analyzedCount = computed(() =>
    this.feedbacks().filter(f => f.aiAnalysisStatus === 'Completed').length
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

  // Insights IA calculés depuis les données
  readonly topRequestedFeature = computed(() => {
    const features = this.feedbacks().filter(f => f.category === 'FeatureRequest');
    if (!features.length) return null;
    const topicMap = new Map<string, number>();
    features.forEach(f =>
      f.keyTopics?.forEach(t => topicMap.set(t, (topicMap.get(t) ?? 0) + 1))
    );
    const top = [...topicMap.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? { topic: top[0], count: top[1] } : null;
  });

  readonly mainFrustration = computed(() => {
    const frustrated = this.feedbacks().filter(f => f.sentiment === 'Frustrated');
    if (!frustrated.length) return null;
    const catMap = new Map<string, number>();
    frustrated.forEach(f => catMap.set(f.category, (catMap.get(f.category) ?? 0) + 1));
    const top = [...catMap.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? { category: top[0], count: top[1] } : null;
  });

  readonly userProfile = computed(() => this.userService.profile());

  readonly userInitials = computed(() => {
    const p = this.userProfile();
    if (!p) return '?';
    return `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase();
  });

  // Projets de l'utilisateur pour la sidebar
  readonly allProjects = computed(() =>
    this.projects?.() ?? []
  );

  readonly currentProject = computed(() =>
    this.dashboardContext.selectedProject()
  );

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

    this.loadProjects();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
    this.search$.complete();
  }

  selectProject(project: Project): void {
    this.dashboardContext.setProject(project);
  }


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
  get projectId(): string {
    return this.dashboardContext.selectedProject()?.id ?? '';
  }

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
      error: () => {
        this.error.set('Impossible de charger les feedbacks.');
        this.loading.set(false);
      }
    });
  }

  private loadProjects(): void {
    this.loading.set(true);
    this.projectsService.getAll().subscribe({
      next: result => {
        this.projects.set(result.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private updateKanbanLists(feedbacks: Feedback[]): void {
    this.todoList.set(feedbacks.filter(f => f.status === 'Todo'));
    //this.inReviewList.set(feedbacks.filter(f => f.status === 'InReview'));
    //this.plannedList.set(feedbacks.filter(f => f.status === 'Planned'));
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
      search: this.searchValue(), sortBy: this.sortBy(),
      page: this.currentPage(), pageSize: this.pageSize,
    };

    this.pollSub = interval(3000).pipe(
      switchMap(() => this.service.getAll(this.projectId, filters)),
      takeWhile(r => {
        pollCount++;
        return r.data.some(
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
  getListForStatus(status: FeedbackStatus): Feedback[] {
    switch (status) {
      case 'Todo': return this.todoList();
      //case 'InReview':   return this.inReviewList();
      //case 'Planned':    return this.plannedList();
      case 'InProgress': return this.inProgressList();
      case 'Done': return this.doneList();
    }
  }

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
        transferArrayItem(
          event.container.data, event.previousContainer.data,
          event.currentIndex, event.previousIndex
        );
        this.feedbacks.update(list =>
          list.map(f => f.id === fb.id ? { ...f, status: prevStatus } : f)
        );
        this.error.set('Impossible de mettre à jour le statut.');
      }
    });
  }

  // ─── Filtres ──────────────────────────────────────────────────────────────
  onSearch(value: string): void {
    this.searchValue.set(value); this.search$.next(value);
  }

  setStatusFilter(status: FeedbackStatus | ''): void {
    this.statusFilter.set(status); this.currentPage.set(1); this.syncUrl(); this.load();
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

  toggleActionFilter(): void {
    this.filterAction.update(v => !v); this.currentPage.set(1); this.load();
  }

  clearFilters(): void {
    this.searchValue.set(''); this.statusFilter.set(''); this.categoryFilter.set('');
    this.priorityFilter.set(''); this.sortBy.set('recent'); this.filterAction.set(false);
    this.filterSentiment.set(''); this.filterMinScore.set(null); this.criticalMode.set(false);
    this.currentPage.set(1); this.syncUrl(); this.load();
  }

  // ─── Helpers visuels ──────────────────────────────────────────────────────
  getTagClass(category: string): string {
    const map: Record<string, string> = {
      Bug: 'tag-bug', FeatureRequest: 'tag-feat',
      Question: 'tag-quest', Uncategorized: 'tag-other',
    };
    return map[category] ?? 'tag-other';
  }

  getCategoryLabel(cat: string): string {
    const map: Record<string, string> = {
      Bug: 'Bug', FeatureRequest: 'Fonctionnalité',
      Question: 'Question', Uncategorized: 'Autre',
    };
    return map[cat] ?? cat;
  }

  getPriorityBarClass(priority: string): string {
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

  getSentimentClass(s: string): string {
    const map: Record<string, string> = {
      Positive: 'pos', Neutral: 'neu', Negative: 'neg', Frustrated: 'neg',
    };
    return map[s] ?? 'neu';
  }

  getSentimentIcon(s: string): string {
    const map: Record<string, string> = {
      Positive: 'ti-mood-smile', Neutral: 'ti-mood-neutral',
      Negative: 'ti-mood-sad', Frustrated: 'ti-mood-sad',
    };
    return map[s] ?? 'ti-mood-neutral';
  }

  getSentimentLabel(s: string): string {
    const map: Record<string, string> = {
      Positive: 'Positif', Neutral: 'Neutre',
      Negative: 'Négatif', Frustrated: 'Frustré',
    };
    return map[s] ?? s;
  }

  getRelativeDate(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3_600_000);
    const days = Math.floor(diff / 86_400_000);
    if (hours < 1) return "à l'instant";
    if (hours < 24) return `il y a ${hours}h`;
    if (days === 1) return 'hier';
    return `il y a ${days}j`;
  }

  getAvatarBg(index: number): string {
    const colors = [
      '#DBEAFE', '#D1FAE5', '#FEF3C7', '#EDE9FE',
      '#FCE7F3', '#E0E7FF', '#F1F5F9', '#FEF9C3',
    ];
    return colors[index % colors.length];
  }

  getAvatarColor(index: number): string {
    const colors = [
      '#1D4ED8', '#065F46', '#92400E', '#5B21B6',
      '#9D174D', '#3730A3', '#475569', '#713F12',
    ];
    return colors[index % colors.length];
  }

  getInitials(feedback: Feedback, index: number): string {
    // Utilise les initiales du contenu si pas de nom client
    const names = ['SA', 'MR', 'LC', 'PD', 'AM', 'TL', 'RK', 'NF', 'CB', 'JL'];
    return names[index % names.length];
  }

  // ─── Drawer ───────────────────────────────────────────────────────────────
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
    this.selectedFeedback.update(f =>
      f?.id === event.id ? { ...f, status: event.status } : f
    );
  }

  // ─── Export ───────────────────────────────────────────────────────────────
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
        a.href = url;
        a.download = `feedbacks_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: err => {
        this.exporting.set(false);
        this.error.set(err.status === 403
          ? "Export CSV disponible à partir du plan Pro."
          : "Erreur lors de l'export.");
      }
    });
  }

  trackById(_: number, item: Feedback): string { return item.id; }
}