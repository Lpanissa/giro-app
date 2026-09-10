import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import { useAuth } from '@/lib/useAuth';
import { useActiveStore } from '@/lib/StoreContext';
import type { Product } from '@/types';

export function useProducts() {
  const { user } = useAuth();
  const { activeStoreId } = useActiveStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !activeStoreId) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = db.subscribeProducts(activeStoreId, (list) => {
      setProducts(list);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
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

  const adjustQuantity = useCallback(async (id: string, delta: number) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.adjustProductQuantity(activeStoreId, id, delta);
      return null;
    } catch (e) {
      console.error('[useProducts] adjust:', e);
      return 'Erro ao ajustar quantidade';
    }
  }, [activeStoreId]);

  return {
    products,
    loading,
    error,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustQuantity,
  };
}
