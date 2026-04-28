import { Badge } from './ui/badge';
import { getStatusLabel } from '../status-labels';

const badgeToneClasses: Record<string, string> = {
  creating: 'border-border bg-muted text-muted-foreground',
  building_world: 'border-border bg-muted text-muted-foreground',
  building_outline: 'border-border bg-muted text-muted-foreground',
  writing: 'border-primary/25 bg-primary/10 text-primary',
  paused: 'border-amber-800/20 bg-amber-200/45 text-amber-950',
  completed: 'border-emerald-700/20 bg-emerald-100 text-emerald-800',
  error: 'border-destructive/20 bg-destructive/10 text-destructive',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={badgeToneClasses[status] ?? 'bg-muted text-foreground'}>
      {getStatusLabel(status)}
    </Badge>
  );
}
