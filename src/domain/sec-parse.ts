export type SecFiling = {
  form: string;
  filingDate: string | null;
  acceptanceAt: string | null;
  accession: string;
  primaryDocument: string;
  description: string | null;
  indexUrl: string;
  insider: boolean;
};

export type SecIssuer = {
  cik: string;
  name: string;
  tickers: string[];
  exchanges: string[];
  sic: string | null;
  filings: SecFiling[];
};

export type SecParse =
  | { ok: true; issuer: SecIssuer }
  | { ok: false; error: string };

const ACCESSION = /^\d{10}-\d{2}-\d{6}$/;

export function parseSecSubmissions(raw: unknown, expectedCik: string): SecParse {
  if (!raw || typeof raw !== "object") return { ok: false, error: "SEC submissions were not a JSON object." };
  const body = raw as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const cik = typeof body.cik === "string" ? body.cik.trim() : "";
  if (!name || !cik) return { ok: false, error: "SEC submissions had no issuer name or CIK." };
  if (cik.replace(/^0+/, "") !== expectedCik.replace(/^0+/, "")) {
    return { ok: false, error: "SEC submissions CIK did not match the requested issuer." };
  }
  const tickers = stringList(body.tickers);
  const exchanges = stringList(body.exchanges);
  const sic = typeof body.sicDescription === "string" && body.sicDescription.trim() ? body.sicDescription.trim() : null;
  const filingsRoot = body.filings;
  if (!filingsRoot || typeof filingsRoot !== "object") return { ok: false, error: "SEC submissions had no filings object." };
  const recent = (filingsRoot as Record<string, unknown>).recent;
  if (!recent || typeof recent !== "object") return { ok: false, error: "SEC submissions had no recent filings." };
  const columns = recent as Record<string, unknown>;
  const forms = stringList(columns.form);
  const dates = stringList(columns.filingDate);
  const accepted = stringList(columns.acceptanceDateTime);
  const accessions = stringList(columns.accessionNumber);
  const documents = stringList(columns.primaryDocument);
  const descriptions = stringList(columns.primaryDocDescription);
  const count = Math.min(forms.length, dates.length, accepted.length, accessions.length, documents.length);
  const filings: SecFiling[] = [];
  for (let index = 0; index < count; index += 1) {
    const accession = accessions[index] ?? "";
    const form = forms[index] ?? "";
    if (!form || !ACCESSION.test(accession)) continue;
    const indexUrl = secIndexUrl(cik, accession);
    if (!indexUrl) continue;
    const filingDate = /^\d{4}-\d{2}-\d{2}$/.test(dates[index] ?? "") ? dates[index] : null;
    filings.push({
      form,
      filingDate,
      acceptanceAt: isoOrNull(accepted[index] ?? ""),
      accession,
      primaryDocument: documents[index] ?? "",
      description: descriptions[index]?.trim() ? descriptions[index].trim() : null,
      indexUrl,
      insider: form === "4" || form.startsWith("4/"),
    });
  }
  filings.sort((a, b) => (b.acceptanceAt ?? b.filingDate ?? "").localeCompare(a.acceptanceAt ?? a.filingDate ?? ""));
  return {
    ok: true,
    issuer: { cik, name, tickers, exchanges, sic, filings: filings.slice(0, 6) },
  };
}

export function secIndexUrl(cik: string, accession: string): string | null {
  if (!ACCESSION.test(accession)) return null;
  const digits = String(Number(cik));
  if (!/^\d+$/.test(digits) || digits === "0") return null;
  return `https://www.sec.gov/Archives/edgar/data/${digits}/${accession}-index.html`;
}

export function tickerConfirmed(tickers: string[], symbol: string): boolean {
  return tickers.some((ticker) => ticker.toUpperCase() === symbol.toUpperCase());
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isoOrNull(value: string): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}
