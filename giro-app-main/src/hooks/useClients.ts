import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import { useAuth } from '@/lib/useAuth';
import type { Client } from '@/types';

export function useClients() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setClients([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = db.subscribeClients((list) => {
      setClients(list);
      setLoading(false);
      setError(null);
    });

    return () => unsubscribe();
  }, [user]);

  // Retorna o ID do novo cliente em caso de sucesso, ou uma mensagem de erro
  const createClient = useCallback(async (input: Omit<Client, 'id' | 'created_at'>): Promise<{ id: string | null; error: string | null }> => {
    try {
      const id = await db.saveClient(input);
      return { id, error: null };
    } catch (e) {
      console.error('[useClients] create:', e);
      return { id: null, error: 'Erro ao salvar cliente' };
    }
  }, []);

  const editClient = useCallback(async (id: string, input: Partial<Omit<Client, 'id' | 'created_at'>>) => {
    try {
      await db.updateClient(id, input);
      return null;
    } catch (e) {
      console.error('[useClients] update:', e);
      return 'Erro ao atualizar cliente';
    }
  }, []);

  const deleteClient = useCallback(async (id: string) => {
    try {
      await db.deleteClient(id);
      return null;
    } catch (e) {
      console.error('[useClients] delete:', e);
      return 'Erro ao excluir cliente';
    }
  }, []);

  return { clients, loading, error, createClient, editClient, deleteClient };
}
