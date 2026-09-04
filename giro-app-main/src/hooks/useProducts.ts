import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import type { Product } from '@/types';

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      setProducts(db.getProducts());
      setError(null);
    } catch (e) {
      console.error('[useProducts] refresh:', e);
      setError('Erro ao carregar produtos');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProduct = useCallback(
    (input: Omit<Product, 'id' | 'created_at'>) => {
      try {
        db.saveProduct(input);
        refresh();
        return null;
      } catch (e) {
        console.error('[useProducts] create:', e);
        return 'Erro ao salvar produto';
      }
    },
    [refresh],
  );

  const updateProduct = useCallback(
    (id: string, input: Partial<Omit<Product, 'id' | 'created_at'>>) => {
      try {
        db.updateProduct(id, input);
        refresh();
        return null;
      } catch (e) {
        console.error('[useProducts] update:', e);
        return 'Erro ao atualizar produto';
      }
    },
    [refresh],
  );

  const deleteProduct = useCallback(
    (id: string) => {
      try {
        db.deleteProduct(id);
        refresh();
        return null;
      } catch (e) {
        console.error('[useProducts] delete:', e);
        return 'Erro ao excluir produto';
      }
    },
    [refresh],
  );

  const adjustQuantity = useCallback(
    (id: string, delta: number) => {
      try {
        db.adjustProductQuantity(id, delta);
        refresh();
        return null;
      } catch (e) {
        console.error('[useProducts] adjust:', e);
        return 'Erro ao ajustar quantidade';
      }
    },
    [refresh],
  );

  return {
    products,
    loading,
    error,
    refresh,
    createProduct,
    updateProduct,
    deleteProduct,
    adjustQuantity,
  };
}
