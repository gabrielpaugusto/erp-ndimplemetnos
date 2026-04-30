'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronLeft,
  Save,
  X,
  User,
  Truck,
  Wrench,
  Calendar,
  Plus,
  Trash2,
  Shield,
  Search,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { fmtCurrency } from '@/lib/format';

// ── Types ─────────────────────────────────────────────────────────────────────

type OSType      = 'MECANICA' | 'CALDERARIA' | 'PINTURA' | 'MISTA' | 'GARANTIA' | 'INSTALACAO' | 'INTERNA';
type Priority    = 'URGENTE' | 'ALTA' | 'NORMAL' | 'BAIXA';
type TipoPagador = 'CLIENTE' | 'FABRICA' | 'SEGURADORA' | 'TERCEIRO' | 'PROPRIA';
type ItemTipo    = 'PECA' | 'SERVICO' | 'MATERIAL_CALDERARIA' | 'TERCEIRO';

interface PersonOption {
  id: string;
  name: string;
  cpfCnpj: string;
  type: string;
}

interface ProductOption {
  id: string;
  name: string;
  code: string;
  price: number;
}

interface EquipamentoOption {
  id: string;
  label: string;
  tipo: string;
  marca: string;
  modelo: string;
  placa?: string;
  chassi?: string;
  serialNumber?: string;
  anoModelo?: number;
  kmAtual?: number | null;
  proprietarioId?: string | null;
  proprietarioNome?: string | null;
  osCount?: number;
}

interface TarefaCatalogo {
  id: string;
  codigo: string;
  nome: string;
  contexto: string;
  tempoPadraoH: number;
  subtarefas: { id: string; nome: string; tempoPadraoH: number; ordem: number }[];
}

interface OSItem {
  id: string;
  description: string;
  tipo: ItemTipo;
  productId: string;
  quantity: string;
  unitPrice: string;
}

