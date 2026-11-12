import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface Me {
  authenticated: boolean;
  authDisabled?: boolean;
  name?: string;
  email?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  user = signal<Me | null>(null);
  private loaded = false;

  /** Garante o estado de auth (cacheado). Retorna true se pode acessar. */
  async check(): Promise<boolean> {
    if (this.loaded) return !!this.user()?.authenticated;
    try {
      const me = await firstValueFrom(this.http.get<Me>('/auth/me'));
      this.user.set(me);
      this.loaded = true;
      return !!me.authenticated;
    } catch {
      this.user.set(null);
      this.loaded = true;
      return false;
    }
  }

  get isReal(): boolean {
    const u = this.user();
    return !!u?.authenticated && !u?.authDisabled;
  }

  login(): void { window.location.href = '/auth/login'; }
  logout(): void { window.location.href = '/auth/logout'; }
}
