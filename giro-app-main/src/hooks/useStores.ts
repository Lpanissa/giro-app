import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import type { Store } from '@/lib/storage';
import { useAuth } from '@/lib/useAuth';

const ACTIVE_STORE_KEY = 'giro_active_store_id';

export function useStores() {
  const { user } = useAuth();
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(() =>
    localStorage.getItem(ACTIVE_STORE_KEY)
  );

  useEffect(() => {
    if (!user) {
      setStores([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = db.subscribeStores((list) => {
      setStores(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const setActiveStoreId = useCallback((id: string) => {
    setActiveStoreIdState(id);
    localStorage.setItem(ACTIVE_STORE_KEY, id);
  }, []);

  // Se a loja salva não existir mais (ou nenhuma estiver selecionada ainda),
  // seleciona a primeira loja disponível automaticamente
  useEffect(() => {
    if (loading) return;
    if (stores.length === 0) {
      setActiveStoreIdState(null);
      return;
    }
    const stillExists = stores.some((s) => s.id === activeStoreId);
    if (!activeStoreId || !stillExists) {
      setActiveStoreId(stores[0].id);
    }
  }, [stores, loading, activeStoreId, setActiveStoreId]);

  const createStore = useCallback(
    async (input: { name: string; segment?: string }): Promise<{ id: string | null; error: string | null }> => {
      try {
        const id = await db.createStore(input);
        setActiveStoreId(id);
        return { id, error: null };
      } catch (e) {
        console.error('[useStores] create:', e);
        return { id: null, error: 'Erro ao criar loja' };
      }
    },
    [setActiveStoreId]
  );

  const renameStore = useCallback(async (id: string, name: string) => {
    try {
      await db.renameStore(id, name);
      return null;
    } catch (e) {
      console.error('[useStores] rename:', e);
      return 'Erro ao renomear loja';
    }
  }, []);

  const updateImage = useCallback(async (id: string, image: string | undefined) => {
    try {
      await db.updateStoreImage(id, image);
      return null;
    } catch (e) {
      console.error('[useStores] updateImage:', e);
      return 'Erro ao atualizar foto da loja';
    }
  }, []);

  const deleteStore = useCallback(async (id: string) => {
    try {
      await db.deleteStore(id);
      return null;
    } catch (e) {
      console.error('[useStores] delete:', e);
      return 'Erro ao excluir loja';
    }
  }, []);

  return {
    stores,
    loading,
    activeStoreId,
    setActiveStoreId,
    createStore,
    renameStore,
    updateImage,
    deleteStore,
  };
}
