import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Slice } from '../core/models';

interface Arc { d: string; color: string; label: string; value: number; pct: number; }

const PALETTE = ['#3d6fb4', '#071132', '#4a7d16', '#76b729', '#f59e0b', '#e53935', '#8e6bd0', '#00897b', '#a1b1bc'];

@Component({
  selector: 'app-donut',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="donut" *ngIf="total > 0; else vazio">
      <svg viewBox="0 0 42 42" class="ring">
        <circle class="ring-bg" cx="21" cy="21" r="15.915" fill="none" stroke-width="6"></circle>
        <circle *ngFor="let a of arcs" cx="21" cy="21" r="15.915" fill="none"
          [attr.stroke]="a.color" stroke-width="6"
          [attr.stroke-dasharray]="a.d" [attr.stroke-dashoffset]="a.offset"></circle>
        <text x="21" y="20" text-anchor="middle" class="c-num">{{ total }}</text>
        <text x="21" y="25.5" text-anchor="middle" class="c-lbl">{{ centerLabel }}</text>
      </svg>
      <ul class="legend">
        <li *ngFor="let a of arcs">
          <span class="sw" [style.background]="a.color"></span>
          <span class="lb" [title]="a.label">{{ a.label }}</span>
          <b>{{ a.value }}</b><span class="pc">{{ a.pct }}%</span>
        </li>
      </ul>
    </div>
    <ng-template #vazio><p class="muted">Sem dados.</p></ng-template>
  `,
  styles: [`
    .donut { display:flex; align-items:center; gap:18px; flex-wrap:wrap; }
    .ring { width:150px; height:150px; flex:0 0 auto; }
    .ring-bg { stroke:var(--surface-3); }
    .c-num { font-size:9px; font-weight:700; fill:var(--heading); }
    .c-lbl { font-size:3px; fill:var(--text-muted); text-transform:uppercase; letter-spacing:.3px; }
    .legend { list-style:none; margin:0; padding:0; flex:1 1 160px; min-width:0; }
    .legend li { display:flex; align-items:center; gap:8px; padding:4px 0; font-size:13px; }
    .sw { width:11px; height:11px; border-radius:3px; flex:0 0 auto; }
    .lb { flex:1; color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .legend b { color:var(--heading); }
    .pc { color:var(--text-muted); width:38px; text-align:right; }
  `],
})
export class DonutComponent {
  @Input() centerLabel = 'total';
  arcs: (Arc & { offset: string })[] = [];
  total = 0;

  private _data: Slice[] = [];
  @Input() set data(v: Slice[]) {
    this._data = v || [];
    this.build();
  }

  private build(): void {
    const data = this._data.filter((d) => d.value > 0);
    this.total = data.reduce((s, d) => s + d.value, 0);
    const circ = 100; // usando r=15.915 -> circunferencia ~100
    let acc = 0;
    this.arcs = data.map((d, i) => {
      const pct = this.total ? (d.value / this.total) * 100 : 0;
      const len = (pct / 100) * circ;
      const arc = {
        d: `${len.toFixed(2)} ${(circ - len).toFixed(2)}`,
        offset: (circ - acc + 25).toFixed(2), // +25 alinha o inicio ao topo
        color: PALETTE[i % PALETTE.length],
        label: d.label,
        value: d.value,
        pct: Math.round(pct),
      };
      acc += len;
      return arc;
    });
  }
}
