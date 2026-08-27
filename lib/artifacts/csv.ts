export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
};

export type CsvProfile = {
  rowCount: number;
  columns: {
    name: string;
    nonEmpty: number;
    numeric: number;
    examples: string[];
  }[];
  sampleRows: Record<string, string>[];
};

function rowsFromText(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const text = input.replace(/^\uFEFF/, "");
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((item) => item.some((value) => value.trim() !== ""));
}

export function parseCsv(bytes: Buffer): ParsedCsv {
  const rows = rowsFromText(bytes.toString("utf8"));
  const headers = (rows.shift() ?? []).map((header) => header.trim());
  if (!headers.length || headers.some((header) => !header)) {
    throw new Error("CSV must have a non-empty header row.");
  }
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) {
    throw new Error("CSV headers must be unique.");
  }
  return {
    headers,
    rows: rows.map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index]?.trim() ?? ""]),
      ),
    ),
  };
}

export function profileCsv(csv: ParsedCsv): CsvProfile {
  return {
    rowCount: csv.rows.length,
    columns: csv.headers.map((name) => {
      const values = csv.rows.map((row) => row[name] ?? "");
      return {
        name,
        nonEmpty: values.filter(Boolean).length,
        numeric: values.filter(
          (value) => value !== "" && Number.isFinite(Number(value)),
        ).length,
        examples: [...new Set(values.filter(Boolean))].slice(0, 3),
      };
    }),
    sampleRows: csv.rows.slice(0, 5),
  };
}
