# feedbacks.html

```html
<!-- feedbacks.html -->
<div class="feedbacks">

  <!-- ── En-tête ──────────────────────────────────────────── -->
  <header class="feedbacks__header">
    <div>
      <h1 class="feedbacks__title">Feedbacks</h1>
      <p class="feedbacks__subtitle">
        {{ totalCount() }} feedback{{ totalCount() > 1 ? 's' : '' }} au total
      </p>
    </div>

    <div class="feedbacks__export-wrap" [title]="!isPro ? 'Disponible à partir du plan Pro (9€/mois)' : ''">
      <button class="feedbacks__export-btn" [disabled]="exporting() || totalCount() === 0"
        [class.feedbacks__export-btn--loading]="exporting()" (click)="exportCsv()" title="Exporter en CSV">
    @if (exporting()) {
    <span class="feedbacks__export-spinner"></span>
    Export…
    } @else {
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
      stroke-linejoin="round">
      <path d="M8 2v9" />
      <polyline points="4 8 8 12 12 8" />
      <line x1="2" y1="14" x2="14" y2="14" />
    </svg>
    Exporter CSV
    }</button>
    </div>
  </header>

  <!-- ── Filtres ───────────────────────────────────────────── -->
  <div class="feedbacks__filters">

    <!-- Recherche -->
    <div class="filter-search">
      <svg class="filter-search__icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5"
        stroke-linecap="round" stroke-linejoin="round">
        <circle cx="8.5" cy="8.5" r="5.5" />
        <line x1="13" y1="13" x2="18" y2="18" />
      </svg>
      <input class="filter-search__input" type="search" placeholder="Rechercher un feedback…" [value]="searchValue()"
        (input)="onSearch($any($event.target).value)">
    </div>

    <!-- Catégorie -->
    <select class="filter-select" [value]="categoryFilter()" (change)="onCategoryChange($any($event.target).value)">
      <option value="">Toutes les catégories</option>
      @for (cat of categories; track cat) {
      <option [value]="cat">{{ getCategoryFilterLabel(cat) }}</option>
      }
    </select>

    <!-- Priorité -->
    <select class="filter-select" [value]="priorityFilter()" (change)="onPriorityChange($any($event.target).value)">
      <option value="">Toutes les priorités</option>
      @for (pri of priorities; track pri) {
      <option [value]="pri">{{ getPriorityLabel(pri) }}</option>
      }
    </select>

    <!-- Reset -->
    @if (hasActiveFilters()) {
    <button class="filter-reset" (click)="clearFilters()">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
        stroke-linejoin="round">
        <line x1="2" y1="2" x2="14" y2="14" />
        <line x1="14" y1="2" x2="2" y2="14" />
      </svg>
      Réinitialiser
    </button>
    }
  </div>

  <!-- ── Loading ───────────────────────────────────────────── -->
  @if (loading()) {
  <div class="feedbacks__loading">
    @for (col of columns; track col.status) {
    <div class="kanban-skeleton">
      <div class="kanban-skeleton__header"></div>
      @for (i of [1,2,3]; track i) {
      <div class="kanban-skeleton__card"></div>
      }
    </div>
    }
  </div>
  }

  <!-- ── Erreur ─────────────────────────────────────────────── -->
  @if (error()) {
  <div class="feedbacks__error">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
      stroke-linejoin="round">
      <circle cx="10" cy="10" r="8" />
      <line x1="10" y1="6" x2="10" y2="10.5" />
      <circle cx="10" cy="14" r="0.5" fill="currentColor" />
    </svg>
    {{ error() }}
    <button class="feedbacks__error-retry" (click)="load()">Réessayer</button>
  </div>
  }

  <!-- ── Kanban ─────────────────────────────────────────────── -->
  @if (!loading() && !error()) {
  <div class="kanban">

    @for (col of columns; track col.status) {
    <div class="kanban__col" [class.kanban__col--dragover]="dragging() && dragging()!.status !== col.status"
      (dragover)="onDragOver($event)" (drop)="onDrop(col.status)">

      <!-- Header colonne -->
      <div class="kanban__col-header" [attr.data-color]="col.color">
        <div class="kanban__col-title">
          <span class="kanban__col-dot" [attr.data-color]="col.color"></span>
          {{ col.label }}
        </div>
        <span class="kanban__col-count">
          {{ getColumnFeedbacks(col.status).length }}
        </span>
      </div>

      <!-- Cards -->
      <div class="kanban__cards">

        @if (getColumnFeedbacks(col.status).length === 0) {
        <div class="kanban__empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
            stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="3" />
            <line x1="9" y1="12" x2="15" y2="12" />
          </svg>
          Aucun feedback
        </div>
        }

        @for (fb of getColumnFeedbacks(col.status); track trackById($index, fb)) {
        <article class="fb-card" [class.fb-card--dragging]="dragging()?.id === fb.id"
          [class.fb-card--done]="fb.status === 'Done'" [attr.data-priority]="fb.priority" draggable="true"
          (dragstart)="onDragStart(fb)" (dragend)="onDragEnd()" (click)="openDrawer(fb)">

          <!-- Badge IA -->
          @if (fb.aiAnalysisStatus !== 'Completed') {
          <div class="fb-card__ai">
            @switch (fb.aiAnalysisStatus) {
            @case ('Pending') {
            <span class="ai-badge ai-badge--pending">
              <span class="ai-badge__dot"></span>
              En attente
            </span>
            }
            @case ('Processing') {
            <span class="ai-badge ai-badge--processing">
              <span class="ai-badge__spinner"></span>
              Analyse IA…
            </span>
            }
            @case ('Failed') {
            <span class="ai-badge ai-badge--failed">
              ⚠️ Échec IA
            </span>
            }
            @default { }
            }
          </div>
          }

          <!-- Contenu -->
          <p class="fb-card__summary">
            {{ fb.aiSummary || fb.content }}
          </p>

          <!-- Contenu original si résumé IA disponible -->
          @if (fb.aiSummary && fb.aiAnalysisStatus === 'Completed') {
          <p class="fb-card__original">{{ fb.content }}</p>
          }

          <!-- fb-card — section Pro/Team -->
          @if (fb.aiAnalysisStatus === 'Completed' && fb.priorityScore !== null) {

            <!-- Score de priorité Pro -->
            <div class="fb-card__pro-info">

              <!-- Barre de score -->
              <div class="fb-card__score">
                <span class="fb-card__score-label">Score</span>
                <div class="fb-card__score-bar">
                  <div
                    class="fb-card__score-fill"
                    [style.width.%]="fb.priorityScore"
                    [class.fb-card__score-fill--critical]="(fb.priorityScore ?? 0) >= 76"
                    [class.fb-card__score-fill--high]="(fb.priorityScore ?? 0) >= 51 && (fb.priorityScore ?? 0) < 76"
                    [class.fb-card__score-fill--normal]="(fb.priorityScore ?? 0) < 51">
                  </div>
                </div>
                <span class="fb-card__score-value">{{ fb.priorityScore }}/100</span>
              </div>

              <!-- Sentiment -->
              @if (fb.sentiment) {
                <span class="fb-card__sentiment" [attr.data-sentiment]="fb.sentiment">
                  {{ getSentimentEmoji(fb.sentiment) }} {{ fb.sentiment }}
                </span>
              }

              <!-- Action required -->
              @if (fb.actionRequired) {
                <span class="fb-card__action-badge">⚡ Action requise</span>
              }

              <!-- Key topics -->
              @if (fb.keyTopics && fb.keyTopics.length > 0) {
                <div class="fb-card__topics">
                  @for (topic of fb.keyTopics; track topic) {
                    <span class="fb-card__topic">{{ topic }}</span>
                  }
                </div>
              }

            </div>
          }

          <!-- Meta -->
          <div class="fb-card__meta">
            <span class="fb-card__category">
              {{ getCategoryLabel(fb.category) }}
            </span>
            <span class="fb-card__priority" [attr.data-priority]="fb.priority">
              {{ fb.priority }}
            </span>
            <span class="fb-card__date">
              {{ fb.createdAt | date:'dd/MM' }}
            </span>
          </div>

        </article>
        }

      </div>
    </div>
    }

  </div>
  }
  <!-- ── Feedback Drawer ────────────────────────────────────────────────────── -->
  <app-feedback-drawer
    [feedback]="selectedFeedback()"
    [open]="drawerOpen()"
    (closed)="closeDrawer()"
    (statusChanged)="onDrawerStatusChanged($event)">
  </app-feedback-drawer>
</div>
```

