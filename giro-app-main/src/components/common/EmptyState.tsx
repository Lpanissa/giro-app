import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message?: string;
}

export function EmptyState({ icon: Icon, title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-10 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
        <Icon size={22} className="text-slate-400" />
      </div>
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {message && <p className="mt-1 text-xs text-slate-400">{message}</p>}
    </div>
  );
}
