import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Project } from './projects.types';
import { ProjectsService } from './projects.service';
import { Router } from '@angular/router';
import { UserService } from '../../../core/services/user.service';
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
  private readonly userService = inject(UserService);
  private readonly dashboardContext = inject(DashboardContextService);

  // ─── State ────────────────────────────────────────────────
  loading = signal(true);
  error = signal('');
  projects = signal<Project[]>([]);
  showModal = signal(false);
  creating = signal(false);
  createError = signal('');
  copiedToken = signal<string | null>(null);
  showSnippetModal = signal(false);
  snippetToCopy   = signal('');


  // ─── Formulaire création ──────────────────────────────────
  newName = signal('');
  newDescription = signal('');

  // ─── Computed ─────────────────────────────────────────────
  readonly plan = computed(() => this.userService.profile()?.plan ?? 'Free');

  readonly projectLimit = computed(() => {
    switch (this.plan()) {
      case 'Team': return Infinity;
      case 'Pro': return 10;
      default: return 1;
    }
  });

  readonly canCreateMore = computed(() =>
    this.projects().length < this.projectLimit()
  );

  readonly activeProjects = computed(() =>
    this.projects().filter(p => p.isActive));

  // ─── Lifecycle ────────────────────────────────────────────
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

  // ─── Création ─────────────────────────────────────────────
  openModal(): void {
    this.newName.set('');
    this.newDescription.set('');
    this.createError.set('');
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  closeSnippetModal(): void {
    this.showSnippetModal.set(false);
    this.snippetToCopy.set('');
  }

  onCreate(): void {
    this.createError.set('');

    const name = this.newName().trim();
    if (!name) {
      this.createError.set('Le nom du projet est requis.');
      return;
    }
    if (name.length > 100) {
      this.createError.set('Le nom ne peut pas dépasser 100 caractères.');
      return;
    }

    this.creating.set(true);

    this.service.create({
      name,
      description: this.newDescription().trim()
    }).subscribe({
      next: (project) => {
        this.projects.update(list => [project, ...list]);
        this.creating.set(false);
        this.closeModal();
      },
      error: (err) => {
        this.creating.set(false);
        if (err.status === 403) {
          this.createError.set(
            `Votre plan ${this.plan()} est limité à ${this.projectLimit()} projet(s). Passez à Pro pour en créer plus.`
          );
        } else {
          this.createError.set('Erreur lors de la création. Réessayez.');
        }
      }
    });
  }

  // ─── Navigation vers feedbacks ────────────────────────────
  openFeedbacks(project: Project): void {
    this.dashboardContext.setProject(project);
    this.router.navigate([
      '/dashboard/projects', project.id, 'feedbacks'
    ]);
  }

  // ─── Copier le token public ───────────────────────────────
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
      // API moderne — disponible sur tous les navigateurs récents en HTTPS
      await navigator.clipboard.writeText(text);
      this.onCopied(projectId);
    } catch {
      // Fallback — ClipboardItem avec permission explicite
      try {
        const item = new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' })
        });
        await navigator.clipboard.write([item]);
        this.onCopied(projectId);
      } catch {
        // Dernier recours — affiche le snippet dans une alerte
        // pour que l'utilisateur puisse le copier manuellement
        this.showManualCopy(text);
      }
    }
  }

  private onCopied(projectId: string): void {
    this.copiedToken.set(projectId);
    setTimeout(() => this.copiedToken.set(null), 2000);
  }

  private showManualCopy(text: string): void {
    // Ouvre une modal avec le snippet pour copie manuelle
    this.snippetToCopy.set(text);
    this.showSnippetModal.set(true);
  }
  // ─── Helpers ──────────────────────────────────────────────
  getInitials(name: string): string {
    return name
      .split(' ')
      .map(w => w[0] ?? '')
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  getProjectColor(id: string): string {
    const colors = [
      '#3B82F6', '#8B5CF6', '#EC4899',
      '#F59E0B', '#10B981', '#F43F5E',
    ];
    const index = id.charCodeAt(0) % colors.length;
    return colors[index];
  }

  trackById(_: number, item: Project): string {
    return item.id;
  }
}