# feedbacks.scss

```scss
// feedbacks.scss
.feedbacks {
  padding: 2rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  animation: fadeIn 0.25s ease;

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
}

// ── En-tête ────────────────────────────────────────────────
.feedbacks__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
}

.feedbacks__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem;
}

.feedbacks__subtitle {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin: 0;
}

// ── Filtres ────────────────────────────────────────────────
.feedbacks__filters {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.filter-search {
  position: relative;
  flex: 1;
  min-width: 200px;
  max-width: 320px;

  &__icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 16px;
    height: 16px;
    color: var(--color-text-secondary);
    pointer-events: none;
  }

  &__input {
    width: 100%;
    padding: 0.5rem 0.75rem 0.5rem 2.25rem;
    border: 1px solid var(--color-border-primary);
    border-radius: 8px;
    background: var(--color-background-primary);
    color: var(--color-text-primary);
    font-size: 0.875rem;
    outline: none;
    transition: border-color 0.15s ease;

    &:focus { border-color: var(--color-accent, #3B82F6); }
    &::placeholder { color: var(--color-text-secondary); }
  }
}

.filter-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s ease;

  &:focus { border-color: var(--color-accent, #3B82F6); }
}

.filter-reset {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.15s ease;

  svg { width: 12px; height: 12px; }

  &:hover {
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
  }
}

// ── Kanban ─────────────────────────────────────────────────
.kanban {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  flex: 1;
  min-height: 0;
  overflow: hidden;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}

.kanban__col {
  display: flex;
  flex-direction: column;
  background: var(--color-background-secondary);
  border-radius: 12px;
  border: 2px solid transparent;
  overflow: hidden;
  transition: border-color 0.15s ease, background 0.15s ease;

  &--dragover {
    border-color: var(--color-accent, #3B82F6);
    background: color-mix(in srgb, var(--color-accent, #3B82F6) 5%, var(--color-background-secondary));
  }
}

.kanban__col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border-tertiary);
  position: sticky;
  top: 0;
  background: inherit;
  z-index: 1;
}

.kanban__col-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.kanban__col-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;

  &[data-color="amber"]   { background: #F59E0B; }
  &[data-color="violet"]  { background: #8B5CF6; }
  &[data-color="emerald"] { background: #10B981; }
}

.kanban__col-count {
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--color-background-primary);
  border-radius: 20px;
  padding: 0.15rem 0.6rem;
  color: var(--color-text-secondary);
}

.kanban__cards {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-primary) transparent;
}

.kanban__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  text-align: center;

  svg { width: 24px; height: 24px; opacity: 0.4; }
}

// ── Cards ──────────────────────────────────────────────────
.fb-card {
  background: var(--color-background-primary);
  border: 1px solid var(--color-border-tertiary);
  border-left: 3px solid transparent;
  border-radius: 8px;
  padding: 0.75rem;
  cursor: grab;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease;
  animation: cardIn 0.2s ease both;

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 3px 12px rgba(0,0,0,0.1);
  }

  &:active { cursor: grabbing; }

  &--dragging {
    opacity: 0.4;
    transform: scale(0.98);
  }

  &--done { opacity: 0.65; }

  // Priorité — bordure gauche colorée
  &[data-priority="Critical"] { border-left-color: #F43F5E; }
  &[data-priority="High"]     { border-left-color: #F59E0B; }
  &[data-priority="Normal"]   { border-left-color: #3B82F6; }
  &[data-priority="Low"]      { border-left-color: #9CA3AF; }
}

.fb-card__ai {
  margin-bottom: 0.4rem;
}

.fb-card__summary {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-primary);
  margin: 0 0 0.4rem;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fb-card__original {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  font-style: italic;
  margin: 0 0 0.5rem;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.fb-card__meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.fb-card__category {
  font-size: 0.68rem;
  color: var(--color-text-secondary);
  background: var(--color-background-secondary);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
}

.fb-card__priority {
  font-size: 0.68rem;
  font-weight: 600;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;

  &[data-priority="Critical"] { background: #FFF1F2; color: #F43F5E; }
  &[data-priority="High"]     { background: #FFF7ED; color: #F59E0B; }
  &[data-priority="Normal"]   { background: #EFF6FF; color: #3B82F6; }
  &[data-priority="Low"]      { background: #F9FAFB; color: #9CA3AF; }
}

.fb-card__date {
  font-size: 0.68rem;
  color: var(--color-text-secondary);
  margin-left: auto;
}

// ── Badges IA ──────────────────────────────────────────────
.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.65rem;
  font-weight: 500;
  padding: 0.15rem 0.45rem;
  border-radius: 20px;

  &--pending {
    background: #FFF7ED;
    color: #C2410C;

    .ai-badge__dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #F97316;
    }
  }

  &--processing {
    background: #EFF6FF;
    color: #1D4ED8;

    .ai-badge__spinner {
      width: 8px;
      height: 8px;
      border: 1.5px solid #93C5FD;
      border-top-color: #1D4ED8;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
  }

  &--failed {
    background: #FFF1F2;
    color: #BE123C;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

// ── Skeletons ──────────────────────────────────────────────
.feedbacks__loading {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  flex: 1;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

@mixin shimmer {
  background: linear-gradient(
    90deg,
    var(--color-background-primary) 25%,
    var(--color-border-tertiary) 50%,
    var(--color-background-primary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.kanban-skeleton {
  background: var(--color-background-secondary);
  border-radius: 12px;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  &__header {
    height: 36px;
    border-radius: 6px;
    @include shimmer;
  }

  &__card {
    height: 80px;
    border-radius: 8px;
    @include shimmer;
  }
}
// ── Erreur ─────────────────────────────────────────────────
.feedbacks__error {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  border-radius: 8px;
  color: #BE123C;
  font-size: 0.875rem;

  svg { width: 18px; height: 18px; flex-shrink: 0; }
}

.feedbacks__error-retry {
  margin-left: auto;
  padding: 0.3rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #FECDD3;
  background: white;
  color: #BE123C;
  font-size: 0.8rem;
  cursor: pointer;

  &:hover { background: #FFF1F2; }
}

// feedbacks.scss — ajouter
.feedbacks__export-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border-primary);
  border-radius: 8px;
  background: var(--color-background-primary);
  color: var(--color-text-primary);
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  svg { width: 14px; height: 14px; }

  &:hover:not(:disabled) {
    background: var(--color-background-secondary);
    border-color: var(--color-accent, #3B82F6);
    color: var(--color-accent, #3B82F6);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--loading { cursor: wait; }
}

.feedbacks__export-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-primary);
  border-top-color: var(--color-accent, #3B82F6);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;

  @keyframes spin { to { transform: rotate(360deg); } }
}


// styles Pro
.fb-card__pro-info {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px dashed var(--color-border-tertiary);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.fb-card__score {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.fb-card__score-label {
  font-size: 0.65rem;
  color: var(--color-text-secondary);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

.fb-card__score-bar {
  flex: 1;
  height: 4px;
  background: var(--color-background-secondary);
  border-radius: 2px;
  overflow: hidden;
}

.fb-card__score-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.6s ease;

  &--critical { background: #F43F5E; }
  &--high     { background: #F59E0B; }
  &--normal   { background: #3B82F6; }
}

.fb-card__score-value {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.fb-card__sentiment {
  font-size: 0.7rem;
  color: var(--color-text-secondary);

  &[data-sentiment="Frustrated"] { color: #F43F5E; }
  &[data-sentiment="Negative"]   { color: #F59E0B; }
  &[data-sentiment="Positive"]   { color: #10B981; }
}

.fb-card__action-badge {
  font-size: 0.65rem;
  font-weight: 600;
  background: #FFF7ED;
  color: #C2410C;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  display: inline-block;
}

.fb-card__topics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.fb-card__topic {
  font-size: 0.65rem;
  background: var(--color-background-secondary);
  color: var(--color-text-secondary);
  padding: 0.15rem 0.4rem;
  border-radius: 20px;
  border: 1px solid var(--color-border-tertiary);
}
```

