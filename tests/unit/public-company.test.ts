import { afterEach, describe, expect, it } from "vitest";
import { lookupPublicCompany, resetPublicCompanyCache } from "@/lib/web/public-company";
import { fetchPublicUrl, PUBLIC_FETCH_UA } from "@/lib/web/fetch-public";

describe("public web MCP helpers", () => {
  afterEach(() => {
    resetPublicCompanyCache();
  });

  it("sends an EDGAR-compliant User-Agent with a contact email", () => {
    expect(PUBLIC_FETCH_UA).toMatch(/DoneCornerAI/i);
    expect(PUBLIC_FETCH_UA).toMatch(/@/);
  });

  it("refuses hosts outside the public allowlist", async () => {
    await expect(
      fetchPublicUrl("https://example.com/secret"),
    ).rejects.toThrow(/allowlist/i);
    await expect(fetchPublicUrl("http://en.wikipedia.org/wiki/X")).rejects.toThrow(
      /https/i,
    );
  });

  it("looks up a public company from Wikipedia and SEC tickers", async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("opensearch")) {
        return new Response(
          JSON.stringify(["Salesforce", ["Salesforce"], [""], ["https://en.wikipedia.org/wiki/Salesforce"]]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("page/summary")) {
        return new Response(
          JSON.stringify({
            title: "Salesforce",
            extract: "Salesforce is an American cloud software company.",
            content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Salesforce" } },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("company_tickers")) {
        return new Response(
          JSON.stringify({
            "0": { cik_str: 1108524, ticker: "CRM", title: "Salesforce, Inc." },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("companyfacts")) {
        return new Response(
          JSON.stringify({
            facts: {
              "us-gaap": {
                Revenues: {
                  units: {
                    USD: [
                      { fy: 2024, fp: "FY", form: "10-K", end: "2024-01-31", val: 34_857_000_000 },
                    ],
                  },
                },
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("not found", { status: 404 });
    };

    const result = await lookupPublicCompany("CRM", fetchFn);
    expect(result.wikipedia?.title).toBe("Salesforce");
    expect(result.wikipedia?.extract).toMatch(/cloud software/i);
    expect(result.sec?.ticker).toBe("CRM");
    expect(result.sec?.revenueUsd).toBe(34_857_000_000);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it.skipIf(process.env.LIVE_WEB !== "1")("reaches live Wikipedia for Salesforce", async () => {
    resetPublicCompanyCache();
    const result = await lookupPublicCompany("Salesforce");
    expect(result.wikipedia?.title).toMatch(/Salesforce/i);
    expect(result.wikipedia?.extract).toMatch(/software|cloud|customer/i);
    if (result.sec) {
      expect(result.sec.ticker).toBe("CRM");
      expect(result.sec.revenueUsd).toBeGreaterThan(1_000_000_000);
    }
  }, 25_000);
});
