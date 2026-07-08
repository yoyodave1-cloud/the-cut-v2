"use strict";

/**
 * Apply creator_videos view-velocity columns migration against production Supabase.
 *
 * Usage (from backend/):
 *   railway run node scripts/runCreatorVideosViewVelocityMigration.js
 *
 * Auth options (first match wins):
 *   - SUPABASE_ACCESS_TOKEN (Management API database/query)
 *   - DATABASE_URL or SUPABASE_DB_URL (direct Postgres via pg)
 */

const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const MIGRATION_SQL = fs.readFileSync(
  path.join(__dirname, "..", "supabase", "migrations", "creator_videos_view_velocity.sql"),
  "utf8",
);

const VERIFY_SQL = `
SELECT column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'creator_videos'
  AND column_name IN ('view_count_prev', 'view_count_prev_at')
ORDER BY column_name;
`;

async function runViaManagementApi(sql) {
  const token =
    process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_PAT || "";
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const ref = supabaseUrl.replace(/^https:\/\//, "").split(".")[0];

  if (!token || !ref) return { ok: false, rows: null };

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Management API query failed (${res.status}): ${text}`);
  }

  let rows = null;
  try {
    rows = JSON.parse(text);
  } catch {
    rows = text;
  }

  return { ok: true, rows };
}

async function connectPostgres() {
  const { Client } = require("pg");
  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const ref = supabaseUrl.replace(/^https:\/\//, "").split(".")[0];
  const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

  if (databaseUrl) {
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    console.log("[viewVelocityMigration] Connected via DATABASE_URL");
    return client;
  }

  const password =
    process.env.SUPABASE_DB_PASSWORD || process.env.POSTGRES_PASSWORD || "";
  if (!ref || !password) return null;

  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("[viewVelocityMigration] Connected via direct Postgres");
  return client;
}

async function runQuery(sql) {
  const management = await runViaManagementApi(sql).catch((err) => {
    console.warn(
      "[viewVelocityMigration] Management API failed:",
      err instanceof Error ? err.message : String(err),
    );
    return { ok: false, rows: null };
  });
  if (management.ok) return management.rows;

  const client = await connectPostgres().catch((err) => {
    console.warn(
      "[viewVelocityMigration] Postgres connect failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  });

  if (!client) {
    throw new Error(
      "No migration auth available. Set SUPABASE_ACCESS_TOKEN or DATABASE_URL on Railway, or run supabase/migrations/creator_videos_view_velocity.sql in the Supabase SQL editor.",
    );
  }

  try {
    const result = await client.query(sql);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function main() {
  await runQuery(MIGRATION_SQL);
  console.log("[viewVelocityMigration] Applied migration SQL.");

  const columns = await runQuery(VERIFY_SQL);
  console.log("[viewVelocityMigration] creator_videos columns:");
  console.log(JSON.stringify(columns, null, 2));

  const names = Array.isArray(columns)
    ? columns.map((row) => row.column_name)
    : [];
  const missing = ["view_count_prev", "view_count_prev_at"].filter(
    (name) => !names.includes(name),
  );
  if (missing.length) {
    throw new Error(`Missing columns after migration: ${missing.join(", ")}`);
  }

  console.log("[viewVelocityMigration] Verified view_count_prev and view_count_prev_at exist.");
}

main().catch((err) => {
  console.error(
    "[viewVelocityMigration] Fatal:",
    err instanceof Error ? err.message : err,
  );
  process.exit(1);
});
