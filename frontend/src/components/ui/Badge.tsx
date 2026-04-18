"use client";

type BadgeVariant =
  | "brand"
  | "success"
  | "danger"
  | "warning"
  | "neutral"
  | "info";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}

const variants: Record<BadgeVariant, string> = {
  brand: "bg-brand-50 text-brand-700",
  success: "bg-success-50 text-success-700",
  danger: "bg-danger-50 text-danger-700",
  warning: "bg-accent-50 text-accent-700",
  neutral: "bg-surface-100 text-slate-600",
  info: "bg-blue-50 text-blue-700",
};

const dotColors: Record<BadgeVariant, string> = {
  brand: "bg-brand-500",
  success: "bg-success-500",
  danger: "bg-danger-500",
  warning: "bg-accent-500",
  neutral: "bg-slate-400",
  info: "bg-blue-500",
};

export default function Badge({
  variant = "neutral",
  children,
  dot = false,
  className = "",
}: BadgeProps) {
  return (
    <span className={`badge ${variants[variant]} ${className}`}>
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
      )}
      {children}
    </span>
  );
}
