const { initDatabase, getStatus } = require('./config/db');

(async () => {
    console.log('Menjalankan inisialisasi & seeding database EMOSIKU (Port 3307)...');
    await initDatabase();
    console.log('Status Database:', getStatus());
    process.exit(0);
})();

