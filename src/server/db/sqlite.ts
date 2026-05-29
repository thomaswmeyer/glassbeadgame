import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { dirname, resolve } from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { sqliteSchema } from './schema.sqlite';

const DEFAULT_DATABASE_PATH = 'data/glassbeadgame.dev.sqlite';
const SQLITE_FILE_URL_PREFIX = 'file:';

let sqliteDatabase: Database.Database | null = null;
let drizzleDatabase: ReturnType<typeof drizzle<typeof sqliteSchema>> | null = null;

function resolveSqliteDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl?.startsWith(SQLITE_FILE_URL_PREFIX)) {
    return resolve(databaseUrl.slice(SQLITE_FILE_URL_PREFIX.length));
  }

  return resolve(process.env.SQLITE_DATABASE_PATH || DEFAULT_DATABASE_PATH);
}

function applySqliteSchema(database: Database.Database) {
  const migration = readFileSync(resolve('db/migrations/sqlite/0001_initial_schema.sql'), 'utf8');
  database.pragma('foreign_keys = ON');
  database.exec(migration);
}

export function getSqliteDatabase() {
  if (drizzleDatabase) return drizzleDatabase;

  const databasePath = resolveSqliteDatabasePath();
  mkdirSync(dirname(databasePath), { recursive: true });

  sqliteDatabase = new Database(databasePath);
  applySqliteSchema(sqliteDatabase);
  drizzleDatabase = drizzle(sqliteDatabase, { schema: sqliteSchema });

  return drizzleDatabase;
}

export function closeSqliteDatabaseForTests() {
  sqliteDatabase?.close();
  sqliteDatabase = null;
  drizzleDatabase = null;
}
