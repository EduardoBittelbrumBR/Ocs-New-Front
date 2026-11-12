import express from 'express';
import compression from 'compression';
import session from 'express-session';
import expressMySQLSession from 'express-mysql-session';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mysql from 'mysql2/promise';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfidentialClientApplication } from '@azure/msal-node';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT || 3000);
const CACHE_TTL = Number(process.env.CACHE_TTL || 60) * 1000;

// ---- autenticacao (OIDC / Entra ID / Office 365) ----
const AUTH_ENABLED = String(process.env.AUTH_ENABLED || '').toLowerCase() === 'true';
const TENANT_ID = process.env.TENANT_ID || '';
const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';
const BASE_URL = (process.env.BASE_URL || '').replace(/\/+$/, '');
const AUTHORIZED_GROUP_ID = process.env.AUTHORIZED_GROUP_ID || '';
const REDIRECT_URI = `${BASE_URL}/auth/callback`;
const SCOPES = ['openid', 'profile', 'email', 'User.Read'];

// ---- campos administrativos (accountinfo) ----
// Campo usado como descrição livre do ativo (editável na ficha)
const DESCRIPTION_FIELD = process.env.DESCRIPTION_FIELD || 'fields_16';
// Campo e padrão que definem se um ativo é "servidor" (para filtros e estatísticas)
const SERVER_TYPE_FIELD = process.env.SERVER_TYPE_FIELD || 'fields_6';
const SERVER_TYPE_PATTERN = process.env.SERVER_TYPE_PATTERN || 'serv|server';

// ADMIN_FIELDS pode vir de:
//   1. JSON externo apontado por ADMIN_FIELDS_FILE (array de {key,label})
//   2. Tabela accountinfo_config do próprio OCS (lida do banco na inicialização)
//   3. Array vazio (frontend mostra só o que vier do DB dinamicamente)
let ADMIN_FIELDS = [];
const ADMIN_FIELDS_FILE = process.env.ADMIN_FIELDS_FILE || '';
if (ADMIN_FIELDS_FILE) {
  try {
    ADMIN_FIELDS = JSON.parse(require('node:fs').readFileSync(ADMIN_FIELDS_FILE, 'utf8'));
    console.log(`[admin-fields] carregado de ${ADMIN_FIELDS_FILE}: ${ADMIN_FIELDS.length} campos`);
  } catch (e) { console.error('[admin-fields] falha ao ler ADMIN_FIELDS_FILE:', e?.message || e); }
}
// colunas de accountinfo que a ficha pode editar (TAG + ADMIN_FIELDS + descrição)
const EDITABLE_KEYS = [...ADMIN_FIELDS.map((f) => f.key), DESCRIPTION_FIELD];
const EDITABLE_SET = new Set(EDITABLE_KEYS);

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'host.docker.internal',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'ocs',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'ocsweb',
  connectionLimit: 8,
  waitForConnections: true,
  charset: 'utf8mb4',
  dateStrings: true,
});
async function q(sql, params) { const [rows] = await pool.query(sql, params); return rows; }
const NOTGROUP = "(h.DEVICEID IS NULL OR h.DEVICEID <> '_SYSTEMGROUP_')";

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// ---- cabeçalhos de segurança (Achado 9) ----
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Angular/Material injetam estilos inline; Google Fonts (Roboto + Material Icons)
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: false,        // TLS/HSTS terminam no proxy (evita header duplicado)
  frameguard: false,  // frameAncestors do CSP cobre; X-Frame-Options vem do proxy
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginEmbedderPolicy: false, // não bloquear as fontes cross-origin
}));
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  next();
});

// ---- rate limiting (Achado 10) ----
const apiLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false });

app.use(compression());
app.use(express.json({ limit: '16kb' }));

