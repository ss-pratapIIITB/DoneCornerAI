import {
  ENTITY_LEVELS,
  LAKE_GRAINS,
  type LakeFilters,
  type LakeGrain,
  type LakeQuery,
} from "@/lib/lake/types";

const SAMPLE_YEAR = "2025";

const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

const GROUPS = ["Northstar Group"];
const VERTICALS = ["Cloud", "Energy", "Retail"];
const COMPANIES = [
  "Northstar SaaS",
  "Northstar Data",
  "Northstar Grid",
  "Northstar Fuels",
  "Northstar Stores",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function canon(name: string, catalog: string[]): string | undefined {
  const needle = name.trim().toLowerCase();
  return catalog.find((item) => item.toLowerCase() === needle);
}

export function resolvePeriodToken(
  token: string,
  year = SAMPLE_YEAR,
): string | null {
  const t = token
    .trim()
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}$/.test(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t.slice(0, 7);
  const yearFirst = t.match(/^(\d{4})[-\s]+([a-z]+)$/);
  if (yearFirst && MONTHS[yearFirst[2]]) {
    return `${yearFirst[1]}-${MONTHS[yearFirst[2]]}`;
  }
  const monthFirst = t.match(/^([a-z]+)[-\s]+(\d{4})$/);
  if (monthFirst && MONTHS[monthFirst[1]]) {
    return `${monthFirst[2]}-${MONTHS[monthFirst[1]]}`;
  }
  if (MONTHS[t]) return `${year}-${MONTHS[t]}`;
  return null;
}

function tokensFromUnknown(input: unknown): string[] {
  if (Array.isArray(input)) return input.flatMap(tokensFromUnknown);
  if (typeof input !== "string") return [];
  return input
    .split(/\s*(?:vs\.?|versus|and|&|,|;|\/)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolvePeriodList(
  input: unknown,
  year = SAMPLE_YEAR,
): string[] | undefined {
  const resolved = [
    ...new Set(
      tokensFromUnknown(input)
        .map((token) => resolvePeriodToken(token, year))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  return resolved.length ? resolved : undefined;
}

export function extractCompareFromText(
  text: string,
  year = SAMPLE_YEAR,
): string[] | undefined {
  const names = Object.keys(MONTHS).sort((left, right) => right.length - left.length);
  const found: string[] = [];
  const pattern = new RegExp(`\\b(${names.join("|")})\\b`, "gi");
  for (const match of text.matchAll(pattern)) {
    const token = resolvePeriodToken(match[1] ?? "", year);
    if (token && !found.includes(token)) found.push(token);
  }
  return found.length >= 2 ? found.slice(0, 2) : undefined;
}

export function coerceLakeQuery(args: {
  metric?: unknown;
  grain?: unknown;
  filters?: unknown;
  compare?: unknown;
  title?: unknown;
}): LakeQuery {
  const raw = isRecord(args.filters) ? args.filters : {};
  const filters: LakeFilters = {
    scenario: raw.scenario === "budget" ? "budget" : "actual",
  };

  const period =
    resolvePeriodList(
      raw.period ?? raw.periods ?? args.compare ?? raw.compare ?? raw.comparePeriods,
    ) ??
    (typeof args.title === "string" ? extractCompareFromText(args.title) : undefined);
  if (period?.length) filters.period = period;

  const accounts = tokensFromUnknown(raw.account);
  if (accounts.length) filters.account = accounts;

  for (const level of ENTITY_LEVELS) {
    if (typeof raw[level] !== "string" || !raw[level].trim()) continue;
    const named =
      level === "group"
        ? canon(raw[level], GROUPS) ?? raw[level].trim()
        : level === "vertical"
          ? canon(raw[level], VERTICALS) ?? raw[level].trim()
          : level === "company"
            ? canon(raw[level], COMPANIES) ?? raw[level].trim()
            : raw[level].trim();
    filters[level] = named;
  }

  if (filters.company) {
    const asVertical = canon(filters.company, VERTICALS);
    if (asVertical) {
      filters.vertical = asVertical;
      delete filters.company;
    }
  }

  if (typeof raw.entity === "string") {
    const name = raw.entity.trim();
    const vertical = canon(name, VERTICALS);
    const company = canon(name, COMPANIES);
    const group = canon(name, GROUPS);
    if (vertical) filters.vertical = vertical;
    else if (company) filters.company = company;
    else if (group) filters.group = group;
  }

  const grainRaw = String(args.grain ?? "period");
  const grain = LAKE_GRAINS.includes(grainRaw as LakeGrain)
    ? (grainRaw as LakeGrain)
    : "period";

  return {
    metric: String(args.metric ?? "revenue"),
    grain,
    filters,
  };
}
