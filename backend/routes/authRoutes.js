const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool, getStatus, ensureUserSchemaAndCleanDemo, readFallbackDB, writeFallbackDB } = require('../config/db');
const { JWT_SECRET, verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

const AVATAR_COLORS = ['#0f172a', '#0f766e', '#1e293b', '#334155', '#0369a1', '#4338ca'];

// POST /api/auth/register - Pendaftaran Akun Baru (Menunggu Konfirmasi Super Admin)
router.post('/register', async (req, res) => {
    try {
        const {
            email,
            username,
            password,
            alias_name,
            full_name = '',
            role = 'siswa',
            class_code = 'Umum',
            agreed_consent = true
        } = req.body;

        const rawAccountIdentifier = (email || username || '').trim().toLowerCase();

        if (!rawAccountIdentifier || !password || !alias_name) {
            return res.status(400).json({
                success: false,
                message: 'Alamat email, nama tampilan, dan kata sandi wajib diisi.'
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
        const validRole = role === 'admin' ? 'admin' : 'siswa';
        const initialStatus = validRole === 'admin' ? 'approved' : 'pending';

        const dbStatus = getStatus();
        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await ensureUserSchemaAndCleanDemo(pool);

            const [existing] = await pool.query(
                'SELECT id, account_status FROM users WHERE LOWER(username) = ?',
                [rawAccountIdentifier]
            );

            if (existing.length > 0) {
                const currentStatus = (existing[0].account_status || 'approved').toLowerCase();
                if (currentStatus === 'rejected') {
                    // Izinkan pengguna yang sempat ditolak untuk mengajukan pendaftaran ulang
                    await pool.query(
                        `UPDATE users
                         SET password_hash = ?, alias_name = ?, full_name = ?, class_code = ?, account_status = 'pending', created_at = CURRENT_TIMESTAMP
                         WHERE id = ?`,
                        [passwordHash, alias_name.trim(), (full_name || alias_name).trim(), class_code.trim() || 'Umum', existing[0].id]
                    );
                    return res.status(200).json({
                        success: true,
                        pending_approval: true,
                        message: 'Pengajuan ulang akun berhasil dikirim! Silakan tunggu konfirmasi persetujuan dari Super Admin sebelum masuk.'
                    });
                }
                if (currentStatus === 'pending') {
                    return res.status(400).json({
                        success: false,
                        message: 'Email tersebut sudah terdaftar dan saat ini sedang menunggu konfirmasi persetujuan dari Super Admin.'
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: 'Email tersebut sudah terdaftar. Silakan masuk menggunakan akun Anda.'
                });
            }

            const [result] = await pool.query(
                `INSERT INTO users (username, password_hash, alias_name, full_name, role, jenjang, class_code, avatar_color, avatar_url, account_status, agreed_consent)
                 VALUES (?, ?, ?, ?, ?, 'SMA', ?, ?, NULL, ?, ?)`,
                [
                    rawAccountIdentifier,
                    passwordHash,
                    alias_name.trim(),
                    (full_name || alias_name).trim(),
                    validRole,
                    class_code.trim() || 'Umum',
                    randomColor,
                    initialStatus,
                    agreed_consent ? 1 : 0
                ]
            );

            const newUser = {
                id: result.insertId,
                username: rawAccountIdentifier,
                email: rawAccountIdentifier,
                alias_name: alias_name.trim(),
                full_name: (full_name || alias_name).trim(),
                role: validRole,
                class_code: class_code.trim() || 'Umum',
                avatar_color: randomColor,
                avatar_url: null,
                account_status: initialStatus
            };

            if (validRole === 'siswa' && newUser.id) {
                try {
                    await pool.query(
                        `INSERT INTO chat_messages (student_id, sender_id, sender_role, message, is_read)
                         VALUES (?, 1, 'admin', ?, 0)`,
                        [
                            newUser.id,
                            `Halo ${newUser.alias_name}. Selamat datang di Ruang Konsultasi EMOSIKU. Silakan sampaikan hal yang ingin didiskusikan, privasi percakapan Anda terjaga sepenuhnya.`
                        ]
                    );
                } catch (e) {}
            }

            if (initialStatus === 'pending') {
                return res.status(201).json({
                    success: true,
                    pending_approval: true,
                    message: 'Pendaftaran berhasil dikirim! Akun Anda sedang menunggu konfirmasi (persetujuan) dari Super Admin sebelum dapat digunakan untuk masuk.',
                    user: newUser
                });
            }

            const token = jwt.sign(
                {
                    id: newUser.id,
                    username: newUser.username,
                    email: newUser.email,
                    alias_name: newUser.alias_name,
                    role: newUser.role,
                    class_code: newUser.class_code,
                    avatar_color: newUser.avatar_color
                },
                JWT_SECRET,
                { expiresIn: '7d' }
            );
            return res.status(201).json({
                success: true,
                message: 'Akun berhasil dibuat.',
                token,
                user: newUser
            });
        } else {
            const db = readFallbackDB();
            const exists = db.users.find((u) => u.username.toLowerCase() === rawAccountIdentifier);
            if (exists) {
                const currentStatus = (exists.account_status || 'approved').toLowerCase();
                if (currentStatus === 'rejected') {
                    exists.password_hash = passwordHash;
                    exists.alias_name = alias_name.trim();
                    exists.full_name = (full_name || alias_name).trim();
                    exists.class_code = class_code.trim() || 'Umum';
                    exists.account_status = 'pending';
                    exists.created_at = new Date().toISOString();
                    writeFallbackDB(db);
                    return res.status(200).json({
                        success: true,
                        pending_approval: true,
                        message: 'Pengajuan ulang akun berhasil dikirim! Silakan tunggu konfirmasi persetujuan dari Super Admin sebelum masuk.'
                    });
                }
                if (currentStatus === 'pending') {
                    return res.status(400).json({
                        success: false,
                        message: 'Email tersebut sudah terdaftar dan saat ini sedang menunggu konfirmasi persetujuan dari Super Admin.'
                    });
                }
                return res.status(400).json({
                    success: false,
                    message: 'Email tersebut sudah terdaftar. Silakan masuk menggunakan akun Anda.'
                });
            }

            const newId = db.users.length > 0 ? Math.max(...db.users.map((u) => u.id)) + 1 : 1;
            const newUserRecord = {
                id: newId,
                username: rawAccountIdentifier,
                password_hash: passwordHash,
                alias_name: alias_name.trim(),
                full_name: (full_name || alias_name).trim(),
                role: validRole,
                jenjang: 'SMA',
                class_code: class_code.trim() || 'Umum',
                avatar_color: randomColor,
                avatar_url: null,
                account_status: initialStatus,
                agreed_consent: agreed_consent ? 1 : 0,
                created_at: new Date().toISOString()
            };

            db.users.push(newUserRecord);

            if (validRole === 'siswa') {
                const msgId = db.chat_messages.length > 0 ? Math.max(...db.chat_messages.map((m) => m.id)) + 1 : 1;
                db.chat_messages.push({
                    id: msgId,
                    student_id: newId,
                    sender_id: 1,
                    sender_role: 'admin',
                    message: `Halo ${newUserRecord.alias_name}. Selamat datang di Ruang Konsultasi EMOSIKU. Silakan sampaikan hal yang ingin didiskusikan, privasi percakapan Anda terjaga sepenuhnya.`,
                    is_read: 0,
                    created_at: new Date().toISOString()
                });
            }

            writeFallbackDB(db);

            const userPayload = {
                id: newUserRecord.id,
                username: newUserRecord.username,
                email: newUserRecord.username,
                alias_name: newUserRecord.alias_name,
                full_name: newUserRecord.full_name,
                role: newUserRecord.role,
                class_code: newUserRecord.class_code,
                avatar_color: newUserRecord.avatar_color,
                avatar_url: null,
                account_status: initialStatus
            };

            if (initialStatus === 'pending') {
                return res.status(201).json({
                    success: true,
                    pending_approval: true,
                    message: 'Pendaftaran berhasil dikirim! Akun Anda sedang menunggu konfirmasi (persetujuan) dari Super Admin sebelum dapat digunakan untuk masuk.',
                    user: userPayload
                });
            }

            const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });
            return res.status(201).json({
                success: true,
                message: 'Akun berhasil dibuat.',
                token,
                user: userPayload
            });
        }
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat mendaftar.' });
    }
});

// POST /api/auth/login - Login Standar dengan Pemeriksaan Status Konfirmasi Super Admin
router.post('/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;
        const identifier = (email || username || '').trim().toLowerCase();

        if (!identifier || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email dan kata sandi wajib diisi.'
            });
        }

        const aliasIdentifierMap = {
            'admin@emosiku.id': ['admin@emosiku.id', 'pak_hadi_bk']
        };
        const candidates = aliasIdentifierMap[identifier] || [identifier];

        const dbStatus = getStatus();
        let userRow = null;

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await ensureUserSchemaAndCleanDemo(pool);

            const placeholders = candidates.map(() => '?').join(', ');
            const [rows] = await pool.query(
                `SELECT * FROM users WHERE LOWER(username) IN (${placeholders}) LIMIT 1`,
                candidates
            );
            userRow = rows[0] || null;
        } else {
            const db = readFallbackDB();
            userRow = db.users.find((u) => candidates.includes(u.username.toLowerCase())) || null;
        }

        if (!userRow) {
            return res.status(401).json({
                success: false,
                message: 'Akun belum terdaftar. Silakan daftar akun terlebih dahulu.'
            });
        }

        const isMatch = await bcrypt.compare(password, userRow.password_hash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Kata sandi yang Anda masukkan salah.'
            });
        }

        // Cek status persetujuan akun oleh Super Admin (untuk akun non-admin)
        if (userRow.role !== 'admin') {
            const accountStatus = (userRow.account_status || 'approved').toLowerCase();
            if (accountStatus === 'pending') {
                return res.status(403).json({
                    success: false,
                    account_status: 'pending',
                    message: 'Akun Anda sedang menunggu konfirmasi persetujuan dari Super Admin. Silakan coba masuk kembali setelah akun Anda disetujui.'
                });
            }
            if (accountStatus === 'rejected') {
                return res.status(403).json({
                    success: false,
                    account_status: 'rejected',
                    message: 'Pendaftaran akun Anda ditolak oleh Super Admin. Anda dapat mengajukan pendaftaran ulang pada menu Daftar Akun.'
                });
            }
        }

        const jwtPayload = {
            id: userRow.id,
            username: userRow.username,
            email: userRow.username,
            alias_name: userRow.alias_name,
            full_name: userRow.full_name || '',
            role: userRow.role,
            class_code: userRow.class_code,
            avatar_color: userRow.avatar_color,
            account_status: userRow.account_status || 'approved'
        };

        const userResponse = {
            ...jwtPayload,
            avatar_url: userRow.avatar_url || null
        };

        const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '7d' });

        res.json({
            success: true,
            message: `Selamat datang, ${userRow.alias_name}.`,
            token,
            user: userResponse
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server saat login.' });
    }
});