// ================= AUTENTICACAO =================
let cca = null;
if (AUTH_ENABLED) {
  // store de sessão em MariaDB (Achado 7) — sobrevive a restart, permite escalar
  const MySQLStore = expressMySQLSession(session);
  const sessionStore = new MySQLStore({
    host: process.env.DB_HOST || 'host.docker.internal',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'ocs',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'ocsweb',
    createDatabaseTable: true,
    schema: { tableName: 'sessions' },
  });
  sessionStore.on('error', (e) => console.error('[session-store]', e?.message || e));

  app.use('/auth', authLimiter);
  app.use(session({
    name: 'ocs.sid',
    store: sessionStore,
    secret: process.env.SESSION_SECRET || crypto.randomBytes(16).toString('hex'),
    resave: false,
    saveUninitialized: false,
    // hard 1h cap (no rolling): forces silent re-login via SSO, which re-validates group membership
    cookie: { httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 1000 },
  }));
  cca = new ConfidentialClientApplication({
    auth: { clientId: CLIENT_ID, authority: `https://login.microsoftonline.com/${TENANT_ID}`, clientSecret: CLIENT_SECRET },
  });

  async function isAuthorized(claims, accessToken) {
    const groups = claims && claims.groups;
    if (Array.isArray(groups)) return groups.includes(AUTHORIZED_GROUP_ID);
    // overage/ausente -> fallback Graph checkMemberGroups
    try {
      const r = await fetch('https://graph.microsoft.com/v1.0/me/checkMemberGroups', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupIds: [AUTHORIZED_GROUP_ID] }),
      });
      if (!r.ok) return false;
      const j = await r.json();
      return Array.isArray(j.value) && j.value.includes(AUTHORIZED_GROUP_ID);
    } catch { return false; }
  }

  app.get('/auth/login', async (req, res) => {
    try {
      const state = crypto.randomBytes(16).toString('hex');
      req.session.authState = state;
      const url = await cca.getAuthCodeUrl({ scopes: SCOPES, redirectUri: REDIRECT_URI, state });
      res.redirect(url);
    } catch (e) { res.redirect('/login?error=auth'); }
  });

  app.get('/auth/callback', async (req, res) => {
    try {
      if (!req.query.code || req.query.state !== req.session.authState) return res.redirect('/login?error=state');
      const result = await cca.acquireTokenByCode({ code: String(req.query.code), scopes: SCOPES, redirectUri: REDIRECT_URI });
      const claims = result.idTokenClaims || {};
      if (!(await isAuthorized(claims, result.accessToken))) return res.redirect('/login?error=forbidden');
      const user = {
        name: claims.name || claims.preferred_username || 'Usuário',
        email: claims.preferred_username || claims.email || '',
        oid: claims.oid,
      };
      // regenera o id da sessão após autenticar (anti session-fixation)
      req.session.regenerate((err) => {
        if (err) return res.redirect('/login?error=auth');
        req.session.user = user;
        req.session.save(() => res.redirect('/'));
      });
    } catch (e) { res.redirect('/login?error=auth'); }
  });

  app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => {});
    const post = encodeURIComponent(`${BASE_URL}/login`);
    res.redirect(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/logout?post_logout_redirect_uri=${post}`);
  });
}

app.get('/auth/me', (req, res) => {
  if (!AUTH_ENABLED) return res.json({ authenticated: true, authDisabled: true, name: 'Convidado', email: '' });
  if (req.session && req.session.user) return res.json({ authenticated: true, ...req.session.user });
  res.status(401).json({ authenticated: false });
});

function requireAuth(req, res, next) {
  if (!AUTH_ENABLED) return next();
  if (req.session && req.session.user) return next();
  return res.status(401).json({ error: 'não autenticado' });
}
// rate limit + proteção do /api (exceto /api/health, usado por healthcheck do proxy)
app.use('/api', (req, res, next) => (req.path === '/health' ? next() : apiLimiter(req, res, next)));
app.use('/api', (req, res, next) => (req.path === '/health' ? next() : requireAuth(req, res, next)));

// ================= DADOS (MariaDB) =================
// Carrega ADMIN_FIELDS da tabela accountinfo_config do OCS se não vier de arquivo
async function loadAdminFieldsFromDB() {
  if (ADMIN_FIELDS.length) return; // já carregado de arquivo
  try {
    const rows = await q(
      `SELECT ID, NAME, COMMENT, TYPE FROM accountinfo_config
        WHERE ACCOUNT_TYPE = 'COMPUTERS' AND NAME IS NOT NULL AND NAME != ''
        AND NAME != 'TAG' ORDER BY SHOW_ORDER, ID`
    );
    ADMIN_FIELDS = rows
      .map((r) => ({ key: r.NAME, label: r.COMMENT || r.NAME }))
      .filter((f) => f.key);
    // Atualiza EDITABLE_KEYS/SET com os campos do DB
    EDITABLE_KEYS.length = 0;
    EDITABLE_KEYS.push(...ADMIN_FIELDS.map((f) => f.key), DESCRIPTION_FIELD);
    EDITABLE_SET.clear();
    EDITABLE_KEYS.forEach((k) => EDITABLE_SET.add(k));
    console.log(`[admin-fields] carregado do banco: ${ADMIN_FIELDS.length} campos`);
  } catch (e) {
    console.error('[admin-fields] não foi possível ler accountinfo_config:', e?.message || e);
  }
}

function toRow(r) {
  const row = {
    id: r.ID, name: r.NAME, os: r.OSNAME, osVersion: r.OSVERSION, arch: r.ARCH,
    ip: r.IPADDR, memoryMb: r.MEMORY, totalDiskGb: Number(r.totalDiskGb) || 0, cpu: r.PROCESSORT, lastCome: r.LASTCOME,
    userId: r.USERID, workgroup: r.WORKGROUP, userAgent: r.USERAGENT,
    tag: r.TAG || '',
    descricao: r[DESCRIPTION_FIELD] || '',
    addedAt: r.ADDEDAT || null, // data de entrada no OCS (timestamp do DEVICEID)
    adminFields: {},
    isServer: false,
  };
  // Campos administrativos dinâmicos (do ADMIN_FIELDS)
  for (const f of ADMIN_FIELDS) {
    if (f.key !== 'TAG' && r[f.key] != null) row.adminFields[f.key] = String(r[f.key]);
  }
  // isServer: regex configurável no campo de tipo + OSNAME
  const typeVal = String(r[SERVER_TYPE_FIELD] || '');
  const osVal = String(r.OSNAME || '');
  const pat = new RegExp(SERVER_TYPE_PATTERN, 'i');
  row.isServer = pat.test(typeVal) || pat.test(osVal);
  return row;
}

let rowsCache = { t: 0, data: null, promise: null };
async function getRows() {
  if (rowsCache.data && Date.now() - rowsCache.t < CACHE_TTL) return rowsCache.data;
  if (rowsCache.promise) return rowsCache.promise;
  rowsCache.promise = q(
    `SELECT h.ID, h.NAME, h.OSNAME, h.OSVERSION, h.ARCH, h.IPADDR, h.MEMORY,
            h.PROCESSORT, h.LASTCOME, h.LASTDATE, h.USERID, h.WORKGROUP, h.USERAGENT,
            STR_TO_DATE(REGEXP_SUBSTR(h.DEVICEID,'[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{2}-[0-9]{2}$'),'%Y-%m-%d-%H-%i-%s') AS ADDEDAT,
            a.*,
            (SELECT ROUND(IFNULL(SUM(TOTAL)/1024, 0), 1) FROM drives WHERE HARDWARE_ID = h.ID) AS totalDiskGb
       FROM hardware h LEFT JOIN accountinfo a ON a.HARDWARE_ID = h.ID
      WHERE ${NOTGROUP} ORDER BY h.LASTCOME DESC`
  ).then((rows) => { const data = rows.map(toRow); rowsCache = { t: Date.now(), data, promise: null }; return data; })
   .catch((e) => { rowsCache.promise = null; throw e; });
  return rowsCache.promise;
}

function daysSince(s) { if (!s) return null; const t = Date.parse(String(s).replace(' ', 'T')); return isNaN(t) ? null : Math.floor((Date.now() - t) / 86400000); }

function tally(rows, keyFn, topN) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r) || '(não informado)'; m.set(k, (m.get(k) || 0) + 1); }
  let arr = [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  if (topN && arr.length > topN) {
    const head = arr.slice(0, topN);
    const rest = arr.slice(topN).reduce((s, x) => s + x.value, 0);
    if (rest) head.push({ label: 'Outros', value: rest });
    arr = head;
  }
  return arr;
}

function statsFromRows(rows) {
  const stale = rows.filter((r) => (daysSince(r.lastCome) ?? 9999) > 15);
  const fr = { ok: 0, warn: 0, old: 0, none: 0 };
  for (const r of rows) { const d = daysSince(r.lastCome); if (d === null) fr.none++; else if (d <= 2) fr.ok++; else if (d <= 15) fr.warn++; else fr.old++; }
  // Campo admin para agrupar "byEmpresa" (primeiro campo que não seja TAG); "byTipo" usa SERVER_TYPE_FIELD
  const empresaKey = ADMIN_FIELDS.find((f) => f.key !== 'TAG')?.key;
  return {
    totals: { all: rows.length, servers: rows.filter((r) => r.isServer).length, workstations: rows.filter((r) => !r.isServer).length, stale: stale.length },
    byOs: tally(rows, (r) => r.os, 8),
    byEmpresa: empresaKey ? tally(rows, (r) => r.adminFields?.[empresaKey], 8) : [],
    byTipo: tally(rows, (r) => r.adminFields?.[SERVER_TYPE_FIELD], 8),
    byFreshness: [
      { label: 'Em dia (≤2d)', value: fr.ok }, { label: 'Atenção (≤15d)', value: fr.warn },
      { label: 'Desatualizado (>15d)', value: fr.old }, { label: 'Sem contato', value: fr.none },
    ],
    recent: rows.slice(0, 10),
    stale: stale.slice(0, 10),
  };
}

let swCache = { t: 0, data: null, promise: null };
async function getSoftwareAgg() {
  if (swCache.data && Date.now() - swCache.t < CACHE_TTL) return swCache.data;
  if (swCache.promise) return swCache.promise;
  swCache.promise = (async () => {
    const conn = await pool.getConnection();
    try {
      await conn.query('SET SESSION group_concat_max_len = 1000000');
      const [rows] = await conn.query(
        `SELECT sn.NAME AS name, COALESCE(sp.PUBLISHER,'') AS publisher,
                COUNT(DISTINCT s.HARDWARE_ID) AS cnt,
                GROUP_CONCAT(DISTINCT sv.VERSION ORDER BY sv.VERSION SEPARATOR '|') AS versions
           FROM software s
           JOIN hardware h ON h.ID = s.HARDWARE_ID AND ${NOTGROUP}
           JOIN software_name sn ON sn.ID = s.NAME_ID
           LEFT JOIN software_publisher sp ON sp.ID = s.PUBLISHER_ID
           LEFT JOIN software_version sv ON sv.ID = s.VERSION_ID
          GROUP BY sn.NAME, sp.PUBLISHER ORDER BY cnt DESC, name ASC`
      );
      const data = rows.map((r) => ({
        name: r.name, publisher: r.publisher || '', count: Number(r.cnt),
        versions: (r.versions ? String(r.versions).split('|') : []).filter((v) => v && v !== 'Unavailable'),
      }));
      swCache = { t: Date.now(), data, promise: null };
      return data;
    } finally { conn.release(); }
  })().catch((e) => { swCache.promise = null; throw e; });
  return swCache.promise;
}

async function fetchDetail(id) {
  const [hardware, bios, accountinfo, networks, drives, storages, memories, videos, monitors, software, groups, bitlocker, sqlserver] =
    await Promise.all([
      q('SELECT * FROM hardware WHERE ID = ?', [id]).then((r) => r[0] || {}),
      q('SELECT * FROM bios WHERE HARDWARE_ID = ?', [id]).then((r) => r[0] || {}),
      q('SELECT * FROM accountinfo WHERE HARDWARE_ID = ?', [id]),
      q('SELECT * FROM networks WHERE HARDWARE_ID = ?', [id]),
      q('SELECT * FROM drives WHERE HARDWARE_ID = ? ORDER BY LETTER', [id]),
      q('SELECT * FROM storages WHERE HARDWARE_ID = ?', [id]),
      q('SELECT * FROM memories WHERE HARDWARE_ID = ? AND CAPACITY > 0', [id]),
      q('SELECT * FROM videos WHERE HARDWARE_ID = ?', [id]),
      q('SELECT * FROM monitors WHERE HARDWARE_ID = ?', [id]),
      q(`SELECT sn.NAME AS NAME, sv.VERSION AS VERSION, sp.PUBLISHER AS PUBLISHER
           FROM software s JOIN software_name sn ON sn.ID = s.NAME_ID
           LEFT JOIN software_version sv ON sv.ID = s.VERSION_ID
           LEFT JOIN software_publisher sp ON sp.ID = s.PUBLISHER_ID
          WHERE s.HARDWARE_ID = ? ORDER BY sn.NAME`, [id]),
      q(`SELECT g.NAME AS NAME FROM groups_cache gc JOIN hardware g ON g.ID = gc.GROUP_ID WHERE gc.HARDWARE_ID = ?`, [id]).catch(() => []),
      // criptografia de disco (plugin bitlockerstatus); tabela pode nao existir em bases sem o plugin
      q('SELECT * FROM bitlockerstatus WHERE HARDWARE_ID = ? ORDER BY DRIVE', [id]).catch(() => []),
      // instancias do SQL Server (plugin sqlserver_instances); tabela pode nao existir em bases sem o plugin
      pool.execute('SELECT * FROM sqlserver_instances WHERE HARDWARE_ID = ? ORDER BY NAME', [id])
        .then(([rows]) => rows.map(r => ({
          name: r.NAME,
          internalId: r.INTERNAL_ID,
          edition: r.EDITION,
          version: r.VERSION,
          patch: r.PATCH,
          productName: r.PRODUCT_NAME,
          sqlVersion: r.SQL_VERSION
        })))
        .catch(() => []),
    ]);
  return { hardware, bios, accountinfo, networks, drives, storages, memories, videos, monitors, software, groups_cache: groups, bitlocker, sqlserver, adminFields: ADMIN_FIELDS };
}

// ================= ROTAS API =================
// resposta de erro genérica (Achado 12): cliente recebe só um id de correlação; detalhes no log
function fail(res, e, code = 502) {
  const cid = crypto.randomBytes(6).toString('hex');
  console.error(`[erro ${cid}]`, e?.stack || e?.message || e);
  res.status(code).json({ error: 'erro interno ao processar a solicitação', cid });
}

app.get('/api/health', async (_req, res) => {
  try { await q('SELECT 1'); res.json({ ok: true }); }
  catch (e) { console.error('[health]', e?.message || e); res.status(502).json({ ok: false }); }
});
app.get('/api/labels', (_req, res) => res.json({ fields: ADMIN_FIELDS, descriptionField: DESCRIPTION_FIELD, serverTypeField: SERVER_TYPE_FIELD }));

app.get('/api/computers', async (_req, res) => {
  try { res.set('Cache-Control', 'no-store').json(await getRows()); }
  catch (e) { fail(res, e); }
});
app.get('/api/stats', async (_req, res) => {
  try { res.set('Cache-Control', 'no-store').json(statsFromRows(await getRows())); }
  catch (e) { fail(res, e); }
});
app.get('/api/software', async (_req, res) => {
  try { res.set('Cache-Control', 'no-store').json(await getSoftwareAgg()); }
  catch (e) { fail(res, e); }
});
app.get('/api/computers/:id', async (req, res) => {
  const id = String(req.params.id).replace(/[^0-9]/g, '');
  if (!id) return res.status(400).json({ error: 'id inválido' });
  try { res.json(await fetchDetail(id)); }
  catch (e) { fail(res, e); }
});
app.patch('/api/computers/:id/description', async (req, res) => {
  const id = String(req.params.id).replace(/[^0-9]/g, '');
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const desc = String(req.body?.description ?? '').slice(0, 255);
  try {
    const exists = await q('SELECT 1 FROM accountinfo WHERE HARDWARE_ID = ? LIMIT 1', [id]);
    if (exists.length) await q(`UPDATE accountinfo SET \`${DESCRIPTION_FIELD}\` = ? WHERE HARDWARE_ID = ?`, [desc, id]);
    else await q(`INSERT INTO accountinfo (HARDWARE_ID, \`${DESCRIPTION_FIELD}\`) VALUES (?, ?)`, [id, desc]);
    rowsCache = { t: 0, data: null, promise: null };
    res.json({ ok: true, description: desc });
  } catch (e) { fail(res, e); }
});

