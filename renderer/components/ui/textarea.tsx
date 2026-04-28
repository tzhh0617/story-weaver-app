import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-[120px] w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
      {...props}
    />
  );
}
