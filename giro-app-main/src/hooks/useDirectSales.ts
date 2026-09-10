import { useCallback, useEffect, useMemo, useState } from 'react';
import * as db from '@/lib/storage';
import { useAuth } from '@/lib/useAuth';
import { useActiveStore } from '@/lib/StoreContext';
import { useProducts } from './useProducts';
import { useClients } from './useClients';
import type { DirectSale, SaleStatus } from '@/types';

export interface NewDirectSaleItem {
  product_id: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
}

export function useDirectSales() {
  const { user } = useAuth();
  const { activeStoreId } = useActiveStore();
  const { products } = useProducts();
  const { clients } = useClients();
  const [rawSales, setRawSales] = useState<DirectSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !activeStoreId) {
      setRawSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = db.subscribeDirectSales(activeStoreId, (list) => {
      setRawSales(list);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [user, activeStoreId]);

  const sales = useMemo(() => {
    return rawSales.map((sale) => ({
      ...sale,
      product: products.find((p) => p.id === sale.product_id) ?? null,
      client: clients.find((c) => c.id === sale.client_id) ?? null,
    }));
  }, [rawSales, products, clients]);

  const registerMultiSale = useCallback(
    async (
      clientId: string | null,
      status: SaleStatus,
      items: NewDirectSaleItem[],
      dueDate?: string | null,
      saleDate?: string | null,
    ) => {
      if (!activeStoreId) return 'Nenhuma loja selecionada';
      try {
        const formattedDueDate = dueDate ? (dueDate.length === 10 ? `${dueDate}T12:00:00` : dueDate) : null;
        const formattedSaleDate = saleDate || null;

        await db.saveMultiDirectSale(activeStoreId, clientId || null, status, items, formattedDueDate, formattedSaleDate);
        return null;
      } catch (e) {
        console.error('[useDirectSales] register:', e);
        return 'Erro ao registrar venda';
      }
    },
    [activeStoreId],
  );

  const updateSale = useCallback(async (id: string, updates: Parameters<typeof db.updateDirectSale>[2]) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.updateDirectSale(activeStoreId, id, updates);
      return null;
    } catch (e) {
      console.error('[useDirectSales] update:', e);
      return 'Erro ao atualizar venda';
    }
  }, [activeStoreId]);

  const updateTransaction = useCallback(
    async (txId: string, updates: { client_id?: string | null; status?: SaleStatus; due_date?: string | null }) => {
      if (!activeStoreId) return 'Nenhuma loja selecionada';
      try {
        const payload = { ...updates };
        if (payload.due_date && payload.due_date.length === 10) {
          payload.due_date = `${payload.due_date}T12:00:00`;
        }
        await db.updateDirectSaleTransaction(activeStoreId, txId, payload);
        return null;
      } catch (e) {
        console.error('[useDirectSales] updateTransaction:', e);
        return 'Erro ao atualizar venda';
      }
    },
    [activeStoreId],
  );

  const settleTransaction = useCallback(async (txId: string) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.settleDirectSaleTransaction(activeStoreId, txId);
      return null;
    } catch (e) {
      console.error('[useDirectSales] settle:', e);
      return 'Erro ao dar baixa';
    }
  }, [activeStoreId]);

  const deleteTransaction = useCallback(async (txId: string) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.deleteDirectSaleTransaction(activeStoreId, txId);
      return null;
    } catch (e) {
      console.error('[useDirectSales] deleteTransaction:', e);
      return 'Erro ao excluir venda';
    }
  }, [activeStoreId]);

  const deleteSale = useCallback(async (id: string) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.deleteDirectSale(activeStoreId, id);
      return null;
    } catch (e) {
      console.error('[useDirectSales] delete:', e);
      return 'Erro ao excluir venda';
    }
  }, [activeStoreId]);

  return {
    sales,
    loading,
    error,
    registerMultiSale,
    updateSale,
    updateTransaction,
    settleTransaction,
    deleteTransaction,
    deleteSale,
  };
}
