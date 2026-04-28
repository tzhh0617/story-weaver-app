import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type AlertTone = 'info' | 'success' | 'error';

const toneClasses: Record<AlertTone, string> = {
  info: 'border-sky-200 bg-sky-50 text-sky-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

export function Alert({
  className,
  tone = 'info',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: AlertTone;
}) {
  return (
    <div
      role="alert"
      className={cn(
        'w-full rounded-2xl border px-4 py-3 text-sm shadow-sm',
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
