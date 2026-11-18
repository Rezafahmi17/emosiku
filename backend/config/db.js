const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const mysql = require("mysql2/promise");
const { Pool: PgPool } = require("pg");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const DB_CONFIG = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: parseInt(process.env.DB_PORT || "3307", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "emosiku_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;
let isConnected = false;
let dbEngine = "none"; // 'postgres', 'mysql', 'fallback'

const FALLBACK_FILE = path.join(
  __dirname,
  "..",
  "database",
  "local_fallback_db.json",
);

const DEMO_USERNAMES = [
  "rani_xi",
  "bima_x",
  "alya_smp",
  "nabila_ix",
  "dimas_xi",
  "rani@emosiku.id",
  "bima@emosiku.id",
  "alya@emosiku.id",
  "nabila@emosiku.id",
  "dimas@emosiku.id",
];

const DEMO_STUDENT_NAMES = [
  "Rani (Langit Senja)",
  "Bima (Bintang Utara)",
  "Alya (Pelangi Pagi)",
  "Nabila (Embun Pagi)",
  "Dimas (Elang Muda)",
  "Rani Putri",
  "Bima Pratama",
  "Alya Zahra",
];

/**
 * Wrapper PostgreSQL yang kompatibel dengan format query & pemanggilan MySQL pool
 * Mengonversi placeholder ? menjadi $1, $2, dst. serta menyediakan insertId pada INSERT
 */
class PgPoolWrapper {
  constructor(pgPool) {
    this.pgPool = pgPool;
  }

  async query(sql, params = []) {
    let paramIndex = 1;
    let pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);

    const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
    if (isInsert && !/RETURNING/i.test(pgSql)) {
      pgSql += " RETURNING id";
    }

    const res = await this.pgPool.query(pgSql, params || []);
    const rows = res.rows || [];
    const insertId = isInsert && rows.length > 0 ? (rows[0].id ?? null) : null;

    const resultMeta = {
      insertId,
      affectedRows: res.rowCount,
      rowCount: res.rowCount,
    };

    Object.assign(rows, resultMeta);
    return [rows, res.fields];
  }

  async end() {
    return this.pgPool.end();
  }
}

function getInitialSeedData() {
  const passwordAdmin = bcrypt.hashSync("admin123", 10);

  return {
    users: [
      {
        id: 1,
        username: "admin@emosiku.id",
        password_hash: passwordAdmin,
        alias_name: "Hadi Wijaya, S.Pd., Kons.",
        full_name: "Hadi Wijaya, S.Pd., Kons.",
        role: "admin",
        jenjang: "SMA",
        class_code: "Konselor",
        avatar_color: "#0f172a",
        avatar_url: null,
        agreed_consent: 1,
        created_at: new Date().toISOString(),
      },
    ],
    emotion_logs: [],
    journals: [],
    counseling_requests: [],
    chat_messages: [],
    calm_sessions: [],
  };
}

