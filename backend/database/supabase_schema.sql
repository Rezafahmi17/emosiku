-- =========================================================================
-- SKEMA DATABASE EMOSIKU (Emosi Kita, Kelola Bersama)
-- Target Platform: SUPABASE (PostgreSQL Cloud)
-- =========================================================================
-- Cara menggunakan:
-- 1. Buka dashboard proyek Supabase Anda (https://supabase.com/dashboard)
-- 2. Pilih menu "SQL Editor" di panel kiri
-- 3. Salin dan tempel (paste) seluruh query di bawah ini, lalu klik "Run"
-- =========================================================================

-- 1. Tabel Users (Akun Siswa / Pengguna & Guru BK / Admin)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    alias_name VARCHAR(100) NOT NULL,
    full_name VARCHAR(120) DEFAULT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'siswa',
    jenjang VARCHAR(10) DEFAULT 'SMA',
    class_code VARCHAR(50) DEFAULT 'Umum',
    avatar_color VARCHAR(30) DEFAULT '#0f172a',
    avatar_url TEXT DEFAULT NULL,
    account_status VARCHAR(20) DEFAULT 'approved',
    agreed_consent SMALLINT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Emotion Logs (Cek Emosi Harian & Riwayat Emosi)
CREATE TABLE IF NOT EXISTS emotion_logs (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emotion VARCHAR(50) NOT NULL,
    intensity SMALLINT NOT NULL,
    trigger_factor VARCHAR(100) DEFAULT NULL,
    note TEXT DEFAULT NULL,
    recommended_strategy VARCHAR(150) DEFAULT NULL,
    log_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Tabel Journals (Jurnal Refleksi REBT)
CREATE TABLE IF NOT EXISTS journals (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    situation TEXT NOT NULL,
    thought TEXT NOT NULL,
    feeling VARCHAR(120) NOT NULL,
    action_taken TEXT NOT NULL,
    future_reflection TEXT NOT NULL,
    islamic_gratitude TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Tabel Counseling Requests (Daftar Permintaan Jadwal Konseling Guru BK)
CREATE TABLE IF NOT EXISTS counseling_requests (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_name VARCHAR(100) NOT NULL,
    class_code VARCHAR(50) NOT NULL,
    free_time VARCHAR(150) NOT NULL,
    topic VARCHAR(150) NOT NULL,
    description TEXT DEFAULT NULL,
    status VARCHAR(30) DEFAULT 'Menunggu',
    counselor_note TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabel Chat Messages (Layanan Live Chat Siswa <-> Guru BK / Admin)
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sender_role VARCHAR(20) NOT NULL,
    message TEXT NOT NULL,
    is_read SMALLINT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. Tabel Calm Sessions (Latihan Regulasi Emosi di Ruang Tenang)
CREATE TABLE IF NOT EXISTS calm_sessions (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strategy_name VARCHAR(100) NOT NULL,
    duration_seconds INT DEFAULT 120,
    feeling_after VARCHAR(80) DEFAULT 'Lebih tenang',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index performa untuk query cepat
CREATE INDEX IF NOT EXISTS idx_emotion_logs_user ON emotion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_counseling_user ON counseling_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_student ON chat_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);

-- Inisialisasi Akun Admin Utama (Email: admin@emosiku.id | Sandi: admin123)
-- Password Hash bcrypt untuk: admin123
INSERT INTO users (username, password_hash, alias_name, full_name, role, jenjang, class_code, avatar_color, agreed_consent)
VALUES (
    'admin@emosiku.id',
    '$2a$10$20ijmiTLEcpDjzqels4O6.t1FZg29soK75nW8EQ5.n/SYWx5et0Ii',
    'Hadi Wijaya, S.Pd., Kons.',
    'Hadi Wijaya, S.Pd., Kons.',
    'admin',
    'SMA',
    'Konselor',
    '#0f172a',
    1
)
ON CONFLICT (username) DO NOTHING;
