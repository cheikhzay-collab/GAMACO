import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  getExtractionTasks,
  getExtractionTaskById,
  createExtractionTask,
  retryExtractionTask,
  deleteExtractionTask
} from './companionExtractionWorker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env if present
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of envLines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const k = match[1].trim();
        let val = (match[2] || '').trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
        if (val && !process.env[k]) {
          process.env[k] = val;
        }
      }
    }
  }
} catch (_) {}

const PORT = parseInt(process.env.PORT || '3000', 10);
const DATA_DIR = path.join(__dirname, 'data');
const DIST_DIR = path.join(__dirname, 'dist');

// ── Security: HMAC-SHA256 Signed Session Tokens & scrypt Password Hashing ──
const AUTH_SECRET = process.env.AUTH_SECRET || crypto
  .createHash('sha256')
  .update(`${process.env.DB_PASSWORD || 'gamaco-db'}:${process.env.ADMIN_PASSWORD || 'admin123'}:gamaco-session-v2`)
  .digest('hex');
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function signSessionToken(payload) {
  const data = {
    uid: payload.uid,
    role: payload.role || 'student',
    email: payload.email || '',
    exp: Date.now() + SESSION_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(encoded).digest('base64url');
  return `v2.${encoded}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('v2.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', AUTH_SECRET).update(encoded).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!parsed?.uid || !parsed?.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(plain || ''), salt, 32).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(plain, stored) {
  if (!stored) return { ok: false, needsUpgrade: false };
  const s = String(stored);
  if (s.startsWith('scrypt$')) {
    const [, salt, hash] = s.split('$');
    if (!salt || !hash) return { ok: false, needsUpgrade: false };
    try {
      const derived = crypto.scryptSync(String(plain || ''), salt, 32);
      const storedBuf = Buffer.from(hash, 'hex');
      if (derived.length !== storedBuf.length) return { ok: false, needsUpgrade: false };
      return { ok: crypto.timingSafeEqual(derived, storedBuf), needsUpgrade: false };
    } catch {
      return { ok: false, needsUpgrade: false };
    }
  }
  // Legacy plaintext compatibility: auto-upgrades to scrypt hash upon successful login
  return { ok: String(plain || '') === s, needsUpgrade: true };
}

function stripSensitiveUser(u) {
  if (!u || typeof u !== 'object') return u;
  const { password, ...safe } = u;
  return safe;
}

function parseCookies(req) {
  const out = {};
  const header = req.headers?.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

function getRequestSession(req) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    const verified = verifySessionToken(authHeader.slice(7).trim());
    if (verified) return verified;
  }
  const cookies = parseCookies(req);
  if (cookies.gamaco_session) {
    return verifySessionToken(cookies.gamaco_session);
  }
  return null;
}

function setSessionCookie(req, res, token) {
  const isHttps = req.headers['x-forwarded-proto'] === 'https' || req.socket?.encrypted;
  const maxAgeSec = Math.floor(SESSION_TTL_MS / 1000);
  const attrs = [
    `gamaco_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
    ...(isHttps ? ['Secure'] : []),
  ];
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'gamaco_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
}

