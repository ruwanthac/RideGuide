import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
  /** Red count shown next to the label (hidden when 0). */
  badge?: number;
  onNavigate?: () => void;
}

export function SidebarItem({ to, icon: Icon, label, collapsed, badge, onNavigate }: SidebarItemProps) {
  const count = badge && badge > 0 ? (badge > 99 ? '99+' : String(badge)) : null;
  return (
    <NavLink
      to={to}
      end={to === '/' || to === '/requests'}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      aria-label={count ? `${label}, ${count} waiting` : undefined}
      className={({ isActive }) =>
        `relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
          isActive
            ? 'bg-accent-50 font-semibold text-accent-600 dark:bg-accent-500/15 dark:text-accent-300'
            : 'font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
        } ${collapsed ? 'justify-center px-2' : ''}`
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
      {count &&
        (collapsed ? (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-600" aria-hidden />
        ) : (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white">
            {count}
          </span>
        ))}
    </NavLink>
  );
}
