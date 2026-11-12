import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../core/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="wrap">
      <div class="card">
        <img class="mark" src="assets/logo.svg" alt="OCS Console" />

        <h1>OCS <span>Console</span></h1>
        <p class="sub">Inventory Dashboard</p>

        <div class="msg" *ngIf="error === 'forbidden'">
          <mat-icon>block</mat-icon>
          <span>Your user does not have access. Membership in the authorized group is required.</span>
        </div>
        <div class="msg" *ngIf="error && error !== 'forbidden'">
          <mat-icon>error_outline</mat-icon>
          <span>Could not complete login. Please try again.</span>
        </div>

        <button class="sso-btn" (click)="login()">
          <mat-icon>login</mat-icon>
          Sign in with SSO
        </button>

        <p class="hint">Use your corporate account</p>
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height:100vh; display:grid; place-items:center;
      background:radial-gradient(1200px 600px at 50% -10%, #0d1c4a 0%, #071132 60%); padding:24px; }
    .card { width:min(400px,92vw); background:var(--surface); border-radius:18px; padding:34px 30px 26px;
      box-shadow:0 20px 60px rgba(0,0,0,.35); text-align:center; }
    .mark { width:72px; height:72px; border-radius:14px; box-shadow:0 3px 10px rgba(0,0,0,.2); }
    h1 { margin:16px 0 0; font-size:24px; color:var(--heading); font-weight:400; }
    h1 span { color:var(--brand-primary); font-weight:700; }
    .sub { margin:2px 0 18px; color:var(--text-muted); font-size:13px; }
    .msg { display:flex; align-items:center; gap:8px; text-align:left; background:var(--danger-bg); color:var(--danger-fg);
      padding:10px 12px; border-radius:10px; font-size:13px; margin-bottom:16px; }
    .msg mat-icon { flex:0 0 auto; }
    .sso-btn { width:100%; display:flex; align-items:center; justify-content:center; gap:10px;
      background:var(--brand-secondary); color:#fff; border:0; border-radius:10px; padding:13px 16px;
      font-size:15px; font-weight:600; cursor:pointer; transition:background .12s; }
    .sso-btn:hover { background:#0d1c4a; }
    .hint { margin:14px 0 0; color:var(--text-muted); font-size:12px; }
  `],
})
export class LoginComponent {
  private route = inject(ActivatedRoute);
  private auth = inject(AuthService);
  error = this.route.snapshot.queryParamMap.get('error') || '';

  login(): void { this.auth.login(); }
}