function filterPublicConfig(cfg = {}) {
  const safe = {};
  const secretRe = /(apikey|api_key|deepseek|gemini|openai|anthropic|secret|password|token|private)/i;
  for (const [k, v] of Object.entries(cfg)) {
    if (secretRe.test(k)) continue;
    safe[k] = v;
  }
  return safe;
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── External Persistent Directory & JSON Cache (Survives Ephemeral Redeploys) ──
const getExternalPersistentDir = () => {
  if (process.env.PERSISTENT_DATA_DIR && fs.existsSync(process.env.PERSISTENT_DATA_DIR)) {
    return process.env.PERSISTENT_DATA_DIR;
  }
  const hostingerHome = '/home/u663560985';
  if (fs.existsSync(hostingerHome)) {
    const p = path.join(hostingerHome, 'gamaco_persistent_data');
    try {
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      return p;
    } catch (_) {}
  }
  return null;
};

const PERSISTENT_DIR = getExternalPersistentDir();
if (PERSISTENT_DIR) {
  console.log(`[Server] External persistent backup directory active at: ${PERSISTENT_DIR}`);
}

const memoryCache = new Map();
const pendingWrites = new Map();

const safeJsonParse = (val, fallback = val) => {
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch (_) {
    return fallback;
  }
};

const readDataFile = (fileName, defaultValue = []) => {
  if (memoryCache.has(fileName)) {
    return memoryCache.get(fileName);
  }

  const localPath = path.join(DATA_DIR, fileName);
  const persistentPath = PERSISTENT_DIR ? path.join(PERSISTENT_DIR, fileName) : null;

  // 1. If persistent external file exists, verify whether it has richer data than local
  if (persistentPath && fs.existsSync(persistentPath)) {
    try {
      const pContent = fs.readFileSync(persistentPath, 'utf8');
      const pParsed = JSON.parse(pContent);
      
      // If local doesn't exist or is empty, copy from persistent
      if (!fs.existsSync(localPath)) {
        try { fs.writeFileSync(localPath, pContent, 'utf8'); } catch (_) {}
        memoryCache.set(fileName, pParsed);
        return pParsed;
      }

      const lContent = fs.readFileSync(localPath, 'utf8');
      const lParsed = JSON.parse(lContent);

      if (Array.isArray(pParsed) && Array.isArray(lParsed) && pParsed.length > lParsed.length) {
        // Persistent has more items (e.g. after a redeploy checked out an older branch)
        memoryCache.set(fileName, pParsed);
        try { fs.writeFileSync(localPath, pContent, 'utf8'); } catch (_) {}
        return pParsed;
      }
    } catch (e) {
      console.warn(`[Server] Persistent read error for ${fileName}:`, e.message);
    }
  }

  // 2. Read local file
  if (!fs.existsSync(localPath)) {
    try {
      fs.writeFileSync(localPath, JSON.stringify(defaultValue, null, 2), 'utf8');
      if (persistentPath) {
        fs.writeFileSync(persistentPath, JSON.stringify(defaultValue, null, 2), 'utf8');
      }
    } catch (_) {}
    memoryCache.set(fileName, defaultValue);
    return defaultValue;
  }

  try {
    const content = fs.readFileSync(localPath, 'utf8');
    const parsed = JSON.parse(content);
    memoryCache.set(fileName, parsed);
    // Sync to persistent folder if not yet copied
    if (persistentPath && !fs.existsSync(persistentPath)) {
      try { fs.writeFileSync(persistentPath, content, 'utf8'); } catch (_) {}
    }
    return parsed;
  } catch (err) {
    console.error(`[Server] Error reading ${fileName}:`, err.message);
    memoryCache.set(fileName, defaultValue);
    return defaultValue;
  }
};

const writeDataFile = (fileName, data) => {
  memoryCache.set(fileName, data);
  const localPath = path.join(DATA_DIR, fileName);
  const persistentPath = PERSISTENT_DIR ? path.join(PERSISTENT_DIR, fileName) : null;

  if (pendingWrites.has(fileName)) {
    clearTimeout(pendingWrites.get(fileName));
  }

  const timer = setTimeout(() => {
    pendingWrites.delete(fileName);
    const jsonStr = JSON.stringify(data, null, 2);
    try {
      fs.writeFile(localPath, jsonStr, 'utf8', (err) => {
        if (err) console.error(`[Server] Error writing local ${fileName}:`, err.message);
      });
    } catch (err) {
      console.error(`[Server] Error writing local ${fileName}:`, err.message);
    }

    if (persistentPath) {
      try {
        fs.writeFile(persistentPath, jsonStr, 'utf8', (err) => {
          if (err) console.error(`[Server] Error writing persistent ${fileName}:`, err.message);
        });
      } catch (err) {
        console.error(`[Server] Error writing persistent ${fileName}:`, err.message);
      }
    }
  }, 100);

  pendingWrites.set(fileName, timer);
};

const flushPendingWritesSync = () => {
  if (pendingWrites.size === 0) return;
  for (const [fileName, timer] of pendingWrites.entries()) {
    clearTimeout(timer);
    const data = memoryCache.get(fileName);
    if (data !== undefined) {
      const jsonStr = JSON.stringify(data, null, 2);
      try {
        fs.writeFileSync(path.join(DATA_DIR, fileName), jsonStr, 'utf8');
      } catch (_) {}
      if (PERSISTENT_DIR) {
        try {
          fs.writeFileSync(path.join(PERSISTENT_DIR, fileName), jsonStr, 'utf8');
        } catch (_) {}
      }
    }
  }
  pendingWrites.clear();
};

process.on('SIGINT', () => { flushPendingWritesSync(); process.exit(0); });
process.on('SIGTERM', () => { flushPendingWritesSync(); process.exit(0); });
process.on('beforeExit', () => { flushPendingWritesSync(); });

// ── MySQL Connection & Management ───────────────────────────────────────────
let dbPool = null;
let isMySqlActive = false;

const initMySQL = async () => {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  if (!user || !database) {
    console.log('[Server] No MySQL user/database specified in env. Using resilient JSON file storage mode.');
    isMySqlActive = false;
    return;
  }

  // Candidate hosts to attempt connection on Hostinger
  const candidateHosts = [host];
  if (host === '127.0.0.1' && !candidateHosts.includes('localhost')) candidateHosts.push('localhost');
  if (host === 'localhost' && !candidateHosts.includes('127.0.0.1')) candidateHosts.push('127.0.0.1');
  if (!candidateHosts.includes('srv977.hstgr.io')) candidateHosts.push('srv977.hstgr.io');

  try {
    const mysqlModule = await import('mysql2/promise').catch(() => null);
    const mysql = mysqlModule ? (mysqlModule.default || mysqlModule) : null;
    if (!mysql) {
      console.log('[Server] mysql2 module not available. Running in JSON file storage mode.');
      isMySqlActive = false;
      return;
    }

    let connection = null;
    let connectedHost = null;

    for (const h of candidateHosts) {
      try {
        const pool = mysql.createPool({
          host: h,
          port,
          user,
          password,
          database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 4000,
          charset: 'utf8mb4'
        });

        connection = await pool.getConnection();
        connectedHost = h;
        dbPool = pool;
        console.log(`[Server] Connected to MySQL database "${database}" on ${h}:${port}`);
        break;
      } catch (connErr) {
        console.warn(`[Server] MySQL connection attempt to ${h}:${port} failed (${connErr.code || connErr.message})`);
      }
    }

    if (!connection) {
      console.log('[Server] Could not connect to MySQL on candidate hosts. Running in resilient persistent JSON mode.');
      isMySqlActive = false;
      return;
    }

    // Create tables if they do not exist with optimal UTF8MB4 schema
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_exams (
        id VARCHAR(64) PRIMARY KEY,
        title TEXT,
        level VARCHAR(100),
        data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_lessons (
        id VARCHAR(64) PRIMARY KEY,
        title TEXT,
        subject VARCHAR(255),
        level VARCHAR(100),
        data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_classes (
        id VARCHAR(64) PRIMARY KEY,
        name TEXT,
        data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'student',
        tier VARCHAR(50) DEFAULT 'freemium',
        data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_config (
        key_name VARCHAR(128) PRIMARY KEY,
        value LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await connection.query("DELETE FROM tbl_config WHERE key_name = 'key'").catch(() => null);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_assets (
        asset_path VARCHAR(255) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        mime_type VARCHAR(100) DEFAULT 'image/png',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_grades (
        id VARCHAR(64) PRIMARY KEY,
        lesson_id VARCHAR(64),
        exam_id VARCHAR(64),
        class_id VARCHAR(64),
        title TEXT,
        doc_type VARCHAR(50) DEFAULT 'homework',
        total_points DECIMAL(6,2) DEFAULT 20.00,
        data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_grades_lesson (lesson_id),
        INDEX idx_grades_class (class_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_devoir_prime (
        id VARCHAR(64) PRIMARY KEY,
        lesson_id VARCHAR(64) NOT NULL,
        title TEXT,
        level VARCHAR(100),
        semester VARCHAR(100),
        academic_year VARCHAR(50),
        teacher VARCHAR(255),
        total_points DECIMAL(6,2) DEFAULT 20.00,
        meta_json LONGTEXT,
        exercises_json LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dp_lesson (lesson_id),
        INDEX idx_dp_level (level)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_solutions (
        id VARCHAR(128) PRIMARY KEY,
        lesson_id VARCHAR(64) NOT NULL,
        section_id VARCHAR(128) NOT NULL,
        question_id VARCHAR(128) DEFAULT '',
        doc_type VARCHAR(64) DEFAULT 'homework',
        solution_text LONGTEXT,
        solution_json LONGTEXT,
        updated_by VARCHAR(100) DEFAULT 'admin',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_sol_lesson (lesson_id),
        INDEX idx_sol_section (lesson_id, section_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Run safe column migrations to upgrade existing tables without dropping data
    const safeAlters = [
      "ALTER TABLE tbl_lessons MODIFY COLUMN title TEXT",
      "ALTER TABLE tbl_lessons MODIFY COLUMN subject VARCHAR(255)",
      "ALTER TABLE tbl_lessons MODIFY COLUMN level VARCHAR(100)",
      "ALTER TABLE tbl_lessons ADD COLUMN doc_type VARCHAR(64) DEFAULT 'course'",
      "ALTER TABLE tbl_lessons ADD INDEX idx_lessons_doctype (doc_type)",
      "ALTER TABLE tbl_lessons MODIFY COLUMN data LONGTEXT NOT NULL",
      "ALTER TABLE tbl_classes MODIFY COLUMN name TEXT",
      "ALTER TABLE tbl_classes MODIFY COLUMN data LONGTEXT NOT NULL",
      "ALTER TABLE tbl_exams MODIFY COLUMN title TEXT",
      "ALTER TABLE tbl_exams MODIFY COLUMN level VARCHAR(100)",
      "ALTER TABLE tbl_exams MODIFY COLUMN data LONGTEXT NOT NULL",
      "ALTER TABLE tbl_users MODIFY COLUMN data LONGTEXT NOT NULL",
      "ALTER TABLE tbl_config MODIFY COLUMN key_name VARCHAR(128)",
      "ALTER TABLE tbl_config MODIFY COLUMN value LONGTEXT NOT NULL",
      "ALTER TABLE tbl_assets MODIFY COLUMN data LONGTEXT NOT NULL",
      "ALTER TABLE tbl_grades MODIFY COLUMN doc_type VARCHAR(64) DEFAULT 'homework'",
      "ALTER TABLE tbl_grades MODIFY COLUMN data LONGTEXT NOT NULL",
      "ALTER TABLE tbl_devoir_prime MODIFY COLUMN meta_json LONGTEXT",
      "ALTER TABLE tbl_devoir_prime MODIFY COLUMN exercises_json LONGTEXT NOT NULL",
      "ALTER TABLE tbl_solutions MODIFY COLUMN solution_text LONGTEXT",
      "ALTER TABLE tbl_solutions MODIFY COLUMN solution_json LONGTEXT"
    ];
    for (const alt of safeAlters) {
      await connection.query(alt).catch(() => {});
    }

    // 1. Synchronize Configuration (tbl_config <-> config.json)
    const fileConfig = readDataFile('config.json', {});
    for (const [k, v] of Object.entries(fileConfig)) {
      if (k && v !== undefined && k !== 'key') {
        await connection.query(
          'INSERT IGNORE INTO tbl_config (key_name, value) VALUES (?, ?)',
          [k, JSON.stringify(v)]
        ).catch(() => {});
      }
    }
    const [dbConfigRows] = await connection.query('SELECT key_name, value FROM tbl_config');
    const dbConfig = {};
    for (const r of dbConfigRows) {
      dbConfig[r.key_name] = safeJsonParse(r.value, r.value);
    }
    const mergedConfig = { ...fileConfig, ...dbConfig };
    writeDataFile('config.json', mergedConfig);
    console.log(`[Server] Synced ${Object.keys(mergedConfig).length} configuration settings with MySQL.`);

    // 2. Synchronize Lessons: smart reconciliation preserving the most recent edits
    const fileLessons = readDataFile('lessons.json', []);
    const [dbLessonRows] = await connection.query('SELECT id, updated_at, data FROM tbl_lessons');
    const dbLessonMap = new Map();
    for (const row of dbLessonRows) {
      const parsed = safeJsonParse(row.data, null);
      if (parsed && row.id) {
        dbLessonMap.set(row.id, {
          updatedAt: new Date(row.updated_at || parsed.updatedAt || parsed.updated_at || 0).getTime(),
          data: parsed
        });
      }
    }

    const consolidatedLessons = new Map();
    for (const [id, entry] of dbLessonMap.entries()) {
      consolidatedLessons.set(id, entry.data);
    }

    for (const l of fileLessons) {
      if (!l || !l.id) continue;
      const fileTime = new Date(l.updatedAt || l.updated_at || l.createdAt || 0).getTime();
      const existingInDb = dbLessonMap.get(l.id);

      if (!existingInDb) {
        await connection.query(
          'INSERT INTO tbl_lessons (id, title, subject, level, data) VALUES (?, ?, ?, ?, ?)',
          [l.id, l.title || '', l.subject || '', l.level || '', JSON.stringify(l)]
        ).catch(() => {});
        consolidatedLessons.set(l.id, l);
      } else if (fileTime > existingInDb.updatedAt + 1000) {
        await connection.query(
          'UPDATE tbl_lessons SET title = ?, subject = ?, level = ?, data = ?, updated_at = NOW() WHERE id = ?',
          [l.title || '', l.subject || '', l.level || '', JSON.stringify(l), l.id]
        ).catch(() => {});
        consolidatedLessons.set(l.id, l);
      }
    }

    const allLessonsList = Array.from(consolidatedLessons.values()).sort((a, b) => {
      const tA = new Date(a.updatedAt || a.updated_at || a.createdAt || 0).getTime();
      const tB = new Date(b.updatedAt || b.updated_at || b.createdAt || 0).getTime();
      return tB - tA;
    });
    writeDataFile('lessons.json', allLessonsList);
    console.log(`[Server] Synced ${allLessonsList.length} lessons from MySQL database.`);

    // 3. Synchronize Exams: smart reconciliation preserving the most recent edits
    const fileExams = readDataFile('exams.json', []);
    const [dbExamRows] = await connection.query('SELECT id, updated_at, data FROM tbl_exams');
    const dbExamMap = new Map();
    for (const row of dbExamRows) {
      const parsed = safeJsonParse(row.data, null);
      if (parsed && row.id) {
        dbExamMap.set(row.id, {
          updatedAt: new Date(row.updated_at || parsed.updatedAt || parsed.updated_at || 0).getTime(),
          data: parsed
        });
      }
    }

    const consolidatedExams = new Map();
    for (const [id, entry] of dbExamMap.entries()) {
      consolidatedExams.set(id, entry.data);
    }

    for (const ex of fileExams) {
      if (!ex || !ex.id) continue;
      const fileTime = new Date(ex.updatedAt || ex.updated_at || ex.dateAdded || 0).getTime();
      const existingInDb = dbExamMap.get(ex.id);
      const title = ex.name || ex.title || '';
      const level = ex.level || '';

      if (!existingInDb) {
        await connection.query(
          'INSERT INTO tbl_exams (id, title, level, data) VALUES (?, ?, ?, ?)',
          [ex.id, title, level, JSON.stringify(ex)]
        ).catch(() => {});
        consolidatedExams.set(ex.id, ex);
      } else if (fileTime > existingInDb.updatedAt + 1000) {
        await connection.query(
          'UPDATE tbl_exams SET title = ?, level = ?, data = ?, updated_at = NOW() WHERE id = ?',
          [title, level, JSON.stringify(ex), ex.id]
        ).catch(() => {});
        consolidatedExams.set(ex.id, ex);
      }
    }

    const allExamsList = Array.from(consolidatedExams.values()).sort((a, b) => {
      const tA = new Date(a.updatedAt || a.updated_at || a.dateAdded || 0).getTime();
      const tB = new Date(b.updatedAt || b.updated_at || b.dateAdded || 0).getTime();
      return tB - tA;
    });
    writeDataFile('exams.json', allExamsList);
    console.log(`[Server] Synced ${allExamsList.length} exams from MySQL database.`);

    // 4. Synchronize Classes: smart reconciliation
    const fileClasses = readDataFile('classes.json', []);
    const [dbClassRows] = await connection.query('SELECT id, updated_at, data FROM tbl_classes');
    const dbClassMap = new Map();
    for (const row of dbClassRows) {
      const parsed = safeJsonParse(row.data, null);
      if (parsed && row.id) {
        dbClassMap.set(row.id, {
          updatedAt: new Date(row.updated_at || parsed.updatedAt || parsed.updated_at || 0).getTime(),
          data: parsed
        });
      }
    }

    const consolidatedClasses = new Map();
    for (const [id, entry] of dbClassMap.entries()) {
      consolidatedClasses.set(id, entry.data);
    }

    for (const c of fileClasses) {
      if (!c || !c.id) continue;
      const fileTime = new Date(c.updatedAt || c.updated_at || c.createdAt || 0).getTime();
      const existingInDb = dbClassMap.get(c.id);

      if (!existingInDb) {
        await connection.query(
          'INSERT INTO tbl_classes (id, name, data) VALUES (?, ?, ?)',
          [c.id, c.name || '', JSON.stringify(c)]
        ).catch(() => {});
        consolidatedClasses.set(c.id, c);
      } else if (fileTime > existingInDb.updatedAt + 1000) {
        await connection.query(
          'UPDATE tbl_classes SET name = ?, data = ?, updated_at = NOW() WHERE id = ?',
          [c.name || '', JSON.stringify(c), c.id]
        ).catch(() => {});
        consolidatedClasses.set(c.id, c);
      }
    }

    const allClassesList = Array.from(consolidatedClasses.values());
    writeDataFile('classes.json', allClassesList);
    console.log(`[Server] Synced ${allClassesList.length} classes from MySQL database.`);

    // 5. Synchronize Users: smart reconciliation
    const fileUsers = readDataFile('users.json', []);
    const [dbUserRows] = await connection.query('SELECT id, updated_at, data FROM tbl_users');
    const dbUserMap = new Map();
    for (const row of dbUserRows) {
      const parsed = safeJsonParse(row.data, null);
      if (parsed && row.id) {
        dbUserMap.set(row.id, {
          updatedAt: new Date(row.updated_at || parsed.updatedAt || 0).getTime(),
          data: parsed
        });
      }
    }

    const consolidatedUsers = new Map();
    for (const [id, entry] of dbUserMap.entries()) {
      consolidatedUsers.set(id, entry.data);
    }

    for (const u of fileUsers) {
      const uid = u.id || u.uid;
      if (!uid) continue;
      const fileTime = new Date(u.updatedAt || u.updated_at || u.joined || 0).getTime();
      const existingInDb = dbUserMap.get(uid);

      if (!existingInDb) {
        await connection.query(
          'INSERT INTO tbl_users (id, email, password, role, tier, data) VALUES (?, ?, ?, ?, ?, ?)',
          [uid, u.email || `${uid}@local.user`, u.password || 'student123', u.role || 'student', u.tier || 'freemium', JSON.stringify(u)]
        ).catch(() => {});
        consolidatedUsers.set(uid, u);
      } else if (fileTime > existingInDb.updatedAt + 1000) {
        await connection.query(
          'UPDATE tbl_users SET email = ?, password = COALESCE(?, password), role = ?, tier = ?, data = ?, updated_at = NOW() WHERE id = ?',
          [u.email || `${uid}@local.user`, u.password || null, u.role || 'student', u.tier || 'freemium', JSON.stringify(u), uid]
        ).catch(() => {});
        consolidatedUsers.set(uid, u);
      }
    }

    const allUsersList = Array.from(consolidatedUsers.values());
    writeDataFile('users.json', allUsersList);
    console.log(`[Server] Synced ${allUsersList.length} users from MySQL database.`);

    // 6. Synchronize Grades / Points Tables: smart reconciliation
    const fileGrades = readDataFile('grades.json', []);
    const [dbGradeRows] = await connection.query('SELECT id, updated_at, data FROM tbl_grades').catch(() => [[]]);
    const dbGradeMap = new Map();
    for (const row of dbGradeRows) {
      const parsed = safeJsonParse(row.data, null);
      if (parsed && row.id) {
        dbGradeMap.set(row.id, {
          updatedAt: new Date(row.updated_at || parsed.updatedAt || parsed.updated_at || 0).getTime(),
          data: parsed
        });
      }
    }

    const consolidatedGrades = new Map();
    for (const [id, entry] of dbGradeMap.entries()) {
      consolidatedGrades.set(id, entry.data);
    }

    for (const g of fileGrades) {
      if (!g || !g.id) continue;
      const fileTime = new Date(g.updatedAt || g.updated_at || g.createdAt || 0).getTime();
      const existingInDb = dbGradeMap.get(g.id);

      if (!existingInDb) {
        await connection.query(
          'INSERT INTO tbl_grades (id, lesson_id, exam_id, class_id, title, doc_type, total_points, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [g.id, g.lessonId || g.lesson_id || null, g.examId || g.exam_id || null, g.classId || g.class_id || null, g.title || '', g.docType || g.doc_type || 'homework', parseFloat(g.totalPoints || g.total_points) || 20, JSON.stringify(g)]
        ).catch(() => {});
        consolidatedGrades.set(g.id, g);
      } else if (fileTime > existingInDb.updatedAt + 1000) {
        await connection.query(
          'UPDATE tbl_grades SET lesson_id = ?, exam_id = ?, class_id = ?, title = ?, doc_type = ?, total_points = ?, data = ?, updated_at = NOW() WHERE id = ?',
          [g.lessonId || g.lesson_id || null, g.examId || g.exam_id || null, g.classId || g.class_id || null, g.title || '', g.docType || g.doc_type || 'homework', parseFloat(g.totalPoints || g.total_points) || 20, JSON.stringify(g), g.id]
        ).catch(() => {});
        consolidatedGrades.set(g.id, g);
      }
    }

    const allGradesList = Array.from(consolidatedGrades.values()).sort((a, b) => {
      const tA = new Date(a.updatedAt || a.updated_at || a.createdAt || 0).getTime();
      const tB = new Date(b.updatedAt || b.updated_at || b.createdAt || 0).getTime();
      return tB - tA;
    });
    writeDataFile('grades.json', allGradesList);
    console.log(`[Server] Synced ${allGradesList.length} grade sheets from MySQL database.`);

    // 7. Backfill doc_type on tbl_lessons and sync DEVOIR PRIME records into tbl_devoir_prime
    try {
      const [allLessonRows] = await connection.query('SELECT id, doc_type, data FROM tbl_lessons').catch(() => [[]]);
      let dpSyncedCount = 0;
      for (const lr of allLessonRows) {
        const parsed = safeJsonParse(lr.data, null);
        if (!parsed) continue;
        const resolvedDocType = parsed.docType || parsed.doc_type || parsed.content?.doc_type || 'course';
        if (!lr.doc_type || lr.doc_type !== resolvedDocType) {
          await connection.query('UPDATE tbl_lessons SET doc_type = ? WHERE id = ?', [resolvedDocType, lr.id]).catch(() => {});
        }
        if (resolvedDocType === 'devoir_prime' || parsed.content?.devoir_prime_exercises) {
          const dpMeta = parsed.content?.devoir_prime_meta || {};
          const dpExercises = parsed.content?.devoir_prime_exercises || [];
          const totalPts = parseFloat(parsed.content?.total_points || parsed.total_points) || 20;
          await connection.query(
            `INSERT INTO tbl_devoir_prime (id, lesson_id, title, level, semester, academic_year, teacher, total_points, meta_json, exercises_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), level = VALUES(level), semester = VALUES(semester), academic_year = VALUES(academic_year), teacher = VALUES(teacher), total_points = VALUES(total_points), meta_json = VALUES(meta_json), exercises_json = VALUES(exercises_json), updated_at = NOW()`,
            [
              `dp-${lr.id}`,
              lr.id,
              dpMeta.title || parsed.title || '',
              dpMeta.level || parsed.level || '',
              dpMeta.semester || '',
              dpMeta.academicYear || '',
              dpMeta.teacher || parsed.teacher || '',
              totalPts,
              JSON.stringify(dpMeta),
              JSON.stringify(dpExercises)
            ]
          ).catch(() => {});
          dpSyncedCount++;
        }

        // Backfill existing section solutions into tbl_solutions
        const secs = Array.isArray(parsed.content?.sections) ? parsed.content.sections : (Array.isArray(parsed.sections) ? parsed.sections : []);
        for (const sec of secs) {
          if (sec && sec.id && sec.solution && String(sec.solution).trim()) {
            const solId = `sol-${lr.id}-${sec.id}`.slice(0, 128);
            await connection.query(
              `INSERT IGNORE INTO tbl_solutions (id, lesson_id, section_id, question_id, doc_type, solution_text, solution_json)
               VALUES (?, ?, ?, '', ?, ?, NULL)`,
              [solId, lr.id, String(sec.id).slice(0, 128), resolvedDocType, String(sec.solution)]
            ).catch(() => {});
          }
        }
      }
      console.log(`[Server] Verified tbl_lessons.doc_type, tbl_solutions, and synced ${dpSyncedCount} DEVOIR PRIME sheets.`);
    } catch (_) {}

    connection.release();
    isMySqlActive = true;
    console.log('[Server] MySQL storage active and bidirectional sync verified.');
  } catch (err) {
    console.warn(`[Server] MySQL initialization failed: ${err.message}. Operating in resilient JSON storage mode.`);
    isMySqlActive = false;
  }
};

// ── HTTP Helpers ────────────────────────────────────────────────────────────
const sendJSON = (res, statusCode, data) => {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  });
  res.end(JSON.stringify(data));
};

const getBody = (req) => {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
};

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf'
};

const serveStatic = (res, filePath) => {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routing
      const indexPath = path.join(DIST_DIR, 'index.html');
      fs.readFile(indexPath, (readErr, content) => {
        if (res.headersSent || res.writableEnded) return;
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('404 Not Found');
        } else {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(content);
        }
      });
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isImmutable = filePath.includes('assets') || ext === '.woff2' || ext === '.woff' || ext === '.ttf';
    const cacheControl = isImmutable ? 'public, max-age=31536000, immutable' : 'public, max-age=3600';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': cacheControl
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
};

// ── API Request Handler (used by both Vite dev middleware & production server) ──
export const handleApiRequest = async (req, res, next) => {
  // CORS Headers (Restricted to trusted origins + same-origin credentials)
  const reqOrigin = req.headers?.origin || '';
  const allowedOrigins = new Set([
    'https://firebrick-rail-798462.hostingersite.com',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    ...(process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',').map(s => s.trim()) : []),
  ]);
  if (reqOrigin && (allowedOrigins.has(reqOrigin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(reqOrigin))) {
    res.setHeader('Access-Control-Allow-Origin', reqOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return true;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  if (pathname !== '/ping' && !pathname.startsWith('/api/')) {
    if (next) next();
    return false;
  }

  // 1. Health check
  if (pathname === '/ping') {
    sendJSON(res, 200, {
      status: 'online',
      message: 'Gamaco Server & Database is active',
      storage: isMySqlActive ? 'mysql' : 'json'
    });
    return;
  }

  // 2. Authentication Endpoints
  if (pathname === '/api/auth/logout' && req.method === 'POST') {
    clearSessionCookie(res);
    return sendJSON(res, 200, { success: true });
  }

  if (pathname === '/api/auth/me' && req.method === 'GET') {
    const sess = getRequestSession(req);
    if (!sess) return sendJSON(res, 401, { error: 'Non authentifié' });
    return sendJSON(res, 200, { session: sess });
  }

  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, password } = await getBody(req);
      const cleanEmail = (email || '').toLowerCase().trim();
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@lconq.ma').toLowerCase().trim();
      const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

      if (cleanEmail === adminEmail && password && password === adminPass) {
        const adminUser = {
          uid: 'admin-001',
          id: 'admin-001',
          name: 'Directeur Général',
          email: cleanEmail,
          role: 'admin',
          tier: 'premium',
          xp: 9999,
          streak: 100,
          rank: 1,
          totalStudents: 1200
        };
        const token = signSessionToken({ uid: 'admin-001', role: 'admin', email: cleanEmail });
        setSessionCookie(req, res, token);
        return sendJSON(res, 200, { user: adminUser, token });
      }

      // Check in MySQL or JSON
      let user = null;
      if (isMySqlActive) {
        const [rows] = await dbPool.query('SELECT * FROM tbl_users WHERE email = ?', [cleanEmail]);
        if (rows.length > 0) {
          const row = rows[0];
          const check = verifyPassword(password, row.password);
          if (check.ok) {
            user = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
            // Transparently upgrade legacy plaintext password to scrypt hash
            if (check.needsUpgrade && password) {
              const upgraded = hashPassword(password);
              const safeUserData = stripSensitiveUser(user);
              dbPool.query('UPDATE tbl_users SET password = ?, data = ? WHERE id = ?', [upgraded, JSON.stringify(safeUserData), row.id]).catch(() => {});
            }
          }
        }
      } else {
        const users = readDataFile('users.json', []);
        const found = users.find(u => (u.email || '').toLowerCase().trim() === cleanEmail);
        if (found) {
          const check = verifyPassword(password, found.password);
          if (check.ok) user = found;
        }
      }

      if (!user) {
        return sendJSON(res, 401, { error: 'Identifiants incorrects' });
      }

      const uid = user.id || user.uid;
      const role = user.role || 'student';
      const token = signSessionToken({ uid, role, email: user.email });
      setSessionCookie(req, res, token);
      return sendJSON(res, 200, {
        user: {
          uid,
          id: uid,
          name: user.name || 'Élève',
          email: user.email,
          role,
          tier: user.tier || 'freemium',
          xp: user.xp || 0,
          streak: user.streak || 0,
          rank: user.rank || null,
          totalStudents: user.totalStudents || 1200,
          subscription: user.subscription || null,
          classId: user.classId || null,
          school: user.school || null
        },
        token
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const { name, email, password } = await getBody(req);
      const cleanEmail = (email || '').toLowerCase().trim();
      if (!cleanEmail || !password || String(password).length < 4) {
        return sendJSON(res, 400, { error: 'Email et mot de passe (min 4 caractères) requis.' });
      }
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@lconq.ma').toLowerCase().trim();
      if (cleanEmail === adminEmail) {
        return sendJSON(res, 403, { error: 'Inscription impossible avec cette adresse.' });
      }

      const uid = 'usr_' + crypto.randomBytes(6).toString('hex');
      const hashedPassword = hashPassword(password);

      const newUser = {
        id: uid,
        uid,
        name: name || 'Élève',
        email: cleanEmail,
        role: 'student',
        tier: 'freemium',
        xp: 0,
        streak: 0,
        rank: null,
        totalStudents: 1200,
        joined: new Date().toISOString(),
        subscription: null
      };

      if (isMySqlActive) {
        const [existing] = await dbPool.query('SELECT id FROM tbl_users WHERE email = ?', [cleanEmail]);
        if (existing.length > 0) {
          return sendJSON(res, 409, { error: 'Un compte existe déjà avec cet email.' });
        }
        await dbPool.query(
          'INSERT INTO tbl_users (id, email, password, role, tier, data) VALUES (?, ?, ?, ?, ?, ?)',
          [uid, cleanEmail, hashedPassword, 'student', 'freemium', JSON.stringify(newUser)]
        );
      } else {
        const users = readDataFile('users.json', []);
        if (users.some(u => (u.email || '').toLowerCase().trim() === cleanEmail)) {
          return sendJSON(res, 409, { error: 'Un compte existe déjà avec cet email.' });
        }
        users.push({ ...newUser, password: hashedPassword });
        writeDataFile('users.json', users);
      }

      const token = signSessionToken({ uid, role: 'student', email: cleanEmail });
      setSessionCookie(req, res, token);
      return sendJSON(res, 200, { user: newUser, token });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // ── Centralized Route Authorization Gate ──
  const session = getRequestSession(req);
  const isAdminSession = session?.role === 'admin';
  const isWriteMethod = req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE';

  // 1) All /api/admin/* endpoints strictly require Admin authentication
  if (pathname.startsWith('/api/admin/')) {
    if (!isAdminSession) {
      return sendJSON(res, 401, { error: 'Accès administrateur requis. Veuillez vous reconnecter.' });
    }
  }

  // 2) All DELETE endpoints strictly require Admin authentication
  if (req.method === 'DELETE') {
    if (!isAdminSession) {
      return sendJSON(res, 401, { error: 'Authentification administrateur requise pour supprimer.' });
    }
  }

  // 3) Extraction tasks & AI proxy endpoints require Admin authentication
  if (
    pathname.startsWith('/api/extraction-tasks') ||
    pathname === '/api/gemini/generate' ||
    pathname === '/api/openai/generate' ||
    pathname === '/api/ai/solve'
  ) {
    if (!isAdminSession) {
      return sendJSON(res, 401, { error: 'Authentification administrateur requise pour les outils IA.' });
    }
  }

  // 4) Write operations on core content/config tables require Admin authentication
  if (
    isWriteMethod &&
    (
      pathname === '/api/exams' || pathname.startsWith('/api/exams/') ||
      pathname === '/api/lessons' || pathname.startsWith('/api/lessons/') ||
      pathname === '/api/classes' || pathname.startsWith('/api/classes/') ||
      pathname === '/api/grades' || pathname.startsWith('/api/grades/') ||
      pathname === '/api/devoir-prime' || pathname.startsWith('/api/devoir-prime/') ||
      pathname === '/api/solutions' || pathname.startsWith('/api/solutions/') ||
      pathname === '/api/assets' ||
      pathname === '/api/config'
    )
  ) {
    if (!isAdminSession) {
      return sendJSON(res, 401, { error: 'Authentification administrateur requise pour modifier ces données.' });
    }
  }

  // 5) Users endpoints: listing all users requires Admin; reading/updating single user requires Admin OR self
  if (pathname === '/api/users' || pathname.startsWith('/api/users/')) {
    const targetUid = pathname.startsWith('/api/users/') ? pathname.replace('/api/users/', '').trim() : null;
    if (req.method === 'GET' && !targetUid && !isAdminSession) {
      return sendJSON(res, 401, { error: 'Authentification administrateur requise.' });
    }
    if (req.method === 'GET' && targetUid && !isAdminSession && session?.uid !== targetUid) {
      return sendJSON(res, 403, { error: 'Accès non autorisé.' });
    }
    if (req.method === 'POST' && !session) {
      return sendJSON(res, 401, { error: 'Authentification requise.' });
    }
  }

  // 3. Exams Endpoints
  if (pathname === '/api/exams') {
    if (req.method === 'GET') {
      const fileExams = readDataFile('exams.json', []);
      if (isMySqlActive) {
        try {
          const [rows] = await dbPool.query('SELECT data FROM tbl_exams ORDER BY updated_at DESC');
          const exams = rows.map(r => safeJsonParse(r.data, null)).filter(Boolean);
          if (exams.length > 0) return sendJSON(res, 200, exams);
        } catch (_) {}
      }
      return sendJSON(res, 200, fileExams);
    }

    if (req.method === 'POST') {
      try {
        const exam = await getBody(req);
        if (!exam.id) exam.id = Math.random().toString(36).substring(2, 11).toUpperCase();
        exam.updatedAt = new Date().toISOString();
        const title = exam.name || exam.title || '';
        const level = exam.level || '';

        if (isMySqlActive) {
          await dbPool.query(
            'INSERT INTO tbl_exams (id, title, level, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), level = VALUES(level), data = VALUES(data), updated_at = NOW()',
            [exam.id, title, level, JSON.stringify(exam)]
          );
        }
        const exams = readDataFile('exams.json', []);
        const idx = exams.findIndex(e => e.id === exam.id);
        if (idx > -1) exams[idx] = { ...exams[idx], ...exam };
        else exams.unshift(exam);
        writeDataFile('exams.json', exams);
        return sendJSON(res, 200, { success: true, exam });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = parsedUrl.searchParams.get('id');
      if (isMySqlActive) {
        await dbPool.query('DELETE FROM tbl_exams WHERE id = ?', [id]);
      }
      const exams = readDataFile('exams.json', []).filter(e => e.id !== id);
      writeDataFile('exams.json', exams);
      return sendJSON(res, 200, { success: true });
    }
  }

  if (pathname.startsWith('/api/exams/')) {
    const id = pathname.replace('/api/exams/', '').trim();
    if (req.method === 'GET') {
      if (isMySqlActive) {
        try {
          const [rows] = await dbPool.query('SELECT data FROM tbl_exams WHERE id = ?', [id]);
          if (rows.length > 0) {
            const ex = safeJsonParse(rows[0].data, null);
            if (ex) return sendJSON(res, 200, ex);
          }
        } catch (_) {}
      }
      const exams = readDataFile('exams.json', []);
      const found = exams.find(e => e.id === id);
      if (found) return sendJSON(res, 200, found);
      return sendJSON(res, 404, { error: 'Exam not found' });
    }
  }

  // 4. Lessons Endpoints
  if (pathname === '/api/lessons' || pathname.startsWith('/api/lessons/')) {
    const singleId = pathname.startsWith('/api/lessons/') ? pathname.replace('/api/lessons/', '').trim() : null;

    if (req.method === 'GET') {
      if (singleId) {
        if (isMySqlActive) {
          try {
            const [rows] = await dbPool.query('SELECT data, created_at, updated_at FROM tbl_lessons WHERE id = ?', [singleId]);
            if (rows.length > 0) {
              const lesson = safeJsonParse(rows[0].data, null);
              if (lesson) {
                const createdAt = lesson.createdAt || lesson.created_at || (rows[0].created_at ? new Date(rows[0].created_at).toISOString() : null) || lesson.updatedAt || lesson.updated_at || new Date().toISOString();
                const updatedAt = lesson.updatedAt || lesson.updated_at || (rows[0].updated_at ? new Date(rows[0].updated_at).toISOString() : null) || createdAt;
                const docType = lesson.docType || lesson.doc_type || lesson.content?.doc_type || 'course';
                const isActive = lesson.isActive !== undefined ? Boolean(lesson.isActive) : (lesson.is_active !== undefined ? Boolean(lesson.is_active) : true);
                const isArchived = lesson.isArchived !== undefined ? Boolean(lesson.isArchived) : (lesson.is_archived !== undefined ? Boolean(lesson.is_archived) : false);
                const archivedAt = lesson.archivedAt || lesson.archived_at || null;

                lesson.createdAt = createdAt;
                lesson.created_at = createdAt;
                lesson.updatedAt = updatedAt;
                lesson.updated_at = updatedAt;
                lesson.docType = docType;
                lesson.doc_type = docType;
                lesson.isActive = isActive;
                lesson.is_active = isActive;
                lesson.isArchived = isArchived;
                lesson.is_archived = isArchived;
                lesson.archivedAt = archivedAt;
                lesson.archived_at = archivedAt;

                // Hydrate latest DEVOIR PRIME edits & solutions from tbl_devoir_prime if present
                try {
                  const [dpRows] = await dbPool.query('SELECT meta_json, exercises_json, updated_at FROM tbl_devoir_prime WHERE lesson_id = ? ORDER BY updated_at DESC LIMIT 1', [singleId]);
                  if (dpRows.length > 0) {
                    const dpMeta = safeJsonParse(dpRows[0].meta_json, null);
                    const dpExs = safeJsonParse(dpRows[0].exercises_json, null);
                    lesson.content = lesson.content || {};
                    if (dpMeta && Object.keys(dpMeta).length > 0) lesson.content.devoir_prime_meta = dpMeta;
                    if (Array.isArray(dpExs) && dpExs.length > 0) lesson.content.devoir_prime_exercises = dpExs;
                  }
                } catch (_) {}

                // Hydrate latest saved section solutions from tbl_solutions if missing in lesson JSON
                try {
                  const [solRows] = await dbPool.query('SELECT section_id, question_id, solution_text FROM tbl_solutions WHERE lesson_id = ? AND (question_id IS NULL OR question_id = \'\')', [singleId]);
                  if (solRows.length > 0) {
                    const solMap = new Map(solRows.map(r => [r.section_id, r.solution_text]));
                    const applySols = (arr) => Array.isArray(arr) ? arr.map(s => (s && s.id && solMap.has(s.id) && (!s.solution || !String(s.solution).trim())) ? { ...s, solution: solMap.get(s.id) } : s) : arr;
                    if (lesson.content?.sections) lesson.content.sections = applySols(lesson.content.sections);
                    if (lesson.sections) lesson.sections = applySols(lesson.sections);
                  }
                } catch (_) {}

                return sendJSON(res, 200, lesson);
              }
            }
          } catch (_) {}
        }
        const lessons = readDataFile('lessons.json', []);
        const found = lessons.find(l => l.id === singleId);
        if (found) {
          const docType = found.docType || found.doc_type || found.content?.doc_type || 'course';
          const isActive = found.isActive !== undefined ? Boolean(found.isActive) : (found.is_active !== undefined ? Boolean(found.is_active) : true);
          return sendJSON(res, 200, { ...found, docType, doc_type: docType, isActive, is_active: isActive });
        }
        return sendJSON(res, 404, { error: 'Lesson not found' });
      }

      const fileLessons = readDataFile('lessons.json', []);
      if (isMySqlActive) {
        try {
          const [rows] = await dbPool.query('SELECT data, created_at, updated_at FROM tbl_lessons ORDER BY updated_at DESC');
          const lessons = rows.map(r => {
            const l = safeJsonParse(r.data, null);
            if (!l) return null;
            const createdAt = l.createdAt || l.created_at || (r.created_at ? new Date(r.created_at).toISOString() : null) || l.updatedAt || l.updated_at || new Date().toISOString();
            const updatedAt = l.updatedAt || l.updated_at || (r.updated_at ? new Date(r.updated_at).toISOString() : null) || createdAt;
            const docType = l.docType || l.doc_type || l.content?.doc_type || 'course';
            const isActive = l.isActive !== undefined ? Boolean(l.isActive) : (l.is_active !== undefined ? Boolean(l.is_active) : true);
            const isArchived = l.isArchived !== undefined ? Boolean(l.isArchived) : (l.is_archived !== undefined ? Boolean(l.is_archived) : false);
            const archivedAt = l.archivedAt || l.archived_at || null;

            l.createdAt = createdAt;
            l.created_at = createdAt;
            l.updatedAt = updatedAt;
            l.updated_at = updatedAt;
            l.docType = docType;
            l.doc_type = docType;
            l.isActive = isActive;
            l.is_active = isActive;
            l.isArchived = isArchived;
            l.is_archived = isArchived;
            l.archivedAt = archivedAt;
            l.archived_at = archivedAt;
            return l;
          }).filter(Boolean);
          if (lessons.length > 0) return sendJSON(res, 200, lessons);
        } catch (_) {}
      }
      return sendJSON(res, 200, fileLessons);
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const lesson = await getBody(req);
        const targetId = singleId || lesson.id || ('MOCK-L-' + Math.random().toString(36).substring(2, 11).toUpperCase());
        lesson.id = targetId;
        const now = new Date().toISOString();
        lesson.updatedAt = now;
        lesson.updated_at = now;

        // Preserve created_at from existing record if not provided
        let existingCreatedAt = null;
        if (isMySqlActive) {
          try {
            const [exRows] = await dbPool.query('SELECT created_at, data FROM tbl_lessons WHERE id = ?', [targetId]);
            if (exRows.length > 0) {
              existingCreatedAt = exRows[0].created_at ? new Date(exRows[0].created_at).toISOString() : null;
              const parsedEx = safeJsonParse(exRows[0].data, {});
              if (parsedEx?.createdAt) existingCreatedAt = parsedEx.createdAt;
              else if (parsedEx?.created_at) existingCreatedAt = parsedEx.created_at;
            }
          } catch (_) {}
        }
        if (!existingCreatedAt) {
          const fileLessons = readDataFile('lessons.json', []);
          const existingFile = fileLessons.find(l => l.id === targetId);
          if (existingFile?.createdAt) existingCreatedAt = existingFile.createdAt;
          else if (existingFile?.created_at) existingCreatedAt = existingFile.created_at;
        }

        const createdAt = lesson.createdAt || lesson.created_at || existingCreatedAt || now;
        lesson.createdAt = createdAt;
        lesson.created_at = createdAt;

        // Normalize docType, isActive and isArchived
        const docType = lesson.docType || lesson.doc_type || lesson.content?.doc_type || 'course';
        lesson.docType = docType;
        lesson.doc_type = docType;
        const isActive = lesson.isActive !== undefined ? Boolean(lesson.isActive) : (lesson.is_active !== undefined ? Boolean(lesson.is_active) : true);
        lesson.isActive = isActive;
        lesson.is_active = isActive;
        const isArchived = lesson.isArchived !== undefined ? Boolean(lesson.isArchived) : (lesson.is_archived !== undefined ? Boolean(lesson.is_archived) : false);
        lesson.isArchived = isArchived;
        lesson.is_archived = isArchived;
        const archivedAt = isArchived ? (lesson.archivedAt || lesson.archived_at || now) : null;
        lesson.archivedAt = archivedAt;
        lesson.archived_at = archivedAt;

        if (isMySqlActive) {
          await dbPool.query(
            'INSERT INTO tbl_lessons (id, title, subject, level, doc_type, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), subject = VALUES(subject), level = VALUES(level), doc_type = VALUES(doc_type), data = VALUES(data), updated_at = NOW()',
            [targetId, lesson.title || '', lesson.subject || '', lesson.level || '', docType, JSON.stringify(lesson)]
          );

          // Auto-sync DEVOIR PRIME documents into dedicated tbl_devoir_prime table & tbl_solutions
          if (docType === 'devoir_prime' || lesson.content?.devoir_prime_exercises) {
            const dpMeta = lesson.content?.devoir_prime_meta || {};
            const dpExercises = lesson.content?.devoir_prime_exercises || [];
            const totalPts = parseFloat(lesson.content?.total_points || lesson.total_points) || 20;
            await dbPool.query(
              `INSERT INTO tbl_devoir_prime (id, lesson_id, title, level, semester, academic_year, teacher, total_points, meta_json, exercises_json)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE title = VALUES(title), level = VALUES(level), semester = VALUES(semester), academic_year = VALUES(academic_year), teacher = VALUES(teacher), total_points = VALUES(total_points), meta_json = VALUES(meta_json), exercises_json = VALUES(exercises_json), updated_at = NOW()`,
              [
                `dp-${targetId}`,
                targetId,
                dpMeta.title || lesson.title || '',
                dpMeta.level || lesson.level || '',
                dpMeta.semester || '',
                dpMeta.academicYear || '',
                dpMeta.teacher || lesson.teacher || '',
                totalPts,
                JSON.stringify(dpMeta),
                JSON.stringify(dpExercises)
              ]
            ).catch(() => {});

            for (const ex of dpExercises) {
              for (const q of (ex.questions || [])) {
                if (!q || q.isStem) continue;
                const hasSol = (Array.isArray(q.steps) && q.steps.length > 0) || Boolean(q.finalBox) || (Array.isArray(q.leftSteps) && q.leftSteps.length > 0) || (Array.isArray(q.rightSteps) && q.rightSteps.length > 0);
                if (hasSol) {
                  const solId = `dp-sol-${targetId}-${q.id}`.slice(0, 128);
                  const solText = [...(q.steps || []), ...(q.leftSteps || []), ...(q.rightSteps || []), q.finalBox || ''].filter(Boolean).join('\n');
                  await dbPool.query(
                    `INSERT INTO tbl_solutions (id, lesson_id, section_id, question_id, doc_type, solution_text, solution_json)
                     VALUES (?, ?, ?, ?, 'devoir_prime', ?, ?)
                     ON DUPLICATE KEY UPDATE solution_text = VALUES(solution_text), solution_json = VALUES(solution_json), updated_at = NOW()`,
                    [solId, targetId, String(ex.id || 'ex').slice(0, 128), String(q.id || '').slice(0, 128), solText, JSON.stringify(q)]
                  ).catch(() => {});
                }
              }
            }
          }

          // Auto-sync standard section solutions into tbl_solutions
          const secs = Array.isArray(lesson.content?.sections) ? lesson.content.sections : (Array.isArray(lesson.sections) ? lesson.sections : []);
          for (const sec of secs) {
            if (sec && sec.id && sec.solution && String(sec.solution).trim()) {
              const solId = `sol-${targetId}-${sec.id}`.slice(0, 128);
              await dbPool.query(
                `INSERT INTO tbl_solutions (id, lesson_id, section_id, question_id, doc_type, solution_text, solution_json)
                 VALUES (?, ?, ?, '', ?, ?, NULL)
                 ON DUPLICATE KEY UPDATE solution_text = VALUES(solution_text), doc_type = VALUES(doc_type), updated_at = NOW()`,
                [solId, targetId, String(sec.id).slice(0, 128), docType, String(sec.solution)]
              ).catch(() => {});
            }
          }
        }
        const lessons = readDataFile('lessons.json', []);
        const idx = lessons.findIndex(l => l.id === targetId);
        if (idx > -1) lessons[idx] = { ...lessons[idx], ...lesson };
        else lessons.unshift(lesson);
        writeDataFile('lessons.json', lessons);
        return sendJSON(res, 200, { success: true, lesson });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = singleId || parsedUrl.searchParams.get('id');
      if (isMySqlActive) {
        await dbPool.query('DELETE FROM tbl_lessons WHERE id = ?', [id]);
        await dbPool.query('DELETE FROM tbl_devoir_prime WHERE lesson_id = ?', [id]).catch(() => {});
        await dbPool.query('DELETE FROM tbl_solutions WHERE lesson_id = ?', [id]).catch(() => {});
        await dbPool.query('DELETE FROM tbl_grades WHERE lesson_id = ?', [id]).catch(() => {});
      }
      const lessons = readDataFile('lessons.json', []).filter(l => l.id !== id);
      writeDataFile('lessons.json', lessons);
      return sendJSON(res, 200, { success: true });
    }
  }

  // 5. Classes Endpoints
  if (pathname === '/api/classes' || pathname.startsWith('/api/classes/')) {
    const singleId = pathname.startsWith('/api/classes/') ? pathname.replace('/api/classes/', '').trim() : null;

    if (req.method === 'GET') {
      if (singleId) {
        if (isMySqlActive) {
          try {
            const [rows] = await dbPool.query('SELECT data FROM tbl_classes WHERE id = ?', [singleId]);
            if (rows.length > 0) {
              const cls = safeJsonParse(rows[0].data, null);
              if (cls) return sendJSON(res, 200, cls);
            }
          } catch (_) {}
        }
        const classes = readDataFile('classes.json', []);
        const found = classes.find(c => c.id === singleId);
        if (found) return sendJSON(res, 200, found);
        return sendJSON(res, 404, { error: 'Class not found' });
      }

      const fileClasses = readDataFile('classes.json', []);
      if (isMySqlActive) {
        try {
          const [rows] = await dbPool.query('SELECT data FROM tbl_classes ORDER BY updated_at DESC');
          const classes = rows.map(r => safeJsonParse(r.data, null)).filter(Boolean);
          if (classes.length > 0) return sendJSON(res, 200, classes);
        } catch (_) {}
      }
      return sendJSON(res, 200, fileClasses);
    }

    if (req.method === 'POST') {
      try {
        const cls = await getBody(req);
        if (!cls.id) cls.id = 'CLASS-' + Math.random().toString(36).substring(2, 11).toUpperCase();
        cls.updatedAt = new Date().toISOString();

        if (isMySqlActive) {
          await dbPool.query(
            'INSERT INTO tbl_classes (id, name, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), data = VALUES(data), updated_at = NOW()',
            [cls.id, cls.name || '', JSON.stringify(cls)]
          );
        }
        const classes = readDataFile('classes.json', []);
        const idx = classes.findIndex(c => c.id === cls.id);
        if (idx > -1) classes[idx] = { ...classes[idx], ...cls };
        else classes.unshift(cls);
        writeDataFile('classes.json', classes);
        return sendJSON(res, 200, { success: true, class: cls });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = singleId || parsedUrl.searchParams.get('id');
      if (isMySqlActive) {
        await dbPool.query('DELETE FROM tbl_classes WHERE id = ?', [id]);
      }
      const classes = readDataFile('classes.json', []).filter(c => c.id !== id);
      writeDataFile('classes.json', classes);
      return sendJSON(res, 200, { success: true });
    }
  }

  // 5.5 Grades & Points Tables Endpoints
  if (pathname === '/api/grades' || pathname.startsWith('/api/grades/')) {
    const singleId = pathname.startsWith('/api/grades/') ? pathname.replace('/api/grades/', '').trim() : null;

    if (req.method === 'GET') {
      const lessonIdFilter = parsedUrl.searchParams.get('lesson_id') || parsedUrl.searchParams.get('lessonId');
      const classIdFilter = parsedUrl.searchParams.get('class_id') || parsedUrl.searchParams.get('classId');

      if (singleId) {
        if (isMySqlActive) {
          try {
            const [rows] = await dbPool.query('SELECT data FROM tbl_grades WHERE id = ?', [singleId]);
            if (rows.length > 0) {
              const gr = safeJsonParse(rows[0].data, null);
              if (gr) return sendJSON(res, 200, gr);
            }
          } catch (_) {}
        }
        const fileGrades = readDataFile('grades.json', []);
        const found = fileGrades.find(g => g.id === singleId);
        if (found) return sendJSON(res, 200, found);
        return sendJSON(res, 404, { error: 'Grade sheet not found' });
      }

      if (isMySqlActive) {
        try {
          let query = 'SELECT data FROM tbl_grades';
          const params = [];
          const where = [];
          if (lessonIdFilter) {
            where.push('lesson_id = ?');
            params.push(lessonIdFilter);
          }
          if (classIdFilter) {
            where.push('class_id = ?');
            params.push(classIdFilter);
          }
          if (where.length > 0) query += ' WHERE ' + where.join(' AND ');
          query += ' ORDER BY updated_at DESC';

          const [rows] = await dbPool.query(query, params);
          const grades = rows.map(r => safeJsonParse(r.data, null)).filter(Boolean);
          if (grades.length > 0) return sendJSON(res, 200, grades);
        } catch (_) {}
      }

      let fileGrades = readDataFile('grades.json', []);
      if (lessonIdFilter) {
        fileGrades = fileGrades.filter(g => (g.lessonId === lessonIdFilter || g.lesson_id === lessonIdFilter));
      }
      if (classIdFilter) {
        fileGrades = fileGrades.filter(g => (g.classId === classIdFilter || g.class_id === classIdFilter));
      }
      return sendJSON(res, 200, fileGrades);
    }

    if (req.method === 'POST') {
      try {
        const gradePayload = await getBody(req);
        if (!gradePayload.id) {
          gradePayload.id = gradePayload.lesson_id ? `GRADE-L-${gradePayload.lesson_id}` : ('GRADE-' + Math.random().toString(36).substring(2, 11).toUpperCase());
        }
        gradePayload.updatedAt = new Date().toISOString();
        if (!gradePayload.createdAt) gradePayload.createdAt = new Date().toISOString();

        const lessonId = gradePayload.lessonId || gradePayload.lesson_id || null;
        const examId = gradePayload.examId || gradePayload.exam_id || null;
        const classId = gradePayload.classId || gradePayload.class_id || null;
        const title = gradePayload.title || '';
        const docType = gradePayload.docType || gradePayload.doc_type || 'homework';
        const totalPoints = parseFloat(gradePayload.totalPoints || gradePayload.total_points) || 20;

        if (isMySqlActive) {
          await dbPool.query(
            'INSERT INTO tbl_grades (id, lesson_id, exam_id, class_id, title, doc_type, total_points, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE lesson_id = VALUES(lesson_id), exam_id = VALUES(exam_id), class_id = VALUES(class_id), title = VALUES(title), doc_type = VALUES(doc_type), total_points = VALUES(total_points), data = VALUES(data), updated_at = NOW()',
            [gradePayload.id, lessonId, examId, classId, title, docType, totalPoints, JSON.stringify(gradePayload)]
          );
        }

        const fileGrades = readDataFile('grades.json', []);
        const idx = fileGrades.findIndex(g => g.id === gradePayload.id);
        if (idx > -1) fileGrades[idx] = { ...fileGrades[idx], ...gradePayload };
        else fileGrades.unshift(gradePayload);
        writeDataFile('grades.json', fileGrades);

        return sendJSON(res, 200, { success: true, grade: gradePayload });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = singleId || parsedUrl.searchParams.get('id') || parsedUrl.searchParams.get('lesson_id');
      if (isMySqlActive && id) {
        await dbPool.query('DELETE FROM tbl_grades WHERE id = ? OR lesson_id = ?', [id, id]).catch(() => {});
      }
      let fileGrades = readDataFile('grades.json', []);
      fileGrades = fileGrades.filter(g => g.id !== id && g.lessonId !== id && g.lesson_id !== id);
      writeDataFile('grades.json', fileGrades);
      return sendJSON(res, 200, { success: true, deleted: id });
    }
  }

  // 6. Users Endpoints
  if (pathname === '/api/users' || pathname.startsWith('/api/users/')) {
    const singleId = pathname.startsWith('/api/users/') ? pathname.replace('/api/users/', '').trim() : null;

    if (req.method === 'GET') {
      if (singleId) {
        if (isMySqlActive) {
          try {
            const [rows] = await dbPool.query('SELECT data FROM tbl_users WHERE id = ?', [singleId]);
            if (rows.length > 0) {
              const u = safeJsonParse(rows[0].data, null);
              if (u) return sendJSON(res, 200, stripSensitiveUser(u));
            }
          } catch (_) {}
        }
        const users = readDataFile('users.json', []);
        const found = users.find(u => u.id === singleId || u.uid === singleId);
        if (found) return sendJSON(res, 200, stripSensitiveUser(found));
        return sendJSON(res, 404, { error: 'User not found' });
      }

      const fileUsers = readDataFile('users.json', []).map(stripSensitiveUser);
      if (isMySqlActive) {
        try {
          const [rows] = await dbPool.query('SELECT data FROM tbl_users ORDER BY updated_at DESC');
          const users = rows.map(r => stripSensitiveUser(safeJsonParse(r.data, null))).filter(Boolean);
          if (users.length > 0) return sendJSON(res, 200, users);
        } catch (_) {}
      }
      return sendJSON(res, 200, fileUsers);
    }

    if (req.method === 'POST') {
      try {
        const userObj = await getBody(req);
        const id = userObj.id || userObj.uid || ('usr_' + crypto.randomBytes(6).toString('hex'));

        // Non-admin users may only update their own non-privileged profile fields
        if (!isAdminSession) {
          if (session?.uid !== id) {
            return sendJSON(res, 403, { error: 'Accès non autorisé.' });
          }
          delete userObj.role;
          delete userObj.tier;
          delete userObj.subscription;
        }

        userObj.id = id;
        userObj.uid = id;
        userObj.updatedAt = new Date().toISOString();

        const hashedPw = userObj.password ? hashPassword(userObj.password) : null;
        const safeObj = stripSensitiveUser(userObj);

        if (isMySqlActive) {
          await dbPool.query(
            'INSERT INTO tbl_users (id, email, password, role, tier, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), password = COALESCE(VALUES(password), password), role = COALESCE(?, role), tier = COALESCE(?, tier), data = VALUES(data), updated_at = NOW()',
            [
              id,
              safeObj.email || `${id}@local.user`,
              hashedPw || hashPassword(crypto.randomBytes(12).toString('hex')),
              isAdminSession ? (safeObj.role || 'student') : 'student',
              isAdminSession ? (safeObj.tier || 'freemium') : 'freemium',
              JSON.stringify(safeObj),
              isAdminSession ? (safeObj.role || null) : null,
              isAdminSession ? (safeObj.tier || null) : null,
            ]
          );
        }
        const users = readDataFile('users.json', []);
        const idx = users.findIndex(u => u.id === id || u.uid === id);
        if (idx > -1) users[idx] = { ...users[idx], ...safeObj, ...(hashedPw ? { password: hashedPw } : {}) };
        else users.unshift({ ...safeObj, ...(hashedPw ? { password: hashedPw } : {}) });
        writeDataFile('users.json', users);
        return sendJSON(res, 200, { success: true, user: safeObj });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = singleId || parsedUrl.searchParams.get('id');
      if (isMySqlActive) {
        await dbPool.query('DELETE FROM tbl_users WHERE id = ?', [id]);
      }
      const users = readDataFile('users.json', []).filter(u => u.id !== id && u.uid !== id);
      writeDataFile('users.json', users);
      return sendJSON(res, 200, { success: true });
    }
  }

  // 7. General Config Endpoints
  if (pathname === '/api/config') {
    if (req.method === 'GET') {
      const fileConfig = readDataFile('config.json', {});
      const sanitizeCfg = (c) => (isAdminSession ? c : filterPublicConfig(c));
      if (isMySqlActive) {
        try {
          const [rows] = await dbPool.query('SELECT key_name, value FROM tbl_config');
          const dbConfig = {};
          for (const row of rows) {
            dbConfig[row.key_name] = safeJsonParse(row.value, row.value);
          }
          return sendJSON(res, 200, sanitizeCfg({ ...fileConfig, ...dbConfig }));
        } catch (dbErr) {
          console.warn('[Server] DB config read error, falling back to file config:', dbErr.message);
          return sendJSON(res, 200, sanitizeCfg(fileConfig));
        }
      }
      return sendJSON(res, 200, sanitizeCfg(fileConfig));
    }

    if (req.method === 'POST') {
      try {
        const payload = await getBody(req);
        if (isMySqlActive) {
          for (const [k, v] of Object.entries(payload)) {
            if (k && v !== undefined) {
              await dbPool.query(
                'INSERT INTO tbl_config (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
                [k, JSON.stringify(v)]
              );
            }
          }
        }
        const existing = readDataFile('config.json', {});
        const updated = { ...existing, ...payload };
        writeDataFile('config.json', updated);
        return sendJSON(res, 200, { success: true, config: updated });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }
  }

  // 8. Assets Endpoints
  if (pathname === '/api/assets') {
    if (req.method === 'GET') {
      const assetPath = parsedUrl.searchParams.get('path');
      if (!assetPath) return sendJSON(res, 400, { error: 'Missing path' });

      if (isMySqlActive) {
        const [rows] = await dbPool.query('SELECT data, mime_type FROM tbl_assets WHERE asset_path = ?', [assetPath]);
        if (rows.length > 0) {
          const base64Data = (rows[0].data || '').replace(/^data:image\/[^;]+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          res.writeHead(200, {
            'Content-Type': rows[0].mime_type || 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          return res.end(buffer);
        }
      }

      // Check local files
      const ASSETS_DIR = path.join(DATA_DIR, 'assets');
      const safeFileName = encodeURIComponent(assetPath).replace(/%/g, '_');
      const metaFilePath = path.join(ASSETS_DIR, `${safeFileName}.json`);
      if (fs.existsSync(metaFilePath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaFilePath, 'utf8'));
          const base64Data = (meta.data || '').replace(/^data:image\/[^;]+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          res.writeHead(200, {
            'Content-Type': meta.mimeType || 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable'
          });
          return res.end(buffer);
        } catch (_) {}
      }
      return sendJSON(res, 404, { error: 'Asset not found' });
    }

    if (req.method === 'POST') {
      try {
        const payload = await getBody(req);
        const { path: assetPath, data, mimeType = 'image/png' } = payload || {};
        if (!assetPath || !data) return sendJSON(res, 400, { error: 'Missing path or data' });

        if (isMySqlActive) {
          await dbPool.query(
            'INSERT INTO tbl_assets (asset_path, data, mime_type) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), mime_type = VALUES(mime_type), updated_at = NOW()',
            [assetPath, data, mimeType]
          );
        }

        const ASSETS_DIR = path.join(DATA_DIR, 'assets');
        if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });
        const safeFileName = encodeURIComponent(assetPath).replace(/%/g, '_');
        fs.writeFileSync(path.join(ASSETS_DIR, `${safeFileName}.json`), JSON.stringify({ path: assetPath, data, mimeType }), 'utf8');

        return sendJSON(res, 200, { success: true, publicUrl: `/api/assets?path=${encodeURIComponent(assetPath)}` });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }
  }

  // 8.5. Platform Factory Reset & Full Backup Endpoints
  if (pathname === '/api/admin/backup-full' && req.method === 'GET') {
    try {
      let exams = [];
      let lessons = [];
      let classes = [];
      let users = [];
      let grades = [];
      let devoirPrime = [];
      let solutions = [];
      let config = {};

      if (isMySqlActive) {
        const [examRows] = await dbPool.query('SELECT data FROM tbl_exams');
        exams = examRows.map(r => safeJsonParse(r.data, {}));

        const [lessonRows] = await dbPool.query('SELECT data FROM tbl_lessons');
        lessons = lessonRows.map(r => safeJsonParse(r.data, {}));

        const [classRows] = await dbPool.query('SELECT data FROM tbl_classes');
        classes = classRows.map(r => safeJsonParse(r.data, {}));

        const [userRows] = await dbPool.query('SELECT data FROM tbl_users');
        users = userRows.map(r => safeJsonParse(r.data, {}));

        const [gradeRows] = await dbPool.query('SELECT data FROM tbl_grades').catch(() => [[]]);
        grades = gradeRows.map(r => safeJsonParse(r.data, {}));

        const [dpRows] = await dbPool.query('SELECT * FROM tbl_devoir_prime').catch(() => [[]]);
        devoirPrime = dpRows.map(r => ({
          ...r,
          meta: safeJsonParse(r.meta_json, {}),
          exercises: safeJsonParse(r.exercises_json, [])
        }));

        const [solRows] = await dbPool.query('SELECT * FROM tbl_solutions').catch(() => [[]]);
        solutions = solRows;

        const [configRows] = await dbPool.query('SELECT key_name, value FROM tbl_config');
        for (const row of configRows) {
          config[row.key_name] = safeJsonParse(row.value, row.value);
        }
      } else {
        exams = readDataFile('exams.json', []);
        lessons = readDataFile('lessons.json', []);
        classes = readDataFile('classes.json', []);
        users = readDataFile('users.json', []);
        grades = readDataFile('grades.json', []);
        devoirPrime = readDataFile('devoir_prime.json', []);
        solutions = readDataFile('solutions.json', []);
        config = readDataFile('config.json', {});
      }

      const backup = {
        version: '1.1',
        timestamp: new Date().toISOString(),
        stats: {
          examsCount: exams.length,
          lessonsCount: lessons.length,
          classesCount: classes.length,
          usersCount: users.length,
          gradesCount: grades.length,
          devoirPrimeCount: devoirPrime.length,
          solutionsCount: solutions.length
        },
        exams,
        lessons,
        classes,
        users,
        grades,
        devoirPrime,
        solutions,
        config
      };

      return sendJSON(res, 200, backup);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/admin/restore-full' && req.method === 'POST') {
    try {
      const payload = await getBody(req);
      const { exams = [], lessons = [], classes = [], users = [], grades = [], devoirPrime = [], solutions = [], config = {} } = payload || {};

      if (isMySqlActive) {
        if (Array.isArray(exams) && exams.length > 0) {
          for (const ex of exams) {
            if (ex.id) {
              await dbPool.query(
                'INSERT INTO tbl_exams (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()',
                [ex.id, JSON.stringify(ex)]
              );
            }
          }
        }
        if (Array.isArray(lessons) && lessons.length > 0) {
          for (const l of lessons) {
            if (l.id) {
              const dt = l.docType || l.doc_type || l.content?.doc_type || 'course';
              await dbPool.query(
                'INSERT INTO tbl_lessons (id, title, subject, level, doc_type, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), subject = VALUES(subject), level = VALUES(level), doc_type = VALUES(doc_type), data = VALUES(data), updated_at = NOW()',
                [l.id, l.title || '', l.subject || '', l.level || '', dt, JSON.stringify(l)]
              );
            }
          }
        }
        if (Array.isArray(classes) && classes.length > 0) {
          for (const c of classes) {
            if (c.id) {
              await dbPool.query(
                'INSERT INTO tbl_classes (id, name, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), data = VALUES(data), updated_at = NOW()',
                [c.id, c.name || '', JSON.stringify(c)]
              );
            }
          }
        }
        if (Array.isArray(users) && users.length > 0) {
          for (const u of users) {
            const uid = u.id || u.uid;
            if (uid) {
              await dbPool.query(
                'INSERT INTO tbl_users (id, email, password, role, tier, data) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), role = VALUES(role), tier = VALUES(tier), data = VALUES(data), updated_at = NOW()',
                [uid, u.email || `${uid}@local.user`, u.password || 'student123', u.role || 'student', u.tier || 'freemium', JSON.stringify(u)]
              );
            }
          }
        }
        if (Array.isArray(grades) && grades.length > 0) {
          for (const g of grades) {
            if (g.id) {
              await dbPool.query(
                'INSERT INTO tbl_grades (id, lesson_id, exam_id, class_id, title, doc_type, total_points, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE lesson_id = VALUES(lesson_id), exam_id = VALUES(exam_id), class_id = VALUES(class_id), title = VALUES(title), doc_type = VALUES(doc_type), total_points = VALUES(total_points), data = VALUES(data), updated_at = NOW()',
                [g.id, g.lessonId || g.lesson_id || null, g.examId || g.exam_id || null, g.classId || g.class_id || null, g.title || '', g.docType || g.doc_type || 'homework', parseFloat(g.totalPoints || g.total_points) || 20, JSON.stringify(g)]
              );
            }
          }
        }
        if (Array.isArray(devoirPrime) && devoirPrime.length > 0) {
          for (const dp of devoirPrime) {
            if (dp.id && dp.lesson_id) {
              await dbPool.query(
                'INSERT INTO tbl_devoir_prime (id, lesson_id, title, level, semester, academic_year, teacher, total_points, meta_json, exercises_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), level = VALUES(level), semester = VALUES(semester), academic_year = VALUES(academic_year), teacher = VALUES(teacher), total_points = VALUES(total_points), meta_json = VALUES(meta_json), exercises_json = VALUES(exercises_json), updated_at = NOW()',
                [dp.id, dp.lesson_id, dp.title || '', dp.level || '', dp.semester || '', dp.academic_year || '', dp.teacher || '', parseFloat(dp.total_points) || 20, typeof dp.meta_json === 'string' ? dp.meta_json : JSON.stringify(dp.meta || {}), typeof dp.exercises_json === 'string' ? dp.exercises_json : JSON.stringify(dp.exercises || [])]
              ).catch(() => {});
            }
          }
        }
        if (Array.isArray(solutions) && solutions.length > 0) {
          for (const s of solutions) {
            if (s.id && s.lesson_id) {
              await dbPool.query(
                'INSERT INTO tbl_solutions (id, lesson_id, section_id, question_id, doc_type, solution_text, solution_json) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE doc_type = VALUES(doc_type), solution_text = VALUES(solution_text), solution_json = VALUES(solution_json), updated_at = NOW()',
                [s.id, s.lesson_id, s.section_id || 'sec-1', s.question_id || '', s.doc_type || 'homework', s.solution_text || '', s.solution_json || null]
              ).catch(() => {});
            }
          }
        }
        if (config && typeof config === 'object') {
          for (const [k, v] of Object.entries(config)) {
            await dbPool.query(
              'INSERT INTO tbl_config (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
              [k, JSON.stringify(v)]
            );
          }
        }
      }

      if (Array.isArray(exams)) writeDataFile('exams.json', exams);
      if (Array.isArray(lessons)) writeDataFile('lessons.json', lessons);
      if (Array.isArray(classes)) writeDataFile('classes.json', classes);
      if (Array.isArray(users)) writeDataFile('users.json', users);
      if (Array.isArray(grades)) writeDataFile('grades.json', grades);
      if (Array.isArray(devoirPrime)) writeDataFile('devoir_prime.json', devoirPrime);
      if (Array.isArray(solutions)) writeDataFile('solutions.json', solutions);
      if (config && typeof config === 'object') {
        const curr = readDataFile('config.json', {});
        writeDataFile('config.json', { ...curr, ...config });
      }

      return sendJSON(res, 200, {
        success: true,
        restored: {
          exams: exams.length,
          lessons: lessons.length,
          classes: classes.length,
          users: users.length,
          grades: grades.length,
          devoirPrime: devoirPrime.length,
          solutions: solutions.length
        }
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // DEVOIR PRIME Dedicated Endpoint (GET + POST/PUT)
  if (pathname === '/api/devoir-prime' || pathname.startsWith('/api/devoir-prime/')) {
    const lessonIdParam = pathname.startsWith('/api/devoir-prime/') ? pathname.replace('/api/devoir-prime/', '').trim() : parsedUrl.searchParams.get('lesson_id');
    if (req.method === 'GET') {
      try {
        if (isMySqlActive) {
          if (lessonIdParam) {
            const [rows] = await dbPool.query('SELECT * FROM tbl_devoir_prime WHERE lesson_id = ? OR id = ?', [lessonIdParam, lessonIdParam]);
            if (rows.length > 0) {
              const r = rows[0];
              return sendJSON(res, 200, {
                ...r,
                meta: safeJsonParse(r.meta_json, {}),
                exercises: safeJsonParse(r.exercises_json, [])
              });
            }
            return sendJSON(res, 404, { error: 'DEVOIR PRIME not found' });
          }
          const [rows] = await dbPool.query('SELECT id, lesson_id, title, level, semester, academic_year, teacher, total_points, created_at, updated_at FROM tbl_devoir_prime ORDER BY updated_at DESC');
          return sendJSON(res, 200, rows);
        }
        const dpList = readDataFile('devoir_prime.json', []);
        if (lessonIdParam) {
          const found = dpList.find(d => d.lesson_id === lessonIdParam || d.id === lessonIdParam);
          if (found) return sendJSON(res, 200, found);
          return sendJSON(res, 404, { error: 'DEVOIR PRIME not found' });
        }
        return sendJSON(res, 200, dpList);
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const body = await getBody(req);
        const lessonId = lessonIdParam || body.lesson_id || body.lessonId;
        if (!lessonId) return sendJSON(res, 400, { error: 'lesson_id is required' });
        const dpId = body.id || `dp-${lessonId}`;
        const meta = body.meta || body.devoir_prime_meta || {};
        const exercises = Array.isArray(body.exercises) ? body.exercises : (Array.isArray(body.devoir_prime_exercises) ? body.devoir_prime_exercises : []);
        const totalPoints = parseFloat(body.total_points || body.totalPoints) || 20;
        const now = new Date().toISOString();

        if (isMySqlActive) {
          await dbPool.query(
            `INSERT INTO tbl_devoir_prime (id, lesson_id, title, level, semester, academic_year, teacher, total_points, meta_json, exercises_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE title = VALUES(title), level = VALUES(level), semester = VALUES(semester), academic_year = VALUES(academic_year), teacher = VALUES(teacher), total_points = VALUES(total_points), meta_json = VALUES(meta_json), exercises_json = VALUES(exercises_json), updated_at = NOW()`,
            [
              dpId,
              lessonId,
              meta.title || body.title || '',
              meta.level || body.level || '',
              meta.semester || '',
              meta.academicYear || '',
              meta.teacher || '',
              totalPoints,
              JSON.stringify(meta),
              JSON.stringify(exercises)
            ]
          );

          // Mirror every question solution into tbl_solutions
          for (const ex of exercises) {
            for (const q of (ex.questions || [])) {
              if (!q || q.isStem) continue;
              const hasSol = (Array.isArray(q.steps) && q.steps.length > 0) || Boolean(q.finalBox) || (Array.isArray(q.leftSteps) && q.leftSteps.length > 0) || (Array.isArray(q.rightSteps) && q.rightSteps.length > 0);
              if (hasSol) {
                const solId = `dp-sol-${lessonId}-${q.id}`.slice(0, 128);
                const solText = [...(q.steps || []), ...(q.leftSteps || []), ...(q.rightSteps || []), q.finalBox || ''].filter(Boolean).join('\n');
                await dbPool.query(
                  `INSERT INTO tbl_solutions (id, lesson_id, section_id, question_id, doc_type, solution_text, solution_json)
                   VALUES (?, ?, ?, ?, 'devoir_prime', ?, ?)
                   ON DUPLICATE KEY UPDATE solution_text = VALUES(solution_text), solution_json = VALUES(solution_json), updated_at = NOW()`,
                  [solId, lessonId, String(ex.id || 'ex').slice(0, 128), String(q.id || '').slice(0, 128), solText, JSON.stringify(q)]
                ).catch(() => {});
              }
            }
          }
        }

        const dpRecord = { id: dpId, lesson_id: lessonId, title: meta.title || body.title || '', meta, exercises, total_points: totalPoints, updated_at: now };
        const dpList = readDataFile('devoir_prime.json', []);
        const idx = dpList.findIndex(d => d.lesson_id === lessonId || d.id === dpId);
        if (idx > -1) dpList[idx] = dpRecord;
        else dpList.unshift(dpRecord);
        writeDataFile('devoir_prime.json', dpList);

        return sendJSON(res, 200, { success: true, id: dpId, lesson_id: lessonId, updated_at: now });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }
  }

  // Dedicated Solutions Persistence Endpoint (tbl_solutions <-> solutions.json)
  if (pathname === '/api/solutions' || pathname.startsWith('/api/solutions/')) {
    const singleId = pathname.startsWith('/api/solutions/') ? pathname.replace('/api/solutions/', '').trim() : null;

    if (req.method === 'GET') {
      try {
        const lessonFilter = parsedUrl.searchParams.get('lesson_id');
        if (isMySqlActive) {
          if (singleId) {
            const [rows] = await dbPool.query('SELECT * FROM tbl_solutions WHERE id = ?', [singleId]);
            if (rows.length > 0) return sendJSON(res, 200, rows[0]);
            return sendJSON(res, 404, { error: 'Solution not found' });
          }
          const [rows] = lessonFilter
            ? await dbPool.query('SELECT * FROM tbl_solutions WHERE lesson_id = ? ORDER BY updated_at DESC', [lessonFilter])
            : await dbPool.query('SELECT * FROM tbl_solutions ORDER BY updated_at DESC LIMIT 500');
          return sendJSON(res, 200, rows);
        }
        const sols = readDataFile('solutions.json', []);
        if (singleId) {
          const found = sols.find(s => s.id === singleId);
          return found ? sendJSON(res, 200, found) : sendJSON(res, 404, { error: 'Solution not found' });
        }
        return sendJSON(res, 200, lessonFilter ? sols.filter(s => s.lesson_id === lessonFilter) : sols);
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const body = await getBody(req);
        const lessonId = body.lesson_id || body.lessonId;
        const sectionId = body.section_id || body.sectionId || 'sec-1';
        const questionId = body.question_id || body.questionId || '';
        if (!lessonId) return sendJSON(res, 400, { error: 'lesson_id is required' });
        const solId = (singleId || body.id || `sol-${lessonId}-${sectionId}${questionId ? '-' + questionId : ''}`).slice(0, 128);
        const docType = body.doc_type || body.docType || 'homework';
        const solutionText = body.solution_text !== undefined ? String(body.solution_text) : (body.solution !== undefined ? String(body.solution) : '');
        const solutionJson = body.solution_json ? (typeof body.solution_json === 'string' ? body.solution_json : JSON.stringify(body.solution_json)) : null;
        const now = new Date().toISOString();

        if (isMySqlActive) {
          await dbPool.query(
            `INSERT INTO tbl_solutions (id, lesson_id, section_id, question_id, doc_type, solution_text, solution_json)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE doc_type = VALUES(doc_type), solution_text = VALUES(solution_text), solution_json = VALUES(solution_json), updated_at = NOW()`,
            [solId, lessonId, String(sectionId).slice(0, 128), String(questionId).slice(0, 128), docType, solutionText, solutionJson]
          );
        }

        const record = { id: solId, lesson_id: lessonId, section_id: sectionId, question_id: questionId, doc_type: docType, solution_text: solutionText, solution_json: solutionJson, updated_at: now };
        const sols = readDataFile('solutions.json', []);
        const idx = sols.findIndex(s => s.id === solId);
        if (idx > -1) sols[idx] = record;
        else sols.unshift(record);
        writeDataFile('solutions.json', sols);

        return sendJSON(res, 200, { success: true, solution: record });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = singleId || parsedUrl.searchParams.get('id');
      if (isMySqlActive && id) {
        await dbPool.query('DELETE FROM tbl_solutions WHERE id = ?', [id]).catch(() => {});
      }
      const sols = readDataFile('solutions.json', []).filter(s => s.id !== id);
      writeDataFile('solutions.json', sols);
      return sendJSON(res, 200, { success: true });
    }
  }

  // Live Database Tables Health & Schema Sync Endpoint
  if (pathname === '/api/admin/db-tables' && (req.method === 'GET' || req.method === 'POST')) {
    try {
      if (req.method === 'POST' || !isMySqlActive) {
        await initMySQL();
      }
      const expectedTables = [
        'tbl_exams',
        'tbl_lessons',
        'tbl_classes',
        'tbl_users',
        'tbl_config',
        'tbl_assets',
        'tbl_grades',
        'tbl_devoir_prime',
        'tbl_solutions'
      ];
      const report = {};
      if (isMySqlActive && dbPool) {
        for (const tbl of expectedTables) {
          try {
            const [cntRows] = await dbPool.query(`SELECT COUNT(*) AS cnt FROM ${tbl}`);
            report[tbl] = { exists: true, rows: Number(cntRows?.[0]?.cnt || 0) };
          } catch (e) {
            report[tbl] = { exists: false, error: e.message };
          }
        }
        return sendJSON(res, 200, {
          storage: 'mysql',
          mysqlActive: true,
          tables: report
        });
      }
      return sendJSON(res, 200, {
        storage: 'json',
        mysqlActive: false,
        tables: report
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/admin/reset-platform' && req.method === 'POST') {
    try {
      const payload = await getBody(req);
      const { confirm, includeConfig = false } = payload || {};

      if (confirm !== 'RESET_PLATFORM') {
        return sendJSON(res, 400, { error: 'Confirmation requise (confirm: "RESET_PLATFORM")' });
      }

      console.warn('[Server] ⚠️ INITIATING PLATFORM FACTORY RESET AND PURGE...');

      // 1. Wipe MySQL tables
      if (isMySqlActive) {
        await dbPool.query('DELETE FROM tbl_exams');
        await dbPool.query('DELETE FROM tbl_lessons');
        await dbPool.query('DELETE FROM tbl_classes');
        await dbPool.query('DELETE FROM tbl_users');
        await dbPool.query('DELETE FROM tbl_grades');
        await dbPool.query('DELETE FROM tbl_devoir_prime').catch(() => {});
        await dbPool.query('DELETE FROM tbl_solutions').catch(() => {});
        await dbPool.query('DELETE FROM tbl_assets');
        if (includeConfig) {
          await dbPool.query('DELETE FROM tbl_config');
        } else {
          // Wipe logbook entries and test data from tbl_config, keeping API keys and branding
          await dbPool.query("DELETE FROM tbl_config WHERE key_name = 'logbook_entries' OR key_name = 'teacher_schedule_current'");
        }
        console.log('[Server] MySQL tables successfully emptied.');
      }

      // 2. Wipe JSON files in local data directory
      writeDataFile('exams.json', []);
      writeDataFile('lessons.json', []);
      writeDataFile('classes.json', []);
      writeDataFile('users.json', []);
      writeDataFile('grades.json', []);
      writeDataFile('devoir_prime.json', []);
      writeDataFile('solutions.json', []);
      writeDataFile('extraction_tasks.json', []);

      if (includeConfig) {
        writeDataFile('config.json', {});
      } else {
        const existingCfg = readDataFile('config.json', {});
        delete existingCfg.logbook_entries;
        delete existingCfg.teacher_schedule_current;
        writeDataFile('config.json', existingCfg);
      }

      // 3. Wipe persistent directory files (Hostinger persistent volume)
      if (PERSISTENT_DIR) {
        try {
          fs.writeFileSync(path.join(PERSISTENT_DIR, 'exams.json'), '[]', 'utf8');
          fs.writeFileSync(path.join(PERSISTENT_DIR, 'lessons.json'), '[]', 'utf8');
          fs.writeFileSync(path.join(PERSISTENT_DIR, 'classes.json'), '[]', 'utf8');
          fs.writeFileSync(path.join(PERSISTENT_DIR, 'users.json'), '[]', 'utf8');
          fs.writeFileSync(path.join(PERSISTENT_DIR, 'extraction_tasks.json'), '[]', 'utf8');
          if (includeConfig) {
            fs.writeFileSync(path.join(PERSISTENT_DIR, 'config.json'), '{}', 'utf8');
          } else {
            const pPath = path.join(PERSISTENT_DIR, 'config.json');
            if (fs.existsSync(pPath)) {
              try {
                const pCfg = JSON.parse(fs.readFileSync(pPath, 'utf8'));
                delete pCfg.logbook_entries;
                delete pCfg.teacher_schedule_current;
                fs.writeFileSync(pPath, JSON.stringify(pCfg, null, 2), 'utf8');
              } catch (_) {}
            }
          }
          console.log('[Server] Persistent external backup files successfully emptied.');
        } catch (pErr) {
          console.warn('[Server] Error resetting persistent dir files:', pErr.message);
        }
      }

      // 4. Clear in-memory caches
      memoryCache.clear();

      console.log('[Server] Platform reset complete: all data emptied to factory state.');
      return sendJSON(res, 200, {
        success: true,
        message: 'Plateforme réinitialisée et vidée avec succès. Toutes les données ont été effacées.'
      });
    } catch (err) {
      console.error('[Server] Reset platform failed:', err);
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 9. Extraction Tasks Endpoints
  if (pathname === '/api/extraction-tasks' || pathname.startsWith('/api/extraction-tasks/')) {
    const id = parsedUrl.searchParams.get('id') || (pathname.split('/api/extraction-tasks/')[1] || '').trim();
    const action = parsedUrl.searchParams.get('action');

    if (req.method === 'GET') {
      if (id) {
        const task = getExtractionTaskById(id);
        if (!task) return sendJSON(res, 404, { error: 'Tâche introuvable' });
        return sendJSON(res, 200, task);
      }
      return sendJSON(res, 200, getExtractionTasks());
    }

    if (req.method === 'POST') {
      try {
        const body = await getBody(req);
        if (action === 'retry' || pathname.endsWith('/retry') || body.action === 'retry') {
          const targetId = id || body.id;
          if (!targetId) return sendJSON(res, 400, { error: 'ID de tâche manquant' });
          const retriedTask = retryExtractionTask(targetId, body.apiKey);
          return sendJSON(res, 200, { success: true, task: retriedTask });
        }
        const newTask = createExtractionTask(body);
        return sendJSON(res, 201, { success: true, task: newTask });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      if (!id) return sendJSON(res, 400, { error: 'ID de tâche manquant' });
      deleteExtractionTask(id);
      return sendJSON(res, 200, { success: true });
    }
  }

  // 10. Gemini AI Proxy Endpoint (Secure Server-Side Execution with active model cascade)
  if (pathname === '/api/gemini/generate' && req.method === 'POST') {
    try {
      const payload = await getBody(req);
      let effectiveKey = (payload?.apiKey || '').trim();
      
      // If client provided placeholder or no key, resolve real key
      if (!effectiveKey || effectiveKey === 'MY_GEMINI_API_KEY' || effectiveKey.length < 20) {
        try {
          const cfg = readDataFile('config.json', {});
          const keyFromConfig = cfg?.ai_settings?.geminiApiKey;
          if (keyFromConfig && keyFromConfig.length > 20 && keyFromConfig !== 'MY_GEMINI_API_KEY') {
            effectiveKey = keyFromConfig.trim();
          }
        } catch (_) {}

        try {
          const envPath = path.join(__dirname, '.env');
          if (fs.existsSync(envPath)) {
            const raw = fs.readFileSync(envPath, 'utf8');
            const m = raw.match(/GEMINI_API_KEY\s*=\s*([^\r\n]+)/);
            if (m && m[1]) {
              const fileKey = m[1].trim().replace(/^["']|["']$/g, '');
              if (fileKey && fileKey !== 'MY_GEMINI_API_KEY' && fileKey.length > 20) {
                effectiveKey = fileKey;
              }
            }
          }
        } catch (_) {}

        if (!effectiveKey || effectiveKey === 'MY_GEMINI_API_KEY') {
          const envKey = (process.env.GEMINI_API_KEY || '').trim();
          if (envKey && envKey !== 'MY_GEMINI_API_KEY' && envKey.length > 20) {
            effectiveKey = envKey;
          }
        }
      }

      if (!effectiveKey) {
        return sendJSON(res, 500, { error: 'Aucune clé API Gemini valide configurée sur le serveur ou fournie par le client.' });
      }

      let requestedModel = (payload?.model || 'gemini-3.5-flash-lite').trim().replace(/^models\//, '');
      if (!requestedModel || ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash', '2.5', '2.0', '1.5'].includes(requestedModel)) {
        requestedModel = 'gemini-3.5-flash-lite';
      }

      const cascade = Array.from(new Set([
        requestedModel,
        'gemini-3.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-pro-latest'
      ].filter(Boolean)));

      let lastError = null;
      for (const modelToTry of cascade) {
        const cleanModel = modelToTry.replace(/^models\//, '');
        for (const apiVer of ['v1beta', 'v1']) {
          try {
            const endpoint = `https://generativelanguage.googleapis.com/${apiVer}/models/${cleanModel}:generateContent?key=${effectiveKey}`;
            const bodyPayload = {
              contents: payload.contents,
              systemInstruction: payload.systemInstruction,
              generationConfig: payload.generationConfig || {
                responseMimeType: "application/json",
                maxOutputTokens: 65536,
                temperature: 0.1
              }
            };

            const apiRes = await fetch(endpoint, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': effectiveKey
              },
              body: JSON.stringify(bodyPayload)
            });

            if (!apiRes.ok) {
              const errData = await apiRes.json().catch(() => ({}));
              const msg = errData?.error?.message || `HTTP ${apiRes.status}`;
              console.warn(`[Server Gemini Proxy] Model ${cleanModel} (${apiVer}) failed (${apiRes.status}): ${msg}`);
              if (apiRes.status === 403 || /leaked|permission_denied|api key not valid|api_key_invalid/i.test(msg)) {
                return sendJSON(res, 403, {
                  error: `Clé API Gemini révoquée ou invalide par Google (${msg}). Veuillez fournir une nouvelle clé API valide.`,
                  code: 'API_KEY_INVALID'
                });
              }
              if (apiRes.status === 404 && apiVer === 'v1beta') {
                continue; // Try v1 before skipping model
              }
              lastError = new Error(`Gemini [${cleanModel}]: ${msg}`);
              break; // Try next model in cascade
            }

            const data = await apiRes.json();
            return sendJSON(res, 200, {
              success: true,
              modelUsed: cleanModel,
              apiVersion: apiVer,
              data
            });
          } catch (callErr) {
            lastError = callErr;
          }
        }
      }

      throw lastError || new Error(`Tous les modèles Gemini de secours ont échoué.`);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 10b. OpenAI Proxy Endpoint (Secure Server-Side Execution with Multimodal & JSON support)
  if (pathname === '/api/openai/generate' && req.method === 'POST') {
    try {
      const payload = await getBody(req);
      let effectiveKey = (payload?.apiKey || '').trim();

      // If client provided placeholder or no key, resolve real key from config or env
      if (!effectiveKey || effectiveKey.length < 15) {
        try {
          const cfg = readDataFile('config.json', {});
          const keyFromConfig = cfg?.ai_settings?.openaiApiKey;
          if (keyFromConfig && keyFromConfig.length > 15) {
            effectiveKey = keyFromConfig.trim();
          }
        } catch (_) {}

        try {
          const envPath = path.join(__dirname, '.env');
          if (fs.existsSync(envPath)) {
            const raw = fs.readFileSync(envPath, 'utf8');
            const m = raw.match(/OPENAI_API_KEY\s*=\s*([^\r\n]+)/);
            if (m && m[1]) {
              const fileKey = m[1].trim().replace(/^["']|["']$/g, '');
              if (fileKey && fileKey.length > 15) {
                effectiveKey = fileKey;
              }
            }
          }
        } catch (_) {}

        if (!effectiveKey) {
          const envKey = (process.env.OPENAI_API_KEY || '').trim();
          if (envKey && envKey.length > 15) {
            effectiveKey = envKey;
          }
        }
      }

      if (!effectiveKey) {
        return sendJSON(res, 400, {
          error: 'Aucune clé API OpenAI valide configurée sur le serveur ou fournie par le client.'
        });
      }

      const model = (payload?.model || 'gpt-4o').trim();
      const isReasoning = model.startsWith('o1') || model.startsWith('o3');

      const reqBody = {
        model,
        messages: payload.messages || [],
        ...(isReasoning
          ? { max_completion_tokens: payload.max_tokens || 25000 }
          : {
              max_tokens: payload.max_tokens || 16000,
              temperature: payload.temperature !== undefined ? payload.temperature : 0.1,
              response_format: payload.response_format || { type: 'json_object' }
            })
      };

      const apiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveKey}`
        },
        body: JSON.stringify(reqBody)
      });

      if (!apiRes.ok) {
        const errData = await apiRes.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${apiRes.status}`;
        console.warn(`[Server OpenAI Proxy] ${model} failed (${apiRes.status}):`, msg);
        return sendJSON(res, apiRes.status, { error: `OpenAI [${model}]: ${msg}` });
      }

      const data = await apiRes.json();
      return sendJSON(res, 200, {
        success: true,
        modelUsed: model,
        data
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 11. Unified Moroccan Inspector AI Solver & Correction Endpoint (/api/ai/solve)
  if (pathname === '/api/ai/solve' && req.method === 'POST') {
    try {
      const payload = await getBody(req);
      const {
        content: exerciseContent,
        level = '2bac_pc_svt',
        subject = 'Mathématiques',
        language = 'ar',
        docTitle = '',
        chapterTitle = '',
        sectionTitle = '',
        docType = 'course',
        provider = 'auto',
        userPrompt: customUserPrompt,
        systemPrompt: customSystemPrompt
      } = payload;

      const cfg = readDataFile('config.json', {});
      const aiSettings = cfg?.ai_settings || {};

      let geminiKey = (
        payload.apiKey ||
        payload.geminiKey ||
        aiSettings.geminiApiKey ||
        process.env.GEMINI_API_KEY ||
        ''
      ).trim().replace(/^[\"']|[\"']$/g, '');

      let deepseekKey = (
        payload.deepseekKey ||
        aiSettings.deepseekApiKey ||
        process.env.DEEPSEEK_API_KEY ||
        ''
      ).trim().replace(/^[\"']|[\"']$/g, '');

      let deepseekUrl = (
        payload.deepseekUrl ||
        aiSettings.deepseekApiUrl ||
        'https://api.deepseek.com'
      ).trim().replace(/\/$/, '');

      let claudeKey = (
        payload.claudeKey ||
        aiSettings.claudeApiKey ||
        process.env.CLAUDE_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        ''
      ).trim().replace(/^[\"']|[\"']$/g, '');

      let openaiKey = (
        payload.openaiKey ||
        payload.apiKey ||
        aiSettings.openaiApiKey ||
        process.env.OPENAI_API_KEY ||
        ''
      ).trim().replace(/^[\"']|[\"']$/g, '');

      const candidates = [];
      if (provider === 'openai' && openaiKey) candidates.push('openai');
      else if (provider === 'gemini' && geminiKey) candidates.push('gemini');
      else if (provider === 'deepseek' && deepseekKey) candidates.push('deepseek');
      else if (provider === 'claude' && claudeKey) candidates.push('claude');
      else {
        if (openaiKey && openaiKey.length > 15) candidates.push('openai');
        if (deepseekKey && deepseekKey.length > 10) candidates.push('deepseek');
        if (geminiKey && geminiKey.length > 15) candidates.push('gemini');
        if (claudeKey && claudeKey.length > 15) candidates.push('claude');
      }

      if (candidates.length === 0) {
        return sendJSON(res, 400, {
          error: 'Aucune clé API IA valide n’est configurée sur le serveur. Veuillez renseigner une clé Google Gemini ou DeepSeek dans les Paramètres.'
        });
      }

      const isAr = language === 'ar' || /[\u0600-\u06FF]/.test(exerciseContent || customUserPrompt || '');
      const userText = customUserPrompt || (isAr
        ? `نص التمرين (${subject || 'الرياضيات'} - ${docTitle || chapterTitle || 'تمرين'} ${sectionTitle ? `| ${sectionTitle}` : ''}) :\n\n${(exerciseContent || '').trim()}\n\nالمطلوب إنجازه بدقة وإلزام :\n1. أكتب أولاً الحل الرياضي المفصل والشامل خطوة بخطوة لكل الأسئلة والأسئلة الفرعية (مع كافة الحسابات والتعليلات وتأطير النتائج النهائية بـ \\boxed{...}).\n2. أضف بعد الحل "💡 إضاءة تربوية للمفتش" كملحق ختامي.\n⛔ تحذير: كتابة خطوات الحل الرياضي المفصل والشامل لجميع الأسئلة إجبارية وأساسية!`
        : `Énoncé de l'exercice (${subject || 'Mathématiques'} - ${docTitle || chapterTitle || 'Exercice'} ${sectionTitle ? `| ${sectionTitle}` : ''}) :\n\n${(exerciseContent || '').trim()}\n\nLivrable exigé :\n1. Rédige d'abord l'intégralité du corrigé mathématique détaillé question par question (avec tous les calculs, factorisations, tableaux de signes et résultats encadrés dans \\boxed{...}).\n2. Ajoute à la suite la "💡 Remarque Pédagogique de l'Inspecteur" en fin de document.\n⛔ RAPPEL CRUCIAL : La résolution mathématique exhaustive de toutes les questions est OBLIGATOIRE et doit impérativement figurer en premier !`
      );

      const systemText = customSystemPrompt || (isAr
        ? `أنت مفتش تربوي ممتاز لمادة الرياضيات بالتعليم الثانوي التأهيلي المغربي. مهمتك تقديم حل نموذجي مفصل وشامل وفق المنهاج والتوجيهات التربوية الرسمية للمملكة المغربية. يمنع استعمال قاعدة لوبيتال في حساب النهايات.`
        : `Tu es un Inspecteur Pédagogique Principal de mathématiques du secondaire qualifiant marocain. Ta mission est de fournir un corrigé officiel détaillé, rigoureux et exhaustif conforme au programme et aux orientations pédagogiques officielles du Ministère de l'Éducation Nationale du Maroc.`
      );

      let lastError = null;

      for (const prov of candidates) {
        // 1. DeepSeek Engine
        if (prov === 'deepseek') {
          try {
            const dsRes = await fetch(`${deepseekUrl}/v1/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${deepseekKey}`
              },
              body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                  { role: 'system', content: systemText },
                  { role: 'user', content: userText }
                ],
                temperature: 0.15,
                max_tokens: 8000
              })
            });

            if (!dsRes.ok) {
              const errBody = await dsRes.json().catch(() => ({}));
              throw new Error(errBody?.error?.message || `HTTP ${dsRes.status}`);
            }

            const dsData = await dsRes.json();
            const solutionText = dsData?.choices?.[0]?.message?.content;
            if (solutionText && solutionText.trim()) {
              return sendJSON(res, 200, {
                success: true,
                solution: solutionText.trim(),
                provider: 'deepseek',
                model: 'deepseek-chat'
              });
            }
          } catch (dsErr) {
            console.warn('[Server AI Solve] DeepSeek failed:', dsErr.message);
            lastError = dsErr;
          }
        }

        // 2. Google Gemini Engine
        if (prov === 'gemini') {
          const geminiModels = [
            'gemini-3.5-flash-lite',
            'gemini-3.1-flash-lite',
            'gemini-flash-lite-latest',
            'gemini-3-flash-preview',
            'gemini-3.5-flash',
            'gemini-3.8-flash',
            'gemini-flash-latest',
            'gemini-pro-latest'
          ];

          for (const gModel of geminiModels) {
            try {
              const gEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${geminiKey}`;
              const gRes = await fetch(gEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: userText }] }],
                  systemInstruction: { parts: [{ text: systemText }] },
                  generationConfig: {
                    temperature: 0.15,
                    maxOutputTokens: 8192
                  }
                })
              });

              if (!gRes.ok) {
                const gErr = await gRes.json().catch(() => ({}));
                const gMsg = gErr?.error?.message || `HTTP ${gRes.status}`;
                if (gMsg.includes('leaked') || gRes.status === 403) {
                  throw new Error(`مفتاح Google Gemini الحالي تم حظره من طرف جوجل بسبب تسريبه (${gMsg}). يرجى إنشاء مفتاح جديد من aistudio.google.com وإدخاله في صفحة الإعدادات.`);
                }
                throw new Error(`Gemini [${gModel}]: ${gMsg}`);
              }

              const gData = await gRes.json();
              const candidate = gData?.candidates?.[0];
              const parts = (candidate?.content?.parts || []).filter(p => !p.thought);
              const solutionText = parts.map(p => p.text || '').join('').trim();
              if (solutionText) {
                return sendJSON(res, 200, {
                  success: true,
                  solution: solutionText,
                  provider: 'gemini',
                  model: gModel
                });
              }
            } catch (gErr) {
              console.warn(`[Server AI Solve] Gemini ${gModel} failed:`, gErr.message);
              lastError = gErr;
              if (gErr.message.includes('leaked')) break;
            }
          }
        }

        // 3. OpenAI Engine
        if (prov === 'openai') {
          const openaiModels = ['gpt-4o', 'gpt-4o-mini', 'o3-mini'];
          for (const oModel of openaiModels) {
            try {
              const isReasoning = oModel.startsWith('o1') || oModel.startsWith('o3');
              const oRes = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${openaiKey}`
                },
                body: JSON.stringify({
                  model: oModel,
                  messages: [
                    { role: 'system', content: systemText },
                    { role: 'user', content: userText }
                  ],
                  ...(isReasoning
                    ? { max_completion_tokens: 16000 }
                    : { max_tokens: 8192, temperature: 0.15 })
                })
              });

              if (oRes.ok) {
                const oData = await oRes.json();
                const solutionText = oData?.choices?.[0]?.message?.content;
                if (solutionText && solutionText.trim()) {
                  return sendJSON(res, 200, {
                    success: true,
                    solution: solutionText.trim(),
                    provider: 'openai',
                    model: oModel
                  });
                }
              }
            } catch (oErr) {
              console.warn(`[Server AI Solve] OpenAI ${oModel} failed:`, oErr.message);
              lastError = oErr;
            }
          }
        }
      }

      throw lastError || new Error('Impossible de résoudre l’exercice avec les moteurs IA disponibles.');
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  sendJSON(res, 404, { error: 'API route not found' });
  return true;
};

// ── Main Production Server ──────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const handled = await handleApiRequest(req, res);
  if (handled) return;

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const cleanPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const targetFile = path.join(DIST_DIR, cleanPath);
  return serveStatic(res, targetFile);
});

export { initMySQL, server };

// Immediate server.listen for Hostinger Node.js & local execution
const isVite = process.argv.some(arg => typeof arg === 'string' && arg.includes('vite'));

if (!isVite) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log('=================================================');
    console.log('🚀 Gamaco Production Server & MySQL API is online!');
    console.log(`🔌 Address: http://0.0.0.0:${PORT}`);
    console.log('=================================================');
  });

  initMySQL().catch(err => {
    console.error('[Server] MySQL initialization error:', err.message);
  });
}
