const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '').trim();
if (!ADMIN_PASSWORD) {
  console.error('ADMIN_PASSWORD belum diset. Jalankan server dengan password admin yang kuat.');
  process.exit(1);
}
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'payments.json');

fs.mkdirSync(PUBLIC_DIR, { recursive: true });
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]', 'utf8');

function readDB() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Gagal membaca database:', error);
    return [];
  }
}

function writeDB(rows) {
  fs.writeFileSync(DB_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

function id() {
  return crypto.randomUUID();
}

function token() {
  return crypto.randomBytes(32).toString('hex');
}

const sessions = new Map();

app.use(express.json({ limit: '200kb' }));

// Jangan pernah mengekspos data pembayaran, upload, konfigurasi, atau source server.
app.use((req, res, next) => {
  if (
    /^\/(?:data|uploads)(?:\/|$)/i.test(req.path) ||
    /^\/(?:server|package(?:-lock)?)\.json$/i.test(req.path)
  ) {
    return res.status(404).send('Not found');
  }
  next();
});

app.use(express.static(PUBLIC_DIR, { index: false }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${id()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|gif)$/i.test(file.mimetype)) {
      return cb(null, true);
    }
    cb(new Error('Bukti pembayaran harus berupa PNG, JPG, JPEG, WEBP, atau GIF.'));
  }
});

app.post('/api/payment', upload.single('proof'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Bukti pembayaran tidak ditemukan atau format tidak didukung.'
      });
    }

    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount !== 10000) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({
        success: false,
        message: 'Nominal pembayaran tidak sesuai.'
      });
    }

    const now = new Date().toISOString();
    const requestId = id();

    const row = {
      requestId,
      amount,
      originalName: req.file.originalname,
      filename: req.file.filename,
      status: 'pending',
      message: 'Menunggu konfirmasi pemilik.',
      createdAt: now,
      updatedAt: now
    };

    const rows = readDB();
    rows.unshift(row);
    writeDB(rows);

    return res.json({
      success: true,
      ok: true,
      requestId,
      status: 'pending'
    });
  } catch (error) {
    console.error('Payment error:', error);
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }
    return res.status(500).json({
      success: false,
      message: 'Gagal menyimpan bukti pembayaran.'
    });
  }
});

app.get('/api/payment/:requestId', (req, res) => {
  const requestId = String(req.params.requestId || '').trim();
  if (!requestId) {
    return res.status(400).json({
      success: false,
      message: 'requestId tidak valid.'
    });
  }

  const row = readDB().find(x => x.requestId === requestId);
  if (!row) {
    return res.status(404).json({
      success: false,
      message: 'Transaksi tidak ditemukan.'
    });
  }

  return res.json({
    success: true,
    requestId: row.requestId,
    status: row.status,
    message: row.message
  });
});

const RANK_SCORES = Object.freeze({
  juara1: 100,
  juara2: 90,
  juara3: 80,
  harapan: 65,
  peserta: 50
});

const LEVEL_SCORES = Object.freeze({
  internasional: 100,
  nasional: 90,
  provinsi: 75,
  kabupaten: 60,
  sekolah: 40
});

function clampScore(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null;
}

function roundScore(value) {
  const n = clampScore(value);
  return n === null ? null : Math.round(n * 100) / 100;
}

function requireApprovedPayment(requestId) {
  const idValue = String(requestId || '').trim();
  if (!idValue) {
    throw new Error('Pembayaran belum terverifikasi. requestId wajib dikirim.');
  }

  const row = readDB().find(x => x.requestId === idValue);
  if (!row) {
    throw new Error('Transaksi pembayaran tidak ditemukan.');
  }

  if (row.status !== 'approved') {
    throw new Error('Analisis hanya dapat dilakukan setelah pembayaran disetujui oleh pemilik.');
  }

  return row;
}

