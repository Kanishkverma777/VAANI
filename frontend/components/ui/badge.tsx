import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "border-transparent bg-zinc-100 text-zinc-900 shadow-xs",
    secondary: "border-transparent bg-zinc-800 text-zinc-300",
    destructive: "border-transparent bg-red-500/10 text-red-400 border border-red-500/20",
    outline: "text-zinc-400 border-zinc-800",
    success: "bg-emerald-950/60 text-emerald-400 border border-emerald-800/40",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-zinc-400 select-none",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