// GET /api/auth/admin/users - Daftar Seluruh Akun Pengguna untuk Verifikasi Super Admin
router.get('/admin/users', verifyAdmin, async (req, res) => {
    try {
        const dbStatus = getStatus();
        let rawUsers = [];

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await ensureUserSchemaAndCleanDemo(pool);

            const [rows] = await pool.query(
                `SELECT id, username, alias_name, full_name, role, jenjang, class_code, avatar_color, avatar_url, account_status, created_at
                 FROM users
                 WHERE role = 'siswa'
                 ORDER BY created_at DESC`
            );
            rawUsers = rows;
        } else {
            const db = readFallbackDB();
            rawUsers = db.users
                .filter((u) => u.role === 'siswa')
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        const statusOrder = { pending: 0, approved: 1, rejected: 2 };
        const users = rawUsers
            .map((u) => ({
                id: u.id,
                username: u.username,
                email: u.username,
                alias_name: u.alias_name,
                full_name: u.full_name || u.alias_name,
                role: u.role,
                class_code: u.class_code || 'Umum',
                avatar_color: u.avatar_color || '#0f172a',
                avatar_url: u.avatar_url || null,
                account_status: (u.account_status || 'approved').toLowerCase(),
                created_at: u.created_at
            }))
            .sort((a, b) => {
                const oa = statusOrder[a.account_status] ?? 1;
                const ob = statusOrder[b.account_status] ?? 1;
                if (oa !== ob) return oa - ob;
                return new Date(b.created_at) - new Date(a.created_at);
            });

        const counts = {
            pending: users.filter((u) => u.account_status === 'pending').length,
            approved: users.filter((u) => u.account_status === 'approved').length,
            rejected: users.filter((u) => u.account_status === 'rejected').length,
            total: users.length
        };

        res.json({
            success: true,
            counts,
            users
        });
    } catch (error) {
        console.error('Get admin users error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat daftar akun pengguna.' });
    }
});

