'use client';

/**
 * /mobile/apontar
 * Página de apontamento via QR Code — o mecânico escaneia o QR da subtarefa
 * e é redirecionado para /mobile/apontar/[subtarefaId]
 *
 * Nesta rota exibimos um campo para colar/digitar o ID da subtarefa
 * (alternativa quando a câmera não funciona) e instruções de uso.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QrCode, ArrowRight, ChevronLeft, Scan } from 'lucide-react';
import Link from 'next/link';

export default function ApontarQrPage() {
  const router = useRouter();
  const [id, setId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = id.trim();
    if (!trimmed) return;
    router.push(`/mobile/apontar/${trimmed}`);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <Link href="/mobile" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </Link>
        <h1 className="text-base font-bold text-slate-900">Apontar via QR Code</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        {/* Ícone */}
        <div className="w-32 h-32 bg-orange-100 rounded-3xl flex items-center justify-center">
          <QrCode className="w-16 h-16 text-orange-500" />
        </div>

        {/* Instruções */}
        <div className="text-center space-y-2 max-w-xs">
          <h2 className="text-lg font-bold text-slate-900">Como usar</h2>
          <p className="text-sm text-slate-500">
            Cada subtarefa da OS possui um QR Code impresso na folha de serviço.
            Escaneie com a câmera do celular para iniciar, pausar ou finalizar o apontamento instantaneamente.
          </p>
        </div>

        {/* Alternativa: digitar ID */}
        <div className="w-full max-w-xs">
          <p className="text-xs font-semibold text-slate-500 mb-2 text-center uppercase tracking-wide">
            Ou digite o ID da subtarefa
          </p>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={id}
              onChange={e => setId(e.target.value)}
              placeholder="ID da subtarefa..."
              className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            />
            <button
              type="submit"
              disabled={!id.trim()}
              className="px-4 py-3 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-40 active:scale-95"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>

        {/* Dica de QR via câmera */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 max-w-xs w-full">
          <div className="flex items-start gap-3">
            <Scan className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              <strong>Dica:</strong> No Android e iOS, você pode escanear QR Codes diretamente pelo aplicativo de câmera nativo — sem precisar instalar apps adicionais.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
