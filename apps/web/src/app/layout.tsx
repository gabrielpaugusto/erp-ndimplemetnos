import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

// ─── Viewport (CRÍTICO para mobile) ───────────────────────────────────────────
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0f172a' },
    { media: '(prefers-color-scheme: dark)',  color: '#0f172a' },
  ],
};

// ─── Metadata ────────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: 'ND Implementos — ERP',
    template: '%s | ND Implementos',
  },
  description: 'Sistema ERP para Indústria de Implementos Rodoviários',
  applicationName: 'ND Implementos ERP',
  keywords: ['ERP', 'implementos rodoviários', 'gestão industrial'],
  authors: [{ name: 'ND Implementos' }],

  // ── PWA / Manifest ──
  manifest: '/manifest.webmanifest',

  // ── Apple iOS ──
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ND ERP',
    startupImage: [
      {
        url: '/apple-touch-icon.png',
        media: '(device-width: 390px) and (device-height: 844px)',
      },
    ],
  },

  // ── Ícones ──
  icons: {
    icon: [
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png',   sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png',   sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon-32.png',
  },

  // ── Open Graph (compartilhamento) ──
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    title: 'ND Implementos ERP',
    description: 'Sistema ERP para Indústria de Implementos Rodoviários',
  },

  // ── Comportamento mobile ──
  formatDetection: {
    telephone: false,   // evita que o iOS transforme números em links de ligação
    date: false,
    address: false,
    email: false,
    url: false,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
