import { cn } from "@/lib/utils";
import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & PropsWithChildren) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-6 shadow-2xl backdrop-blur-xl transition-all duration-200",
        "  text-slate-900 ",
        "dark:bg-white/5 dark:border-white/10 dark:text-white dark:shadow-rose-500/10",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & PropsWithChildren) {
  return (
    <div className={cn("flex flex-col space-y-1.5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & PropsWithChildren) {
  return (
    <h3
      className={cn(
        "text-lg font-semibold tracking-tight",
        "text-white dark:text-white",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement> & PropsWithChildren) {
  return (
    <p className={cn("text-sm text-slate-500 dark:text-white/70", className)} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & PropsWithChildren) {
  return (
    <div
      className={cn("p-0 pt-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & PropsWithChildren) {
  return (
    <div
      className={cn("flex items-center pt-4", className)}
      {...props}
    >
      {children}
    </div>
  );
}

