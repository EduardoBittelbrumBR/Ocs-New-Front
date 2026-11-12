import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

/** Alterna o tema claro/escuro, persiste em localStorage e segue o SO na 1ª visita. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly KEY = 'ocs-theme';
  readonly theme = signal<Theme>('light');

  /** Sincroniza o signal com o tema já aplicado no <html> pelo script do index.html. */
  init(): void {
    const attr = document.documentElement.getAttribute('data-theme');
    this.theme.set(attr === 'dark' ? 'dark' : 'light');
  }

  set(t: Theme): void {
    this.theme.set(t);
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem(this.KEY, t); } catch { /* ignora */ }
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }
}
