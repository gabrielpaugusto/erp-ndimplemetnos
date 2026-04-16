'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Save, X, BookOpen } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type AccountType = 'ATIVO' | 'PASSIVO' | 'RECEITA' | 'DESPESA' | 'PL';

interface AccountForm {
  parentId: string;
  code: string;
  name: string;
  type: AccountType;
  nature: 'DEVEDORA' | 'CREDORA';
  level: number;
  acceptsEntries: boolean;
}

interface ParentAccount {
  id: string;
  code: string;
  name: string;
}

export default function NovaContaPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [parentAccounts, setParentAccounts] = useState<ParentAccount[]>([]);
  const [loadingParents, setLoadingParents] = useState(true);

  const [form, setForm] = useState<AccountForm>({
    parentId: '',
    code: '',
    name: '',
    type: 'ATIVO',
    nature: 'DEVEDORA',
    level: 1,
    acceptsEntries: false,
  });

  useEffect(() => {
    const fetchParents = async () => {
      setLoadingParents(true);
      try {
        const res = await apiFetch('/api/accounting/chart?limit=500&active=true');
        if (res.ok) {
          const data = await res.json();
          const mapped: ParentAccount[] = (data.data ?? []).map((c: {
            id: string;
            code: string;
            name: string;
          }) => ({
            id: c.id,
            code: c.code,
            name: c.name,
          }));
          setParentAccounts(mapped);
        }
      } catch {
        // silently handle
      } finally {
        setLoadingParents(false);
      }
    };

    fetchParents();
  }, []);

  const updateForm = (field: keyof AccountForm, value: string | boolean | number) => {
    setForm((prev) => {
      const updated = { ...prev, [field]: value };

      if (field === 'parentId') {
        const parent = parentAccounts.find((p) => p.id === value);
        if (parent) {
          const parentLevel = parent.code.split('.').length;
          updated.level = parentLevel + 1;
        } else {
          updated.level = 1;
        }
      }

      if (field === 'type') {
        const t = value as AccountType;
        updated.nature = (t === 'ATIVO' || t === 'DESPESA') ? 'DEVEDORA' : 'CREDORA';
      }

      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Map frontend 'PL' to API enum 'PATRIMONIO_LIQUIDO'
      const apiType = form.type === 'PL' ? 'PATRIMONIO_LIQUIDO' : form.type;

      const body: Record<string, unknown> = {
        code: form.code,
        name: form.name,
        type: apiType,
        nature: form.nature,
        level: form.level,
        acceptsEntries: form.acceptsEntries,
      };

      if (form.parentId) {
        body.parentId = form.parentId;
      }

      const res = await apiFetch('/api/accounting/chart', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Erro ao salvar conta' }));
        alert(err.message || 'Erro ao salvar conta');
        return;
      }

      router.push('/contabilidade/plano-contas');
    } catch {
      alert('Erro ao salvar conta');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/contabilidade/plano-contas"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Conta Contabil</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Adicionar uma nova conta ao plano de contas
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-6">
          <BookOpen className="w-5 h-5 text-violet-600" />
          <h2 className="text-lg font-semibold text-slate-900">Dados da Conta</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Conta Pai</label>
            <select
              value={form.parentId}
              onChange={(e) => updateForm('parentId', e.target.value)}
              disabled={loadingParents}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="">{loadingParents ? 'Carregando...' : 'Raiz (nivel 1)'}</option>
              {parentAccounts.map((p) => (
                <option key={p.id} value={p.id}>{p.code} - {p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Codigo *</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => updateForm('code', e.target.value)}
              placeholder="Ex: 1.1.1.04"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-mono"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Conta *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => updateForm('name', e.target.value)}
              placeholder="Ex: Aplicacoes Financeiras"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Type Radio Cards */}
        <div className="mt-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Tipo da Conta *</label>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {([
              { key: 'ATIVO' as const, label: 'Ativo', desc: 'Bens e direitos', color: 'blue' },
              { key: 'PASSIVO' as const, label: 'Passivo', desc: 'Obrigacoes', color: 'red' },
              { key: 'RECEITA' as const, label: 'Receita', desc: 'Ganhos operacionais', color: 'emerald' },
              { key: 'DESPESA' as const, label: 'Despesa', desc: 'Gastos operacionais', color: 'amber' },
              { key: 'PL' as const, label: 'PL', desc: 'Patrimonio liquido', color: 'violet' },
            ]).map((type) => (
              <label
                key={type.key}
                className={`flex flex-col items-center p-3 border rounded-lg cursor-pointer transition-colors text-center ${
                  form.type === type.key
                    ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={type.key}
                  checked={form.type === type.key}
                  onChange={() => updateForm('type', type.key)}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-slate-900">{type.label}</span>
                <span className="text-xs text-slate-500 mt-0.5">{type.desc}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Natureza</label>
            <select
              value={form.nature}
              onChange={(e) => updateForm('nature', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="DEVEDORA">Devedora</option>
              <option value="CREDORA">Credora</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nivel</label>
            <input
              type="number"
              value={form.level}
              readOnly
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 font-semibold"
            />
            <p className="text-xs text-slate-400 mt-1">Calculado automaticamente</p>
          </div>

          <div className="flex items-center pt-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={form.acceptsEntries}
                onChange={(e) => updateForm('acceptsEntries', e.target.checked)}
                className="w-4 h-4 text-violet-600 border-slate-300 rounded focus:ring-violet-500"
              />
              <div>
                <span className="text-sm font-medium text-slate-700">Aceita Lancamentos</span>
                <p className="text-xs text-slate-400">Conta analitica que recebe lancamentos</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/contabilidade/plano-contas"
          className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" />
          Salvar Conta
        </button>
      </div>
    </div>
  );
}