# feedbacks.service.ts

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Feedback, FeedbackFilters, FeedbackStatus, PagedResult } from './feedbacks.types';

@Injectable({ providedIn: 'root' })
export class FeedbacksService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getAll(projectId: string, filters: FeedbackFilters): Observable<PagedResult<Feedback>> {
    let params = new HttpParams()
      .set('page', filters.page)
      .set('pageSize', filters.pageSize);

    if (filters.category) params = params.set('category', filters.category);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.search) params = params.set('search', filters.search);

    return this.http.get<PagedResult<Feedback>>(
      `${this.API}/projects/${projectId}/feedbacks`,
      { params, withCredentials: true }
    );
  }

  updateStatus(
    projectId: string,
    feedbackId: string,
    newStatus: FeedbackStatus
  ): Observable<void> {
    return this.http.patch<void>(
      `${this.API}/projects/${projectId}/feedbacks/${feedbackId}/status`,
      { newStatus },
      { withCredentials: true }
    );
  }

  exportCsv(
    projectId: string,
    filters: Partial<FeedbackFilters>
  ): Observable<Blob> {
    let params = new HttpParams();
    if (filters.category) params = params.set('category', filters.category);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.status) params = params.set('status', filters.status);

    return this.http.get(
      `${this.API}/projects/${projectId}/feedbacks/export`,
      {
        params,
        responseType: 'blob',
        withCredentials: true
      }
    );
  }
}
```

# feedbacks.ts

```ts
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
```

# feedbacks.types.ts

```ts
export type FeedbackStatus = 'Todo' | 'InProgress' | 'Done';
export type FeedbackPriority = 'Low' | 'Normal' | 'High' | 'Critical';
export type FeedbackCategory = 'Bug' | 'FeatureRequest' | 'Question' | 'Uncategorized';
export type AiStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed';

export interface Feedback {
    id:               string;
    content:          string;
    aiSummary:        string;
    category:         FeedbackCategory;
    priority:         FeedbackPriority;
    status:           FeedbackStatus;
    aiAnalysisStatus: AiStatus;
    // Champs Pro
    priorityScore?:   number;
    sentiment?:       string;
    sentimentScore?:  number;
    keyTopics?:       string[];
    actionRequired?:  boolean;
    urgency?:         string;
    createdAt:        string;
    updatedAt?:       string;
}

export interface FeedbackFilters {
    category?: FeedbackCategory;
    priority?: FeedbackPriority;
    search: string;
    page: number;
    pageSize: number;
    status?: FeedbackStatus;
}

export interface PagedResult<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
    };
}
```

# Dashboard-Context.Service

```ts
import { Injectable, computed, inject, signal } from '@angular/core';
import { UserService } from './user.service';
import { Project } from '../../features/dashboard/projects/projects.types';

@Injectable({ providedIn: 'root' })
export class DashboardContextService {
  private readonly userService = inject(UserService);

  readonly selectedProject = signal<Project | null>(null);

  private storageKey(userId: string): string {
    return `selectedProject_${userId}`;
  }

  // ─── Appelé par AuthService.saveTokens(), APRÈS userService.refresh() ──────
  //
  // CRITIQUE : set(null) en PREMIER, toujours, avant toute lecture localStorage.
  // Sans ce reset explicite, si la session précédente avait un projet en mémoire
  // via setProject() mais que le nouvel utilisateur n'a rien en localStorage,
  // le signal garde l'ancienne valeur et la sidebar affiche l'ancien projet.
  //
  loadForUser(): void {
    this.selectedProject.set(null); // reset immédiat, sans condition

    const userId = this.userService.userId();
    if (!userId) return;

    const raw = localStorage.getItem(this.storageKey(userId));
    if (!raw) return;

    try {
      this.selectedProject.set(JSON.parse(raw));
    } catch {
      localStorage.removeItem(this.storageKey(userId));
    }
  }

  // ─── Appelé par AuthService.logout(), AVANT userService.clear() ────────────
  clearForCurrentUser(): void {
    const userId = this.userService.userId();
    if (userId) {
      localStorage.removeItem(this.storageKey(userId));
    }
    // Efface le signal immédiatement — la sidebar voit null avant la navigation
    this.selectedProject.set(null);
  }

  setProject(project: Project): void {
    const userId = this.userService.userId();
    if (!userId) return;
    this.selectedProject.set(project);
    localStorage.setItem(this.storageKey(userId), JSON.stringify(project));
  }

  readonly plan = computed(() =>
    this.userService.profile()?.plan ?? 'Free'
  );

  readonly projectLimit = computed(() => {
    switch (this.plan()) {
      case 'Team': return Infinity;
      case 'Pro':  return 10;
      default:     return 1;
    }
  });
}

