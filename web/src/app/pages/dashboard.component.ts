import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { OcsService } from '../core/ocs.service';
import { Stats } from '../core/models';
import { freshness, freshnessLabel } from '../core/util';
import { WidgetCardComponent } from '../widgets/widget-card.component';
import { DonutComponent } from '../widgets/donut.component';
import { BarlistComponent } from '../widgets/barlist.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatIconModule, MatProgressBarModule,
    WidgetCardComponent, DonutComponent, BarlistComponent,
  ],
  template: `
    <div class="page">
      <mat-progress-bar *ngIf="loading" mode="indeterminate" color="primary"></mat-progress-bar>
      <div *ngIf="error" class="error">{{ error }}</div>

      <ng-container *ngIf="s">
        <!-- KPIs -->
        <div class="kpis">
          <a class="kpi" routerLink="/ativos">
            <mat-icon>devices</mat-icon>
            <div><b>{{ s.totals.all }}</b><span>Ativos totais</span></div>
          </a>
          <a class="kpi" routerLink="/ativos" [queryParams]="{ tipo: 'servidores' }">
            <mat-icon class="c-navy">dns</mat-icon>
            <div><b>{{ s.totals.servers }}</b><span>Servidores</span></div>
          </a>
          <a class="kpi" routerLink="/ativos" [queryParams]="{ tipo: 'pcs' }">
            <mat-icon class="c-blue">computer</mat-icon>
            <div><b>{{ s.totals.workstations }}</b><span>Workstations</span></div>
          </a>
          <a class="kpi" routerLink="/ativos" [queryParams]="{ frescor: 'old' }">
            <mat-icon class="c-red">warning</mat-icon>
            <div><b>{{ s.totals.stale }}</b><span>Desatualizados (&gt;15d)</span></div>
          </a>
        </div>

        <!-- Grade de widgets -->
        <div class="grid">
          <app-widget-card title="Sistemas operacionais" icon="lan" class="col2">
            <app-barlist [data]="s.byOs"></app-barlist>
          </app-widget-card>

          <app-widget-card title="Situação dos agentes" icon="wifi_tethering">
            <app-donut [data]="s.byFreshness" centerLabel="ativos"></app-donut>
          </app-widget-card>

          <app-widget-card title="Ativos por empresa" icon="business">
            <app-donut [data]="s.byEmpresa" centerLabel="ativos"></app-donut>
          </app-widget-card>

          <app-widget-card title="Ativos por tipo" icon="category">
            <app-barlist [data]="s.byTipo"></app-barlist>
          </app-widget-card>

          <app-widget-card title="Últimos vistos" icon="schedule" class="col2">
            <table class="mini">
              <tr *ngFor="let r of s.recent">
                <td><a [routerLink]="['/computer', r.id]">{{ r.name }}</a></td>
                <td class="muted nowrap">{{ r.os }}</td>
                <td class="right">
                  <span class="freshness" [ngClass]="'fresh-' + fresh(r.lastCome)">
                    <span class="dot"></span>{{ freshLabel(r.lastCome) }}
                  </span>
                </td>
              </tr>
            </table>
          </app-widget-card>

          <app-widget-card title="Precisam de atenção (>15 dias)" icon="report_problem" class="col2">
            <table class="mini" *ngIf="s.stale.length; else semStale">
              <tr *ngFor="let r of s.stale">
                <td><a [routerLink]="['/computer', r.id]">{{ r.name }}</a></td>
                <td class="muted nowrap">{{ r.empresa || '—' }}</td>
                <td class="right nowrap muted">{{ r.lastCome || 'sem contato' }}</td>
              </tr>
            </table>
            <ng-template #semStale><p class="ok-msg"><mat-icon>check_circle</mat-icon> Tudo em dia!</p></ng-template>
          </app-widget-card>
        </div>
      </ng-container>
    </div>
  `,
  styles: [`
    .kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:14px; margin-bottom:16px; }
    .kpi { display:flex; align-items:center; gap:14px; background:var(--surface); border:1px solid var(--border);
      border-radius:12px; padding:16px 18px; text-decoration:none; box-shadow:0 1px 3px var(--shadow);
      transition:transform .1s, box-shadow .1s; border-left:5px solid var(--brand-primary); }
    .kpi:hover { transform:translateY(-2px); box-shadow:0 4px 12px var(--shadow-strong); }
    .kpi mat-icon { font-size:34px; width:34px; height:34px; color:var(--brand-primary); }
    .kpi .c-navy { color:var(--heading); } .kpi .c-blue { color:#3d6fb4; } .kpi .c-red { color:#e53935; }
    .kpi b { display:block; font-size:26px; color:var(--heading); line-height:1; }
    .kpi span { font-size:12.5px; color:var(--text-muted); }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; }
    .grid > * { min-width:0; }
    .col2 { grid-column:span 2; }
    @media (max-width:1100px){ .grid { grid-template-columns:repeat(2,minmax(0,1fr)); } .col2 { grid-column:span 2; } }
    @media (max-width:640px){ .grid { grid-template-columns:minmax(0,1fr); } .col2 { grid-column:span 1; } }
    table.mini { width:100%; border-collapse:collapse; }
    table.mini td { padding:6px 6px; border-bottom:1px solid var(--border-soft); font-size:13px; }
    table.mini a { color:var(--link); font-weight:600; text-decoration:none; }
    table.mini a:hover { text-decoration:underline; }
    .right { text-align:right; }
    .ok-msg { display:flex; align-items:center; gap:8px; color:var(--brand-primary-dark); }
    .error { background:var(--danger-bg); color:var(--danger-fg); padding:12px 16px; border-radius:8px; margin:10px 0; }
  `],
})
export class DashboardComponent implements OnInit {
  private api = inject(OcsService);
  s: Stats | null = null;
  loading = true;
  error = '';
  fresh = freshness;
  freshLabel = freshnessLabel;

  ngOnInit(): void {
    this.api.stats().subscribe({
      next: (s) => { this.s = s; this.loading = false; },
      error: (e) => { this.error = 'Falha ao carregar o dashboard: ' + (e?.error?.error || e?.message || e); this.loading = false; },
    });
  }
}
