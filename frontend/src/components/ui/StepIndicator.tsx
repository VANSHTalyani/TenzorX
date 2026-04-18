"use client";

interface Step {
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  current: number;
  className?: string;
}

export default function StepIndicator({
  steps,
  current,
  className = "",
}: StepIndicatorProps) {
  return (
    <nav className={`flex items-center ${className}`}>
      {steps.map((step, i) => {
        const state: "done" | "active" | "upcoming" =
          i < current ? "done" : i === current ? "active" : "upcoming";

        return (
          <div key={i} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors duration-200",
                  state === "done" && "bg-success-500 text-white",
                  state === "active" &&
                    "bg-brand text-white ring-4 ring-brand-100",
                  state === "upcoming" && "bg-surface-200 text-slate-400",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {state === "done" ? (
                  <CheckIcon />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={[
                  "text-[11px] font-medium whitespace-nowrap max-w-[72px] text-center leading-tight",
                  state === "active" ? "text-brand-600" : "text-slate-400",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={[
                  "w-10 md:w-16 h-0.5 mx-1 mt-[-16px] transition-colors duration-300",
                  i < current ? "bg-success-500" : "bg-surface-200",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}
