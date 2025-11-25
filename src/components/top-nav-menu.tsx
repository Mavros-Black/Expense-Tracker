"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { DarkModeToggle } from "./dark-mode-toggle";
import { supabase } from "@/lib/supabaseClient";

type TopNavProps = {
  email: string | null;
};

type SearchTransaction = {
  id: string;
  vendor: string | null;
  amount: number;
  currency: string;
  date: string;
  category: string | null;
  source: string;
};

export function TopNav({ email }: TopNavProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [txResults, setTxResults] = useState<SearchTransaction[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const searchItems = [
    {
      label: "Dashboard",
      description: "Overall spending overview and recent activity.",
      path: "/dashboard"
    },
    {
      label: "Transactions",
      description: "Browse, filter, and recategorize all transactions.",
      path: "/transactions"
    },
    {
      label: "Rules",
      description: "Automation rules for categorizing transactions.",
      path: "/rules"
    },
    {
      label: "Settings",
      description: "Email integrations, CSV import, and danger zone.",
      path: "/settings"
    },
    {
      label: "Profile",
      description: "Your account details and sign-out options.",
      path: "/profile"
    },
    {
      label: "Billing",
      description: "Current plan and billing information.",
      path: "/billing"
    }
  ];

  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, []);

  const displayEmail = email ?? "User";
  const initials = displayEmail
    .split("@")[0]
    .split(/[._\s]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase())
    .join("")
    .slice(0, 2) || "U";

  function formatCurrencySmall(amount: number, currency = "USD") {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  }

  function formatDateSmall(value: string) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const results = normalizedQuery
    ? searchItems.filter((item) =>
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.description.toLowerCase().includes(normalizedQuery)
      )
    : searchItems;

  async function runSearch() {
    const q = searchQuery.trim();
    setIsSearchOpen(true);
    setSearchError(null);
    setTxResults([]);
    if (!q) {
      setSearchLoading(false);
      return;
    }
    if (!accessToken) {
      setSearchLoading(false);
      setSearchError("Sign in again to search transactions.");
      return;
    }
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({ q });
      const res = await fetch(`/api/transactions?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      if (!res.ok) {
        setSearchError("Failed to search transactions.");
        setTxResults([]);
      } else {
        const json = (await res.json()) as { transactions?: SearchTransaction[] };
        const txs = Array.isArray(json.transactions) ? json.transactions : [];
        setTxResults(txs.slice(0, 10));
      }
    } catch {
      setSearchError("Failed to search transactions.");
      setTxResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  return (
    <>
      <motion.header
        className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-sm dark:border-slate-300/60 dark:bg-white"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <div className="flex flex-1 items-center justify-start">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch();
              }
            }}
            placeholder="Search..."
            className="hidden sm:block w-full max-w-xs rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-3">
          <DarkModeToggle />

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 dark:border-slate-400/60 dark:bg-slate-100 dark:text-slate-900"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-800 dark:border-slate-400/60 dark:bg-slate-100 dark:text-slate-900"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-slate-50 dark:bg-slate-900 dark:text-slate-100">
                {initials}
              </span>
              <span className="text-[10px] opacity-70">{menuOpen ? "▲" : "▼"}</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-slate-800 bg-slate-900 py-1 text-xs text-slate-100 shadow-lg dark:border-slate-200 dark:bg-white dark:text-slate-900">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/profile");
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-800 dark:hover:bg-slate-100"
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/billing");
                  }}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-800 dark:hover:bg-slate-100"
                >
                  Billing
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {isSearchOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40 px-4 pt-24">
          <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-slate-50 shadow-xl dark:border-slate-300 dark:bg-white dark:text-slate-900">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2 text-xs dark:border-slate-200">
              <div>
                <p className="font-medium">Search results</p>
                {searchQuery && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-600">
                    for "{searchQuery}"
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsSearchOpen(false)}
                className="rounded px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 dark:text-slate-600 dark:hover:bg-slate-100"
              >
                Close
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto px-2 py-2 text-sm">
              {searchLoading ? (
                <p className="px-2 py-3 text-xs text-slate-400 dark:text-slate-600">
                  Searching transactions...
                </p>
              ) : searchError ? (
                <p className="px-2 py-3 text-xs text-red-300 dark:text-red-600">
                  {searchError}
                </p>
              ) : (
                <>
                  {normalizedQuery && txResults.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-slate-400 dark:text-slate-600">
                      No transactions match your search.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {txResults.map((t) => (
                        <div
                          key={t.id}
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-xs hover:bg-slate-900/70 dark:hover:bg-slate-100"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">
                              {t.vendor || "Unknown vendor"}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-600">
                              {formatDateSmall(t.date)} {" · "}
                              {t.category || "Uncategorized"} {" · "}
                              {t.source}
                            </p>
                          </div>
                          <p className="ml-2 text-[13px] font-medium">
                            {formatCurrencySmall(Number(t.amount || 0), t.currency)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 border-t border-slate-800 pt-2 text-[11px] text-slate-400 dark:border-slate-200 dark:text-slate-600">
                    <p className="mb-1 font-medium text-[11px] text-slate-300 dark:text-slate-700">
                      Quick links
                    </p>
                    <div className="space-y-1">
                      {results.map((item) => (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => {
                            setIsSearchOpen(false);
                            router.push(item.path);
                          }}
                          className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-900/70 dark:hover:bg-slate-100"
                        >
                          <span className="text-[13px] font-medium">{item.label}</span>
                          <span className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-600">
                            {item.description}
                          </span>
                          <span className="mt-1 text-[10px] text-slate-500 dark:text-slate-500">
                            Go to {item.path}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
