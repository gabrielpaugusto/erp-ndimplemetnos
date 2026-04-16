/**
 * Utilitários de formatação numérica — padrão brasileiro
 *
 * Valores:     0.000,00   (ponto milhar, vírgula decimal)
 * Moeda:  R$  0.000,00
 * Percentual:      0,00%
 */

const ptBR = 'pt-BR';

/** Converte qualquer valor para número seguro */
function toNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

/**
 * Formata moeda em Real brasileiro.
 * @example fmtCurrency(1234.5) → "R$ 1.234,50"
 */
export function fmtCurrency(value: unknown): string {
  return toNum(value).toLocaleString(ptBR, {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formata número com separadores brasileiros.
 * @example fmtNumber(1234.5)    → "1.234,50"
 * @example fmtNumber(1234.5, 0) → "1.235"
 * @example fmtNumber(1234.5, 4) → "1.234,5000"
 */
export function fmtNumber(value: unknown, decimals = 2): string {
  return toNum(value).toLocaleString(ptBR, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Formata percentual com símbolo.
 * @example fmtPercent(12.5)    → "12,50%"
 * @example fmtPercent(12.5, 1) → "12,5%"
 * @example fmtPercent(12.5, 0) → "13%"
 */
export function fmtPercent(value: unknown, decimals = 2): string {
  return toNum(value).toLocaleString(ptBR, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + '%';
}

/**
 * Formata quantidade inteira com separador de milhar.
 * @example fmtQty(1234) → "1.234"
 */
export function fmtQty(value: unknown): string {
  return toNum(value).toLocaleString(ptBR, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * Formata horas com 1 casa decimal.
 * @example fmtHours(8.5) → "8,5h"
 */
export function fmtHours(value: unknown): string {
  return toNum(value).toLocaleString(ptBR, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }) + 'h';
}

/**
 * Formata tamanho de arquivo em KB ou MB com separadores brasileiros.
 * @example fmtFileSize(1500)      → "1,46 KB"
 * @example fmtFileSize(1500000)   → "1,43 MB"
 */
export function fmtFileSize(bytes: unknown): string {
  const b = toNum(bytes);
  if (b >= 1024 * 1024) {
    return fmtNumber(b / (1024 * 1024), 2) + ' MB';
  }
  return fmtNumber(b / 1024, 1) + ' KB';
}
