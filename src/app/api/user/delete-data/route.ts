import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error: tError } = await supabaseServer
    .from("transactions")
    .delete()
    .eq("user_id", user.id);

  const { error: rError } = await supabaseServer
    .from("rules")
    .delete()
    .eq("user_id", user.id);

  const { error: gError } = await supabaseServer
    .from("gmail_tokens")
    .delete()
    .eq("user_id", user.id);

  const { error: mError } = await supabaseServer
    .from("mail_accounts")
    .delete()
    .eq("user_id", user.id);

  if (tError || rError || gError || mError) {
    return NextResponse.json(
      {
        error:
          tError?.message ||
          rError?.message ||
          gError?.message ||
          mError?.message ||
          "Failed to delete data"
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
