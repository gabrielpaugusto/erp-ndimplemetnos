export const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export interface ViaCepResult {
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
  complemento?: string;
  erro?: boolean;
}

export interface IbgeMunicipio {
  id: number;
  nome: string;
}

export function maskCep(value: string): string {
  return value
    .replace(/\D/g, '')
    .replace(/^(\d{5})(\d)/, '$1-$2')
    .slice(0, 9);
}

export async function fetchViaCep(cep: string): Promise<ViaCepResult | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!res.ok) return null;
    const data: ViaCepResult = await res.json();
    if (data.erro) return null;
    return data;
  } catch {
    return null;
  }
}

const municipiosCache: Record<string, IbgeMunicipio[]> = {};

export async function fetchMunicipios(uf: string): Promise<IbgeMunicipio[]> {
  if (!uf) return [];
  if (municipiosCache[uf]) return municipiosCache[uf];
  try {
    const res = await fetch(
      `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`,
    );
    if (!res.ok) return [];
    const data: { id: number; nome: string }[] = await res.json();
    const list = data.map((m) => ({ id: m.id, nome: m.nome }));
    municipiosCache[uf] = list;
    return list;
  } catch {
    return [];
  }
}

export interface AddressValue {
  cep: string;
  uf: string;
  municipio: string;
  codigoIbge: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
}

export function emptyAddress(): AddressValue {
  return {
    cep: '',
    uf: '',
    municipio: '',
    codigoIbge: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
  };
}
