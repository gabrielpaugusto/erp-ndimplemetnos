'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Plus, MapPin, Eye, RefreshCw, Package } from 'lucide-react';
import { apiFetch } from '@/lib/api';

type LocationType = 'ALMOXARIFADO' | 'PRODUCAO' | 'EXPEDICAO' | 'QUARENTENA';

interface StockLocation {
  id: string;
  code: string;
  name: string;
  type: LocationType;
  description?: string;
  active: boolean;
  _count?: { balances?: number; stockBalances?: number };
}

const typeLabels: Record<LocationType, string> = {
  ALMOXARIFADO: 'Almoxarifado', PRODUCAO: 'Producao',
  EXPEDICAO: 'Expedicao', QUARENTENA: 'Quarentena',
};
const typeColors: Record<LocationType, string> = {
  ALMOXARIFADO: 'bg-blue-100 text-blue-700', PRODUCAO: 'bg-amber-100 text-amber-700',
  EXPEDICAO: 'bg-emerald-100 text-emerald-700', QUARENTENA: 'bg-red-100 text-red-700',
};

export default function LocaisEstoquePage() {
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await apiFetch('/api/inventory/locations?limit=100&active=true');
    if (res.ok) {
      const data = await res.json();
      setLocations(data.data ?? data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Locais de Estoque</h1>
          <p className="text-slate-500 mt-1">Gerencie os locais de armazenagem e producao</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Link href="/estoque/locais/novo" className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Novo Local
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin" />
        </div>
      ) : locations.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-12 text-center text-sm text-slate-500">
          Nenhum local de estoque cadastrado.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((loc) => (
            <div key={loc.id} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-teal-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-900">{loc.name}</h3>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColors[loc.type as LocationType] ?? 'bg-slate-100 text-slate-600'}`}>
                        {typeLabels[loc.type as LocationType] ?? loc.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{loc.code}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${loc.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {loc.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {loc.description && (
                <p className="text-xs text-slate-600 mt-3 leading-relaxed">{loc.description}</p>
              )}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1">
                  <Package className="w-4 h-4 text-teal-600" />
                  <span className="text-sm font-semibold text-teal-700">
                    {loc._count?.stockBalances ?? loc._count?.balances ?? 0} itens
                  </span>
                </div>
                <Link href={`/estoque/saldos?location=${loc.code}`} className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors" title="Ver saldos">
                  <Eye className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
