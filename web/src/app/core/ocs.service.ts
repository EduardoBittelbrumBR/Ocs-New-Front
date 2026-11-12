import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ComputerDetail, ComputerRow, SoftwareAgg, SqlServerInstance, Stats, UpdateStatus } from './models';

@Injectable({ providedIn: 'root' })
export class OcsService {
  private http = inject(HttpClient);
  private base = '/api';

  computers(): Observable<ComputerRow[]> {
    return this.http.get<ComputerRow[]>(`${this.base}/computers`);
  }

  computer(id: number | string): Observable<ComputerDetail> {
    return this.http.get<ComputerDetail>(`${this.base}/computers/${id}`);
  }

  stats(): Observable<Stats> {
    return this.http.get<Stats>(`${this.base}/stats`);
  }

  software(): Observable<SoftwareAgg[]> {
    return this.http.get<SoftwareAgg[]>(`${this.base}/software`);
  }

  saveDescription(id: number | string, description: string): Observable<{ ok: boolean; description: string }> {
    return this.http.patch<{ ok: boolean; description: string }>(`${this.base}/computers/${id}/description`, { description });
  }

  saveAdmin(id: number | string, fields: Record<string, string>): Observable<{ ok: boolean; fields: Record<string, string> }> {
    return this.http.patch<{ ok: boolean; fields: Record<string, string> }>(`${this.base}/computers/${id}/admin`, { fields });
  }

  adminOptions(): Observable<Record<string, string[]>> {
    return this.http.get<Record<string, string[]>>(`${this.base}/admin-options`);
  }

  sqlserver(): Observable<SqlServerInstance[]> {
    return this.http.get<SqlServerInstance[]>(`${this.base}/sqlserver`);
  }

  updatesReport(type: 'servers' | 'workstations'): Observable<UpdateStatus[]> {
    return this.http.get<UpdateStatus[]>(`${this.base}/updates-report`, { params: { type } });
  }

  system(): Observable<SystemInfo> {
    return this.http.get<SystemInfo>(`${this.base}/system`);
  }

  suggestions(): Observable<Suggestion[]> {
    return this.http.get<Suggestion[]>(`${this.base}/suggestions`);
  }

  addSuggestion(text: string): Observable<{ ok: boolean; item: Suggestion }> {
    return this.http.post<{ ok: boolean; item: Suggestion }>(`${this.base}/suggestions`, { text });
  }
}

export interface Suggestion {
  id: number;
  text: string;
  author: string;
  createdAt: string;
}

export interface SystemInfo {
  app: { node: string; uptimeSec: number; pid: number; cacheTtlSec: number; authEnabled: boolean; baseUrl: string | null };
  db: { engine: string; version: string | null; name: string; host: string; port: number; sizeMb: number | null; tables: number | null };
  inventory: { computers: number; servers: number; workstations: number; softwareDistinct: number | null };
}
