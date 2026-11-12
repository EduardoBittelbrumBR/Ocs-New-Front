import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { OcsService } from '../core/ocs.service';
import { UpdateStatus } from '../core/models';

type ReportType = 'servers' | 'workstations';
type RangeFilter = 'all' | 'ok' | 'moderate' | 'attention' | 'critical';

@Component({
  selector: 'app-update-report',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatTableModule, MatSortModule, MatPaginatorModule,
    MatIconModule, MatButtonModule, MatButtonToggleModule, MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div>
          <h1>{{ title() }}</h1>
          <p class="muted" *ngIf="!loading">
            {{ ds.filteredData.length }} máquinas — {{ criticalCount() }} críticas (31+ dias)
          </p>
        </div>
        <button mat-flat-button class="btn-green" (click)="exportCsv()" [disabled]="loading || !ds.data.length">
          <mat-icon>download</mat-icon> Exportar CSV
        </button>
      </div>

      <div class="filters" *ngIf="!loading">
        <mat-button-toggle-group class="scopes" [value]="reportType" (change)="switchType($event.value)">
          <mat-button-toggle value="servers">Servidores</mat-button-toggle>
          <mat-button-toggle value="workstations">Workstations</mat-button-toggle>
        </mat-button-toggle-group>

        <mat-button-toggle-group class="ranges" [value]="rangeFilter" (change)="setRange($event.value)">
          <mat-button-toggle value="all">Todas</mat-button-toggle>
          <mat-button-toggle value="ok">0-7 dias</mat-button-toggle>
          <mat-button-toggle value="moderate">8-14 dias</mat-button-toggle>
          <mat-button-toggle value="attention">15-30 dias</mat-button-toggle>
          <mat-button-toggle value="critical">31+ dias</mat-button-toggle>
        </mat-button-toggle-group>
      </div>

      <mat-progress-bar *ngIf="loading" mode="indeterminate" color="primary"></mat-progress-bar>
      <div *ngIf="error" class="error">{{ error }}</div>

      <div class="tablewrap mat-elevation-z1" [hidden]="loading">
        <table mat-table [dataSource]="ds" matSort matSortActive="days_since_update" matSortDirection="asc">
          <ng-container matColumnDef="hostname">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Hostname</th>
            <td mat-cell *matCellDef="let r">
              <a [routerLink]="['/computer', r.HARDWARE_ID]">{{ r.hostname }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="OSNAME">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>SO</th>
            <td mat-cell *matCellDef="let r">{{ r.OSNAME }}</td>
          </ng-container>
          <ng-container matColumnDef="last_update">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Últ. update</th>
            <td mat-cell *matCellDef="let r">{{ r.last_update || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="days_since_update">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Dias s/ update</th>
            <td mat-cell *matCellDef="let r">
              <span class="badge" [class.badge-ok]="r.days_since_update <= 7"
                    [class.badge-warn]="r.days_since_update > 7 && r.days_since_update <= 30"
                    [class.badge-crit]="r.days_since_update > 30">{{ r.days_since_update }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="update_source">
            <th mat-header-cell *matHeaderCellDef>Origem</th>
            <td mat-cell *matCellDef="let r">
              <span class="src" [class.src-real]="r.update_source === 'Windows-Update' || r.update_source === 'Linux-Package'">{{ r.update_source }}</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="pending_count">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Pendentes</th>
            <td mat-cell *matCellDef="let r">
              <span *ngIf="r.pending_count != null" class="badge" [class.badge-crit]="r.pending_count > 0">{{ r.pending_count }}</span>
              <span *ngIf="r.pending_count == null">—</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="last_kb">
            <th mat-header-cell *matHeaderCellDef>Últ. KB</th>
            <td mat-cell *matCellDef="let r">{{ r.last_kb || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="LASTCOME">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Últ. inventário</th>
            <td mat-cell *matCellDef="let r">{{ r.LASTCOME || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="empresa">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Empresa</th>
            <td mat-cell *matCellDef="let r">{{ r.empresa || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="dono">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Dono</th>
            <td mat-cell *matCellDef="let r">{{ r.dono || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="TAG">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>TAG</th>
            <td mat-cell *matCellDef="let r">{{ r.TAG || '—' }}</td>
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
    .filters { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
    .tablewrap { background:var(--surface); border-radius:10px; overflow:auto; }
    table { width:100%; background:transparent; }
    .nodata { padding:24px; text-align:center; color:var(--text-muted); }
    .error { background:var(--danger-bg); color:var(--danger-fg); padding:12px 16px; border-radius:8px; margin:10px 0; }
    a { color:var(--link); text-decoration:none; font-weight:500; }
    a:hover { text-decoration:underline; }
    .badge { display:inline-block; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:600;
      background:var(--surface-2); color:var(--text-muted); min-width:28px; text-align:center; }
    .badge-ok { background:var(--brand-primary-soft); color:var(--brand-primary-dark); }
    .badge-warn { background:#fff3cd; color:#856404; }
    .badge-crit { background:#f8d7da; color:#721c24; }
    .src { font-size:11px; color:var(--text-muted); font-style:italic; }
    .src-real { color:var(--brand-primary-dark); font-weight:600; font-style:normal; }
  `],
})
export class UpdateReportComponent implements OnInit {
  private api = inject(OcsService);
  private route = inject(ActivatedRoute);
  ds = new MatTableDataSource<UpdateStatus>([]);
  cols = ['hostname', 'OSNAME', 'last_update', 'days_since_update', 'pending_count', 'last_kb', 'update_source', 'LASTCOME', 'empresa', 'dono', 'TAG'];
  loading = true;
  error = '';
  reportType: ReportType = 'servers';
  rangeFilter: RangeFilter = 'all';
  allData: UpdateStatus[] = [];

  @ViewChild(MatSort) set sort(s: MatSort) { if (s) this.ds.sort = s; }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator) { if (p) this.ds.paginator = p; }

  ngOnInit(): void {
    const qp = this.route.snapshot.queryParamMap.get('type');
    if (qp === 'servers' || qp === 'workstations') {
      this.reportType = qp;
    }
    this.loadData();
  }

  title(): string {
    return this.reportType === 'servers' ? 'Atualizações — Servidores' : 'Atualizações — Workstations';
  }

  criticalCount(): number {
    return this.ds.filteredData.filter((r) => r.days_since_update > 30).length;
  }

  private loadData(): void {
    this.loading = true;
    this.error = '';
    this.api.updatesReport(this.reportType).subscribe({
      next: (list) => {
        this.allData = list;
        this.applyRange();
        this.loading = false;
      },
      error: (e) => {
        this.error = 'Falha ao carregar dados: ' + (e?.error?.error || e?.message || e);
        this.loading = false;
      },
    });
  }

  switchType(v: ReportType): void {
    this.reportType = v;
    this.rangeFilter = 'all';
    this.loadData();
    if (this.ds.paginator) this.ds.paginator.firstPage();
  }

  setRange(v: RangeFilter): void {
    this.rangeFilter = v;
    this.applyRange();
    if (this.ds.paginator) this.ds.paginator.firstPage();
  }

  private applyRange(): void {
    if (this.rangeFilter === 'all') {
      this.ds.data = this.allData;
    } else {
      this.ds.data = this.allData.filter((r) => {
        const d = r.days_since_update;
        if (this.rangeFilter === 'ok') return d <= 7;
        if (this.rangeFilter === 'moderate') return d > 7 && d <= 14;
        if (this.rangeFilter === 'attention') return d > 14 && d <= 30;
        if (this.rangeFilter === 'critical') return d > 30;
        return true;
      });
    }
  }

  exportCsv(): void {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['Hostname;SO;Últ. update;Dias s/ update;Pendentes;Últ. KB;Origem;Últ. inventário;Empresa;Dono;TAG'];
    for (const r of this.ds.filteredData) {
      lines.push([
        esc(r.hostname), esc(r.OSNAME), esc(r.last_update), esc(r.days_since_update),
        esc(r.pending_count), esc(r.last_kb), esc(r.update_source), esc(r.LASTCOME), esc(r.empresa), esc(r.dono), esc(r.TAG),
      ].join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `updates-${this.reportType}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
