import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="max-w-xl w-full px-6 py-8 rounded-2xl bg-slate-900 shadow-xl border border-slate-800">
        <h1 className="text-3xl font-semibold tracking-tight">
          Automated Expense Tracker
        </h1>
        <p className="mt-3 text-sm text-slate-300">
          Connect Gmail and SMS to automatically pull receipts and visualize your
          spending.
        </p>
        <div className="mt-6 flex gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:bg-emerald-400"
          >
            Go to dashboard
          </Link>
          <Link
            href="/auth/signin"
            className="inline-flex items-center justify-center rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
