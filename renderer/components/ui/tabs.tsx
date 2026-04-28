import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from 'react';
import { cn } from '../../lib/utils';

export function Tabs({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('grid gap-6', className)} {...props}>
      {children}
    </div>
  );
}

export function TabsList({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="tablist"
      className={cn('flex flex-wrap gap-3', className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      role="tab"
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-muted px-4 py-3 text-sm font-medium text-foreground transition data-[state=active]:bg-primary data-[state=active]:text-primary-foreground',
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  hidden,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  if (hidden) {
    return null;
  }

  return <div role="tabpanel" className={cn('grid gap-6', className)} {...props} />;
}
