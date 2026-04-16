/**
 * SPED Register 0000 - Header line generator.
 * Used by all SPED file types (EFD ICMS/IPI, EFD PIS/COFINS, ECD, ECF).
 */

export interface SpedHeaderParams {
  /** Layout version code (e.g., '017' for EFD ICMS/IPI, '006' for EFD PIS/COFINS) */
  codVer: string;
  /** File type: 0=SPED Fiscal, 1=SPED Contribuicoes, etc. */
  codFin: '0' | '1';
  /** Period start date */
  dtIni: Date;
  /** Period end date */
  dtFim: Date;
  /** Company legal name */
  nome: string;
  /** CNPJ (14 digits, no formatting) */
  cnpj: string;
  /** State code (UF - 2 letters) */
  uf: string;
  /** State registration (Inscricao Estadual) */
  ie?: string;
  /** IBGE municipality code (7 digits) */
  codMun: string;
  /** Tax regime indicator: blank, "0", or "1" */
  indSitEsp?: string;
  /** Profile indicator: A, B, or C */
  indPerfil?: 'A' | 'B' | 'C';
  /** Activity indicator: 0=Industrial/equiparado, 1=Outros */
  indAtiv?: '0' | '1';
}

/**
 * Format a date as DDMMAAAA for SPED files.
 */
function formatSpedDate(date: Date): string {
  const dd = date.getDate().toString().padStart(2, '0');
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = date.getFullYear().toString();
  return `${dd}${mm}${yyyy}`;
}

/**
 * Generate the SPED Register 0000 header line.
 * Format: |REG|COD_VER|COD_FIN|DT_INI|DT_FIM|NOME|CNPJ|UF|IE|COD_MUN|IND_SIT_ESP|IND_PERFIL|IND_ATIV|
 */
export function generateSpedHeader(params: SpedHeaderParams): string {
  const fields = [
    '',
    '0000',
    params.codVer,
    params.codFin,
    formatSpedDate(params.dtIni),
    formatSpedDate(params.dtFim),
    params.nome,
    params.cnpj,
    params.uf,
    params.ie || '',
    params.codMun,
    params.indSitEsp || '',
    params.indPerfil || 'A',
    params.indAtiv || '0',
    '',
  ];
  return fields.join('|');
}

/**
 * Generate a generic SPED register line from field values.
 * All SPED lines follow the pipe-delimited format: |REG|FIELD1|FIELD2|...|
 */
export function generateSpedLine(
  register: string,
  ...fields: (string | number | undefined | null)[]
): string {
  const parts = ['', register];
  for (const field of fields) {
    parts.push(field != null ? String(field) : '');
  }
  parts.push('');
  return parts.join('|');
}

/**
 * Format a decimal number for SPED files (comma as decimal separator).
 */
export function formatSpedDecimal(value: number, decimals = 2): string {
  return value.toFixed(decimals).replace('.', ',');
}

/**
 * Format a date as DDMMAAAA.
 */
export { formatSpedDate };
