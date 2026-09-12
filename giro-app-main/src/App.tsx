import { useState, useEffect } from 'react';
import { Settings, Menu, X, Store as StoreIcon } from 'lucide-react';
import { AppHeader, type TabKey } from '@/components/layout/AppHeader';
import { ToastProvider } from '@/components/common/Toast';
import { InventoryPage } from '@/pages/InventoryPage';
import { MapPage } from '@/pages/MapPage';
import { ProfitPage } from '@/pages/ProfitPage';
import { CollectionsPage } from '@/pages/CollectionsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { StorePage } from '@/pages/StorePage';
import { useAuth } from '@/lib/useAuth';
import { StoreProvider, useActiveStore } from '@/lib/StoreContext';
import { ThemeProvider } from '@/lib/ThemeProvider';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useModalBackButton } from '@/hooks/useModalBackButton';

function AuthenticatedApp({ signOut }: { signOut: () => Promise<string | null> }) {
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem('app_active_tab');
    return (saved as TabKey) || 'vendas';
  });

  const [menuOpen, setMenuOpen] = useState(false);
  // A tela de Loja fica DENTRO do drawer do menu — é uma troca de conteúdo
  // interna, sem empilhar outro estado no histórico (ver observação abaixo).
  const [storeScreenOpen, setStoreScreenOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Botão de voltar do celular fecha o Menu (com a tela de Loja, se estiver
  // aberta) em vez de sair do app. Como o Menu e a Loja são tratados como um
  // só nível no histórico, voltar com a Loja aberta fecha tudo de uma vez —
  // dentro do app, o botão "X" continua voltando passo a passo normalmente.
  useModalBackButton(menuOpen, () => {
    setMenuOpen(false);
    setStoreScreenOpen(false);
  });

  useModalBackButton(settingsOpen, () => setSettingsOpen(false));

  const { stores, activeStoreId } = useActiveStore();
  const activeStore = stores.find((s) => s.id === activeStoreId);

  useEffect(() => {
    localStorage.setItem('app_active_tab', activeTab);
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 transition-colors">
      {!settingsOpen && !menuOpen && (
        <div className="sticky top-0 z-40 flex items-center justify-between px-3 py-1.5 bg-slate-50/95 backdrop-blur-sm">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Menu"
          >
            <Menu size={16} />
          </button>

          {activeStore && (
            <button
              onClick={() => setMenuOpen(true)}
              className="flex items-center gap-1.5 min-w-0 rounded-full px-2 py-1 transition hover:bg-slate-100"
            >
              {activeStore.image ? (
                <img src={activeStore.image} alt={activeStore.name} className="h-5 w-5 rounded-full object-cover border border-slate-200 shrink-0" />
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 shrink-0">
                  <StoreIcon size={11} className="text-slate-500" />
                </div>
              )}
              <span className="text-xs font-semibold text-slate-600 truncate max-w-[140px]">{activeStore.name}</span>
            </button>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Configurações"
          >
            <Settings size={16} />
          </button>
        </div>
      )}

      <AppHeader active={activeTab} onChange={setActiveTab} />

      <main className="mx-auto w-full max-w-md md:max-w-4xl lg:max-w-6xl xl:max-w-7xl px-4 md:px-8 pb-10 pt-0 md:pt-2 transition-all duration-300">
        {activeTab === 'vendas' && <ProfitPage />}
        {activeTab === 'estoque' && <InventoryPage />}
        {activeTab === 'rotas' && <MapPage />}
        {activeTab === 'cobrancas' && <CollectionsPage />}
      </main>

      {/* Painel lateral (Drawer) - abre pela esquerda */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-start">
          <div className="w-full max-w-xs bg-slate-50 h-full overflow-y-auto p-5 shadow-xl animate-slide-right">
            {storeScreenOpen ? (
              <StorePage onClose={() => setStoreScreenOpen(false)} />
            ) : (
              <>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
                  <h2 className="text-base font-semibold text-slate-800">Menu</h2>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                  >
                    <X size={18} />
                  </button>
                </div>

                <nav className="space-y-1">
                  <button
                    onClick={() => setStoreScreenOpen(true)}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
                  >
                    Loja
                  </button>
                  <button className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition">
                    Ajuda
                  </button>
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      setStoreScreenOpen(false);
                      await signOut();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
                  >
                    Sair
                  </button>
                </nav>
              </>
            )}
          </div>
        </div>
      )}

      {settingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-md bg-slate-50 h-full overflow-y-auto p-5 shadow-xl animate-slide-left">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-800">Configurações</h2>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
                >
                  ✕
                </button>
              </div>
            </div>
            <SettingsPage />
          </div>
        </div>
      )}
    </div>
  );
}

function App() {
  const { user, loading: authLoading, signOut } = useAuth();

  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="min-h-screen bg-white">
          {!authLoading && !user && <LoginPage />}

          {!authLoading && user && (
            <StoreProvider>
              <AuthenticatedApp signOut={signOut} />
            </StoreProvider>
          )}
        </div>

        {/* Overlay ofuscado (sem tela preta, sem logo) com rodinha de carregamento —
            combina com o overlay do index.html pra manter a mesma cor e blur do
            início ao fim do carregamento. */}
        {authLoading && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-white/85 backdrop-blur-sm transition-opacity duration-300">
            <div className="h-7 w-7 rounded-full border-[3px] border-slate-200 border-t-slate-500 animate-spin" />
          </div>
        )}
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
