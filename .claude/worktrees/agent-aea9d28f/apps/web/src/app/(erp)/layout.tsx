'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AiChat } from '@/components/layout/ai-chat';
import { CommandPalette } from '@/components/layout/command-palette';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';

export default function ErpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const aiChatOpen = useUiStore((s) => s.aiChatOpen);

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main area */}
      <div
        className={cn(
          'flex-1 flex flex-col min-w-0 transition-all duration-300',
          sidebarOpen ? 'ml-64' : 'ml-16'
        )}
      >
        <Header />

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* AI Chat panel */}
      <AiChat />

      {/* Global Command Palette (Ctrl+K) */}
      <CommandPalette />
    </div>
  );
}
