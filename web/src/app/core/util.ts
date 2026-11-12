/** Converte timestamp "YYYY-MM-DD HH:mm:ss" (do MariaDB, em UTC) para epoch ms; NaN se invalido. */
export function parseDbTs(dateStr: string | null | undefined): number {
  if (!dateStr) return NaN;
  // o banco (e o SO do servidor) está em UTC e devolve a string SEM fuso;
  // sem o "Z" o navegador interpretaria como hora local → datas no "futuro" → dias negativos.
  return Date.parse(String(dateStr).replace(' ', 'T') + 'Z');
}

/** Dias desde a data (string "YYYY-MM-DD HH:mm:ss" em UTC); null se invalida. */
export function daysSince(dateStr: string | null | undefined): number | null {
  const t = parseDbTs(dateStr);
  if (isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

export type Freshness = 'ok' | 'warn' | 'old' | 'none';

/** OCS reporta ~1x/dia. <=2d = ok, <=15d = atencao, senao desatualizado. */
export function freshness(dateStr: string | null | undefined): Freshness {
  const d = daysSince(dateStr);
  if (d === null) return 'none';
  if (d <= 2) return 'ok';
  if (d <= 15) return 'warn';
  return 'old';
}

/** Formata timestamp do banco (UTC) para exibição em hora LOCAL (dd/mm/aaaa hh:mm). */
export function fmtDbTs(dateStr: string | null | undefined): string {
  const t = parseDbTs(dateStr);
  if (isNaN(t)) return '—';
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function freshnessLabel(dateStr: string | null | undefined): string {
  const d = daysSince(dateStr);
  if (d === null) return 'sem contato';
  if (d === 0) return 'hoje';
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

export function mbToGb(mb: number | null | undefined): string {
  if (!mb || mb <= 0) return '—';
  return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
}