// Raport dihitung ulang di server; nilai raport dari browser tidak dipercaya.
function calculateReportScore(reportSubjects) {
  if (!Array.isArray(reportSubjects) || reportSubjects.length === 0) {
    throw new Error('Raport wajib memiliki minimal satu mata pelajaran.');
  }

  const values = [];
  for (const subject of reportSubjects) {
    if (!subject || typeof subject !== 'object' || Array.isArray(subject)) {
      throw new Error('Data raport tidak valid.');
    }

    const name = String(subject.name || '').trim();
    if (!name) {
      throw new Error('Nama mata pelajaran tidak boleh kosong.');
    }

    if (!Array.isArray(subject.values) || subject.values.length !== 5) {
      throw new Error(`Raport ${name} harus berisi nilai Semester 1–5.`);
    }

    const subjectValues = subject.values.map(Number);
    if (subjectValues.some(v => !Number.isFinite(v) || v < 0 || v > 100)) {
      throw new Error(`Raport ${name} harus memiliki nilai 0–100 untuk Semester 1–5.`);
    }

    values.push(...subjectValues);
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const score = clampScore(average);
  if (score === null) throw new Error('Nilai raport tidak valid.');
  return score;
}

function calculateAchievementScore(achievements) {
  if (!Array.isArray(achievements) || achievements.length === 0) return 0;

  const valid = achievements.filter(a =>
    a &&
    typeof a.name === 'string' &&
    a.name.trim() &&
    Object.prototype.hasOwnProperty.call(RANK_SCORES, a.rank) &&
    Object.prototype.hasOwnProperty.call(LEVEL_SCORES, a.level)
  );

  if (valid.length !== achievements.length) {
    throw new Error(
      'Data prestasi belum lengkap. Setiap prestasi wajib memiliki nama lomba, peringkat, dan tingkat.'
    );
  }

  // Satu prestasi dinilai dari rata-rata skor peringkat dan tingkat.
  // Jika ada beberapa prestasi, skor akhirnya adalah rata-rata seluruh prestasi.
  const scores = valid.map(a =>
    (RANK_SCORES[a.rank] + LEVEL_SCORES[a.level]) / 2
  );

  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return clampScore(average);
}

function calculateAlumniScore(alumniYears) {
  if (!Array.isArray(alumniYears) || alumniYears.length !== 3) {
    throw new Error('Data alumni wajib mencakup tahun 2024, 2025, dan 2026.');
  }

  const values = alumniYears.map(Number);

  if (values.some(v => !Number.isInteger(v) || v < 0)) {
    throw new Error('Data alumni tidak valid. Jumlah alumni harus bilangan bulat 0 atau lebih.');
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;

  const average = total / values.length;
  if (average < 1) return 35;
  if (average < 2) return 50;
  if (average < 3) return 65;
  if (average < 4) return 78;
  if (average < 6) return 90;
  return 100;
}

// Ranking 1 = 100, ranking 1000 = 0, tidak masuk Top 1000 = 0.
function rankingValueToScore(rank) {
  const n = Number(rank);
  if (!Number.isInteger(n) || n < 0 || n > 1000) {
    throw new Error('Ranking sekolah harus bilangan bulat 0–1000.');
  }
  if (n === 0) return 0;
  return ((1000 - n) / 999) * 100;
}

function calculateSchoolRankingScore(schoolRanking) {
  if (!schoolRanking || typeof schoolRanking !== 'object' || Array.isArray(schoolRanking)) {
    throw new Error('Data ranking sekolah tidak valid.');
  }

  const ranks = [schoolRanking[2025], schoolRanking[2026]].map(value => {
    if (value === '' || value === null || typeof value === 'undefined') return 0;
    return Number(value);
  });

  const scores = ranks.map(rankingValueToScore);
  return clampScore((scores[0] + scores[1]) / 2);
}

function calculateCompetitionScore(peminat, kuota) {
  if (!Number.isFinite(peminat) || !Number.isFinite(kuota) || kuota <= 0) {
    throw new Error('Peminat dan daya tampung harus berupa angka yang valid.');
  }
  if (peminat < 0) {
    throw new Error('Jumlah peminat tidak boleh negatif.');
  }

  const ratio = peminat / kuota;
  if (ratio <= 2) return 100;
  if (ratio <= 5) return 90;
  if (ratio <= 10) return 75;
  if (ratio <= 15) return 60;
  if (ratio <= 25) return 45;
  if (ratio <= 40) return 30;
  return 20;
}

function normalizeChoice(choice, index) {
  if (!choice || typeof choice !== 'object' || Array.isArray(choice)) {
    throw new Error(`Data pilihan ${index + 1} tidak valid.`);
  }

  const ptn = String(choice.ptn || '').trim();
  const prodi = String(choice.prodi || '').trim();
  const peminat = Number(choice.peminat);
  const kuota = Number(choice.kuota);

  if (
    !ptn ||
    !prodi ||
    !Number.isFinite(peminat) ||
    !Number.isFinite(kuota) ||
    peminat < 0 ||
    kuota <= 0
  ) {
    throw new Error(
      `Lengkapi PTN, prodi, peminat, dan daya tampung pilihan ${index + 1}.`
    );
  }

  if (!Array.isArray(choice.alumniYears) || choice.alumniYears.length !== 3) {
    throw new Error(`Data alumni pilihan ${index + 1} harus berisi tahun 2024, 2025, dan 2026.`);
  }

  const alumniYears = choice.alumniYears.map(Number);
  if (alumniYears.some(v => !Number.isInteger(v) || v < 0)) {
    throw new Error(`Data alumni pilihan ${index + 1} tidak valid.`);
  }

  return {
    ptn,
    prodi,
    peminat,
    kuota,
    alumniYears,
    // Informasional saja; tidak masuk bobot akhir.
    matchScore: clampScore(choice.matchScore ?? 0) ?? 0
  };
}

app.post('/api/analyze', (req, res) => {
  try {
    const body = req.body || {};

    // SECURITY GATE: harus diverifikasi server dan harus approved.
    requireApprovedPayment(body.requestId);

    const raportScore = calculateReportScore(body.reportSubjects);
    const achievements = Array.isArray(body.achievements) ? body.achievements : [];
    const prestasiScore = calculateAchievementScore(achievements);
    const schoolRankingScore = calculateSchoolRankingScore(body.schoolRanking);

    if (!Array.isArray(body.choices) || body.choices.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Minimal satu pilihan program studi wajib diisi.'
      });
    }

    if (body.choices.length > 2) {
      return res.status(400).json({
        success: false,
        message: 'Maksimal 2 pilihan program studi.'
      });
    }

    const choices = body.choices.map(normalizeChoice);
    const seenChoices = new Set();
    for (const choice of choices) {
      const key = `${choice.ptn.toLowerCase()}\u0000${choice.prodi.toLowerCase()}`;
      if (seenChoices.has(key)) {
        throw new Error('Pilihan 1 dan pilihan 2 tidak boleh merupakan program studi yang sama.');
      }
      seenChoices.add(key);
    }

    const results = choices.map(choice => {
      const alumniScore = calculateAlumniScore(choice.alumniYears);

      // Komponen 25% dibagi sama rata:
      // Alumni 12.5% + Ranking Sekolah 12.5%.
      const alumniRankingScore = (alumniScore + schoolRankingScore) / 2;

      // Persaingan hanya informasi tambahan; tidak masuk rumus final.
      const competition = calculateCompetitionScore(choice.peminat, choice.kuota);

      const raportContribution = raportScore * 0.50;
      const prestasiContribution = prestasiScore * 0.25;
      const alumniRankingContribution = alumniRankingScore * 0.25;
      const finalPercentage = clampScore(
        raportContribution + prestasiContribution + alumniRankingContribution
      );

      if (finalPercentage === null) {
        throw new Error('Hasil analisis tidak valid.');
      }

      return {
        ptn: choice.ptn,
        prodi: choice.prodi,
        raportScore,
        prestasiScore,
        alumniScore,
        schoolRankingScore,
        alumniRankingScore,
        raportWeight: 50,
        prestasiWeight: 25,
        alumniRankingWeight: 25,
        raportContribution,
        prestasiContribution,
        alumniRankingContribution,
        finalPercentage,
        // Dipertahankan untuk tampilan lama; tidak masuk bobot akhir.
        match: choice.matchScore,
        competition,
        ratio: choice.peminat / choice.kuota
      };
    });

    const first = results[0];

    return res.json({
      success: true,
      scores: {
        raport: roundScore(first.raportScore),
        prestasi: roundScore(first.prestasiScore),
        alumni: roundScore(first.alumniScore),
        schoolRanking: roundScore(first.schoolRankingScore),
        alumniRanking: roundScore(first.alumniRankingScore)
      },
      weights: {
        raport: 50,
        prestasi: 25,
        alumniRanking: 25
      },
      contributions: {
        raport: roundScore(first.raportContribution),
        prestasi: roundScore(first.prestasiContribution),
        alumniRanking: roundScore(first.alumniRankingContribution)
      },
      finalPercentage: roundScore(first.finalPercentage),
      results: results.map(r => ({
        ...r,
        raportScore: roundScore(r.raportScore),
        prestasiScore: roundScore(r.prestasiScore),
        alumniScore: roundScore(r.alumniScore),
        schoolRankingScore: roundScore(r.schoolRankingScore),
        alumniRankingScore: roundScore(r.alumniRankingScore),
        raportContribution: roundScore(r.raportContribution),
        prestasiContribution: roundScore(r.prestasiContribution),
        alumniRankingContribution: roundScore(r.alumniRankingContribution),
        finalPercentage: roundScore(r.finalPercentage),
        match: roundScore(r.match),
        competition: roundScore(r.competition),
        ratio: Number.isFinite(r.ratio)
          ? Math.round(r.ratio * 100) / 100
          : null
      }))
    });
  } catch (error) {
    console.error('Analyze error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Data analisis tidak valid.'
    });
  }
});

