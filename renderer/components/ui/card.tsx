import * as React from "react"

import { cn } from "@/lib/utils"

export const layoutCardClassName =
  "overflow-hidden rounded-[1.35rem] border border-border/70 bg-card/95 text-card-foreground shadow-[0_12px_30px_rgba(36,28,18,0.06)] ring-1 ring-foreground/[0.03]"

export const layoutCardHeaderClassName =
  "border-b border-border/60 bg-gradient-to-br from-background via-card to-muted/30"

export const layoutCardSectionClassName =
  "border-b border-border/55 px-1 py-5 last:border-b-0"

export const pageIntroPanelClassName = `${layoutCardClassName} px-5 py-5`

export const pageIntroEyebrowClassName =
  "text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"

export const pageIntroTitleClassName = "mt-2 text-3xl font-semibold tracking-tight"

export const pageIntroDescriptionClassName =
  "mt-2 max-w-2xl text-sm leading-6 text-muted-foreground"

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex flex-col space-y-1.5 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
))
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center p-6 pt-0", className)}
    {...props}
  />
))
CardFooter.displayName = "CardFooter"

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
}
