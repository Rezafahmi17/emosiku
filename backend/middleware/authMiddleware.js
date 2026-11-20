const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'emosiku_secret_key_bkpi_2026';

function isStaffRole(role) {
    return role === 'admin' || role === 'konselor';
}

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Akses ditolak. Silakan masuk terlebih dahulu.' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Sesi telah berakhir atau tidak valid. Silakan masuk kembali.' });
    }
}

// Hanya Super Admin (verifikasi akun siswa & konselor)
function verifyAdmin(req, res, next) {
    verifyToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Hanya Super Admin yang dapat mengakses fitur ini.' });
        }
        next();
    });
}

// Super Admin & Konselor (ruang chat, jadwal konseling, analitik agregat)
function verifyStaff(req, res, next) {
    verifyToken(req, res, () => {
        if (!isStaffRole(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Hanya Konselor / Super Admin yang dapat mengakses fitur ini.' });
        }
        next();
    });
}

module.exports = {
    JWT_SECRET,
    isStaffRole,
    verifyToken,
    verifyAdmin,
    verifyStaff
};
