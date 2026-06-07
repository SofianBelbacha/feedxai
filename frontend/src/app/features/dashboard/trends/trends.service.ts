import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { TrendsData } from './trends.types';

@Injectable({ providedIn: 'root' })
export class TrendsService {
  private readonly http = inject(HttpClient);
  private readonly API = environment.apiUrl;

  getTrends(params: {
    days: number;
    projectId?: string;
    category?: string;
    priority?: string;
  }): Observable<TrendsData> {
    let httpParams = new HttpParams().set('days', params.days.toString());
    if (params.projectId) httpParams = httpParams.set('projectId', params.projectId);
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.priority) httpParams = httpParams.set('priority', params.priority);

    return this.http.get<TrendsData>(
      `${this.API}/trends`,
      { params: httpParams, withCredentials: true }
    );
  }

  exportCsv(params: {
    days: number;
    projectId?: string;
    category?: string;
    priority?: string;
  }): Observable<Blob> {
    let httpParams = new HttpParams().set('days', params.days.toString());
    if (params.projectId) httpParams = httpParams.set('projectId', params.projectId);
    if (params.category) httpParams = httpParams.set('category', params.category);
    if (params.priority) httpParams = httpParams.set('priority', params.priority);

    return this.http.get(
      `${this.API}/trends/export`,
      { params: httpParams, responseType: 'blob', withCredentials: true }
    );
  }
}