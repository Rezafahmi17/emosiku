const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch (_) {
    nodemailer = null;
}
const {
    getPool,
    getStatus,
    ensurePasswordResetsTable,
    readFallbackDB,
    writeFallbackDB
} = require('../config/db');

const router = express.Router();

const CODE_TTL_MS = 10 * 60 * 1000; // kode berlaku 10 menit
const TOKEN_TTL_MS = 10 * 60 * 1000; // token ganti sandi berlaku 10 menit
const RESEND_COOLDOWN_MS = 60 * 1000; // jeda minta kode baru 60 detik
const MAX_ATTEMPTS = 5;

const isProduction = () => !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const sha256 = (v) => crypto.createHash('sha256').update(String(v)).digest('hex');
const cleanEmail = (v) => String(v || '').trim().toLowerCase();
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function getTransporter() {
    if (!nodemailer) return null;
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
    const port = Number(process.env.SMTP_PORT || 465);
    const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
}

async function sendResetEmail(transporter, to, name, code) {
    const from = process.env.MAIL_FROM || `EMOSIKU <${process.env.SMTP_USER}>`;
    const safeName = String(name || 'Pengguna').replace(/[<>&"]/g, '');
    await transporter.sendMail({
        from,
        to,
        subject: `Kode Verifikasi Reset Kata Sandi EMOSIKU: ${code}`,
        text: `Halo ${safeName},\n\nKode verifikasi reset kata sandi EMOSIKU Anda: ${code}\nKode berlaku 10 menit. Jangan bagikan kode ini kepada siapa pun.\n\nJika Anda tidak merasa meminta reset kata sandi, abaikan email ini.`,
        html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f8fafc">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;padding:28px">
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:2px;color:#0f766e;font-weight:700">EMOSIKU</p>
            <h2 style="margin:0 0 12px;font-size:20px;color:#0f172a">Reset Kata Sandi</h2>
            <p style="margin:0 0 16px;font-size:14px;color:#475569">Halo <strong>${safeName}</strong>, gunakan kode verifikasi berikut untuk membuat kata sandi baru:</p>
            <div style="text-align:center;margin:20px 0;padding:16px;background:#0f172a;border-radius:12px">
              <span style="font-size:34px;letter-spacing:10px;font-weight:700;color:#ffffff;font-family:monospace">${code}</span>
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#475569">Kode berlaku selama <strong>10 menit</strong>. Jangan bagikan kode ini kepada siapa pun.</p>
            <p style="margin:0;font-size:12px;color:#94a3b8">Jika Anda tidak merasa meminta reset kata sandi, abaikan email ini.</p>
          </div>
        </div>`
    });
}

// ---------- Akses data (MySQL / PostgreSQL / file lokal) ----------
async function findUser(email) {
    const status = getStatus();
    if (status.isMySQLConnected) {
        const pool = getPool();
        const [rows] = await pool.query(
            'SELECT id, username, alias_name, role FROM users WHERE LOWER(username) = ? LIMIT 1',
            [email]
        );
        return rows[0] || null;
    }
    const db = readFallbackDB();
    return (
        db.users.find(
            (u) =>
                (u.username || '').toLowerCase() === email ||
                (u.email || '').toLowerCase() === email
        ) || null
    );
}

async function getRecord(email) {
    const status = getStatus();
    if (status.isMySQLConnected) {
        const pool = getPool();
        await ensurePasswordResetsTable(pool);
        const [rows] = await pool.query('SELECT * FROM password_resets WHERE email = ? LIMIT 1', [email]);
        if (!rows[0]) return null;
        return {
            ...rows[0],
            attempts: Number(rows[0].attempts || 0),
            expires_at: Number(rows[0].expires_at),
            created_at: Number(rows[0].created_at)
        };
    }
    const db = readFallbackDB();
    return (db.password_resets || []).find((r) => r.email === email) || null;
}

async function deleteRecord(email) {
    const status = getStatus();
    if (status.isMySQLConnected) {
        const pool = getPool();
        await ensurePasswordResetsTable(pool);
        await pool.query('DELETE FROM password_resets WHERE email = ?', [email]);
        return;
    }
    const db = readFallbackDB();
    db.password_resets = (db.password_resets || []).filter((r) => r.email !== email);
    writeFallbackDB(db);
}

async function createRecord(rec) {
    await deleteRecord(rec.email);
    const status = getStatus();
    if (status.isMySQLConnected) {
        const pool = getPool();
        await pool.query(
            'INSERT INTO password_resets (email, code_hash, token_hash, attempts, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [rec.email, rec.code_hash, rec.token_hash || '', 0, rec.expires_at, rec.created_at]
        );
        return;
    }
    const db = readFallbackDB();
    db.password_resets = db.password_resets || [];
    db.password_resets.push({ ...rec, token_hash: rec.token_hash || '', attempts: 0 });
    writeFallbackDB(db);
}

async function updateRecord(email, fields) {
    const status = getStatus();
    if (status.isMySQLConnected) {
        const pool = getPool();
        const keys = Object.keys(fields);
        const setSql = keys.map((k) => `${k} = ?`).join(', ');
        await pool.query(`UPDATE password_resets SET ${setSql} WHERE email = ?`, [...keys.map((k) => fields[k]), email]);
        return;
    }
    const db = readFallbackDB();
    const rec = (db.password_resets || []).find((r) => r.email === email);
    if (rec) {
        Object.assign(rec, fields);
        writeFallbackDB(db);
    }
}

async function setUserPassword(user, passwordHash) {
    const status = getStatus();
    if (status.isMySQLConnected) {
        const pool = getPool();
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);
        return;
    }
    const db = readFallbackDB();
    const target = db.users.find((u) => u.id === user.id);
    if (target) {
        target.password_hash = passwordHash;
        writeFallbackDB(db);
    }
}

// ---------- 1. Minta kode verifikasi ----------
router.post('/forgot-password', async (req, res) => {
    try {
        const email = cleanEmail(req.body.email);
        if (!isValidEmail(email)) {
            return res.status(400).json({ success: false, message: 'Masukkan alamat email yang valid.' });
        }

        const generic = {
            success: true,
            cooldown: RESEND_COOLDOWN_MS / 1000,
            message: 'Jika email tersebut terdaftar, kode verifikasi 6 digit telah dikirim. Periksa kotak masuk atau folder spam.'
        };

        const user = await findUser(email);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Alamat email tidak terdaftar di sistem EMOSIKU. Silakan periksa kembali email Anda atau daftar akun baru.'
            });
        }

        const existing = await getRecord(email);
        if (existing && Date.now() - existing.created_at < RESEND_COOLDOWN_MS) {
            const leftSec = Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - existing.created_at)) / 1000));
            return res.status(429).json({
                success: false,
                message: `Mohon tunggu ${leftSec} detik sebelum meminta kode baru.`
            });
        }

        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        const now = Date.now();
        await createRecord({
            email,
            code_hash: bcrypt.hashSync(code, 8),
            expires_at: now + CODE_TTL_MS,
            created_at: now
        });

        const transporter = getTransporter();
        if (transporter) {
            try {
                await sendResetEmail(transporter, email, user.alias_name, code);
                return res.json({
                    success: true,
                    cooldown: RESEND_COOLDOWN_MS / 1000,
                    message: 'Kode verifikasi 6 digit telah dikirim ke email Anda. Silakan periksa kotak masuk atau spam.'
                });
            } catch (mailErr) {
                console.error('Pengiriman email via SMTP gagal, beralih ke kode verifikasi langsung:', mailErr.message);
                return res.json({
                    success: true,
                    cooldown: RESEND_COOLDOWN_MS / 1000,
                    dev_code: code,
                    message: `Kode verifikasi Anda adalah ${code}.`
                });
            }
        }

        // Jika SMTP belum dikonfigurasi oleh administrator, tampilkan kode langsung agar pengguna tidak macet
        console.log(`[RESET SANDI] Kode untuk ${email}: ${code}`);
        return res.json({
            success: true,
            cooldown: RESEND_COOLDOWN_MS / 1000,
            dev_code: code,
            message: `Kode verifikasi Anda adalah ${code}.`
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
});

// ---------- 2. Verifikasi kode ----------
router.post('/verify-reset-code', async (req, res) => {
    try {
        const email = cleanEmail(req.body.email);
        const code = String(req.body.code || '').replace(/\D/g, '');
        const invalid = {
            success: false,
            message: 'Kode tidak valid atau sudah kedaluwarsa. Silakan minta kode baru.'
        };

        const rec = await getRecord(email);
        if (!rec || !rec.code_hash || Date.now() > rec.expires_at) {
            return res.status(400).json(invalid);
        }
        if (rec.attempts >= MAX_ATTEMPTS) {
            await deleteRecord(email);
            return res.status(429).json({
                success: false,
                message: 'Terlalu banyak percobaan salah. Silakan minta kode baru.'
            });
        }
        if (code.length !== 6 || !bcrypt.compareSync(code, rec.code_hash)) {
            const attempts = rec.attempts + 1;
            await updateRecord(email, { attempts });
            const left = Math.max(0, MAX_ATTEMPTS - attempts);
            return res.status(400).json({
                success: false,
                message: `Kode yang Anda masukkan salah. Sisa percobaan: ${left}.`
            });
        }

        const resetToken = crypto.randomBytes(24).toString('hex');
        await updateRecord(email, {
            code_hash: '',
            token_hash: sha256(resetToken),
            attempts: 0,
            expires_at: Date.now() + TOKEN_TTL_MS
        });

        res.json({
            success: true,
            reset_token: resetToken,
            message: 'Kode terverifikasi. Silakan buat kata sandi baru.'
        });
    } catch (error) {
        console.error('Verify reset code error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
});

// ---------- 3. Ganti kata sandi ----------
router.post('/reset-password', async (req, res) => {
    try {
        const email = cleanEmail(req.body.email);
        const token = String(req.body.reset_token || '');
        const newPassword = String(req.body.new_password || '');

        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Kata sandi baru minimal 6 karakter.' });
        }

        const rec = await getRecord(email);
        if (!rec || !rec.token_hash || Date.now() > rec.expires_at || rec.token_hash !== sha256(token)) {
            return res.status(400).json({
                success: false,
                message: 'Sesi reset kata sandi tidak valid atau sudah berakhir. Ulangi dari awal.'
            });
        }

        const user = await findUser(email);
        if (!user) {
            await deleteRecord(email);
            return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
        }

        await setUserPassword(user, await bcrypt.hash(newPassword, 10));
        await deleteRecord(email);

        res.json({
            success: true,
            role: user.role,
            message: 'Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru Anda.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
    }
});

module.exports = router;
