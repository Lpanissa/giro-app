import { CreditCard, FileText, Scale } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

interface SupplierSummaryCardsProps {
  totalPurchases: number;
  totalPaid: number;
  balance: number;
  currentDebit: number;
}

export function SupplierSummaryCards({
  totalPurchases,
  totalPaid,
  balance,
  currentDebit,
}: SupplierSummaryCardsProps) {
  return (
    <div className="space-y-3">
      <div className="rounded-3xl bg-emerald-800 px-5 py-6 shadow-lg shadow-emerald-800/20">
        <div className="flex items-center gap-1.5 text-emerald-200">
          <FileText size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">
            Total Compras (A)
          </span>
        </div>
        <p className="mt-2 font-serif text-3xl font-semibold text-white">
          {formatCurrency(totalPurchases)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
          <div className="flex items-center gap-1.5 text-slate-500">
            <CreditCard size={13} />
            <span className="text-[10px] font-semibold uppercase tracking-wide">
              Pago à Empresa (C)
            </span>
          </div>
          <p className="mt-2 text-xl font-semibold text-slate-800">{formatCurrency(totalPaid)}</p>
        </div>

        <div className="rounded-2xl bg-red-500 px-4 py-4 shadow-sm shadow-red-500/20">
          <div className="flex items-center gap-1.5 text-red-100">
            <Scale size={13} />
            <span className="text-[10px] font-semibold uppercase tracking-wide">Saldo / Débito</span>
          </div>
          <p className="mt-2 text-xl font-semibold text-white">
            {balance < 0 ? '- ' : ''}
            {formatCurrency(Math.abs(balance))}
          </p>
          {currentDebit > 0 && (
            <p className="mt-0.5 text-[11px] font-medium text-red-100">
              Débito: {formatCurrency(currentDebit)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
