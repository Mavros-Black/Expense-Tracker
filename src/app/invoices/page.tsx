"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";

type Transaction = {
  id: string;
  amount: number;
  currency: string;
  vendor: string | null;
  date: string;
  category: string | null;
  source: string;
  invoice_pdf_url?: string | null;
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

export default function InvoicesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

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

  useEffect(() => {
    const load = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch("/api/transactions", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        if (!res.ok) return;
        const json = (await res.json()) as { transactions: Transaction[] };
        setTransactions(json.transactions ?? []);
      } catch {
        // ignore
      }
    };

    load();
  }, [accessToken]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  const withInvoices = useMemo(
    () =>
      transactions
        .filter((t) => t.invoice_pdf_url)
        .sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime()
        ),
    [transactions]
  );

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 dark:bg-slate-100 dark:text-slate-900">
        <p className="text-sm text-slate-300 dark:text-slate-600">Loading invoices...</p>
      </main>
    );
  }

  return (
    <AppShell email={email} onSignOut={handleSignOut}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="mt-1 text-sm text-slate-300 dark:text-slate-600">
            PDF invoices pulled from your email receipts.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
        {withInvoices.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-600">
            No invoices with PDFs yet. Try syncing Gmail from Settings.
          </p>
        ) : (
          <div className="overflow-x-auto text-xs">
            <table className="min-w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 dark:border-slate-200 dark:text-slate-600">
                  <th className="py-2 pr-4 text-left font-normal">Date</th>
                  <th className="py-2 pr-4 text-left font-normal">Vendor</th>
                  <th className="py-2 pr-4 text-left font-normal">Category</th>
                  <th className="py-2 pr-4 text-right font-normal">Amount</th>
                  <th className="py-2 pr-4 text-right font-normal">Invoice</th>
                </tr>
              </thead>
              <tbody>
                {withInvoices.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-slate-900/60 hover:bg-slate-900/80 dark:border-slate-200 dark:hover:bg-slate-100"
                  >
                    <td className="py-2 pr-4 align-top text-slate-200 dark:text-slate-800">
                      {formatDate(t.date)}
                    </td>
                    <td className="py-2 pr-4 align-top text-slate-200 dark:text-slate-800">
                      {t.vendor || "Unknown vendor"}
                    </td>
                    <td className="py-2 pr-4 align-top text-slate-200 dark:text-slate-800">
                      {t.category || "Uncategorized"}
                    </td>
                    <td className="py-2 pr-4 align-top text-right text-slate-100 dark:text-slate-900">
                      {formatCurrency(Number(t.amount || 0), t.currency)}
                    </td>
                    <td className="py-2 pr-4 align-top text-right">
                      {t.invoice_pdf_url ? (
                        <a
                          href={t.invoice_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-emerald-400 hover:text-emerald-300 dark:text-emerald-600 dark:hover:text-emerald-500"
                        >
                          View PDF
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          -
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
