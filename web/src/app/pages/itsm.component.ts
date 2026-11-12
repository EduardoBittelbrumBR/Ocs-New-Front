import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

interface Toc { id: string; label: string; icon: string; }

@Component({
  selector: 'app-itsm',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="doc">
      <aside class="toc">
        <div class="toc-title">Documentation</div>
        <a *ngFor="let t of toc" (click)="go(t.id)"><mat-icon>{{ t.icon }}</mat-icon>{{ t.label }}</a>
        <div class="toc-foot">OCS Console</div>
      </aside>

      <div class="body">
        <header class="hero">
          <h1>OCS Console <span>· Service documentation (ITSM)</span></h1>
          <p>A complete guide to the OCS Inventory console: what it is, how to access it, how to use it and how it is operated.</p>
          <div class="badges">
            <span class="badge ok"><mat-icon>lang</mat-icon> Configurable via BASE_URL</span>
            <span class="badge"><mat-icon>verified_user</mat-icon> SSO (OIDC) · authorized group</span>
            <span class="badge"><mat-icon>schedule</mat-icon> Internal service · IT/Infra</span>
          </div>
        </header>

        <section id="visao">
          <h2><mat-icon>info</mat-icon> 1. Overview</h2>
          <p>The <b>OCS Console</b> is a web portal for querying the IT inventory collected by <b>OCS Inventory NG</b> agents.
             It reads data directly from the OCS MariaDB database (<code>ocsweb</code>) and presents it in a modern interface,
             replacing the classic <code>/ocsreports</code> screen for read-only queries.</p>
          <div class="cards">
            <div class="card"><mat-icon>flag</mat-icon><b>Goal</b><span>Visualize, search and export the fleet of machines (hardware, software, network) in a fast and friendly way.</span></div>
            <div class="card"><mat-icon>groups</mat-icon><b>Audience</b><span>IT/Infrastructure team (members of the authorized group configured via <code>AUTHORIZED_GROUP_ID</code>).</span></div>
            <div class="card"><mat-icon>fact_check</mat-icon><b>Scope</b><span>Query, edit administrative fields (description, owner, type, cost, etc.) and full CSV export. Does not replace the OCS admin console.</span></div>
          </div>
        </section>

        <section id="acesso">
          <h2><mat-icon>vpn_key</mat-icon> 2. Access</h2>
          <table class="kv">
            <tr><th>URL (production)</th><td>Configured via <code>BASE_URL</code> env var — HTTPS via reverse proxy recommended</td></tr>
            <tr><th>URL (internal)</th><td><code>http://&lt;host&gt;:8080</code> — internal network / VPN only</td></tr>
            <tr><th>Authentication</th><td>OIDC/SSO (e.g. Microsoft Entra ID) — only members of the authorized group</td></tr>
            <tr><th>Classic console</th><td><code>/ocsreports</code> on the OCS server — for admin tasks (LDAP config, deletions, etc.)</td></tr>
          </table>
        </section>

        <section id="usar">
          <h2><mat-icon>mouse</mat-icon> 3. How to use</h2>
          <h3>Dashboard</h3>
          <p>KPIs (total assets, servers, workstations, stale) + charts (by OS, by company, by type, by freshness) + lists (recent, need attention). Click a KPI to filter the asset list.</p>
          <h3>Assets</h3>
          <p>Searchable/sortable/paginated table with freshness chips. Sub-tabs: All / Servers / Workstations. Click a row to open the asset detail page. Export CSV from the toolbar.</p>
          <h3>Asset detail</h3>
          <p>Summary (type, OS, CPU, memory, disks, network, antivirus) + administrative fields (editable) + hardware tables + software list. BitLocker status and SQL Server instances shown if the corresponding OCS plugins are installed.</p>
          <h3>Software</h3>
          <p>Aggregated software list (name, publisher, versions, install count) with search and CSV export.</p>
          <h3>Reports</h3>
          <p>Shortcuts that open the asset list pre-filtered (recently added, stale, by type, etc.).</p>
        </section>

        <section id="dados">
          <h2><mat-icon>storage</mat-icon> 4. Data source</h2>
          <p>The BFF (Node/Express) reads directly from the OCS MariaDB <code>ocsweb</code> database — not from the REST API.
             This is faster and gives access to all fields. Administrative field labels are loaded dynamically from
             <code>accountinfo_config</code> (or a JSON file via <code>ADMIN_FIELDS_FILE</code>), so they adapt to your OCS configuration.</p>
          <p>Optional plugin tables (<code>bitlockerstatus</code>, <code>sqlserver_instances</code>, <code>windows_updates</code>, <code>linux_updates</code>) are queried with graceful fallback — if a plugin is not installed, the corresponding UI section simply doesn't render.</p>
        </section>

        <section id="operacao">
          <h2><mat-icon>build</mat-icon> 5. Operation &amp; support</h2>
          <h3>Deploy</h3>
          <p>Docker multi-stage build: Angular is compiled in the first stage, the BFF serves the static files + API from a single container on port 3000 (mapped to 8080). See <code>docker-compose.yml</code>.</p>
          <h3>Configuration</h3>
          <p>All settings via environment variables (see <code>.env.example</code>): database connection, OIDC auth, admin fields, server-type detection, cache TTL.</p>
          <h3>Backup</h3>
          <p>The OCS database backup is the responsibility of the OCS server administrator. The console itself is stateless (except for the optional suggestions table, which is recreated automatically).</p>
        </section>

        <section id="seg">
          <h2><mat-icon>security</mat-icon> 6. Security &amp; privacy</h2>
          <ul>
            <li><b>Auth:</b> OIDC (e.g. Entra ID) with group-based authorization. Session stored in MariaDB (survives restart), 1h hard cap (no rolling) — re-login silently re-validates group membership.</li>
            <li><b>Headers:</b> helmet CSP, rate limiting (600/5min on /api, 40/15min on /auth), HSTS/X-Frame from the proxy.</li>
            <li><b>Container:</b> runs as non-root (<code>USER node</code>), read-only filesystem, all capabilities dropped, <code>no-new-privileges</code>.</li>
            <li><b>SQL:</b> all queries use parameterized placeholders — no injection. Admin field column names come from a server-side whitelist, never from the client.</li>
            <li><b>Errors:</b> clients receive a generic message + correlation ID; details stay in server logs.</li>
          </ul>
        </section>

        <section id="faq">
          <h2><mat-icon>help</mat-icon> 7. FAQ</h2>
          <details><summary>How do I add a new administrative field?</summary>
            <p>Create it in the OCS console (Configuration &gt; New data) or via SQL in <code>accountinfo_config</code>. The console picks it up automatically on the next BFF restart (or immediately if loaded from <code>ADMIN_FIELDS_FILE</code>).</p>
          </details>
          <details><summary>The asset list is empty / shows no data</summary>
            <p>Check that the BFF can connect to the database (<code>GET /api/health</code> returns <code>&#123;"ok":true&#125;</code>). Verify <code>DB_HOST</code>, <code>DB_USER</code>, <code>DB_PASS</code> in <code>.env</code>.</p>
          </details>
          <details><summary>How is "server" vs "workstation" determined?</summary>
            <p>By the <code>SERVER_TYPE_FIELD</code> (default <code>fields_6</code>) and <code>SERVER_TYPE_PATTERN</code> (default <code>serv|server</code>) env vars, with a fallback to the OS name.</p>
          </details>
          <details><summary>Can I use a different identity provider?</summary>
            <p>The BFF uses <code>@azure/msal-node</code> for Microsoft Entra ID. To use a generic OIDC provider (Keycloak, Authentik, Google, etc.), replace the MSAL integration with <code>openid-client</code> — the auth flow structure (login/callback/logout/me) stays the same.</p>
          </details>
        </section>
      </div>
    </div>
  `,
  styles: [`
    .doc { display:flex; gap:24px; max-width:1500px; margin:0 auto; padding:24px; }
    .toc { flex:0 0 220px; position:sticky; top:20px; align-self:flex-start; background:var(--surface);
      border:1px solid var(--border); border-radius:14px; padding:16px 12px; }
    .toc-title { font-weight:700; font-size:13px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.5px; margin-bottom:10px; padding:0 8px; }
    .toc a { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; cursor:pointer;
      color:var(--heading); font-size:13.5px; text-decoration:none; }
    .toc a:hover { background:var(--brand-primary-soft); color:var(--brand-primary-dark); }
    .toc a mat-icon { font-size:18px; width:18px; height:18px; color:var(--text-muted); }
    .toc-foot { margin-top:14px; padding-top:12px; border-top:1px solid var(--border-soft); font-size:11.5px; color:var(--text-muted); }
    .body { flex:1; min-width:0; }
    .hero { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:28px 30px; margin-bottom:20px; }
    .hero h1 { margin:0 0 6px; font-size:22px; color:var(--heading); font-weight:700; }
    .hero h1 span { color:var(--text-muted); font-weight:400; }
    .hero p { margin:0; color:var(--text-muted); font-size:14px; }
    .badges { display:flex; flex-wrap:wrap; gap:8px; margin-top:14px; }
    .badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:999px;
      font-size:12px; background:var(--surface-3); color:var(--text-muted); }
    .badge mat-icon { font-size:16px; width:16px; height:16px; }
    .badge.ok { background:var(--brand-primary-soft); color:var(--brand-primary-dark); }
    section { background:var(--surface); border:1px solid var(--border); border-radius:14px; padding:24px 28px; margin-bottom:16px; }
    section h2 { display:flex; align-items:center; gap:8px; margin:0 0 14px; font-size:17px; color:var(--heading); }
    section h2 mat-icon { color:var(--brand-primary); }
    section h3 { margin:16px 0 6px; font-size:14.5px; color:var(--heading); }
    section p { margin:0 0 10px; line-height:1.6; color:var(--brand-text); font-size:14px; }
    section ul { margin:0; padding-left:20px; }
    section li { margin-bottom:8px; line-height:1.5; color:var(--brand-text); font-size:14px; }
    .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:12px; margin-top:12px; }
    .card { background:var(--surface-2); border:1px solid var(--border-soft); border-radius:10px; padding:14px; }
    .card mat-icon { color:var(--brand-primary); }
    .card b { display:block; margin:6px 0 4px; font-size:13.5px; }
    .card span { font-size:13px; color:var(--text-muted); }
    .kv { width:100%; border-collapse:collapse; }
    .kv th { text-align:left; padding:8px 12px; background:var(--surface-2); border:1px solid var(--border-soft);
      font-size:13px; color:var(--text-muted); width:30%; }
    .kv td { padding:8px 12px; border:1px solid var(--border-soft); font-size:13.5px; color:var(--brand-text); }
    code { background:var(--code-bg); padding:1px 6px; border-radius:4px; font-size:12.5px; }
    details { background:var(--surface-2); border:1px solid var(--border-soft); border-radius:10px; padding:12px 16px; margin-bottom:8px; }
    details summary { cursor:pointer; font-weight:600; font-size:14px; color:var(--heading); }
    details p { margin:10px 0 0; }
    @media (max-width:768px) { .toc { display:none; } }
  `],
})
export class ItsmComponent {
  toc: Toc[] = [
    { id: 'visao', label: 'Overview', icon: 'info' },
    { id: 'acesso', label: 'Access', icon: 'vpn_key' },
    { id: 'usar', label: 'How to use', icon: 'mouse' },
    { id: 'dados', label: 'Data source', icon: 'storage' },
    { id: 'operacao', label: 'Operation', icon: 'build' },
    { id: 'seg', label: 'Security', icon: 'security' },
    { id: 'faq', label: 'FAQ', icon: 'help' },
  ];
  go(id: string) { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }
}
