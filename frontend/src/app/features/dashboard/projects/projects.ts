import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DeletedProject, Project } from './projects.types';
import { ProjectsService } from './projects.service';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects implements OnInit {
  private readonly service        = inject(ProjectsService);
  private readonly router         = inject(Router);
  private readonly dashboardContext = inject(DashboardContextService);

  // ─── State liste ──────────────────────────────────────────────────────────
  loading  = signal(true);
  error    = signal('');
  projects = signal<Project[]>([]);

  // ─── State création ───────────────────────────────────────────────────────
  showModal   = signal(false);
  creating    = signal(false);
  createError = signal('');
  newName        = signal('');
  newDescription = signal('');

  // ─── State copie widget ───────────────────────────────────────────────────
  copiedToken      = signal<string | null>(null);
  showSnippetModal = signal(false);
  snippetToCopy    = signal('');

  // ─── State menu contextuel ────────────────────────────────────────────────
  openMenuId = signal<string | null>(null);

  // ─── State édition ────────────────────────────────────────────────────────
  showEditModal   = signal(false);
  editingProject  = signal<Project | null>(null);
  editName        = signal('');
  editDescription = signal('');
  editError       = signal('');
  saving          = signal(false);

  // ─── State suppression ────────────────────────────────────────────────────
  showDeleteModal  = signal(false);
  deletingProject  = signal<Project | null>(null);
  deleting         = signal(false);
  deleteError      = signal('');

  // ─── State régénération token ─────────────────────────────────────────────
  showRegenerateModal  = signal(false);
  regeneratingProject  = signal<Project | null>(null);
  regenerating         = signal(false);
  regenerateError      = signal('');

  // ─── State corbeille ──────────────────────────────────────────────────────
  deletedProjects = signal<DeletedProject[]>([]);
  showTrash       = signal(false);
  loadingTrash    = signal(false);
  restoringId     = signal<string | null>(null);

  // ─── Plan & limites ───────────────────────────────────────────────────────
  readonly plan         = this.dashboardContext.plan;
  readonly projectLimit = this.dashboardContext.projectLimit;

  readonly canCreateMore = computed(() =>
    this.projects().length < this.projectLimit()
  );

  readonly activeProjects = computed(() =>
    this.projects().filter(p => p.isActive)
  );

  // ─── KPIs calculés localement ────────────────────────────────────────────
  readonly totalFeedbacks = computed(() =>
    this.projects().reduce((sum, p) => sum + p.feedbackCount, 0)
  );

  readonly mostActiveProject = computed(() =>
    [...this.projects()].sort((a, b) => b.feedbackCount - a.feedbackCount)[0] ?? null
  );

  readonly widgetActiveCount = computed(() =>
    this.projects().filter(p => p.feedbackCount > 0).length
  );

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.getAll().subscribe({
      next:  (result) => { this.projects.set(result.data); this.loading.set(false); },
      error: ()       => { this.error.set('Impossible de charger les projets.'); this.loading.set(false); }
    });
  }

  // ─── Création ─────────────────────────────────────────────────────────────
  openModal(): void {
    this.newName.set('');
    this.newDescription.set('');
    this.createError.set('');
    this.showModal.set(true);
  }

  closeModal(): void { this.showModal.set(false); }

  onCreate(): void {
    this.createError.set('');
    const name = this.newName().trim();
    if (!name) { this.createError.set('Le nom du projet est requis.'); return; }
    if (name.length > 100) { this.createError.set('Le nom ne peut pas dépasser 100 caractères.'); return; }

    this.creating.set(true);
    this.service.create({ name, description: this.newDescription().trim() }).subscribe({
      next: (project) => {
        this.projects.update(list => [project, ...list]);
        this.creating.set(false);
        this.closeModal();
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(
          err.status === 403
            ? `Plan ${this.plan()} limité à ${this.projectLimit()} projet(s). Passez à Pro pour en créer plus.`
            : 'Erreur lors de la création. Réessayez.'
        );
      }
    });
  }

  // ─── Navigation ───────────────────────────────────────────────────────────
  openFeedbacks(project: Project): void {
    this.dashboardContext.setProject(project);
    this.router.navigate(['/dashboard/feedbacks']);
  }

  // ─── Menu contextuel ──────────────────────────────────────────────────────
  toggleMenu(projectId: string, event: Event): void {
    event.stopPropagation();
    this.openMenuId.update(id => id === projectId ? null : projectId);
  }

  closeMenu(): void { this.openMenuId.set(null); }

  // ─── Copier le snippet widget ─────────────────────────────────────────────
  copyToken(project: Project, event?: Event): void {
    event?.stopPropagation();
    this.closeMenu();
    const snippet =
    `<script src="${environment.widgetCdnUrl}"></script>
      <ai-review-hub
        token="${project.publicToken}"
        api-url="${environment.apiUrl}"
        mode="floating">
      </ai-review-hub>`;
    this.writeToClipboard(snippet, project.id);
  }

  private async writeToClipboard(text: string, projectId: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.onCopied(projectId);
    } catch {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }) })
        ]);
        this.onCopied(projectId);
      } catch {
        this.snippetToCopy.set(text);
        this.showSnippetModal.set(true);
      }
    }
  }

  private onCopied(projectId: string): void {
    this.copiedToken.set(projectId);
    setTimeout(() => this.copiedToken.set(null), 2000);
  }

  closeSnippetModal(): void {
    this.showSnippetModal.set(false);
    this.snippetToCopy.set('');
  }

  // ─── Édition ──────────────────────────────────────────────────────────────
  openEditModal(project: Project, event?: Event): void {
    event?.stopPropagation();
    this.closeMenu();
    this.editingProject.set(project);
    this.editName.set(project.name);
    this.editDescription.set(project.description);
    this.editError.set('');
    this.showEditModal.set(true);
  }

  closeEditModal(): void {
    this.showEditModal.set(false);
    this.editingProject.set(null);
  }

  onSaveEdit(): void {
    const project = this.editingProject();
    if (!project) return;

    const name = this.editName().trim();
    if (!name) { this.editError.set('Le nom est requis.'); return; }
    if (name.length > 100) { this.editError.set('100 caractères max.'); return; }
    if (this.editDescription().length > 500) { this.editError.set('500 caractères max.'); return; }

    this.saving.set(true);
    this.editError.set('');

    this.service.update(project.id, { name, description: this.editDescription().trim() }).subscribe({
      next: (updated) => {
        this.projects.update(list =>
          list.map(p => p.id === updated.id ? { ...p, name: updated.name, description: updated.description } : p)
        );
        this.saving.set(false);
        this.closeEditModal();
      },
      error: (err) => {
        this.saving.set(false);
        this.editError.set(err.error?.errors?.Name?.[0] ?? err.error?.error ?? 'Erreur. Réessayez.');
      }
    });
  }

  // ─── Suppression ──────────────────────────────────────────────────────────
  openDeleteModal(project: Project, event?: Event): void {
    event?.stopPropagation();
    this.closeMenu();
    this.deletingProject.set(project);
    this.deleteError.set('');
    this.showDeleteModal.set(true);
  }

  closeDeleteModal(): void {
    this.showDeleteModal.set(false);
    this.deletingProject.set(null);
  }

  onConfirmDelete(): void {
    const project = this.deletingProject();
    if (!project) return;

    this.deleting.set(true);
    this.deleteError.set('');

    this.service.delete(project.id).subscribe({
      next: () => {
        this.projects.update(list => list.filter(p => p.id !== project.id));
        this.deleting.set(false);
        this.closeDeleteModal();
      },
      error: () => {
        this.deleting.set(false);
        this.deleteError.set('Erreur lors de la suppression. Réessayez.');
      }
    });
  }

  // ─── Régénération token ───────────────────────────────────────────────────
  openRegenerateModal(project: Project, event?: Event): void {
    event?.stopPropagation();
    this.closeMenu();
    this.regeneratingProject.set(project);
    this.regenerateError.set('');
    this.showRegenerateModal.set(true);
  }

  closeRegenerateModal(): void {
    this.showRegenerateModal.set(false);
    this.regeneratingProject.set(null);
  }

  onConfirmRegenerate(): void {
    const project = this.regeneratingProject();
    if (!project) return;

    this.regenerating.set(true);
    this.regenerateError.set('');

    this.service.regenerateToken(project.id).subscribe({
      next: ({ publicToken }) => {
        // Mise à jour optimiste du token dans la liste
        this.projects.update(list =>
          list.map(p => p.id === project.id ? { ...p, publicToken } : p)
        );
        this.regenerating.set(false);
        this.closeRegenerateModal();
      },
      error: () => {
        this.regenerating.set(false);
        this.regenerateError.set('Erreur lors de la régénération. Réessayez.');
      }
    });
  }

  // ─── Corbeille ────────────────────────────────────────────────────────────
  toggleTrash(): void {
    this.showTrash.update(v => !v);
    if (this.showTrash() && this.deletedProjects().length === 0) this.loadTrash();
  }

  loadTrash(): void {
    this.loadingTrash.set(true);
    this.service.getDeleted().subscribe({
      next:  (projects) => { this.deletedProjects.set(projects); this.loadingTrash.set(false); },
      error: ()         => this.loadingTrash.set(false)
    });
  }

  onRestore(project: DeletedProject): void {
    this.restoringId.set(project.id);
    this.service.restore(project.id).subscribe({
      next: () => {
        this.deletedProjects.update(list => list.filter(p => p.id !== project.id));
        this.restoringId.set(null);
        this.load();
      },
      error: () => this.restoringId.set(null)
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  getProjectColor(id: string): string {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#F43F5E'];
    return colors[id.charCodeAt(0) % colors.length];
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  trackById(_: number, item: Project | DeletedProject): string { return item.id; }
}
