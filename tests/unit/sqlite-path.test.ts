import { afterEach, describe, expect, it } from "vitest";
import { dbPath } from "@/lib/db/sqlite";

describe("sqlite path", () => {
  const prevDb = process.env.DONECORNER_DB;
  const prevVercel = process.env.VERCEL;

  afterEach(() => {
    if (prevDb === undefined) delete process.env.DONECORNER_DB;
    else process.env.DONECORNER_DB = prevDb;
    if (prevVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = prevVercel;
  });

  it("prefers DONECORNER_DB over the Vercel tmp fallback", () => {
    process.env.VERCEL = "1";
    process.env.DONECORNER_DB = "/custom/path.sqlite";
    expect(dbPath()).toBe("/custom/path.sqlite");
  });

  it("uses /tmp on Vercel when DONECORNER_DB is unset", () => {
    delete process.env.DONECORNER_DB;
    process.env.VERCEL = "1";
    expect(dbPath()).toBe("/tmp/donecorner.sqlite");
  });
});
