"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TopNav } from "@/components/top-nav-menu";

export default function BillingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        router.replace("/auth/signin");
        return;
      }
      setEmail(data.session.user.email ?? null);
      setLoading(false);
    };

    init();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 dark:bg-slate-100 dark:text-slate-900">
        <p className="text-sm text-slate-300 dark:text-slate-600">Loading billing...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex dark:bg-slate-100 dark:text-slate-900">
      <aside className="w-64 border-r border-slate-800 bg-slate-900/60 p-4 flex flex-col text-slate-50 dark:border-slate-200 dark:bg-white dark:text-slate-900">
        <div className="text-lg font-semibold tracking-tight">Expense Tracker</div>
        <nav className="mt-6 space-y-2 text-sm">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full text-left rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800 dark:text-slate-700 dark:hover:bg-slate-100"
          >
            Dashboard
          </button>
          <button
            onClick={() => router.push("/transactions")}
            className="w-full text-left rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800 dark:text-slate-700 dark:hover:bg-slate-100"
          >
            Transactions
          </button>
          <button
            onClick={() => router.push("/rules")}
            className="w-full text-left rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800 dark:text-slate-700 dark:hover:bg-slate-100"
          >
            Rules
          </button>
          <button
            onClick={() => router.push("/settings")}
            className="w-full text-left rounded-lg px-3 py-2 text-slate-100 hover:bg-slate-800 dark:text-slate-700 dark:hover:bg-slate-100"
          >
            Settings
          </button>
        </nav>
        <div className="mt-auto pt-4 border-t border-slate-200 text-xs text-slate-400 space-y-2 dark:border-slate-800 dark:text-slate-500">
          <p>{email}</p>
          <button
            onClick={handleSignOut}
            className="text-left text-slate-300 hover:text-white dark:text-slate-700 dark:hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </aside>
      <section className="flex-1 p-8 space-y-6">
        <TopNav email={email} />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
            <p className="mt-1 text-sm text-slate-300 dark:text-slate-600">
              View your current plan and billing details.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
            <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">Current plan</h2>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-600">
              Billing is not yet connected. You are on the default plan.
            </p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-slate-600">Plan</span>
                <span className="font-medium text-slate-100 dark:text-slate-900">Free</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 dark:text-slate-600">Status</span>
                <span className="font-medium text-emerald-400 dark:text-emerald-600">Active</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
            <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">Invoices</h2>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-600">
              When you upgrade in the future, your invoices will appear here.
            </p>
            <div className="mt-4 rounded-lg border border-slate-800/60 bg-slate-950/40 p-3 text-xs dark:border-slate-200 dark:bg-slate-50">
              <p className="text-slate-400 dark:text-slate-600">No invoices yet.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
