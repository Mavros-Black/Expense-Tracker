"use client";

import { useTheme } from "./theme-provider";

export function DarkModeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-medium text-slate-200 shadow-sm hover:bg-slate-800 dark:border-slate-400/60 dark:bg-slate-100 dark:text-slate-900"
    >
      <span
        className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400"
        aria-hidden
      />
      <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
    </button>
  );
}
