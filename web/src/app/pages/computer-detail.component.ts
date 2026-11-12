import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { OcsService } from '../core/ocs.service';
import { AdminField, ComputerDetail } from '../core/models';
import { freshness, freshnessLabel, mbToGb, fmtDbTs } from '../core/util';

interface Row { icon: string; label: string; value: string; }
interface EditField { key: string; label: string; value: string; }
interface Disk { letter: string; fs: string; freeGb: string; totalGb: string; usedPct: number; }
interface Net { desc: string; mac: string; ip: string; speed: string; }
interface Crypto { drive: string; status: string; method: string; on: boolean; }
interface SqlInstance { name: string; edition: string; version: string; patch: string; sqlVersion: string; productName: string; }

@Component({
  selector: 'app-computer-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatProgressBarModule, MatTooltipModule],
  template: `
    <div class="page detail">
      <a routerLink="/ativos" class="back"><mat-icon>arrow_back</mat-icon> Voltar aos ativos</a>

      <mat-progress-bar *ngIf="loading" mode="indeterminate" color="primary"></mat-progress-bar>
      <div *ngIf="error" class="error">{{ error }}</div>

      <ng-container *ngIf="!loading && hw">
        <!-- faixa de cabecalho -->
        <div class="asset-head">
          <div class="ah-left">
            <mat-icon class="os">{{ osIcon }}</mat-icon>
            <div>
              <h1>{{ hw['NAME'] }} <span class="sub">— {{ hw['OSNAME'] }} <em *ngIf="hw['ARCH']">({{ hw['ARCH'] }})</em></span></h1>
              <div class="line">
                <mat-icon>lan</mat-icon>{{ hw['IPADDR'] || '—' }}
                <span class="dot-sep">•</span><mat-icon>domain</mat-icon>{{ hw['WORKGROUP'] || '—' }}
                <span class="dot-sep">•</span><mat-icon>person</mat-icon>{{ lastUser }}
              </div>
              <div class="desc" *ngIf="!editingDesc">
                <mat-icon>notes</mat-icon>
                <span [class.muted]="!descricao">{{ descricao || 'Sem descrição' }}</span>
                <button class="mini" (click)="startEditDesc()" matTooltip="Editar descrição"><mat-icon>edit</mat-icon></button>
              </div>
              <div class="desc editing" *ngIf="editingDesc">
                <mat-icon>notes</mat-icon>
                <input [(ngModel)]="descDraft" maxlength="255" placeholder="Descrição do ativo…"
                       (keyup.enter)="saveDesc()" (keyup.escape)="editingDesc=false" />
                <button class="mini ok" (click)="saveDesc()" [disabled]="savingDesc" matTooltip="Salvar"><mat-icon>check</mat-icon></button>
                <button class="mini" (click)="editingDesc=false" matTooltip="Cancelar"><mat-icon>close</mat-icon></button>
              </div>
            </div>
          </div>
          <div class="ah-right">
            <button *ngIf="!editingAsset" class="edit-asset" (click)="startEditAsset()"><mat-icon>edit</mat-icon> Editar ativo</button>
            <div><span>Última varredura:</span> <b>{{ fmtTs(hw['LASTDATE']) }}</b></div>
            <div><span>Última tentativa:</span> <b>{{ fmtTs(hw['LASTCOME']) }}</b></div>
            <span class="freshness" [ngClass]="'fresh-' + fresh(hw['LASTCOME'])"><span class="dot"></span>{{ freshLabel(hw['LASTCOME']) }}</span>
          </div>
        </div>

        <!-- abas -->
        <div class="tabstrip">
          <button [class.active]="tab==='resumo'" (click)="tab='resumo'"><mat-icon>dashboard</mat-icon> Resumo</button>
          <button [class.active]="tab==='config'" (click)="tab='config'"><mat-icon>memory</mat-icon> Hardware</button>
          <button [class.active]="tab==='software'" (click)="tab='software'"><mat-icon>apps</mat-icon> Software ({{ software.length }})</button>
        </div>

        <!-- ===== RESUMO (3 colunas) ===== -->
        <div class="cols" *ngIf="tab==='resumo'">
          <!-- coluna 1 -->
          <section class="panel">
            <h2>Informações do ativo</h2>
            <dl>
              <div *ngFor="let r of info"><dt><mat-icon>{{ r.icon }}</mat-icon>{{ r.label }}</dt><dd>{{ r.value }}</dd></div>

              <div *ngIf="antivirus.length"><dt><mat-icon>security</mat-icon>Antivírus</dt>
                <dd><div *ngFor="let a of antivirus">{{ a }}</div></dd></div>

              <div *ngIf="crypto.length"><dt><mat-icon>lock</mat-icon>Criptografia</dt>
                <dd><div *ngFor="let c of crypto" class="crypto">
                  <span class="dot" [class.ok]="c.on"></span>{{ c.drive }} {{ c.status }}
                  <span class="muted" *ngIf="c.method"> · {{ c.method }}</span>
                </div></dd></div>

              <!-- SQL Server Instances -->
              <div *ngIf="sqlInstances.length" class="sqlserver-section">
                <div class="section-label"><mat-icon>storage</mat-icon> SQL Server</div>
                <div class="sql-instances">
                  <div *ngFor="let inst of sqlInstances" class="sql-instance">
                    <span class="sql-icon">🗄️</span>
                    <span class="sql-name">{{ inst.name }}</span>
                    <span class="sql-edition">{{ inst.edition }}</span>
                    <span class="sql-version" *ngIf="inst.sqlVersion">{{ inst.sqlVersion }}</span>
                    <span class="sql-patch" *ngIf="inst.patch">CU {{ inst.patch }}</span>
                  </div>
                </div>
              </div>

              <div *ngIf="nets.length"><dt><mat-icon>settings_ethernet</mat-icon>Rede</dt>
                <dd><div *ngFor="let n of nets" class="net">{{ n.desc }}<br><span class="muted">{{ n.mac }}<span *ngIf="n.ip"> · {{ n.ip }}</span></span></div></dd></div>

              <div *ngFor="let d of disks"><dt><mat-icon>storage</mat-icon>Disco {{ d.letter }}</dt>
                <dd><div class="bar"><span [style.width.%]="d.usedPct"></span></div>
                  <span class="muted">{{ d.freeGb }} livres de {{ d.totalGb }} <span *ngIf="d.fs">· {{ d.fs }}</span></span></dd></div>
            </dl>
          </section>

          <!-- coluna 2 -->
          <section class="panel">
            <h2>Ciclo de vida</h2>
            <dl><div *ngFor="let r of lifecycle"><dt>{{ r.label }}</dt><dd>{{ r.value }}</dd></div></dl>
            <h2>Resumo do scan</h2>
            <dl><div *ngFor="let r of scan"><dt>{{ r.label }}</dt><dd>{{ r.value }}</dd></div></dl>
            <h2>Localização</h2>
            <dl><div *ngFor="let r of location"><dt>{{ r.label }}</dt><dd>{{ r.value }}</dd></div></dl>
          </section>

          <!-- coluna 3 -->
          <section class="panel">
            <h2>Campos personalizados
              <button *ngIf="!editingAsset" class="h2edit" (click)="startEditAsset()" matTooltip="Editar ativo"><mat-icon>edit</mat-icon></button>
            </h2>

            <!-- leitura -->
            <ng-container *ngIf="!editingAsset">
              <dl *ngIf="custom.length; else semcustom">
                <div *ngFor="let r of custom"><dt>{{ r.label }}</dt><dd class="hl">{{ r.value }}</dd></div>
              </dl>
              <ng-template #semcustom><p class="muted">Sem campos administrativos preenchidos.</p></ng-template>
            </ng-container>

            <!-- edicao -->
            <div class="editform" *ngIf="editingAsset">
              <div class="fld" *ngFor="let f of editFields; trackBy: trackKey">
                <label [attr.for]="'ef_'+f.key">{{ f.label }}</label>
                <input [id]="'ef_'+f.key" [name]="'ef_'+f.key" [(ngModel)]="f.value" [attr.list]="'opt_'+f.key" maxlength="255" [placeholder]="f.label" />
                <datalist [id]="'opt_'+f.key"><option *ngFor="let o of (adminOptions[f.key] || [])" [value]="o"></option></datalist>
              </div>
              <div class="fld">
                <label for="ef_desc">Descrição</label>
                <input id="ef_desc" name="ef_desc" [(ngModel)]="descDraftAsset" maxlength="255" placeholder="Descrição do ativo…" />
              </div>
              <div class="formactions">
                <button class="btn ok" (click)="saveAsset()" [disabled]="savingAsset"><mat-icon>check</mat-icon> {{ savingAsset ? 'Salvando…' : 'Salvar' }}</button>
                <button class="btn" (click)="cancelEditAsset()" [disabled]="savingAsset"><mat-icon>close</mat-icon> Cancelar</button>
              </div>
              <div class="formerr" *ngIf="assetError">{{ assetError }}</div>
            </div>
          </section>
        </div>

        <!-- ===== HARDWARE (tabelas) ===== -->
        <div *ngIf="tab==='config'" class="tables">
          <ng-container *ngTemplateOutlet="tbl; context:{ t:'Interfaces de rede', rows:networks, cols:netCols }"></ng-container>
          <ng-container *ngTemplateOutlet="tbl; context:{ t:'Discos lógicos', rows:drives, cols:driveCols }"></ng-container>
          <ng-container *ngTemplateOutlet="tbl; context:{ t:'Armazenamento', rows:storages, cols:storCols }"></ng-container>
          <ng-container *ngTemplateOutlet="tbl; context:{ t:'Memória', rows:memories, cols:memCols }"></ng-container>
          <ng-container *ngTemplateOutlet="tbl; context:{ t:'Vídeo', rows:videos, cols:vidCols }"></ng-container>
          <ng-container *ngTemplateOutlet="tbl; context:{ t:'Monitores', rows:monitors, cols:monCols }"></ng-container>
        </div>

        <!-- ===== SOFTWARE ===== -->
        <div *ngIf="tab==='software'" class="panel sw">
          <div class="swtools">
            <input placeholder="Filtrar software…" (input)="filterSw($any($event.target).value)" />
            <span class="muted">{{ swView.length }} de {{ software.length }}</span>
          </div>
          <table class="grid">
            <thead><tr><th>Programa</th><th>Versão</th><th>Fabricante</th></tr></thead>
            <tbody>
              <tr *ngFor="let s of swView"><td>{{ s['NAME'] }}</td><td>{{ show(s['VERSION']) }}</td><td>{{ show(s['PUBLISHER']) }}</td></tr>
            </tbody>
          </table>
        </div>

        <!-- grupos / tags -->
        <section class="groups" *ngIf="chips.length">
          <h3><mat-icon>sell</mat-icon> Grupos e tags</h3>
          <span class="chip" *ngFor="let c of chips">{{ c }}</span>
        </section>
      </ng-container>

      <!-- template de tabela generica -->
      <ng-template #tbl let-t="t" let-rows="rows" let-cols="cols">
        <section class="panel">
          <h2>{{ t }} ({{ rows.length }})</h2>
          <table class="grid" *ngIf="rows.length; else vazio">
            <thead><tr><th *ngFor="let c of cols">{{ c.h }}</th></tr></thead>
            <tbody><tr *ngFor="let row of rows"><td *ngFor="let c of cols">{{ cell(row, c) }}</td></tr></tbody>
          </table>
          <ng-template #vazio><p class="muted">Sem dados.</p></ng-template>
        </section>
      </ng-template>
    </div>
  `,
  styles: [`
    .back { display:inline-flex; align-items:center; gap:4px; color:var(--brand-primary-dark); text-decoration:none; font-weight:600; margin-bottom:12px; }
    .asset-head { display:flex; justify-content:space-between; gap:16px; flex-wrap:wrap; background:var(--surface);
      border:1px solid var(--border); border-left:5px solid var(--brand-primary); border-radius:12px; padding:16px 20px; }
    .ah-left { display:flex; align-items:center; gap:16px; }
    .ah-left .os { font-size:42px; width:42px; height:42px; color:var(--heading); }
    .ah-left h1 { margin:0; font-size:20px; color:var(--heading); }
    .ah-left h1 .sub { font-weight:400; color:var(--text-muted); font-size:15px; }
    .ah-left h1 em { font-style:normal; color:var(--text-muted); }
    .line { display:flex; align-items:center; gap:5px; color:var(--text-muted); font-size:13px; margin-top:5px; flex-wrap:wrap; }
    .line mat-icon { font-size:16px; width:16px; height:16px; color:var(--text-muted); }
    .dot-sep { color:var(--text-muted); margin:0 3px; }
    .desc { display:flex; align-items:center; gap:6px; margin-top:5px; font-size:13px; color:var(--brand-text); }
    .desc > mat-icon { font-size:16px; width:16px; height:16px; color:var(--text-muted); }
    .desc .muted { color:var(--text-muted); font-style:italic; }
    .desc input { font:inherit; font-size:13px; padding:4px 8px; border:1px solid var(--border); border-radius:6px; width:min(420px,60vw); background:var(--surface); color:var(--brand-text); }
    .desc .mini { display:inline-grid; place-items:center; width:24px; height:24px; border:0; border-radius:6px; background:transparent; color:var(--text-muted); cursor:pointer; }
    .desc .mini:hover { background:var(--brand-primary-soft); color:var(--brand-primary-dark); }
    .desc .mini mat-icon { font-size:16px; width:16px; height:16px; }
    .desc .mini.ok { color:var(--brand-primary-dark); }
    .ah-right { text-align:right; font-size:12.5px; color:var(--text-muted); }
    .ah-right b { color:var(--heading); }
    .ah-right .freshness { margin-top:6px; }

    .tabstrip { display:flex; gap:2px; margin:14px 0 0; border-bottom:2px solid var(--border); overflow-x:auto; }
    .tabstrip button { display:flex; align-items:center; gap:6px; border:0; background:transparent; cursor:pointer;
      padding:10px 16px; font:inherit; font-size:14px; color:var(--text-muted); border-bottom:3px solid transparent; margin-bottom:-2px; white-space:nowrap; }
    .tabstrip button mat-icon { font-size:18px; width:18px; height:18px; }
    .tabstrip button:hover { color:var(--heading); }
    .tabstrip button.active { color:var(--heading); font-weight:600; border-bottom-color:var(--brand-primary); }

    .cols { display:grid; grid-template-columns:1.15fr 1fr 1fr; gap:14px; margin-top:14px; align-items:start; }
    @media (max-width:1000px){ .cols { grid-template-columns:1fr; } }
    .panel { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:0 0 8px; overflow:hidden; margin-bottom:14px; }
    .panel h2 { margin:0 0 6px; font-size:13px; font-weight:700; color:var(--heading); text-transform:uppercase; letter-spacing:.4px;
      background:var(--surface-2); padding:10px 16px; border-bottom:1px solid var(--border-soft); }
    .panel h2 ~ h2 { margin-top:6px; }
    dl { margin:0; padding:4px 16px 8px; }
    dl > div { display:grid; grid-template-columns:150px 1fr; gap:12px; padding:6px 0; border-bottom:1px dashed var(--border-soft); font-size:13px; }
    dt { display:flex; align-items:center; gap:6px; justify-content:flex-end; text-align:right; color:var(--text-muted); }
    dt mat-icon { font-size:16px; width:16px; height:16px; color:var(--text-muted); }
    dd { margin:0; color:var(--brand-text); word-break:break-word; }
    dd.hl { font-weight:600; color:var(--heading); }
    .net { margin-bottom:4px; }
    .crypto { margin-bottom:4px; display:flex; align-items:center; flex-wrap:wrap; gap:2px; }
    .crypto .dot { width:8px; height:8px; border-radius:50%; background:var(--warn-fg); margin-right:7px; flex:none; }
    .crypto .dot.ok { background:var(--brand-primary); }
    .muted { color:var(--text-muted); }
    .sqlserver-section { margin-top:12px; }
    .sqlserver-section .section-label { display:flex; align-items:center; gap:6px; font-size:13px; font-weight:600; color:var(--text-muted); margin-bottom:6px; }
    .sqlserver-section .section-label mat-icon { font-size:18px; width:18px; height:18px; }
    .sql-instances { display:flex; flex-direction:column; gap:4px; }
    .sql-instance { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:13px; padding:4px 8px; border-radius:4px; background:var(--surface-2); }
    .sql-icon { font-size:14px; }
    .sql-name { font-weight:600; color:var(--heading); }
    .sql-edition { color:var(--brand-primary-soft,#76b729); font-weight:500; }
    .sql-version { color:var(--text-muted); }
    .sql-patch { color:var(--text-muted); font-size:12px; }
    .bar { height:10px; background:var(--surface-3); border-radius:6px; overflow:hidden; margin-bottom:4px; }
    .bar span { display:block; height:100%; background:linear-gradient(90deg,var(--brand-primary),var(--brand-primary-dark)); }

    .tables { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:14px; align-items:start; }
    @media (max-width:900px){ .tables { grid-template-columns:1fr; } }
    table.grid { width:100%; border-collapse:collapse; font-size:13px; }
    table.grid th { text-align:left; background:var(--surface-2); color:var(--text-muted); font-weight:600; padding:8px 12px; border-bottom:1px solid var(--border-soft); }
    table.grid td { padding:7px 12px; border-bottom:1px solid var(--border-soft); }
    .sw { margin-top:14px; }
    .swtools { display:flex; align-items:center; gap:14px; padding:12px 16px; }
    .swtools input { flex:1; padding:8px 12px; border:1px solid var(--border); border-radius:8px; font:inherit; background:var(--surface); color:var(--brand-text); }
    .groups { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:14px 16px; margin-top:14px; }
    .groups h3 { display:flex; align-items:center; gap:8px; margin:0 0 10px; font-size:13px; color:var(--heading); text-transform:uppercase; letter-spacing:.4px; }
    .groups h3 mat-icon { color:var(--brand-primary); font-size:18px; width:18px; height:18px; }
    .chip { display:inline-block; background:var(--brand-primary-soft); color:var(--brand-primary-dark); padding:5px 12px; border-radius:999px; font-size:13px; margin:0 8px 8px 0; }
    .error { background:var(--danger-bg); color:var(--danger-fg); padding:12px 16px; border-radius:8px; margin:10px 0; }

    .edit-asset { display:inline-flex; align-items:center; gap:6px; border:1px solid var(--brand-primary); background:var(--brand-primary-soft);
      color:var(--brand-primary-dark); font:inherit; font-size:13px; font-weight:600; padding:6px 12px; border-radius:8px; cursor:pointer; margin-bottom:8px; }
    .edit-asset:hover { background:var(--brand-primary); color:#fff; }
    .edit-asset mat-icon { font-size:16px; width:16px; height:16px; }
    .h2edit { float:right; display:inline-grid; place-items:center; width:22px; height:22px; border:0; border-radius:6px; background:transparent; color:var(--text-muted); cursor:pointer; margin-top:-2px; }
    .h2edit:hover { background:var(--brand-primary-soft); color:var(--brand-primary-dark); }
    .h2edit mat-icon { font-size:15px; width:15px; height:15px; }
    .editform { padding:10px 16px 14px; }
    .editform .fld { display:flex; flex-direction:column; gap:3px; margin-bottom:10px; }
    .editform label { font-size:11.5px; font-weight:600; color:var(--text-muted); text-transform:uppercase; letter-spacing:.3px; }
    .editform input { font:inherit; font-size:13px; padding:7px 10px; border:1px solid var(--border); border-radius:6px; background:var(--surface); color:var(--brand-text); }
    .editform input:focus { outline:none; border-color:var(--brand-primary); box-shadow:0 0 0 2px var(--brand-primary-soft); }
    .formactions { display:flex; gap:8px; margin-top:6px; }
    .btn { display:inline-flex; align-items:center; gap:5px; font:inherit; font-size:13px; font-weight:600; padding:7px 14px; border-radius:8px; cursor:pointer; border:1px solid var(--border); background:var(--surface); color:var(--text-muted); }
    .btn:hover { background:var(--surface-2); }
    .btn:disabled { opacity:.6; cursor:default; }
    .btn.ok { border-color:var(--brand-primary); background:var(--brand-primary); color:#fff; }
    .btn.ok:hover { background:var(--brand-primary-dark); }
    .btn mat-icon { font-size:16px; width:16px; height:16px; }
    .formerr { color:var(--danger-fg); font-size:12.5px; margin-top:8px; }
  `],
})
export class ComputerDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(OcsService);

  id = '';
  loading = true;
  error = '';
  tab: 'resumo' | 'config' | 'software' = 'resumo';

  hw: Record<string, any> | null = null;
  lastUser = '—';
  descricao = '';
  editingDesc = false;
  descDraft = '';
  savingDesc = false;

  // edicao do ativo (campos administrativos)
  labels: AdminField[] = [];
  ai: Record<string, any> | undefined;
  editingAsset = false;
  savingAsset = false;
  assetError = '';
  editFields: EditField[] = [];
  descDraftAsset = '';
  adminOptions: Record<string, string[]> = {};
  optionsLoaded = false;
  info: Row[] = [];
  lifecycle: Row[] = [];
  scan: Row[] = [];
  location: Row[] = [];
  custom: Row[] = [];
  antivirus: string[] = [];
  crypto: Crypto[] = [];
  sqlInstances: SqlInstance[] = [];
  nets: Net[] = [];
  disks: Disk[] = [];
  chips: string[] = [];

  networks: any[] = [];
  drives: any[] = [];
  storages: any[] = [];
  memories: any[] = [];
  videos: any[] = [];
  monitors: any[] = [];
  software: any[] = [];
  swView: any[] = [];

  netCols = [{ h: 'Descrição', k: 'DESCRIPTION' }, { h: 'MAC', k: 'MACADDR' }, { h: 'IP', k: 'IPADDRESS' }, { h: 'Máscara', k: 'IPMASK' }, { h: 'Gateway', k: 'IPGATEWAY' }, { h: 'Status', k: 'STATUS' }];
  driveCols = [{ h: 'Letra', k: 'LETTER' }, { h: 'Volume', k: 'VOLUMN' }, { h: 'FS', k: 'FILESYSTEM' }, { h: 'Total', k: 'TOTAL', gb: true }, { h: 'Livre', k: 'FREE', gb: true }];
  storCols = [{ h: 'Modelo', k: 'MODEL' }, { h: 'Tipo', k: 'TYPE' }, { h: 'Tamanho', k: 'DISKSIZE', gb: true }, { h: 'Fabricante', k: 'MANUFACTURER' }];
  memCols = [{ h: 'Slot', k: 'CAPTION' }, { h: 'Capacidade (MB)', k: 'CAPACITY' }, { h: 'Tipo', k: 'TYPE' }, { h: 'Velocidade', k: 'SPEED' }];
  vidCols = [{ h: 'Nome', k: 'NAME' }, { h: 'Chipset', k: 'CHIPSET' }, { h: 'Memória', k: 'MEMORY' }, { h: 'Resolução', k: 'RESOLUTION' }];
  monCols = [{ h: 'Descrição', k: 'CAPTION' }, { h: 'Fabricante', k: 'MANUFACTURER' }, { h: 'Serial', k: 'SERIAL' }];

  fresh = freshness;
  freshLabel = freshnessLabel;
  fmtTs = fmtDbTs;

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.api.computer(this.id).subscribe({
      next: (d) => { this.build(d); this.loading = false; },
      error: (e) => { this.error = 'Falha ao carregar a máquina: ' + (e?.error?.error || e?.message || e); this.loading = false; },
    });
  }

  private arr(d: ComputerDetail, key: string): any[] {
    const v = (d as Record<string, unknown>)[key];
    return Array.isArray(v) ? v : [];
  }

  private build(d: ComputerDetail): void {
    const h = (d.hardware || {}) as Record<string, any>;
    this.hw = h;
    const bios = (d.bios || {}) as Record<string, any>;
    const ai = (Array.isArray(d.accountinfo) ? d.accountinfo[0] : d.accountinfo) as Record<string, any> | undefined;
    const labels: AdminField[] = d.adminFields || [];
    this.ai = ai;
    this.labels = labels;

    this.networks = this.arr(d, 'networks');
    this.drives = this.arr(d, 'drives');
    this.storages = this.arr(d, 'storages');
    this.memories = this.arr(d, 'memories');
    this.videos = this.arr(d, 'videos');
    this.monitors = this.arr(d, 'monitors');
    this.software = this.arr(d, 'software').slice().sort((a, b) => String(a.NAME || '').localeCompare(String(b.NAME || '')));
    this.swView = this.software;

    this.lastUser = (ai?.['fields_4'] || h['USERID'] || '—') as string;
    this.descricao = String(ai?.['fields_16'] || '').trim();
    const memType = this.memories.find((m) => m.TYPE && m.TYPE !== 'Unknown')?.TYPE || '';
    const gfx = this.videos.map((v) => v.NAME).filter(Boolean).join(', ');
    const mb = (bios['MMANUFACTURER'] || '') + (bios['MMODEL'] ? ' ' + bios['MMODEL'] : '');

    this.info = [
      { icon: this.osIcon, label: 'Tipo de ativo', value: this.osFamily },
      { icon: 'badge', label: 'FQDN', value: h['NAME'] + (h['WORKGROUP'] ? '.' + h['WORKGROUP'] : '') },
      { icon: 'desktop_windows', label: 'SO', value: this.show(h['OSNAME']) },
      { icon: 'tag', label: 'Build', value: this.show(h['OSVERSION']) },
      { icon: 'domain', label: 'Domínio', value: this.show(h['WORKGROUP']) },
      { icon: 'factory', label: 'Fabricante', value: this.show(bios['SMANUFACTURER']) },
      { icon: 'laptop', label: 'Modelo', value: this.show(bios['SMODEL']) },
      { icon: 'memory', label: 'Memória', value: mbToGb(this.num(h['MEMORY'])) + (memType ? ' ' + memType : '') },
      { icon: 'developer_board', label: 'Processador', value: this.show(h['PROCESSORT']) },
      { icon: 'dashboard', label: 'Placa-mãe', value: this.show(mb.trim()) },
      { icon: 'monitor', label: 'Gráficos', value: this.show(gfx) },
      { icon: 'confirmation_number', label: 'Nº de série', value: this.show(bios['SSN']) },
    ].filter((r) => r.value !== '—');

    // antivirus a partir do software instalado
    const avRe = /sophos|defender|kaspersky|mcafee|crowdstrike|trend micro|avast|eset|bitdefender|sentinelone|malwarebytes/i;
    this.antivirus = [...new Set(this.software.map((s) => String(s.NAME || '')).filter((n) => avRe.test(n)))].slice(0, 6);

    // criptografia de disco (plugin bitlockerstatus); bloco some quando nao ha coleta
    this.crypto = this.arr(d, 'bitlocker').map((b) => {
      const conv = String(b.CONVERSIONSTATUS || '');
      const prot = String(b.PROTECTIONSTATUS || '');
      const on = /^on$/i.test(prot) || /^1$/.test(prot);
      const label = /fullyencrypted/i.test(conv) ? 'Criptografado'
        : /encryptioninprogress/i.test(conv) ? 'Criptografando'
        : /decryptioninprogress/i.test(conv) ? 'Descriptografando'
        : /fullydecrypted/i.test(conv) ? 'Não criptografado'
        : (conv || '—');
      return {
        drive: String(b.DRIVE || ''),
        status: on ? label : (label === 'Criptografado' ? 'Criptografado, proteção suspensa' : label),
        method: String(b.ENCRYPMETHOD || ''),
        on,
      };
    });

    // instancias do SQL Server (plugin sqlserver_instances)
    this.sqlInstances = (d.sqlserver || []).map((s: any) => ({
      name: s.name || '',
      edition: s.edition || '',
      version: s.version || '',
      patch: s.patch || '',
      sqlVersion: s.sqlVersion || '',
      productName: s.productName || ''
    }));

    // rede fisica
    this.nets = this.networks
      .filter((n) => n.MACADDR && n.VIRTUALDEV !== '1' && !/virtual|vmware|hyper-v|loopback|bluetooth/i.test(String(n.DESCRIPTION || '')))
      .map((n) => ({ desc: String(n.DESCRIPTION || ''), mac: String(n.MACADDR || ''), ip: String(n.IPADDRESS || ''), speed: String(n.SPEED || '') }));
    if (!this.nets.length && this.networks.length) {
      const n = this.networks[0];
      this.nets = [{ desc: String(n.DESCRIPTION || ''), mac: String(n.MACADDR || ''), ip: String(n.IPADDRESS || ''), speed: '' }];
    }

    // discos
    this.disks = this.drives.map((dr) => {
      const total = this.num(dr.TOTAL), free = this.num(dr.FREE);
      const usedPct = total > 0 ? Math.round(((total - free) / total) * 100) : 0;
      return { letter: String(dr.LETTER || dr.VOLUMN || ''), fs: String(dr.FILESYSTEM || ''), freeGb: mbToGb(free), totalGb: mbToGb(total), usedPct };
    });

    this.lifecycle = [
      { icon: '', label: 'Nº de série', value: this.show(bios['SSN']) },
      { icon: '', label: 'Nº de patrimônio', value: this.clean(bios['ASSETTAG']) },
      { icon: '', label: 'BIOS', value: this.show([bios['BVERSION'], bios['BDATE']].filter(Boolean).join(' · ')) },
      { icon: '', label: 'Chassi', value: this.show(bios['TYPE']) },
    ].filter((r) => r.value !== '—');

    this.scan = [
      { icon: '', label: 'Última varredura com sucesso', value: fmtDbTs(h['LASTDATE']) },
      { icon: '', label: 'Última tentativa', value: fmtDbTs(h['LASTCOME']) },
      { icon: '', label: 'Agente', value: this.show(h['USERAGENT']) },
      { icon: '', label: 'Qualidade', value: this.show(h['QUALITY']) },
    ].filter((r) => r.value !== '—');

    const gw = this.networks.map((n) => n.IPGATEWAY).find(Boolean);
    this.location = [
      { icon: '', label: 'IP', value: this.show(h['IPADDR']) },
      { icon: '', label: 'Gateway', value: this.show(gw) },
      { icon: '', label: 'DNS', value: this.show(h['DNS']) },
      { icon: '', label: 'Departamento', value: this.show(ai?.['fields_10']) },
    ].filter((r) => r.value !== '—');

    this.custom = ai
      ? labels.map((f) => ({ icon: '', label: f.label, value: this.show((ai as Record<string, any>)[f.key]) })).filter((r) => r.value !== '—')
      : [];

    // grupos / tags
    const groups = this.arr(d, 'groups_cache').map((g) => g.GROUP_NAME || g.NAME).filter(Boolean);
    this.chips = [...groups];
    if (ai?.['TAG']) this.chips.push('TAG: ' + ai['TAG']);
    if (ai?.['fields_3']) this.chips.push(ai['fields_3']);
  }

  startEditDesc(): void { this.descDraft = this.descricao; this.editingDesc = true; }
  saveDesc(): void {
    this.savingDesc = true;
    this.api.saveDescription(this.id, this.descDraft.trim()).subscribe({
      next: (r) => { this.descricao = r.description || this.descDraft.trim(); this.editingDesc = false; this.savingDesc = false; },
      error: (e) => { this.error = 'Falha ao salvar descrição: ' + (e?.error?.error || e?.message || e); this.savingDesc = false; },
    });
  }

  trackKey(_i: number, f: EditField): string { return f.key; }

  startEditAsset(): void {
    this.tab = 'resumo';
    this.assetError = '';
    const src = this.ai || {};
    this.editFields = this.labels.map((f) => ({ key: f.key, label: f.label, value: String(src[f.key] ?? '') }));
    this.descDraftAsset = String(src['fields_16'] ?? this.descricao ?? '');
    this.editingAsset = true;
    if (!this.optionsLoaded) {
      this.api.adminOptions().subscribe({
        next: (o) => { this.adminOptions = o || {}; this.optionsLoaded = true; },
        error: () => { /* autocomplete é opcional */ },
      });
    }
  }

  cancelEditAsset(): void { this.editingAsset = false; this.assetError = ''; }

  saveAsset(): void {
    this.savingAsset = true;
    this.assetError = '';
    const fields: Record<string, string> = {};
    for (const f of this.editFields) fields[f.key] = (f.value ?? '').trim();
    fields['fields_16'] = (this.descDraftAsset ?? '').trim();
    this.api.saveAdmin(this.id, fields).subscribe({
      next: () => {
        // recarrega a ficha do servidor p/ refletir tudo (custom, descrição, chips, lista)
        this.api.computer(this.id).subscribe({
          next: (d) => { this.build(d); this.savingAsset = false; this.editingAsset = false; },
          error: () => { this.savingAsset = false; this.editingAsset = false; }, // salvou; só não recarregou
        });
      },
      error: (e) => { this.assetError = 'Falha ao salvar: ' + (e?.error?.error || e?.message || e); this.savingAsset = false; },
    });
  }

  filterSw(v: string): void {
    const q = (v || '').toLowerCase().trim();
    this.swView = !q ? this.software
      : this.software.filter((s) => `${s.NAME || ''} ${s.VERSION || ''} ${s.PUBLISHER || ''}`.toLowerCase().includes(q));
  }

  cell(row: any, c: { k: string; gb?: boolean }): string {
    const v = row[c.k];
    if (c.gb) return mbToGb(this.num(v));
    return this.show(v);
  }

  num(v: unknown): number { const n = Number(v); return isNaN(n) ? 0 : n; }
  clean(v: unknown): string {
    const s = String(v ?? '').trim();
    if (!s || /^(no asset tag|none|unknown|na|to be filled)/i.test(s)) return '—';
    return s;
  }
  show(v: unknown): string {
    if (v === null || v === undefined || v === '' || v === 'NA' || v === 'Unknown') return '—';
    return String(v);
  }

  get osFamily(): string {
    const os = String(this.hw?.['OSNAME'] || '').toLowerCase();
    if (os.includes('windows')) return 'Windows';
    if (os.includes('mac') || os.includes('darwin')) return 'macOS';
    if (os.includes('linux') || os.includes('ubuntu') || os.includes('debian') || os.includes('centos')) return 'Linux';
    return 'Computador';
  }
  get osIcon(): string {
    const f = this.osFamily;
    return f === 'Windows' ? 'window' : f === 'macOS' ? 'laptop_mac' : f === 'Linux' ? 'dns' : 'computer';
  }
}
