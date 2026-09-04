import { useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Calendar, ShoppingBag, Search, X } from 'lucide-react';
import { useDirectSales } from '@/hooks/useDirectSales';
import { useClients } from '@/hooks/useClients';
import { useToast } from '@/components/common/Toast';
import { EmptyState } from '@/components/common/EmptyState';
import { formatCurrency, formatDate } from '@/utils/format';
import type { DirectSale, SaleStatus } from '@/types';

interface GroupedCollection {
  transactionId: string;
  clientId: string | null;
  clientName: string;
  status: SaleStatus;
  sales: DirectSale[];
  total: number;
  paidAmount: number;
  createdAt: string;
  paidAt: string | null;
  dueDate: string | null;
}

export function CollectionsPage() {
  const { sales, updateTransaction } = useDirectSales();
  const { clients } = useClients();
  const { notify } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<GroupedCollection | null>(null);

  // Estados do Modal de Pagamento (Parcial ou Total)
  const [paymentType, setPaymentType] = useState<'total' | 'partial'>('total');
  const [partialValue, setPartialValue] = useState('');

  const groupedCollections = useMemo(() => {
    const map = new Map<string, GroupedCollection>();
    for (const sale of sales) {
      if (sale.status !== 'Pendente') continue;

      const txId = sale.transaction_id;
      const client = clients.find((c) => c.id === sale.client_id);
      const clientName = client?.name ?? sale.client?.name ?? 'Venda direta';

      if (!map.has(txId)) {
        map.set(txId, {
          transactionId: txId,
          clientId: sale.client_id,
          clientName,
          status: sale.status,
          sales: [],
          total: 0,
          paidAmount: sale.paid_amount ?? 0,
          createdAt: sale.created_at,
          paidAt: sale.paid_at,
          dueDate: sale.due_date,
        });
      }
      const group = map.get(txId)!;
      group.sales.push(sale);
      group.total += sale.unit_price * sale.quantity;
    }
    return Array.from(map.values()).filter(group => {
      const currentPaid = group.paidAmount || 0;
      return currentPaid < group.total;
    });
  }, [sales, clients]);

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return groupedCollections;
    const q = searchQuery.toLowerCase();
    return groupedCollections.filter((group) => {
      const matchClient = group.clientName.toLowerCase().includes(q);
      const matchProducts = group.sales.some((s) => s.product?.name?.toLowerCase().includes(q));
      return matchClient || matchProducts;
    });
  }, [groupedCollections, searchQuery]);

  const totalPendingAmount = useMemo(() => {
    return groupedCollections.reduce((sum, item) => sum + (item.total - (item.paidAmount || 0)), 0);
  }, [groupedCollections]);

  const handleConfirmPayment = () => {
    if (!selectedGroup) return;

    const currentDate = new Date().toISOString();
    const currentPaid = selectedGroup.paidAmount || 0;
    
    let newPaidAmount = currentPaid;
    let isFullyPaid = false;

    if (paymentType === 'total') {
      newPaidAmount = selectedGroup.total;
      isFullyPaid = true;
    } else {
      const parsedPartial = parseFloat(partialValue.replace(',', '.')) || 0;
      if (parsedPartial <= 0) {
        notify('Digite um valor válido para o pagamento parcial.', 'error');
        return;
      }
      newPaidAmount = currentPaid + parsedPartial;
      if (newPaidAmount >= selectedGroup.total) {
        newPaidAmount = selectedGroup.total;
        isFullyPaid = true;
      }
    }

    const err = updateTransaction(selectedGroup.transactionId, {
      status: isFullyPaid ? 'Pago' : 'Pendente',
      paid_at: isFullyPaid ? currentDate : null,
      paid_amount: newPaidAmount,
    } as any);

    if (err) {
      notify(err, 'error');
    } else {
      if (isFullyPaid) {
        notify('Cobrança recebida e removida das pendências!', 'success');
      } else {
        notify(`Pagamento parcial de ${formatCurrency(newPaidAmount - currentPaid)} registrado com sucesso!`, 'success');
      }
    }

    setSelectedGroup(null);
    setPaymentType('total');
    setPartialValue('');
  };

  return (
    <div className="space-y-5 pt-8">
      <div className="rounded-3xl bg-amber-500 px-5 py-6 shadow-lg shadow-amber-500/25">
        <div className="flex items-center gap-1.5 text-amber-50">
          <AlertCircle size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-wide">Total a receber</span>
        </div>
        <p className="mt-2 text-3xl font-semibold text-white">{formatCurrency(totalPendingAmount)}</p>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Pendentes</h2>
        </div>

        {/* Campo de pesquisa estilo Estoque */}
        <div className="relative mb-3">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Pesquisar cobranças, clientes ou produtos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-slate-300 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {filteredCollections.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nenhuma cobrança pendente"
            message="Todas as vendas estão quitadas ou correspondem à busca!"
          />
        ) : (
          <ul className="space-y-3">
            {filteredCollections.map((group) => {
              const remainingAmount = group.total - (group.paidAmount || 0);
              const hasPartial = (group.paidAmount || 0) > 0;

              return (
              <li
                key={group.transactionId}
                className="rounded-2xl border border-amber-100/60 bg-white p-4 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-slate-800">{group.clientName}</p>
                    {hasPartial && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Pago parcial: <span className="text-emerald-600 font-medium">{formatCurrency(group.paidAmount)}</span> de {formatCurrency(group.total)}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-base font-semibold text-amber-700">
                      {formatCurrency(remainingAmount)}
                    </span>
                    {hasPartial && <span className="block text-[10px] text-slate-400 line-through">{formatCurrency(group.total)}</span>}
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {group.sales.map((sale) => (
                    <span
                      key={sale.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                    >
                      <ShoppingBag size={12} />
                      {sale.product?.name ?? 'Produto'} x{sale.quantity}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  {(() => {
                    if (!group.dueDate) {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <Calendar size={13} /> Vence em breve
                        </span>
                      );
                    }

                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // Trata a string da data isolando ano, mês e dia para evitar divergência de fuso horário
                    const [year, month, day] = group.dueDate.split('T')[0].split('-').map(Number);
                    const due = new Date(year, month - 1, day);
                    due.setHours(0, 0, 0, 0);

                    const diffTime = due.getTime() - today.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                    if (diffDays === 0) {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                          <Calendar size={13} /> Vence hoje
                        </span>
                      );
                    } else if (diffDays < 0) {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                          <Calendar size={13} /> Venceu dia {formatDate(group.dueDate)}
                        </span>
                      );
                    } else {
                      return (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                          <Calendar size={13} /> Vence dia {formatDate(group.dueDate)}
                        </span>
                      );
                    }
                  })()}
                  
                  <button
                    onClick={() => {
                      setSelectedGroup(group);
                      setPaymentType('total');
                      setPartialValue('');
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition active:scale-[0.98]"
                  >
                    <CheckCircle2 size={14} /> Recebido
                  </button>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Modal customizado para escolher entre Valor Total ou Parcial */}
      {selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-800">Registrar Recebimento</h3>
              <button 
                onClick={() => setSelectedGroup(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-sm text-slate-600">
              Cliente: <strong className="text-slate-800">{selectedGroup.clientName}</strong>
              <div className="mt-1">
                Restante a pagar: <strong className="text-amber-600">{formatCurrency(selectedGroup.total - (selectedGroup.paidAmount || 0))}</strong>
              </div>
            </div>

            {/* Seletor do Tipo de Pagamento */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPaymentType('total')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition border ${
                  paymentType === 'total' 
                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Valor Total
              </button>
              <button
                type="button"
                onClick={() => setPaymentType('partial')}
                className={`py-2.5 px-3 rounded-xl text-xs font-semibold transition border ${
                  paymentType === 'partial' 
                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Valor Parcial
              </button>
            </div>

            {/* Input para Valor Parcial */}
            {paymentType === 'partial' && (
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-medium text-slate-700">Quanto foi pago?</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={partialValue}
                    onChange={(e) => setPartialValue(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 focus:border-slate-400 focus:outline-none"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  O valor será abatido e a cobrança continuará pendente até quitar tudo.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedGroup(null)}
                className="flex-1 rounded-xl bg-slate-100 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-600 shadow-sm"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
