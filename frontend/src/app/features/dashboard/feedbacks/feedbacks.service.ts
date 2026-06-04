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

    if (filters.search) params = params.set('search', filters.search);
    if (filters.category) params = params.set('category', filters.category);
    if (filters.priority) params = params.set('priority', filters.priority);
    if (filters.status) params = params.set('status', filters.status);  // ← corrigé
    if (filters.sortBy) params = params.set('sortBy', filters.sortBy);
    if (filters.actionRequired) params = params.set('actionRequired', 'true');
    if (filters.sentiment) params = params.set('sentiment', filters.sentiment);
    if (filters.minScore != null) params = params.set('minScore', filters.minScore);

    return this.http.get<PagedResult<Feedback>>(
      `${this.API}/projects/${projectId}/feedbacks`,
      { params, withCredentials: true }
    );
  }

  updateStatus(projectId: string, feedbackId: string, newStatus: FeedbackStatus): Observable<void> {
    return this.http.patch<void>(
      `${this.API}/projects/${projectId}/feedbacks/${feedbackId}/status`,
      { newStatus },
      { withCredentials: true }
    );
  }

  exportCsv(projectId: string, filters: Partial<FeedbackFilters>): Observable<Blob> {
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