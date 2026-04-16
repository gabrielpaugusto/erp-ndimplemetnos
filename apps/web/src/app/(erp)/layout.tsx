'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { TabBar } from '@/components/layout/tab-bar';
import { AiChat } from '@/components/layout/ai-chat';
import { CommandPalette } from '@/components/layout/command-palette';
import { ToastProvider } from '@/components/ui/toast';
import { useUiStore } from '@/stores/ui-store';
import { useTabStore } from '@/stores/tab-store';
import { resolveTabTitle } from '@/lib/tab-title';
import { cn } from '@/lib/utils';

// Tipos de input que NÃO devem ser convertidos para maiúsculo
const SKIP_TYPES = new Set([
  'password', 'email', 'number', 'tel', 'url',
  'date', 'time', 'datetime-local', 'month', 'week',
  'color', 'range', 'file', 'checkbox', 'radio', 'hidden', 'search',
]);

export default function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const { openTab } = useTabStore();
  const pathname = usePathname();
  const router = useRouter();

  // Sincroniza a rota atual com o sistema de abas
  useEffect(() => {
    if (!pathname) return;
    const title = resolveTabTitle(pathname);
    openTab(pathname, title);
  }, [pathname, openTab]);

  // BroadcastChannel — sincroniza logout entre janelas
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const bc = new BroadcastChannel('erp-sync');
    bc.onmessage = (e) => {
      if (e.data?.type === 'LOGOUT') {
        router.push('/login');
      }
    };
    return () => bc.close();
  }, [router]);

  // Converte o valor real (não só visual) de todos os inputs para maiúsculo
  useEffect(() => {
    const inputSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const textareaSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;

    const handler = (e: Event) => {
      const target = e.target as HTMLInputElement | HTMLTextAreaElement;
      if (!target) return;

      const tag = target.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;

      // Pula tipos que não devem ser maiúsculos
      if (tag === 'INPUT' && SKIP_TYPES.has((target as HTMLInputElement).type)) return;

      // Pula se o input tem atributo data-no-upper
      if (target.dataset.noUpper !== undefined) return;

      const upper = target.value.toUpperCase();
      if (target.value === upper) return;

      // Preserva posição do cursor
      const start = (target as HTMLInputElement).selectionStart;
      const end = (target as HTMLInputElement).selectionEnd;

      // Usa o setter nativo para que o React detecte a mudança
      if (tag === 'INPUT') {
        inputSetter?.call(target, upper);
      } else {
        textareaSetter?.call(target, upper);
      }

      // Dispara evento nativo para o React atualizar o estado controlado
      target.dispatchEvent(new Event('input', { bubbles: true }));

      // Restaura posição do cursor
      if (start !== null && end !== null) {
        (target as HTMLInputElement).setSelectionRange(start, end);
      }
    };

    document.addEventListener('input', handler, true);
    return () => document.removeEventListener('input', handler, true);
  }, []);

  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <ToastProvider>
      <div className="h-screen flex overflow-hidden bg-slate-50">
        {/* Sidebar */}
        <Sidebar />

        {/* Mobile backdrop — fecha sidebar ao clicar fora */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 md:hidden"
            onClick={toggleSidebar}
            aria-hidden="true"
          />
        )}

        {/* Main area */}
        <div
          className={cn(
            'flex-1 flex flex-col min-w-0 transition-all duration-300',
            // Mobile: conteúdo sempre em tela cheia (sidebar é overlay)
            // Desktop: conteúdo desloca conforme sidebar
            sidebarOpen ? 'ml-0 md:ml-64' : 'ml-0 md:ml-16'
          )}
        >
          <Header />

          {/* Barra de abas */}
          <TabBar />

          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>

        {/* AI Chat panel */}
        <AiChat />

        {/* Global Command Palette (Ctrl+K) */}
        <CommandPalette />
      </div>
    </ToastProvider>
  );
}
