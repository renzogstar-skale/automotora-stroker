import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | "emerald";
  size?: "default" | "sm" | "lg" | "icon";
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 select-none";

    const variantStyles = {
      default:
        "bg-red-600 text-white shadow-md shadow-red-950/40 hover:bg-red-500 active:bg-red-700",
      destructive:
        "bg-rose-600 text-white shadow-sm hover:bg-rose-500 active:bg-rose-700",
      outline:
        "border border-line bg-surface hover:bg-surface-2 text-ink hover:text-accent shadow-sm",
      secondary:
        "border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-100",
      ghost: "hover:bg-surface-2 text-ink hover:text-accent",
      link: "text-red-500 underline-offset-4 hover:underline p-0 h-auto",
      emerald:
        "bg-emerald-600 text-white shadow-md shadow-emerald-950/40 hover:bg-emerald-500 active:bg-emerald-700",
    }[variant];

    const sizeStyles = {
      default: "h-11 min-h-[44px] px-4 py-2",
      sm: "h-9 min-h-[36px] rounded-lg px-3 text-xs",
      lg: "h-12 min-h-[48px] rounded-xl px-6 text-base font-bold",
      icon: "size-11 min-h-[44px] min-w-[44px] p-0",
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles, sizeStyles, className)}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <svg
              className="size-4 animate-spin text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span>Cargando...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

export { Button };
