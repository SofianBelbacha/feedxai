import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DeletedProject, Project } from './projects.types';
import { ProjectsService } from './projects.service';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';

@Component({
  selector: 'app-projects',
  imports: [CommonModule, FormsModule],
  templateUrl: './projects.html',
  styleUrl: './projects.scss',
})
export class Projects implements OnInit {
  private readonly service = inject(ProjectsService);
  private readonly router = inject(Router);
  private readonly dashboardContext = inject(DashboardContextService);

  // ─── State ────────────────────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  projects = signal<Project[]>([]);
  showModal = signal(false);
  creating = signal(false);
  createError = signal('');
  copiedToken = signal<string | null>(null);
  showSnippetModal = signal(false);
  snippetToCopy = signal('');

  newName = signal('');
  newDescription = signal('');

  // ─── State édition ────────────────────────────────────────────────────────
  showEditModal = signal(false);
  editingProject = signal<Project | null>(null);
  editName = signal('');
  editDescription = signal('');
  editError = signal('');
  saving = signal(false);

  // ─── State suppression ────────────────────────────────────────────────────
  showDeleteModal = signal(false);
  deletingProject = signal<Project | null>(null);
  deleting = signal(false);
  deleteError = signal('');

  // ─── State corbeille ──────────────────────────────────────────────────────
  deletedProjects = signal<DeletedProject[]>([]);
  showTrash = signal(false);
  loadingTrash = signal(false);
  restoringId = signal<string | null>(null);



  // ─── Plan & limites — source unique : DashboardContextService ─────────────
  // UserService n'est plus injecté ici : évite deux sources de vérité pour plan/limit.
  readonly plan = this.dashboardContext.plan;
  readonly projectLimit = this.dashboardContext.projectLimit;

  readonly canCreateMore = computed(() =>
    this.projects().length < this.projectLimit()
  );

  readonly activeProjects = computed(() =>
    this.projects().filter(p => p.isActive)
  );

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.service.getAll().subscribe({
      next: (result) => {
        this.projects.set(result.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les projets.');
        this.loading.set(false);
      }
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
  closeSnippetModal(): void { this.showSnippetModal.set(false); this.snippetToCopy.set(''); }

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
            ? `Votre plan ${this.plan()} est limité à ${this.projectLimit()} projet(s). Passez à Pro pour en créer plus.`
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

  // ─── Copier le token ──────────────────────────────────────────────────────
  copyToken(project: Project): void {
    const snippet = `<script src="http://localhost:3000/widget.iife.js"></script>
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
        this.showManualCopy(text);
      }
    }
  }

  private onCopied(projectId: string): void {
    this.copiedToken.set(projectId);
    setTimeout(() => this.copiedToken.set(null), 2000);
  }

  private showManualCopy(text: string): void {
    this.snippetToCopy.set(text);
    this.showSnippetModal.set(true);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  getProjectColor(id: string): string {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#F43F5E'];
    return colors[id.charCodeAt(0) % colors.length];
  }

  trackById(_: number, item: Project): string { return item.id; }


  // ─── Édition ──────────────────────────────────────────────────────────────
  openEditModal(project: Project): void {
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
    if (name.length > 100) { this.editError.set('Le nom ne peut pas dépasser 100 caractères.'); return; }
    if (this.editDescription().length > 500) { this.editError.set('La description ne peut pas dépasser 500 caractères.'); return; }

    this.saving.set(true);
    this.editError.set('');

    this.service.update(project.id, {
      name,
      description: this.editDescription().trim()
    }).subscribe({
      next: (updated) => {
        // Mise à jour optimiste dans la liste locale
        this.projects.update(list =>
          list.map(p => p.id === updated.id
            ? { ...p, name: updated.name, description: updated.description }
            : p
          )
        );
        this.saving.set(false);
        this.closeEditModal();
      },
      error: (err) => {
        this.saving.set(false);
        this.editError.set(
          err.error?.errors?.Name?.[0]
          ?? err.error?.error
          ?? 'Erreur lors de la sauvegarde. Réessayez.'
        );
      }
    });
  }

  // ─── Suppression ──────────────────────────────────────────────────────────
  openDeleteModal(project: Project): void {
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
        // Retrait optimiste de la liste
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

  toggleTrash(): void {
    this.showTrash.update(v => !v);
    if (this.showTrash() && this.deletedProjects().length === 0) {
      this.loadTrash();
    }
  }

  loadTrash(): void {
    this.loadingTrash.set(true);
    this.service.getDeleted().subscribe({
      next: (projects) => {
        this.deletedProjects.set(projects);
        this.loadingTrash.set(false);
      },
      error: () => this.loadingTrash.set(false)
    });
  }

  onRestore(project: DeletedProject): void {
    this.restoringId.set(project.id);

    this.service.restore(project.id).subscribe({
      next: () => {
        // Retirer de la corbeille
        this.deletedProjects.update(list => list.filter(p => p.id !== project.id));
        this.restoringId.set(null);
        // Recharger la liste active
        this.load();
      },
      error: () => this.restoringId.set(null)
    });
  }
}