import { Link } from 'react-router-dom';
import { Moon, Sun, TrendingUp } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <TrendingUp className="size-5 text-blue-600 dark:text-blue-400" aria-hidden />
          Codeforces Growth Planner
        </Link>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800"
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
      </div>
    </header>
  );
}
