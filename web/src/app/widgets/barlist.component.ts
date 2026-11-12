import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Slice } from '../core/models';

@Component({
  selector: 'app-barlist',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul class="bars" *ngIf="data?.length; else vazio">
      <li *ngFor="let d of data">
        <span class="lb" [title]="d.label">{{ d.label }}</span>
        <span class="track"><span class="fill" [style.width.%]="pct(d.value)"></span></span>
        <b>{{ d.value }}</b>
      </li>
    </ul>
    <ng-template #vazio><p class="muted">Sem dados.</p></ng-template>
  `,
  styles: [`
    .bars { list-style:none; margin:0; padding:0; }
    .bars li { display:grid; grid-template-columns:minmax(0,150px) 1fr 40px; align-items:center; gap:12px; padding:6px 0; font-size:13px; }
    .lb { color:var(--text-muted); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .track { height:9px; background:var(--surface-3); border-radius:6px; overflow:hidden; }
    .fill { display:block; height:100%; background:linear-gradient(90deg,var(--brand-primary),var(--brand-primary-dark)); border-radius:6px; }
    .bars b { text-align:right; color:var(--heading); }
  `],
})
export class BarlistComponent {
  @Input() data: Slice[] = [];
  private get max(): number { return Math.max(1, ...(this.data || []).map((d) => d.value)); }
  pct(v: number): number { return Math.round((v / this.max) * 100); }
}
