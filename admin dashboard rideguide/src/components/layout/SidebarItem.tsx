import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  to: string;
  icon: LucideIcon;
  label: string;
  collapsed?: boolean;
}

export function SidebarItem({ to, icon: Icon, label, collapsed }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
          isActive
            ? 'bg-accent-500/10 text-accent-600 dark:text-accent-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        } ${collapsed ? 'justify-center px-2' : ''}`
      }
    >
      <Icon className="h-5 w-5 shrink-0" />
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );
}
