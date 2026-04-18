"use client";

import type { ReactNode } from "react";

type Variant = "success" | "danger" | "warning" | "brand" | "neutral";

const variants: Record<Variant, string> = {
  success: "bg-success-50 text-success-700 border-success-500/20",
  danger: "bg-danger-50 text-danger-700 border-danger-500/20",
  warning: "bg-accent/10 text-accent-700 border-accent/20",
  brand: "bg-brand/10 text-brand border-brand/20",
  neutral: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export default function Badge({
  children,
  variant = "neutral",
  dot = false,
  className = "",
}: {
  children: ReactNode;
  variant?: Variant;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={[
        "badge border shadow-sm",
        variants[variant],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {children}
    </span>
  );
}
