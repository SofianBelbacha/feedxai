import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { DashboardStats, TrendPoint, RecentFeedback, CategoryStat, ProjectStat, AutoInsights, StatusStat } from './overview.types';

export interface DashboardData {
  stats: DashboardStats;
  trends: TrendPoint[];
  recentFeedbacks: RecentFeedback[];
  categoryStats: CategoryStat[];
  statusStats: StatusStat[];
  projectStats: ProjectStat[];
  autoInsights: AutoInsights | null;
  hasAnyFeedbacks: boolean;  
  hasDataInPeriod: boolean;           
}

@Injectable({ providedIn: 'root' })
export class OverviewService {
  private readonly http = inject(HttpClient);
  private readonly API  = environment.apiUrl;

  getDashboard(projectId?: string, days = 30): Observable<DashboardData> {
    const params = new URLSearchParams();
    if (projectId) params.set('projectId', projectId);
    params.set('days', days.toString());

    return this.http.get<DashboardData>(
      `${this.API}/dashboard?${params}`,
      { withCredentials: true }
    );
  }
}