import { type ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-gray-200/60 dark:border-gray-800/60 ${className}`}>
      <table className="w-full min-w-[600px] text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
      <tr>{children}</tr>
    </thead>
  );
}

export function TableHead({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 font-medium text-gray-600 dark:text-gray-400 ${className}`}>{children}</th>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-gray-200 dark:divide-gray-700">{children}</tbody>;
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
      className={`transition-colors ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : ''} ${className}`}
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
    <td colSpan={colSpan} className={`px-4 py-3 text-gray-900 dark:text-gray-100 ${className}`}>
      {children}
    </td>
  );
}
