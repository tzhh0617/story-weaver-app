import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export function ScrollArea({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('max-h-[28rem] overflow-auto pr-2', className)}
      {...props}
    />
  );
}
