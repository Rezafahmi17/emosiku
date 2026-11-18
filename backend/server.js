const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const cors = require("cors");

const fs = require("fs");
const { initDatabase, ensureInitialized, getStatus } = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const emotionRoutes = require("./routes/emotionRoutes");
const journalRoutes = require("./routes/journalRoutes");
const counselingRoutes = require("./routes/counselingRoutes");
const chatRoutes = require("./routes/chatRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Middleware inisialisasi database sebelum rute API dieksekusi di Serverless
app.use("/api", async (req, res, next) => {
  try {
    await ensureInitialized();
  } catch (e) {
    console.warn("DB middleware notice:", e.message);
  }
  next();
});

// API Routes
app.get("/api/status", (req, res) => {
  res.json({
    success: true,
    app: "EMOSIKU (Emosi Kita, Kelola Bersama)",
    version: "1.0.0",
    database: getStatus(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/emotions", emotionRoutes);
app.use("/api/journals", journalRoutes);
app.use("/api/counseling", counselingRoutes);
app.use("/api/chat", chatRoutes);

// Serve Static Files (public / frontend)
const publicPath = path.join(__dirname, "..", "public");
const frontendPath = path.join(__dirname, "..", "frontend");
const staticPath = fs.existsSync(publicPath) ? publicPath : frontendPath;

app.use(express.static(staticPath));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res
      .status(404)
      .json({ success: false, message: "Endpoint API tidak ditemukan." });
  }
  const indexPath = path.join(staticPath, "index.html");
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  res.status(200).send("EMOSIKU Application Server");
});

if (require.main === module || !process.env.VERCEL) {
  initDatabase().then(() => {
    app.listen(PORT, () => {
      console.log("==========================================================");
      console.log(`  EMOSIKU Server berjalan di: http://localhost:${PORT}`);
      console.log(`  Database Status           : ${getStatus().engine}`);
      console.log("==========================================================");
    });
  });
} else {
  // Di lingkungan Vercel Serverless Function
  initDatabase().catch((err) =>
    console.warn("Inisialisasi database serverless notice:", err.message),
  );
}

module.exports = app;
