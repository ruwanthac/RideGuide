import { type ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-800 ${className}`}>
      <table className="w-full min-w-[600px] text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-slate-50 dark:bg-gray-800/50 border-b border-slate-200 dark:border-gray-700">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-gray-400 ${className}`}>{children}</th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100 dark:divide-gray-800">{children}</tbody>;
}

export function TableRow({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      className={`transition-colors ${onClick ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-gray-800/50' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}

export function TableCell({
  children,
  className = '',
  colSpan,
}: {
  children: ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 text-slate-800 dark:text-gray-100 ${className}`}>
      {children}
    </td>
  );
}
