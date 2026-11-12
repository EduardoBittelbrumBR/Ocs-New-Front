import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-widget-card',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <section class="wcard">
      <header>
        <mat-icon *ngIf="icon">{{ icon }}</mat-icon>
        <h3>{{ title }}</h3>
        <span class="grow"></span>
        <ng-content select="[actions]"></ng-content>
      </header>
      <div class="body"><ng-content></ng-content></div>
    </section>
  `,
  styles: [`
    .wcard { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden;
      box-shadow:0 1px 3px var(--shadow); display:flex; flex-direction:column; height:100%; min-width:0; }
    header { display:flex; align-items:center; gap:9px; padding:13px 16px; border-bottom:1px solid var(--border-soft);
      background:var(--surface-2); }
    header mat-icon { color:var(--brand-primary); font-size:20px; width:20px; height:20px; }
    h3 { margin:0; font-size:14px; font-weight:600; color:var(--heading); }
    .grow { flex:1; }
    .body { padding:16px; flex:1; }
  `],
})
export class WidgetCardComponent {
  @Input() title = '';
  @Input() icon = '';
}
