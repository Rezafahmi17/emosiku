const express = require('express');
const { getPool, getStatus, ensureUserSchemaAndCleanDemo, readFallbackDB, writeFallbackDB } = require('../config/db');
const { verifyToken, verifyStaff } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/counseling/my-requests - Ambil daftar permintaan konseling milik pengguna
router.get('/my-requests', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const dbStatus = getStatus();
        let requests = [];

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT * FROM counseling_requests WHERE user_id = ? ORDER BY created_at DESC',
                [userId]
            );
            requests = rows;
        } else {
            const db = readFallbackDB();
            requests = db.counseling_requests
                .filter((r) => r.user_id === userId)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        res.json({ success: true, requests });
    } catch (error) {
        console.error('Get counseling requests error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat jadwal konseling.' });
    }
});

// POST /api/counseling - Pengguna mengirim formulir Permintaan Jadwal Konseling
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            student_name,
            class_code,
            free_time,
            topic,
            description = ''
        } = req.body;

        if (!student_name || !class_code || !free_time || !topic) {
            return res.status(400).json({
                success: false,
                message: 'Nama, kode kelas/kelompok, waktu luang, dan topik konseling wajib diisi.'
            });
        }

        const dbStatus = getStatus();
        let createdReq = null;

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            const [result] = await pool.query(
                `INSERT INTO counseling_requests (user_id, student_name, class_code, free_time, topic, description, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'Menunggu')`,
                [userId, student_name.trim(), class_code.trim(), free_time.trim(), topic.trim(), description.trim()]
            );
            createdReq = {
                id: result.insertId,
                user_id: userId,
                student_name: student_name.trim(),
                class_code: class_code.trim(),
                free_time: free_time.trim(),
                topic: topic.trim(),
                description: description.trim(),
                status: 'Menunggu',
                counselor_note: '',
                created_at: new Date().toISOString()
            };
        } else {
            const db = readFallbackDB();
            const newId = db.counseling_requests.length > 0 ? Math.max(...db.counseling_requests.map((r) => r.id)) + 1 : 1;
            createdReq = {
                id: newId,
                user_id: userId,
                student_name: student_name.trim(),
                class_code: class_code.trim(),
                free_time: free_time.trim(),
                topic: topic.trim(),
                description: description.trim(),
                status: 'Menunggu',
                counselor_note: '',
                created_at: new Date().toISOString()
            };
            db.counseling_requests.push(createdReq);
            writeFallbackDB(db);
        }

        res.status(201).json({
            success: true,
            message: 'Permintaan jadwal konseling berhasil dikirim.',
            data: createdReq
        });
    } catch (error) {
        console.error('Create counseling request error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim permintaan konseling.' });
    }
});

// DELETE /api/counseling/:id - Pengguna menghapus permintaan jadwal konseling miliknya
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const reqId = parseInt(req.params.id, 10);
        const userId = req.user.id;
        const isAdmin = ['admin', 'konselor'].includes(req.user.role);
        const dbStatus = getStatus();

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            if (isAdmin) {
                await pool.query('DELETE FROM counseling_requests WHERE id = ?', [reqId]);
            } else {
                await pool.query('DELETE FROM counseling_requests WHERE id = ? AND user_id = ?', [reqId, userId]);
            }
        } else {
            const db = readFallbackDB();
            db.counseling_requests = db.counseling_requests.filter((r) =>
                isAdmin ? r.id !== reqId : !(r.id === reqId && r.user_id === userId)
            );
            writeFallbackDB(db);
        }

        res.json({
            success: true,
            message: 'Permintaan jadwal konseling berhasil dihapus.'
        });
    } catch (error) {
        console.error('Delete counseling request error:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus jadwal konseling.' });
    }
});

