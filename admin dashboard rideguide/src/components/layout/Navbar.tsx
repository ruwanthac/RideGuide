import { Search, Bell, Moon, Sun, Menu, LogOut } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
  onDarkModeToggle: () => void;
  onLogout: () => void;
  isDark: boolean;
}

export function Navbar({ onMenuClick, onDarkModeToggle, onLogout, isDark }: NavbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm px-4 lg:pl-4">
      <button
        type="button"
        onClick={onMenuClick}
        className="rounded-lg p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex flex-1 items-center gap-4">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search..."
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 py-2 pl-10 pr-4 text-sm placeholder:text-gray-400 focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20 transition-colors"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDarkModeToggle}
            className="rounded-lg p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="relative rounded-lg p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent-500" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
          <div className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full bg-accent-500/20 text-accent-600 dark:text-accent-400 font-medium text-sm">
            A
          </div>
        </div>
      </div>
    </header>
  );
}
