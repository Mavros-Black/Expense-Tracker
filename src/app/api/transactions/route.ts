import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { inferCategoryFromRules } from "@/lib/rulesEngine";

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("q");
  const category = url.searchParams.get("category");
  const period = url.searchParams.get("period"); // "week" | "month" | undefined

  let fromDate: string | undefined;
  if (period === "week") {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    fromDate = d.toISOString();
  } else if (period === "month") {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    fromDate = d.toISOString();
  }

  let query = supabaseServer
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  if (fromDate) {
    query = query.gte("date", fromDate);
  }

  if (search) {
    const pattern = `%${search}%`;
    query = query.or(`vendor.ilike.${pattern},raw_text.ilike.${pattern}`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transactions: data ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    amount,
    currency,
    vendor,
    date,
    category,
    source = "manual",
    raw_text,
    confidence_score
  } = body as {
    amount: number;
    currency?: string;
    vendor?: string;
    date: string;
    category?: string;
    source?: string;
    raw_text?: string;
    confidence_score?: number;
  };

  if (typeof amount !== "number" || !date) {
    return NextResponse.json({ error: "amount (number) and date are required" }, { status: 400 });
  }

  let finalCategory: string | null = category ?? null;
  if (!finalCategory) {
    finalCategory = await inferCategoryFromRules(user.id, vendor ?? null, raw_text ?? "");
  }

  const { data, error } = await supabaseServer
    .from("transactions")
    .insert({
      user_id: user.id,
      source,
      amount,
      currency: currency ?? "USD",
      vendor: vendor ?? null,
      date,
      category: finalCategory ?? null,
      confidence_score: confidence_score ?? 1,
      raw_text: raw_text ?? null
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction: data });
}

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id, ...updates } = body as { id?: string; [key: string]: unknown };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { data, error } = await supabaseServer
    .from("transactions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transaction: data });
}

export async function DELETE(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { id } = body as { id?: string };

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const { error } = await supabaseServer
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
