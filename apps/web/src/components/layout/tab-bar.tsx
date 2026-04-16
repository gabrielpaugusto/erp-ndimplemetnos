'use client';

import { useRouter } from 'next/navigation';
import { X, ExternalLink, Plus } from 'lucide-react';
import { useTabStore, type Tab } from '@/stores/tab-store';
import { cn } from '@/lib/utils';

export function TabBar() {
  const router = useRouter();
  const { tabs, activeTabId, closeTab, activateTab, openInNewWindow } = useTabStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleActivate = (tab: Tab) => {
    activateTab(tab.id);
    router.push(tab.path);
  };

  const handleClose = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const navigatePath = closeTab(id);
    if (navigatePath) router.push(navigatePath);
  };

  const handleMiddleClick = (e: React.MouseEvent, tab: Tab) => {
    if (e.button === 1) {
      e.preventDefault();
      const navigatePath = closeTab(tab.id);
      if (navigatePath) router.push(navigatePath);
    }
  };

  return (
    <div className="flex items-center bg-slate-100 border-b border-slate-200 h-9 shrink-0 overflow-x-auto scrollbar-none">
      {/* Abas */}
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            onClick={() => handleActivate(tab)}
            onMouseDown={(e) => handleMiddleClick(e, tab)}
            title={tab.title}
            className={cn(
              'group relative flex items-center gap-1.5 px-3 h-full max-w-[200px] min-w-[80px] border-r border-slate-200 cursor-pointer select-none shrink-0 transition-colors',
              isActive
                ? 'bg-white text-slate-800 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-blue-500'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            )}
          >
            <span className="text-[11px] font-medium truncate flex-1 leading-none">
              {tab.title}
            </span>

            {tab.closeable ? (
              <button
                onClick={(e) => handleClose(e, tab.id)}
                className={cn(
                  'w-4 h-4 rounded flex items-center justify-center shrink-0 transition-all',
                  isActive
                    ? 'opacity-0 group-hover:opacity-100 hover:bg-slate-200 text-slate-500'
                    : 'opacity-0 group-hover:opacity-100 hover:bg-slate-300 text-slate-400'
                )}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            ) : (
              /* placeholder para manter altura consistente */
              <span className="w-4 shrink-0" />
            )}
          </div>
        );
      })}

      {/* Botão nova aba — abre Dashboard em nova aba */}
      <button
        onClick={() => {
          router.push('/dashboard');
        }}
        className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors shrink-0 border-r border-slate-200"
        title="Nova aba (Dashboard)"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>

      {/* Espaço flex */}
      <div className="flex-1" />

      {/* Pop-out — abre aba atual em nova janela do navegador */}
      {activeTab && (
        <button
          onClick={() => openInNewWindow(activeTab.path)}
          className="w-8 h-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors shrink-0 border-l border-slate-200"
          title={`Abrir "${activeTab.title}" em nova janela`}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
