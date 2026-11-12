import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Moon, Sun, Menu, LogOut } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
  onDarkModeToggle: () => void;
  onLogout: () => void;
  isDark: boolean;
  adminName?: string;
}

const iconBtn =
  'flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800';

export function Navbar({ onMenuClick, onDarkModeToggle, onLogout, isDark, adminName }: NavbarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const initial = (adminName?.trim() || 'Admin').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-gray-800 dark:bg-gray-900/90 lg:px-8">
      <button type="button" onClick={onMenuClick} className={`${iconBtn} lg:hidden`} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      <form
        role="search"
        className="relative max-w-md flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          if (q) navigate(`/users?search=${encodeURIComponent(q)}`);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users by name, email or phone…"
          aria-label="Search users"
          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-accent-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-500/20 dark:border-gray-700 dark:bg-gray-800/60 dark:focus:bg-gray-800"
        />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onDarkModeToggle} className={iconBtn} aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
          {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <button type="button" onClick={onLogout} className={iconBtn} aria-label="Sign out" title="Sign out">
          <LogOut className="h-[18px] w-[18px]" />
        </button>
        <span
          className="hidden h-10 w-10 items-center justify-center rounded-full bg-accent-100 text-sm font-extrabold text-accent-600 dark:bg-accent-500/20 dark:text-accent-300 sm:flex"
          title={adminName}
          aria-label={adminName ? `Signed in as ${adminName}` : undefined}
        >
          {initial}
        </span>
      </div>
    </header>
  );
}
