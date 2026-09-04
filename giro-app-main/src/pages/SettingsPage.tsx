import { useState, useEffect } from 'react';
import { Cloud, CheckCircle2, ShieldCheck, Database, LogOut, Mail, Sliders, RefreshCw, Info } from 'lucide-react';
import { useToast } from '@/components/common/Toast';
import { auth, db, googleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// Versão atual do aplicativo
const CURRENT_APP_VERSION = '1.2.1';

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

export function SettingsPage() {
  const { notify } = useToast();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<string | null>(() => {
    const saved = localStorage.getItem('giro_last_sync_display');
    if (!saved) return null;
    // Se a string salva for no formato ISO antigo, converte para legível, senão exibe como está
    if (saved.includes('T') && saved.endsWith('Z')) {
      try {
        return new Date(saved).toLocaleString('pt-BR');
      } catch (e) {
        return saved;
      }
    }
    return saved;
  });
  
  // Controle de versão e atualização disponível
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState(CURRENT_APP_VERSION);

  // Estado da chavinha de backup automático (salvo no localStorage deste aparelho)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(() => {
    const saved = localStorage.getItem('giro_auto_sync_enabled');
    return saved !== null ? JSON.parse(saved) : false;
  });

  const handleToggleAutoSync = (checked: boolean) => {
    setAutoSyncEnabled(checked);
    localStorage.setItem('giro_auto_sync_enabled', JSON.stringify(checked));
    if (checked) {
      notify('Backup automático ativado neste aparelho.', 'success');
    } else {
      notify('Backup automático desativado neste aparelho.', 'info');
    }
  };

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

  const formatSyncDate = (isoOrFormattedString: string) => {
    if (!isoOrFormattedString) return '';
    // Se parecer uma data ISO (ex: 2026-09-04T02:39:02.286Z), formata bonitinha
    if (isoOrFormattedString.includes('T') && (isoOrFormattedString.endsWith('Z') || isoOrFormattedString.includes('+'))) {
      try {
        const date = new Date(isoOrFormattedString);
        return date.toLocaleString('pt-BR');
      } catch (e) {
        return isoOrFormattedString;
      }
    }
    return isoOrFormattedString;
  };

  const applyRemoteDataToLocal = (remoteData: any, notifyChanges = false) => {
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
      const formatted = formatSyncDate(remoteData.lastUpdated);
      setLastSyncInfo(formatted);
      localStorage.setItem('giro_last_sync_display', formatted);
    }

    if (notifyChanges) {
      const newCounts = getSnapshotCounts(remoteData);
      
      if (newCounts.directSales > oldCounts.directSales) {
        notify('Nova venda registrada em outro aparelho!', 'success');
      } else if (newCounts.orders > oldCounts.orders) {
        notify('Novo pedido recebido na nuvem!', 'success');
      } else if (newCounts.clientReceipts > oldCounts.clientReceipts || newCounts.charges < oldCounts.charges) {
        notify('Pagamento recebido / Baixa efetuada!', 'success');
      } else {
        notify('Dados sincronizados com sucesso!', 'info');
      }
    }
  };

  const pushDataToFirebase = async (userId: string) => {
    try {
      const payload: Record<string, any> = {};
      for (const [keyName, possibleStorageKeys] of Object.entries(ALL_APP_KEYS)) {
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
        if (localData !== null) {
          payload[keyName] = localData;
        }
      }

      const now = new Date();
      const dateFormatted = now.toLocaleDateString('pt-BR') + ', ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      payload.lastUpdated = dateFormatted;

      await setDoc(doc(db, 'users', userId), payload, { merge: true });
      
      setLastSyncInfo(dateFormatted);
      localStorage.setItem('giro_last_sync_display', dateFormatted);
    } catch (error) {
      console.error('Erro ao salvar no Firestore:', error);
    }
  };

  const pullDataFromFirebase = async (userId: string) => {
    try {
      const docRef = doc(db, 'users', userId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        applyRemoteDataToLocal(docSnap.data(), false);
      }
    } catch (error) {
      console.error('Erro ao baixar do Firestore:', error);
    }
  };

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/version.json?t=' + new Date().getTime());
        if (response.ok) {
          const data = await response.json();
          if (data && data.version && data.version !== CURRENT_APP_VERSION) {
            setLatestVersion(data.version);
            setUpdateAvailable(true);
          }
        }
      } catch (error) {}
    };
    checkForUpdates();

    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await pullDataFromFirebase(currentUser.uid);

        const isAuto = localStorage.getItem('giro_auto_sync_enabled');
        if (isAuto === 'true') {
          await pushDataToFirebase(currentUser.uid);
        }

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

            const formattedRemoteDate = formatSyncDate(remoteData.lastUpdated);
            if (formattedRemoteDate && formattedRemoteDate !== currentDisplay) {
              applyRemoteDataToLocal(remoteData, true);
            }
          }
        });
      } else {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
        }
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const handleForceUpdate = async () => {
    notify('Atualizando aplicativo...', 'info');
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
    } catch (e) {
      console.error('Erro ao limpar cache:', e);
    }

    setTimeout(() => {
      window.location.reload();
    }, 600);
  };

  const handleGoogleLogin = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result?.user) {
        notify('Conta conectada com sucesso!', 'success');
        await pushDataToFirebase(result.user.uid);
      }
    } catch (error: any) {
      console.error('Erro no login:', error);
      notify('Não foi possível autenticar com o Google.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      await pushDataToFirebase(user.uid);
      await pullDataFromFirebase(user.uid);
      notify('Sincronização realizada com sucesso!', 'success');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      notify('Erro ao sincronizar dados.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('giro_last_sync_display');
      setLastSyncInfo(null);
      notify('Conta desconectada com sucesso.', 'info');
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-10">
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-slate-100 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-2xl p-3 ${user ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
              <Cloud size={24} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Sincronização em Nuvem</h2>
              <p className={`text-xs font-medium ${user ? 'text-emerald-600' : 'text-slate-400'}`}>
                {user ? 'Conectado (Tempo Real Global)' : 'Nenhuma conta conectada'}
              </p>
              {user && user.email && (
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-500 font-medium">
                  <Mail size={12} className="text-slate-400" />
                  <span>{user.email}</span>
                </div>
              )}
            </div>
          </div>
          {user && (
            <button onClick={handleLogout} className="text-slate-400 hover:text-rose-500 p-2 rounded-xl transition" title="Desconectar conta">
              <LogOut size={18} />
            </button>
          )}
        </div>

        <div className="rounded-2xl bg-slate-50/70 p-4 space-y-3 border border-slate-100/80 text-xs text-slate-600">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <span>Sincronização em tempo real ativa em todas as abas do aplicativo.</span>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-start gap-2.5">
              <Database size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span>Gerencia estoque, clientes, vendas, cobranças e relatórios.</span>
            </div>
          </div>

          {user && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-200/60">
              <div className="flex items-start gap-2.5">
                <Sliders size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-slate-700 block">Backup Automático neste aparelho</span>
                  <span className="text-[11px] text-slate-400">Permite enviar dados deste celular para a nuvem</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input 
                  type="checkbox" 
                  checked={autoSyncEnabled} 
                  onChange={(e) => handleToggleAutoSync(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          )}

          {lastSyncInfo && (
            <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200/60">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
              <span className="text-slate-500">
                Última sincronização: <strong className="text-slate-700">{lastSyncInfo}</strong>
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3 pt-2">
          {!user ? (
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-white border border-slate-200 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition active:scale-[0.99] hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? 'Conectando...' : 'Fazer Login com o Google'}
            </button>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              <button
                onClick={handleSyncNow}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-sm font-semibold text-white shadow-md transition active:scale-[0.99] hover:bg-emerald-600 disabled:opacity-50"
              >
                <Cloud size={18} className={loading ? 'animate-spin' : ''} />
                {loading ? 'Sincronizando...' : 'Sincronizar com a Nuvem Agora'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 text-center space-y-2">
        {updateAvailable ? (
          <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 flex items-center justify-between text-xs text-amber-800 shadow-sm">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-amber-600 shrink-0" />
              <span>Nova versão <strong>{latestVersion}</strong> disponível!</span>
            </div>
            <button 
              onClick={handleForceUpdate}
              className="flex items-center gap-1.5 bg-amber-600 text-white font-medium px-3 py-1.5 rounded-xl hover:bg-amber-700 transition shadow-sm"
            >
              <RefreshCw size={12} className="animate-spin" />
              Atualizar
            </button>
          </div>
        ) : (
          <p className="text-xs text-slate-400 font-medium">
            Giro App • Versão {CURRENT_APP_VERSION}
          </p>
        )}
      </div>
    </div>
  );
}
