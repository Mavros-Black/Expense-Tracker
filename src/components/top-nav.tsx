"use client";

import { motion } from "framer-motion";
import { DarkModeToggle } from "./dark-mode-toggle";

type TopNavProps = {
  email: string | null;
};

export function TopNav({ email }: TopNavProps) {
  const initials = email ? email.charAt(0).toUpperCase() : "?";

  return (
    <motion.div
      className="mb-6 flex items-center justify-end gap-4"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <button
        type="button"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-xs text-slate-300 shadow-sm hover:bg-slate-800 dark:border-slate-300/70 dark:bg-slate-100 dark:text-slate-900"
        aria-label="Notifications"
      >
        b7
      </button>
      <DarkModeToggle />
      <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100 shadow-sm dark:border-slate-300/70 dark:bg-slate-100 dark:text-slate-900">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-semibold text-emerald-950">
          {initials}
        </div>
        <div className="max-w-[160px] truncate">
          <p className="truncate font-medium">{email ?? "User"}</p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500">Signed in</p>
        </div>
      </div>
    </motion.div>
  );
}
