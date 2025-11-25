"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";
import { motion } from "framer-motion";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type Transaction = {
  id: string;
  amount: number;
  currency: string;
  vendor: string | null;
  date: string;
  category: string | null;
  source: string;
};

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        router.replace("/auth/signin");
        return;
      }
      setEmail(data.session.user.email ?? null);
      setAccessToken(data.session.access_token);
      setLoading(false);
    };

    init();
  }, [router]);

  async function loadTransactions(token: string) {
    try {
      const res = await fetch("/api/transactions?period=month", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) return;
      const json = (await res.json()) as { transactions: Transaction[] };
      setTransactions(json.transactions ?? []);
    } catch {
      
    }
  }

  useEffect(() => {
    if (!accessToken) return;
    loadTransactions(accessToken);
  }, [accessToken]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function handleSyncGmail() {
    if (!accessToken) return;
    setGmailSyncing(true);
    setGmailStatus(null);
    try {
      const res = await fetch("/api/gmail/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const json = await res.json();
      if (!res.ok) {
        setGmailStatus(json.error || "Failed to sync Gmail");
      } else {
        setGmailStatus(`Synced ${json.inserted ?? 0} transactions from Gmail`);
        await loadTransactions(accessToken);
      }
    } catch {
      setGmailStatus("Failed to sync Gmail");
    } finally {
      setGmailSyncing(false);
    }
  }

  const totalSpend = useMemo(
    () =>
      transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0),
    [transactions]
  );

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      const key = t.category || "Uncategorized";
      map.set(key, (map.get(key) ?? 0) + Number(t.amount || 0));
    }
    return map;
  }, [transactions]);

  const topCategory = useMemo(() => {
    let best: { name: string; value: number } | null = null;
    for (const [name, value] of Array.from(byCategory.entries())) {
      if (!best || value > best.value) {
        best = { name, value };
      }
    }
    return best;
  }, [byCategory]);

  const trendData = useMemo(() => {
    if (!transactions.length) return null;
    const map = new Map<string, number>();
    for (const t of transactions) {
      const d = new Date(t.date).toISOString().slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + Number(t.amount || 0));
    }
    const dates = Array.from(map.keys()).sort();
    const data = dates.map((d) => map.get(d) ?? 0);
    return {
      labels: dates,
      datasets: [
        {
          label: "Daily spend",
          data,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,0.15)",
          tension: 0.3,
          fill: true
        }
      ]
    };
  }, [transactions]);

  const recent = useMemo(
    () =>
      [...transactions]
        .sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        )
        .slice(0, 6),
    [transactions]
  );

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 dark:bg-slate-100 dark:text-slate-900">
        <p className="text-sm text-slate-300 dark:text-slate-600">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <AppShell email={email} onSignOut={handleSignOut}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 text-sm text-slate-300 dark:text-slate-600">
            Snapshot of your spending in the last 30 days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSyncGmail}
            disabled={gmailSyncing || !accessToken}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60 dark:border-slate-400 dark:text-slate-800 dark:hover:bg-slate-200"
          >
            {gmailSyncing ? "Syncing..." : "Auto sync now"}
          </button>
        </div>
      </div>

      {gmailStatus && (
        <p className="mt-1 text-xs text-slate-300 dark:text-slate-600">{gmailStatus}</p>
      )}

      <motion.div
        className="grid gap-4 md:grid-cols-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
          <p className="text-xs text-slate-400 dark:text-slate-500">Total spend (30 days)</p>
          <p className="mt-2 text-xl font-semibold">
            {formatCurrency(totalSpend)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
          <p className="text-xs text-slate-400 dark:text-slate-500">Transactions (30 days)</p>
          <p className="mt-2 text-xl font-semibold">{transactions.length}</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
          <p className="text-xs text-slate-400 dark:text-slate-500">Top category</p>
          <p className="mt-2 text-xl font-semibold">
            {topCategory ? topCategory.name : "No data yet"}
          </p>
        </div>
      </motion.div>

      <motion.div
        className="grid gap-6 lg:grid-cols-3"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 lg:col-span-2 dark:border-slate-300/60 dark:bg-white">
          <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">
            Spending over time
          </h2>
          <div className="mt-4 h-64">
            {trendData ? (
              <Line
                data={trendData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { grid: { color: "#1e293b" } },
                    y: { grid: { color: "#1e293b" } }
                  }
                }}
              />
            ) : (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Add some transactions to see the trend.
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
          <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">
            Recent transactions
          </h2>
          <div className="mt-4 space-y-3 text-xs">
            {recent.length === 0 ? (
              <p className="text-slate-400 dark:text-slate-500">
                No transactions yet.
              </p>
            ) : (
              recent.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-800/60 bg-slate-950/60 px-3 py-2 dark:border-slate-200/60 dark:bg-slate-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-slate-100 text-[13px] dark:text-slate-800">
                      {t.vendor || "Unknown vendor"}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {formatDate(t.date)}   b7 {t.source}
                    </p>
                  </div>
                  <p className="text-[13px] font-medium text-slate-50 dark:text-slate-900">
                    {formatCurrency(Number(t.amount || 0), t.currency)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </AppShell>
  );
}
