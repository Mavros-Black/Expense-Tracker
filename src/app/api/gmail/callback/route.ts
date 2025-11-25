import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { encryptToken } from "@/lib/gmailCrypto";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Gmail OAuth env vars are not set" }, { status: 500 });
  }

  const tokenParams = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  });

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString()
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    return NextResponse.json({ error: "Failed to exchange code", details: errorText }, { status: 500 });
  }

  const tokenJson = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const now = Date.now();
  const expiresInMs = (tokenJson.expires_in ?? 3600) * 1000;
  const expiryDate = new Date(now + expiresInMs).toISOString();

  const userId = state;

  const { data: existing } = await supabaseServer
    .from("gmail_tokens")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const payload = {
    user_id: userId,
    access_token: encryptToken(tokenJson.access_token),
    refresh_token: tokenJson.refresh_token ? encryptToken(tokenJson.refresh_token) : null,
    expiry_date: expiryDate
  };

  let error = null;
  if (existing) {
    ({ error } = await supabaseServer
      .from("gmail_tokens")
      .update(payload)
      .eq("id", existing.id));
  } else {
    ({ error } = await supabaseServer.from("gmail_tokens").insert(payload));
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also upsert into the generic mail_accounts table so settings can show
  // all connected mail accounts (provider/email).
  let emailAddress: string | null = null;
  try {
    const profileRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
        headers: { Authorization: `Bearer ${tokenJson.access_token}` }
      }
    );
    if (profileRes.ok) {
      const profileJson = (await profileRes.json()) as {
        emailAddress?: string;
      };
      if (profileJson.emailAddress) {
        emailAddress = profileJson.emailAddress;
      }
    }
  } catch {
    // Ignore profile errors; we can still store the account without email.
  }

  const accountPayload = {
    user_id: userId,
    provider: "gmail",
    email: emailAddress,
    access_token: encryptToken(tokenJson.access_token),
    refresh_token: tokenJson.refresh_token
      ? encryptToken(tokenJson.refresh_token)
      : null,
    expiry_date: expiryDate
  };

  const { data: existingAccount } = await supabaseServer
    .from("mail_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "gmail")
    .eq("email", emailAddress)
    .maybeSingle();

  if (existingAccount) {
    const { error: mailError } = await supabaseServer
      .from("mail_accounts")
      .update(accountPayload)
      .eq("id", existingAccount.id);
    if (mailError) {
      return NextResponse.json({ error: mailError.message }, { status: 500 });
    }
  } else {
    const { error: mailError } = await supabaseServer
      .from("mail_accounts")
      .insert(accountPayload);
    if (mailError) {
      return NextResponse.json({ error: mailError.message }, { status: 500 });
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${appUrl}/settings?gmail=connected`);
}