// GET /api/counseling/admin/dashboard - Dasbor Agregat & Anonim untuk Admin / Konselor
router.get('/admin/dashboard', verifyStaff, async (req, res) => {
    try {
        const { classFilter = 'ALL' } = req.query;
        const dbStatus = getStatus();

        let users = [];
        let emotionLogs = [];
        let counselingRequests = [];

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await ensureUserSchemaAndCleanDemo(pool);

            const [uRows] = await pool.query("SELECT id, alias_name, jenjang, class_code, created_at FROM users WHERE role = 'siswa'");
            const [eRows] = await pool.query('SELECT * FROM emotion_logs ORDER BY created_at DESC');
            const [cRows] = await pool.query('SELECT * FROM counseling_requests ORDER BY created_at DESC');
            users = uRows;
            emotionLogs = eRows;
            counselingRequests = cRows;
        } else {
            const db = readFallbackDB();
            users = db.users.filter((u) => u.role === 'siswa');
            emotionLogs = db.emotion_logs;
            counselingRequests = db.counseling_requests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        const userMap = {};
        users.forEach((u) => {
            userMap[u.id] = u;
        });

        const filteredLogs = classFilter === 'ALL'
            ? emotionLogs
            : emotionLogs.filter((l) => userMap[l.user_id] && userMap[l.user_id].class_code === classFilter);

        const emotionCounts = {
            senang: 0,
            tenang: 0,
            sedih: 0,
            marah: 0,
            cemas: 0,
            takut: 0,
            kecewa: 0,
            malu: 0
        };

        const triggerCounts = {
            Sekolah: 0,
            Teman: 0,
            Keluarga: 0,
            'Diri sendiri': 0,
            Lainnya: 0
        };

        filteredLogs.forEach((log) => {
            const emo = (log.emotion || '').toLowerCase();
            if (emotionCounts[emo] !== undefined) {
                emotionCounts[emo] += 1;
            }
            const trig = log.trigger_factor || 'Lainnya';
            if (triggerCounts[trig] !== undefined) {
                triggerCounts[trig] += 1;
            } else {
                triggerCounts.Lainnya += 1;
            }
        });

        const classSummary = {};
        users.forEach((u) => {
            const cls = u.class_code || 'Umum';
            if (!classSummary[cls]) {
                classSummary[cls] = { class_code: cls, jenjang: u.jenjang, registered_students: 0, log_count: 0 };
            }
            classSummary[cls].registered_students += 1;
        });
        emotionLogs.forEach((l) => {
            const u = userMap[l.user_id];
            if (u && classSummary[u.class_code]) {
                classSummary[u.class_code].log_count += 1;
            }
        });

        const selectedClassStudentCount = classFilter === 'ALL'
            ? users.length
            : (classSummary[classFilter] ? classSummary[classFilter].registered_students : 0);

        res.json({
            success: true,
            totalStudents: users.length,
            totalEmotionLogs: filteredLogs.length,
            selectedClassStudentCount,
            privacyThresholdMet: classFilter === 'ALL' || selectedClassStudentCount >= 10,
            emotionCounts,
            triggerCounts,
            classList: Object.values(classSummary),
            counselingRequests
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat data agregat Dasbor Admin.' });
    }
});

// PATCH /api/counseling/admin/:id - Admin memperbarui status & catatan tindak lanjut konseling
router.patch('/admin/:id', verifyStaff, async (req, res) => {
    try {
        const reqId = parseInt(req.params.id, 10);
        const { status, counselor_note = '' } = req.body;
        const dbStatus = getStatus();

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await pool.query(
                'UPDATE counseling_requests SET status = ?, counselor_note = ? WHERE id = ?',
                [status || 'Dijadwalkan', counselor_note, reqId]
            );
        } else {
            const db = readFallbackDB();
            const item = db.counseling_requests.find((r) => r.id === reqId);
            if (item) {
                item.status = status || item.status;
                item.counselor_note = counselor_note;
                writeFallbackDB(db);
            }
        }

        res.json({
            success: true,
            message: 'Status permintaan konseling berhasil diperbarui.'
        });
    } catch (error) {
        console.error('Update counseling request error:', error);
        res.status(500).json({ success: false, message: 'Gagal memperbarui status konseling.' });
    }
});

// DELETE /api/counseling/admin/clear/all - Admin menghapus seluruh daftar permintaan konseling
router.delete('/admin/clear/all', verifyStaff, async (req, res) => {
    try {
        const dbStatus = getStatus();
        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await pool.query('DELETE FROM counseling_requests');
        } else {
            const db = readFallbackDB();
            db.counseling_requests = [];
            writeFallbackDB(db);
        }

        res.json({
            success: true,
            message: 'Seluruh daftar permintaan jadwal konseling berhasil dihapus.'
        });
    } catch (error) {
        console.error('Clear all counseling requests error:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus seluruh permintaan konseling.' });
    }
});

// DELETE /api/counseling/admin/:id - Admin menghapus satu permintaan jadwal konseling
router.delete('/admin/:id', verifyStaff, async (req, res) => {
    try {
        const reqId = parseInt(req.params.id, 10);
        const dbStatus = getStatus();

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await pool.query('DELETE FROM counseling_requests WHERE id = ?', [reqId]);
        } else {
            const db = readFallbackDB();
            db.counseling_requests = db.counseling_requests.filter((r) => r.id !== reqId);
            writeFallbackDB(db);
        }

        res.json({
            success: true,
            message: 'Permintaan jadwal konseling berhasil dihapus.'
        });
    } catch (error) {
        console.error('Admin delete counseling request error:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus permintaan konseling.' });
    }
});

module.exports = router;
