import { mkdirSync } from "node:fs";

const FETCH_CAPTURE = `globalThis.__TRUEFORGE_FETCH = app.fetch.bind(app);
  const server = { on() {}, close(cb) { cb && cb(); } };`;

const LISTEN_PATTERN =
  /const server = serve\(\{ fetch: app\.fetch, port: \w+\.PORT, hostname: \w+\.HOST \},[\s\S]*?\n  \}\);/;

export function patchTrueForgeMain(source: string): string {
  if (source.includes("__TRUEFORGE_FETCH")) return source;
  const patched = source.replace(LISTEN_PATTERN, FETCH_CAPTURE);
  if (patched === source) {
    throw new Error("TrueForge main.js listen() pattern was not found; cannot host on Vercel");
  }
  return patched;
}

export function asRequest(input: RequestInfo | URL, init?: RequestInit): Request {
  if (input instanceof Request) {
    return init ? new Request(input, init) : input;
  }
  return new Request(String(input), init);
}

export function probeTimeoutMs(): number {
  return process.env.VERCEL ? 20_000 : 1_500;
}

function publicOrigin(): string | null {
  const fromEnv = process.env.PUBLIC_BASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const host = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    ""
  )
    .trim()
    .replace(/^https?:\/\//, "");
  return host ? `https://${host}` : null;
}

export function prepareHostedEnv(): void {
  process.env.STANDALONE ??= "true";
  process.env.HOME = "/tmp";
  process.env.XDG_DATA_HOME = "/tmp/trueforge-xdg";
  process.env.XDG_CONFIG_HOME = "/tmp/trueforge-config";
  process.env.XDG_CACHE_HOME = "/tmp/trueforge-cache";
  process.env.SQLITE_PATH ??= "/tmp/trueforge.sqlite";
  mkdirSync("/tmp/trueforge-xdg", { recursive: true });
  mkdirSync("/tmp/trueforge-config", { recursive: true });
  mkdirSync("/tmp/trueforge-cache", { recursive: true });
  mkdirSync("/tmp/.local/share/trueforge", { recursive: true });
  const origin = publicOrigin();
  if (origin && !process.env.PUBLIC_BASE_URL) {
    process.env.PUBLIC_BASE_URL = origin;
  }
}

let booting: Promise<typeof fetch> | null = null;

/** TrueForge resource names use hyphens; OpenAI catalog model_ids use dots. */
export function openaiUpstreamModelId(modelName: string): string {
  const name = modelName.replace(/^openai\//, "");
  const catalog: Record<string, string> = {
    "gpt-5-4-mini": "gpt-5.4-mini",
    "gpt-5-5": "gpt-5.5",
    "gpt-5-6-luna": "gpt-5.6-luna",
    "gpt-5-6-sol": "gpt-5.6-sol",
    "gpt-5-6-terra": "gpt-5.6-terra",
  };
  return catalog[name] ?? name;
}

/** TrueForge Zod is snake_case + strict; camelCase PUTs never register a provider. */
export function openaiProviderSeedBody(
  apiKey: string,
  modelName = process.env.TRUEFORGE_MODEL ?? "openai/gpt-5-4-mini",
) {
  const name = modelName.replace(/^openai\//, "");
  return {
    manifest: {
      type: "openai" as const,
      auth: { api_key: apiKey },
      models: [
        {
          model_id: openaiUpstreamModelId(modelName),
          name,
          properties: {},
        },
      ],
    },
  };
}

async function seedOpenAi(fetchFn: typeof fetch): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.VERCEL) {
      console.error(
        "OPENAI_API_KEY is not set; TrueForge sessions will 422 until a provider exists.",
      );
    }
    return;
  }
  const origin = publicOrigin() ?? "http://127.0.0.1:8790";
  const res = await fetchFn(
    new Request(`${origin}/api/v1/settings/model-providers`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(openaiProviderSeedBody(apiKey)),
    }),
  );
  if (!res.ok) {
    throw new Error(
      `TrueForge OpenAI seed failed (${res.status}): ${await res.text()}`,
    );
  }
}

async function boot(): Promise<typeof fetch> {
  prepareHostedEnv();
  const exit = process.exit.bind(process);
  process.exit = ((code?: number) => {
    throw new Error(`TrueForge aborted with code ${String(code ?? 0)}`);
  }) as typeof process.exit;
  try {
    // @ts-expect-error no types for the published dist entry
    await import("@truefoundry/trueforge/dist/main.js");
  } finally {
    process.exit = exit;
  }
  const fetchFn = globalThis.__TRUEFORGE_FETCH;
  if (!fetchFn) {
    throw new Error("TrueForge started without capturing fetch");
  }
  await seedOpenAi(fetchFn);
  return fetchFn;
}

export async function hostedFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!booting) {
    booting = boot().catch((error: unknown) => {
      booting = null;
      throw error;
    });
  }
  const fetchFn = await booting;
  return fetchFn(asRequest(input, init));
}

declare global {
  // eslint-disable-next-line no-var
  var __TRUEFORGE_FETCH: typeof fetch | undefined;
}
