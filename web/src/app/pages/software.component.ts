import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OcsService } from '../core/ocs.service';
import { SoftwareAgg } from '../core/models';

@Component({
  selector: 'app-software',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatSortModule, MatPaginatorModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule,
    MatProgressBarModule, MatTooltipModule,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div>
          <h1>Software instalado</h1>
          <p class="muted" *ngIf="!loading">{{ ds.filteredData.length }} de {{ ds.data.length }} programas distintos</p>
        </div>
        <button mat-flat-button class="btn-green" (click)="exportCsv()" [disabled]="loading || !ds.data.length">
          <mat-icon>download</mat-icon> Exportar CSV
        </button>
      </div>

      <mat-progress-bar *ngIf="loading" mode="indeterminate" color="primary"></mat-progress-bar>
      <div *ngIf="error" class="error">{{ error }}</div>

      <mat-form-field appearance="outline" class="search" *ngIf="!loading">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Buscar programa ou fabricante…</mat-label>
        <input matInput [(ngModel)]="filter" (ngModelChange)="apply($event)" autocomplete="off" />
      </mat-form-field>

      <div class="tablewrap mat-elevation-z1" [hidden]="loading">
        <table mat-table [dataSource]="ds" matSort matSortActive="count" matSortDirection="desc">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Programa</th>
            <td mat-cell *matCellDef="let s">{{ s.name }}</td>
          </ng-container>
          <ng-container matColumnDef="publisher">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Fabricante</th>
            <td mat-cell *matCellDef="let s">{{ s.publisher || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="versions">
            <th mat-header-cell *matHeaderCellDef>Versões</th>
            <td mat-cell *matCellDef="let s">
              <span [matTooltip]="s.versions.join(', ')">{{ s.versions.length }} versão(ões)</span>
            </td>
          </ng-container>
          <ng-container matColumnDef="count">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Instalações</th>
            <td mat-cell *matCellDef="let s"><b class="cnt">{{ s.count }}</b></td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: cols"></tr>
          <tr *matNoDataRow><td class="nodata" [attr.colspan]="cols.length">Nada encontrado.</td></tr>
        </table>
        <mat-paginator [pageSizeOptions]="[25, 50, 100, 200]" pageSize="50" showFirstLastButtons></mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .head { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-bottom:8px; }
    h1 { margin:0 0 4px; color:var(--heading); font-size:24px; }
    .muted { margin:0; font-size:13px; }
    .search { width:100%; margin-top:10px; }
    .tablewrap { background:var(--surface); border-radius:10px; overflow:auto; }
    table { width:100%; background:transparent; }
    .cnt { background:var(--brand-primary-soft); color:var(--brand-primary-dark); padding:2px 10px; border-radius:999px; }
    .nodata { padding:24px; text-align:center; color:var(--text-muted); }
    .error { background:var(--danger-bg); color:var(--danger-fg); padding:12px 16px; border-radius:8px; margin:10px 0; }
  `],
})
export class SoftwareComponent implements OnInit {
  private api = inject(OcsService);
  ds = new MatTableDataSource<SoftwareAgg>([]);
  cols = ['name', 'publisher', 'versions', 'count'];
  loading = true;
  error = '';
  filter = '';

  @ViewChild(MatSort) set sort(s: MatSort) { if (s) this.ds.sort = s; }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator) { if (p) this.ds.paginator = p; }

  ngOnInit(): void {
    this.ds.filterPredicate = (r, f) => `${r.name} ${r.publisher}`.toLowerCase().includes(f);
    this.api.software().subscribe({
      next: (list) => { this.ds.data = list; this.loading = false; },
      error: (e) => { this.error = 'Falha ao carregar software: ' + (e?.error?.error || e?.message || e); this.loading = false; },
    });
  }

  apply(v: string): void {
    this.ds.filter = (v || '').trim().toLowerCase();
    if (this.ds.paginator) this.ds.paginator.firstPage();
  }

  exportCsv(): void {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = ['Programa;Fabricante;Instalações;Versões'];
    for (const r of this.ds.filteredData) {
      lines.push([esc(r.name), esc(r.publisher), esc(r.count), esc(r.versions.join(' | '))].join(';'));
    }
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `software-ocs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
