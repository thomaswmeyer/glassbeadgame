import { getPostgresDatabase, closePostgresDatabaseForTests } from './postgres';
import { postgresSchema } from './schema.postgres';
import { getSqliteDatabase, closeSqliteDatabaseForTests } from './sqlite';
import { sqliteSchema } from './schema.sqlite';

export type GameDatabaseDialect = 'sqlite' | 'postgres';

export function getGameDatabaseDialect(): GameDatabaseDialect {
  const databaseUrl = process.env.DATABASE_URL;
  return databaseUrl?.startsWith('postgres://') || databaseUrl?.startsWith('postgresql://')
    ? 'postgres'
    : 'sqlite';
}

export function getGameDatabase() {
  if (getGameDatabaseDialect() === 'postgres') {
    return {
      dialect: 'postgres' as const,
      db: getPostgresDatabase(),
      schema: postgresSchema,
    };
  }

  return {
    dialect: 'sqlite' as const,
    db: getSqliteDatabase(),
    schema: sqliteSchema,
  };
}

export async function closeGameDatabaseForTests() {
  await closePostgresDatabaseForTests();
  closeSqliteDatabaseForTests();
}
