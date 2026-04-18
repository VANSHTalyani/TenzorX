"use client";

import { CheckIcon } from "./IconSet";

interface Step {
  label: string;
  description?: string;
}

export default function StepIndicator({
  steps,
  current,
}: {
  steps: Step[];
  current: number;
}) {
  return (
    <div className="flex w-full items-center">
      {steps.map((step, idx) => {
        const isCompleted = idx < current;
        const isActive = idx === current;

        return (
          <div key={idx} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-2">
              <div
                className={[
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500",
                  isCompleted
                    ? "bg-brand border-brand text-brand-foreground shadow-soft"
                    : isActive
                      ? "bg-[var(--card)] border-brand text-brand shadow-md"
                      : "bg-[var(--card)] border-surface-200 text-slate-400",
                ].join(" ")}
              >
                {isCompleted ? (
                  <CheckIcon className="h-6 w-6 stroke-[3]" />
                ) : (
                  <span className="text-sm font-bold">{idx + 1}</span>
                )}
              </div>
              <div className="hidden sm:block text-center">
                <p
                  className={[
                    "text-[10px] font-bold uppercase tracking-widest transition-colors",
                    isActive ? "text-brand" : "text-slate-500",
                  ].join(" ")}
                >
                  {step.label}
                </p>
              </div>
            </div>

            {idx < steps.length - 1 && (
              <div className="mx-4 h-0.5 flex-1 bg-[var(--border)] relative overflow-hidden">
                <div
                  className="absolute inset-0 bg-brand transition-all duration-700 ease-in-out"
                  style={{
                    width: isCompleted ? "100%" : "0%",
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
