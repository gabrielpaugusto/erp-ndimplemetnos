import dynamic from 'next/dynamic';

// Carrega o formulário apenas no cliente (sem SSR) para evitar
// conflito de hydration causado por extensões de browser (ex: KPM) que
// injetam elementos dentro dos campos de senha no DOM do cliente.
const LoginForm = dynamic(
  () => import('./login-form').then((m) => m.LoginForm),
  { ssr: false },
);

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-primary-900 to-slate-800">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNi0yLjY4NiA2LTZzLTIuNjg2LTYtNi02LTYgMi42ODYtNiA2IDIuNjg2IDYgNiA2em0wIDJjLTQuNDE4IDAtOC0zLjU4Mi04LThzMy41ODItOCA4LTggOCAzLjU4MiA4IDgtMy41ODIgOC04IDh6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />

      <div className="relative w-full max-w-md px-4">
        <LoginForm />

        <p className="text-center text-slate-400 text-xs mt-6">
          v0.4.0 — ND Implementos
        </p>
      </div>
    </div>
  );
}
