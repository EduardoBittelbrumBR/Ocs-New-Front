import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface Report { icon: string; label: string; desc: string; link: string; params?: Record<string, string>; }

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, RouterLink, MatIconModule],
  template: `
    <div class="page">
      <h1>Relatórios</h1>
      <p class="muted">Consultas rápidas do inventário. Cada relatório abre a lista já filtrada e permite exportar CSV.</p>

      <div class="cols">
        <div class="col" *ngFor="let g of groups">
          <h3>{{ g.title }}</h3>
          <a class="rep" *ngFor="let r of g.items" [routerLink]="r.link" [queryParams]="r.params || {}">
            <mat-icon>{{ r.icon }}</mat-icon>
            <div><b>{{ r.label }}</b><span>{{ r.desc }}</span></div>
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    h1 { margin:0 0 4px; color:var(--heading); font-size:24px; }
    .muted { margin:0 0 18px; color:var(--text-muted); font-size:13.5px; }
    .cols { display:grid; grid-template-columns:repeat(auto-fit,minmax(300px,1fr)); gap:18px; }
    .col { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:14px 16px; box-shadow:0 1px 3px var(--shadow); }
    .col h3 { margin:2px 0 10px; color:var(--heading); font-size:14px; border-bottom:2px solid var(--brand-primary); display:inline-block; padding-bottom:4px; }
    .rep { display:flex; align-items:center; gap:12px; padding:9px 6px; text-decoration:none; border-radius:8px; color:inherit; }
    .rep:hover { background:var(--brand-primary-soft); }
    .rep mat-icon { color:var(--brand-primary); }
    .rep b { display:block; color:var(--heading); font-size:14px; }
    .rep span { font-size:12px; color:var(--text-muted); }
  `],
})
export class ReportsComponent {
  groups: { title: string; items: Report[] }[] = [
    {
      title: 'Ativos',
      items: [
        { icon: 'devices', label: 'Todos os ativos', desc: 'Inventário completo', link: '/ativos' },
        { icon: 'dns', label: 'Servidores', desc: 'Somente servidores', link: '/ativos', params: { tipo: 'servidores' } },
        { icon: 'computer', label: 'Workstations', desc: 'PCs e notebooks', link: '/ativos', params: { tipo: 'pcs' } },
      ],
    },
    {
      title: 'Novidades',
      items: [
        { icon: 'fiber_new', label: 'Adicionados recentemente', desc: 'Entraram no OCS nos últimos 2 dias', link: '/ativos', params: { novos: '2' } },
        { icon: 'date_range', label: 'Adicionados na semana', desc: 'Entraram no OCS nos últimos 7 dias', link: '/ativos', params: { novos: '7' } },
      ],
    },
    {
      title: 'Manutenção',
      items: [
        { icon: 'report_problem', label: 'Desatualizados', desc: 'Sem contato há mais de 15 dias', link: '/ativos', params: { frescor: 'old' } },
        { icon: 'schedule', label: 'Em dia', desc: 'Reportaram nos últimos 2 dias', link: '/ativos', params: { frescor: 'ok' } },
        { icon: 'label_off', label: 'Sem TAG', desc: 'Ativos sem TAG preenchida', link: '/ativos', params: { semtag: '1' } },
      ],
    },
    {
      title: 'Atualizações de SO',
      items: [
        { icon: 'dns', label: 'Servidores', desc: 'Status de updates dos servidores (menor → maior tempo)', link: '/updates', params: { type: 'servers' } },
        { icon: 'computer', label: 'Workstations', desc: 'Status de updates das estações (menor → maior tempo)', link: '/updates', params: { type: 'workstations' } },
      ],
    },
    {
      title: 'Bancos de dados',
      items: [
        { icon: 'storage', label: 'SQL Server Standard', desc: 'Instâncias SQL Server Standard', link: '/sqlserver', params: { edition: 'Standard' } },
        { icon: 'dns', label: 'Todas as instâncias SQL Server', desc: 'Todas as instâncias coletadas', link: '/sqlserver' },
      ],
    },
    {
      title: 'Software',
      items: [
        { icon: 'apps', label: 'Software instalado', desc: 'Agregado por programa', link: '/software' },
      ],
    },
  ];
}
