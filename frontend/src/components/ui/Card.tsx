"use client";

import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddings = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export default function Card({
  children,
  className = "",
  hover = false,
  padding = "md",
}: CardProps) {
  return (
    <div
      className={[
        "bg-[var(--card)] rounded-2xl border border-[var(--border)] shadow-sm transition-all duration-300",
        hover && "hover:shadow-md hover:border-brand/20 hover:-translate-y-0.5",
        paddings[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h3 className="font-bold text-[var(--foreground)] tracking-tight text-lg">{title}</h3>
        {subtitle && (
          <p className="text-sm text-slate-500 mt-1 leading-relaxed">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
