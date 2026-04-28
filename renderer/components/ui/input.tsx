import type { InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary',
        className
      )}
      {...props}
    />
  );
}
