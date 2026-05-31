import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardStats, TrendPoint, RecentFeedback, CategoryStat, AiInsights, ProjectStat } from './overview.types';

export interface DashboardData {
  stats:           DashboardStats;
  trends:          TrendPoint[];
  recentFeedbacks: RecentFeedback[];
  categoryStats:   CategoryStat[];
  projectStats:    ProjectStat[];
  aiInsights:      AiInsights | null;
}

@Injectable({ providedIn: 'root' })
export class OverviewService {
  private readonly http = inject(HttpClient);
  private readonly API  = environment.apiUrl;

  getDashboard(projectId?: string, days: number = 30): Observable<DashboardData> {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    params.set('days', days.toString());

    return this.http.get<DashboardData>(
      `${this.API}/dashboard?${params}`,
      { withCredentials: true }
    );
  }
}