import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Shared layout tokens for DENR-style admin screens */

export function AdminCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-[#1e1e1e] ${className}`}
    >
      {children}
    </div>
  );
}

export function AdminBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "success" | "danger";
}) {
  const tones = {
    neutral: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
    warn: "bg-orange-500/15 text-orange-300",
    success: "bg-lime-500/15 text-lime-200",
    danger: "bg-red-500/15 text-red-300",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function OutlineButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rounded-xl border border-gray-500/60 bg-transparent px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:bg-white/5 dark:border-gray-600 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`rounded-xl bg-lime-500 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-lime-400 disabled:opacity-50 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
