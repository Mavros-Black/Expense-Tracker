import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";
import { getUserFromRequest } from "@/lib/auth";
import { decryptToken, encryptToken } from "@/lib/gmailCrypto";
import { regexParseTransaction } from "@/lib/parsing/transactionParser";
import { logParseError } from "@/lib/logging";
import { inferCategoryFromRules } from "@/lib/rulesEngine";

export const runtime = "nodejs";

type GmailTokenRecord = {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string | null;
  expiry_date: string | null;
};

type PdfExtractionResult = {
  texts: string[];
  urls: string[];
};

async function ensureAccessToken(
  record: GmailTokenRecord
): Promise<{ accessToken: string } | { error: string }> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { error: "Gmail OAuth env vars are not set" };
  }

  const now = Date.now();
  const expiryMs = record.expiry_date ? new Date(record.expiry_date).getTime() : 0;

  // If token not near expiry (60s buffer), just use it
  if (expiryMs - now > 60 * 1000) {
    return { accessToken: decryptToken(record.access_token) };
  }

  if (!record.refresh_token) {
    return { accessToken: decryptToken(record.access_token) };
  }

  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: decryptToken(record.refresh_token)
    }).toString()
  });

  if (!refreshRes.ok) {
    const text = await refreshRes.text();
    logParseError("gmail", "Failed to refresh access token", { text });
    return { error: "Failed to refresh access token" };
  }

  const json = (await refreshRes.json()) as {
    access_token: string;
    expires_in?: number;
  };

  const newAccessToken = json.access_token;
  const expiryDate = new Date(Date.now() + (json.expires_in ?? 3600) * 1000).toISOString();

  const { error } = await supabaseServer
    .from("gmail_tokens")
    .update({
      access_token: encryptToken(newAccessToken),
      expiry_date: expiryDate
    })
    .eq("id", record.id);

  if (error) {
    logParseError("gmail", "Failed to update refreshed token in DB", {
      error: error.message
    });
  }

  return { accessToken: newAccessToken };
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  const buff = Buffer.from(normalized, "base64");
  return buff.toString("utf8");
}

function decodeBase64UrlToBuffer(data: string): Buffer {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64");
}

function extractEmailText(message: any): string {
  const payload = message.payload;

  const partsQueue: any[] = [payload];
  const texts: string[] = [];

  while (partsQueue.length > 0) {
    const part = partsQueue.pop();
    if (!part) continue;

    if (part.mimeType === "text/plain" && part.body?.data) {
      texts.push(decodeBase64Url(part.body.data));
    } else if (part.mimeType === "text/html" && part.body?.data) {
      const html = decodeBase64Url(part.body.data);
      const text = html.replace(/<[^>]+>/g, " ");
      texts.push(text);
    } else if (part.parts && Array.isArray(part.parts)) {
      partsQueue.push(...part.parts);
    }
  }

  if (texts.length === 0 && payload.body?.data) {
    texts.push(decodeBase64Url(payload.body.data));
  }

  return texts.join("\n\n");
}

