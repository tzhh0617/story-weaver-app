import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from './ui/card';

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card
      role="status"
      className="border-dashed bg-muted/20 shadow-none"
    >
      <CardHeader className="p-6 pb-2">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
