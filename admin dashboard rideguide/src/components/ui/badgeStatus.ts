export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export function statusToBadgeVariant(status: string): BadgeVariant {
  switch (status.toLowerCase()) {
    case 'active':
    case 'completed':
    case 'accepted':
      return 'success';
    case 'pending':
      return 'warning';
    case 'suspended':
    case 'cancelled':
      return 'danger';
    default:
      return 'default';
  }
}
