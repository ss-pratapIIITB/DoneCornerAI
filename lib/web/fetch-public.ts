const ALLOWED_HOSTS = new Set(["en.wikipedia.org", "www.sec.gov", "data.sec.gov"]);

// EDGAR fair-access: company name + contact email (https://www.sec.gov/os/webmaster-faq#code-user-agent).
export const PUBLIC_FETCH_UA = "DoneCornerAI AdminContact@example.com";

const TEXT_MAX_BYTES = 24_000;
const JSON_MAX_BYTES = 8_000_000;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type PublicFetchResult = {
  url: string;
  status: number;
  contentType: string;
  text: string;
};

function assertAllowlisted(url: URL): void {
  if (url.protocol !== "https:") {
    throw new Error("Only https URLs are allowed");
  }
  if (!ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Host ${url.hostname} is not on the public allowlist`);
  }
}

function parsePublicUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  assertAllowlisted(parsed);
  return parsed;
}

async function readBoundedBody(response: Response, maxBytes: number): Promise<Uint8Array> {
  if (!response.body) {
    const buf = new Uint8Array(await response.arrayBuffer());
    return buf.byteLength > maxBytes ? buf.slice(0, maxBytes) : buf;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > maxBytes) {
      chunks.push(value.slice(0, maxBytes - total));
      await reader.cancel();
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchAllowlisted(
  url: string,
  fetchFn: typeof fetch,
  maxBytes: number,
): Promise<{ url: string; status: number; contentType: string; body: Uint8Array }> {
  let current = parsePublicUrl(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetchFn(current.toString(), {
      headers: {
        "user-agent": PUBLIC_FETCH_UA,
        accept: "application/json, text/html;q=0.8, */*;q=0.5",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirect missing Location");
      current = parsePublicUrl(new URL(location, current).toString());
      continue;
    }
    const body = await readBoundedBody(response, maxBytes);
    return {
      url: current.toString(),
      status: response.status,
      contentType: response.headers.get("content-type") ?? "",
      body,
    };
  }
  throw new Error("Too many redirects");
}

export async function fetchPublicUrl(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<PublicFetchResult> {
  const page = await fetchAllowlisted(url, fetchFn, TEXT_MAX_BYTES);
  return {
    url: page.url,
    status: page.status,
    contentType: page.contentType,
    text: new TextDecoder().decode(page.body),
  };
}

export async function fetchPublicJson(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<unknown> {
  const page = await fetchAllowlisted(url, fetchFn, JSON_MAX_BYTES);
  if (page.status >= 400) {
    throw new Error(`Public fetch failed ${page.status} for ${url}`);
  }
  return JSON.parse(new TextDecoder().decode(page.body)) as unknown;
}
