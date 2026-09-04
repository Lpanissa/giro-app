import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import type { DirectSale, SaleStatus } from '@/types';

export interface NewDirectSaleItem {
  product_id: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
}

export function useDirectSales() {
  const [sales, setSales] = useState<DirectSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.getDirectSales();
      setSales(data);
      setError(null);
    } catch (e) {
      console.error('[useDirectSales] refresh:', e);
      setError('Erro ao carregar vendas');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const registerMultiSale = useCallback(
    async (
      clientId: string | null,
      status: SaleStatus,
      items: NewDirectSaleItem[],
      dueDate?: string | null,
      saleDate?: string | null,
    ) => {
      try {
        let formattedDueDate = dueDate ? (dueDate.length === 10 ? `${dueDate}T12:00:00` : dueDate) : null;
        const formattedSaleDate = saleDate || null;
        
        await db.saveMultiDirectSale(clientId || null, status, items, formattedDueDate, formattedSaleDate);
        await refresh();
        return null;
      } catch (e) {
        console.error('[useDirectSales] register:', e);
        return 'Erro ao registrar venda';
      }
    },
    [refresh],
  );

  const updateSale = useCallback(
    async (id: string, updates: Parameters<typeof db.updateDirectSale>[1]) => {
      try {
        await db.updateDirectSale(id, updates);
        await refresh();
        return null;
      } catch (e) {
        console.error('[useDirectSales] update:', e);
        return 'Erro ao atualizar venda';
      }
    },
    [refresh],
  );

  const updateTransaction = useCallback(
    async (txId: string, updates: { client_id?: string | null; status?: SaleStatus; due_date?: string | null }) => {
      try {
        let payload = { ...updates };
        if (payload.due_date && payload.due_date.length === 10) {
          payload.due_date = `${payload.due_date}T12:00:00`;
        }
        await db.updateDirectSaleTransaction(txId, payload);
        await refresh();
        return null;
      } catch (e) {
        console.error('[useDirectSales] updateTransaction:', e);
        return 'Erro ao atualizar venda';
      }
    },
    [refresh],
  );

  const settleTransaction = useCallback(
    async (txId: string) => {
      try {
        await db.settleDirectSaleTransaction(txId);
        await refresh();
        return null;
      } catch (e) {
        console.error('[useDirectSales] settle:', e);
        return 'Erro ao dar baixa';
      }
    },
    [refresh],
  );

  const deleteTransaction = useCallback(
    async (txId: string) => {
      try {
        await db.deleteDirectSaleTransaction(txId);
        await refresh();
        return null;
      } catch (e) {
        console.error('[useDirectSales] deleteTransaction:', e);
        return 'Erro ao excluir venda';
      }
    },
    [refresh],
  );

  const deleteSale = useCallback(
    async (id: string) => {
      try {
        await db.deleteDirectSale(id);
        await refresh();
        return null;
      } catch (e) {
        console.error('[useDirectSales] delete:', e);
        return 'Erro ao excluir venda';
      }
    },
    [refresh],
  );

  return { sales, loading, error, refresh, registerMultiSale, updateSale, updateTransaction, settleTransaction, deleteTransaction, deleteSale };
}