function readFallbackDB() {
  const dir = path.dirname(FALLBACK_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(FALLBACK_FILE)) {
    const seed = getInitialSeedData();
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
  try {
    const raw = fs.readFileSync(FALLBACK_FILE, "utf8");
    const db = JSON.parse(raw);
    const demoIds = new Set(
      (db.users || [])
        .filter((u) =>
          DEMO_USERNAMES.includes((u.username || "").toLowerCase()),
        )
        .map((u) => u.id),
    );
    if (demoIds.size > 0) {
      db.users = (db.users || []).filter((u) => !demoIds.has(u.id));
      db.emotion_logs = (db.emotion_logs || []).filter(
        (e) => !demoIds.has(e.user_id),
      );
      db.journals = (db.journals || []).filter((j) => !demoIds.has(j.user_id));
      db.counseling_requests = (db.counseling_requests || []).filter(
        (c) =>
          !demoIds.has(c.user_id) &&
          !DEMO_STUDENT_NAMES.includes(c.student_name),
      );
      db.chat_messages = (db.chat_messages || []).filter(
        (m) => !demoIds.has(m.student_id),
      );
      fs.writeFileSync(FALLBACK_FILE, JSON.stringify(db, null, 2), "utf8");
    }
    return db;
  } catch (e) {
    const seed = getInitialSeedData();
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

function writeFallbackDB(data) {
  fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), "utf8");
}

async function ensureUserSchemaAndCleanDemo(dbPool) {
  if (dbEngine === "postgres") {
    try {
      await dbPool.query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL",
      );
      await dbPool.query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'approved'",
      );
      await dbPool.query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) DEFAULT 'approved'",
      );
    } catch (e) { }

    try {
      await dbPool.query(
        `DELETE FROM users WHERE LOWER(username) IN ('rani_xi', 'bima_x', 'alya_smp', 'nabila_ix', 'dimas_xi', 'rani@emosiku.id', 'bima@emosiku.id', 'alya@emosiku.id', 'nabila@emosiku.id', 'dimas@emosiku.id')`,
      );
      await dbPool.query(
        `DELETE FROM users WHERE alias_name IN ('Nabila (Embun Pagi)', 'Dimas (Elang Muda)', 'Rani (Langit Senja)', 'Bima (Bintang Utara)', 'Alya (Pelangi Pagi)')`,
      );
      await dbPool.query(
        `DELETE FROM counseling_requests WHERE student_name IN ('Rani (Langit Senja)', 'Bima (Bintang Utara)', 'Alya (Pelangi Pagi)', 'Nabila (Embun Pagi)', 'Dimas (Elang Muda)', 'Rani Putri', 'Bima Pratama', 'Alya Zahra')`,
      );
      await dbPool.query(
        `DELETE FROM counseling_requests WHERE student_name IN ('Rani (Langit Senja)', 'Bima (Bintang Utara)', 'Alya (Pelangi Pagi)', 'Nabila (Embun Pagi)', 'Dimas (Elang Muda)', 'Rani Putri', 'Bima Pratama', 'Alya Zahra')`,
      );
    } catch (e) { }
    return;
  }

  // Skema MySQL
  try {
    const [cols] = await dbPool.query(
      "SHOW COLUMNS FROM users LIKE 'avatar_url'",
    );
    if (cols.length === 0) {
      await dbPool.query(
        "ALTER TABLE users ADD COLUMN avatar_url LONGTEXT DEFAULT NULL",
      );
    }
  } catch (e) { }

  try {
    const [statusCols] = await dbPool.query(
      "SHOW COLUMNS FROM users LIKE 'account_status'",
    );
    if (statusCols.length === 0) {
      await dbPool.query(
        "ALTER TABLE users ADD COLUMN account_status VARCHAR(20) DEFAULT 'approved'",
      );
    }
  } catch (e) { }

  try {
    const [statusCols] = await dbPool.query(
      "SHOW COLUMNS FROM users LIKE 'account_status'",
    );
    if (statusCols.length === 0) {
      await dbPool.query(
        "ALTER TABLE users ADD COLUMN account_status VARCHAR(20) DEFAULT 'approved'",
      );
    }
  } catch (e) {}

  try {
    const [adminByEmail] = await dbPool.query(
      "SELECT id FROM users WHERE username = ?",
      ["admin@emosiku.id"],
    );
    const [legacyAdmin] = await dbPool.query(
      "SELECT id FROM users WHERE username = ?",
      ["pak_hadi_bk"],
    );

    if (adminByEmail.length === 0 && legacyAdmin.length > 0) {
      await dbPool.query(
        "UPDATE users SET username = 'admin@emosiku.id' WHERE id = ?",
        [legacyAdmin[0].id],
      );
    } else if (adminByEmail.length === 0 && legacyAdmin.length === 0) {
      const passwordAdmin = bcrypt.hashSync("admin123", 10);
      await dbPool.query(
        `INSERT INTO users (username, password_hash, alias_name, full_name, role, jenjang, class_code, avatar_color, account_status, agreed_consent)
                 VALUES ('admin@emosiku.id', ?, 'Hadi Wijaya, S.Pd., Kons.', 'Hadi Wijaya, S.Pd., Kons.', 'admin', 'SMA', 'Konselor', '#0f172a', 'approved', 1)`,
        [passwordAdmin],
      );
    }
  } catch (e) {
    console.warn("Info update admin:", e.message);
  }

  try {
    await dbPool.query(
      `DELETE FROM users WHERE LOWER(username) IN ('rani_xi', 'bima_x', 'alya_smp', 'nabila_ix', 'dimas_xi', 'rani@emosiku.id', 'bima@emosiku.id', 'alya@emosiku.id', 'nabila@emosiku.id', 'dimas@emosiku.id')`,
    );
    await dbPool.query(
      `DELETE FROM users WHERE alias_name IN ('Nabila (Embun Pagi)', 'Dimas (Elang Muda)', 'Rani (Langit Senja)', 'Bima (Bintang Utara)', 'Alya (Pelangi Pagi)')`,
    );
    await dbPool.query(
      `DELETE FROM counseling_requests WHERE student_name IN ('Rani (Langit Senja)', 'Bima (Bintang Utara)', 'Alya (Pelangi Pagi)', 'Nabila (Embun Pagi)', 'Dimas (Elang Muda)', 'Rani Putri', 'Bima Pratama', 'Alya Zahra')`,
    );
  } catch (e) {
    console.warn("Info pembersihan data demo:", e.message);
  }
}

