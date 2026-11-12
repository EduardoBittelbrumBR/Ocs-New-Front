export interface ComputerRow {
  id: number;
  name: string;
  os: string;
  osVersion: string;
  arch: string;
  ip: string;
  memoryMb: number;
  totalDiskGb: number;
  cpu: string;
  lastCome: string;
  userId: string;
  workgroup: string;
  userAgent: string;
  tag: string;
  descricao: string;
  addedAt: string | null;
  isServer: boolean;
  /** Administrative fields loaded dynamically from accountinfo_config (key → value) */
  adminFields?: Record<string, string>;
  /** Legacy named fields (optional, for backward compatibility with custom configs) */
  empresa?: string;
  usuario?: string;
  donoEquipamento?: string;
  tipo?: string;
  custo?: string;
  cc?: string;
  elementoCusto?: string;
  ln?: string;
  aplicacao?: string;
  rateio?: string;
  modalidade?: string;
  ambientes?: string;
  migrado?: string;
  servidorBd?: string;
  cloud?: string;
}

export interface AdminField {
  key: string;
  label: string;
}

export interface Slice {
  label: string;
  value: number;
}

export interface Stats {
  totals: { all: number; servers: number; workstations: number; stale: number };
  byOs: Slice[];
  byEmpresa: Slice[];
  byTipo: Slice[];
  byFreshness: Slice[];
  recent: ComputerRow[];
  stale: ComputerRow[];
}

export interface SoftwareAgg {
  name: string;
  publisher: string;
  count: number;
  versions: string[];
}

export interface SqlServerInstance {
  HARDWARE_ID: number;
  hostname: string;
  OSNAME: string;
  instance: string;
  EDITION: string;
  VERSION: string;
  PATCH: string;
  PRODUCT_NAME: string;
  SQL_VERSION: string;
}

export interface UpdateStatus {
  HARDWARE_ID: number;
  hostname: string;
  OSNAME: string;
  OSVERSION: string;
  LASTCOME: string;
  LASTDATE: string;
  TAG: string;
  type: string;
  empresa: string;
  dono: string;
  tipo: string;
  last_update: string;
  days_since_update: number;
  update_source: string;
  total_installed: number;
  pending_count: number;
  last_kb: string;
  pkg_manager: string;
  software_count: number;
}

/** Detalhe cru da maquina: dicionario de secoes vindo da REST API do OCS. */
export interface ComputerDetail {
  hardware?: Record<string, unknown>;
  bios?: Record<string, unknown>;
  accountinfo?: Record<string, unknown>[] | Record<string, unknown>;
  networks?: Record<string, unknown>[];
  drives?: Record<string, unknown>[];
  storages?: Record<string, unknown>[];
  memories?: Record<string, unknown>[];
  cpus?: Record<string, unknown>[];
  monitors?: Record<string, unknown>[];
  software?: Record<string, unknown>[];
  bitlocker?: Record<string, unknown>[];
  sqlserver?: Record<string, unknown>[];
  adminFields?: AdminField[];
  [section: string]: unknown;
}
