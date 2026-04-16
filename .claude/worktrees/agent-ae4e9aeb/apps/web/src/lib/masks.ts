/**
 * Mascara de CNPJ — 14 digitos: XX.XXX.XXX/XXXX-XX
 */
export function maskCnpj(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 14)
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

/**
 * Mascara de CPF — 11 digitos: XXX.XXX.XXX-XX
 */
export function maskCpf(v: string): string {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/**
 * Mascara de CPF ou CNPJ automatica conforme o numero de digitos.
 */
export function maskCpfCnpj(v: string): string {
  const digits = v.replace(/\D/g, '');
  return digits.length <= 11 ? maskCpf(digits) : maskCnpj(digits);
}

/**
 * Mascara de telefone:
 *  - Fixo  (10 digitos): (XX)XXXX-XXXX
 *  - Celular (11 digitos): (XX)XXXXX-XXXX
 */
export function maskPhone(v: string): string {
  const digits = v.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 10) {
    return digits
      .replace(/^(\d{2})(\d)/, '($1)$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '($1)$2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}
