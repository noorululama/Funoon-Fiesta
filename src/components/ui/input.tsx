"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-2xl px-4 py-2.5 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          "border border-slate-200 bg-white text-slate-900 placeholder:text-slate-500 hover:border-slate-300",
          "focus-visible:border-fuchsia-500 focus-visible:ring-fuchsia-500/30 focus-visible:ring-offset-white",
          "dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/50 dark:hover:border-white/20",
          "dark:focus-visible:border-fuchsia-400/50 dark:focus-visible:ring-fuchsia-400/30 dark:focus-visible:ring-offset-slate-900 dark:focus-visible:bg-white/10",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };

