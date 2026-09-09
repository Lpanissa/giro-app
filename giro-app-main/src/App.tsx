import { useState, useEffect } from 'react';
import { Settings, Menu, X } from 'lucide-react';
import { AppHeader, type TabKey } from '@/components/layout/AppHeader';
import { ToastProvider } from '@/components/common/Toast';
import { InventoryPage } from '@/pages/InventoryPage';
import { MapPage } from '@/pages/MapPage';
import { ProfitPage } from '@/pages/ProfitPage';
import { CollectionsPage } from '@/pages/CollectionsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { useAuth } from '@/lib/useAuth';

function App() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem('app_active_tab');
    return (saved as TabKey) || 'vendas';
  });

  const [settingsOpen, setSettingsOpen] = useState<boolean>(() => {
    const saved = localStorage.getItem('app_settings_open');
    return saved ? JSON.parse(saved) : false;
  });

  const [menuOpen, setMenuOpen] = useState(false);

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

  const showSplash = isLoading || authLoading;

  return (
    <ToastProvider>
      {showSplash && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black transition-opacity duration-300">
          <div className="flex h-44 w-44 items-center justify-center rounded-[48px] bg-black">
            <span className="text-4xl font-bold tracking-wider text-white">
              <span className="text-[#00e699]">G</span>iro
            </span>
          </div>
        </div>
      )}

      {!showSplash && !user && <LoginPage />}

      {!showSplash && user && (
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

          {menuOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-start">
              <div className="w-full max-w-xs bg-slate-50 h-full overflow-y-auto p-5 shadow-xl animate-slide-right">
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
                  <button className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition">
                    Loja
                  </button>
                  <button className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition">
                    Ajuda
                  </button>
                  <button
                    onClick={async () => {
                      setMenuOpen(false);
                      await signOut();
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
                  >
                    Sair
                  </button>
                </nav>
              </div>
            </div>
          )}

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
      )}
    </ToastProvider>
  );
}

export default App;
