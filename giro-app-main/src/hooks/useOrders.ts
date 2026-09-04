import { useCallback, useEffect, useState } from 'react';
import * as db from '@/lib/storage';
import type { Order, OrderStatus, WeekDay } from '@/types';

export interface NewOrderItemInput {
  product_id: string | null;
  custom_name?: string | null;
  quantity: number;
  unit_price: number;
  unit_cost: number;
}

export interface NewOrderInput {
  client_id: string;
  day_of_week: WeekDay;
  status: OrderStatus;
  items: NewOrderItemInput[];
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    try {
      setOrders(db.getOrders());
      setError(null);
    } catch (e) {
      console.error('[useOrders] refresh:', e);
      setError('Erro ao carregar pedidos');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createOrder = useCallback(
    (input: NewOrderInput) => {
      if (input.items.length === 0) return 'Adicione ao menos um item ao pedido';
      try {
        db.createOrder(input.client_id, input.day_of_week, input.status, input.items);
        refresh();
        return null;
      } catch (e) {
        console.error('[useOrders] create:', e);
        return 'Erro ao salvar pedido';
      }
    },
    [refresh],
  );

  const updateOrder = useCallback(
    (id: string, updates: { client_id?: string; day_of_week?: WeekDay; status?: OrderStatus }) => {
      try {
        db.updateOrder(id, updates);
        refresh();
        return null;
      } catch (e) {
        console.error('[useOrders] update:', e);
        return 'Erro ao atualizar pedido';
      }
    },
    [refresh],
  );

  const updateOrderItem = useCallback(
    (itemId: string, updates: { product_id?: string | null; custom_name?: string | null; quantity?: number; unit_price?: number; unit_cost?: number }) => {
      try {
        db.updateOrderItem(itemId, updates);
        refresh();
        return null;
      } catch (e) {
        console.error('[useOrders] updateItem:', e);
        return 'Erro ao atualizar item';
      }
    },
    [refresh],
  );

  const deleteOrder = useCallback(
    (id: string) => {
      try {
        db.deleteOrder(id);
        refresh();
        return null;
      } catch (e) {
        console.error('[useOrders] delete:', e);
        return 'Erro ao excluir pedido';
      }
    },
    [refresh],
  );

  return { orders, loading, error, refresh, createOrder, updateOrder, updateOrderItem, deleteOrder };
}
