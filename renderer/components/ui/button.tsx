import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'default' | 'secondary' | 'outline' | 'destructive';

const variantClasses: Record<ButtonVariant, string> = {
  default: 'bg-primary text-primary-foreground hover:brightness-95',
  secondary: 'bg-muted text-foreground hover:bg-accent hover:text-accent-foreground',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-white hover:brightness-95',
};

export function Button({
  className,
  variant = 'default',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-full px-4 py-3 text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50',
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
