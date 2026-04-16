import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  aiChatOpen: boolean;
  toggleSidebar: () => void;
  toggleAiChat: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: true,
  aiChatOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleAiChat: () => set((state) => ({ aiChatOpen: !state.aiChatOpen })),
}));
