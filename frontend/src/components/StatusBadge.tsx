interface StatusBadgeProps {
  status: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning/20 text-warning',
  'in process': 'bg-info/20 text-info',
  ordered: 'bg-secondary/20 text-secondary',
  done: 'bg-success/20 text-success',
  rejected: 'bg-destructive/20 text-destructive',
  booked: 'bg-info/20 text-info',
  cancelled: 'bg-destructive/20 text-destructive',
  paid: 'bg-success/20 text-success',
  active: 'bg-success/20 text-success',
  blocked: 'bg-destructive/20 text-destructive',
  approved: 'bg-success/20 text-success',
  processing: 'bg-info/20 text-info',
};

const statusIcons: Record<string, string> = {
  pending: '🕐',
  'in process': '⚙️',
  ordered: '📦',
  done: '✅',
  rejected: '❌',
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const lower = status.toLowerCase();
  const color = statusColors[lower] || 'bg-muted text-muted-foreground';
  const icon = statusIcons[lower] || '';

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${color}`}>
      {icon && <span>{icon}</span>}
      <span className="capitalize">{status}</span>
    </span>
  );
};
