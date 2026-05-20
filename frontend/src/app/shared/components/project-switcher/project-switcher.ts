import {
  Component, inject, signal, computed,
  HostListener, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { DashboardContextService } from '../../../core/services/dashboard-context.service';
import { ProjectsService } from '../../../features/dashboard/projects/projects.service';
import { Project } from '../../../features/dashboard/projects/projects.types';

@Component({
  selector: 'app-project-switcher',
  imports: [CommonModule],
  templateUrl: './project-switcher.html',
  styleUrl: './project-switcher.scss',
})
export class ProjectSwitcher implements OnInit {

  // ─── Services ─────────────────────────────────────────────────────────────
  private readonly dashboardContext = inject(DashboardContextService);
  private readonly projectsService  = inject(ProjectsService);
  private readonly router           = inject(Router);

  // ─── State ────────────────────────────────────────────────────────────────
  open     = signal(false);
  loading  = signal(false);
  projects = signal<Project[]>([]);

  // ─── Computed ─────────────────────────────────────────────────────────────
  readonly currentProject = this.dashboardContext.selectedProject;

  readonly currentInitial = computed(() => {
    const name = this.currentProject()?.name;
    return name ? name.charAt(0).toUpperCase() : '?';
  });

  readonly currentColor = computed(() =>
    this.getProjectColor(this.currentProject()?.id ?? '')
  );

  // Projets actifs uniquement, projet courant en tête
  readonly sortedProjects = computed(() => {
    const current = this.currentProject();
    return [...this.projects()]
      .filter(p => p.isActive)
      .sort((a, b) => {
        if (current?.id === a.id) return -1;
        if (current?.id === b.id) return  1;
        return 0;
      });
  });

  // ─── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadProjects();
  }

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.open()) this.close();
  }

  // ─── Actions ──────────────────────────────────────────────────────────────
  toggle(): void {
    if (!this.open()) {
      this.open.set(true);
      this.loadProjects();
    } else {
      this.close();
    }
  }

  close(): void {
    this.open.set(false);
  }

  selectProject(project: Project): void {
    this.dashboardContext.setProject(project);
    this.close();
    this.router.navigate(['/dashboard/feedbacks']);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('ps-backdrop')) {
      this.close();
    }
  }

  // ─── Data ─────────────────────────────────────────────────────────────────
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

  // ─── Helpers ──────────────────────────────────────────────────────────────
  getInitials(name: string): string {
    return name.split(' ').map(w => w[0] ?? '').join('').toUpperCase().slice(0, 2);
  }

  getProjectColor(id: string): string {
    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#F43F5E'];
    if (!id) return colors[0];
    return colors[id.charCodeAt(0) % colors.length];
  }

  isSelected(project: Project): boolean {
    return this.currentProject()?.id === project.id;
  }
}