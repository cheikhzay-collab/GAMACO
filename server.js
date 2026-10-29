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

// ── JSON Memory Cache & File Helpers (Fallback Storage) ─────────────────────
const memoryCache = new Map();
const pendingWrites = new Map();

const readDataFile = (fileName, defaultValue = []) => {
  if (memoryCache.has(fileName)) {
    return memoryCache.get(fileName);
  }
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
    } catch (_) {}
    memoryCache.set(fileName, defaultValue);
    return defaultValue;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content);
    memoryCache.set(fileName, parsed);
    return parsed;
  } catch (err) {
    console.error(`[Server] Error reading ${fileName}:`, err.message);
    memoryCache.set(fileName, defaultValue);
    return defaultValue;
  }
};

const writeDataFile = (fileName, data) => {
  memoryCache.set(fileName, data);
  const filePath = path.join(DATA_DIR, fileName);
  if (pendingWrites.has(fileName)) {
    clearTimeout(pendingWrites.get(fileName));
  }
  const timer = setTimeout(() => {
    pendingWrites.delete(fileName);
    try {
      fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8', (err) => {
        if (err) console.error(`[Server] Error writing ${fileName}:`, err.message);
      });
    } catch (err) {
      console.error(`[Server] Error writing ${fileName}:`, err.message);
    }
  }, 100);
  pendingWrites.set(fileName, timer);
};

// ── MySQL Connection & Management ───────────────────────────────────────────
let dbPool = null;
let isMySqlActive = false;

