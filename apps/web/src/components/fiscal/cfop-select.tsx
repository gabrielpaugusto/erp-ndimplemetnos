'use client';

/**
 * CfopSelect — dropdown pesquisável para CFOP.
 *
 * Uso:
 *   <CfopSelect
 *     value="5102"
 *     readOnly={!canConfigurar('FISCAL')}
 *     onSelect={(cfop) => updateItem('cfop', cfop.code)}
 *   />
 *
 * - Exibe código + busca inline sem modal separado.
 * - Digitar filtra os CFOPs cadastrados em tempo real.
 * - Navegar por teclado (↑↓ Enter Esc).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronDown, Lock, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api';

interface CfopItem {
  id: string;
  code: string;
  description: string;
}

interface CfopSelectProps {
  value: string;
  readOnly?: boolean;
  onSelect: (cfop: CfopItem) => void;
  placeholder?: string;
  className?: string;
}

export function CfopSelect({
  value,
  readOnly = false,
  onSelect,
  placeholder = 'Ex: 5102',
  className = '',
}: CfopSelectProps) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState(value);
  const [items, setItems] = useState<CfopItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const LIMIT = 20;

  // Sync quando value muda externamente
  useEffect(() => { setInputVal(value); }, [value]);

  const fetchCfop = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (q.trim()) params.set('search', q.trim());
      const res = await apiFetch(`/api/fiscal/cfop?${params}`);
      const json = await res.json();
      setItems(Array.isArray(json.data) ? json.data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce ao digitar
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchCfop(inputVal), 250);
    return () => clearTimeout(t);
  }, [inputVal, open, fetchCfop]);

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setInputVal(value); // restaura valor original se não selecionou
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value]);

  const handleFocus = () => {
    if (readOnly) return;
    setOpen(true);
    setActiveIdx(-1);
    fetchCfop(inputVal);
  };

  const handleSelect = (cfop: CfopItem) => {
    onSelect(cfop);
    setInputVal(cfop.code);
    setOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(items[activeIdx]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setInputVal(value);
    }
  };

  const selectedItem = items.find((i) => i.code === value);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value); setActiveIdx(-1); }}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          placeholder={placeholder}
          className={`input pr-8 font-mono text-sm ${readOnly ? 'bg-slate-50 text-slate-500 cursor-default' : ''}`}
          autoComplete="off"
          title={readOnly ? 'Sem permissão para alterar o CFOP' : undefined}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {readOnly
            ? <Lock className="w-3.5 h-3.5 text-slate-300" />
            : <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
          }
        </span>
      </div>

      {/* Descrição do CFOP selecionado */}
      {selectedItem && !open && (
        <p className="text-xs text-slate-500 mt-0.5 truncate">{selectedItem.description}</p>
      )}

      {/* Aviso se valor digitado não corresponde a nenhum CFOP cadastrado */}
      {!open && value && !selectedItem && items.length === 0 && (
        <p className="flex items-center gap-1 text-xs text-amber-600 mt-0.5">
          <AlertCircle className="w-3 h-3" /> CFOP não encontrado nos cadastros
        </p>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute z-40 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-64 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
              Nenhum CFOP encontrado
            </div>
          ) : (
            <div className="overflow-y-auto">
              {items.map((cfop, idx) => (
                <button
                  key={cfop.id}
                  type="button"
                  onMouseDown={() => handleSelect(cfop)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                    idx === activeIdx ? 'bg-blue-50' : 'hover:bg-slate-50'
                  } ${value === cfop.code ? 'bg-blue-50/60' : ''}`}
                >
                  <span className="font-mono text-sm font-semibold text-slate-800 w-14 shrink-0">{cfop.code}</span>
                  <span className="text-xs text-slate-500 leading-relaxed">{cfop.description}</span>
                  {value === cfop.code && (
                    <span className="ml-auto text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold shrink-0">ATUAL</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
