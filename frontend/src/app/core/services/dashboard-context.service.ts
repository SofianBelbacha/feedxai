import { Injectable, computed, inject, signal } from '@angular/core';
import { UserService } from './user.service';
import { Project } from '../../features/dashboard/projects/projects.types';

@Injectable({
  providedIn: 'root'
})
export class DashboardContextService {
  private readonly userService = inject(UserService);

  private readonly STORAGE_KEY = 'selectedProject';

  // ─── Projet actif global ───────────────────────────
  readonly selectedProject = signal<Project | null>(null);

  constructor() {
    const saved = localStorage.getItem(this.STORAGE_KEY);

    if (saved) {
      try {
        this.selectedProject.set(JSON.parse(saved));
      } catch {
        localStorage.removeItem(this.STORAGE_KEY);
      }
    }
  }

  setProject(project: Project): void {
    this.selectedProject.set(project);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(project));
  }

  clearProject(): void {
    this.selectedProject.set(null);
    localStorage.removeItem(this.STORAGE_KEY);
  }

  // ─── Plan dynamique ────────────────────────────────
  readonly plan = computed(() =>
    this.userService.profile()?.plan ?? 'Free'
  );

  readonly projectLimit = computed(() => {
    switch (this.plan()) {
      case 'Team':
        return Infinity;
      case 'Pro':
        return 10;
      default:
        return 1;
    }
  });
}