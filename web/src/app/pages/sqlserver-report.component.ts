import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { OcsService } from '../core/ocs.service';
import { SqlServerInstance } from '../core/models';

type EditionFilter = 'Todas' | 'Standard' | 'Developer' | 'Express';

@Component({
  selector: 'app-sqlserver-report',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatTableModule, MatSortModule, MatPaginatorModule,
    MatIconModule, MatButtonModule, MatButtonToggleModule, MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div>
          <h1>Instâncias SQL Server</h1>
          <p class="muted" *ngIf="!loading">
            {{ ds.filteredData.length }} instâncias em {{ serverCount() }} servidores
          </p>
        </div>
        <button mat-flat-button class="btn-green" (click)="exportCsv()" [disabled]="loading || !ds.data.length">
          <mat-icon>download</mat-icon> Exportar CSV
        </button>
      </div>

      <mat-button-toggle-group class="scopes" [value]="editionFilter" (change)="setEdition($event.value)" *ngIf="!loading">
        <mat-button-toggle value="Todas">Todas</mat-button-toggle>
        <mat-button-toggle value="Standard">Standard</mat-button-toggle>
        <mat-button-toggle value="Developer">Developer</mat-button-toggle>
        <mat-button-toggle value="Express">Express</mat-button-toggle>
      </mat-button-toggle-group>

      <mat-progress-bar *ngIf="loading" mode="indeterminate" color="primary"></mat-progress-bar>
      <div *ngIf="error" class="error">{{ error }}</div>

      <div class="tablewrap mat-elevation-z1" [hidden]="loading">
        <table mat-table [dataSource]="ds" matSort matSortActive="EDITION" matSortDirection="asc">
          <ng-container matColumnDef="hostname">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Hostname</th>
            <td mat-cell *matCellDef="let r">
              <a [routerLink]="['/computer', r.HARDWARE_ID]">{{ r.hostname }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="instance">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Instância</th>
            <td mat-cell *matCellDef="let r">{{ r.instance }}</td>
          </ng-container>
          <ng-container matColumnDef="EDITION">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Edition</th>
            <td mat-cell *matCellDef="let r">
              <span class="badge" [class.badge-std]="r.EDITION?.includes('Standard')">{{ r.EDITION }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="VERSION">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Versão</th>
            <td mat-cell *matCellDef="let r">{{ r.VERSION }}</td>
          </ng-container>
          <ng-container matColumnDef="PATCH">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Patch</th>
            <td mat-cell *matCellDef="let r">{{ r.PATCH || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="SQL_VERSION">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>SQL Version</th>
            <td mat-cell *matCellDef="let r">{{ r.SQL_VERSION || '—' }}</td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
          <tr *matNoDataRow><td class="nodata" [attr.colspan]="cols.length">Nada encontrado.</td></tr>
        </table>
        <mat-paginator [pageSizeOptions]="[25, 50, 100]" pageSize="50" showFirstLastButtons></mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .head { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-bottom:8px; }
    h1 { margin:0 0 4px; color:var(--heading); font-size:24px; }
    .muted { margin:0; font-size:13px; color:var(--text-muted); }
    .scopes { margin-bottom:14px; }
    .tablewrap { background:var(--surface); border-radius:10px; overflow:auto; }
    table { width:100%; background:transparent; }
    .nodata { padding:24px; text-align:center; color:var(--text-muted); }
    .error { background:var(--danger-bg); color:var(--danger-fg); padding:12px 16px; border-radius:8px; margin:10px 0; }
    a { color:var(--link); text-decoration:none; font-weight:500; }
    a:hover { text-decoration:underline; }
    .badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:500;
      background:var(--surface-2); color:var(--text-muted); }
    .badge-std { background:var(--brand-primary-soft); color:var(--brand-primary-dark); }
  `],
})
export class SqlServerReportComponent implements OnInit {
  private api = inject(OcsService);
  private route = inject(ActivatedRoute);
  ds = new MatTableDataSource<SqlServerInstance>([]);
  cols = ['hostname', 'instance', 'EDITION', 'VERSION', 'PATCH', 'SQL_VERSION'];
  loading = true;
  error = '';
  editionFilter: EditionFilter = 'Todas';
  allData: SqlServerInstance[] = [];

  @ViewChild(MatSort) set sort(s: MatSort) { if (s) this.ds.sort = s; }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator) { if (p) this.ds.paginator = p; }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap.get('edition');
    if (qp === 'Standard' || qp === 'Developer' || qp === 'Express') {
      this.editionFilter = qp;
    }
    this.api.sqlserver().subscribe({
      next: (list) => {
        this.allData = list;
        this.applyFilter();
        this.loading = false;
      },
      error: (e) => {
        this.error = 'Falha ao carregar instâncias SQL Server: ' + (e?.error?.error || e?.message || e);
        this.loading = false;
      },
    });
  }

  setEdition(v: EditionFilter): void {
    this.editionFilter = v;
    this.applyFilter();
    if (this.ds.paginator) this.ds.paginator.firstPage();
  }

  private applyFilter(): void {
    if (this.editionFilter === 'Todas') {
      this.ds.data = this.allData;
    } else {
      this.ds.data = this.allData.filter((r) => r.EDITION?.includes(this.editionFilter));
    }
  }

  serverCount(): number {
    return new Set(this.ds.filteredData.map((r) => r.HARDWARE_ID)).size;
  }

  exportCsv(): void {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['Hostname;Instância;Edition;Versão;Patch;SQL Version'];
    for (const r of this.ds.filteredData) {
      lines.push([esc(r.hostname), esc(r.instance), esc(r.EDITION), esc(r.VERSION), esc(r.PATCH), esc(r.SQL_VERSION)].join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sqlserver-ocs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
