import { describe, expect, it } from "vitest";
import { databasePoolConfig } from "../db/pool";

describe("databasePoolConfig", () => {
  it("uses the managed Supabase pooler compatibility setting only for its pooler host", () => {
    expect(databasePoolConfig("postgresql://user:pass@aws-0-eu-central-1.pooler.supabase.com:6543/postgres").ssl)
      .toEqual({ rejectUnauthorized: false });
  });

  it("keeps certificate validation at the driver default for other database hosts", () => {
    expect(databasePoolConfig("postgresql://user:pass@db.example.com:5432/postgres").ssl).toBeUndefined();
  });
});