```
# feedback-drawer.html

```html
<!-- feedback-drawer.html -->

<!-- ── Overlay ──────────────────────────────────────────────────────────── -->
<div
  class="drawer-overlay"
  [class.drawer-overlay--visible]="open()"
  (click)="close()"
  aria-hidden="true">
</div>

<!-- ── Panneau ──────────────────────────────────────────────────────────── -->
<aside
  class="drawer"
  [class.drawer--open]="open()"
  role="complementary"
  aria-label="Détail du feedback"
  [attr.aria-hidden]="!open()">

  @if (feedback()) {

    <!-- ── Header ─────────────────────────────────────────────────────── -->
    <header class="drawer__header">

      <div class="drawer__header-meta">

        <!-- Priorité -->
        <span class="drawer__priority-badge drawer__priority-badge--{{ priorityConfig().cls }}">
          {{ priorityConfig().label }}
        </span>

        <!-- Catégorie -->
        <span class="drawer__category-badge">
          {{ categoryConfig().emoji }} {{ categoryConfig().label }}
        </span>

        <!-- Date -->
        <span class="drawer__date">
          {{ feedback()!.createdAt | date:'dd MMM yyyy · HH:mm' }}
        </span>
      </div>

      <!-- Bouton fermer -->
      <button class="drawer__close" (click)="close()" aria-label="Fermer">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="2" y1="2" x2="14" y2="14"/>
          <line x1="14" y1="2" x2="2" y2="14"/>
        </svg>
      </button>

    </header>

    <!-- ── Corps ──────────────────────────────────────────────────────── -->
    <div class="drawer__body">

      <!-- Résumé IA -->
      @if (feedback()!.aiSummary && feedback()!.aiAnalysisStatus === 'Completed') {
        <section class="drawer__section">
          <p class="drawer__section-label">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z"/>
            </svg>
            Résumé IA
          </p>
          <p class="drawer__ai-summary">{{ feedback()!.aiSummary }}</p>
        </section>
      }

      <!-- Badge IA en cours / échec -->
      @if (feedback()!.aiAnalysisStatus !== 'Completed') {
        <section class="drawer__section">
          @switch (feedback()!.aiAnalysisStatus) {
            @case ('Pending') {
              <span class="drawer__ai-badge drawer__ai-badge--pending">
                <span class="drawer__ai-dot"></span>
                Analyse IA en attente…
              </span>
            }
            @case ('Processing') {
              <span class="drawer__ai-badge drawer__ai-badge--processing">
                <span class="drawer__ai-spinner"></span>
                Analyse IA en cours…
              </span>
            }
            @case ('Failed') {
              <span class="drawer__ai-badge drawer__ai-badge--failed">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <circle cx="8" cy="8" r="7"/>
                  <line x1="8" y1="5" x2="8" y2="8.5"/>
                  <circle cx="8" cy="11" r="0.5" fill="currentColor"/>
                </svg>
                Échec de l'analyse IA
              </span>
            }
            @default {}
          }
        </section>
      }

      <!-- Contenu original -->
      <section class="drawer__section">
        <p class="drawer__section-label">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3z"/>
            <path d="M2 9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9z"/>
            <path d="M10 9a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V9z"/>
          </svg>
          Message original
        </p>
        <blockquote class="drawer__original">{{ feedback()!.content }}</blockquote>
      </section>

      <!-- Analyse IA — données Pro -->
      @if (feedback()!.aiAnalysisStatus === 'Completed') {

        @if (feedback()!.priorityScore !== null && feedback()!.priorityScore !== undefined) {
          <section class="drawer__section">
            <p class="drawer__section-label">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="2 10 6 5 10 8 14 2"/>
              </svg>
              Score de priorité
            </p>
            <div class="drawer__score">
              <div class="drawer__score-bar">
                <div
                  class="drawer__score-fill drawer__score-fill--{{ scoreClass() }}"
                  [style.width.%]="feedback()!.priorityScore">
                </div>
              </div>
              <span class="drawer__score-value">{{ feedback()!.priorityScore }}/100</span>
            </div>
          </section>
        }

        @if (sentimentConfig()) {
          <section class="drawer__section drawer__section--inline">
            <p class="drawer__section-label">Sentiment</p>
            <span class="drawer__sentiment drawer__sentiment--{{ sentimentConfig()!.cls }}">
              {{ sentimentConfig()!.emoji }} {{ feedback()!.sentiment }}
            </span>
          </section>
        }

        @if (feedback()!.actionRequired) {
          <section class="drawer__section">
            <div class="drawer__action-required">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M8 1l1.8 3.6L14 5.3l-3 2.9.7 4.1L8 10.4l-3.7 1.9.7-4.1-3-2.9 4.2-.7L8 1z"/>
              </svg>
              Action requise
            </div>
          </section>
        }

        @if (feedback()!.keyTopics && feedback()!.keyTopics!.length > 0) {
          <section class="drawer__section">
            <p class="drawer__section-label">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M2 4h12M2 8h8M2 12h5"/>
              </svg>
              Sujets clés
            </p>
            <div class="drawer__topics">
              @for (topic of feedback()!.keyTopics!; track topic) {
                <span class="drawer__topic">{{ topic }}</span>
              }
            </div>
          </section>
        }

      }

    </div>

    <!-- ── Footer — changement de statut ──────────────────────────────── -->
    <footer class="drawer__footer">

      @if (statusError()) {
        <p class="drawer__status-error">{{ statusError() }}</p>
      }

      <p class="drawer__footer-label">Changer le statut</p>
      <div class="drawer__status-actions">
        @for (s of statuses; track s.value) {
          <button
            class="drawer__status-btn"
            [class.drawer__status-btn--active]="feedback()!.status === s.value"
            [disabled]="updatingStatus() || feedback()!.status === s.value"
            (click)="setStatus(s.value)">
            @if (updatingStatus() && feedback()!.status !== s.value) {
              <span class="drawer__btn-spinner"></span>
            } @else {
              {{ s.emoji }}
            }
            {{ s.label }}
          </button>
        }
      </div>

    </footer>

  }

  <!-- ── État vide (sécurité) ────────────────────────────────────────────── -->
  @if (!feedback() && open()) {
    <div class="drawer__empty">
      <p class="drawer__empty-text">Aucun feedback sélectionné.</p>
    </div>
  }

</aside>
```

# feedback-drawer.scss

```scss
// feedback-drawer.scss
// ─── Design system : 100% aligné avec --color-dark, --color-white,
//     --color-border, --color-muted, --color-surface, --color-surface-lt,
//     --radius-card, --radius-inner, --radius-pill, --font-base, --font-medium
//     (identique à pricing.scss et payment-success.scss)
// ─────────────────────────────────────────────────────────────────────────────

// ── Overlay ──────────────────────────────────────────────────────────────────

.drawer-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(20, 21, 26, 0);
  pointer-events: none;
  z-index: 200;
  transition: background-color 0.3s ease;

  &--visible {
    background-color: rgba(20, 21, 26, 0.35);
    pointer-events: auto;
  }
}

