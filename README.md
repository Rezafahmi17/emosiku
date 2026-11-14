# EMOSIKU (Emosi Kita, Kelola Bersama) 🌱
**Aplikasi Web Regulasi Emosi, Refleksi Diri, & Live Chat Konsultasi BK untuk Siswa SMP & SMA**

Aplikasi ini dirancang berdasarkan proposal penelitian & pengembangan (R&D Model ADDIE) **EMOSIKU**, memadukan teori Kecerdasan Emosional (Goleman), Regulasi Emosi (Gross), Konseling Rasional-Emotif / Journaling (REBT), nilai pengendalian emosi dalam Islam (QS. Ali 'Imran: 134 & QS. Ar-Ra'd: 28), serta prinsip Kode Etik Bimbingan dan Konseling & UU Pelindungan Data Pribadi.

---

## 📁 Struktur Program (Terpisah antara `frontend/` dan `backend/`)

```text
emosiku/
├── backend/                        # Server API Node.js + Express + MySQL (Port 3307)
│   ├── config/
│   │   └── db.js                   # Koneksi Pool MySQL Port 3307 + Auto-Seeding & Hybrid Fallback
│   ├── database/
│   │   └── schema.sql              # Skema DDL MySQL (users, emotion_logs, journals, counseling_requests, chat_messages, calm_sessions)
│   ├── middleware/
│   │   └── authMiddleware.js       # Proteksi JWT untuk Akun Siswa & Admin (Guru BK)
│   ├── routes/
│   │   ├── authRoutes.js           # Endpoint Login & Pendaftaran Siswa (SMP/SMA) dan Admin
│   │   ├── emotionRoutes.js        # Endpoint Cek Emosi Harian, Riwayat, & Hapus Semua Data Saya
│   │   ├── journalRoutes.js        # Endpoint Jurnal Refleksi 4 Kolom (REBT + Refleksi Syukur/Sabar)
│   │   ├── counselingRoutes.js     # Endpoint Formulir Hubungi Guru BK & Dasbor Agregat Anonim
│   │   └── chatRoutes.js           # Endpoint Live Chat Konsultasi (Siswa <-> Admin Multi-Pengguna)
│   ├── .env                        # Konfigurasi Port Server (5000) & MySQL (Port 3307)
│   ├── package.json                # Daftar dependensi backend
│   ├── seed.js                     # Skrip inisialisasi database & akun contoh
│   └── server.js                   # Entry point server backend
│
├── frontend/                       # Antarmuka Pengguna (JavaScript + Tailwind CSS Responsif)
│   ├── index.html                  # Halaman Utama (Landing Page, Dashboard Siswa, Panel Admin Guru BK)
│   └── js/
│       ├── data-content.js         # Konten Ilmiah 8 Kamus Emosi (Offline-ready), 4 Strategi Ruang Tenang, & Angket SUS
│       ├── api.js                  # Modul HTTP Client komunikasi Frontend -> Backend
│       └── app.js                  # Logika UI, Animasi Napas Kotak 4-4-4-4, Grafik Mingguan, & Live Chat Multi-User
└── README.md                       # Dokumentasi Proyek
```

---

## ⚙️ Konfigurasi Database MySQL (Port `3307`)

File konfigurasi terdapat di `backend/.env` dan `backend/config/db.js`:
```env
PORT=5000
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASS=
DB_NAME=emosiku_db
```
- Saat server dijalankan, `backend/config/db.js` otomatis membuat database `emosiku_db` beserta seluruh tabel dari `backend/database/schema.sql` pada MySQL **Port 3307** dan mengisi data awal (seed).
- Jika service MySQL di port `3307` sedang belum dinyalakan, sistem dilengkapi *Hybrid Persistence Fallback* otomatis sehingga seluruh fitur (termasuk pendaftaran akun, cek emosi, jurnal, dan multi-user chat) tetap dapat langsung diuji tanpa error.

---

## 🚀 Cara Menjalankan Aplikasi

1. Masuk ke folder `backend` dan instal dependensi:
   ```bash
   cd backend
   npm install
   ```
2. Jalankan server:
   ```bash
   npm start
   ```
3. Buka di peramban (browser):
   ```text
   http://localhost:5000
   ```

---

## 🔑 Akun Demo Siap Pakai (Tersedia Tombol Login 1-Klik di Landing Page)

| Peran | Username | Password | Jenjang & Kelas | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Admin / Guru BK** | `pak_hadi_bk` | `admin123` | Konselor Sekolah | Akses **Multi-User Chat** (banyak siswa) & **Dasbor Agregat Kelas** |
| **Siswa SMA** | `rani_xi` | `siswa123` | SMA - `XI-IPA-1` | Memiliki riwayat emosi, jurnal REBT, & percakapan chat dengan Guru BK |
| **Siswa SMA** | `bima_x` | `siswa123` | SMA - `X-IPS-2` | Siswa kelas X dengan pesan konsultasi kecemasan ujian |
| **Siswa SMP** | `alya_smp` | `siswa123` | SMP - `VIII-A` | Siswa SMP dengan pesan konsultasi adaptasi pertemanan |