// edicao dos campos administrativos (accountinfo) — varios de uma vez, com whitelist
app.patch('/api/computers/:id/admin', async (req, res) => {
  const id = String(req.params.id).replace(/[^0-9]/g, '');
  if (!id) return res.status(400).json({ error: 'id inválido' });
  const incoming = (req.body && typeof req.body.fields === 'object' && req.body.fields) || {};
  const cols = Object.keys(incoming).filter((k) => EDITABLE_SET.has(k)); // só colunas conhecidas
  if (!cols.length) return res.status(400).json({ error: 'nenhum campo editável informado' });
  const vals = cols.map((c) => {
    const v = incoming[c];
    return v === null || v === undefined ? '' : String(v).slice(0, 255);
  });
  try {
    const exists = await q('SELECT 1 FROM accountinfo WHERE HARDWARE_ID = ? LIMIT 1', [id]);
    if (exists.length) {
      const setClause = cols.map((c) => `\`${c}\` = ?`).join(', '); // nomes vêm da whitelist
      await q(`UPDATE accountinfo SET ${setClause} WHERE HARDWARE_ID = ?`, [...vals, id]);
    } else {
      const colList = ['HARDWARE_ID', ...cols].map((c) => `\`${c}\``).join(', ');
      const ph = ['?', ...cols.map(() => '?')].join(', ');
      await q(`INSERT INTO accountinfo (${colList}) VALUES (${ph})`, [id, ...vals]);
    }
    rowsCache = { t: 0, data: null, promise: null }; // reflete na lista/dashboard
    optCache = { t: 0, data: null };                 // novo valor aparece no autocomplete
    const saved = {};
    cols.forEach((c, i) => { saved[c] = vals[i]; });
    res.json({ ok: true, fields: saved });
  } catch (e) { fail(res, e); }
});