function requireAdmin(req, res, next) {
  const adminToken = req.headers['x-admin-token'];
  if (!adminToken || !sessions.has(adminToken)) {
    return res.status(401).json({
      success: false,
      message: 'Admin belum login.'
    });
  }
  next();
}

app.post('/api/admin/login', (req, res) => {
  if (!req.body || req.body.password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      message: 'Password admin salah.'
    });
  }

  const adminToken = token();
  sessions.set(adminToken, { createdAt: Date.now() });

  return res.json({
    success: true,
    ok: true,
    token: adminToken
  });
});

app.get('/api/admin/payments', requireAdmin, (req, res) => {
  return res.json(
    readDB().map(row => ({
      ...row,
      proofUrl: `/api/admin/proof/${encodeURIComponent(row.requestId)}`
    }))
  );
});

app.get('/api/admin/proof/:requestId', requireAdmin, (req, res) => {
  const row = readDB().find(x => x.requestId === req.params.requestId);
  if (!row) return res.sendStatus(404);

  const file = path.resolve(path.join(UPLOAD_DIR, row.filename));
  const uploadRoot = path.resolve(UPLOAD_DIR) + path.sep;

  if (!file.startsWith(uploadRoot) || !fs.existsSync(file)) {
    return res.sendStatus(404);
  }

  return res.sendFile(file);
});

