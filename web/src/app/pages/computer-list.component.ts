import { Component, OnInit, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { FormsModule } from '@angular/forms';
import { OcsService } from '../core/ocs.service';
import { ComputerRow } from '../core/models';
import { freshness, freshnessLabel, mbToGb, parseDbTs } from '../core/util';

type Scope = 'todos' | 'servidores' | 'pcs';

@Component({
  selector: 'app-computer-list',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, MatTableModule, MatSortModule, MatPaginatorModule,
    MatFormFieldModule, MatInputModule, MatIconModule, MatButtonModule, MatButtonToggleModule,
    MatTooltipModule, MatProgressBarModule,
  ],
  template: `
    <div class="page">
      <div class="head">
        <div>
          <h1>Ativos</h1>
          <p class="muted" *ngIf="!loading">
            {{ ds.filteredData.length }} de {{ all.length }} ativos
            <span *ngIf="novos"> · adicionados nos últimos {{ novos }} dias</span>
            <span *ngIf="frescor || semtag"> · filtro ativo</span>
          </p>
        </div>
        <div class="actions">
          <button mat-stroked-button (click)="reload()" [disabled]="loading"><mat-icon>refresh</mat-icon> Atualizar</button>
          <button mat-flat-button class="btn-green" (click)="exportCsv()" [disabled]="loading || !ds.data.length">
            <mat-icon>download</mat-icon> Exportar CSV
          </button>
        </div>
      </div>

      <!-- sub-abas -->
      <mat-button-toggle-group class="scopes" [value]="scope" (change)="setScope($event.value)" *ngIf="!loading">
        <mat-button-toggle value="todos"><mat-icon>devices</mat-icon> Todos</mat-button-toggle>
        <mat-button-toggle value="servidores"><mat-icon>dns</mat-icon> Servidores</mat-button-toggle>
        <mat-button-toggle value="pcs"><mat-icon>computer</mat-icon> PCs</mat-button-toggle>
      </mat-button-toggle-group>

      <mat-progress-bar *ngIf="loading" mode="indeterminate" color="primary"></mat-progress-bar>
      <div *ngIf="error" class="error">{{ error }}</div>

      <div class="chips" *ngIf="!loading && (frescor || semtag || novos)">
        <span class="chip" *ngIf="novos">Adicionados nos últimos {{ novos }} dias <mat-icon (click)="clearNovos()">close</mat-icon></span>
        <span class="chip" *ngIf="frescor">Frescor: {{ frescorLabel }} <mat-icon (click)="clearExtra()">close</mat-icon></span>
        <span class="chip" *ngIf="semtag">Sem TAG <mat-icon (click)="clearExtra()">close</mat-icon></span>
      </div>

      <mat-form-field appearance="outline" class="search" *ngIf="!loading">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Buscar (nome, SO, IP, empresa, usuário, TAG…)</mat-label>
        <input matInput [(ngModel)]="filter" (ngModelChange)="applyFilter($event)" autocomplete="off" />
        <button *ngIf="filter" matSuffix mat-icon-button (click)="applyFilter('')"><mat-icon>close</mat-icon></button>
      </mat-form-field>

      <div class="tablewrap mat-elevation-z1" [hidden]="loading">
        <table mat-table [dataSource]="ds" matSort [matSortActive]="sortActive" [matSortDirection]="sortDir">
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Nome</th>
            <td mat-cell *matCellDef="let r">
              <span class="ico"><mat-icon>{{ r.isServer ? 'dns' : 'computer' }}</mat-icon></span>
              <a [routerLink]="['/computer', r.id]" (click)="go(r.id, $event)" class="link">{{ r.name }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="os">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Sistema operacional</th>
            <td mat-cell *matCellDef="let r"><span class="nowrap">{{ r.os || '—' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="ip">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>IP</th>
            <td mat-cell *matCellDef="let r">{{ r.ip || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="empresa">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Empresa</th>
            <td mat-cell *matCellDef="let r">{{ r.empresa || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="usuario">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Usuário</th>
            <td mat-cell *matCellDef="let r">{{ r.usuario || r.userId || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="memoryMb">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Memória</th>
            <td mat-cell *matCellDef="let r">{{ gb(r.memoryMb) }}</td>
          </ng-container>
          <ng-container matColumnDef="totalDiskGb">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Disco (GB)</th>
            <td mat-cell *matCellDef="let r">{{ r.totalDiskGb ? r.totalDiskGb.toFixed(1) : '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="tag">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>TAG</th>
            <td mat-cell *matCellDef="let r">{{ r.tag || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="descricao">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Descrição</th>
            <td mat-cell *matCellDef="let r"><span class="nowrap">{{ r.descricao || '—' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="adicionado">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Adicionado</th>
            <td mat-cell *matCellDef="let r">
              <span *ngIf="r.addedAt; else semadd" [matTooltip]="r.addedAt" class="added">
                {{ fmtDate(r.addedAt) }} <em>({{ daysAgoLabel(r.addedAt) }})</em>
              </span>
              <ng-template #semadd>—</ng-template>
            </td>
          </ng-container>
          <ng-container matColumnDef="lastCome">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Último contato</th>
            <td mat-cell *matCellDef="let r">
              <span class="freshness" [ngClass]="'fresh-' + fresh(r.lastCome)" [matTooltip]="r.lastCome || 'sem contato'">
                <span class="dot"></span>{{ freshLabel(r.lastCome) }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="osVersion">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Versão SO</th>
            <td mat-cell *matCellDef="let r"><span class="nowrap">{{ r.osVersion || '—' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="arch">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Arquitetura</th>
            <td mat-cell *matCellDef="let r">{{ r.arch || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="cpu">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>CPU</th>
            <td mat-cell *matCellDef="let r"><span class="nowrap">{{ r.cpu || '—' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="userId">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Login</th>
            <td mat-cell *matCellDef="let r">{{ r.userId || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="tipo">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Tipo</th>
            <td mat-cell *matCellDef="let r">{{ r.tipo || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="cc">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Centro de custo</th>
            <td mat-cell *matCellDef="let r"><span class="nowrap">{{ r.cc || '—' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="ln">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Linha de negócio</th>
            <td mat-cell *matCellDef="let r"><span class="nowrap">{{ r.ln || '—' }}</span></td>
          </ng-container>
          <ng-container matColumnDef="workgroup">
            <th mat-header-cell *matHeaderCellDef mat-sort-header>Workgroup</th>
            <td mat-cell *matCellDef="let r">{{ r.workgroup || '—' }}</td>
          </ng-container>
          <ng-container matColumnDef="acao">
            <th mat-header-cell *matHeaderCellDef></th>
            <td mat-cell *matCellDef="let r">
              <button mat-icon-button color="primary" (click)="go(r.id)" matTooltip="Ver ficha"><mat-icon>chevron_right</mat-icon></button>
            </td>
          </ng-container>
          <tr mat-header-row *matHeaderRowDef="cols; sticky: true"></tr>
          <tr mat-row *matRowDef="let row; columns: cols" class="clickable" (click)="go(row.id)"></tr>
          <tr *matNoDataRow><td class="nodata" [attr.colspan]="cols.length">Nenhum ativo encontrado.</td></tr>
        </table>
        <mat-paginator [pageSizeOptions]="[15, 30, 50, 100]" pageSize="30" showFirstLastButtons></mat-paginator>
      </div>
    </div>
  `,
  styles: [`
    .head { display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:12px; margin-bottom:8px; }
    h1 { margin:0 0 4px; color:var(--heading); font-size:24px; }
    .muted { margin:0; font-size:13px; }
    .actions { display:flex; gap:10px; }
    .scopes { margin:6px 0 4px; }
    .scopes mat-icon { font-size:18px; width:18px; height:18px; vertical-align:middle; margin-right:4px; }
    .chips { display:flex; gap:8px; margin:8px 0; }
    .chip { display:inline-flex; align-items:center; gap:6px; background:var(--brand-primary-soft); color:var(--brand-primary-dark);
      padding:4px 6px 4px 12px; border-radius:999px; font-size:13px; }
    .chip mat-icon { font-size:16px; width:16px; height:16px; cursor:pointer; }
    .search { width:100%; margin-top:6px; }
    .tablewrap { background:var(--surface); border-radius:10px; overflow:auto; }
    table { width:100%; background:transparent; }
    .ico mat-icon { font-size:18px; width:18px; height:18px; color:var(--text-muted); vertical-align:middle; margin-right:8px; }
    .link { color:var(--link); font-weight:600; text-decoration:none; }
    .link:hover { text-decoration:underline; }
    tr.clickable { cursor:pointer; }
    .added em { font-style:normal; color:var(--text-muted); font-size:12px; }
    .nodata { padding:24px; text-align:center; color:var(--text-muted); }
    .error { background:var(--danger-bg); color:var(--danger-fg); padding:12px 16px; border-radius:8px; margin:10px 0; }
  `],
})
export class ComputerListComponent implements OnInit {
  private api = inject(OcsService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  ds = new MatTableDataSource<ComputerRow>([]);
  all: ComputerRow[] = [];
  cols = ['name', 'os', 'osVersion', 'arch', 'ip', 'memoryMb', 'totalDiskGb', 'cpu', 'empresa', 'usuario', 'userId',
          'tipo', 'cc', 'ln', 'tag', 'descricao', 'workgroup', 'adicionado', 'lastCome', 'acao'];
  loading = true;
  error = '';
  filter = '';
  scope: Scope = 'todos';
  frescor = '';
  semtag = false;
  novos = 0; // filtro "adicionados nos últimos N dias" (0 = desligado)
  sortActive = 'lastCome';
  sortDir: 'asc' | 'desc' = 'desc';

  @ViewChild(MatSort) set sort(s: MatSort) { if (s) this.ds.sort = s; }
  @ViewChild(MatPaginator) set paginator(p: MatPaginator) { if (p) this.ds.paginator = p; }

  gb = mbToGb;
  fresh = freshness;
  freshLabel = freshnessLabel;

  get frescorLabel(): string {
    return this.frescor === 'ok' ? 'em dia' : this.frescor === 'old' ? 'desatualizado' : this.frescor;
  }

  ngOnInit(): void {
    this.ds.filterPredicate = (row, f) => {
      const p = JSON.parse(f) as { q: string };
      const hay = [row.name, row.os, row.osVersion, row.ip, row.empresa, row.usuario,
                   row.userId, row.tag, row.tipo, row.cc, row.ln, row.workgroup, row.descricao]
        .join(' ').toLowerCase();
      return hay.includes(p.q);
    };
    // a coluna "adicionado" mapeia p/ a propriedade addedAt
    this.ds.sortingDataAccessor = (row, id) => {
      if (id === 'adicionado') return row.addedAt || '';
      const v = (row as unknown as Record<string, unknown>)[id];
      return typeof v === 'number' ? v : String(v ?? '').toLowerCase();
    };

    this.route.queryParamMap.subscribe((qp) => {
      this.filter = qp.get('q') || '';
      const tipo = qp.get('tipo');
      this.scope = tipo === 'servidores' ? 'servidores' : tipo === 'pcs' ? 'pcs' : 'todos';
      this.frescor = qp.get('frescor') || '';
      this.semtag = qp.get('semtag') === '1';
      this.novos = Number(qp.get('novos')) || 0;
      // quando filtrando por recém-adicionados, ordena por "Adicionado" desc
      if (this.novos) { this.sortActive = 'adicionado'; this.sortDir = 'desc'; }
      else { this.sortActive = 'lastCome'; this.sortDir = 'desc'; }
      this.rebuild();
    });

    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = '';
    this.api.computers().subscribe({
      next: (rows) => { this.all = rows; this.rebuild(); this.loading = false; },
      error: (e) => { this.error = 'Falha ao carregar ativos: ' + (e?.error?.error || e?.message || e); this.loading = false; },
    });
  }

  /** aplica escopo + filtros de query e reprograma o filtro textual */
  private rebuild(): void {
    let data = this.all;
    if (this.scope === 'servidores') data = data.filter((r) => r.isServer);
    else if (this.scope === 'pcs') data = data.filter((r) => !r.isServer);
    if (this.frescor) data = data.filter((r) => freshness(r.lastCome) === this.frescor);
    if (this.semtag) data = data.filter((r) => !r.tag);
    if (this.novos) {
      const cutoff = Date.now() - this.novos * 86400000;
      data = data.filter((r) => r.addedAt && parseDbTs(r.addedAt) >= cutoff);
    }
    this.ds.data = data;
    this.ds.filter = JSON.stringify({ q: (this.filter || '').trim().toLowerCase() });
    if (this.ds.paginator) this.ds.paginator.firstPage();
  }

  setScope(s: Scope): void {
    const tipo = s === 'todos' ? null : s;
    this.router.navigate([], { relativeTo: this.route, queryParams: { tipo }, queryParamsHandling: 'merge' });
  }

  clearExtra(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { frescor: null, semtag: null }, queryParamsHandling: 'merge' });
  }

  clearNovos(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { novos: null }, queryParamsHandling: 'merge' });
  }

  fmtDate(s: string | null): string { return s ? String(s).slice(0, 10) : '—'; }
  daysAgoLabel(s: string | null): string {
    if (!s) return '';
    const t = parseDbTs(s);
    if (isNaN(t)) return '';
    const d = Math.floor((Date.now() - t) / 86400000);
    return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`;
  }

  applyFilter(v: string): void {
    this.filter = v;
    this.ds.filter = JSON.stringify({ q: (v || '').trim().toLowerCase() });
    if (this.ds.paginator) this.ds.paginator.firstPage();
  }

  go(id: number, ev?: Event): void {
    if (ev) { ev.preventDefault(); ev.stopPropagation(); }
    this.router.navigate(['/computer', id]);
  }

  exportCsv(): void {
    const rows = this.ds.filteredData;
    const cols: [string, keyof ComputerRow][] = [
      ['Nome', 'name'], ['Sistema operacional', 'os'], ['Versão SO', 'osVersion'],
      ['Arquitetura', 'arch'], ['IP', 'ip'], ['Memória (MB)', 'memoryMb'], ['Disco Total (GB)', 'totalDiskGb'], ['CPU', 'cpu'],
      ['Empresa', 'empresa'], ['Usuário', 'usuario'], ['Login', 'userId'], ['Tipo', 'tipo'],
      ['Centro de custo', 'cc'], ['Linha de negócio', 'ln'], ['TAG', 'tag'],
      ['Descrição', 'descricao'],
      ['Dono do equipamento', 'donoEquipamento'], ['Custo do ativo', 'custo'],
      ['Elemento de custo', 'elementoCusto'], ['Aplicação', 'aplicacao'], ['Rateio', 'rateio'],
      ['Modalidade', 'modalidade'], ['Ambientes', 'ambientes'], ['Migrado', 'migrado'],
      ['Servidor banco de dados', 'servidorBd'], ['Cloud', 'cloud'],
      ['Workgroup', 'workgroup'], ['Adicionado ao OCS', 'addedAt'], ['Último contato', 'lastCome'],
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [cols.map((c) => esc(c[0])).join(';')];
    for (const r of rows) lines.push(cols.map((c) => esc(r[c[1]])).join(';'));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `inventario-ocs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
