import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className,
      disabled,
      loading = false,
      onClick,
      variant,
      size,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const [isClickPending, setIsClickPending] = React.useState(false)
    const isLoading = loading || isClickPending
    const isDisabled = disabled || isLoading

    function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
      if (isDisabled) {
        event.preventDefault()
        return
      }

      const result = onClick?.(event) as unknown

      if (
        result &&
        typeof result === "object" &&
        "then" in result &&
        typeof result.then === "function"
      ) {
        setIsClickPending(true)
        void Promise.resolve(result).then(
          () => setIsClickPending(false),
          () => setIsClickPending(false)
        )
      }
    }

    if (asChild) {
      return (
        <Slot
          aria-busy={isLoading ? "true" : undefined}
          aria-disabled={isDisabled ? "true" : undefined}
          className={cn(buttonVariants({ variant, size, className }))}
          data-loading={isLoading ? "true" : undefined}
          onClick={onClick ? handleClick : undefined}
          ref={ref}
          {...props}
        >
          {children}
        </Slot>
      )
    }

    return (
      <button
        aria-busy={isLoading ? "true" : undefined}
        className={cn(buttonVariants({ variant, size, className }))}
        data-loading={isLoading ? "true" : undefined}
        disabled={isDisabled}
        onClick={onClick ? handleClick : undefined}
        ref={ref}
        {...props}
      >
        {isLoading ? (
          <Loader2
            aria-hidden="true"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin"
            data-testid="button-loading-indicator"
          />
        ) : null}
        {isLoading ? (
          <span
            className="inline-flex items-center justify-center gap-2 opacity-0"
            data-testid="button-content"
          >
            {children}
          </span>
        ) : (
          children
        )}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