function updateStatus(req, res, status, message) {
  const rows = readDB();
  const row = rows.find(x => x.requestId === req.params.requestId);

  if (!row) {
    return res.status(404).json({
      success: false,
      message: 'Transaksi tidak ditemukan.'
    });
  }

  row.status = status;
  row.message = message;
  row.updatedAt = new Date().toISOString();
  writeDB(rows);

  return res.json({
    success: true,
    ok: true,
    status
  });
}

app.post(
  '/api/admin/payments/:requestId/approve',
  requireAdmin,
  (req, res) => updateStatus(
    req,
    res,
    'approved',
    'Pembayaran disetujui oleh pemilik.'
  )
);

app.post(
  '/api/admin/payments/:requestId/reject',
  requireAdmin,
  (req, res) => updateStatus(
    req,
    res,
    'rejected',
    String(req.body?.message || 'Bukti pembayaran ditolak').slice(0, 500)
  )
);

app.get('/', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

app.use((error, _req, res, _next) => {
  console.error('Server error:', error);

  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'Ukuran bukti pembayaran maksimal 6 MB.'
    });
  }

  return res.status(400).json({
    success: false,
    message: error.message || 'Terjadi kesalahan pada server.'
  });
});

app.listen(PORT, HOST, () => {
  console.log(`SNBP payment server running on http://${HOST}:${PORT}`);
  console.log(`Buka: http://localhost:${PORT}`);
});