// PATCH /api/auth/admin/users/:id/status - Super Admin Konfirmasi (Setujui / Tolak) Akun Baru
router.patch('/admin/users/:id/status', verifyAdmin, async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const rawStatus = (req.body.status || '').trim().toLowerCase();

        if (!['approved', 'rejected', 'pending'].includes(rawStatus)) {
            return res.status(400).json({
                success: false,
                message: 'Status konfirmasi tidak valid (gunakan approved, rejected, atau pending).'
            });
        }

        const dbStatus = getStatus();
        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await ensureUserSchemaAndCleanDemo(pool);

            await pool.query(
                'UPDATE users SET account_status = ? WHERE id = ? AND role != ?',
                [rawStatus, targetId, 'admin']
            );
        } else {
            const db = readFallbackDB();
            const targetUser = db.users.find((u) => u.id === targetId && u.role !== 'admin');
            if (!targetUser) {
                return res.status(404).json({ success: false, message: 'Akun pengguna tidak ditemukan.' });
            }
            targetUser.account_status = rawStatus;
            writeFallbackDB(db);
        }

        const msgMap = {
            approved: 'Akun berhasil disetujui dan kini sudah dapat digunakan oleh pengguna untuk masuk.',
            rejected: 'Pendaftaran akun pengguna telah ditolak.',
            pending: 'Status akun dikembalikan menjadi menunggu konfirmasi.'
        };

        res.json({
            success: true,
            message: msgMap[rawStatus],
            user: { id: targetId, account_status: rawStatus }
        });
    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui status akun pengguna.' });
    }
});

