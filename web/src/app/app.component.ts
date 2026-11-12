import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { filter } from 'rxjs';
import { AuthService } from './core/auth.service';
import { ThemeService } from './core/theme.service';

interface NavItem { label: string; icon: string; link: string; }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule],
  template: `
    <!-- Barra de topo -->
    <header class="topbar" *ngIf="showChrome()">
      <a routerLink="/" class="logo">
        <img class="logo-mark" src="assets/logo.svg" alt="OCS Console" />
        <span class="logo-txt">OCS <b>Console</b></span>
      </a>
      <span class="ver">Inventory</span>

      <div class="search">
        <mat-icon>search</mat-icon>
        <input [(ngModel)]="q" (keyup.enter)="search()" placeholder="Buscar ativo, IP, usuário, TAG…" />
      </div>

      <span class="grow"></span>
      <button class="ic" [title]="theme.theme() === 'dark' ? 'Tema claro' : 'Tema escuro'" (click)="theme.toggle()">
        <mat-icon>{{ theme.theme() === 'dark' ? 'light_mode' : 'dark_mode' }}</mat-icon>
      </button>
      <button class="ic" title="Atualizar" (click)="reloadApp()"><mat-icon>refresh</mat-icon></button>
      <ng-container *ngIf="auth.isReal; else guest">
        <span class="avatar" [title]="auth.user()?.email">{{ initials() }}</span>
        <span class="uname">{{ auth.user()?.name }}</span>
        <button class="ic" title="Sair" (click)="auth.logout()"><mat-icon>logout</mat-icon></button>
      </ng-container>
      <ng-template #guest><span class="avatar" title="Guest">G</span></ng-template>
    </header>

    <!-- Menu horizontal -->
    <nav class="mainnav" *ngIf="showChrome()">
      <a *ngFor="let n of nav" [routerLink]="n.link"
         routerLinkActive="active" [routerLinkActiveOptions]="{ exact: n.link === '/' }">
        <mat-icon>{{ n.icon }}</mat-icon>{{ n.label }}
      </a>
    </nav>

    <router-outlet></router-outlet>
  `,
  styles: [`
    .topbar { display:flex; align-items:center; gap:16px; height:66px; padding:0 26px;
      background:var(--topbar-bg); border-bottom:1px solid var(--border); box-shadow:0 1px 4px var(--shadow); }
    .logo { display:flex; align-items:center; gap:10px; text-decoration:none; color:var(--heading); }
    .logo-mark { width:46px; height:46px; border-radius:11px; display:block;
      box-shadow:0 1px 4px rgba(0,0,0,.22); }
    .logo-txt { font-size:19px; font-weight:400; }
    .logo-txt b { color:var(--brand-primary); font-weight:700; }
    .ver { font-size:12px; color:var(--text-muted); border-left:1px solid var(--border); padding-left:16px; }
    .search { flex:0 1 460px; display:flex; align-items:center; gap:8px; background:var(--surface-2);
      border:1px solid var(--border); border-radius:22px; padding:6px 14px; color:var(--text-muted); }
    .search input { border:0; background:transparent; outline:none; width:100%; font:inherit; color:var(--brand-text); }
    .search mat-icon { font-size:20px; width:20px; height:20px; }
    .grow { flex:1; }
    .ic { display:grid; place-items:center; width:38px; height:38px; border-radius:50%; border:0;
      background:transparent; color:var(--text-muted); cursor:pointer; text-decoration:none; }
    .ic:hover { background:var(--brand-primary-soft); color:var(--brand-primary-dark); }
    .avatar { display:grid; place-items:center; width:34px; height:34px; border-radius:50%;
      background:var(--brand-primary); color:#fff; font-weight:700; font-size:13px; }
    .uname { font-size:13px; color:var(--heading); font-weight:500; max-width:170px;
      overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .mainnav { display:flex; gap:2px; padding:0 18px; background:var(--brand-secondary);
      overflow-x:auto; border-bottom:3px solid var(--brand-primary); box-shadow:0 3px 10px rgba(7,17,50,.14); position:relative; z-index:1; }
    .mainnav a { display:flex; align-items:center; gap:7px; padding:15px 18px; color:#c7d0dc;
      text-decoration:none; font-size:14px; white-space:nowrap; border-bottom:3px solid transparent; margin-bottom:-3px; }
    .mainnav a mat-icon { font-size:19px; width:19px; height:19px; }
    .mainnav a:hover { color:#fff; background:rgba(255,255,255,.06); }
    .mainnav a.active { color:#fff; border-bottom-color:var(--brand-primary); background:rgba(118,183,41,.12); }
  `],
})
export class AppComponent implements OnInit {
  private router = inject(Router);
  auth = inject(AuthService);
  theme = inject(ThemeService);
  q = '';
  showChrome = signal(!this.router.url.startsWith('/login'));
  nav: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard', link: '/' },
    { label: 'Ativos', icon: 'devices', link: '/ativos' },
    { label: 'Software', icon: 'apps', link: '/software' },
    { label: 'Relatórios', icon: 'assessment', link: '/relatorios' },
    { label: 'SQL Server', icon: 'storage', link: '/sqlserver' },
    { label: 'Servidor', icon: 'dns', link: '/servidor' },
    { label: 'ITSM', icon: 'menu_book', link: '/itsm' },
  ];

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e) => {
      this.showChrome.set(!(e as NavigationEnd).urlAfterRedirects.startsWith('/login'));
    });
  }

  ngOnInit(): void { this.theme.init(); this.auth.check(); }

  initials(): string {
    const n = this.auth.user()?.name || '';
    return n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U';
  }

  search(): void {
    const term = this.q.trim();
    this.router.navigate(['/ativos'], { queryParams: term ? { q: term } : {} });
  }

  reloadApp(): void {
    location.reload();
  }
}
