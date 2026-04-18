"use client";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "w-5 h-5", md: "w-8 h-8", lg: "w-12 h-12" };

export default function Spinner({ size = "md", className = "" }: SpinnerProps) {
  return (
    <div className={`${sizes[size]} ${className}`}>
      <svg className="animate-spin" viewBox="0 0 24 24" fill="none">
        <circle
          className="opacity-20"
          cx="12" cy="12" r="10"
          stroke="currentColor" strokeWidth="4"
        />
        <path
          className="opacity-80"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
    </div>
  );
}
