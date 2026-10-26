import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/* =========================================================================
   legacy compatibility client — Benchbook runs zero-database, so this only
   constructs a real pool when DATABASE_URL is actually configured. It never
   throws at import time, which keeps older repo checkouts / stale route
   files compiling and building on Vercel without a database provisioned.
   ========================================================================= */

let cachedPool: Pool | null = null;

function getPool(): Pool {
  if (!cachedPool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "[Benchbook] DATABASE_URL is not set. This deployment runs in zero-database mode — the UI persists in localStorage (src/lib/store.ts) and the public API uses the /api/v1 serverless sandbox. The legacy @/db client exists only for compile compatibility and must not be called."
      );
    }
    cachedPool = new Pool({ connectionString: databaseUrl });
  }
  return cachedPool;
}

/** Lazily-bound drizzle client: real if DATABASE_URL exists, otherwise any actual query throws a descriptive error (never at import/build time). */
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop: string | symbol) {
    const real = drizzle(getPool());
    const value = Reflect.get(real as object, prop);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

/** Matches the old export shape; only closes a pool if one was ever created. */
export const pool = {
  end: async () => {
    if (cachedPool) await cachedPool.end();
  },
} as unknown as Pool;
