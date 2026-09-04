import { Route, Package, CircleDollarSign, HandCoins, Settings, LucideIcon } from 'lucide-react';

export type TabKey = 'rotas' | 'estoque' | 'vendas' | 'cobrancas';

interface TabDefinition {
  key: TabKey;
  label: string;
  icon: LucideIcon;
  color: string;
  activeBg: string;
}

const TABS: TabDefinition[] = [
  { key: 'rotas', label: 'Rotas', icon: Route, color: 'text-blue-500', activeBg: 'bg-blue-50' },
  { key: 'estoque', label: 'Estoque', icon: Package, color: 'text-rose-500', activeBg: 'bg-rose-50' },
  { key: 'vendas', label: 'Vendas', icon: CircleDollarSign, color: 'text-emerald-500', activeBg: 'bg-emerald-50' },
  { key: 'cobrancas', label: 'Cobranças', icon: HandCoins, color: 'text-orange-500', activeBg: 'bg-orange-50' },
];

interface AppHeaderProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
  onOpenSettings?: () => void;
}

export function AppHeader({ active, onChange, onOpenSettings }: AppHeaderProps) {
  return (
    <header className="fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur-sm border-t border-slate-100 transition-colors pb-safe">
      <div className="mx-auto flex max-w-md items-center justify-between px-3 pt-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 py-0.5">
          Painel de Controle
        </span>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Configurações"
          >
            <Settings size={16} />
          </button>
        )}
      </div>

      <nav className="mx-auto flex max-w-md items-center justify-between gap-0.5 px-2 pb-1.5">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`flex flex-1 flex-col items-center gap-1 rounded-2xl py-1.5 transition-all duration-200 ${
                isActive 
                  ? tab.activeBg 
                  : 'hover:bg-slate-50'
              }`}
            >
              <Icon size={20} className={tab.color} strokeWidth={isActive ? 2.4 : 2} />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-slate-800 font-semibold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </header>
);
}