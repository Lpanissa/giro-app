import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import { useAuth } from '@/lib/useAuth';
import { useActiveStore } from '@/lib/StoreContext';
import type { Client } from '@/types';

export function useClients() {
  const { user } = useAuth();
  const { activeStoreId } = useActiveStore();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !activeStoreId) {
      setClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = db.subscribeClients(activeStoreId, (list) => {
      setClients(list);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [user, activeStoreId]);

  const createClient = useCallback(async (input: Omit<Client, 'id' | 'created_at'>): Promise<{ id: string | null; error: string | null }> => {
    if (!activeStoreId) return { id: null, error: 'Nenhuma loja selecionada' };
    try {
      const id = await db.saveClient(activeStoreId, input);
      return { id, error: null };
    } catch (e) {
      console.error('[useClients] create:', e);
      return { id: null, error: 'Erro ao salvar cliente' };
    }
  }, [activeStoreId]);

  const editClient = useCallback(async (id: string, input: Partial<Omit<Client, 'id' | 'created_at'>>) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.updateClient(activeStoreId, id, input);
      return null;
    } catch (e) {
      console.error('[useClients] update:', e);
      return 'Erro ao atualizar cliente';
    }
  }, [activeStoreId]);

  const deleteClient = useCallback(async (id: string) => {
    if (!activeStoreId) return 'Nenhuma loja selecionada';
    try {
      await db.deleteClient(activeStoreId, id);
      return null;
    } catch (e) {
      console.error('[useClients] delete:', e);
      return 'Erro ao excluir cliente';
    }
  }, [activeStoreId]);

  return { clients, loading, error, createClient, editClient, deleteClient };
}
