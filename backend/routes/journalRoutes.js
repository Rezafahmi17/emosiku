const express = require('express');
const { getPool, getStatus, readFallbackDB, writeFallbackDB } = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/journals - Ambil daftar Jurnal Refleksi 4 kolom milik siswa
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const dbStatus = getStatus();
        let journals = [];

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT * FROM journals WHERE user_id = ? ORDER BY created_at DESC',
                [userId]
            );
            journals = rows;
        } else {
            const db = readFallbackDB();
            journals = db.journals
                .filter((j) => j.user_id === userId)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        res.json({ success: true, journals });
    } catch (error) {
        console.error('Get journals error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat jurnal refleksi.' });
    }
});

// POST /api/journals - Simpan Jurnal Refleksi (4 Kolom REBT + Evaluasi + Refleksi Syukur/Sabar Islami opsional)
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            situation,
            thought,
            feeling,
            action_taken,
            future_reflection,
            islamic_gratitude = ''
        } = req.body;

        if (!situation || !thought || !feeling || !action_taken || !future_reflection) {
            return res.status(400).json({
                success: false,
                message: 'Mohon lengkapi ke-4 kolom utama (Kejadian, Pikiran, Perasaan, Tindakan) dan rencana perbaikan.'
            });
        }

        const dbStatus = getStatus();
        let savedJournal = null;

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            const [result] = await pool.query(
                `INSERT INTO journals (user_id, situation, thought, feeling, action_taken, future_reflection, islamic_gratitude)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, situation, thought, feeling, action_taken, future_reflection, islamic_gratitude]
            );
            savedJournal = {
                id: result.insertId,
                user_id: userId,
                situation,
                thought,
                feeling,
                action_taken,
                future_reflection,
                islamic_gratitude,
                created_at: new Date().toISOString()
            };
        } else {
            const db = readFallbackDB();
            const newId = db.journals.length > 0 ? Math.max(...db.journals.map((j) => j.id)) + 1 : 1;
            savedJournal = {
                id: newId,
                user_id: userId,
                situation,
                thought,
                feeling,
                action_taken,
                future_reflection,
                islamic_gratitude,
                created_at: new Date().toISOString()
            };
            db.journals.push(savedJournal);
            writeFallbackDB(db);
        }

        res.status(201).json({
            success: true,
            message: 'Jurnal Refleksi berhasil disimpan secara aman.',
            data: savedJournal
        });
    } catch (error) {
        console.error('Create journal error:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan jurnal refleksi.' });
    }
});

// DELETE /api/journals/:id - Hapus satu jurnal refleksi secara permanen
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const journalId = parseInt(req.params.id, 10);
        const dbStatus = getStatus();

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await pool.query('DELETE FROM journals WHERE id = ? AND user_id = ?', [journalId, userId]);
        } else {
            const db = readFallbackDB();
            db.journals = db.journals.filter((j) => !(j.id === journalId && j.user_id === userId));
            writeFallbackDB(db);
        }

        res.json({
            success: true,
            message: 'Jurnal berhasil dihapus permanen.'
        });
    } catch (error) {
        console.error('Delete journal error:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus jurnal.' });
    }
});

module.exports = router;

