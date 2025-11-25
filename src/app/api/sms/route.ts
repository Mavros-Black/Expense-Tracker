import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { regexParseTransaction } from "@/lib/parsing/transactionParser";
import { logParseError } from "@/lib/logging";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  let bodyText: string | null = null;
  let from: string | null = null;
  let to: string | null = null;

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    bodyText = (form.get("Body") as string) ?? null;
    from = (form.get("From") as string) ?? null;
    to = (form.get("To") as string) ?? null;
  } else if (contentType.includes("application/json")) {
    const json = (await request.json()) as any;
    bodyText = (json.body as string) ?? (json.Body as string) ?? null;
    from = (json.from as string) ?? (json.From as string) ?? null;
    to = (json.to as string) ?? (json.To as string) ?? null;
  } else {
    const form = await request.formData();
    bodyText = (form.get("Body") as string) ?? null;
    from = (form.get("From") as string) ?? null;
    to = (form.get("To") as string) ?? null;
  }

  if (!bodyText) {
    return new NextResponse("Missing SMS body", { status: 400 });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");

  const { parsed, confidence } = regexParseTransaction(bodyText);

  if (!parsed.amount) {
    logParseError("sms", "Failed to parse SMS amount", { from, to, bodyText });
    return new NextResponse("OK", { status: 200 });
  }

  const { error } = await supabaseServer.from("transactions").insert({
    user_id: userId,
    source: "sms",
    amount: parsed.amount,
    currency: parsed.currency ?? "USD",
    vendor: parsed.vendor ?? from,
    date: parsed.date ?? new Date().toISOString(),
    category: null,
    confidence_score: confidence,
    raw_text: bodyText,
    reference_id: parsed.referenceId
  });

  if (error) {
    logParseError("sms", "Failed to insert SMS transaction", { error: error.message });
  }

  return new NextResponse("OK", { status: 200 });
}