async function extractPdfData(
  userId: string,
  messageId: string,
  payload: any,
  accessToken: string
): Promise<PdfExtractionResult> {
  const texts: string[] = [];
  const urls: string[] = [];
  const partsQueue: any[] = [payload];

  while (partsQueue.length > 0) {
    const part = partsQueue.pop();
    if (!part) continue;

    const isPdfMime = part.mimeType === "application/pdf";
    const rawFilename =
      typeof part.filename === "string" ? part.filename.trim() : "";
    const isPdfFilename = rawFilename.toLowerCase().endsWith(".pdf");

    logParseError("gmail", "Inspecting MIME part", {
      messageId,
      mimeType: part.mimeType,
      filename: part.filename ?? null,
      hasAttachmentId: !!part.body?.attachmentId,
      isPdfMime,
      isPdfFilename
    });

    if ((isPdfMime || isPdfFilename) && part.body?.attachmentId) {
      try {
        const pdfModule = await import("pdf-parse");
        const pdfParse = (pdfModule as any).default || (pdfModule as any);

        const attachRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${part.body.attachmentId}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );

        if (!attachRes.ok) {
          const text = await attachRes.text();
          logParseError("gmail", "Failed to fetch PDF attachment", {
            messageId,
            text
          });
          continue;
        }

        const attachJson = (await attachRes.json()) as { data?: string };
        if (!attachJson.data) continue;

        const buffer = decodeBase64UrlToBuffer(attachJson.data);
        const parsed: any = await pdfParse(buffer);
        if (parsed?.text && parsed.text.trim().length > 0) {
          texts.push(parsed.text);
        }

        try {
          const bucket = "invoices";
          const fileName =
            typeof part.filename === "string" && part.filename.trim().length > 0
              ? part.filename
              : `invoice-${messageId}-${Date.now()}.pdf`;
          const path = `${userId}/${messageId}/${fileName}`;

          const { error: uploadError } = await supabaseServer.storage
            .from(bucket)
            .upload(path, buffer, {
              upsert: true,
              contentType: "application/pdf"
            });

          if (uploadError) {
            logParseError("gmail", "Failed to upload PDF to storage", {
              messageId,
              error: uploadError.message
            });
          } else {
            const { data: publicData } = supabaseServer.storage
              .from(bucket)
              .getPublicUrl(path);
            if (publicData?.publicUrl) {
              urls.push(publicData.publicUrl);
            }
          }
        } catch (storageErr: any) {
          logParseError(
            "gmail",
            "Exception while uploading PDF to storage",
            {
              messageId,
              error: String(storageErr?.message ?? storageErr)
            }
          );
        }
      } catch (err: any) {
        logParseError("gmail", "Failed to parse PDF attachment", {
          messageId,
          error: String(err?.message ?? err)
        });
      }
    } else if (part.parts && Array.isArray(part.parts)) {
      partsQueue.push(...part.parts);
    }
  }

  logParseError("gmail", "PDF extraction summary", {
    messageId,
    textsCount: texts.length,
    urlsCount: urls.length
  });

  return { texts, urls };
}

