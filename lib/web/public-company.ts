import { fetchPublicUrl } from "@/lib/web/fetch-public";

type TickerRow = { cik: string; ticker: string; name: string };

type FactsFile = {
  facts?: {
    "us-gaap"?: Record<
      string,
      { units?: { USD?: Array<{ fy?: number; fp?: string; form?: string; end?: string; val?: number }> } }
    >;
  };
};

export type PublicCompanyLookup = {
  query: string;
  wikipedia: { title: string; extract: string; url: string } | null;
  sec: {
    name: string;
    ticker: string;
    cik: string;
    revenueUsd?: number;
    revenuePeriod?: string;
  } | null;
  sources: string[];
};

const REVENUE_KEYS = [
  "Revenues",
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "SalesRevenueNet",
];

let tickers: TickerRow[] | null = null;

export function resetPublicCompanyCache(): void {
  tickers = null;
}

async function readJson(
  url: string,
  fetchFn: typeof fetch,
): Promise<unknown> {
  const page = await fetchPublicUrl(url, fetchFn);
  if (page.status >= 400) {
    throw new Error(`Public fetch failed ${page.status} for ${url}`);
  }
  return JSON.parse(page.text) as unknown;
}

async function loadTickers(fetchFn: typeof fetch): Promise<TickerRow[]> {
  if (tickers) return tickers;
  const raw = (await readJson(
    "https://www.sec.gov/files/company_tickers.json",
    fetchFn,
  )) as Record<string, { cik_str?: number; ticker?: string; title?: string }>;
  tickers = Object.values(raw).map((row) => ({
    cik: String(row.cik_str ?? "").padStart(10, "0"),
    ticker: String(row.ticker ?? "").toUpperCase(),
    name: String(row.title ?? ""),
  }));
  return tickers;
}

function matchTicker(query: string, rows: TickerRow[]): TickerRow | undefined {
  const needle = query.trim().toLowerCase();
  if (!needle) return undefined;
  const byTicker = rows.find((row) => row.ticker.toLowerCase() === needle);
  if (byTicker) return byTicker;
  return rows.find(
    (row) =>
      row.name.toLowerCase() === needle ||
      row.name.toLowerCase().includes(needle),
  );
}

function latestAnnualRevenue(facts: FactsFile): { value: number; period: string } | null {
  const gaap = facts.facts?.["us-gaap"] ?? {};
  for (const key of REVENUE_KEYS) {
    const usd = gaap[key]?.units?.USD ?? [];
    const annual = usd
      .filter((row) => row.form === "10-K" && row.fp === "FY" && typeof row.val === "number")
      .sort((left, right) => String(right.end).localeCompare(String(left.end)));
    const top = annual[0];
    if (top?.val != null) {
      return { value: top.val, period: String(top.end ?? top.fy ?? "") };
    }
  }
  return null;
}

export async function lookupPublicCompany(
  query: string,
  fetchFn: typeof fetch = fetch,
): Promise<PublicCompanyLookup> {
  const q = query.trim();
  if (!q) throw new Error("query is required");
  const sources: string[] = [];
  let wikipedia: PublicCompanyLookup["wikipedia"] = null;
  try {
    const open = (await readJson(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(q)}&limit=1&namespace=0&format=json`,
      fetchFn,
    )) as [string, string[], string[], string[]];
    const title = open[1]?.[0];
    const wikiUrl = open[3]?.[0];
    if (title) {
      const summary = (await readJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
        fetchFn,
      )) as {
        title?: string;
        extract?: string;
        content_urls?: { desktop?: { page?: string } };
      };
      wikipedia = {
        title: String(summary.title ?? title),
        extract: String(summary.extract ?? ""),
        url: String(summary.content_urls?.desktop?.page ?? wikiUrl ?? ""),
      };
      if (wikipedia.url) sources.push(wikipedia.url);
    }
  } catch {
    wikipedia = null;
  }

  let sec: PublicCompanyLookup["sec"] = null;
  try {
    const rows = await loadTickers(fetchFn);
    const hit = matchTicker(q, rows) ?? (wikipedia ? matchTicker(wikipedia.title, rows) : undefined);
    if (hit) {
      sources.push("https://www.sec.gov/files/company_tickers.json");
      sec = { name: hit.name, ticker: hit.ticker, cik: hit.cik };
      try {
        const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${hit.cik}.json`;
        const facts = (await readJson(factsUrl, fetchFn)) as FactsFile;
        sources.push(factsUrl);
        const revenue = latestAnnualRevenue(facts);
        sec = {
          ...sec,
          revenueUsd: revenue?.value,
          revenuePeriod: revenue?.period,
        };
      } catch {
        /* ticker match is still useful without XBRL */
      }
    }
  } catch {
    sec = sec;
  }

  return { query: q, wikipedia, sec, sources };
}
