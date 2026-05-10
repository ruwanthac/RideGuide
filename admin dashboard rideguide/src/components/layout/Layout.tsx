import { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useDarkMode } from '../../hooks/useDarkMode';
import { fetchCurrentUser, getToken, logout } from '../../lib/api';

export function Layout() {
  const navigate = useNavigate();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDark, toggle: toggleDark } = useDarkMode();

  /** Optional: `GET /api/auth/me` — 401 is handled in `api.ts` (redirect to login). */
  useEffect(() => {
    if (!getToken()) return;
    void fetchCurrentUser().catch(() => {});
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />
      <div className={`transition-[margin-left] duration-300 lg:ml-64 ${sidebarCollapsed ? 'lg:ml-[72px]' : 'lg:ml-64'}`}>
        <Navbar
          onMenuClick={() => setMobileMenuOpen((o) => !o)}
          onDarkModeToggle={toggleDark}
          onLogout={handleLogout}
          isDark={isDark}
        />
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