interface OSForm {
  personId: string;
  type: OSType;
  priority: Priority;
  tipoPagador: TipoPagador;
  equipamentoId: string;
  kmEntrada: string;
  carroceriaId: string;
  garantiaFabricante: string;
  garantiaReembolsaPecas: boolean;
  garantiaReembolsaMO: boolean;
  fabricantePersonId: string;  // F2 — Person PJ do fabricante
  seguradoraId: string;        // F2 — Person PJ da seguradora
  apoliceNumero: string;       // F2
  sinistroNumero: string;      // F2
  defeitoRelatado: string;
  dataEntrada: string;
  dataPrevisao: string;
  observations: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_OPTIONS: {
  key: OSType;
  label: string;
  desc: string;
  activeClass: string;
  icon: string;
}[] = [
  { key: 'MECANICA',   label: 'Mecânica',   desc: 'Reparo mecânico, troca de componentes',    activeClass: 'border-rose-500 bg-rose-50 text-rose-700',   icon: '🔧' },
  { key: 'CALDERARIA', label: 'Calderaria', desc: 'Solda, estrutura metálica, chapeamento',   activeClass: 'border-zinc-500 bg-zinc-100 text-zinc-800',   icon: '⚙️' },
  { key: 'PINTURA',    label: 'Pintura',    desc: 'Pintura, jateamento, acabamento',           activeClass: 'border-indigo-500 bg-indigo-50 text-indigo-700', icon: '🎨' },
  { key: 'MISTA',      label: 'Mista',      desc: 'Combina mecânica e calderaria',             activeClass: 'border-purple-500 bg-purple-50 text-purple-700', icon: '🔀' },
  { key: 'GARANTIA',   label: 'Garantia',   desc: 'Serviço coberto por garantia do fabricante', activeClass: 'border-orange-500 bg-orange-50 text-orange-700', icon: '🛡️' },
  { key: 'INSTALACAO', label: 'Instalação', desc: 'Instalação de implemento / carroceria nova', activeClass: 'border-teal-500 bg-teal-50 text-teal-700',   icon: '🏗️' },
  { key: 'INTERNA',    label: 'Interna',    desc: 'Uso interno, não faturável ao cliente',     activeClass: 'border-slate-500 bg-slate-100 text-slate-700', icon: '🏭' },
];

const TIPO_PAGADOR_LABELS: Record<TipoPagador, string> = {
  CLIENTE:    'Cliente',
  FABRICA:    'Fábrica / Fabricante',
  SEGURADORA: 'Seguradora',
  TERCEIRO:   'Terceiro',
  PROPRIA:    'Conta Própria',
};

const ITEM_TIPO_LABELS: Record<ItemTipo, string> = {
  PECA:               'Peça',
  SERVICO:            'Serviço MO',
  MATERIAL_CALDERARIA:'Mat. Calderaria',
  TERCEIRO:           'Terceiro',
};

// ── Section header helper ─────────────────────────────────────────────────────

function Section({
  number, icon, title, subtitle, children, accent,
}: {
  number: number; icon: ReactNode; title: string; subtitle?: string;
  children: ReactNode; accent?: string;
}) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border ${accent ?? 'border-slate-200'} overflow-hidden`}>
      <div className={`flex items-center gap-3 px-6 py-4 border-b ${accent ? accent.replace('border-', 'border-b-') : 'border-b-slate-100'} bg-slate-50/60`}>
        <span className="flex items-center justify-center w-7 h-7 rounded-full bg-rose-600 text-white text-xs font-bold shrink-0">
          {number}
        </span>
        <span className="text-rose-600">{icon}</span>
        <div>
          <h2 className="text-base font-semibold text-slate-900 leading-none">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

// ── PersonCombobox ────────────────────────────────────────────────────────────

function PersonCombobox({
  persons, value, onChange, loading,
}: {
  persons: PersonOption[]; value: string; onChange: (id: string) => void; loading: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = persons.find((p) => p.id === value);

  const filtered = query.trim()
    ? persons.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.cpfCnpj.includes(query.replace(/\D/g, ''))
      ).slice(0, 40)
    : persons.slice(0, 40);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { if (!loading) setOpen((o) => !o); }}
        className={`flex items-center gap-2 w-full px-3 py-2.5 border rounded-lg text-sm cursor-pointer transition-colors ${
          open ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-300 hover:border-slate-400'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <User className="w-4 h-4 text-slate-400 shrink-0" />
        {selected ? (
          <span className="flex-1 text-slate-900 truncate">
            <span className="font-medium">{selected.name}</span>
            {selected.cpfCnpj && <span className="text-slate-400 text-xs ml-2">{selected.cpfCnpj}</span>}
          </span>
        ) : (
          <span className="flex-1 text-slate-400">{loading ? 'Carregando...' : 'Selecione ou busque o cliente...'}</span>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou CPF/CNPJ..."
                className="flex-1 bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum resultado</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onChange(p.id); setOpen(false); setQuery(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-rose-50 transition-colors ${
                    p.id === value ? 'bg-rose-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">{p.name}</div>
                    {p.cpfCnpj && <div className="text-xs text-slate-400">{p.cpfCnpj}</div>}
                  </div>
                  {p.id === value && <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── EquipamentoCombobox ───────────────────────────────────────────────────────

function EquipamentoCombobox({
  equipamentos, value, onChange, loading,
}: {
  equipamentos: EquipamentoOption[];
  value: string;
  onChange: (id: string, equip: EquipamentoOption | null) => void;
  loading: boolean;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = equipamentos.find((e) => e.id === value);

  const filtered = query.trim()
    ? equipamentos.filter((e) => {
        const q = query.toLowerCase();
        return (
          e.placa?.toLowerCase().includes(q) ||
          e.chassi?.toLowerCase().includes(q) ||
          e.serialNumber?.toLowerCase().includes(q) ||
          e.marca?.toLowerCase().includes(q) ||
          e.modelo?.toLowerCase().includes(q) ||
          e.proprietarioNome?.toLowerCase().includes(q)
        );
      }).slice(0, 30)
    : equipamentos.slice(0, 30);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => { if (!loading) setOpen((o) => !o); }}
        className={`flex items-center gap-2 w-full px-3 py-2.5 border rounded-lg text-sm cursor-pointer transition-colors ${
          open ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-300 hover:border-slate-400'
        } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Truck className="w-4 h-4 text-slate-400 shrink-0" />
        {selected ? (
          <span className="flex-1 min-w-0">
            <span className="font-medium text-slate-900">
              {selected.placa ?? selected.serialNumber ?? selected.chassi?.slice(0, 10) ?? '—'}
            </span>
            <span className="text-slate-400 text-xs ml-2">
              {[selected.marca, selected.modelo, selected.anoModelo].filter(Boolean).join(' ')}
            </span>
          </span>
        ) : (
          <span className="flex-1 text-slate-400">{loading ? 'Carregando...' : '— Nenhum equipamento —'}</span>
        )}
        {selected && (
          <button
            onClick={(e) => { e.stopPropagation(); onChange('', null); setQuery(''); }}
            className="p-0.5 text-slate-300 hover:text-red-400 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </div>

      {open && !loading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100">
            <div className="flex items-center gap-2 px-2 py-1.5 bg-slate-50 rounded-lg">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por placa, chassi, marca..."
                className="flex-1 bg-transparent text-sm outline-none text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-400 text-center">Nenhum resultado</div>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { onChange(e.id, e); setOpen(false); setQuery(''); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-rose-50 transition-colors ${
                    e.id === value ? 'bg-rose-50' : ''
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        {e.placa ?? e.serialNumber ?? e.chassi?.slice(0, 10) ?? '—'}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 uppercase font-medium">
                        {e.tipo}
                      </span>
                      {e.osCount != null && e.osCount > 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                          {e.osCount} OS
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {[e.marca, e.modelo, e.anoModelo].filter(Boolean).join(' ')}
                      {e.proprietarioNome && <span className="ml-2 text-slate-400">· {e.proprietarioNome}</span>}
                      {e.kmAtual != null && <span className="ml-2 text-slate-400">· {e.kmAtual.toLocaleString('pt-BR')} km</span>}
                    </div>
                  </div>
                  {e.id === value && <CheckCircle2 className="w-4 h-4 text-rose-600 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function NovaOrdemServicoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [persons, setPersons] = useState<PersonOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [equipamentos, setEquipamentos] = useState<EquipamentoOption[]>([]);
  const [carrocerias, setCarrocerias] = useState<EquipamentoOption[]>([]);
  const [tarefasCatalogo, setTarefasCatalogo] = useState<TarefaCatalogo[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<OSForm>({
    personId: '',
    type: 'MECANICA',
    priority: 'NORMAL',
    tipoPagador: 'CLIENTE',
    equipamentoId: '',
    kmEntrada: '',
    carroceriaId: '',
    garantiaFabricante: '',
    garantiaReembolsaPecas: false,
    garantiaReembolsaMO: false,
    fabricantePersonId: '',
    seguradoraId: '',
    apoliceNumero: '',
    sinistroNumero: '',
    defeitoRelatado: '',
    dataEntrada: new Date().toISOString().slice(0, 16), // datetime-local format
    dataPrevisao: '',
    observations: '',
  });

  const [items, setItems] = useState<OSItem[]>([
    { id: '1', description: '', tipo: 'PECA', productId: '', quantity: '1', unitPrice: '0' },
  ]);

  // Tarefas from catalog to attach
  const [selectedTarefas, setSelectedTarefas] = useState<string[]>([]);

  // Load all reference data in parallel
  useEffect(() => {
    async function loadData() {
      try {
        const [personsRes, productsRes, equipsRes, tarefasRes] = await Promise.all([
          apiFetch('/api/persons?limit=500'),
          apiFetch('/api/products?limit=500').catch(() => null),
          apiFetch('/api/workshop/equipamentos?limit=500'),
          apiFetch('/api/workshop/tarefas-catalogo?limit=200').catch(() => null),
        ]);

        if (personsRes.ok) {
          const d = await personsRes.json();
          setPersons(
            (d.data || d || []).map((p: any) => ({
              id: p.id,
              name: p.razaoSocial ?? p.nomeFantasia ?? p.name ?? '—',
              cpfCnpj: p.cpfCnpj ?? '',
              type: p.type ?? 'PF',
            }))
          );
        }

        if (productsRes?.ok) {
          const d = await productsRes.json();
          setProducts(
            (d.data || d || []).map((p: any) => ({
              id: p.id,
              name: p.description ?? p.name ?? '—',
              code: p.code ?? '',
              price: Number(p.salePrice ?? p.price ?? 0),
            }))
          );
        }

        if (equipsRes.ok) {
          const d = await equipsRes.json();
          const all: EquipamentoOption[] = (d.data || d || []).map((e: any) => ({
            id: e.id,
            label: [e.marca, e.modelo, e.anoModelo, e.placa || e.serialNumber]
              .filter(Boolean)
              .join(' · '),
            tipo: e.tipo,
            marca: e.marca ?? '',
            modelo: e.modelo ?? '',
            placa: e.placa,
            chassi: e.chassi,
            serialNumber: e.serialNumber,
            anoModelo: e.anoModelo,
            kmAtual: e.kmAtual ?? null,
            proprietarioId: e.proprietario?.id ?? null,
            proprietarioNome: e.proprietario?.razaoSocial ?? null,
            osCount: e._count?.ordensServico ?? null,
          }));
          setEquipamentos(all.filter((e) => e.tipo !== 'CARROCERIA'));
          setCarrocerias(all.filter((e) => e.tipo === 'CARROCERIA'));
        }

        if (tarefasRes?.ok) {
          const d = await tarefasRes.json();
          setTarefasCatalogo(d.data || d || []);
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err);
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  // Pre-fill equipamento a partir de ?equipamentoId=xxx (vindo da página de frota)
  useEffect(() => {
    const eqId = searchParams?.get('equipamentoId');
    if (!eqId || equipamentos.length === 0) return;
    const equip = equipamentos.find((e) => e.id === eqId);
    if (!equip) return;
    setForm((prev) => ({
      ...prev,
      equipamentoId: eqId,
      kmEntrada: equip.kmAtual != null ? String(equip.kmAtual) : prev.kmEntrada,
      // Preenche proprietário só se ainda não foi selecionado cliente
      personId: prev.personId || equip.proprietarioId || prev.personId,
    }));
  }, [searchParams, equipamentos]);

  const updateForm = <K extends keyof OSForm>(field: K, value: OSForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // ── Items helpers ───────────────────────────────────────────────────────────

  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { id: String(Date.now()), description: '', tipo: 'PECA', productId: '', quantity: '1', unitPrice: '0' },
    ]);

  const removeItem = (id: string) => {
    if (items.length > 1) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const updateItem = (id: string, field: keyof OSItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'productId' && value) {
          const product = products.find((p) => p.id === value);
          if (product) {
            updated.description = product.name;
            updated.unitPrice = String(product.price);
          }
        }
        return updated;
      })
    );
  };

  // Seleção de equipamento com auto-fill de KM e proprietário
  const handleEquipamentoChange = (id: string, equip: EquipamentoOption | null) => {
    setForm((prev) => ({
      ...prev,
      equipamentoId: id,
      kmEntrada: equip?.kmAtual != null ? String(equip.kmAtual) : prev.kmEntrada,
      personId: prev.personId || equip?.proprietarioId || prev.personId,
    }));
  };

  const getItemTotal = (item: OSItem) =>
    (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);

  const totalPecas    = items.filter((i) => i.tipo === 'PECA' || i.tipo === 'MATERIAL_CALDERARIA').reduce((s, i) => s + getItemTotal(i), 0);
  const totalServicos = items.filter((i) => i.tipo === 'SERVICO' || i.tipo === 'TERCEIRO').reduce((s, i) => s + getItemTotal(i), 0);
  const totalGeral    = totalPecas + totalServicos;

  // ── Tarefas helpers ─────────────────────────────────────────────────────────

  const toggleTarefa = (id: string) =>
    setSelectedTarefas((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    setError(null);

    if (!form.personId)       { setError('Selecione o cliente.'); return; }
    if (!form.defeitoRelatado.trim()) { setError('Informe o defeito relatado / serviço solicitado.'); return; }
    if (!form.dataEntrada)    { setError('Informe a data de entrada.'); return; }

    setSaving(true);
    try {
      const body: any = {
        personId:       form.personId,
        type:           form.type,
        priority:       form.priority,
        tipoPagador:    form.tipoPagador,
        defeitoRelatado: form.defeitoRelatado.trim(),
        dataEntrada:    new Date(form.dataEntrada).toISOString(),
        dataPrevisao:   form.dataPrevisao ? new Date(form.dataPrevisao).toISOString() : undefined,
        observations:   form.observations || undefined,
        items: items
          .filter((i) => i.description.trim())
          .map((i) => ({
            productId:   i.productId || undefined,
            description: i.description.trim(),
            quantity:    parseFloat(i.quantity) || 1,
            unitPrice:   parseFloat(i.unitPrice) || 0,
            tipo:        i.tipo,
          })),
      };

      if (form.equipamentoId) body.equipamentoId = form.equipamentoId;
      if (form.kmEntrada)     body.kmEntrada = parseInt(form.kmEntrada, 10);

      if (form.type === 'INSTALACAO' && form.carroceriaId) {
        body.carroceriaId = form.carroceriaId;
      }

      if (form.type === 'GARANTIA' || form.tipoPagador === 'FABRICA') {
        if (form.garantiaFabricante) body.garantiaFabricante = form.garantiaFabricante;
        body.garantiaReembolsaPecas = form.garantiaReembolsaPecas;
        body.garantiaReembolsaMO    = form.garantiaReembolsaMO;
        if (form.fabricantePersonId) body.fabricantePersonId = form.fabricantePersonId;
      }

      if (form.tipoPagador === 'SEGURADORA') {
        if (form.seguradoraId)   body.seguradoraId   = form.seguradoraId;
        if (form.apoliceNumero)  body.apoliceNumero  = form.apoliceNumero;
        if (form.sinistroNumero) body.sinistroNumero = form.sinistroNumero;
      }

      const res = await apiFetch('/api/service-orders', {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: res.statusText }));
        const msg = Array.isArray(errData.message) ? errData.message.join(' • ') : (errData.message || 'Erro ao criar OS.');
        setError(msg);
        return;
      }

      const os = await res.json();

      // Attach selected tarefas from catalog
      for (const tarefaCatalogoId of selectedTarefas) {
        await apiFetch('/api/workshop/tarefas-catalogo/adicionar-na-os', {
          method: 'POST',
          body: JSON.stringify({ serviceOrderId: os.id, tarefaCatalogoId }),
        }).catch(() => {});
      }

      router.push(`/oficina/ordens-servico/${os.id}`);
    } catch (err: any) {
      setError(err.message || 'Erro ao criar OS.');
    } finally {
      setSaving(false);
    }
  };

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedEquip  = equipamentos.find((e) => e.id === form.equipamentoId);
  const selectedType   = TYPE_OPTIONS.find((t) => t.key === form.type)!;
  const totalTarefasH  = tarefasCatalogo
    .filter((t) => selectedTarefas.includes(t.id))
    .reduce((s, t) => s + (t.tempoPadraoH ?? 0), 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-28">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/oficina/ordens-servico"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nova Ordem de Serviço</h1>
          <p className="text-slate-500 mt-0.5 text-sm">
            Criada como <strong>Orçamento</strong> — avance para aprovação no detalhe da OS
          </p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 1 — Tipo */}
      <Section number={1} icon={<Wrench className="w-4 h-4" />} title="Tipo de Serviço">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {TYPE_OPTIONS.map((opt) => {
            const active = form.type === opt.key;
            return (
              <label
                key={opt.key}
                className={`flex flex-col gap-1 p-3.5 border-2 rounded-xl cursor-pointer transition-all select-none ${
                  active ? opt.activeClass + ' shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={opt.key}
                  checked={active}
                  onChange={() => updateForm('type', opt.key)}
                  className="sr-only"
                />
                <span className="text-xl leading-none">{opt.icon}</span>
                <span className={`text-sm font-semibold leading-none ${active ? '' : 'text-slate-800'}`}>
                  {opt.label}
                </span>
                <span className="text-[10px] leading-tight opacity-70">{opt.desc}</span>
              </label>
            );
          })}
        </div>
      </Section>

      {/* 2 — Cliente */}
      <Section number={2} icon={<User className="w-4 h-4" />} title="Cliente e Responsabilidade">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Cliente <span className="text-rose-500">*</span>
            </label>
            <PersonCombobox
              persons={persons}
              value={form.personId}
              onChange={(id) => updateForm('personId', id)}
              loading={loadingData}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Quem paga?</label>
            <select
              value={form.tipoPagador}
              onChange={(e) => updateForm('tipoPagador', e.target.value as TipoPagador)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              {Object.entries(TIPO_PAGADOR_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* F2 — Seguradora: campos extras quando tipoPagador = SEGURADORA */}
          {form.tipoPagador === 'SEGURADORA' && (
            <div className="col-span-full mt-1 p-4 bg-sky-50 border border-sky-200 rounded-lg space-y-4">
              <p className="text-xs font-semibold text-sky-700 uppercase tracking-wide">Dados da Seguradora</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-sky-700 mb-1.5">Seguradora (cadastro)</label>
                  <select
                    value={form.seguradoraId}
                    onChange={(e) => updateForm('seguradoraId', e.target.value)}
                    className="w-full px-3 py-2.5 border border-sky-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  >
                    <option value="">— Selecione —</option>
                    {persons.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-700 mb-1.5">Nº Apólice</label>
                  <input type="text" value={form.apoliceNumero} onChange={(e) => updateForm('apoliceNumero', e.target.value)}
                    placeholder="Ex: 123456/2024" className="w-full px-3 py-2.5 border border-sky-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-sky-700 mb-1.5">Nº Sinistro</label>
                  <input type="text" value={form.sinistroNumero} onChange={(e) => updateForm('sinistroNumero', e.target.value)}
                    placeholder="Ex: SIN-2024-00042" className="w-full px-3 py-2.5 border border-sky-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Prioridade</label>
            <select
              value={form.priority}
              onChange={(e) => updateForm('priority', e.target.value as Priority)}
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="URGENTE">🔴 Urgente</option>
              <option value="ALTA">🟠 Alta</option>
              <option value="NORMAL">🔵 Normal</option>
              <option value="BAIXA">⚪ Baixa</option>
            </select>
          </div>
        </div>
      </Section>

      {/* 3 — Equipamento */}
      <Section
        number={3}
        icon={<Truck className="w-4 h-4" />}
        title="Equipamento"
        subtitle="Opcional — veículo, semi-reboque ou implemento"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Equipamento / Veículo</label>
            <EquipamentoCombobox
              equipamentos={equipamentos}
              value={form.equipamentoId}
              onChange={handleEquipamentoChange}
              loading={loadingData}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">KM de Entrada</label>
            <input
              type="number"
              value={form.kmEntrada}
              onChange={(e) => updateForm('kmEntrada', e.target.value)}
              placeholder="Ex: 125000"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Equipamento preview card */}
        {selectedEquip ? (
          <div className="mt-4 flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
            <Truck className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900">
                {selectedEquip.placa ?? selectedEquip.serialNumber ?? '—'}
                <span className="text-slate-500 font-normal ml-2">
                  {[selectedEquip.marca, selectedEquip.modelo, selectedEquip.anoModelo].filter(Boolean).join(' ')}
                </span>
              </div>
              <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                <span className="px-1.5 py-0.5 bg-slate-200 rounded text-slate-600 uppercase text-[10px] font-medium">
                  {selectedEquip.tipo}
                </span>
                {selectedEquip.chassi && <span>Chassi: <strong className="font-mono">{selectedEquip.chassi.slice(0,10)}…</strong></span>}
                {selectedEquip.kmAtual != null && <span>KM atual: <strong>{selectedEquip.kmAtual.toLocaleString('pt-BR')}</strong></span>}
                {selectedEquip.proprietarioNome && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    Proprietário auto-preenchido: <strong>{selectedEquip.proprietarioNome}</strong>
                  </span>
                )}
                {selectedEquip.osCount != null && selectedEquip.osCount > 0 && (
                  <span className="flex items-center gap-1 text-amber-600">
                    <Wrench className="w-3 h-3" />
                    {selectedEquip.osCount} OS anterior{selectedEquip.osCount > 1 ? 'es' : ''}
                  </span>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Sem equipamento — o defeito relatado será o único identificador.
            Cadastre em <strong>Oficina → Equipamentos</strong> para vincular.
          </p>
        )}

        {/* Instalação: carroceria */}
        {form.type === 'INSTALACAO' && (
          <div className="mt-5 pt-5 border-t border-teal-200">
            <label className="block text-sm font-medium text-teal-700 mb-1.5">
              🏗️ Carroceria a Instalar
            </label>
            <select
              value={form.carroceriaId}
              onChange={(e) => updateForm('carroceriaId', e.target.value)}
              disabled={loadingData}
              className="w-full px-3 py-2.5 border border-teal-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-50"
            >
              <option value="">Selecione a carroceria</option>
              {carrocerias.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-teal-600">
              O custo desta OS será agregado ao custo de produção da carroceria ao faturar.
            </p>
          </div>
        )}

        {/* Garantia / Fabricante: dados extra */}
        {(form.type === 'GARANTIA' || form.tipoPagador === 'FABRICA') && (
          <div className="mt-5 pt-5 border-t border-orange-200">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-orange-600" />
              <span className="text-sm font-semibold text-orange-800">Dados de Garantia / Fabricante</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-orange-700 mb-1.5">Fabricante / Ref. Garantia</label>
                <input
                  type="text"
                  value={form.garantiaFabricante}
                  onChange={(e) => updateForm('garantiaFabricante', e.target.value)}
                  placeholder="Ex: Guerra Implementos — Proc. 2024/0042"
                  className="w-full px-3 py-2.5 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-orange-700 mb-1.5">Fabricante cadastrado (para reembolso)</label>
                <select
                  value={form.fabricantePersonId}
                  onChange={(e) => updateForm('fabricantePersonId', e.target.value)}
                  className="w-full px-3 py-2.5 border border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  <option value="">— Selecione (opcional) —</option>
                  {persons.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
                <p className="text-xs text-orange-500 mt-1">Título de reembolso será gerado contra este cadastro</p>
              </div>
              <div className="flex flex-col gap-3 justify-center">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.garantiaReembolsaPecas}
                    onChange={(e) => updateForm('garantiaReembolsaPecas', e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-orange-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-orange-900">Fabricante reembolsa peças</span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.garantiaReembolsaMO}
                    onChange={(e) => updateForm('garantiaReembolsaMO', e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded border-orange-300 focus:ring-orange-500"
                  />
                  <span className="text-sm text-orange-900">Fabricante reembolsa mão de obra</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* 4 — Defeito e datas */}
      <Section
        number={4}
        icon={<ClipboardList className="w-4 h-4" />}
        title="Defeito / Serviço e Datas"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Defeito Relatado / Serviço Solicitado <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={form.defeitoRelatado}
              onChange={(e) => updateForm('defeitoRelatado', e.target.value)}
              rows={4}
              placeholder="Descreva o defeito relatado pelo cliente, o serviço solicitado ou o que foi identificado na avaliação..."
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Observações Internas</label>
            <input
              type="text"
              value={form.observations}
              onChange={(e) => updateForm('observations', e.target.value)}
              placeholder="Observações para uso interno (não aparece no espelho da OS)"
              className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Data / Hora de Entrada <span className="text-rose-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.dataEntrada}
                onChange={(e) => updateForm('dataEntrada', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Previsão de Conclusão
              </label>
              <input
                type="datetime-local"
                value={form.dataPrevisao}
                onChange={(e) => updateForm('dataPrevisao', e.target.value)}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* 5 — Tarefas do catálogo */}
      {tarefasCatalogo.length > 0 && (
        <Section
          number={5}
          icon={<CheckCircle2 className="w-4 h-4" />}
          title="Tarefas do Catálogo"
          subtitle="Selecione as tarefas a vincular a esta OS — serão criadas com suas subtarefas"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {tarefasCatalogo.map((t) => {
              const selected = selectedTarefas.includes(t.id);
              return (
                <label
                  key={t.id}
                  className={`flex items-start gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all ${
                    selected
                      ? 'border-rose-400 bg-rose-50'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleTarefa(t.id)}
                    className="mt-0.5 w-4 h-4 text-rose-600 rounded border-slate-300 focus:ring-rose-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">{t.codigo}</span>
                      <span className="text-sm font-medium text-slate-900 truncate">{t.nome}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                      <span>⏱ {t.tempoPadraoH ?? '—'}h padrão</span>
                      {t.subtarefas?.length > 0 && (
                        <span>{t.subtarefas.length} subtarefa{t.subtarefas.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {selectedTarefas.length > 0 && (
            <div className="mt-3 flex items-center gap-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                <strong>{selectedTarefas.length} tarefa{selectedTarefas.length > 1 ? 's' : ''}</strong> selecionada{selectedTarefas.length > 1 ? 's' : ''} ·{' '}
                <strong>{totalTarefasH.toFixed(1)}h</strong> de trabalho estimado
              </span>
            </div>
          )}
        </Section>
      )}

      {/* 6 — Itens / Orçamento */}
      <Section
        number={tarefasCatalogo.length > 0 ? 6 : 5}
        icon={<Wrench className="w-4 h-4" />}
        title="Itens e Serviços"
        subtitle="Peças, mão de obra e materiais do orçamento"
      >
        <div className="overflow-x-auto -mx-1">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="text-left px-2 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Descrição</th>
                <th className="text-center px-2 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-36">Tipo</th>
                <th className="text-left px-2 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-44">Produto</th>
                <th className="text-center px-2 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">Qtd</th>
                <th className="text-right px-2 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Unit.</th>
                <th className="text-right px-2 pb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">Total</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map((item) => (
                <tr key={item.id} className="group">
                  <td className="px-2 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Descrição do item..."
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50 focus:bg-white"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={item.tipo}
                      onChange={(e) => updateItem(item.id, 'tipo', e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50"
                    >
                      {Object.entries(ITEM_TIPO_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2">
                    {(item.tipo === 'PECA' || item.tipo === 'MATERIAL_CALDERARIA') && products.length > 0 ? (
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(item.id, 'productId', e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50"
                      >
                        <option value="">Produto</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs text-slate-300 px-2">—</span>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      min="0.01"
                      step="0.01"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50 focus:bg-white"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(item.id, 'unitPrice', e.target.value)}
                      min="0"
                      step="0.01"
                      className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent bg-slate-50 focus:bg-white"
                    />
                  </td>
                  <td className="px-2 py-2 text-sm font-semibold text-slate-800 text-right whitespace-nowrap">
                    {fmtCurrency(getItemTotal(item))}
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => removeItem(item.id)}
                      disabled={items.length === 1}
                      className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <button
            onClick={addItem}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-sm font-medium transition-colors border border-rose-200 hover:border-rose-300"
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar Item
          </button>

          <div className="w-64 space-y-1.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Peças / Materiais</span>
              <span className="font-medium text-slate-700">{fmtCurrency(totalPecas)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">MO / Terceiros</span>
              <span className="font-medium text-slate-700">{fmtCurrency(totalServicos)}</span>
            </div>
            <div className="flex items-center justify-between text-base pt-2 border-t border-slate-200">
              <span className="font-semibold text-slate-900">Total Orçamento</span>
              <span className="font-bold text-rose-700">{fmtCurrency(totalGeral)}</span>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Sticky action bar ─────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-4">
        {/* Summary pill */}
        <div className="hidden sm:flex items-center gap-3 text-sm">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${selectedType.activeClass}`}>
            {selectedType.icon} {selectedType.label}
          </span>
          {form.personId && (
            <span className="text-slate-600 truncate max-w-[200px]">
              {persons.find((p) => p.id === form.personId)?.name}
            </span>
          )}
          {totalGeral > 0 && (
            <span className="text-slate-500">{fmtCurrency(totalGeral)}</span>
          )}
          {selectedTarefas.length > 0 && (
            <span className="text-slate-500">{selectedTarefas.length} tarefa{selectedTarefas.length > 1 ? 's' : ''}</span>
          )}
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <Link
            href="/oficina/ordens-servico"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 text-sm font-medium transition-colors"
          >
            <X className="w-4 h-4" />
            Cancelar
          </Link>
          <button
            onClick={handleSave}
            disabled={saving || loadingData}
            className="inline-flex items-center gap-2 px-5 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Criar Orçamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
