import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function Separator({
  className,
  orientation = 'horizontal',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  orientation?: 'horizontal' | 'vertical';
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        orientation === 'horizontal'
          ? 'h-px w-full bg-border/80'
          : 'h-full w-px bg-border/80',
        className
      )}
      {...props}
    />
  );
}
