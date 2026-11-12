import {
  LayoutDashboard,
  Users,
  ShieldCheck,
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
import { useAttentionCounts } from '../../hooks/useAttentionCounts';

interface SidebarProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export function Sidebar({ collapsed, onCollapsedChange, mobileOpen, onCloseMobile }: SidebarProps) {
  const counts = useAttentionCounts();

  const groups = [
    {
      title: 'Overview',
      items: [
        { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/analytics', icon: BarChart3, label: 'Analytics' },
      ],
    },
    {
      title: 'People',
      items: [
        { to: '/users', icon: Users, label: 'Users' },
        { to: '/provider-applications', icon: ShieldCheck, label: 'Provider applications', badge: counts.applications },
        { to: '/vehicles', icon: Car, label: 'Vehicles' },
      ],
    },
    {
      title: 'Operations',
      items: [
        { to: '/requests', icon: Wrench, label: 'Roadside requests' },
        { to: '/requests/tow', icon: Truck, label: 'Tow requests' },
        { to: '/diagnoses', icon: Stethoscope, label: 'Diagnoses' },
      ],
    },
    {
      title: 'System',
      items: [
        { to: '/audit-logs', icon: ScrollText, label: 'Audit logs' },
        { to: '/settings', icon: Settings, label: 'Settings' },
      ],
    },
  ];

  const content = (closeOnNavigate: boolean) => (
    <>
      <div className={`flex h-16 items-center ${collapsed && !closeOnNavigate ? 'justify-center px-2' : 'gap-3 px-5'}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-500 text-white">
          <Car className="h-5 w-5" />
        </span>
        {(!collapsed || closeOnNavigate) && (
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-extrabold text-slate-900 dark:text-white">RideGuide</span>
            <span className="text-xs text-slate-500 dark:text-gray-400">Admin</span>
          </span>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-3" aria-label="Main">
        {groups.map((g) => (
          <div key={g.title} className="flex flex-col gap-0.5">
            {(!collapsed || closeOnNavigate) && (
              <span className="px-3 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-gray-500">
                {g.title}
              </span>
            )}
            {g.items.map((item) => (
              <SidebarItem
                key={item.to}
                {...item}
                collapsed={collapsed && !closeOnNavigate}
                onNavigate={closeOnNavigate ? onCloseMobile : undefined}
              />
            ))}
          </div>
        ))}
      </nav>
      <div className="hidden border-t border-slate-200 p-3 dark:border-gray-800 lg:block">
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-100 dark:text-gray-400 dark:hover:bg-gray-800 ${collapsed ? 'justify-center px-2' : ''}`}
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
        className={`fixed left-0 top-0 z-40 hidden h-full flex-col border-r border-slate-200 bg-white transition-[width] duration-300 dark:border-gray-800 dark:bg-gray-900 lg:flex ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {content(false)}
      </aside>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onCloseMobile} aria-hidden />
          <aside className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-slate-200 bg-white shadow-xl animate-fade-in dark:border-gray-800 dark:bg-gray-900 lg:hidden">
            {content(true)}
          </aside>
        </>
      )}
    </>
  );
}
