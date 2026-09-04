import { useCallback, useEffect, useMemo, useState } from 'react';
import * as db from '@/lib/storage';
import type { SupplierCycle, SupplierTransaction, SupplierTransactionType, WeekSummary } from '@/types';

function buildWeekSummary(transactions: SupplierTransaction[], cycleStart: Date): WeekSummary[] {
  const weeks = new Map<number, WeekSummary>();

  for (const tx of transactions) {
    const days = Math.floor(
      (new Date(tx.created_at).getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24),
    );
    const weekIndex = Math.max(0, Math.floor(days / 7));
    const existing = weeks.get(weekIndex) ?? {
      label: `Semana ${weekIndex + 1}`,
      totalPurchases: 0,
      totalPaid: 0,
    };
    if (tx.type === 'nota') existing.totalPurchases += tx.amount;
    else existing.totalPaid += tx.amount;
    weeks.set(weekIndex, existing);
  }

  return Array.from(weeks.keys())
    .sort((a, b) => a - b)
    .map((key) => weeks.get(key)!);
}

export function useSupplier() {
  const [transactions, setTransactions] = useState<SupplierTransaction[]>([]);
  const [lastCycle, setLastCycle] = useState<SupplierCycle | null>(null);
  const [cycles, setCycles] = useState<SupplierCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      const allCycles = db.getSupplierCycles();
      const latest = allCycles[0] ?? null;
      setCycles(allCycles);
      setLastCycle(latest);
      setTransactions(db.getSupplierTransactions(latest?.closed_at));
      setError(null);
    } catch (e) {
      console.error('[useSupplier] refresh:', e);
      setError('Erro ao carregar dados da fornecedora');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const totals = useMemo(() => {
    const totalPurchases = transactions
      .filter((tx) => tx.type === 'nota')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const totalPaid = transactions
      .filter((tx) => tx.type === 'pagamento')
      .reduce((sum, tx) => sum + tx.amount, 0);
    const previousBalance = lastCycle?.balance ?? 0;
    const currentDebit = Math.max(0, totalPurchases - totalPaid);
    const balance = previousBalance + (totalPaid - totalPurchases);
    const cycleStart = lastCycle
      ? new Date(lastCycle.closed_at)
      : transactions[0]
        ? new Date(transactions[0].created_at)
        : new Date();
    const weekSummary = buildWeekSummary(transactions, cycleStart);

    return { totalPurchases, totalPaid, previousBalance, currentDebit, balance, weekSummary };
  }, [transactions, lastCycle]);

  const addTransaction = useCallback(
    (type: SupplierTransactionType, amount: number, description: string) => {
      try {
        db.addSupplierTransaction(type, amount, description || null);
        refresh();
        return null;
      } catch (e) {
        console.error('[useSupplier] addTransaction:', e);
        return 'Erro ao salvar lançamento';
      }
    },
    [refresh],
  );

  const deleteTransaction = useCallback(
    (id: string) => {
      try {
        db.deleteSupplierTransaction(id);
        refresh();
        return null;
      } catch (e) {
        console.error('[useSupplier] deleteTransaction:', e);
        return 'Erro ao excluir lançamento';
      }
    },
    [refresh],
  );

  const closeCycle = useCallback(() => {
    try {
      db.closeSupplierCycle({
        previous_balance: totals.previousBalance,
        total_purchases: totals.totalPurchases,
        total_paid: totals.totalPaid,
        balance: totals.balance,
        week_summary: totals.weekSummary,
        closed_at: new Date().toISOString(),
      });
      refresh();
      return null;
    } catch (e) {
      console.error('[useSupplier] closeCycle:', e);
      return 'Erro ao fechar ciclo';
    }
  }, [totals, refresh]);

  const getMonthlyTotals = useCallback(
    (year: number, month: number) => db.getMonthlySupplierTotals(year, month),
    [],
  );

  return {
    transactions,
    cycles,
    lastCycle,
    loading,
    error,
    ...totals,
    addTransaction,
    deleteTransaction,
    closeCycle,
    getMonthlyTotals,
  };
}