// POST /api/auth/admin/users/approve-all - Setujui Seluruh Akun yang Menunggu Konfirmasi
router.post('/admin/users/approve-all', verifyAdmin, async (req, res) => {
    try {
        const dbStatus = getStatus();
        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await ensureUserSchemaAndCleanDemo(pool);
            await pool.query("UPDATE users SET account_status = 'approved' WHERE role = 'siswa' AND account_status = 'pending'");
        } else {
            const db = readFallbackDB();
            db.users.forEach((u) => {
                if (u.role === 'siswa' && (u.account_status || 'approved') === 'pending') {
                    u.account_status = 'approved';
                }
            });
            writeFallbackDB(db);
        }

        res.json({
            success: true,
            message: 'Seluruh akun yang menunggu konfirmasi berhasil disetujui.'
        });
    } catch (error) {
        console.error('Approve all users error:', error);
        res.status(500).json({ success: false, message: 'Gagal menyetujui seluruh akun.' });
    }
});

// DELETE /api/auth/admin/users/:id - Hapus Akun Pengguna oleh Super Admin
router.delete('/admin/users/:id', verifyAdmin, async (req, res) => {
    try {
        const targetId = parseInt(req.params.id, 10);
        const dbStatus = getStatus();

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await pool.query("DELETE FROM users WHERE id = ? AND role != 'admin'", [targetId]);
        } else {
            const db = readFallbackDB();
            db.users = db.users.filter((u) => !(u.id === targetId && u.role !== 'admin'));
            db.emotion_logs = (db.emotion_logs || []).filter((e) => e.user_id !== targetId);
            db.journals = (db.journals || []).filter((j) => j.user_id !== targetId);
            db.counseling_requests = (db.counseling_requests || []).filter((c) => c.user_id !== targetId);
            db.chat_messages = (db.chat_messages || []).filter((m) => m.student_id !== targetId);
            writeFallbackDB(db);
        }

        res.json({
            success: true,
            message: 'Akun pengguna beserta datanya berhasil dihapus.'
        });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus akun pengguna.' });
    }
});

