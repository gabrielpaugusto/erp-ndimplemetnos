import { create } from 'zustand';
import { resolveModuleBasePath } from '@/lib/tab-title';

export interface Tab {
  id: string;
  path: string;
  title: string;
  closeable: boolean;
}

interface TabState {
  tabs: Tab[];
  activeTabId: string;
  openTab: (path: string, title: string) => void;
  closeTab: (id: string) => string | null; // retorna path para navegar, se necessário
  activateTab: (id: string) => void;
  openInNewWindow: (path: string) => void;
  updateActiveTitle: (title: string) => void;
}

const DASHBOARD_TAB: Tab = {
  id: 'tab-dashboard',
  path: '/dashboard',
  title: 'Dashboard',
  closeable: false,
};

export const useTabStore = create<TabState>((set, get) => ({
  tabs: [DASHBOARD_TAB],
  activeTabId: DASHBOARD_TAB.id,

  openTab: (path, title) => {
    const { tabs } = get();

    // 1. Aba com path exato já existe → apenas ativa
    const exactTab = tabs.find((t) => t.path === path);
    if (exactTab) {
      set({ activeTabId: exactTab.id });
      return;
    }

    // 2. Aba do mesmo módulo já existe → atualiza path/título (sem criar nova aba)
    //    Isso mantém uma aba por módulo e evita duplicatas ao navegar lista → detalhe → voltar
    const basePath = resolveModuleBasePath(path);
    const moduleTab = tabs.find((t) => resolveModuleBasePath(t.path) === basePath);
    if (moduleTab) {
      set({
        tabs: tabs.map((t) =>
          t.id === moduleTab.id ? { ...t, path, title } : t
        ),
        activeTabId: moduleTab.id,
      });
      return;
    }

    // 3. Módulo novo → cria nova aba
    const id = `tab-${Date.now()}`;
    set({
      tabs: [...tabs, { id, path, title, closeable: true }],
      activeTabId: id,
    });
  },

  closeTab: (id) => {
    const { tabs, activeTabId } = get();
    const tab = tabs.find((t) => t.id === id);
    if (!tab?.closeable || tabs.length <= 1) return null;

    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);

    let navigatePath: string | null = null;
    let newActiveId = activeTabId;

    if (activeTabId === id) {
      const newActive = newTabs[Math.max(0, idx - 1)];
      newActiveId = newActive.id;
      navigatePath = newActive.path;
    }

    set({ tabs: newTabs, activeTabId: newActiveId });
    return navigatePath;
  },

  activateTab: (id) => set({ activeTabId: id }),

  openInNewWindow: (path) => {
    if (typeof window !== 'undefined') {
      window.open(
        path,
        '_blank',
        'width=1400,height=900,menubar=no,toolbar=no,location=no,status=no'
      );
    }
  },

  updateActiveTitle: (title) => {
    const { tabs, activeTabId } = get();
    set({
      tabs: tabs.map((t) =>
        t.id === activeTabId ? { ...t, title } : t
      ),
    });
  },
}));