function extractDateFromHeaders(headers: any[]): string | null {
  const h = headers.find((x) => x.name?.toLowerCase() === "date");
  if (!h?.value) return null;
  const d = new Date(h.value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function extractHeaderValue(headers: any[], name: string): string | null {
  const h = headers.find((x) => x.name?.toLowerCase() === name.toLowerCase());
  return h?.value ?? null;
}

function extractVendorFromHeaders(headers: any[]): string | null {
  const from = extractHeaderValue(headers, "from");
  const subject = extractHeaderValue(headers, "subject");

  if (from) {
    const quoted = from.match(/"([^"]+)"/);
    if (quoted && quoted[1].trim().length > 0) {
      return quoted[1].trim();
    }

    const angled = from.match(/([^<]+)</);
    if (angled && angled[1].trim().length > 0) {
      return angled[1].trim();
    }

    const beforeAngle = from.split("<")[0].trim();
    if (beforeAngle.length > 0) {
      return beforeAngle;
    }
  }

  if (subject) {
    const cleaned = subject.replace(/\s+/g, " ").trim();
    if (cleaned.length > 0 && cleaned.length <= 80) {
      return cleaned;
    }
  }

  return null;
}

export async function POST(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: tokenRecord, error: tokenError } = await supabaseServer
    .from("gmail_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<GmailTokenRecord>();

  if (tokenError || !tokenRecord) {
    return NextResponse.json(
      { error: "No Gmail integration configured" },
      { status: 400 }
    );
  }

  const ensured = await ensureAccessToken(tokenRecord);
  if ("error" in ensured) {
    return NextResponse.json({ error: ensured.error }, { status: 500 });
  }

  const accessToken = ensured.accessToken;

  const searchQuery =
    '(receipt OR "payment received" OR "order confirmation" OR invoice OR transaction) has:attachment filename:pdf';

  // Look back approximately 12 months and explicitly require
  // messages that have PDF attachments, to increase the chance
  // of finding invoice PDFs.
  const params = new URLSearchParams({
    q: `${searchQuery} newer_than:365d`,
    maxResults: "50"
  });

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!listRes.ok) {
    const text = await listRes.text();
    logParseError("gmail", "Failed to list messages", { text });
    return NextResponse.json(
      { error: "Failed to list Gmail messages" },
      { status: 500 }
    );
  }

  const listJson = (await listRes.json()) as {
    messages?: { id: string }[];
  };

  const messages = listJson.messages ?? [];
  if (messages.length === 0) {
    return NextResponse.json({ inserted: 0 });
  }

  const baseAppUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const rowsToInsert: any[] = [];
  let pdfsStored = 0;

  for (const { id } of messages) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!msgRes.ok) {
      const text = await msgRes.text();
      logParseError("gmail", "Failed to fetch message", { id, text });
      continue;
    }

    const msgJson = (await msgRes.json()) as any;
    const headers = msgJson.payload?.headers ?? [];
    const dateHeader = extractDateFromHeaders(headers);
    const bodyText = extractEmailText(msgJson);
    const { texts: pdfTexts, urls: pdfUrls } = await extractPdfData(
      user.id,
      id,
      msgJson.payload,
      accessToken
    );
    const combinedText = pdfTexts.length
      ? `${bodyText}\n\n${pdfTexts.join("\n\n")}`
      : bodyText;

    const { parsed, confidence } = regexParseTransaction(combinedText);

    let finalParsed = parsed;
    let finalConfidence = confidence;

    if (!parsed.amount) {
      try {
        const llmRes = await fetch(`${baseAppUrl}/api/llm/parse`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: combinedText })
        });

        if (llmRes.ok) {
          const llmJson = (await llmRes.json()) as {
            parsed?: typeof parsed;
            confidence?: number;
          };
          if (llmJson.parsed?.amount) {
            finalParsed = llmJson.parsed;
            finalConfidence = llmJson.confidence ?? 0.7;
          }
        }
      } catch (err: any) {
        logParseError("gmail", "LLM fallback failed", {
          error: String(err?.message ?? err)
        });
      }
    }

    if (!finalParsed.amount) {
      logParseError("gmail", "Skipping email without parsed amount", {
        id
      });
      continue;
    }

    pdfsStored += pdfUrls.length;

    const headerVendor = extractVendorFromHeaders(headers);
    const vendorValue = headerVendor ?? finalParsed.vendor ?? null;

    const inferredCategory = await inferCategoryFromRules(
      user.id,
      vendorValue,
      combinedText
    );

    rowsToInsert.push({
      user_id: user.id,
      source: "gmail",
      amount: finalParsed.amount,
      currency: finalParsed.currency ?? "USD",
      vendor: vendorValue,
      date: finalParsed.date ?? dateHeader ?? new Date().toISOString(),
      invoice_pdf_url: pdfUrls[0] ?? null,
      category: inferredCategory,
      confidence_score: finalConfidence,
      raw_text: combinedText,
      reference_id: finalParsed.referenceId ?? id
    });
  }

  if (rowsToInsert.length === 0) {
    return NextResponse.json({ inserted: 0, pdfsStored, totalForUser: 0 });
  }

  const { error: insertError } = await supabaseServer
    .from("transactions")
    .insert(rowsToInsert);

  if (insertError) {
    logParseError("gmail", "Failed to insert Gmail transactions", {
      error: insertError.message
    });
    return NextResponse.json(
      { error: "Failed to insert Gmail transactions" },
      { status: 500 }
    );
  }

  const { count } = await supabaseServer
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  return NextResponse.json({
    inserted: rowsToInsert.length,
    pdfsStored,
    totalForUser: typeof count === "number" ? count : null
  });
}