// PUT /api/auth/profile - Edit Profil Akun (Foto Profil, Nama, Email, Kelas/Jabatan, Kata Sandi)
router.put('/profile', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            alias_name,
            full_name = '',
            email,
            class_code,
            new_password,
            avatar_url
        } = req.body;

        const cleanAlias = (alias_name || '').trim();
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanClass = (class_code || '').trim();

        if (!cleanAlias || !cleanEmail) {
            return res.status(400).json({
                success: false,
                message: 'Nama tampilan dan alamat email tidak boleh kosong.'
            });
        }

        const dbStatus = getStatus();

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await ensureUserSchemaAndCleanDemo(pool);

            const [dup] = await pool.query(
                'SELECT id FROM users WHERE LOWER(username) = ? AND id != ?',
                [cleanEmail, userId]
            );
            if (dup.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Alamat email tersebut sudah digunakan oleh akun lain.'
                });
            }

            const [currentRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
            if (currentRows.length === 0) {
                return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
            }
            const currentUser = currentRows[0];

            const updatedPasswordHash =
                new_password && new_password.trim().length >= 6
                    ? await bcrypt.hash(new_password.trim(), 10)
                    : currentUser.password_hash;

            const updatedAvatarUrl =
                avatar_url !== undefined ? avatar_url : (currentUser.avatar_url || null);

            const updatedClass = cleanClass || currentUser.class_code || 'Umum';

            await pool.query(
                `UPDATE users
                 SET username = ?, password_hash = ?, alias_name = ?, full_name = ?, class_code = ?, avatar_url = ?
                 WHERE id = ?`,
                [
                    cleanEmail,
                    updatedPasswordHash,
                    cleanAlias,
                    (full_name || cleanAlias).trim(),
                    updatedClass,
                    updatedAvatarUrl,
                    userId
                ]
            );

            await pool.query(
                'UPDATE counseling_requests SET student_name = ?, class_code = ? WHERE user_id = ?',
                [cleanAlias, updatedClass, userId]
            );

            const jwtPayload = {
                id: userId,
                username: cleanEmail,
                email: cleanEmail,
                alias_name: cleanAlias,
                full_name: (full_name || cleanAlias).trim(),
                role: currentUser.role,
                class_code: updatedClass,
                avatar_color: currentUser.avatar_color
            };

            const updatedUser = {
                ...jwtPayload,
                avatar_url: updatedAvatarUrl
            };

            const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '7d' });

            return res.json({
                success: true,
                message: 'Profil akun Anda berhasil diperbarui.',
                token,
                user: updatedUser
            });
        } else {
            const db = readFallbackDB();
            const dup = db.users.find((u) => u.username.toLowerCase() === cleanEmail && u.id !== userId);
            if (dup) {
                return res.status(400).json({
                    success: false,
                    message: 'Alamat email tersebut sudah digunakan oleh akun lain.'
                });
            }

            const userObj = db.users.find((u) => u.id === userId);
            if (!userObj) {
                return res.status(404).json({ success: false, message: 'Akun tidak ditemukan.' });
            }

            userObj.username = cleanEmail;
            userObj.alias_name = cleanAlias;
            userObj.full_name = (full_name || cleanAlias).trim();
            if (cleanClass) userObj.class_code = cleanClass;
            if (new_password && new_password.trim().length >= 6) {
                userObj.password_hash = await bcrypt.hash(new_password.trim(), 10);
            }
            if (avatar_url !== undefined) {
                userObj.avatar_url = avatar_url;
            }

            db.counseling_requests.forEach((r) => {
                if (r.user_id === userId) {
                    r.student_name = cleanAlias;
                    if (cleanClass) r.class_code = cleanClass;
                }
            });

            writeFallbackDB(db);

            const jwtPayload = {
                id: userObj.id,
                username: userObj.username,
                email: userObj.username,
                alias_name: userObj.alias_name,
                full_name: userObj.full_name,
                role: userObj.role,
                class_code: userObj.class_code,
                avatar_color: userObj.avatar_color
            };

            const updatedUser = {
                ...jwtPayload,
                avatar_url: userObj.avatar_url || null
            };

            const token = jwt.sign(jwtPayload, JWT_SECRET, { expiresIn: '7d' });

            return res.json({
                success: true,
                message: 'Profil akun Anda berhasil diperbarui.',
                token,
                user: updatedUser
            });
        }
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui profil akun.' });
    }
});

// GET /api/auth/me - Ambil profil user saat ini
router.get('/me', verifyToken, async (req, res) => {
    try {
        const dbStatus = getStatus();
        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
            if (rows.length > 0) {
                const u = rows[0];
                return res.json({
                    success: true,
                    user: {
                        id: u.id,
                        username: u.username,
                        email: u.username,
                        alias_name: u.alias_name,
                        full_name: u.full_name || '',
                        role: u.role,
                        class_code: u.class_code,
                        avatar_color: u.avatar_color,
                        avatar_url: u.avatar_url || null,
                        account_status: u.account_status || 'approved'
                    }
                });
            }
        }
        res.json({ success: true, user: req.user });
    } catch (e) {
        res.json({ success: true, user: req.user });
    }
});

module.exports = router;
