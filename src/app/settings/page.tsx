"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { AppShell } from "@/components/app-shell";

type MailAccount = {
  id: string;
  provider: string;
  email: string | null;
  created_at: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult] = useState<string | null>(null);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<string | null>(null);
  const [dangerResult, setDangerResult] = useState<string | null>(null);
  const [mailAccounts, setMailAccounts] = useState<MailAccount[]>([]);

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
    const loadAccounts = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch("/api/mail/accounts", {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        });
        if (!res.ok) return;
        const json = (await res.json()) as { accounts: MailAccount[] };
        setMailAccounts(json.accounts ?? []);
      } catch {
        // ignore
      }
    };

    loadAccounts();
  }, [accessToken]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function handleConnectGmail() {
    if (!accessToken) return;
    setGmailStatus(null);
    try {
      const res = await fetch("/api/gmail/init", {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!res.ok) {
        setGmailStatus("Failed to start Gmail OAuth");
        return;
      }
      const json = (await res.json()) as { url?: string };
      if (json.url) {
        window.location.href = json.url;
      } else {
        setGmailStatus("No Gmail OAuth URL returned");
      }
    } catch {
      setGmailStatus("Failed to start Gmail OAuth");
    }
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
        const inserted = json.inserted ?? 0;
        const pdfs = json.pdfsStored ?? 0;
        const totalForUser = json.totalForUser as number | null | undefined;

        const parts: string[] = [];
        if (pdfs) {
          parts.push(`${pdfs} PDFs stored`);
        }
        if (typeof totalForUser === "number") {
          parts.push(`${totalForUser} total transactions for your account`);
        }

        const extra = parts.length ? ` (${parts.join(", ")})` : "";
        setGmailStatus(`Synced ${inserted} transactions from Gmail${extra}`);
      }
    } catch {
      setGmailStatus("Failed to sync Gmail");
    } finally {
      setGmailSyncing(false);
    }
  }

  async function handleCsvUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;
    const form = event.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;

    setCsvUploading(true);
    setCsvResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/transactions/import-csv", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        body: formData
      });
      const json = await res.json();
      if (!res.ok) {
        setCsvResult(json.error || "Failed to import CSV");
      } else {
        setCsvResult(`Imported ${json.imported ?? 0} rows from CSV`);
        form.reset();
      }
    } catch {
      setCsvResult("Failed to import CSV");
    } finally {
      setCsvUploading(false);
    }
  }

  async function handleDisconnectGmail() {
    if (!accessToken) return;
    setDangerResult(null);
    try {
      const res = await fetch("/api/gmail/disconnect", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const json = await res.json();
      if (!res.ok) {
        setDangerResult(json.error || "Failed to disconnect Gmail");
      } else {
        setDangerResult("Gmail disconnected and tokens removed.");
      }
    } catch {
      setDangerResult("Failed to disconnect Gmail");
    }
  }

  async function handleDeleteData() {
    if (!accessToken) return;
    if (!window.confirm("Delete all your transactions, rules, and Gmail data?")) {
      return;
    }
    setDangerResult(null);
    try {
      const res = await fetch("/api/user/delete-data", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const json = await res.json();
      if (!res.ok) {
        setDangerResult(json.error || "Failed to delete data");
      } else {
        setDangerResult("All transactions, rules, and Gmail tokens deleted.");
      }
    } catch {
      setDangerResult("Failed to delete data");
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
        <p className="text-sm text-slate-300">Loading settings...</p>
      </main>
    );
  }

  return (
    <AppShell email={email} onSignOut={handleSignOut}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 text-sm text-slate-300 dark:text-slate-600">
              Manage integrations, imports, and data.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
            <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">Email integrations</h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">
              Connect email accounts (starting with Gmail) to automatically pull receipt
              emails.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <button
                type="button"
                onClick={handleConnectGmail}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
              >
                Connect Gmail account
              </button>
              <button
                type="button"
                onClick={handleSyncGmail}
                disabled={gmailSyncing}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800 disabled:opacity-60 dark:border-slate-400 dark:text-slate-800 dark:hover:bg-slate-200"
              >
                {gmailSyncing ? "Syncing..." : "Sync now"}
              </button>
            </div>
            {gmailStatus && (
              <p className="mt-3 text-xs text-slate-300 dark:text-slate-600">{gmailStatus}</p>
            )}

            <div className="mt-4 rounded-lg border border-slate-800/80 bg-slate-900/60 p-3 text-xs dark:border-slate-300/60 dark:bg-white">
              <p className="text-[11px] font-medium text-slate-300 dark:text-slate-700">
                Connected accounts
              </p>
              <div className="mt-2 space-y-1">
                {mailAccounts.length === 0 ? (
                  <p className="text-slate-500">No email accounts connected yet.</p>
                ) : (
                  mailAccounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between rounded border border-slate-800/60 bg-slate-950/40 px-2 py-1 dark:border-slate-300/60 dark:bg-slate-50"
                    >
                      <div>
                        <p className="text-slate-100 dark:text-slate-900">
                          {account.email || "Unknown address"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Provider: {account.provider}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (!accessToken) return;
                          const res = await fetch("/api/mail/accounts", {
                            method: "DELETE",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${accessToken}`
                            },
                            body: JSON.stringify({ id: account.id })
                          });
                          if (!res.ok) return;
                          setMailAccounts((prev) =>
                            prev.filter((a) => a.id !== account.id)
                          );
                        }}
                        className="rounded border border-slate-600 px-2 py-1 text-[10px] text-slate-200 hover:bg-slate-800 dark:border-slate-400 dark:text-slate-800 dark:hover:bg-slate-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
            <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">CSV import</h2>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-600">
              Upload CSV bank statements to backfill transactions.
            </p>
            <form onSubmit={handleCsvUpload} className="mt-4 space-y-3 text-sm">
              <input
                type="file"
                name="file"
                accept=".csv,text/csv"
                className="block w-full text-xs text-slate-200 file:mr-2 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-2 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700 dark:text-slate-900 dark:file:bg-slate-100 dark:file:text-slate-900 dark:hover:file:bg-slate-200"
              />
              <button
                type="submit"
                disabled={csvUploading}
                className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {csvUploading ? "Importing..." : "Import CSV"}
              </button>
            </form>
            {csvResult && (
              <p className="mt-3 text-xs text-slate-300 dark:text-slate-600">{csvResult}</p>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 dark:border-red-300 dark:bg-red-50">
          <h2 className="text-sm font-medium text-red-300 dark:text-red-700">Danger zone</h2>
          <p className="mt-1 text-xs text-red-200/80 dark:text-red-700">
            Disconnect Gmail or delete all your expense data. This cannot be undone.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <button
              type="button"
              onClick={handleDisconnectGmail}
              className="rounded-lg border border-red-500/70 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-500/10"
            >
              Disconnect Gmail
            </button>
            <button
              type="button"
              onClick={handleDeleteData}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-red-50 hover:bg-red-500"
            >
              Delete all data
            </button>
          </div>
          {dangerResult && (
            <p className="mt-3 text-xs text-red-100/90">{dangerResult}</p>
          )}
        </div>
    </AppShell>
  );
}
