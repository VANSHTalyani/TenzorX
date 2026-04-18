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

      <footer className="border-t border-[var(--border)] bg-[var(--card)] py-12 text-center text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
          <p className="leading-relaxed opacity-80">
            TenzorX Analytics Infrastructure · Enterprise Risk Management
          </p>
          <div className="mt-6 flex justify-center gap-10">
            <span className="hover:text-brand transition-colors cursor-pointer">Security Suite</span>
            <span className="hover:text-brand transition-colors cursor-pointer">Compliance</span>
            <span className="hover:text-brand transition-colors cursor-pointer">API Docs</span>
          </div>
          <p className="mt-10 font-bold text-brand opacity-60 italic">Built for the future of fintech.</p>
        </div>
      </footer>
    </div>
  );
}
