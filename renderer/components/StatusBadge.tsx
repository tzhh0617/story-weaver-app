import { Badge } from './ui/badge';
import { getStatusLabel } from '../status-labels';

const badgeToneClasses: Record<string, string> = {
  creating: 'bg-amber-50 text-amber-900 border-amber-200',
  building_world: 'bg-sky-50 text-sky-900 border-sky-200',
  building_outline: 'bg-sky-50 text-sky-900 border-sky-200',
  writing: 'bg-cyan-50 text-cyan-900 border-cyan-200',
  paused: 'bg-stone-100 text-stone-800 border-stone-200',
  completed: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  error: 'bg-red-50 text-red-900 border-red-200',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={badgeToneClasses[status] ?? 'bg-muted text-foreground'}>
      {getStatusLabel(status)}
    </Badge>
  );
}
