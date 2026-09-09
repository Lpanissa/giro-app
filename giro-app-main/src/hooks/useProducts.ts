import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import { useAuth } from '@/lib/useAuth';
import type { Product } from '@/types';

export function useProducts() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = db.subscribeProducts((list) => {
      setProducts(list);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [user]);

  const createProduct = useCallback(async (input: Omit<Product, 'id' | 'created_at'>) => {
    try {
      await db.saveProduct(input);
      return null;
    } catch (e) {
      console.error('[useProducts] create:', e);
      return 'Erro ao salvar produto';
    }
  }, []);

  const updateProduct = useCallback(async (id: string, input: Partial<Omit<Product, 'id' | 'created_at'>>) => {
    try {
      await db.updateProduct(id, input);
      return null;
    } catch (e) {
      console.error('[useProducts] update:', e);
      return 'Erro ao atualizar produto';
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      await db.deleteProduct(id);
      return null;
    } catch (e) {
      console.error('[useProducts] delete:', e);
      return 'Erro ao excluir produto';
    }
  }, []);

  const adjustQuantity = useCallback(async (id: string, delta: number) => {
    try {
      await db.adjustProductQuantity(id, delta);
      return null;
    } catch (e) {
      console.error('[useProducts] adjust:', e);
      return 'Erro ao ajustar quantidade';
    }
  }, []);

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
