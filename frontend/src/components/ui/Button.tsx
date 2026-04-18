"use client";

import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import Link from "next/link";
import { SpinnerIcon } from "./IconSet";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand text-brand-foreground hover:opacity-90 active:scale-[0.98] shadow-sm shadow-brand/20",
  secondary:
    "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-brand/5 active:scale-[0.98]",
  ghost:
    "bg-transparent text-slate-500 hover:text-[var(--foreground)] hover:bg-brand/5 active:scale-[0.98]",
  danger:
    "bg-danger-600 text-white hover:bg-danger-700 active:scale-[0.98] shadow-sm shadow-danger-500/20",
  accent:
    "bg-accent text-white hover:opacity-90 active:scale-[0.98] shadow-sm shadow-accent/20",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3.5 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-5 py-2.5 text-sm rounded-xl gap-2",
  lg: "px-7 py-3.5 text-base rounded-2xl gap-2.5 font-bold",
};

const baseClasses =
  "inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

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
        {loading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : icon}
        {children}
      </button>
    );
  }
);

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  children: ReactNode;
  href: string;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  icon,
  children,
  className = "",
  href,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {icon}
      {children}
    </Link>
  );
}

Button.displayName = "Button";

export default Button;
