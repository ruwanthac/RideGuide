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
  const [adminName, setAdminName] = useState<string | undefined>();

  /** Optional: `GET /api/auth/me` — 401 is handled in `api.ts` (redirect to login). */
  useEffect(() => {
    if (!getToken()) return;
    void fetchCurrentUser()
      .then((u) => setAdminName(u.displayName))
      .catch(() => {});
  }, []);

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-gray-950">
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
          adminName={adminName}
        />
        <main className="mx-auto max-w-[1440px] p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
