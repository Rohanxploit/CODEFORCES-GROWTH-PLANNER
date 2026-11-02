import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Menu, Moon, Sun, TrendingUp, X } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { cx } from './ui';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/practice', label: 'Today' },
  { to: '/roadmap', label: 'Roadmap' },
  { to: '/analytics', label: 'Analytics' },
  { to: '/review', label: 'Weekly review' },
  { to: '/contests', label: 'Contests' },
  { to: '/settings', label: 'Settings' },
];

export function AppHeader() {
  const { theme, toggleTheme } = useTheme();
  const { user, logout, refresh } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onToggleTheme = () => {
    toggleTheme();
    // Signed-in users keep the choice on their account so it follows them across devices.
    if (user) void api.updateMe({ preferences: { theme: theme === 'dark' ? 'light' : 'dark' } }).then(() => refresh(), () => undefined);
  };

  const onLogout = async () => {
    await logout();
    navigate('/');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cx(
      'rounded-md px-2.5 py-1.5 text-sm transition-colors',
      isActive ? 'bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
    );

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to={user ? '/dashboard' : '/'} className="flex shrink-0 items-center gap-2 font-semibold">
          <TrendingUp className="size-5 text-blue-600 dark:text-blue-400" aria-hidden />
          <span className="hidden sm:inline">Codeforces Growth Planner</span>
          <span className="sm:hidden">CF Growth</span>
        </Link>

        {user && (
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleTheme}
            className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:bg-zinc-800"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
          {user ? (
            <>
              <button
                type="button"
                onClick={onLogout}
                className="hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 sm:flex dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <LogOut className="size-4" aria-hidden />
                Log out
              </button>
              <button
                type="button"
                className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 lg:hidden dark:text-zinc-400 dark:hover:bg-zinc-800"
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
              >
                {open ? <X className="size-5" /> : <Menu className="size-5" />}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-md px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                Log in
              </Link>
              <Link to="/register" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-zinc-950 dark:hover:bg-blue-400">
                Get started
              </Link>
            </>
          )}
        </div>
      </div>

      {user && open && (
        <nav className="border-t border-zinc-200 px-4 py-2 lg:hidden dark:border-zinc-800" aria-label="Main">
          <div className="grid gap-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setOpen(false)}>
                {item.label}
              </NavLink>
            ))}
            <button type="button" onClick={onLogout} className="rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-600 dark:text-zinc-400">
              Log out
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
