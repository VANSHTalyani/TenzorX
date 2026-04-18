"use client";

import Link from "next/link";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "inverse";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-dark active:bg-brand-800 focus-visible:ring-brand-300",
  secondary:
    "bg-surface-100 text-slate-700 hover:bg-surface-200 active:bg-surface-300 border border-surface-200 focus-visible:ring-surface-300",
  ghost:
    "bg-transparent text-slate-600 hover:bg-surface-100 active:bg-surface-200 focus-visible:ring-surface-300",
  danger:
    "bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-700 focus-visible:ring-danger-500",
  accent:
    "bg-accent text-white hover:bg-accent-600 active:bg-accent-700 focus-visible:ring-accent-300",
  inverse:
    "bg-white/10 text-white border border-white/25 hover:bg-white/20 focus-visible:ring-white/40",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-md gap-1.5",
  md: "px-4 py-2.5 text-sm rounded-lg gap-2",
  lg: "px-6 py-3 text-base rounded-lg gap-2.5",
};

const baseClasses =
  "inline-flex items-center justify-center font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

export function buttonClasses(
  variant: Variant = "primary",
  size: Size = "md",
  extra = ""
): string {
  return [baseClasses, variantClasses[variant], sizeClasses[size], extra]
    .filter(Boolean)
    .join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      disabled,
      icon,
      children,
      className = "",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={buttonClasses(variant, size, className)}
        {...props}
      >
        {loading ? <Spinner /> : icon}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

interface ButtonLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
}

function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClasses(variant, size, className)} {...props}>
      {icon}
      {children}
    </Link>
  );
}

export { ButtonLink };
export default Button;

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
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
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
