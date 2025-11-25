import { NextRequest, NextResponse } from "next/server";
import { regexParseTransaction } from "@/lib/parsing/transactionParser";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text =
    typeof (body as { text?: unknown }).text === "string"
      ? (body as { text?: string }).text
      : "";

  if (!text) {
    return NextResponse.json({ error: "'text' is required" }, { status: 400 });
  }

  const { parsed, confidence } = regexParseTransaction(text);

  return NextResponse.json({
    parsed,
    confidence: parsed.amount ? confidence : 0.4,
    model: "mock-llm"
  });
}
