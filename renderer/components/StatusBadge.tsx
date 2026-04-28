import { Badge } from './ui/badge';
import { getStatusLabel } from '../status-labels';

const badgeToneClasses: Record<string, string> = {
  creating: 'bg-muted text-muted-foreground',
  building_world: 'bg-muted text-muted-foreground',
  building_outline: 'bg-muted text-muted-foreground',
  writing: 'border-primary/20 bg-primary/10 text-primary',
  paused: 'bg-secondary text-secondary-foreground',
  completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700',
  error: 'border-destructive/20 bg-destructive/10 text-destructive',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={badgeToneClasses[status] ?? 'bg-muted text-foreground'}>
      {getStatusLabel(status)}
    </Badge>
  );
}
