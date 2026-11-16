import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variantStyles = {
    default: "border-transparent bg-red-600 text-white shadow hover:bg-red-700",
    secondary: "border-transparent bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
    destructive: "border-transparent bg-rose-600 text-white shadow hover:bg-rose-700",
    outline: "text-zinc-200 border-white/20",
    success: "border-emerald-500/30 bg-emerald-500/15 text-emerald-400",
    warning: "border-amber-500/30 bg-amber-500/15 text-amber-400",
  }[variant];

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2",
        variantStyles,
        className
      )}
      {...props}
    />
  );
}

export { Badge };
