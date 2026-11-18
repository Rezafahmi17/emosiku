const express = require('express');
const { getPool, getStatus, ensureUserSchemaAndCleanDemo, readFallbackDB, writeFallbackDB } = require('../config/db');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/chat/admin/conversations - Daftar seluruh pengguna agar Admin dapat memilih ruang chat
router.get('/admin/conversations', verifyAdmin, async (req, res) => {
    try {
        const dbStatus = getStatus();
        let students = [];
        let messages = [];

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await ensureUserSchemaAndCleanDemo(pool);

            const [uRows] = await pool.query(
                "SELECT id, username, alias_name, jenjang, class_code, avatar_color, avatar_url, account_status, created_at FROM users WHERE role = 'siswa' AND (account_status IS NULL OR account_status = 'approved') ORDER BY created_at DESC"
            );
            const [mRows] = await pool.query('SELECT * FROM chat_messages ORDER BY created_at ASC');
            students = uRows;
            messages = mRows;
        } else {
            const db = readFallbackDB();
            students = db.users.filter((u) => u.role === 'siswa' && (!u.account_status || u.account_status === 'approved'));
            messages = db.chat_messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }

        const conversations = students.map((student) => {
            const studentMsgs = messages.filter((m) => m.student_id === student.id);
            const lastMsg = studentMsgs.length > 0 ? studentMsgs[studentMsgs.length - 1] : null;
            const unreadFromStudent = studentMsgs.filter((m) => m.sender_role === 'siswa' && !m.is_read).length;

            return {
                student_id: student.id,
                username: student.username,
                alias_name: student.alias_name,
                jenjang: student.jenjang || 'SMA',
                class_code: student.class_code,
                avatar_color: student.avatar_color || '#0f172a',
                avatar_url: student.avatar_url || null,
                last_message: lastMsg ? lastMsg.message : 'Belum ada percakapan',
                last_time: lastMsg ? lastMsg.created_at : student.created_at,
                last_sender_role: lastMsg ? lastMsg.sender_role : null,
                unread_count: unreadFromStudent,
                total_messages: studentMsgs.length
            };
        });

        conversations.sort((a, b) => {
            if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
            return new Date(b.last_time) - new Date(a.last_time);
        });

        res.json({
            success: true,
            conversations
        });
    } catch (error) {
        console.error('Get admin conversations error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat daftar percakapan.' });
    }
});

// GET /api/chat/messages/:studentId - Ambil riwayat pesan chat antara 1 pengguna dan Admin
router.get('/messages/:studentId', verifyToken, async (req, res) => {
    try {
        const requestedStudentId = parseInt(req.params.studentId, 10);
        const currentUser = req.user;

        if (currentUser.role !== 'admin' && currentUser.id !== requestedStudentId) {
            return res.status(403).json({
                success: false,
                message: 'Anda hanya dapat melihat ruang konsultasi Anda sendiri.'
            });
        }

        const dbStatus = getStatus();
        let messages = [];
        let studentInfo = null;

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            if (currentUser.role === 'admin') {
                await pool.query(
                    "UPDATE chat_messages SET is_read = 1 WHERE student_id = ? AND sender_role = 'siswa'",
                    [requestedStudentId]
                );
            } else {
                await pool.query(
                    "UPDATE chat_messages SET is_read = 1 WHERE student_id = ? AND sender_role = 'admin'",
                    [requestedStudentId]
                );
            }

            const [sRows] = await pool.query(
                'SELECT id, username, alias_name, jenjang, class_code, avatar_color, avatar_url FROM users WHERE id = ?',
                [requestedStudentId]
            );
            studentInfo = sRows[0] || null;

            const [mRows] = await pool.query(
                'SELECT * FROM chat_messages WHERE student_id = ? ORDER BY created_at ASC',
                [requestedStudentId]
            );
            messages = mRows;
        } else {
            const db = readFallbackDB();
            let updated = false;
            db.chat_messages.forEach((m) => {
                if (m.student_id === requestedStudentId) {
                    if (currentUser.role === 'admin' && m.sender_role === 'siswa' && !m.is_read) {
                        m.is_read = 1;
                        updated = true;
                    } else if (currentUser.role === 'siswa' && m.sender_role === 'admin' && !m.is_read) {
                        m.is_read = 1;
                        updated = true;
                    }
                }
            });
            if (updated) writeFallbackDB(db);

            const s = db.users.find((u) => u.id === requestedStudentId);
            if (s) {
                studentInfo = {
                    id: s.id,
                    username: s.username,
                    alias_name: s.alias_name,
                    jenjang: s.jenjang,
                    class_code: s.class_code,
                    avatar_color: s.avatar_color,
                    avatar_url: s.avatar_url || null
                };
            }
            messages = db.chat_messages
                .filter((m) => m.student_id === requestedStudentId)
                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }

        res.json({
            success: true,
            student: studentInfo,
            messages
        });
    } catch (error) {
        console.error('Get chat messages error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat pesan chat.' });
    }
});

// POST /api/chat/send - Kirim pesan konsultasi
router.post('/send', verifyToken, async (req, res) => {
    try {
        const currentUser = req.user;
        const { student_id, message } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Pesan tidak boleh kosong.'
            });
        }

        const targetStudentId = currentUser.role === 'admin'
            ? parseInt(student_id, 10)
            : currentUser.id;

        if (!targetStudentId) {
            return res.status(400).json({
                success: false,
                message: 'Pilih pengguna tujuan terlebih dahulu.'
            });
        }

        const dbStatus = getStatus();
        let newMessage = null;

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            const [result] = await pool.query(
                `INSERT INTO chat_messages (student_id, sender_id, sender_role, message, is_read)
                 VALUES (?, ?, ?, ?, 0)`,
                [targetStudentId, currentUser.id, currentUser.role, message.trim()]
            );
            newMessage = {
                id: result.insertId,
                student_id: targetStudentId,
                sender_id: currentUser.id,
                sender_role: currentUser.role,
                message: message.trim(),
                is_read: 0,
                created_at: new Date().toISOString()
            };
        } else {
            const db = readFallbackDB();
            const newId = db.chat_messages.length > 0 ? Math.max(...db.chat_messages.map((m) => m.id)) + 1 : 1;
            newMessage = {
                id: newId,
                student_id: targetStudentId,
                sender_id: currentUser.id,
                sender_role: currentUser.role,
                message: message.trim(),
                is_read: 0,
                created_at: new Date().toISOString()
            };
            db.chat_messages.push(newMessage);
            writeFallbackDB(db);
        }

        res.status(201).json({
            success: true,
            data: newMessage
        });
    } catch (error) {
        console.error('Send chat message error:', error);
        res.status(500).json({ success: false, message: 'Gagal mengirim pesan.' });
    }
});

module.exports = router;
