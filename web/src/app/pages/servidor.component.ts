import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { OcsService, SystemInfo } from '../core/ocs.service';

@Component({
  selector: 'app-servidor',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="page">
      <h1>Servidor</h1>
      <p class="muted">Hospedagem, arquitetura e banco de dados do OCS Console.
        <span class="live" *ngIf="sys()"><span class="dot"></span> dados ao vivo</span>
      </p>

      <div class="grid">
        <!-- Host & Container -->
        <section class="panel">
          <h3><mat-icon>dns</mat-icon> Host &amp; Container</h3>
          <table class="kv">
            <tr><th>Node.js</th><td>{{ sys()?.app?.node || '—' }}</td></tr>
            <tr><th>App PID</th><td>{{ sys()?.app?.pid || '—' }}</td></tr>
            <tr><th>Uptime do app</th><td>{{ sys() ? uptime(sys()!.app.uptimeSec) : '—' }}</td></tr>
          </table>
        </section>

        <!-- Frontend / App -->
        <section class="panel">
          <h3><mat-icon>web</mat-icon> Frontend / Aplicação</h3>
          <table class="kv">
            <tr><th>Framework</th><td>Angular 18 (standalone + Material)</td></tr>
            <tr><th>Backend (BFF)</th><td>Node/Express — {{ sys()?.app?.node || '…' }}</td></tr>
            <tr><th>Acesso a dados</th><td>mysql2 (pool) → MariaDB direto</td></tr>
            <tr><th>Autenticação</th><td>{{ sys()?.app?.authEnabled ? 'OIDC/SSO (authorized group)' : 'disabled' }}</td></tr>
            <tr><th>Cache do BFF</th><td>{{ sys() ? sys()!.app.cacheTtlSec + ' s' : '—' }}</td></tr>
            <tr><th>URL pública</th><td>{{ sys()?.app?.baseUrl || '—' }}</td></tr>
          </table>
        </section>

        <!-- Arquitetura -->
        <section class="panel wide">
          <h3><mat-icon>account_tree</mat-icon> Arquitetura</h3>
          <div class="flow">
            <div class="node"><mat-icon>person</mat-icon><b>Browser</b><span>IT user</span></div>
            <mat-icon class="arrow">arrow_forward</mat-icon>
            <div class="node"><mat-icon>public</mat-icon><b>Reverse proxy</b><span>HTTPS<br>(nginx / etc.)</span></div>
            <mat-icon class="arrow">arrow_forward</mat-icon>
            <div class="node accent"><mat-icon>inventory_2</mat-icon><b>ocs-console container</b><span>8080→3000<br>Angular + BFF Node</span></div>
            <mat-icon class="arrow">arrow_forward</mat-icon>
            <div class="node"><mat-icon>storage</mat-icon><b>MariaDB</b><span>ocsweb · :3306<br>(host.docker.internal)</span></div>
          </div>
          <p class="note">Single container (Angular static + BFF Express) running alongside the <code>ocsinventory</code> container (ports 80/443) on the same host. OIDC/SSO auth protects <code>/api/*</code> and <code>/auth/*</code>; the OCS unauthenticated API is hidden behind the BFF.</p>
        </section>

        <!-- Banco de dados -->
        <section class="panel">
          <h3><mat-icon>storage</mat-icon> Banco de dados</h3>
          <table class="kv" *ngIf="sys() as s">
            <tr><th>Motor</th><td>{{ s.db.engine }} {{ s.db.version }}</td></tr>
            <tr><th>Base</th><td>{{ s.db.name }}</td></tr>
            <tr><th>Conexão</th><td>{{ s.db.host }}:{{ s.db.port }}</td></tr>
            <tr><th>Tamanho</th><td>{{ s.db.sizeMb != null ? s.db.sizeMb + ' MB' : '—' }}</td></tr>
            <tr><th>Tabelas</th><td>{{ s.db.tables ?? '—' }}</td></tr>
          </table>
          <p class="muted small" *ngIf="!sys() && !err()">Carregando…</p>
        </section>

        <!-- Inventário (números) -->
        <section class="panel">
          <h3><mat-icon>bar_chart</mat-icon> Inventário</h3>
          <div class="kpis" *ngIf="sys() as s">
            <div class="kpi"><b>{{ s.inventory.computers }}</b><span>Ativos</span></div>
            <div class="kpi"><b>{{ s.inventory.servers }}</b><span>Servidores</span></div>
            <div class="kpi"><b>{{ s.inventory.workstations }}</b><span>Workstations</span></div>
            <div class="kpi"><b>{{ s.inventory.softwareDistinct ?? '—' }}</b><span>Softwares</span></div>
          </div>
          <p class="muted small" *ngIf="!sys() && !err()">Carregando…</p>
        </section>
      </div>

      <div class="err" *ngIf="err()">
        <mat-icon>error_outline</mat-icon> Não foi possível carregar os dados ao vivo do servidor. {{ err() }}
      </div>
    </div>
  `,
  styles: [`
    h1 { margin:0 0 4px; color:var(--heading); font-size:24px; }
    .muted { margin:0 0 18px; color:var(--text-muted); font-size:13.5px; }
    .muted.small { margin:6px 2px 0; font-size:12px; }
    .live { margin-left:10px; color:var(--brand-primary-dark); font-weight:600; }
    .live .dot { display:inline-block; width:8px; height:8px; border-radius:50%; background:var(--brand-primary);
      margin-right:5px; box-shadow:0 0 0 3px rgba(118,183,41,.25); }
    .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:18px; align-items:start; }
    .panel { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px 18px; box-shadow:0 1px 3px var(--shadow); }
    .panel.wide { grid-column:1 / -1; }
    .panel h3 { display:flex; align-items:center; gap:8px; margin:2px 0 14px; color:var(--heading); font-size:15px;
      border-bottom:2px solid var(--brand-primary); padding-bottom:8px; }
    .panel h3 mat-icon { color:var(--brand-primary); font-size:20px; width:20px; height:20px; }
    table.kv { width:100%; border-collapse:collapse; }
    table.kv th { text-align:left; color:var(--text-muted); font-weight:500; font-size:12.5px; padding:6px 10px 6px 0; white-space:nowrap; vertical-align:top; width:42%; }
    table.kv td { color:var(--heading); font-size:13px; padding:6px 0; border-bottom:1px solid var(--border-soft); }
    table.kv tr:last-child td, table.kv tr:last-child th { border-bottom:0; }
    .flow { display:flex; align-items:stretch; gap:6px; flex-wrap:wrap; padding:6px 0 2px; }
    .node { flex:1 1 150px; min-width:150px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:2px;
      background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:12px 10px; }
    .node.accent { background:var(--brand-primary-soft); border-color:#c8e2a6; }
    .node mat-icon { color:var(--brand-primary-dark); }
    .node b { color:var(--heading); font-size:13px; }
    .node span { color:var(--text-muted); font-size:11px; line-height:1.35; }
    .arrow { color:var(--text-muted); align-self:center; }
    .note { margin:14px 0 0; color:var(--text-muted); font-size:12.5px; line-height:1.5; }
    .note code, .err code { background:var(--code-bg); padding:1px 5px; border-radius:5px; font-size:12px; }
    .kpis { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; }
    .kpi { background:var(--surface-2); border:1px solid var(--border); border-radius:10px; padding:12px; text-align:center; }
    .kpi b { display:block; color:var(--heading); font-size:22px; }
    .kpi span { color:var(--text-muted); font-size:12px; }
    .err { margin-top:16px; display:flex; align-items:center; gap:8px; background:var(--danger-bg); color:var(--danger-fg);
      border:1px solid var(--border); border-radius:10px; padding:12px 14px; font-size:13px; }
  `],
})
export class ServidorComponent implements OnInit {
  private ocs = inject(OcsService);
  sys = signal<SystemInfo | null>(null);
  err = signal<string>('');

  ngOnInit(): void {
    this.ocs.system().subscribe({
      next: (s) => this.sys.set(s),
      error: (e) => this.err.set(String(e?.error?.error || e?.message || 'erro')),
    });
  }

  uptime(sec: number): string {
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    if (d) return `${d}d ${h}h`;
    if (h) return `${h}h ${m}min`;
    return `${m} min`;
  }
}
