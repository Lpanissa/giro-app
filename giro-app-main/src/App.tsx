import { useState, useEffect } from 'react';
import { AppHeader, type TabKey } from '@/components/layout/AppHeader';
import { ToastProvider, useToast } from '@/components/common/Toast';
import { InventoryPage } from '@/pages/InventoryPage';
import { MapPage } from '@/pages/MapPage';
import { ProfitPage } from '@/pages/ProfitPage';
import { CollectionsPage } from '@/pages/CollectionsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

const ALL_APP_KEYS: Record<string, string[]> = {
  products: ['cr_products', 'products'],
  clients: ['cr_clients', 'clients'],
  orders: ['cr_orders', 'orders'],
  orderItems: ['cr_order_items', 'orderItems'],
  directSales: ['cr_direct_sales', 'directSales'],
  supplierTx: ['cr_supplier_transactions', 'supplierTx'],
  supplierCycles: ['cr_supplier_cycles', 'supplierCycles'],
  companyNotes: ['cr_company_notes', 'companyNotes'],
  companyPayments: ['cr_company_payments', 'companyPayments'],
  clientReceipts: ['cr_client_receipts', 'clientReceipts'],
  dayCloses: ['cr_day_closes', 'dayCloses'],
  stockHistory: ['cr_stock_history', 'stockHistory'],
  charges: ['cr_charges', 'charges'],
};

function GlobalSyncManager() {
  const { notify } = useToast();

  const mergeArraysById = (localArray: any[], remoteArray: any[]) => {
    const map = new Map();
    const getItemKey = (item: any) => {
      if (!item) return null;
      return item.id || item.codigo || item.cpf || item.cnpj || item.nome || JSON.stringify(item);
    };

    [...(remoteArray || []), ...(localArray || [])].forEach((item) => {
      const key = getItemKey(item);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, item);
      } else {
        const existing = map.get(key);
        map.set(key, { ...existing, ...item });
      }
    });

    return Array.from(map.values());
  };

  const getSnapshotCounts = (data: any) => {
    return {
      orders: Array.isArray(data.orders) ? data.orders.length : 0,
      directSales: Array.isArray(data.directSales) ? data.directSales.length : 0,
      charges: Array.isArray(data.charges) ? data.charges.length : 0,
      clientReceipts: Array.isArray(data.clientReceipts) ? data.clientReceipts.length : 0,
    };
  };

  const applyRemoteDataToLocal = (remoteData: any) => {
    let oldCounts = { orders: 0, directSales: 0, charges: 0, clientReceipts: 0 };
    try {
      const prevOrders = JSON.parse(localStorage.getItem('cr_orders') || localStorage.getItem('orders') || '[]');
      const prevSales = JSON.parse(localStorage.getItem('cr_direct_sales') || localStorage.getItem('directSales') || '[]');
      const prevCharges = JSON.parse(localStorage.getItem('cr_charges') || localStorage.getItem('charges') || '[]');
      const prevReceipts = JSON.parse(localStorage.getItem('cr_client_receipts') || localStorage.getItem('clientReceipts') || '[]');
      oldCounts = {
        orders: Array.isArray(prevOrders) ? prevOrders.length : 0,
        directSales: Array.isArray(prevSales) ? prevSales.length : 0,
        charges: Array.isArray(prevCharges) ? prevCharges.length : 0,
        clientReceipts: Array.isArray(prevReceipts) ? prevReceipts.length : 0,
      };
    } catch (e) {}

    for (const [keyName, possibleStorageKeys] of Object.entries(ALL_APP_KEYS)) {
      const remoteValue = remoteData[keyName];
      if (remoteValue === undefined || remoteValue === null) continue;

      let localData: any = null;
      possibleStorageKeys.forEach((key) => {
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              localData = mergeArraysById(localData || [], parsed);
            } else if (parsed && typeof parsed === 'object') {
              localData = { ...(localData || {}), ...parsed };
            } else {
              localData = parsed;
            }
          } catch {
            localData = raw;
          }
        }
      });

      let mergedValue: any;
      if (Array.isArray(remoteValue)) {
        mergedValue = mergeArraysById(localData || [], remoteValue);
      } else if (typeof remoteValue === 'object' && remoteValue !== null) {
        mergedValue = { ...(localData || {}), ...remoteValue };
      } else {
        mergedValue = remoteValue;
      }

      possibleStorageKeys.forEach((key) => {
        localStorage.setItem(key, typeof mergedValue === 'object' ? JSON.stringify(mergedValue) : String(mergedValue));
      });
    }

    if (remoteData.lastUpdated) {
      localStorage.setItem('giro_last_sync_display', remoteData.lastUpdated);
    }

    const newCounts = getSnapshotCounts(remoteData);
    
    // Dispara notificações dinâmicas na tela atual do usuário
    if (newCounts.directSales > oldCounts.directSales) {
      notify('Nova venda registrada em outro aparelho!', 'success');
    } else if (newCounts.orders > oldCounts.orders) {
      notify('Novo pedido recebido na nuvem!', 'success');
    } else if (newCounts.clientReceipts > oldCounts.clientReceipts || newCounts.charges < oldCounts.charges) {
      notify('Pagamento recebido / Baixa efetuada!', 'success');
    }
  };

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Puxa dados iniciais ao abrir o app
        try {
          const docRef = doc(db, 'users', currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            applyRemoteDataToLocal(docSnap.data());
          }
        } catch (e) {}

        // Ativa o ouvinte global em tempo real independentemente da tela aberta
        const docRef = doc(db, 'users', currentUser.uid);
        let isInitialSnapshot = true;

        unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const remoteData = docSnap.data();
            const currentDisplay = localStorage.getItem('giro_last_sync_display');
            
            if (isInitialSnapshot) {
              isInitialSnapshot = false;
              return;
            }

            if (remoteData.lastUpdated && remoteData.lastUpdated !== currentDisplay) {
              applyRemoteDataToLocal(remoteData);
            }
          }
        });
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return null;
}