// valores ja usados em cada campo administrativo (autocomplete da ficha)
let optCache = { t: 0, data: null };
app.get('/api/admin-options', async (_req, res) => {
  try {
    if (optCache.data && Date.now() - optCache.t < 300000) return res.set('Cache-Control', 'no-store').json(optCache.data);
    const rows = await q('SELECT * FROM accountinfo');
    const out = {};
    for (const k of EDITABLE_KEYS) {
      const set = new Set();
      for (const r of rows) { const v = r[k]; if (v != null && String(v).trim() !== '') set.add(String(v)); }
      out[k] = [...set].sort((a, b) => String(a).localeCompare(String(b))).slice(0, 100);
    }
    optCache = { t: Date.now(), data: out };
    res.set('Cache-Control', 'no-store').json(out);
  } catch (e) { fail(res, e); }
});

// ================= SUGESTÕES (mural do Roadmap) =================
let suggReady = false;
async function ensureSuggTable() {
  if (suggReady) return;
  await q(`CREATE TABLE IF NOT EXISTS console_suggestions (
    ID INT AUTO_INCREMENT PRIMARY KEY,
    TEXTO VARCHAR(1000) NOT NULL,
    AUTOR VARCHAR(255) NOT NULL,
    EMAIL VARCHAR(255) NULL,
    CRIADO_EM DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  suggReady = true;
}
const SUGG_SELECT = 'SELECT ID AS id, TEXTO AS text, AUTOR AS author, CRIADO_EM AS createdAt FROM console_suggestions';

app.get('/api/suggestions', async (_req, res) => {
  try {
    await ensureSuggTable();
    const rows = await q(`${SUGG_SELECT} ORDER BY ID DESC LIMIT 200`);
    res.set('Cache-Control', 'no-store').json(rows);
  } catch (e) { fail(res, e); }
});

app.post('/api/suggestions', async (req, res) => {
  const text = String(req.body?.text ?? '').trim().slice(0, 1000);
  if (!text) return res.status(400).json({ error: 'texto vazio' });
  const u = (req.session && req.session.user) || {};
  const author = String(u.name || 'Convidado').slice(0, 255);
  const email = u.email ? String(u.email).slice(0, 255) : null;
  try {
    await ensureSuggTable();
    const r = await q('INSERT INTO console_suggestions (TEXTO, AUTOR, EMAIL) VALUES (?, ?, ?)', [text, author, email]);
    const [item] = await q(`${SUGG_SELECT} WHERE ID = ?`, [r.insertId]);
    res.json({ ok: true, item });
  } catch (e) { fail(res, e); }
});

app.get('/api/system', async (_req, res) => {
  try {
    const [verRow] = await q('SELECT VERSION() AS v');
    const [sizeRow] = await q(
      `SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS mb,
              COUNT(*) AS tables
         FROM information_schema.tables WHERE table_schema = ?`,
      [process.env.DB_NAME || 'ocsweb']
    );
    const rows = await getRows();
    const servers = rows.filter((r) => r.isServer).length;
    let softwareDistinct = null;
    try { softwareDistinct = (await getSoftwareAgg()).length; } catch { /* opcional */ }
    res.set('Cache-Control', 'no-store').json({
      app: {
        node: process.version,
        uptimeSec: Math.floor(process.uptime()),
        pid: process.pid,
        cacheTtlSec: CACHE_TTL / 1000,
        authEnabled: AUTH_ENABLED,
        baseUrl: BASE_URL || null,
      },
      db: {
        engine: 'MariaDB',
        version: verRow?.v || null,
        name: process.env.DB_NAME || 'ocsweb',
        host: process.env.DB_HOST || 'host.docker.internal',
        port: Number(process.env.DB_PORT || 3306),
        sizeMb: sizeRow?.mb != null ? Number(sizeRow.mb) : null,
        tables: sizeRow?.tables != null ? Number(sizeRow.tables) : null,
      },
      inventory: {
        computers: rows.length,
        servers,
        workstations: rows.length - servers,
        softwareDistinct,
      },
    });
  } catch (e) { fail(res, e); }
});

app.get('/api/sqlserver', async (_req, res) => {
  try {
    const rows = await q(`
      SELECT si.HARDWARE_ID, h.NAME as hostname, h.OSNAME,
             si.NAME as instance, si.EDITION, si.VERSION, si.PATCH,
             si.PRODUCT_NAME, si.SQL_VERSION
      FROM sqlserver_instances si
      JOIN hardware h ON h.ID = si.HARDWARE_ID
      WHERE h.DEVICEID IS NULL OR h.DEVICEID <> '_SYSTEMGROUP_'
      ORDER BY si.EDITION, h.NAME, si.NAME
    `);
    res.json(rows);
  } catch (e) {
    fail(res, e, 500);
  }
});

app.get('/api/updates-report', async (req, res) => {
  try {
    const type = String(req.query.type || 'servers');
    const isServer = type === 'servers';
    const tf = SERVER_TYPE_FIELD;
    // Patterns do SERVER_TYPE_PATTERN (env var do admin, não input do usuário) — escapar aspas simples
    const pats = SERVER_TYPE_PATTERN.split('|').map((p) => p.trim()).filter(Boolean)
      .map((p) => p.replace(/'/g, "''"));
    const typeLike = pats.map((p) => `a.\`${tf}\` LIKE '%${p}%'`).join(' OR ');
    const typeNotLike = pats.map((p) => `a.\`${tf}\` NOT LIKE '%${p}%'`).join(' AND ');
    const typeFilter = isServer
      ? `(h.OSNAME LIKE '%Server%' OR h.OSNAME LIKE '%Linux%' OR h.OSNAME LIKE '%CentOS%' OR h.OSNAME LIKE '%Ubuntu%' OR h.OSNAME LIKE '%Debian%'${typeLike ? ' OR ' + typeLike : ''})`
      : `(h.OSNAME NOT LIKE '%Server%' AND h.OSNAME NOT LIKE '%CentOS%' AND h.OSNAME NOT LIKE '%Ubuntu%' AND h.OSNAME NOT LIKE '%Debian%' AND h.OSNAME NOT LIKE '%Linux%' AND (a.\`${tf}\` IS NULL${typeNotLike ? ' OR (' + typeNotLike + ')' : ''}))`;
    // Campos admin para o relatório (primeiro campo = "empresa", segundo = "dono")
    const empresaKey = ADMIN_FIELDS.find((f) => f.key !== 'TAG')?.key;
    const donoKey = ADMIN_FIELDS.find((f) => f.key !== 'TAG' && f.key !== empresaKey)?.key;
    const rows = await q(`
      SELECT
        h.ID as HARDWARE_ID,
        h.NAME as hostname,
        h.OSNAME,
        h.OSVERSION,
        DATE_FORMAT(h.LASTCOME, '%Y-%m-%d') as LASTCOME,
        DATE_FORMAT(h.LASTDATE, '%Y-%m-%d') as LASTDATE,
        a.TAG,
        '${type}' as type,
        ${empresaKey ? 'a.`' + empresaKey + '`' : 'NULL'} as empresa,
        ${donoKey ? 'a.`' + donoKey + '`' : 'NULL'} as dono,
        a.\`${tf}\` as tipo,
        COALESCE(
          DATE_FORMAT(wu.LAST_UPDATE_DATE, '%Y-%m-%d'),
          DATE_FORMAT(lu.LAST_UPDATE_DATE, '%Y-%m-%d'),
          sw.last_install,
          DATE_FORMAT(h.LASTCOME, '%Y-%m-%d')
        ) as last_update,
        DATEDIFF(NOW(), COALESCE(
          wu.LAST_UPDATE_DATE,
          lu.LAST_UPDATE_DATE,
          sw.last_install_date,
          h.LASTCOME
        )) as days_since_update,
        CASE
          WHEN wu.LAST_UPDATE_DATE IS NOT NULL THEN 'Windows-Update'
          WHEN lu.LAST_UPDATE_DATE IS NOT NULL THEN 'Linux-Package'
          WHEN sw.last_install IS NOT NULL THEN 'SW-INSTALL'
          ELSE 'LASTCOME'
        END as update_source,
        wu.TOTAL_INSTALLED as total_installed,
        wu.PENDING_COUNT as pending_count,
        wu.LAST_KB as last_kb,
        lu.PKG_MANAGER as pkg_manager,
        sw.install_count as software_count
      FROM hardware h
      LEFT JOIN accountinfo a ON a.HARDWARE_ID = h.ID
      LEFT JOIN windows_updates wu ON wu.HARDWARE_ID = h.ID
      LEFT JOIN linux_updates lu ON lu.HARDWARE_ID = h.ID
      LEFT JOIN (
        SELECT HARDWARE_ID, MAX(INSTALLDATE) as last_install, DATE(MAX(INSTALLDATE)) as last_install_date, COUNT(*) as install_count
        FROM software
        WHERE INSTALLDATE IS NOT NULL AND INSTALLDATE != ''
        GROUP BY HARDWARE_ID
      ) sw ON sw.HARDWARE_ID = h.ID
      WHERE (h.DEVICEID IS NULL OR h.DEVICEID <> '_SYSTEMGROUP_')
        AND h.NAME IS NOT NULL
        AND ${typeFilter}
      ORDER BY days_since_update ASC
    `);
    res.json(rows);
  } catch (e) {
    fail(res, e, 500);
  }
});

// ================= SPA =================
const pub = path.join(__dirname, 'public');
// Arquivos com hash de conteúdo (JS/CSS do build) → cache eterno e imutável;
// index.html e assets sem hash → no-cache (revalida sempre, para o deploy aparecer na hora).
const HASHED = /-[A-Za-z0-9_]{8,}\.(?:js|css)$/;
app.use(express.static(pub, {
  index: false,
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (HASHED.test(path.basename(filePath))) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(pub, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`OCS Console BFF ouvindo em :${PORT} (auth=${AUTH_ENABLED})`);
  // Carrega ADMIN_FIELDS do banco se não vieram de arquivo
  loadAdminFieldsFromDB().catch((e) => console.error('[init] loadAdminFieldsFromDB falhou:', e?.message || e));
});
