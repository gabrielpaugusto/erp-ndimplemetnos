'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import {
  AddressValue,
  IbgeMunicipio,
  UF_OPTIONS,
  fetchMunicipios,
  fetchViaCep,
  maskCep,
} from '@/lib/address';

const ADDRESS_TYPES = [
  { value: 'PRINCIPAL',       label: 'Principal' },
  { value: 'ENTREGA',         label: 'Entrega' },
  { value: 'COBRANCA',        label: 'Cobrança' },
  { value: 'CORRESPONDENCIA', label: 'Correspondência' },
];

interface AddressBlockProps {
  value: AddressValue;
  onChange: (v: AddressValue) => void;
  disabled?: boolean;
  showType?: boolean;
  type?: string;
  onTypeChange?: (t: string) => void;
  main?: boolean;
  onMainChange?: (m: boolean) => void;
  /** Exibe o campo Cód. IBGE dentro do bloco de endereço (default: true).
   *  Passe false quando o IBGE é gerenciado em outro lugar (ex.: aba Fiscal). */
  showIbge?: boolean;
}

export default function AddressBlock({
  value,
  onChange,
  disabled = false,
  showType = false,
  type = 'COMERCIAL',
  onTypeChange,
  main = false,
  onMainChange,
  showIbge = true,
}: AddressBlockProps) {
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [municipios, setMunicipios] = useState<IbgeMunicipio[]>([]);
  const [cepError, setCepError] = useState('');

  // Carrega municípios quando UF muda
  const loadMunicipios = useCallback(async (uf: string) => {
    if (!uf) { setMunicipios([]); return; }
    setLoadingMunicipios(true);
    const list = await fetchMunicipios(uf);
    setMunicipios(list);
    setLoadingMunicipios(false);
  }, []);

  useEffect(() => {
    if (value.uf) loadMunicipios(value.uf);
  }, [value.uf, loadMunicipios]);

  // Busca CEP
  const handleCepChange = async (raw: string) => {
    const masked = maskCep(raw);
    onChange({ ...value, cep: masked });
    setCepError('');
    const digits = masked.replace(/\D/g, '');
    if (digits.length === 8) {
      setLoadingCep(true);
      const result = await fetchViaCep(digits);
      setLoadingCep(false);
      if (result) {
        const muns = await fetchMunicipios(result.uf);
        setMunicipios(muns);
        const found = muns.find(
          (m) => m.nome.toLowerCase() === result.localidade.toLowerCase(),
        );
        onChange({
          ...value,
          cep: masked,
          logradouro: result.logradouro || value.logradouro,
          bairro: result.bairro || value.bairro,
          complemento: result.complemento || value.complemento,
          uf: result.uf,
          municipio: result.localidade,
          codigoIbge: found ? String(found.id) : result.ibge || '',
        });
      } else {
        setCepError('CEP não encontrado — preencha o endereço manualmente');
      }
    }
  };

  // UF change
  const handleUfChange = (uf: string) => {
    onChange({ ...value, uf, municipio: '', codigoIbge: '' });
    loadMunicipios(uf);
  };

  // Município change
  const handleMunicipioChange = (nome: string) => {
    const found = municipios.find((m) => m.nome === nome);
    onChange({
      ...value,
      municipio: nome,
      codigoIbge: found ? String(found.id) : value.codigoIbge,
    });
  };

  const set = (field: keyof AddressValue) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange({ ...value, [field]: e.target.value });
  };

  const inputCls =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400';
  const selectCls =
    'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400';
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1';

  return (
    <div className="space-y-4">
      {/* Tipo + Principal */}
      {(showType || onMainChange) && (
        <div className="flex items-center gap-4">
          {showType && onTypeChange && (
            <div className="flex-1">
              <label className={labelCls}>Tipo</label>
              <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value)}
                disabled={disabled}
                className={selectCls}
              >
                {ADDRESS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          )}
          {onMainChange && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={main}
                onChange={(e) => onMainChange(e.target.checked)}
                disabled={disabled}
                className="w-4 h-4 text-blue-600 rounded"
              />
              Endereço principal
            </label>
          )}
        </div>
      )}

      {/* CEP */}
      <div>
        <label className={labelCls}>
          <MapPin className="inline w-3 h-3 mr-1" />
          CEP
        </label>
        <div className="relative">
          <input
            value={value.cep}
            onChange={(e) => handleCepChange(e.target.value)}
            placeholder="00000-000"
            maxLength={9}
            disabled={disabled}
            className={inputCls + ' pr-8'}
          />
          {loadingCep && (
            <Loader2 className="absolute right-2 top-2.5 w-4 h-4 text-blue-500 animate-spin" />
          )}
          {!loadingCep && value.cep.replace(/\D/g, '').length === 8 && !cepError && (
            <Search className="absolute right-2 top-2.5 w-4 h-4 text-green-500" />
          )}
        </div>
        {cepError && (
          <p className="mt-1 text-xs text-amber-600">{cepError}</p>
        )}
      </div>

      {/* Logradouro + Número */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Logradouro</label>
          <input value={value.logradouro} onChange={set('logradouro')} placeholder="Rua, Av., Alameda..." disabled={disabled} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Número</label>
          <input value={value.numero} onChange={set('numero')} placeholder="123" disabled={disabled} className={inputCls} />
        </div>
      </div>

      {/* Complemento + Bairro */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Complemento</label>
          <input value={value.complemento} onChange={set('complemento')} placeholder="Apto, Sala, Bloco..." disabled={disabled} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Bairro</label>
          <input value={value.bairro} onChange={set('bairro')} placeholder="Bairro" disabled={disabled} className={inputCls} />
        </div>
      </div>

      {/* UF + Município + IBGE (IBGE opcional) */}
      <div className={`grid gap-3 ${showIbge ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <div>
          <label className={labelCls}>UF</label>
          <select value={value.uf} onChange={(e) => handleUfChange(e.target.value)} disabled={disabled} className={selectCls}>
            <option value="">UF</option>
            {UF_OPTIONS.map((uf) => (
              <option key={uf} value={uf}>{uf}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelCls}>
            Município
            {loadingMunicipios && <Loader2 className="inline ml-1 w-3 h-3 animate-spin text-blue-500" />}
          </label>
          {municipios.length > 0 ? (
            <select
              value={value.municipio}
              onChange={(e) => handleMunicipioChange(e.target.value)}
              disabled={disabled || loadingMunicipios}
              className={selectCls}
            >
              <option value="">Selecione...</option>
              {municipios.map((m) => (
                <option key={m.id} value={m.nome}>{m.nome}</option>
              ))}
            </select>
          ) : (
            <input
              value={value.municipio}
              onChange={set('municipio')}
              placeholder={value.uf ? 'Carregando...' : 'Selecione a UF primeiro'}
              disabled={disabled || !!value.uf}
              className={inputCls}
            />
          )}
        </div>

        {showIbge && (
          <div>
            <label className={labelCls}>Cód. IBGE</label>
            <input
              value={value.codigoIbge}
              onChange={set('codigoIbge')}
              placeholder="0000000"
              maxLength={7}
              disabled={disabled}
              className={inputCls + ' text-gray-500'}
              readOnly={!!municipios.find((m) => m.nome === value.municipio)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
