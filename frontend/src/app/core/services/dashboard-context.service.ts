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