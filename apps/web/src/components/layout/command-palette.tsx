'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchItem {
  label: string;
  path: string;
  group: string;
  keywords?: string;
}

const ITEMS: SearchItem[] = [
  // Dashboard
  { label: 'Dashboard', path: '/dashboard', group: 'Principal' },

  // CRM
  { label: 'Pessoas / Contatos', path: '/crm/pessoas', group: 'CRM', keywords: 'cliente fornecedor transportadora' },
  { label: 'Nova Pessoa', path: '/crm/pessoas/novo', group: 'CRM', keywords: 'cadastrar cliente fornecedor' },
  { label: 'Pipeline de Oportunidades', path: '/crm/pipeline', group: 'CRM' },

  // Comercial
  { label: 'Orçamentos', path: '/comercial/orcamentos', group: 'Comercial' },
  { label: 'Novo Orçamento', path: '/comercial/orcamentos/novo', group: 'Comercial' },
  { label: 'Pedidos de Venda', path: '/comercial/pedidos', group: 'Comercial' },

  // Estoque
  { label: 'Produtos', path: '/estoque/produtos', group: 'Estoque', keywords: 'cadastro materia prima componente' },
  { label: 'Novo Produto', path: '/estoque/produtos/novo', group: 'Estoque' },
  { label: 'Saldos de Estoque', path: '/estoque/saldos', group: 'Estoque' },
  { label: 'Movimentações de Estoque', path: '/estoque/movimentacoes', group: 'Estoque' },
  { label: 'Inventário', path: '/estoque/inventario', group: 'Estoque' },
  { label: 'Locais de Estoque', path: '/estoque/locais', group: 'Estoque' },
  { label: 'Alertas de Estoque', path: '/estoque/alertas', group: 'Estoque' },

  // Compras
  { label: 'Pedidos de Compra', path: '/compras/pedidos', group: 'Compras' },
  { label: 'Novo Pedido de Compra', path: '/compras/pedidos/novo', group: 'Compras' },
  { label: 'Solicitações de Compra', path: '/compras/solicitacoes', group: 'Compras' },
  { label: 'Cotações de Fornecedor', path: '/compras/cotacoes', group: 'Compras' },
  { label: 'NF-e de Entrada', path: '/compras/nfe-entrada', group: 'Compras' },

  // PCP
  { label: 'Estrutura de Produto (BOM)', path: '/pcp/bom', group: 'PCP', keywords: 'lista materiais explosao' },
  { label: 'Roteiros de Fabricação', path: '/pcp/roteiros', group: 'PCP' },
  { label: 'Centros de Trabalho', path: '/pcp/centros-trabalho', group: 'PCP' },

  // Produção
  { label: 'Ordens de Produção', path: '/producao/ordens', group: 'Produção' },
  { label: 'Apontamentos', path: '/producao/apontamentos', group: 'Produção' },

  // Engenharia
  { label: 'Projetos de Engenharia', path: '/engenharia/projetos', group: 'Engenharia' },

  // Oficina
  { label: 'Ordens de Serviço', path: '/oficina/ordens-servico', group: 'Oficina' },
  { label: 'Calderaria', path: '/oficina/calderaria', group: 'Oficina' },
  { label: 'Requisição Interna', path: '/oficina/requisicao', group: 'Oficina' },

  // Financeiro
  { label: 'Contas a Receber / Pagar', path: '/financeiro/movimentos', group: 'Financeiro' },
  { label: 'Contas Bancárias', path: '/financeiro/contas', group: 'Financeiro' },
  { label: 'Fluxo de Caixa', path: '/financeiro/fluxo', group: 'Financeiro' },

  // Fiscal
  { label: 'NF-e', path: '/fiscal/nfe', group: 'Fiscal' },
  { label: 'Motor Fiscal', path: '/fiscal/engine', group: 'Fiscal' },

  // Contabilidade
  { label: 'Lançamentos Contábeis', path: '/contabilidade/lancamentos', group: 'Contabilidade' },
  { label: 'Plano de Contas', path: '/contabilidade/plano-contas', group: 'Contabilidade' },
  { label: 'DRE', path: '/contabilidade/dre', group: 'Contabilidade', keywords: 'resultado exercicio lucro' },

  // RH
  { label: 'Funcionários', path: '/rh/funcionarios', group: 'RH' },
  { label: 'Folha de Pagamento', path: '/rh/folha', group: 'RH' },

  // Chamados
  { label: 'Chamados / Suporte', path: '/chamados', group: 'Suporte' },

  // Configurações
  { label: 'Dados da Empresa', path: '/configuracoes/empresa', group: 'Configurações' },
  { label: 'Usuários', path: '/configuracoes/usuarios', group: 'Configurações' },
  { label: 'NCM', path: '/fiscal/indices/ncm', group: 'Fiscal' },
  { label: 'CBENEF — Benefícios Fiscais', path: '/fiscal/indices/cbenef', group: 'Fiscal', keywords: 'pbenef isencao reducao diferimento beneficio' },
  { label: 'Protocolos ST / MVA', path: '/fiscal/indices/st-protocolo', group: 'Fiscal', keywords: 'substituicao tributaria margem valor agregado confaz' },
  { label: 'FiscalBrain Chat', path: '/fiscal/ia/chat', group: 'Fiscal', keywords: 'ia fiscal chat consultor' },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? ITEMS.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          item.group.toLowerCase().includes(q) ||
          (item.keywords ?? '').toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q)
        );
      })
    : ITEMS.slice(0, 8);

  const grouped = filtered.reduce<Record<string, SearchItem[]>>((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {});

  const flat = filtered;

  const navigate = useCallback(
    (path: string) => {
      setOpen(false);
      setQuery('');
      setSelectedIndex(0);
      router.push(path);
    },
    [router]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (flat[selectedIndex]) navigate(flat[selectedIndex].path);
    }
  };

  if (!open) return null;

  let globalIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4"
      onMouseDown={() => setOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, módulos, ações..."
            className="flex-1 text-sm text-slate-900 placeholder-slate-400 focus:outline-none bg-transparent"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-[10px] font-medium text-slate-400">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {flat.length === 0 ? (
            <p className="px-4 py-8 text-sm text-center text-slate-400">Nenhum resultado para "{query}"</p>
          ) : (
            Object.entries(grouped).map(([group, items]) => (
              <div key={group}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {group}
                </p>
                {items.map((item) => {
                  const idx = globalIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.path}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => navigate(item.path)}
                      className={cn(
                        'w-full flex items-center justify-between px-4 py-2.5 text-sm transition-colors',
                        isSelected ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      <span>{item.label}</span>
                      {isSelected && <ArrowRight className="w-4 h-4 text-blue-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-slate-100 px-4 py-2 flex items-center gap-4 text-[11px] text-slate-400">
          <span><kbd className="font-medium">↑↓</kbd> navegar</span>
          <span><kbd className="font-medium">↵</kbd> abrir</span>
          <span><kbd className="font-medium">Ctrl+K</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
}
