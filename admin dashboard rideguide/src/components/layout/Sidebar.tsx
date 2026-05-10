import {
  LayoutDashboard,
  Users,
  Car,
  Stethoscope,
  Wrench,
  Truck,
  BarChart3,
  ScrollText,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { SidebarItem } from './SidebarItem';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/vehicles', icon: Car, label: 'Vehicles' },
  { to: '/diagnoses', icon: Stethoscope, label: 'Diagnoses' },
  { to: '/requests', icon: Wrench, label: 'Roadside Requests' },
  { to: '/requests/tow', icon: Truck, label: 'Tow Requests' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/audit-logs', icon: ScrollText, label: 'Audit logs' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onCollapsedChange, mobileOpen, onCloseMobile }: SidebarProps) {
  const content = (
    <>
      <div className={`flex h-14 items-center border-b border-gray-200 dark:border-gray-800 ${collapsed ? 'justify-center px-2' : 'gap-2 px-4'}`}>
        {!collapsed && (
          <span className="font-semibold text-gray-900 dark:text-white">RideGuide</span>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => (
          <SidebarItem
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
          />
        ))}
      </nav>
      <div className="border-t border-gray-200 dark:border-gray-800 p-3 hidden lg:block">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 ${collapsed ? 'justify-center px-2' : ''}`}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </>
  );

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-40 h-full w-64 flex-col border-r border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-glass dark:shadow-glass-dark hidden lg:flex transition-[width] duration-300 ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {content}
      </aside>
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={onCloseMobile}
            aria-hidden
          />
          <aside className="fixed left-0 top-0 z-50 h-full w-64 flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl flex lg:hidden animate-fade-in">
            {content}
          </aside>
        </>
      )}
    </>
  );
}
