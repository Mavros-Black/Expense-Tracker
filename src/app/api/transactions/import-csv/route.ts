import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { logParseError } from "@/lib/logging";
import { inferCategoryFromRules } from "@/lib/rulesEngine";

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required under 'file' field" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV must contain a header and at least one row" }, { status: 400 });
  }

  const header = lines[0]
    .split(",")
    .map(h => h.trim().toLowerCase());

  const amountIdx = header.findIndex(h => h.includes("amount"));
  const dateIdx = header.findIndex(h => h.includes("date"));
  const currencyIdx = header.findIndex(h => h.includes("currency"));
  const vendorIdx = header.findIndex(h =>
    ["description", "vendor", "merchant", "narration"].some(key => h.includes(key))
  );

  if (amountIdx === -1 || dateIdx === -1) {
    return NextResponse.json({ error: "CSV must at least contain amount and date columns" }, { status: 400 });
  }

  const toInsert: any[] = [];

  for (let i = 1; i < lines.length; i += 1) {
    const row = lines[i];
    const cols = row.split(",");
    if (cols.length <= Math.max(amountIdx, dateIdx)) continue;

    const rawAmount = cols[amountIdx].trim();
    const rawDate = cols[dateIdx].trim();
    const rawCurrency = currencyIdx !== -1 ? cols[currencyIdx].trim() : "";
    const rawVendor = vendorIdx !== -1 ? cols[vendorIdx].trim() : "";

    const amount = Number(rawAmount.replace(/,/g, ""));
    const date = new Date(rawDate);

    if (!Number.isFinite(amount) || Number.isNaN(date.getTime())) {
      logParseError("csv", "Skipping invalid CSV row", { rowIndex: i, row });
      continue;
    }

    const vendorValue = rawVendor || null;
    const inferredCategory = await inferCategoryFromRules(
      user.id,
      vendorValue,
      row
    );

    toInsert.push({
      user_id: user.id,
      source: "manual",
      amount,
      currency: rawCurrency || "USD",
      vendor: vendorValue,
      date: date.toISOString(),
      category: inferredCategory,
      confidence_score: 1,
      raw_text: row
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ error: "No valid rows to import" }, { status: 400 });
  }

  const { error } = await supabaseServer.from("transactions").insert(toInsert);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: toInsert.length });
}
