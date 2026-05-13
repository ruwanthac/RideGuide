import type { BadgeVariant } from './badgeStatus';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-400',
  info: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-400',
};

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
