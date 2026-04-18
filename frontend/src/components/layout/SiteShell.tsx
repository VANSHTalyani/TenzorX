"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const nav = [
  { href: "/", label: "Home" },
  { href: "/onboard?campaign=DEMO-2026&channel=link", label: "Onboard" },
  { href: "/operator", label: "Operator" },
];

export default function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 border-b border-surface-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-brand-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm text-white">
              PF
            </span>
            <span className="hidden sm:inline">Loan Wizard</span>
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            {nav.map((item) => {
              const base = item.href.split("?")[0] || item.href;
              const active =
                base === "/"
                  ? pathname === "/"
                  : pathname === base || pathname?.startsWith(`${base}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-surface-100 hover:text-slate-900",
                  ].join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-surface-200 bg-white py-8 text-center text-xs text-slate-500">
        <p className="mx-auto max-w-2xl px-4">
          Demo application for video-based loan origination. Processing is
          illustrative; not a binding credit decision.
        </p>
        <p className="mt-2">© {new Date().getFullYear()} Poonawalla Loan Wizard</p>
      </footer>
    </div>
  );
}
