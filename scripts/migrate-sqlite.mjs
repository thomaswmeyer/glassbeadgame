import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_DATABASE_PATH = 'data/glassbeadgame.dev.sqlite';
const MIGRATIONS_DIR = resolve('db/migrations/sqlite');

function resolveDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.startsWith('file:')) {
    return resolve(databaseUrl.slice('file:'.length));
  }

  return resolve(process.env.SQLITE_DATABASE_PATH || DEFAULT_DATABASE_PATH);
}

function runSql(databasePath, sql) {
  const result = spawnSync('sqlite3', [databasePath], {
    input: sql,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `sqlite3 exited with status ${result.status}`);
  }
}

function sqliteString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const databasePath = resolveDatabasePath();
mkdirSync(dirname(databasePath), { recursive: true });

runSql(databasePath, `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const appliedRows = spawnSync('sqlite3', [
  databasePath,
  "SELECT filename FROM schema_migrations ORDER BY filename;",
], {
  encoding: 'utf8',
});

if (appliedRows.status !== 0) {
  throw new Error(appliedRows.stderr || 'Failed to read applied migrations');
}

const applied = new Set(appliedRows.stdout.split('\n').filter(Boolean));
const migrations = readdirSync(MIGRATIONS_DIR)
  .filter(filename => filename.endsWith('.sql'))
  .sort();

for (const filename of migrations) {
  if (applied.has(filename)) continue;

  const migrationSql = readFileSync(join(MIGRATIONS_DIR, filename), 'utf8');
  runSql(databasePath, `
    PRAGMA foreign_keys = ON;
    ${migrationSql}
    INSERT INTO schema_migrations (filename) VALUES (${sqliteString(filename)});
  `);
  console.log(`Applied ${filename}`);
}

console.log(`SQLite database is up to date: ${databasePath}`);
