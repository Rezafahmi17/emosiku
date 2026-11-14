const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_CONFIG = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3307', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'emosiku_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

let pool = null;
let isMySQLConnected = false;

const FALLBACK_FILE = path.join(__dirname, '..', 'database', 'local_fallback_db.json');

const DEMO_USERNAMES = [
    'rani_xi',
    'bima_x',
    'alya_smp',
    'rani@emosiku.id',
    'bima@emosiku.id',
    'alya@emosiku.id'
];

const DEMO_STUDENT_NAMES = [
    'Rani (Langit Senja)',
    'Bima (Bintang Utara)',
    'Alya (Pelangi Pagi)',
    'Rani Putri',
    'Bima Pratama',
    'Alya Zahra'
];

function getInitialSeedData() {
    const passwordAdmin = bcrypt.hashSync('admin123', 10);

    return {
        users: [
            {
                id: 1,
                username: 'admin@emosiku.id',
                password_hash: passwordAdmin,
                alias_name: 'Hadi Wijaya, S.Pd., Kons.',
                full_name: 'Hadi Wijaya, S.Pd., Kons.',
                role: 'admin',
                jenjang: 'SMA',
                class_code: 'Konselor',
                avatar_color: '#0f172a',
                avatar_url: null,
                agreed_consent: 1,
                created_at: new Date().toISOString()
            }
        ],
        emotion_logs: [],
        journals: [],
        counseling_requests: [],
        chat_messages: [],
        calm_sessions: []
    };
}

function readFallbackDB() {
    const dir = path.dirname(FALLBACK_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(FALLBACK_FILE)) {
        const seed = getInitialSeedData();
        fs.writeFileSync(FALLBACK_FILE, JSON.stringify(seed, null, 2), 'utf8');
        return seed;
    }
    try {
        const raw = fs.readFileSync(FALLBACK_FILE, 'utf8');
        const db = JSON.parse(raw);
        // Bersihkan akun demo jika masih ada di file fallback
        const demoIds = new Set(
            (db.users || [])
                .filter((u) => DEMO_USERNAMES.includes((u.username || '').toLowerCase()))
                .map((u) => u.id)
        );
        if (demoIds.size > 0) {
            db.users = (db.users || []).filter((u) => !demoIds.has(u.id));
            db.emotion_logs = (db.emotion_logs || []).filter((e) => !demoIds.has(e.user_id));
            db.journals = (db.journals || []).filter((j) => !demoIds.has(j.user_id));
            db.counseling_requests = (db.counseling_requests || []).filter(
                (c) => !demoIds.has(c.user_id) && !DEMO_STUDENT_NAMES.includes(c.student_name)
            );
            db.chat_messages = (db.chat_messages || []).filter((m) => !demoIds.has(m.student_id));
            fs.writeFileSync(FALLBACK_FILE, JSON.stringify(db, null, 2), 'utf8');
        }
        return db;
    } catch (e) {
        const seed = getInitialSeedData();
        fs.writeFileSync(FALLBACK_FILE, JSON.stringify(seed, null, 2), 'utf8');
        return seed;
    }
}

