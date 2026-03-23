/**
 * MySQL migration runner (local or server).
 *
 * Usage:
 *   npm run migrate
 *
 * Requires .env with DB_HOST, DB_USER, DB_NAME; DB_PASSWORD optional (defaults to empty, e.g. local MySQL); DB_PORT optional.
 * Applies db/migrations/*.sql in lexical order, tracks applied files in schema_migrations.
 *
 * Order: numeric prefix (000_, 001_, …). Fresh DB: 001_users_table.sql ensures `users`
 * exists before 002_rbac_admin (FK + role_id). On failure, fix DB and re-run; the failed
 * file is not recorded until it completes successfully.
 *
 * Production: back up the database before running migrations; run once per deploy
 * (e.g. before starting the API).
 */

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config();

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function requireEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

async function main() {
  requireEnv("DB_HOST");
  requireEnv("DB_USER");
  requireEnv("DB_NAME");
  // Empty password is valid for local MySQL; missing DB_PASSWORD treats as "".
  const dbPassword = process.env.DB_PASSWORD ?? "";

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: dbPassword,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    multipleStatements: true,
  });

  try {
    await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      version VARCHAR(255) NOT NULL,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_version (version)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter(
        (f) =>
          f.endsWith(".sql") &&
          !f.startsWith("_") &&
          /^\d+[_-]/.test(f)
      )
      .sort();

    if (files.length === 0) {
      console.log("No migration files found in db/migrations/");
      return;
    }

    const [appliedRows] = await connection.query(
      "SELECT version FROM schema_migrations"
    );
    const applied = new Set(appliedRows.map((r) => r.version));

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`[skip] ${file}`);
        continue;
      }

      const fullPath = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(fullPath, "utf8").trim();
      if (!sql) {
        console.log(`[empty] ${file} — recording as applied`);
        await connection.query(
          "INSERT INTO schema_migrations (version) VALUES (?)",
          [file]
        );
        continue;
      }

      console.log(`[apply] ${file}`);
      await connection.query(sql);
      await connection.query(
        "INSERT INTO schema_migrations (version) VALUES (?)",
        [file]
      );
      console.log(`[ok]   ${file}`);
    }

    console.log("Migrations finished.");
  } finally {
    try {
      await connection.end();
    } catch (_) {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