// ── Panneau ───────────────────────────────────────────────────────────────────

.drawer {
  position: fixed;
  top: 0;
  right: 0;
  height: 100vh;
  width: 480px;
  max-width: calc(100vw - 48px);
  background-color: var(--color-white);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 201;

  // Animation slide — transform uniquement, pas de opacity
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  will-change: transform;

  &--open {
    transform: translateX(0);
  }

  // Ombre gauche subtile quand ouvert
  &--open {
    box-shadow: -8px 0 32px rgba(20, 21, 26, 0.08);
  }
}

// ── Header ────────────────────────────────────────────────────────────────────

.drawer__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.drawer__header-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

// Badge priorité — reprend exactement les couleurs de fb-card__priority
.drawer__priority-badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  font-family: var(--font-medium);
  font-size: 12px;
  font-weight: 500;

  &--critical { background: #FFF1F2; color: #F43F5E; }
  &--high     { background: #FFF7ED; color: #F59E0B; }
  &--normal   { background: #EFF6FF; color: #3B82F6; }
  &--low      { background: #F9FAFB; color: #9CA3AF; }
}

// Badge catégorie
.drawer__category-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background-color: var(--color-surface-lt);
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-dark);
}

// Date
.drawer__date {
  font-size: 12px;
  color: var(--color-muted);
}

// Bouton fermer — identique à btn--secondary dans globals
.drawer__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-inner);
  border: 1px solid var(--color-border);
  background-color: var(--color-white);
  cursor: pointer;
  color: var(--color-muted);
  flex-shrink: 0;
  transition: background-color 0.15s ease, color 0.15s ease;

  svg { width: 14px; height: 14px; }

  &:hover {
    background-color: var(--color-surface-lt);
    color: var(--color-dark);
  }
}

// ── Corps scrollable ──────────────────────────────────────────────────────────

.drawer__body {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

// ── Sections ─────────────────────────────────────────────────────────────────

.drawer__section {
  padding: 16px 0;
  border-bottom: 1px solid var(--color-border);

  &:first-child { padding-top: 0; }
  &:last-child  { border-bottom: none; }

  // Variant inline (label + valeur sur une ligne)
  &--inline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;

    .drawer__section-label { margin-bottom: 0; }
  }
}

.drawer__section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-medium);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  margin-bottom: 10px;

  svg {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }
}

// ── Résumé IA ─────────────────────────────────────────────────────────────────

.drawer__ai-summary {
  font-family: var(--font-medium);
  font-size: 15px;
  font-weight: 500;
  line-height: 1.55;
  color: var(--color-dark);
  margin: 0;
}

// ── Badges IA (reprend exactement ai-badge de feedbacks.scss) ────────────────

.drawer__ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: var(--radius-inner);

  svg { width: 14px; height: 14px; flex-shrink: 0; }

  &--pending {
    background: #FFF7ED;
    color: #C2410C;
    border: 1px solid #FED7AA;
  }

  &--processing {
    background: #EFF6FF;
    color: #1D4ED8;
    border: 1px solid #BFDBFE;
  }

  &--failed {
    background: #FFF1F2;
    color: #BE123C;
    border: 1px solid #FECDD3;
  }
}

.drawer__ai-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #F97316;
  flex-shrink: 0;
}

.drawer__ai-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid #BFDBFE;
  border-top-color: #1D4ED8;
  border-radius: 50%;
  animation: drawer-spin 0.8s linear infinite;
  flex-shrink: 0;
}

@keyframes drawer-spin {
  to { transform: rotate(360deg); }
}

// ── Message original ──────────────────────────────────────────────────────────

.drawer__original {
  font-size: 14px;
  line-height: 1.65;
  color: var(--color-dark);
  margin: 0;
  padding: 14px 16px;
  background-color: var(--color-surface);
  border-radius: var(--radius-inner);
  border-left: 3px solid var(--color-border);
  font-style: italic;
  white-space: pre-wrap;
  word-break: break-word;
}

// ── Score de priorité ─────────────────────────────────────────────────────────

.drawer__score {
  display: flex;
  align-items: center;
  gap: 12px;
}

.drawer__score-bar {
  flex: 1;
  height: 6px;
  background-color: var(--color-surface);
  border-radius: 3px;
  overflow: hidden;
}

