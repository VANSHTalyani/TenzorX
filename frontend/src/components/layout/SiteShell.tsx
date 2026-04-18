"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { MoonIcon, SunIcon } from "@/components/ui/IconSet";

const nav = [
  { href: "/", label: "Home" },
  { href: "/onboard?campaign=DEMO-2026&channel=link", label: "Onboard" },
  { href: "/operator", label: "Operator" },
];

export default function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  // Default to dark as requested
  const [isDark, setIsDark] = useState(true);

  // Initialize theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "light") {
      setIsDark(false);
      document.documentElement.classList.remove("dark");
    } else {
      // Default or "dark" -> stay dark
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] transition-colors duration-300">
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md h-16 sm:h-20">
        <div className="mx-auto flex h-full w-full items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand text-brand-foreground font-bold shadow-soft transition-transform group-hover:scale-105">
              TX
            </span>
            <span className="hidden sm:inline font-black text-xl tracking-tighter text-[var(--foreground)]">
              TenzorX
            </span>
          </Link>

          <nav className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1 mr-4">
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
                      "rounded-xl px-4 py-2.5 text-sm font-bold transition-all",
                      active
                        ? "bg-brand text-brand-foreground shadow-sm shadow-brand/20"
                        : "text-slate-500 hover:text-[var(--foreground)] hover:bg-brand/5 dark:hover:bg-brand-900/40",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
            
            <div className="h-8 w-px bg-[var(--border)] mx-2 hidden sm:block" />
            
            <button
              onClick={toggleTheme}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] text-slate-500 hover:text-[var(--foreground)] hover:bg-brand/5 dark:hover:bg-brand-900/40 transition-all shadow-sm"
              aria-label="Toggle theme"
            >
              {isDark ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 overflow-x-hidden">{children}</main>

      <footer className="border-t border-[var(--border)] bg-[var(--card)]/50 pt-16 pb-8">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-8 mb-16">
            <div className="md:col-span-2">
              <Link href="/" className="flex items-center gap-3 group mb-4 inline-flex">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-brand-foreground font-bold text-xs shadow-soft transition-transform group-hover:scale-105">
                  TX
                </span>
                <span className="font-black text-lg tracking-tighter text-[var(--foreground)]">
                  TenzorX
                </span>
              </Link>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed mb-6">
                Next-generation video origination platform. Built for auditability, enterprise risk management, and modular backends.
              </p>
            </div>
            
            <div>
              <h4 className="font-bold text-[var(--foreground)] mb-4 text-sm tracking-wide">Platform</h4>
              <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                <li><Link href="/onboard?campaign=DEMO-2026&channel=link" className="hover:text-[var(--foreground)] transition-colors">Start Onboarding</Link></li>
                <li><Link href="/operator" className="hover:text-[var(--foreground)] transition-colors">Operator Console</Link></li>
                <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">Analytics Engine</a></li>
                <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">Risk & Policy</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-[var(--foreground)] mb-4 text-sm tracking-wide">Developers & Trust</h4>
              <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">API Documentation</a></li>
                <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">Compliance Hub</a></li>
                <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">Security Suite</a></li>
                <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">System Status</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-[var(--border)] pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium tracking-wide">
              © 2026 TenzorX Technologies. Built for the future of fintech.
            </p>
            <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <a href="#" className="hover:text-[var(--foreground)] transition-colors">Privacy</a>
              <a href="#" className="hover:text-[var(--foreground)] transition-colors">Terms</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
