import { Pool } from "pg";

type PoolConfig = {
  connectionString?: string;
  ssl?: { rejectUnauthorized: boolean };
};

/**
 * Create the database pool used by the API.
 *
 * Supabase's free transaction pooler currently presents a certificate chain
 * that Node cannot validate on Vercel.  Limit the compatibility setting to
 * that exact managed pooler hostname; every other PostgreSQL host continues
 * to use the driver's normal certificate validation.
 */
export function databasePoolConfig(connectionString: string): PoolConfig {
  const config: PoolConfig = { connectionString };

  try {
    const hostname = new URL(connectionString).hostname.toLowerCase();
    if (hostname.endsWith(".pooler.supabase.com")) {
      config.ssl = { rejectUnauthorized: false };
    }
  } catch {
    // Let pg report an invalid connection string through its usual error path.
  }

  return config;
}

export function createDatabasePool(connectionString: string) {
  return new Pool(databasePoolConfig(connectionString));
}