const initMySQL = async () => {
  const host = process.env.DB_HOST;
  const port = parseInt(process.env.DB_PORT || '3306', 10);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;
  const database = process.env.DB_NAME;

  const isRemoteHost = host && host !== '127.0.0.1' && host !== 'localhost';

  if (!isRemoteHost || !user || !database) {
    console.log('[Server] Using resilient JSON file storage mode.');
    isMySqlActive = false;
    return;
  }

  try {
    const mysqlModule = await import('mysql2/promise').catch(() => null);
    const mysql = mysqlModule ? (mysqlModule.default || mysqlModule) : null;
    if (!mysql) {
      console.log('[Server] mysql2 module not installed yet. Running in JSON file storage mode.');
      return;
    }

    dbPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4'
    });

    // Test connection
    const connection = await dbPool.getConnection();
    console.log(`[Server] Connected to MySQL database "${database}" on ${host}:${port}`);

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

    // Auto-seed if tables are empty
    const [[{ examCount }]] = await connection.query('SELECT COUNT(*) as examCount FROM tbl_exams');
    if (examCount === 0) {
      console.log('[Server] Seeding MySQL tbl_exams from data/exams.json...');
      const exams = readDataFile('exams.json', []);
      for (const ex of exams) {
        if (ex.id) {
          await connection.query('INSERT IGNORE INTO tbl_exams (id, data) VALUES (?, ?)', [ex.id, JSON.stringify(ex)]);
        }
      }
    }

    const [[{ lessonCount }]] = await connection.query('SELECT COUNT(*) as lessonCount FROM tbl_lessons');
    if (lessonCount === 0) {
      console.log('[Server] Seeding MySQL tbl_lessons from data/lessons.json...');
      const lessons = readDataFile('lessons.json', []);
      for (const l of lessons) {
        if (l.id) {
          await connection.query(
            'INSERT IGNORE INTO tbl_lessons (id, title, subject, level, data) VALUES (?, ?, ?, ?, ?)',
            [l.id, l.title || '', l.subject || '', l.level || '', JSON.stringify(l)]
          );
        }
      }
    }

    const [[{ classCount }]] = await connection.query('SELECT COUNT(*) as classCount FROM tbl_classes');
    if (classCount === 0) {
      console.log('[Server] Seeding MySQL tbl_classes from data/classes.json...');
      const classes = readDataFile('classes.json', []);
      for (const c of classes) {
        if (c.id) {
          await connection.query('INSERT IGNORE INTO tbl_classes (id, name, data) VALUES (?, ?, ?)', [c.id, c.name || '', JSON.stringify(c)]);
        }
      }
    }

    const [[{ userCount }]] = await connection.query('SELECT COUNT(*) as userCount FROM tbl_users');
    if (userCount === 0) {
      console.log('[Server] Seeding MySQL tbl_users from data/users.json...');
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
    }

    connection.release();
    isMySqlActive = true;
  } catch (err) {
    console.log('[Server] Note: Database running in resilient JSON storage mode.');
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
        } else {
          const exams = readDataFile('exams.json', []);
          const idx = exams.findIndex(e => e.id === exam.id);
          if (idx > -1) exams[idx] = { ...exams[idx], ...exam };
          else exams.push(exam);
          writeDataFile('exams.json', exams);
        }
        return sendJSON(res, 200, { success: true, exam });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = parsedUrl.searchParams.get('id');
      if (isMySqlActive) {
        await dbPool.query('DELETE FROM tbl_exams WHERE id = ?', [id]);
      } else {
        const exams = readDataFile('exams.json', []).filter(e => e.id !== id);
        writeDataFile('exams.json', exams);
      }
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
        } else {
          const lessons = readDataFile('lessons.json', []);
          const idx = lessons.findIndex(l => l.id === targetId);
          if (idx > -1) lessons[idx] = { ...lessons[idx], ...lesson };
          else lessons.push(lesson);
          writeDataFile('lessons.json', lessons);
        }
        return sendJSON(res, 200, { success: true, lesson });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = singleId || parsedUrl.searchParams.get('id');
      if (isMySqlActive) {
        await dbPool.query('DELETE FROM tbl_lessons WHERE id = ?', [id]);
      } else {
        const lessons = readDataFile('lessons.json', []).filter(l => l.id !== id);
        writeDataFile('lessons.json', lessons);
      }
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
        } else {
          const classes = readDataFile('classes.json', []);
          const idx = classes.findIndex(c => c.id === cls.id);
          if (idx > -1) classes[idx] = { ...classes[idx], ...cls };
          else classes.push(cls);
          writeDataFile('classes.json', classes);
        }
        return sendJSON(res, 200, { success: true, class: cls });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = singleId || parsedUrl.searchParams.get('id');
      if (isMySqlActive) {
        await dbPool.query('DELETE FROM tbl_classes WHERE id = ?', [id]);
      } else {
        const classes = readDataFile('classes.json', []).filter(c => c.id !== id);
        writeDataFile('classes.json', classes);
      }
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
        } else {
          const users = readDataFile('users.json', []);
          const idx = users.findIndex(u => u.id === id || u.uid === id);
          if (idx > -1) users[idx] = { ...users[idx], ...userObj };
          else users.push(userObj);
          writeDataFile('users.json', users);
        }
        return sendJSON(res, 200, { success: true, user: userObj });
      } catch (err) {
        return sendJSON(res, 500, { error: err.message });
      }
    }

    if (req.method === 'DELETE') {
      const id = singleId || parsedUrl.searchParams.get('id');
      if (isMySqlActive) {
        await dbPool.query('DELETE FROM tbl_users WHERE id = ?', [id]);
      } else {
        const users = readDataFile('users.json', []).filter(u => u.id !== id && u.uid !== id);
        writeDataFile('users.json', users);
      }
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

      let requestedModel = (payload?.model || 'gemini-3.1-flash-lite').trim();
      if (['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-2.5-pro', 'gemini-2.5-flash-lite', '3.7', 'gemini-3.7', 'gemini-3.7-flash', '3.5'].includes(requestedModel)) {
        requestedModel = 'gemini-3.1-flash-lite';
      }

      const cascade = Array.from(new Set([
        requestedModel,
        'gemini-3.1-flash-lite',
        'gemini-3.5-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest'
      ]));

      let lastError = null;
      for (const modelToTry of cascade) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTry}:generateContent?key=${effectiveKey}`;
          const bodyPayload = {
            contents: payload.contents,
            systemInstruction: payload.systemInstruction,
            generationConfig: payload.generationConfig || {
              responseMimeType: "application/json",
              maxOutputTokens: 8192,
              temperature: 0.1
            }
          };

          const apiRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload)
          });

          if (!apiRes.ok) {
            const errData = await apiRes.json().catch(() => ({}));
            const msg = errData?.error?.message || `HTTP ${apiRes.status}`;
            console.warn(`[Server Gemini Proxy] Model ${modelToTry} failed (${apiRes.status}): ${msg}`);
            if (apiRes.status === 404 || apiRes.status === 429 || apiRes.status === 503 || apiRes.status === 400) {
              lastError = new Error(`Gemini [${modelToTry}]: ${msg} (key: "${effectiveKey.slice(0, 6)}..." len: ${effectiveKey.length})`);
              continue;
            }
            throw new Error(`Gemini [${modelToTry}]: ${msg} (key: "${effectiveKey.slice(0, 6)}..." len: ${effectiveKey.length})`);
          }

          const data = await apiRes.json();
          return sendJSON(res, 200, {
            success: true,
            modelUsed: modelToTry,
            data
          });
        } catch (callErr) {
          lastError = callErr;
        }
      }

      throw lastError || new Error(`Tous les modèles Gemini de secours ont échoué (clé len: ${effectiveKey.length}, début: ${effectiveKey.slice(0, 8)}).`);
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
