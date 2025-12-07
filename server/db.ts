import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

let pool: any;
let db: any;

if (process.env.NODE_ENV === 'production') {
  // Use node-postgres for Lightsail/production
  const pg = await import('pg');
  const drizzleNodePg = await import('drizzle-orm/node-postgres');
  pool = new pg.default.Pool({ 
    connectionString: process.env.DATABASE_URL,
    max: 10,
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  db = drizzleNodePg.drizzle(pool, { schema });
} else {
  // Use Neon for Replit development
  const neon = await import('@neondatabase/serverless');
  const drizzleNeon = await import('drizzle-orm/neon-serverless');
  const ws = (await import('ws')).default;
  neon.neonConfig.webSocketConstructor = ws;
  pool = new neon.Pool({ connectionString: process.env.DATABASE_URL });
  db = drizzleNeon.drizzle({ client: pool, schema });
}

export { pool, db };
