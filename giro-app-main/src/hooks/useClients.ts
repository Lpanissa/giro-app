import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import type { Client } from '@/types';

const CLIENTS_CHANGED_EVENT = 'app:clients_changed';

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      setClients(db.getClients());
      setError(null);
    } catch (e) {
      console.error('[useClients] refresh:', e);
      setError('Erro ao carregar clientes');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    // Escuta mudanças feitas por qualquer outra aba ou componente
    const handleClientsChange = () => refresh();
    window.addEventListener(CLIENTS_CHANGED_EVENT, handleClientsChange);

    return () => {
      window.removeEventListener(CLIENTS_CHANGED_EVENT, handleClientsChange);
    };
  }, [refresh]);

  const notifyChange = () => {
    window.dispatchEvent(new Event(CLIENTS_CHANGED_EVENT));
  };

  const createClient = useCallback(
    (input: Omit<Client, 'id' | 'created_at'>) => {
      try {
        db.saveClient(input);
        refresh();
        notifyChange(); // Notifica a aba de Rotas para atualizar na hora
        return null;
      } catch (e) {
        console.error('[useClients] create:', e);
        return 'Erro ao salvar cliente';
      }
    },
    [refresh],
  );

  const editClient = useCallback(
    (id: string, input: Partial<Omit<Client, 'id' | 'created_at'>>) => {
      try {
        db.updateClient(id, input);
        refresh();
        notifyChange();
        return null;
      } catch (e) {
        console.error('[useClients] update:', e);
        return 'Erro ao atualizar cliente';
      }
    },
    [refresh],
  );

  const deleteClient = useCallback(
    (id: string) => {
      try {
        db.deleteClient(id);
        refresh();
        notifyChange();
        return null;
      } catch (e) {
        console.error('[useClients] delete:', e);
        return 'Erro ao excluir cliente';
      }
    },
    [refresh],
  );

  return { clients, loading, error, refresh, createClient, editClient, deleteClient };
}
