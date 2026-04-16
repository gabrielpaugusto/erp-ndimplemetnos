import Link from 'next/link';
import { LucideIcon, Plus } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  /** Use quando filtros estão ativos — troca a mensagem e oculta o CTA */
  filtered?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
  filtered = false,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">
        {filtered ? 'Nenhum resultado encontrado' : title}
      </h3>
      <p className="text-sm text-slate-500 max-w-sm">
        {filtered
          ? 'Tente ajustar ou limpar os filtros para ver mais registros.'
          : description}
      </p>
      {!filtered && actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </Link>
      )}
    </div>
  );
}

/** Versão para uso dentro de <tbody> com colspan */
export function EmptyStateRow({
  colSpan,
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  filtered = false,
}: EmptyStateProps & { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan}>
        <EmptyState
          icon={icon}
          title={title}
          description={description}
          actionLabel={actionLabel}
          actionHref={actionHref}
          filtered={filtered}
        />
      </td>
    </tr>
  );
}