.drawer__score-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.6s ease;

  &--critical { background: #F43F5E; }
  &--high     { background: #F59E0B; }
  &--normal   { background: #3B82F6; }
}

.drawer__score-value {
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-dark);
  flex-shrink: 0;
  min-width: 48px;
  text-align: right;
}

// ── Sentiment ─────────────────────────────────────────────────────────────────

.drawer__sentiment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: var(--radius-pill);
  font-size: 13px;
  border: 1px solid var(--color-border);
  background-color: var(--color-surface-lt);
  color: var(--color-dark);

  &--positive   { color: #059669; background: #ECFDF5; border-color: #A7F3D0; }
  &--neutral    { color: var(--color-muted); }
  &--negative   { color: #D97706; background: #FFFBEB; border-color: #FDE68A; }
  &--frustrated { color: #DC2626; background: #FFF1F2; border-color: #FECDD3; }
}

// ── Action requise ────────────────────────────────────────────────────────────

.drawer__action-required {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  border-radius: var(--radius-inner);
  background: #FFF7ED;
  border: 1px solid #FED7AA;
  color: #C2410C;
  font-family: var(--font-medium);
  font-size: 13px;
  font-weight: 500;

  svg { width: 14px; height: 14px; flex-shrink: 0; }
}

// ── Topics ────────────────────────────────────────────────────────────────────

.drawer__topics {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.drawer__topic {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: var(--radius-pill);
  background-color: var(--color-surface-lt);
  border: 1px solid var(--color-border);
  font-size: 12px;
  color: var(--color-dark);
  transition: background-color 0.15s ease;
}

// ── Empty state ───────────────────────────────────────────────────────────────

.drawer__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.drawer__empty-text {
  font-size: 14px;
  color: var(--color-muted);
  text-align: center;
}

// ── Footer ────────────────────────────────────────────────────────────────────

.drawer__footer {
  padding: 16px 24px 24px;
  border-top: 1px solid var(--color-border);
  background-color: var(--color-surface-lt);
  flex-shrink: 0;
}

.drawer__footer-label {
  font-family: var(--font-medium);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--color-muted);
  margin: 0 0 10px;
}

.drawer__status-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

// Boutons statut — reprend exactement btn--secondary du global
.drawer__status-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 9px 12px;
  border-radius: var(--radius-inner);
  border: 1px solid var(--color-border);
  background-color: var(--color-white);
  font-family: var(--font-medium);
  font-size: 13px;
  color: var(--color-dark);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;

  &:hover:not(:disabled):not(.drawer__status-btn--active) {
    background-color: var(--color-surface-lt);
    border-color: rgba(20, 21, 26, 0.2);
  }

  &--active {
    background-color: var(--color-dark);
    color: var(--color-white);
    border-color: var(--color-dark);
    cursor: default;
  }

  &:disabled:not(.drawer__status-btn--active) {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

// Spinner inline dans le bouton
.drawer__btn-spinner {
  display: inline-block;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(20, 21, 26, 0.2);
  border-top-color: var(--color-dark);
  border-radius: 50%;
  animation: drawer-spin 0.7s linear infinite;
  flex-shrink: 0;
}

// ── Erreur de statut ──────────────────────────────────────────────────────────

.drawer__status-error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 10px;
  border-radius: var(--radius-inner);
  background-color: #FFF1F2;
  border: 1px solid #FECDD3;
  font-size: 13px;
  color: #BE123C;
}

// ── Responsive ───────────────────────────────────────────────────────────────

@media (max-width: 600px) {
  .drawer {
    width: 100vw;
    max-width: 100vw;
  }
}
```

# feedback-drawer.spec.ts

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedbackDrawer } from './feedback-drawer';

describe('FeedbackDrawer', () => {
  let component: FeedbackDrawer;
  let fixture: ComponentFixture<FeedbackDrawer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeedbackDrawer],
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackDrawer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

```

# feedback-drawer.ts

```ts
import {
  Component, input, output, signal, computed,
  inject, OnChanges, SimpleChanges, HostListener
} from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Feedback, FeedbackStatus } from '../../../features/dashboard/feedbacks/feedbacks.types';
import { FeedbacksService } from '../../../features/dashboard/feedbacks/feedbacks.service';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';

@Component({
  selector: 'app-feedback-drawer',
  imports: [CommonModule, DatePipe],
  templateUrl: './feedback-drawer.html',
  styleUrl: './feedback-drawer.scss',
})
export class FeedbackDrawer implements OnChanges {

  // ─── Inputs / Outputs ─────────────────────────────────────────────────────
  readonly feedback = input<Feedback | null>(null);
  readonly open = input<boolean>(false);

  readonly closed = output<void>();
  readonly statusChanged = output<{ id: string; status: FeedbackStatus }>();

  // ─── Services ─────────────────────────────────────────────────────────────
  private readonly service = inject(FeedbacksService);
  private readonly dashboardContext = inject(DashboardContextService);

  // ─── State ────────────────────────────────────────────────────────────────
  updatingStatus = signal(false);
  statusError = signal('');

  // ─── Computed helpers ─────────────────────────────────────────────────────
  readonly priorityConfig = computed(() => {
    const priority = this.feedback()?.priority;
    const configs: Record<string, { label: string; cls: string }> = {
      Critical: { label: 'Critique', cls: 'critical' },
      High: { label: 'Haute', cls: 'high' },
      Normal: { label: 'Normale', cls: 'normal' },
      Low: { label: 'Basse', cls: 'low' },
    };
    return configs[priority ?? ''] ?? { label: priority ?? '—', cls: 'normal' };
  });

  readonly categoryConfig = computed(() => {
    const cat = this.feedback()?.category;
    const configs: Record<string, { label: string; emoji: string }> = {
      Bug: { label: 'Bug', emoji: '🐛' },
      FeatureRequest: { label: 'Fonctionnalité', emoji: '✨' },
      Question: { label: 'Question', emoji: '❓' },
      Uncategorized: { label: 'Non catégorisé', emoji: '📝' },
    };
    return configs[cat ?? ''] ?? { label: cat ?? '—', emoji: '📝' };
  });

  readonly sentimentConfig = computed(() => {
    const s = this.feedback()?.sentiment;
    const configs: Record<string, { emoji: string; cls: string }> = {
      Positive: { emoji: '😊', cls: 'positive' },
      Neutral: { emoji: '😐', cls: 'neutral' },
      Negative: { emoji: '😞', cls: 'negative' },
      Frustrated: { emoji: '😤', cls: 'frustrated' },
    };
    return configs[s ?? ''] ?? null;
  });

  readonly scoreClass = computed(() => {
    const score = this.feedback()?.priorityScore ?? 0;
    if (score >= 76) return 'critical';
    if (score >= 51) return 'high';
    return 'normal';
  });

  readonly statuses: { value: FeedbackStatus; label: string; emoji: string }[] = [
    { value: 'Todo', label: 'À traiter', emoji: '⏳' },
    { value: 'InProgress', label: 'En cours', emoji: '🔄' },
    { value: 'Done', label: 'Résolu', emoji: '✅' },
  ];

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open()) {
      this.statusError.set('');
    }
  }

  // ─── Keyboard: Escape ferme le drawer ─────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  close(): void {
    this.closed.emit();
  }

  setStatus(status: FeedbackStatus): void {
    const fb = this.feedback();
    if (!fb || fb.status === status || this.updatingStatus()) return;

    const projectId = this.dashboardContext.selectedProject()?.id;
    if (!projectId) return;

    this.updatingStatus.set(true);
    this.statusError.set('');

    this.service.updateStatus(projectId, fb.id, status).subscribe({
      next: () => {
        this.updatingStatus.set(false);
        this.statusChanged.emit({ id: fb.id, status });
      },
      error: () => {
        this.updatingStatus.set(false);
        this.statusError.set('Impossible de mettre à jour le statut.');
      }
    });
  }
}
```


# Commands\CreateFeedback\CreateFeedbackCommand.cs

```cs
﻿using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Commands.CreateFeedback
{
    public record CreateFeedbackCommand(string Content, Guid ProjectId) : IRequest<CreateFeedbackResult>;

    public record CreateFeedbackResult(Guid Id, string Content, string Category, string Priority, string Status, DateTime CreatedAt);
}

```

# Commands\CreateFeedback\CreateFeedbackHandler.cs

```cs
﻿using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Entities;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Domain.Exceptions;
using AutoMapper;
using Hangfire;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace AiReviewHub.Application.Feedbacks.Commands.CreateFeedback;

public class CreateFeedbackHandler : IRequestHandler<CreateFeedbackCommand, CreateFeedbackResult>
{
    private readonly IAppDbContext _context;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly ICurrentUserService _currentUser;
    private readonly IMapper _mapper;
    private readonly ILogger<CreateFeedbackHandler> _logger;
    private readonly IFeedbackAnalysisQueue _analysisQueue; // interface Application
    private readonly IPlanLimitsService _planLimits;


    public CreateFeedbackHandler(
        IAppDbContext context,
        IDateTimeProvider dateTimeProvider,
        ICurrentUserService currentUser,
        IMapper mapper,
        ILogger<CreateFeedbackHandler> logger,
        IFeedbackAnalysisQueue analysisQueue,
        IPlanLimitsService planLimits)
    {
        _context = context;
        _dateTimeProvider = dateTimeProvider;
        _currentUser = currentUser;
        _mapper = mapper;
        _logger = logger;
        _analysisQueue = analysisQueue;
        _planLimits = planLimits;
    }

    public async Task<CreateFeedbackResult> Handle(CreateFeedbackCommand request, CancellationToken cancellationToken)
    {
        // Vérifie que le projet existe, est actif et appartient à l'user
        var project = await _context.Projects
            .Include(p => p.User)
            .FirstOrDefaultAsync(p =>
                p.Id == request.ProjectId &&
                p.UserId == _currentUser.UserId &&
                p.IsActive,
                cancellationToken)
            ?? throw new NotFoundException("Project not found or inactive");

        // ── Vérification du quota mensuel ─────────────────────
        var quotaResult = await _planLimits.TryConsumeFeedbackSlotAsync(_currentUser.UserId, cancellationToken);
        if (!quotaResult.IsAllowed)
            throw new QuotaExceededException(
                current: quotaResult.Current,
                limit: quotaResult.Limit,
                resetDate: project.User.QuotaResetDate);


        // Crée le feedback via le Domain
        var feedback = Feedback.Create(
            request.Content,
            request.ProjectId,
            _dateTimeProvider.UtcNow
        );

        _context.Feedbacks.Add(feedback);
        await _context.SaveChangesAsync(cancellationToken);

        // Enqueue le job d'analyse IA selon le plan de l'utilisateur
        _analysisQueue.Enqueue(feedback.Id, project.User.Plan.ToString());

        _logger.LogInformation(
            "[Feedback] Created {FeedbackId} for project {ProjectId} — AI analysis enqueued (plan: {Plan})",
            feedback.Id, request.ProjectId, project.User.Plan);

        return _mapper.Map<CreateFeedbackResult>(feedback);
    }
}
```

# Commands\CreateFeedback\CreateFeedbackProfile.cs

```cs
﻿using AiReviewHub.Domain.Entities;
using AutoMapper;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Commands.CreateFeedback
{
    public class CreateFeedbackProfile : Profile
    {
        public CreateFeedbackProfile()
        {
            CreateMap<Feedback, CreateFeedbackResult>()
                .ForMember(dest => dest.Content,
                    opt => opt.MapFrom(src => src.Content.Value))
                .ForMember(dest => dest.Category,
                    opt => opt.MapFrom(src => src.Category.ToString()))
                .ForMember(dest => dest.Priority,
                    opt => opt.MapFrom(src => src.Priority.ToString()))
                .ForMember(dest => dest.Status,
                    opt => opt.MapFrom(src => src.Status.ToString()));
        }
    }
}

```

# Commands\CreateFeedback\CreateFeedbackValidator.cs

```cs
﻿using FluentValidation;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Commands.CreateFeedback
{
    public class CreateFeedbackValidator : AbstractValidator<CreateFeedbackCommand>
    {
        public CreateFeedbackValidator()
        {
            RuleFor(x => x.Content)
                .NotEmpty().WithMessage("Content is required")
                .MinimumLength(10).WithMessage("Content must be at least 10 characters")
                .MaximumLength(5000).WithMessage("Content cannot exceed 5000 characters");

            RuleFor(x => x.ProjectId)
                .NotEmpty().WithMessage("ProjectId is required");
        }
    }
}

```

# Commands\UpdateFeedbackStatus\UpdateFeedbackStatusCommand.cs

```cs
﻿using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Enums;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Commands.UpdateFeedbackStatus
{
    public record UpdateFeedbackStatusCommand(
        Guid FeedbackId,
        Guid ProjectId,
        FeedbackStatus NewStatus
    ) : IRequest<Unit>;
}

```

# Commands\UpdateFeedbackStatus\UpdateFeedbackStatusHandler.cs

```cs
﻿using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Commands.UpdateFeedbackStatus
{
    public class UpdateFeedbackStatusHandler
        : IRequestHandler<UpdateFeedbackStatusCommand, Unit>
    {
        private readonly IAppDbContext _context;
        private readonly IDateTimeProvider _dateTimeProvider;
        private readonly ICurrentUserService _currentUser;


        public UpdateFeedbackStatusHandler(IAppDbContext context, IDateTimeProvider dateTimeProvider, ICurrentUserService currentUser)
        {
            _context = context;
            _dateTimeProvider = dateTimeProvider;
            _currentUser = currentUser;
        }

        public async Task<Unit> Handle(
            UpdateFeedbackStatusCommand request,
            CancellationToken cancellationToken)
        {
            var feedback = await _context.Feedbacks
                .FirstOrDefaultAsync(f => f.Id == request.FeedbackId && f.ProjectId == request.ProjectId &&
                    f.Project.UserId == _currentUser.UserId, cancellationToken)
                ?? throw new NotFoundException($"Feedback {request.FeedbackId} not found");

            // La logique de transition est dans le Domain
            feedback.UpdateStatus(request.NewStatus, _dateTimeProvider.UtcNow);

            await _context.SaveChangesAsync(cancellationToken);

            return Unit.Value;
        }
    }
}

```

# Commands\UpdateFeedbackStatus\UpdateFeedbackStatusValidator.cs

```cs
﻿using FluentValidation;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Commands.UpdateFeedbackStatus
{
    public class UpdateFeedbackStatusValidator : AbstractValidator<UpdateFeedbackStatusCommand>
    {
        public UpdateFeedbackStatusValidator()
        {
            RuleFor(x => x.FeedbackId)
                .NotEmpty().WithMessage("FeedbackId is required");

            RuleFor(x => x.NewStatus)
                .IsInEnum().WithMessage("Invalid status value");
        }
    }
}

```

# Queries\ExportFeedbacksCsv\ExportFeedbacksCsvQuery.cs

```cs
﻿using AiReviewHub.Domain.Enums;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Queries.ExportFeedbacksCsv
{
    public record ExportFeedbacksCsvQuery(
        Guid ProjectId,
        FeedbackStatus? StatusFilter = null,
        FeedbackCategory? CategoryFilter = null,
        FeedbackPriority? PriorityFilter = null
    ) : IRequest<ExportFeedbacksCsvResult>;

    public record ExportFeedbacksCsvResult(
        byte[] Content,
        string FileName
    );
}

```

# Queries\ExportFeedbacksCsv\ExportFeedbacksCvsHandler.cs

```cs
﻿using AiReviewHub.Application.Abstractions;
using AiReviewHub.Domain.Abstractions;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Queries.ExportFeedbacksCsv
{
    public class ExportFeedbacksCsvHandler
        : IRequestHandler<ExportFeedbacksCsvQuery, ExportFeedbacksCsvResult>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;
        private readonly IDateTimeProvider _dateTimeProvider;

        public ExportFeedbacksCsvHandler(
            IAppDbContext context,
            ICurrentUserService currentUser,
            IDateTimeProvider dateTimeProvider)
        {
            _context = context;
            _currentUser = currentUser;
            _dateTimeProvider = dateTimeProvider;
        }

        public async Task<ExportFeedbacksCsvResult> Handle(
            ExportFeedbacksCsvQuery request,
            CancellationToken cancellationToken)
        {
            // Vérifie que le projet appartient à l'utilisateur
            var project = await _context.Projects
                .AsNoTracking()
                .FirstOrDefaultAsync(p =>
                    p.Id == request.ProjectId &&
                    p.UserId == _currentUser.UserId,
                    cancellationToken)
                ?? throw new NotFoundException("Project not found");

            // Vérifie le plan — export CSV réservé aux plans Pro+
            var user = await _context.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == _currentUser.UserId, cancellationToken)
                ?? throw new NotFoundException("User not found");

            if (user.Plan == Domain.Enums.Plan.Free)
                throw new ForbiddenException(
                    "CSV export is available on Pro and Team plans.");

            // Charge les feedbacks
            var query = _context.Feedbacks
                .AsNoTracking()
                .Where(f => f.ProjectId == request.ProjectId);

            if (request.StatusFilter.HasValue)
                query = query.Where(f => f.Status == request.StatusFilter.Value);

            if (request.CategoryFilter.HasValue)
                query = query.Where(f => f.Category == request.CategoryFilter.Value);

            if (request.PriorityFilter.HasValue)
                query = query.Where(f => f.Priority == request.PriorityFilter.Value);

            var feedbacks = await query
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync(cancellationToken);

            // Génère le CSV
            var csv = BuildCsv(feedbacks, project.Name);

            var fileName = $"feedbacks_{project.Name.ToLower().Replace(" ", "_")}_{_dateTimeProvider.UtcNow:yyyy-MM-dd}.csv";

            return new ExportFeedbacksCsvResult(
                Encoding.UTF8.GetBytes(csv),
                fileName);
        }

        private static string BuildCsv(
            IEnumerable<Domain.Entities.Feedback> feedbacks,
            string projectName)
        {
            var sb = new StringBuilder();

            // BOM UTF-8 pour Excel
            sb.Append('\uFEFF');

            // En-têtes
            sb.AppendLine(
                "ID;" +
                "Contenu;" +
                "Résumé IA;" +
                "Catégorie;" +
                "Priorité;" +
                "Statut;" +
                "Statut Analyse IA;" +
                "Date de création;" +
                "Dernière mise à jour");

            // Lignes
            foreach (var f in feedbacks)
            {
                sb.AppendLine(string.Join(";", new[]
                {
                    EscapeCsv(f.Id.ToString()),
                    EscapeCsv(f.Content.Value),
                    EscapeCsv(f.AiSummary),
                    EscapeCsv(f.Category.ToString()),
                    EscapeCsv(f.Priority.ToString()),
                    EscapeCsv(f.Status.ToString()),
                    EscapeCsv(f.AiAnalysisStatus.ToString()),
                    EscapeCsv(f.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")),
                    EscapeCsv(f.UpdatedAt?.ToString("yyyy-MM-dd HH:mm:ss") ?? ""),
                }));
            }

            return sb.ToString();
        }

        // Échappe les valeurs CSV — gère les virgules, guillemets et sauts de ligne
        private static string EscapeCsv(string value)
        {
            if (string.IsNullOrEmpty(value)) return "\"\"";

            // Si la valeur contient des guillemets, virgules ou sauts de ligne
            if (value.Contains('"') || value.Contains(',') || value.Contains('\n') || value.Contains('\r'))
            {
                return $"\"{value.Replace("\"", "\"\"")}\"";
            }

            return $"\"{value}\"";
        }
    }
}

```

# Queries\GetFeedbacksByProject\GetFeedbacksByProjectHandler.cs

```cs
﻿using AiReviewHub.Application.Abstractions;
using AiReviewHub.Application.Common.Models;
using AiReviewHub.Domain.Exceptions;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;

namespace AiReviewHub.Application.Feedbacks.Queries.GetFeedbacksByProject
{
    public class GetFeedbacksByProjectHandler : IRequestHandler<GetFeedbacksByProjectQuery, PagedResult<FeedbackDto>>
    {
        private readonly IAppDbContext _context;
        private readonly ICurrentUserService _currentUser;


        public GetFeedbacksByProjectHandler(IAppDbContext context, ICurrentUserService currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<PagedResult<FeedbackDto>> Handle(GetFeedbacksByProjectQuery request, CancellationToken cancellationToken)
        {
            var pageSize = Math.Clamp(request.PageSize, 1, 100);
            var page = Math.Max(request.Page, 1);

            // Vérifie que le projet existe

            var projectExists = await _context.Projects
                .AnyAsync(p =>
                    p.Id == request.ProjectId &&
                    p.UserId == _currentUser.UserId,
                    cancellationToken);

            if (!projectExists)
                throw new NotFoundException($"Project {request.ProjectId} not found");


            // Construction de la query avec filtres optionnels
            var query = _context.Feedbacks
                .AsNoTracking()
                .Where(f => f.ProjectId == request.ProjectId);

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                var search = request.Search.ToLowerInvariant();
                query = query.Where(f =>
                    f.Content.Value.ToLower().Contains(search) ||
                    f.AiSummary.ToLower().Contains(search));
            }

            if (request.StatusFilter.HasValue)
                query = query.Where(f => f.Status == request.StatusFilter.Value);

            if (request.CategoryFilter.HasValue)
                query = query.Where(f => f.Category == request.CategoryFilter.Value);

            if (request.PriorityFilter.HasValue)
                query = query.Where(f => f.Priority == request.PriorityFilter.Value);

            var total = await query.CountAsync(cancellationToken);

            var feedbacks = await query
                .OrderByDescending(f => f.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync(cancellationToken);

            var dtos = feedbacks
                .Select(f => new FeedbackDto(
                    f.Id,
                    f.Content.Value,
                    f.AiSummary,
                    f.Category.ToString(),
                    f.Priority.ToString(),
                    f.Status.ToString(),
                    f.AiAnalysisStatus.ToString(),
                    f.PriorityScore,
                    f.Sentiment,
                    f.SentimentScore,
                    f.KeyTopics is not null
                        ? JsonSerializer.Deserialize<string[]>(f.KeyTopics) ?? []
                        : [],
                    f.ActionRequired,
                    f.Urgency,
                    f.CreatedAt,
                    f.UpdatedAt
                ))
                .ToList();

            return new PagedResult<FeedbackDto>(dtos, PaginationMeta.Create(total, page, pageSize));
        }
    }
}

```

# Queries\GetFeedbacksByProject\GetFeedbacksByProjectQuery.cs

```cs
﻿using AiReviewHub.Application.Common.Models;
using AiReviewHub.Domain.Enums;
using MediatR;
using System;
using System.Collections.Generic;
using System.Text;

namespace AiReviewHub.Application.Feedbacks.Queries.GetFeedbacksByProject
{
    public record GetFeedbacksByProjectQuery(
        Guid ProjectId,
        FeedbackStatus? StatusFilter = null,
        FeedbackCategory? CategoryFilter = null,
        FeedbackPriority? PriorityFilter = null,
        string? Search = null,
        int Page = 1,
        int PageSize = 20
    ) : IRequest<PagedResult<FeedbackDto>>;

    public record GetFeedbacksByProjectResult(
        IReadOnlyList<FeedbackDto> Feedbacks,
        int TotalCount
    );

    public record FeedbackDto(
        Guid Id,
        string Content,
        string AiSummary,
        string Category,
        string Priority,
        string Status,
        string AiAnalysisStatus,
        // Champs Pro — null si Free
        int? PriorityScore,
        string? Sentiment,
        int? SentimentScore,
        string[] KeyTopics,
        bool? ActionRequired,
        string? Urgency,
        DateTime CreatedAt,
        DateTime? UpdatedAt
    );
}

```



