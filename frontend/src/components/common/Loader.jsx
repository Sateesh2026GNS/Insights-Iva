import React from "react";

/**
 * Branded Full-Screen Black Loader displaying the Insights Iva multi-ring logo spinner (Image 2).
 * Rendered across all pages and modules.
 */
export default function Loader({ className = "" }) {
  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black transition-opacity duration-150 ${className}`}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      {/* Centered Branded Animated Spinner */}
      <div className="relative flex h-24 w-24 items-center justify-center">
        {/* Outer rotating segmented ring (Yellow & Blue & Green arcs) */}
        <svg
          className="absolute inset-0 h-full w-full animate-spin"
          viewBox="0 0 80 80"
          fill="none"
        >
          {/* Golden Yellow arc */}
          <path
            d="M40 8 A32 32 0 0 1 72 40"
            stroke="#e6a817"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          {/* Blue arc */}
          <path
            d="M72 40 A32 32 0 0 1 40 72"
            stroke="#0284c7"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          {/* Green / Teal arc */}
          <path
            d="M22 62 A32 32 0 0 1 8 40"
            stroke="#00733c"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        </svg>

        {/* Reverse subtle inner spinning arc */}
        <div className="absolute h-16 w-16 rounded-full border-2 border-transparent border-t-teal-400/80 border-b-sky-400/60 animate-spin-reverse" />

        {/* Center circular badge with brand logo */}
        <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-2xl border border-slate-700">
          <img
            src="/logo.png"
            alt="Insights Iva"
            className="h-8 w-8 object-contain animate-pulse"
          />
        </div>
      </div>
    </div>
  );
}
