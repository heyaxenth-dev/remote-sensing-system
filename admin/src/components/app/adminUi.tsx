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
    neutral:
      "bg-gray-100 text-gray-800 dark:bg-white/10 dark:text-gray-300",
    warn: "bg-orange-100 text-orange-900 dark:bg-orange-500/15 dark:text-orange-300",
    success:
      "bg-emerald-100 text-emerald-900 dark:bg-lime-500/15 dark:text-lime-200",
    danger: "bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300",
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
      className={`rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 shadow-theme-xs transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-transparent dark:text-gray-200 dark:shadow-none dark:hover:bg-white/5 dark:hover:text-white ${className}`}
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
