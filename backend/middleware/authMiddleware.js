const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'emosiku_secret_key_bkpi_2026';

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

function verifyAdmin(req, res, next) {
    verifyToken(req, res, () => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Hanya Guru BK / Admin yang dapat mengakses fitur ini.' });
        }
        next();
    });
}

module.exports = {
    JWT_SECRET,
    verifyToken,
    verifyAdmin
};

