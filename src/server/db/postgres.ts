import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { postgresSchema } from './schema.postgres';

let postgresPool: Pool | null = null;
let drizzleDatabase: ReturnType<typeof drizzle<typeof postgresSchema>> | null = null;

function getPostgresDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith('postgres://') && !databaseUrl?.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a postgres:// or postgresql:// URL');
  }

  return databaseUrl;
}

function shouldUseSsl(databaseUrl: string) {
  if (process.env.DATABASE_SSL === 'true') return true;
  if (process.env.DATABASE_SSL === 'false') return false;

  try {
    const parsed = new URL(databaseUrl);
    return parsed.searchParams.get('sslmode') === 'require' || parsed.hostname.endsWith('.render.com');
  } catch {
    return false;
  }
}

export function getPostgresDatabase() {
  if (drizzleDatabase) return drizzleDatabase;

  const connectionString = getPostgresDatabaseUrl();
  postgresPool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  drizzleDatabase = drizzle(postgresPool, { schema: postgresSchema });

  return drizzleDatabase;
}

export async function closePostgresDatabaseForTests() {
  await postgresPool?.end();
  postgresPool = null;
  drizzleDatabase = null;
}
