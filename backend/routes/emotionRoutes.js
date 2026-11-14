const express = require('express');
const { getPool, getStatus, readFallbackDB, writeFallbackDB } = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

const NEGATIVE_EMOTIONS = ['sedih', 'marah', 'cemas', 'takut', 'kecewa', 'malu'];

function getRecommendedStrategy(emotion, intensity) {
    const emo = (emotion || '').toLowerCase();
    const lvl = Number(intensity) || 3;

    if (emo === 'marah') {
        return lvl >= 4
            ? 'Napas Kotak 4-4-4-4 lalu Ubah Sudut Pandang ( & Wudu/Zikir opsional)'
            : 'Napas Kotak 4-4-4-4';
    }
    if (emo === 'cemas' || emo === 'takut') {
        return 'Grounding 5-4-3-2-1 & Napas Kotak 4-4-4-4';
    }
    if (emo === 'sedih' || emo === 'kecewa' || emo === 'malu') {
        return 'Ubah Sudut Pandang (Cognitive Reappraisal) & Jurnal Refleksi';
    }
    return 'Refleksi Syukur & Pertahankan Kebiasaan Positif';
}

// GET /api/emotions - Ambil riwayat emosi pribadi siswa
router.get('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const dbStatus = getStatus();
        let logs = [];

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            const [rows] = await pool.query(
                'SELECT * FROM emotion_logs WHERE user_id = ? ORDER BY log_date DESC, created_at DESC',
                [userId]
            );
            logs = rows;
        } else {
            const db = readFallbackDB();
            logs = db.emotion_logs
                .filter((e) => e.user_id === userId)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }

        // Cek apakah perlu menampilkan ajakan sukarela menghubungi Guru BK
        // (Jika emosi terakhir negatif intensitas 4-5 ATAU 3 catatan berturut-turut emosi negatif)
        let suggestCounseling = false;
        let suggestReason = '';

        if (logs.length > 0) {
            const latest = logs[0];
            const isLatestNeg = NEGATIVE_EMOTIONS.includes((latest.emotion || '').toLowerCase());
            if (isLatestNeg && Number(latest.intensity) >= 4) {
                suggestCounseling = true;
                suggestReason = `Kamu mencatat emosi "${latest.emotion}" dengan intensitas tinggi (${latest.intensity}/5).`;
            } else if (logs.length >= 3) {
                const lastThreeNeg = logs
                    .slice(0, 3)
                    .every((item) => NEGATIVE_EMOTIONS.includes((item.emotion || '').toLowerCase()));
                if (lastThreeNeg) {
                    suggestCounseling = true;
                    suggestReason = 'Kamu mengalami emosi yang cukup berat selama 3 catatan berturut-turut.';
                }
            }
        }

        res.json({
            success: true,
            logs,
            suggestCounseling,
            suggestReason
        });
    } catch (error) {
        console.error('Get emotions error:', error);
        res.status(500).json({ success: false, message: 'Gagal memuat riwayat emosi.' });
    }
});

