"use client";

import { ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { TopNav } from "@/components/top-nav-menu";

type AppShellProps = {
  email: string | null;
  onSignOut: () => void | Promise<void>;
  children: ReactNode;
};

export function AppShell({ email, onSignOut, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isActive = (href: string) => pathname === href;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex dark:bg-slate-100 dark:text-slate-900">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col text-slate-50 dark:border-slate-200 dark:bg-white dark:text-slate-900">
        <div className="text-lg font-semibold tracking-tight">Expense Tracker</div>
        <nav className="mt-6 space-y-2 text-sm">
          <button
            onClick={() => router.push("/dashboard")}
            className={
              "w-full text-left rounded-lg px-3 py-2 " +
              (isActive("/dashboard")
                ? "bg-slate-800 font-medium text-slate-50 dark:bg-slate-200 dark:text-slate-900"
                : "text-slate-100 hover:bg-slate-800 dark:text-slate-700 dark:hover:bg-slate-100")
            }
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push("/transactions")}
            className={
              "w-full text-left rounded-lg px-3 py-2 " +
              (isActive("/transactions")
                ? "bg-slate-800 font-medium text-slate-50 dark:bg-slate-200 dark:text-slate-900"
                : "text-slate-100 hover:bg-slate-800 dark:text-slate-700 dark:hover:bg-slate-100")
            }
          >
            Transactions
          </button>
          <button
            onClick={() => router.push("/invoices")}
            className={
              "w-full text-left rounded-lg px-3 py-2 " +
              (isActive("/invoices")
                ? "bg-slate-800 font-medium text-slate-50 dark:bg-slate-200 dark:text-slate-900"
                : "text-slate-100 hover:bg-slate-800 dark:text-slate-700 dark:hover:bg-slate-100")
            }
          >
            Invoices
          </button>
          <button
            onClick={() => router.push("/rules")}
            className={
              "w-full text-left rounded-lg px-3 py-2 " +
              (isActive("/rules")
                ? "bg-slate-800 font-medium text-slate-50 dark:bg-slate-200 dark:text-slate-900"
                : "text-slate-100 hover:bg-slate-800 dark:text-slate-700 dark:hover:bg-slate-100")
            }
          >
            Rules
          </button>
          <button
            onClick={() => router.push("/settings")}
            className={
              "w-full text-left rounded-lg px-3 py-2 " +
              (isActive("/settings")
                ? "bg-slate-800 font-medium text-slate-50 dark:bg-slate-200 dark:text-slate-900"
                : "text-slate-100 hover:bg-slate-800 dark:text-slate-700 dark:hover:bg-slate-100")
            }
          >
            Settings
          </button>
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-200 text-xs text-slate-400 space-y-2 dark:border-slate-800 dark:text-slate-500">
          <p>{email}</p>
          <button
            onClick={onSignOut}
            className="text-left text-slate-300 hover:text-white dark:text-slate-700 dark:hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </aside>

      <section className="flex-1 p-8 space-y-6">
        <TopNav email={email} />
        {children}
      </section>
    </main>
  );
}