function writeFallbackDB(data) {
    fs.writeFileSync(FALLBACK_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function ensureUserSchemaAndCleanDemo(dbPool) {
    // 1. Pastikan kolom avatar_url tersedia pada tabel users
    try {
        const [cols] = await dbPool.query("SHOW COLUMNS FROM users LIKE 'avatar_url'");
        if (cols.length === 0) {
            await dbPool.query('ALTER TABLE users ADD COLUMN avatar_url LONGTEXT DEFAULT NULL');
        }
    } catch (e) {
        // Abaikan jika sudah ada
    }

    // 2. Pastikan akun Admin menggunakan email admin@emosiku.id
    try {
        const [adminByEmail] = await dbPool.query('SELECT id FROM users WHERE username = ?', ['admin@emosiku.id']);
        const [legacyAdmin] = await dbPool.query('SELECT id FROM users WHERE username = ?', ['pak_hadi_bk']);

        if (adminByEmail.length === 0 && legacyAdmin.length > 0) {
            await dbPool.query("UPDATE users SET username = 'admin@emosiku.id' WHERE id = ?", [legacyAdmin[0].id]);
        } else if (adminByEmail.length === 0 && legacyAdmin.length === 0) {
            const passwordAdmin = bcrypt.hashSync('admin123', 10);
            await dbPool.query(
                `INSERT INTO users (username, password_hash, alias_name, full_name, role, jenjang, class_code, avatar_color, agreed_consent)
                 VALUES ('admin@emosiku.id', ?, 'Hadi Wijaya, S.Pd., Kons.', 'Hadi Wijaya, S.Pd., Kons.', 'admin', 'SMA', 'Konselor', '#0f172a', 1)`,
                [passwordAdmin]
            );
        }
    } catch (e) {
        console.warn('Info update admin:', e.message);
    }

    // 3. Hapus seluruh data demo siswa (Rani, Bima, Alya) beserta log, jadwal konseling, dan chat demo mereka
    try {
        await dbPool.query(
            `DELETE FROM users WHERE LOWER(username) IN ('rani_xi', 'bima_x', 'alya_smp', 'rani@emosiku.id', 'bima@emosiku.id', 'alya@emosiku.id')`
        );
        await dbPool.query(
            `DELETE FROM counseling_requests WHERE student_name IN ('Rani (Langit Senja)', 'Bima (Bintang Utara)', 'Alya (Pelangi Pagi)', 'Rani Putri', 'Bima Pratama', 'Alya Zahra')`
        );
    } catch (e) {
        console.warn('Info pembersihan data demo:', e.message);
    }
}

async function initDatabase() {
    try {
        const tempConn = await mysql.createConnection({
            host: DB_CONFIG.host,
            port: DB_CONFIG.port,
            user: DB_CONFIG.user,
            password: DB_CONFIG.password,
            multipleStatements: true,
            connectTimeout: 3500
        });

        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');
        await tempConn.query(schemaSql);
        await tempConn.end();

        pool = mysql.createPool(DB_CONFIG);
        await pool.query('SELECT 1');
        isMySQLConnected = true;
        console.log(`[DATABASE] Terhubung ke MySQL pada ${DB_CONFIG.host}:${DB_CONFIG.port} (Database: ${DB_CONFIG.database})`);

        await ensureUserSchemaAndCleanDemo(pool);

        const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM users');
        if (rows[0].cnt === 0) {
            await seedMySQLData(pool);
        }
    } catch (err) {
        isMySQLConnected = false;
        console.warn(`[DATABASE] MySQL di port ${DB_CONFIG.port} belum aktif (${err.message}).`);
        readFallbackDB();
    }
}

async function seedMySQLData(dbPool) {
    const seed = getInitialSeedData();
    for (const u of seed.users) {
        await dbPool.query(
            `INSERT INTO users (id, username, password_hash, alias_name, full_name, role, jenjang, class_code, avatar_color, avatar_url, agreed_consent, created_at)
             VALUES (?, ?, ?, ?, ?, ?, 'SMA', ?, ?, ?, ?, ?)`,
            [u.id, u.username, u.password_hash, u.alias_name, u.full_name, u.role, u.class_code, u.avatar_color, u.avatar_url, u.agreed_consent, new Date(u.created_at)]
        );
    }
    console.log('[DATABASE] Akun Admin utama EMOSIKU siap di MySQL port 3307 (Tanpa Data Demo Siswa).');
}

function getPool() {
    return pool;
}

function getStatus() {
    return {
        engine: isMySQLConnected ? 'MySQL (Port 3307 Connected)' : 'Local Persistence Active',
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        database: DB_CONFIG.database,
        isMySQLConnected
    };
}

module.exports = {
    DB_CONFIG,
    initDatabase,
    ensureUserSchemaAndCleanDemo,
    getPool,
    getStatus,
    readFallbackDB,
    writeFallbackDB
};
