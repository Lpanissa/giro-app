import { createContext, useContext, type ReactNode } from 'react';
import { useStores } from '@/hooks/useStores';

type StoreContextValue = ReturnType<typeof useStores>;

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStores();
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useActiveStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useActiveStore precisa ser usado dentro de um StoreProvider');
  }
  return ctx;
}
