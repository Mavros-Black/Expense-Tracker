"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TopNav } from "@/components/top-nav-menu";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        router.replace("/auth/signin");
        return;
      }
      const user = data.session.user;
      setEmail(user.email ?? null);
      setUserId(user.id);
      const meta = (user.user_metadata ?? {}) as any;
      setName((meta.full_name as string) || "");
      setLocation((meta.location as string) || "");
      setAvatarUrl((meta.avatar_url as string) || null);
      setLoading(false);
    };

    init();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function handleSaveProfile() {
    if (!email) return;
    setSaving(true);
    setProfileMessage(null);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: {
          full_name: name,
          location,
          avatar_url: avatarUrl
        }
      });
      if (error) {
        setProfileMessage(error.message || "Failed to update profile");
        return;
      }
      const user = data.user;
      if (user) {
        const meta = (user.user_metadata ?? {}) as any;
        setName((meta.full_name as string) || "");
        setLocation((meta.location as string) || "");
        setAvatarUrl((meta.avatar_url as string) || null);
      }
      setProfileMessage("Profile updated");
    } catch {
      setProfileMessage("Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    setAvatarUploading(true);
    setProfileMessage(null);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${Date.now()}.${ext}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        setProfileMessage(uploadError.message || "Failed to upload avatar");
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;
      setAvatarUrl(publicUrl);

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: name,
          location,
          avatar_url: publicUrl
        }
      });

      if (updateError) {
        setProfileMessage(updateError.message || "Failed to save avatar");
        return;
      }

      setProfileMessage("Avatar updated");
    } catch {
      setProfileMessage("Failed to upload avatar");
    } finally {
      setAvatarUploading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-50 dark:bg-slate-100 dark:text-slate-900">
        <p className="text-sm text-slate-300 dark:text-slate-600">Loading profile...</p>
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
            <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
            <p className="mt-1 text-sm text-slate-300 dark:text-slate-600">
              Manage your account details.
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
            <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">Account</h2>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-600">
              Basic information about your account.
            </p>
            <div className="mt-4 space-y-4 text-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-800 text-sm font-medium text-slate-100 dark:border-slate-300 dark:bg-slate-200 dark:text-slate-800">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt="Profile picture"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (name || email || "?").charAt(0).toUpperCase()
                  )}
                </div>
                <div className="space-y-1 text-xs">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    disabled={avatarUploading}
                    className="block w-full text-[11px] text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-slate-100 hover:file:bg-slate-700 dark:text-slate-800 dark:file:bg-slate-200 dark:file:text-slate-900"
                  />
                  <p className="text-[11px] text-slate-500 dark:text-slate-500">
                    {avatarUploading ? "Uploading avatar..." : "Upload a square image for best results."}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 dark:text-slate-600">
                  Full name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 dark:text-slate-600">
                  Location
                </label>
                <input
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                  placeholder="City, Country"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 dark:border-slate-300 dark:bg-white dark:text-slate-900 dark:placeholder:text-slate-500"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 dark:text-slate-600">
                  <span className="mr-1">Email:</span>
                  <span className="font-medium text-slate-100 dark:text-slate-900">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save profile"}
                </button>
              </div>

              {profileMessage && (
                <p className="text-xs text-slate-300 dark:text-slate-600">{profileMessage}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 dark:border-slate-300/60 dark:bg-white">
            <h2 className="text-sm font-medium text-slate-100 dark:text-slate-800">Security</h2>
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-600">
              Sign out of your account or manage sessions from your auth provider.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={handleSignOut}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-red-50 hover:bg-red-500"
              >
                Sign out everywhere
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
