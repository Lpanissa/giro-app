import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import type { StockRestock } from '@/lib/storage';
import { useAuth } from '@/lib/useAuth';
import { useActiveStore } from '@/lib/StoreContext';
import type { Product } from '@/types';

export function useProducts() {
  const { user } = useAuth();
  const { activeStoreId } = useActiveStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [restocks, setRestocks] = useState<StockRestock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !activeStoreId) {
      setProducts([]);
      setRestocks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribeProducts = db.subscribeProducts(activeStoreId, (list) => {
      setProducts(list);
      setLoading(false);
      setError(null);
    });
    const unsubscribeRestocks = db.subscribeStockRestocks(activeStoreId, (list) => {
      setRestocks(list);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeRestocks();
    };
  }, [user, activeStoreId]);

  const createProduct = useCallback(async (input: Omit<Product, 'id' | 'created_at'>) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.saveProduct(activeStoreId, input);
      return null;
    } catch (e) {
      console.error('[useProducts] create:', e);
      return 'Erro ao salvar produto';
    }
  }, [activeStoreId]);

  const updateProduct = useCallback(async (id: string, input: Partial<Omit<Product, 'id' | 'created_at'>>) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.updateProduct(activeStoreId, id, input);
      return null;
    } catch (e) {
      console.error('[useProducts] update:', e);
      return 'Erro ao atualizar produto';
    }
  }, [activeStoreId]);

  const deleteProduct = useCallback(async (id: string) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.deleteProduct(activeStoreId, id);
      return null;
    } catch (e) {
      console.error('[useProducts] delete:', e);
      return 'Erro ao excluir produto';
    }
  }, [activeStoreId]);

  // Ajusta a quantidade e grava um registro de reposição (data + quantidade),
  // usado no popup de detalhes para mostrar a última reposição e o total do mês.
  const adjustQuantity = useCallback(async (id: string, delta: number) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.addProductRestock(activeStoreId, id, delta);
      return null;
    } catch (e) {
      console.error('[useProducts] adjust:', e);
      return 'Erro ao ajustar quantidade';
    }
  }, [activeStoreId]);

  return {
    products,
    restocks,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustQuantity,
  };
}
