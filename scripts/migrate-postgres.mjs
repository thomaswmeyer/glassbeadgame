import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = resolve('db/migrations/postgres');

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl?.startsWith('postgres://') && !databaseUrl?.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a postgres:// or postgresql:// URL');
  }

  return databaseUrl;
}

function shouldUseSsl(databaseUrl) {
  if (process.env.DATABASE_SSL === 'true') return true;
  if (process.env.DATABASE_SSL === 'false') return false;

  const parsed = new URL(databaseUrl);
  return parsed.searchParams.get('sslmode') === 'require' || parsed.hostname.endsWith('.render.com');
}

const databaseUrl = getDatabaseUrl();
const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: shouldUseSsl(databaseUrl) ? { rejectUnauthorized: false } : undefined,
});

await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const appliedRows = await client.query('SELECT filename FROM schema_migrations ORDER BY filename;');
  const applied = new Set(appliedRows.rows.map(row => row.filename));
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter(filename => filename.endsWith('.sql'))
    .sort();

  for (const filename of migrations) {
    if (applied.has(filename)) continue;

    const migrationSql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
    console.log(`Applying ${filename}`);
    await client.query('BEGIN');
    try {
      await client.query(migrationSql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1);', [filename]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  await client.end();
}
