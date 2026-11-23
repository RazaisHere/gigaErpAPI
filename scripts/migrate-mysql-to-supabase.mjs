/**
 * Apply Postgres schema + copy giga_workspace tables from MySQL → Supabase.
 *
 * Usage: node --env-file=.env scripts/migrate-mysql-to-supabase.mjs
 *
 * Uses DATABASE_URL for Postgres. Prefer a session/direct connection for DDL;
 * if DATABASE_URL uses pooler :6543, this script also tries :5432.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, '..', 'db', 'postgres', '001_workspace_schema.sql');

function sessionUrl(url) {
  try {
    const u = new URL(url);
    if (u.port === '6543') {
      u.port = '5432';
      u.searchParams.delete('pgbouncer');
      return u.toString();
    }
  } catch {
    /* ignore */
  }
  return url;
}

async function connectPg(primaryUrl) {
  const candidates = [sessionUrl(primaryUrl), primaryUrl].filter(
    (v, i, a) => v && a.indexOf(v) === i,
  );
  let lastErr;
  for (const url of candidates) {
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
    });
    try {
      await client.connect();
      console.log(`Connected Postgres via ${url.includes(':5432') ? '5432/session' : 'given URL'}`);
      return client;
    } catch (err) {
      lastErr = err;
      try {
        await client.end();
      } catch {
        /* ignore */
      }
    }
  }
  throw lastErr;
}

const mysqlConn = await mysql.createConnection({
  host: process.env.DB_HOST ?? process.env.SOURCE_DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? process.env.SOURCE_DB_PORT ?? 3306),
  user: process.env.DB_USER ?? process.env.SOURCE_DB_USER,
  password: process.env.DB_PASSWORD ?? process.env.SOURCE_DB_PASSWORD ?? '',
  database: 'giga_workspace',
  dateStrings: true,
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const pgClient = await connectPg(databaseUrl);

const schemaSql = fs.readFileSync(schemaPath, 'utf8');
console.log('Applying schema…');
await pgClient.query(schemaSql);

const boolCols = new Set([
  'must_change_password',
  'is_admin',
  'is_allowed',
  'client_visible',
]);

const tables = [
  'roles',
  'departments',
  'users',
  'user_roles',
  'department_users',
  'case_categories',
  'sla_rules',
  'handoff_rules',
  'client_links',
  'pending_client_signups',
  'cases',
  'case_notes',
  'case_handoffs',
  'notification_templates',
  'audit_logs',
];

// Wipe in reverse FK order for idempotent re-runs
for (const t of [...tables].reverse()) {
  await pgClient.query(`TRUNCATE TABLE ${t} RESTART IDENTITY CASCADE`);
}

for (const table of tables) {
  const [rows] = await mysqlConn.query(`SELECT * FROM \`${table}\``);
  if (!rows.length) {
    console.log(`✓ ${table}: 0 rows`);
    continue;
  }

  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
  const sql = `INSERT INTO ${table} (${colList}) VALUES (${placeholders})`;

  for (const row of rows) {
    const values = cols.map((c) => {
      let v = row[c];
      if (boolCols.has(c)) {
        return Boolean(Number(v));
      }
      return v;
    });
    await pgClient.query(sql, values);
  }

  // Advance identity sequence past max id
  await pgClient.query(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`,
  );

  console.log(`✓ ${table}: ${rows.length} rows`);
}

await mysqlConn.end();
await pgClient.end();
console.log('\nMigration complete.');
