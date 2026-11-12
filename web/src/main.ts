import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';

// Aplica o tema salvo (ou o do SO) ANTES do Angular renderizar — evita flash.
// Fica no main.ts (bundle 'self') e não num <script> inline, por causa do CSP script-src 'self'.
(function applyInitialTheme() {
  try {
    let t = localStorage.getItem('ocs-theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  } catch { /* localStorage indisponível → tema claro padrão */ }
})();

bootstrapApplication(AppComponent, appConfig).catch((err) => console.error(err));
