const ALLOWED_HOSTS = new Set(["en.wikipedia.org", "www.sec.gov", "data.sec.gov"]);

// EDGAR fair-access: company name + contact email (https://www.sec.gov/os/webmaster-faq#code-user-agent).
export const PUBLIC_FETCH_UA = "DoneCornerAI AdminContact@example.com";

const MAX_CHARS = 24_000;

export type PublicFetchResult = {
  url: string;
  status: number;
  contentType: string;
  text: string;
};

export async function fetchPublicUrl(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<PublicFetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Host ${parsed.hostname} is not on the public allowlist`);
  }
  const response = await fetchFn(parsed.toString(), {
    headers: {
      "user-agent": PUBLIC_FETCH_UA,
      accept: "application/json, text/html;q=0.8, */*;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  let finalHost = parsed.hostname;
  try {
    finalHost = new URL(response.url || parsed.toString()).hostname;
  } catch {
    finalHost = parsed.hostname;
  }
  if (!ALLOWED_HOSTS.has(finalHost)) {
    throw new Error(`Host ${finalHost} is not on the public allowlist`);
  }
  const text = (await response.text()).slice(0, MAX_CHARS);
  return {
    url: parsed.toString(),
    status: response.status,
    contentType: response.headers.get("content-type") ?? "",
    text,
  };
}
