import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "emerald";
  size?: "default" | "sm" | "lg" | "icon" | "pill";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variants = {
      default: "bg-zinc-100 text-zinc-900 hover:bg-white shadow-xs active:scale-[0.98]",
      destructive: "bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 active:scale-[0.98]",
      outline: "border border-zinc-800 bg-transparent text-zinc-200 hover:bg-zinc-900 hover:text-white active:scale-[0.98]",
      secondary: "bg-zinc-800/80 text-zinc-200 hover:bg-zinc-800 hover:text-white border border-zinc-700/40 active:scale-[0.98]",
      ghost: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50",
      link: "text-zinc-400 underline-offset-4 hover:underline hover:text-zinc-100",
      emerald: "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-[0_0_25px_rgba(16,185,129,0.25)] active:scale-[0.98]",
    };

    const sizes = {
      default: "h-9 px-4 py-2 text-xs",
      sm: "h-8 rounded-lg px-3 text-[11px]",
      lg: "h-11 rounded-2xl px-6 text-sm",
      icon: "h-9 w-9 p-0 flex items-center justify-center rounded-xl",
      pill: "h-10 rounded-full px-5 text-xs font-semibold",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
