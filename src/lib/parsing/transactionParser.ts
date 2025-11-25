export type ParsedTransaction = {
  amount?: number;
  currency?: string;
  vendor?: string;
  date?: string;
  referenceId?: string;
};

const amountRegex = /(\d{1,3}(?:[,\.\s]\d{3})*(?:[\.,]\d{2}))/;
const currencyRegex = /\b(USD|EUR|GBP|NGN|KES|ZAR|CAD|AUD|INR|JPY|CNY|CHF|SEK|NOK|DKK|RUB|BRL|USD\$|US\$|\$|€|£)\b/i;
const dateRegex = /(\d{4}-\d{2}-\d{2}|(?:\d{1,2}[\/\-.]){2}\d{2,4}|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{2,4})/i;

function normalizeAmount(raw: string): number | undefined {
  const cleaned = raw.replace(/[^0-9.,]/g, "");
  if (!cleaned) return undefined;

  if (cleaned.includes(",") && cleaned.includes(".")) {
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    const decimalSep = lastDot > lastComma ? "." : ",";
    const thousandsSep = decimalSep === "." ? "," : ".";
    const noThousands = cleaned.replace(new RegExp(`\\${thousandsSep}`, "g"), "");
    const normalized = decimalSep === "," ? noThousands.replace(",", ".") : noThousands;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : undefined;
  }

  if (cleaned.includes(",") && !cleaned.includes(".")) {
    const normalized = cleaned.replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : undefined;
  }

  const value = Number(cleaned.replace(/,/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function parseDate(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed + "T00:00:00Z");
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  if (/^(?:\d{1,2}[\/\-.]){2}\d{2,4}$/.test(trimmed)) {
    const [aStr, bStr, cStr] = trimmed.split(/[\/\-.]/);
    let a = Number(aStr);
    let b = Number(bStr);
    let c = Number(cStr);
    if (c < 100) c += 2000;
    const day = a > 12 ? a : b;
    const month = a > 12 ? b : a;
    const d = new Date(Date.UTC(c, month - 1, day));
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }

  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function extractVendor(text: string): string | undefined {
  const atMatch = text.match(/\bat\s+([A-Za-z0-9&'().\-\s]{2,60})/i);
  if (atMatch) return atMatch[1].trim();

  const fromMatch = text.match(/\bfrom\s+([A-Za-z0-9&'().\-\s]{2,60})/i);
  if (fromMatch) return fromMatch[1].trim();

  const toMatch = text.match(/\bto\s+([A-Za-z0-9&'().\-\s]{2,60})/i);
  if (toMatch) return toMatch[1].trim();

  const lineMatch = text.split(/\r?\n/).find(line => /receipt|transaction|payment|order/i.test(line));
  if (lineMatch) {
    const cleaned = lineMatch.replace(/receipt|transaction|payment|order/gi, "");
    const candidate = cleaned.replace(/[:#]/g, "").trim();
    if (candidate.length >= 2 && candidate.length <= 60) return candidate;
  }

  return undefined;
}

function extractReferenceId(text: string): string | undefined {
  const refMatch = text.match(/\b(?:ref(?:erence)?|txn|transaction id|transaction no\.)[:\s]+([A-Za-z0-9\-]{4,})/i);
  return refMatch ? refMatch[1].trim() : undefined;
}

export function regexParseTransaction(text: string): { parsed: ParsedTransaction; confidence: number } {
  const amountMatch = text.match(amountRegex);
  const currencyMatch = text.match(currencyRegex);
  const dateMatch = text.match(dateRegex);

  const amount = amountMatch ? normalizeAmount(amountMatch[1]) : undefined;
  const currencyRaw = currencyMatch ? currencyMatch[1].toUpperCase() : undefined;

  let currency: string | undefined;
  if (currencyRaw) {
    if (["$", "USD$", "US$"] .includes(currencyRaw)) currency = "USD";
    else if (currencyRaw === "€") currency = "EUR";
    else if (currencyRaw === "£") currency = "GBP";
    else currency = currencyRaw;
  }

  const date = dateMatch ? parseDate(dateMatch[1]) : undefined;
  const vendor = extractVendor(text);
  const referenceId = extractReferenceId(text);

  let confidence = 0.3;
  if (amount && date && vendor) confidence = 0.95;
  else if (amount && date) confidence = 0.9;
  else if (amount) confidence = 0.7;

  return {
    parsed: {
      amount,
      currency,
      vendor,
      date,
      referenceId
    },
    confidence
  };
}
