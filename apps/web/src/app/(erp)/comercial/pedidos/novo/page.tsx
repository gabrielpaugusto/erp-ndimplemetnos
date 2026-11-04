'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Search, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type SaleType =
  | 'ESTOQUE_PROPRIO'
  | 'VENDA_DIRETA'
  | 'PRODUCAO_PROPRIA'
  | 'VENDA_PECA'
  | 'SERVICO_OFICINA'
  | 'FI_CONSORCIO'
  | 'FI_FINANCIAMENTO'
  | 'FI_SEGURO';

const saleTypeLabels: Record<SaleType, string> = {
  ESTOQUE_PROPRIO: 'Estoque Próprio',
  VENDA_DIRETA: 'Venda Direta',
  PRODUCAO_PROPRIA: 'Produção Própria',
  VENDA_PECA: 'Venda de Peça',
  SERVICO_OFICINA: 'Serviço / Oficina',
  FI_CONSORCIO: 'F&I — Consórcio',
  FI_FINANCIAMENTO: 'F&I — Financiamento',
  FI_SEGURO: 'F&I — Seguro',
};

interface PersonResult {
  id: string;
  razaoSocial: string;
  nomeFantasia?: string;
  cpfCnpj?: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NovaVendaPage() {
  const router = useRouter();

  const [saleType, setSaleType] = useState<SaleType>('VENDA_DIRETA');
  const [personSearch, setPersonSearch] = useState('');
  const [personResults, setPersonResults] = useState<PersonResult[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<PersonResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [vendedor, setVendedor] = useState('');
  const [dataEmissao, setDataEmissao] = useState(today());
  const [observacoes, setObservacoes] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Busca de pessoa com debounce
  useEffect(() => {
    if (personSearch.length < 2) {
      setPersonResults([]);
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await apiFetch<{ data: PersonResult[] }>(
          `/crm/persons?search=${encodeURIComponent(personSearch)}&limit=8`,
        );
        setPersonResults(data.data ?? []);
        setShowDropdown(true);
      } catch {
        setPersonResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [personSearch]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectPerson(person: PersonResult) {
    setSelectedPerson(person);
    setPersonSearch(person.nomeFantasia || person.razaoSocial);
    setShowDropdown(false);
  }

  function clearPerson() {
    setSelectedPerson(null);
    setPersonSearch('');
    setPersonResults([]);
    setShowDropdown(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPerson) {
      setError('Selecione um cliente antes de salvar.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        saleType,
        personId: selectedPerson.id,
        vendedorId: vendedor.trim() || undefined,
        dataEmissao,
        observacoes: observacoes.trim() || undefined,
        status: 'RASCUNHO',
      };

      const result = await apiFetch<{ id: string }>('/sales/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push(`/comercial/pedidos/${result.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar pedido.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/comercial/pedidos"
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Link>
            <span className="text-slate-300">|</span>
            <h1 className="text-lg font-semibold text-slate-800">Nova Venda</h1>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Card principal */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
              Dados da Venda
            </h2>

            {/* Tipo de venda */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tipo de Venda <span className="text-red-500">*</span>
              </label>
              <select
                value={saleType}
                onChange={(e) => setSaleType(e.target.value as SaleType)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {(Object.keys(saleTypeLabels) as SaleType[]).map((key) => (
                  <option key={key} value={key}>
                    {saleTypeLabels[key]}
                  </option>
                ))}
              </select>
            </div>

            {/* Pessoa / Cliente */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Cliente <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={searchRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={personSearch}
                    onChange={(e) => {
                      setPersonSearch(e.target.value);
                      if (selectedPerson) setSelectedPerson(null);
                    }}
                    placeholder="Buscar por nome, fantasia ou CNPJ..."
                    className="w-full border border-slate-200 rounded-lg pl-9 pr-9 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {(personSearch || selectedPerson) && (
                    <button
                      type="button"
                      onClick={clearPerson}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Dropdown */}
                {showDropdown && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {searchLoading ? (
                      <div className="px-4 py-3 text-sm text-slate-500">Buscando...</div>
                    ) : personResults.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-500">Nenhum resultado encontrado.</div>
                    ) : (
                      personResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => selectPerson(p)}
                          className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                        >
                          <div className="text-sm font-medium text-slate-800">
                            {p.nomeFantasia || p.razaoSocial}
                          </div>
                          {p.nomeFantasia && (
                            <div className="text-xs text-slate-500">{p.razaoSocial}</div>
                          )}
                          {p.cpfCnpj && (
                            <div className="text-xs text-slate-400">{p.cpfCnpj}</div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              {selectedPerson && (
                <p className="mt-1.5 text-xs text-emerald-600">
                  Cliente selecionado: {selectedPerson.razaoSocial}
                </p>
              )}
            </div>

            {/* Vendedor e Data — grid 2 colunas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Vendedor
                </label>
                <input
                  type="text"
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  placeholder="Nome do vendedor"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Data de Emissão
                </label>
                <input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Observações
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={3}
                placeholder="Informações adicionais sobre a venda..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center justify-end gap-3">
            <Link
              href="/comercial/pedidos"
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar como Rascunho'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
