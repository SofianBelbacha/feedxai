import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { Project, CreateProjectRequest, UpdateProjectResult, UpdateProjectRequest } from './projects.types';

export interface PagedResult<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly API  = environment.apiUrl;

  getAll(): Observable<PagedResult<Project>> {
    return this.http.get<PagedResult<Project>>(
      `${this.API}/projects`,
      { withCredentials: true }
    );
  }

  create(request: CreateProjectRequest): Observable<Project> {
    return this.http.post<Project>(
      `${this.API}/projects`,
      request,
      { withCredentials: true }
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.API}/projects/${id}`,
      { withCredentials: true }
    );
  }

  update(id: string, request: UpdateProjectRequest): Observable<UpdateProjectResult> {
    return this.http.put<UpdateProjectResult>(
      `${this.API}/projects/${id}`,
      request,
      { withCredentials: true }
    );
  }
  
  regenerateToken(id: string): Observable<{ publicToken: string }> {
    return this.http.post<{ publicToken: string }>(
      `${this.API}/projects/${id}/regenerate-token`,
      {},
      { withCredentials: true }
    );
  }
}