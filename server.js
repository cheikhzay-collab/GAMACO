import http from 'http';
import fs from 'fs';
import path from 'path';
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

    // Create tables if they do not exist
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_exams (
        id VARCHAR(64) PRIMARY KEY,
        data JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_lessons (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255),
        subject VARCHAR(100),
        level VARCHAR(50),
        data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_classes (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255),
        data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'student',
        tier VARCHAR(50) DEFAULT 'freemium',
        data JSON NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_config (
        key_name VARCHAR(64) PRIMARY KEY,
        value JSON NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_assets (
        asset_path VARCHAR(255) PRIMARY KEY,
        data LONGTEXT NOT NULL,
        mime_type VARCHAR(100) DEFAULT 'image/png',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Synchronize Lessons: seed from file if not in DB, AND dump DB back to file
    const lessons = readDataFile('lessons.json', []);
    for (const l of lessons) {
      if (l.id) {
        await connection.query(
          'INSERT IGNORE INTO tbl_lessons (id, title, subject, level, data) VALUES (?, ?, ?, ?, ?)',
          [l.id, l.title || '', l.subject || '', l.level || '', JSON.stringify(l)]
        );
      }
    }
    const [dbLessonRows] = await connection.query('SELECT data FROM tbl_lessons ORDER BY updated_at DESC');
    if (dbLessonRows.length > 0) {
      const allDbLessons = dbLessonRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
      writeDataFile('lessons.json', allDbLessons);
      console.log(`[Server] Synced ${allDbLessons.length} lessons from MySQL database.`);
    }

    // Synchronize Exams
    const exams = readDataFile('exams.json', []);
    for (const ex of exams) {
      if (ex.id) {
        await connection.query('INSERT IGNORE INTO tbl_exams (id, data) VALUES (?, ?)', [ex.id, JSON.stringify(ex)]);
      }
    }
    const [dbExamRows] = await connection.query('SELECT data FROM tbl_exams ORDER BY updated_at DESC');
    if (dbExamRows.length > 0) {
      const allDbExams = dbExamRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
      writeDataFile('exams.json', allDbExams);
      console.log(`[Server] Synced ${allDbExams.length} exams from MySQL database.`);
    }

    // Synchronize Classes
    const classes = readDataFile('classes.json', []);
    for (const c of classes) {
      if (c.id) {
        await connection.query('INSERT IGNORE INTO tbl_classes (id, name, data) VALUES (?, ?, ?)', [c.id, c.name || '', JSON.stringify(c)]);
      }
    }
    const [dbClassRows] = await connection.query('SELECT data FROM tbl_classes ORDER BY updated_at DESC');
    if (dbClassRows.length > 0) {
      const allDbClasses = dbClassRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
      writeDataFile('classes.json', allDbClasses);
    }

    // Synchronize Users
    const users = readDataFile('users.json', []);
    for (const u of users) {
      const id = u.id || u.uid;
      if (id) {
        await connection.query(
          'INSERT IGNORE INTO tbl_users (id, email, password, role, tier, data) VALUES (?, ?, ?, ?, ?, ?)',
          [id, u.email || `${id}@local.user`, u.password || 'student123', u.role || 'student', u.tier || 'freemium', JSON.stringify(u)]
        );
      }
    }
    const [dbUserRows] = await connection.query('SELECT data FROM tbl_users ORDER BY updated_at DESC');
    if (dbUserRows.length > 0) {
      const allDbUsers = dbUserRows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
      writeDataFile('users.json', allDbUsers);
    }

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
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

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
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const { email, password } = await getBody(req);
      const cleanEmail = (email || '').toLowerCase().trim();
      const adminEmail = (process.env.ADMIN_EMAIL || 'admin@lconq.ma').toLowerCase().trim();
      const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

      if (cleanEmail === adminEmail && password === adminPass) {
        return sendJSON(res, 200, {
          user: {
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
          },
          token: 'token-admin-gamaco'
        });
      }

      // Check in MySQL or JSON
      let user = null;
      if (isMySqlActive) {
        const [rows] = await dbPool.query('SELECT * FROM tbl_users WHERE email = ?', [cleanEmail]);
        if (rows.length > 0) {
          const row = rows[0];
          if (row.password === password) {
            user = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          }
        }
      } else {
        const users = readDataFile('users.json', []);
        const found = users.find(u => (u.email || '').toLowerCase().trim() === cleanEmail);
        if (found && (found.password === password || !found.password)) {
          user = found;
        }
      }

      if (!user) {
        return sendJSON(res, 401, { error: 'Identifiants incorrects' });
      }

      const uid = user.id || user.uid;
      return sendJSON(res, 200, {
        user: {
          uid,
          id: uid,
          name: user.name || 'Élève',
          email: user.email,
          role: user.role || 'student',
          tier: user.tier || 'freemium',
          xp: user.xp || 0,
          streak: user.streak || 0,
          rank: user.rank || null,
          totalStudents: user.totalStudents || 1200,
          subscription: user.subscription || null,
          classId: user.classId || null,
          school: user.school || null
        },
        token: `token-${uid}`
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/auth/register' && req.method === 'POST') {
    try {
      const { name, email, password } = await getBody(req);
      const cleanEmail = (email || '').toLowerCase().trim();
      const uid = 'usr_' + Math.random().toString(36).substring(2, 11);

      const newUser = {
        id: uid,
        uid,
        name: name || 'Élève',
        email: cleanEmail,
        password,
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
        await dbPool.query(
          'INSERT INTO tbl_users (id, email, password, role, tier, data) VALUES (?, ?, ?, ?, ?, ?)',
          [uid, cleanEmail, password, 'student', 'freemium', JSON.stringify(newUser)]
        );
      } else {
        const users = readDataFile('users.json', []);
        users.push(newUser);
        writeDataFile('users.json', users);
      }

      return sendJSON(res, 200, { user: newUser, token: `token-${uid}` });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 3. Exams Endpoints
  if (pathname === '/api/exams') {
    if (req.method === 'GET') {
      if (isMySqlActive) {
        const [rows] = await dbPool.query('SELECT data FROM tbl_exams ORDER BY updated_at DESC');
        const exams = rows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
        return sendJSON(res, 200, exams);
      }
      return sendJSON(res, 200, readDataFile('exams.json', []));
    }

    if (req.method === 'POST') {
      try {
        const exam = await getBody(req);
        if (!exam.id) exam.id = Math.random().toString(36).substring(2, 11).toUpperCase();
        exam.updatedAt = new Date().toISOString();

        if (isMySqlActive) {
          await dbPool.query(
            'INSERT INTO tbl_exams (id, data) VALUES (?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), updated_at = NOW()',
            [exam.id, JSON.stringify(exam)]
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
        const [rows] = await dbPool.query('SELECT data FROM tbl_exams WHERE id = ?', [id]);
        if (rows.length > 0) {
          const ex = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
          return sendJSON(res, 200, ex);
        }
      } else {
        const exams = readDataFile('exams.json', []);
        const found = exams.find(e => e.id === id);
        if (found) return sendJSON(res, 200, found);
      }
      return sendJSON(res, 404, { error: 'Exam not found' });
    }
  }

  // 4. Lessons Endpoints
  if (pathname === '/api/lessons' || pathname.startsWith('/api/lessons/')) {
    const singleId = pathname.startsWith('/api/lessons/') ? pathname.replace('/api/lessons/', '').trim() : null;

    if (req.method === 'GET') {
      if (singleId) {
        if (isMySqlActive) {
          const [rows] = await dbPool.query('SELECT data FROM tbl_lessons WHERE id = ?', [singleId]);
          if (rows.length > 0) {
            const lesson = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
            return sendJSON(res, 200, lesson);
          }
        } else {
          const lessons = readDataFile('lessons.json', []);
          const found = lessons.find(l => l.id === singleId);
          if (found) return sendJSON(res, 200, found);
        }
        return sendJSON(res, 404, { error: 'Lesson not found' });
      }

      if (isMySqlActive) {
        const [rows] = await dbPool.query('SELECT data FROM tbl_lessons ORDER BY updated_at DESC');
        const lessons = rows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
        return sendJSON(res, 200, lessons);
      }
      return sendJSON(res, 200, readDataFile('lessons.json', []));
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const lesson = await getBody(req);
        const targetId = singleId || lesson.id || ('MOCK-L-' + Math.random().toString(36).substring(2, 11).toUpperCase());
        lesson.id = targetId;
        lesson.updatedAt = new Date().toISOString();

        if (isMySqlActive) {
          await dbPool.query(
            'INSERT INTO tbl_lessons (id, title, subject, level, data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE title = VALUES(title), subject = VALUES(subject), level = VALUES(level), data = VALUES(data), updated_at = NOW()',
            [targetId, lesson.title || '', lesson.subject || '', lesson.level || '', JSON.stringify(lesson)]
          );
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
          const [rows] = await dbPool.query('SELECT data FROM tbl_classes WHERE id = ?', [singleId]);
          if (rows.length > 0) {
            const cls = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
            return sendJSON(res, 200, cls);
          }
        } else {
          const classes = readDataFile('classes.json', []);
          const found = classes.find(c => c.id === singleId);
          if (found) return sendJSON(res, 200, found);
        }
        return sendJSON(res, 404, { error: 'Class not found' });
      }

      if (isMySqlActive) {
        const [rows] = await dbPool.query('SELECT data FROM tbl_classes ORDER BY updated_at DESC');
        const classes = rows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
        return sendJSON(res, 200, classes);
      }
      return sendJSON(res, 200, readDataFile('classes.json', []));
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

  // 6. Users Endpoints
  if (pathname === '/api/users' || pathname.startsWith('/api/users/')) {
    const singleId = pathname.startsWith('/api/users/') ? pathname.replace('/api/users/', '').trim() : null;

    if (req.method === 'GET') {
      if (singleId) {
        if (isMySqlActive) {
          const [rows] = await dbPool.query('SELECT data FROM tbl_users WHERE id = ?', [singleId]);
          if (rows.length > 0) {
            const u = typeof rows[0].data === 'string' ? JSON.parse(rows[0].data) : rows[0].data;
            return sendJSON(res, 200, u);
          }
        } else {
          const users = readDataFile('users.json', []);
          const found = users.find(u => u.id === singleId || u.uid === singleId);
          if (found) return sendJSON(res, 200, found);
        }
        return sendJSON(res, 404, { error: 'User not found' });
      }

      if (isMySqlActive) {
        const [rows] = await dbPool.query('SELECT data FROM tbl_users ORDER BY updated_at DESC');
        const users = rows.map(r => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);
        return sendJSON(res, 200, users);
      }
      return sendJSON(res, 200, readDataFile('users.json', []));
    }

    if (req.method === 'POST') {
      try {
        const userObj = await getBody(req);
        const id = userObj.id || userObj.uid || ('usr_' + Math.random().toString(36).substring(2, 11));
        userObj.id = id;
        userObj.uid = id;
        userObj.updatedAt = new Date().toISOString();

        if (isMySqlActive) {
          await dbPool.query(
            'INSERT INTO tbl_users (id, email, role, tier, data) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE email = VALUES(email), role = VALUES(role), tier = VALUES(tier), data = VALUES(data), updated_at = NOW()',
            [id, userObj.email || `${id}@local.user`, userObj.role || 'student', userObj.tier || 'freemium', JSON.stringify(userObj)]
          );
        }
        const users = readDataFile('users.json', []);
        const idx = users.findIndex(u => u.id === id || u.uid === id);
        if (idx > -1) users[idx] = { ...users[idx], ...userObj };
        else users.unshift(userObj);
        writeDataFile('users.json', users);
        return sendJSON(res, 200, { success: true, user: userObj });
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
      if (isMySqlActive) {
        const [rows] = await dbPool.query('SELECT key_name, value FROM tbl_config');
        const config = {};
        for (const row of rows) {
          config[row.key_name] = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        }
        return sendJSON(res, 200, config);
      }
      return sendJSON(res, 200, readDataFile('config.json', {}));
    }

    if (req.method === 'POST') {
      try {
        const payload = await getBody(req);
        if (isMySqlActive) {
          for (const [k, v] of Object.entries(payload)) {
            await dbPool.query(
              'INSERT INTO tbl_config (key_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()',
              [k, JSON.stringify(v)]
            );
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

      let requestedModel = (payload?.model || 'gemini-2.5-flash').trim().replace(/^models\//, '');
      if (!requestedModel || ['gemini-3.1-flash-lite', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest', '3.7', '3.5'].includes(requestedModel)) {
        requestedModel = 'gemini-2.5-flash';
      }

      const cascade = Array.from(new Set([
        requestedModel,
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-2.5-pro',
        'gemini-flash-latest',
        'gemini-pro-latest',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite',
        'gemini-1.5-pro',
        'gemini-1.5-flash'
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

      const candidates = [];
      if (provider === 'gemini' && geminiKey) candidates.push('gemini');
      else if (provider === 'deepseek' && deepseekKey) candidates.push('deepseek');
      else if (provider === 'claude' && claudeKey) candidates.push('claude');
      else {
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
            'gemini-2.5-flash',
            'gemini-2.5-pro',
            'gemini-2.5-flash-lite',
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
