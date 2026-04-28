import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from './ui/card';
import { Button } from './ui/button';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <Card
      role="status"
      className="overflow-hidden rounded-lg border-dashed border-border/80 bg-card/75 shadow-sm"
    >
      <CardHeader className="p-6 pb-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Empty Shelf
        </p>
        <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
      </CardHeader>
      <CardContent className="grid gap-4 p-6 pt-0">
        <CardDescription className="max-w-xl leading-6">
          {description}
        </CardDescription>
        {actionLabel && onAction ? (
          <Button type="button" className="w-fit" onClick={onAction}>
            {actionLabel}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