async function initDatabase() {
  const postgresUrl =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL;

  // 1. Prioritas Cloud / Supabase PostgreSQL (jika konfigurasi tersedia)
  if (postgresUrl) {
    try {
      console.log(
        "[DATABASE] Mencoba menghubungkan ke Supabase / PostgreSQL...",
      );
      const pgClient = new PgPool({
        connectionString: postgresUrl,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 7000,
      });
      await pgClient.query("SELECT 1");
      pool = new PgPoolWrapper(pgClient);
      isConnected = true;
      dbEngine = "postgres";
      console.log(
        "[DATABASE] Sukses terhubung ke Supabase (PostgreSQL Cloud)!",
      );

      await ensureUserSchemaAndCleanDemo(pool);
      return;
    } catch (pgErr) {
      console.warn(
        `[DATABASE] Koneksi PostgreSQL / Supabase gagal: ${pgErr.message}`,
      );
    }
  }

  // 2. MySQL Lokal (Port 3307)
  try {
    const tempConn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
      multipleStatements: true,
      connectTimeout: 3500,
    });

    const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf8");
    await tempConn.query(schemaSql);
    await tempConn.end();

    const mysqlPool = mysql.createPool(DB_CONFIG);
    await mysqlPool.query("SELECT 1");
    pool = mysqlPool;
    isConnected = true;
    dbEngine = "mysql";
    console.log(
      `[DATABASE] Terhubung ke MySQL pada ${DB_CONFIG.host}:${DB_CONFIG.port} (Database: ${DB_CONFIG.database})`,
    );

    await ensureUserSchemaAndCleanDemo(pool);

    const [rows] = await pool.query("SELECT COUNT(*) AS cnt FROM users");
    if (rows[0].cnt === 0) {
      await seedMySQLData(pool);
    }
  } catch (err) {
    isConnected = false;
    dbEngine = "fallback";
    console.warn(
      `[DATABASE] MySQL di port ${DB_CONFIG.port} belum aktif (${err.message}). Menggunakan penyimpanan lokal.`,
    );
    readFallbackDB();
  }
}

async function seedMySQLData(dbPool) {
  const seed = getInitialSeedData();
  for (const u of seed.users) {
    await dbPool.query(
      `INSERT INTO users (id, username, password_hash, alias_name, full_name, role, jenjang, class_code, avatar_color, avatar_url, agreed_consent, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'SMA', ?, ?, ?, ?, ?)`,
      [
        u.id,
        u.username,
        u.password_hash,
        u.alias_name,
        u.full_name,
        u.role,
        u.class_code,
        u.avatar_color,
        u.avatar_url,
        u.agreed_consent,
        new Date(u.created_at),
      ],
    );
  }
  console.log(
    "[DATABASE] Akun Admin utama EMOSIKU siap di MySQL port 3307 (Tanpa Data Demo Siswa).",
  );
}

function getPool() {
  return pool;
}

function getStatus() {
  let engineLabel = "Local Persistence Active";
  if (isConnected) {
    engineLabel =
      dbEngine === "postgres"
        ? "Supabase (PostgreSQL Cloud Connected)"
        : `MySQL (Port ${DB_CONFIG.port} Connected)`;
  }

  return {
    engine: engineLabel,
    host: dbEngine === "postgres" ? "Supabase Cloud" : DB_CONFIG.host,
    port: dbEngine === "postgres" ? 5432 : DB_CONFIG.port,
    database: dbEngine === "postgres" ? "postgres" : DB_CONFIG.database,
    isMySQLConnected: isConnected,
    dbEngine,
  };
}

let initPromise = null;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = initDatabase().catch((err) => {
      console.warn("[DATABASE] Inisialisasi error:", err.message);
    });
  }
  return initPromise;
}

module.exports = {
  DB_CONFIG,
  initDatabase,
  ensureInitialized,
  ensureUserSchemaAndCleanDemo,
  getPool,
  getStatus,
  readFallbackDB,
  writeFallbackDB,
};
