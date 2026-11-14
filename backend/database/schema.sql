-- ==========================================================
-- SKEMA DATABASE EMOSIKU (Emosi Kita, Kelola Bersama)
-- Port MySQL: 3307
-- Sasaran: Siswa SMP - SMA & Guru BK (Admin)
-- ==========================================================

CREATE DATABASE IF NOT EXISTS emosiku_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE emosiku_db;

-- 1. Tabel Users (Siswa / Pengguna & Guru BK / Admin)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    alias_name VARCHAR(100) NOT NULL COMMENT 'Nama Samaran Siswa atau Nama Guru BK',
    full_name VARCHAR(120) DEFAULT NULL COMMENT 'Opsional, minimisasi data sesuai etika BK',
    role ENUM('siswa', 'admin') NOT NULL DEFAULT 'siswa',
    jenjang ENUM('SMP', 'SMA') DEFAULT 'SMA',
    class_code VARCHAR(30) DEFAULT 'Umum' COMMENT 'Kode Kelas atau Kelompok',
    avatar_color VARCHAR(30) DEFAULT '#0f172a',
    avatar_url LONGTEXT DEFAULT NULL COMMENT 'Foto profil pengguna (Data URL / URL)',
    agreed_consent TINYINT(1) DEFAULT 1 COMMENT 'Persetujuan penggunaan & privasi data',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabel Emotion Logs (Cek Emosi Harian & Riwayat Emosiku)
CREATE TABLE IF NOT EXISTS emotion_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    emotion VARCHAR(30) NOT NULL COMMENT 'senang, tenang, sedih, marah, cemas, takut, kecewa, malu',
    intensity TINYINT NOT NULL COMMENT 'Skala 1 sampai 5',
    trigger_factor VARCHAR(60) DEFAULT NULL COMMENT 'Sekolah, Teman, Keluarga, Diri sendiri, Lainnya',
    note TEXT DEFAULT NULL COMMENT 'Ceritakan sedikit tentang perasaanmu hari ini',
    recommended_strategy VARCHAR(100) DEFAULT NULL,
    log_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Tabel Journals (Jurnal Refleksi REBT 4 Kolom + Refleksi Islami/Diri)
CREATE TABLE IF NOT EXISTS journals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    situation TEXT NOT NULL COMMENT 'Kejadian yang dialami',
    thought TEXT NOT NULL COMMENT 'Pikiran yang muncul saat kejadian',
    feeling VARCHAR(120) NOT NULL COMMENT 'Perasaan dan intensitasnya',
    action_taken TEXT NOT NULL COMMENT 'Tindakan yang dilakukan saat itu',
    future_reflection TEXT NOT NULL COMMENT 'Apa yang bisa aku lakukan berbeda lain kali?',
    islamic_gratitude TEXT DEFAULT NULL COMMENT 'Refleksi syukur & sabar (opsional)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Tabel Counseling Requests (Formulir Hubungi Guru BK)
CREATE TABLE IF NOT EXISTS counseling_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    student_name VARCHAR(100) NOT NULL COMMENT 'Nama / Nama Samaran yang diisi siswa',
    class_code VARCHAR(30) NOT NULL,
    free_time VARCHAR(120) NOT NULL COMMENT 'Waktu luang untuk konseling tatap muka/daring',
    topic VARCHAR(120) NOT NULL COMMENT 'Topik umum: Akademik, Pertemanan, Keluarga, Regulasi Emosi, Lainnya',
    description TEXT DEFAULT NULL,
    status ENUM('Menunggu', 'Dijadwalkan', 'Selesai') DEFAULT 'Menunggu',
    counselor_note TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Tabel Chat Messages (Fitur Konsultasi Multi-User Siswa <-> Admin/Guru BK)
CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL COMMENT 'ID user siswa pemilik ruang konsultasi',
    sender_id INT NOT NULL COMMENT 'ID pengirim pesan (bisa siswa atau admin)',
    sender_role ENUM('siswa', 'admin') NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Tabel Calm Sessions (Catatan Latihan Ruang Tenang)
CREATE TABLE IF NOT EXISTS calm_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    strategy_name VARCHAR(80) NOT NULL COMMENT 'Napas Kotak 4-4-4-4, Grounding 5-4-3-2-1, Ubah Sudut Pandang, Zikir & Wudu',
    duration_seconds INT DEFAULT 120,
    feeling_after VARCHAR(60) DEFAULT 'Lebih tenang',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