// POST /api/emotions - Simpan Cek Emosi Harian
router.post('/', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { emotion, intensity, trigger_factor = 'Sekolah', note = '' } = req.body;

        if (!emotion || !intensity) {
            return res.status(400).json({
                success: false,
                message: 'Pilih jenis emosi dan tingkat intensitas (1-5).'
            });
        }

        const cleanEmotion = emotion.toLowerCase().trim();
        const numIntensity = Math.min(5, Math.max(1, parseInt(intensity, 10) || 3));
        const recommended_strategy = getRecommendedStrategy(cleanEmotion, numIntensity);
        const todayStr = new Date().toISOString().split('T')[0];

        const dbStatus = getStatus();
        let createdLog = null;
        let allUserLogs = [];

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            const [result] = await pool.query(
                `INSERT INTO emotion_logs (user_id, emotion, intensity, trigger_factor, note, recommended_strategy, log_date)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, cleanEmotion, numIntensity, trigger_factor, note, recommended_strategy, todayStr]
            );
            createdLog = {
                id: result.insertId,
                user_id: userId,
                emotion: cleanEmotion,
                intensity: numIntensity,
                trigger_factor,
                note,
                recommended_strategy,
                log_date: todayStr,
                created_at: new Date().toISOString()
            };
            const [rows] = await pool.query(
                'SELECT * FROM emotion_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 5',
                [userId]
            );
            allUserLogs = rows;
        } else {
            const db = readFallbackDB();
            const newId = db.emotion_logs.length > 0 ? Math.max(...db.emotion_logs.map((e) => e.id)) + 1 : 1;
            createdLog = {
                id: newId,
                user_id: userId,
                emotion: cleanEmotion,
                intensity: numIntensity,
                trigger_factor,
                note,
                recommended_strategy,
                log_date: todayStr,
                created_at: new Date().toISOString()
            };
            db.emotion_logs.push(createdLog);
            writeFallbackDB(db);
            allUserLogs = db.emotion_logs
                .filter((e) => e.user_id === userId)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                .slice(0, 5);
        }

        const isNeg = NEGATIVE_EMOTIONS.includes(cleanEmotion);
        const threeConsecutiveNeg =
            allUserLogs.length >= 3 &&
            allUserLogs.slice(0, 3).every((item) => NEGATIVE_EMOTIONS.includes((item.emotion || '').toLowerCase()));

        const suggestCounseling = (isNeg && numIntensity >= 4) || threeConsecutiveNeg;

        res.status(201).json({
            success: true,
            message: 'Catatan emosi harian berhasil disimpan.',
            data: createdLog,
            suggestCounseling,
            recommendedStrategy: recommended_strategy
        });
    } catch (error) {
        console.error('Create emotion error:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan catatan emosi.' });
    }
});

// POST /api/emotions/calm-session - Catat penyelesaian latihan Ruang Tenang
router.post('/calm-session', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { strategy_name, duration_seconds = 120, feeling_after = 'Lebih tenang' } = req.body;

        const dbStatus = getStatus();
        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await pool.query(
                `INSERT INTO calm_sessions (user_id, strategy_name, duration_seconds, feeling_after)
                 VALUES (?, ?, ?, ?)`,
                [userId, strategy_name || 'Napas Kotak 4-4-4-4', duration_seconds, feeling_after]
            );
        } else {
            const db = readFallbackDB();
            const newId = db.calm_sessions.length > 0 ? Math.max(...db.calm_sessions.map((s) => s.id)) + 1 : 1;
            db.calm_sessions.push({
                id: newId,
                user_id: userId,
                strategy_name: strategy_name || 'Napas Kotak 4-4-4-4',
                duration_seconds,
                feeling_after,
                created_at: new Date().toISOString()
            });
            writeFallbackDB(db);
        }

        res.json({
            success: true,
            message: 'Hebat! Latihan regulasi emosi di Ruang Tenang telah tercatat.'
        });
    } catch (error) {
        console.error('Calm session error:', error);
        res.status(500).json({ success: false, message: 'Gagal menyimpan sesi Ruang Tenang.' });
    }
});

// DELETE /api/emotions/all-my-data - Tombol "Hapus Semua Data Saya" (Mitigasi Etika & UU PDP)
router.delete('/all-my-data', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const dbStatus = getStatus();

        if (dbStatus.isMySQLConnected) {
            const pool = getPool();
            await pool.query('DELETE FROM emotion_logs WHERE user_id = ?', [userId]);
            await pool.query('DELETE FROM journals WHERE user_id = ?', [userId]);
            await pool.query('DELETE FROM calm_sessions WHERE user_id = ?', [userId]);
        } else {
            const db = readFallbackDB();
            db.emotion_logs = db.emotion_logs.filter((e) => e.user_id !== userId);
            db.journals = db.journals.filter((j) => j.user_id !== userId);
            db.calm_sessions = db.calm_sessions.filter((c) => c.user_id !== userId);
            writeFallbackDB(db);
        }

        res.json({
            success: true,
            message: 'Seluruh riwayat emosi, sesi latihan, dan jurnal refleksi pribadimu telah dihapus secara permanen.'
        });
    } catch (error) {
        console.error('Delete all user data error:', error);
        res.status(500).json({ success: false, message: 'Gagal menghapus data pribadi.' });
    }
});

module.exports = router;

