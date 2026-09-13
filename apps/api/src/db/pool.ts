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
    const url = new URL(connectionString);
    const hostname = url.hostname.toLowerCase();
    if (hostname.endsWith(".pooler.supabase.com")) {
      // pg parses sslmode before its explicit ssl option, emitting a warning
      // for the otherwise-unneeded query parameter. The explicit TLS config
      // below is authoritative, so remove it before passing the URL to pg.
      url.searchParams.delete("sslmode");
      config.connectionString = url.toString();
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
