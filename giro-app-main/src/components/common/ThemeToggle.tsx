import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/lib/ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      aria-label="Alternar tema claro/escuro"
      className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 dark:bg-slate-700 transition-colors"
    >
      <span
        className={`inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow-sm transition-transform ${
          isDark ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      >
        {isDark ? (
          <Moon size={12} className="text-slate-500" />
        ) : (
          <Sun size={12} className="text-slate-400" />
        )}
      </span>
    </button>
  );
}
