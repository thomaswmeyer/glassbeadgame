const databaseUrl = process.env.DATABASE_URL || '';

if (databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')) {
  await import('./migrate-postgres.mjs');
} else {
  await import('./migrate-sqlite.mjs');
}
