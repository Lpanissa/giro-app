import { useCallback, useEffect, useMemo, useState } from 'react';
import * as db from '@/lib/storage';
import { useAuth } from '@/lib/useAuth';
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
  const { products } = useProducts();
  const { clients } = useClients();
  const [rawSales, setRawSales] = useState<DirectSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRawSales([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = db.subscribeDirectSales((list) => {
      setRawSales(list);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [user]);

  // Junta cada venda com o produto e o cliente correspondentes, usando os dados já disponíveis
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
      try {
        const formattedDueDate = dueDate ? (dueDate.length === 10 ? `${dueDate}T12:00:00` : dueDate) : null;
        const formattedSaleDate = saleDate || null;

        await db.saveMultiDirectSale(clientId || null, status, items, formattedDueDate, formattedSaleDate);
        return null;
      } catch (e) {
        console.error('[useDirectSales] register:', e);
        return 'Erro ao registrar venda';
      }
    },
    [],
  );

  const updateSale = useCallback(async (id: string, updates: Parameters<typeof db.updateDirectSale>[1]) => {
    try {
      await db.updateDirectSale(id, updates);
      return null;
    } catch (e) {
      console.error('[useDirectSales] update:', e);
      return 'Erro ao atualizar venda';
    }
  }, []);

  const updateTransaction = useCallback(
    async (txId: string, updates: { client_id?: string | null; status?: SaleStatus; due_date?: string | null }) => {
      try {
        const payload = { ...updates };
        if (payload.due_date && payload.due_date.length === 10) {
          payload.due_date = `${payload.due_date}T12:00:00`;
        }
        await db.updateDirectSaleTransaction(txId, payload);
        return null;
      } catch (e) {
        console.error('[useDirectSales] updateTransaction:', e);
        return 'Erro ao atualizar venda';
      }
    },
    [],
  );

  const settleTransaction = useCallback(async (txId: string) => {
    try {
      await db.settleDirectSaleTransaction(txId);
      return null;
    } catch (e) {
      console.error('[useDirectSales] settle:', e);
      return 'Erro ao dar baixa';
    }
  }, []);

  const deleteTransaction = useCallback(async (txId: string) => {
    try {
      await db.deleteDirectSaleTransaction(txId);
      return null;
    } catch (e) {
      console.error('[useDirectSales] deleteTransaction:', e);
      return 'Erro ao excluir venda';
    }
  }, []);

  const deleteSale = useCallback(async (id: string) => {
    try {
      await db.deleteDirectSale(id);
      return null;
    } catch (e) {
      console.error('[useDirectSales] delete:', e);
      return 'Erro ao excluir venda';
    }
  }, []);

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