function App() {
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem('app_active_tab');
    return (saved as TabKey) || 'vendas';
  });

  const [settingsOpen, setSettingsOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_settings_open');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    const initApp = async () => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setIsLoading(false);
    };
    initApp();
  }, []);

  useEffect(() => {
    localStorage.setItem('app_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('app_settings_open', JSON.stringify(settingsOpen));
  }, [settingsOpen]);

  useEffect(() => {
    localStorage.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');
  }, []);

  return (
    <ToastProvider>
      <GlobalSyncManager />
      
      {isLoading && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black transition-opacity duration-300">
          <div className="flex h-44 w-44 items-center justify-center rounded-[48px] bg-black">
            <span className="text-4xl font-bold tracking-wider text-white">
              <span className="text-[#00e699]">G</span>iro
            </span>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-slate-50 text-slate-800 transition-colors">
        <AppHeader
          active={activeTab}
          onChange={setActiveTab}
          onOpenSettings={() => setSettingsOpen(true)}
        />

{/* espaçamento superior reduzido pois o painel de controle foi movido pra parte inferior */} 
        <main className="mx-auto w-full max-w-md md:max-w-4xl lg:max-w-6xl xl:max-w-7xl px-4 md:px-8 pb-10 pt-2 md:pt-4 transition-all duration-300">
          {activeTab === 'vendas' && <ProfitPage />}
          {activeTab === 'estoque' && <InventoryPage />}
          {activeTab === 'rotas' && <MapPage />}
          {activeTab === 'cobrancas' && <CollectionsPage />}
        </main>

        {settingsOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end">
            <div className="w-full max-w-md bg-slate-50 h-full overflow-y-auto p-5 shadow-xl animate-slide-left">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
                <h2 className="text-base font-semibold text-slate-800">Configurações</h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                >
                  ✕
                </button>
              </div>
              <SettingsPage />
            </div>
          </div>
        )}
      </div>
    </ToastProvider>
  );
}

export default App;
