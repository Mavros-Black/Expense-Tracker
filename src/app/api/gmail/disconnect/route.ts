import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabaseServer
    .from("gmail_tokens")
    .delete()
    .eq("user_id", user.id);

  const { error: mailError } = await supabaseServer
    .from("mail_accounts")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "gmail");

  if (error || mailError) {
    return NextResponse.json(
      { error: error?.message || mailError?.message || "Failed to disconnect Gmail" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
