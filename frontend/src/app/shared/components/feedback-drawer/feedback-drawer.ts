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