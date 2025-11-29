// server.js - Express server with SQLite for Nexa Chat
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'hexa-secret',
  resave: false,
  saveUninitialized: true
}));

// ===== DATABASE or FILE STORE SETUP =====
// If DATABASE_URL is provided, use Postgres. Otherwise, fall back to a simple
// file-based JSON store so the app can run without an external DB.
let pool = null;
let usePostgres = false;
const fs = require('fs').promises;
const STORE_FILE = path.join(__dirname, 'chat_store.json');

if (process.env.DATABASE_URL) {
  usePostgres = true;
  const connectionString = process.env.DATABASE_URL;
  // If provider requires SSL, set PG ssl option via env var DB_SSL=true
  const poolConfig = { connectionString };
  if (process.env.DB_SSL === 'true' || process.env.NODE_ENV === 'production') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
  pool = new Pool(poolConfig);

  // Verify connection and ensure table exists
  (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          chat_name TEXT NOT NULL,
          sender TEXT NOT NULL,
          text TEXT NOT NULL,
          timestamp TIMESTAMPTZ DEFAULT now()
        )
      `);
      console.log('Connected to Postgres and ensured messages table exists');
    } catch (err) {
      console.error('Error initializing Postgres DB:', err);
    }
  })();
} else {
  // Ensure store file exists
  (async () => {
    try {
      await fs.access(STORE_FILE);
    } catch (e) {
      // create initial store
      const init = { lastId: 0, messages: [] };
      await fs.writeFile(STORE_FILE, JSON.stringify(init, null, 2));
      console.log('Initialized file-based chat store at', STORE_FILE);
    }
  })();
}

// In-memory users (demo only). Do NOT use this in production.
const users = {
  vishnu: 'pass123',
  sarath: 'pass234',
  devadath: 'pass345',
  alan: 'pass456',
  abhishek: 'pass567'
};

// ===== ROUTES (must come BEFORE static file serving) =====

app.get('/', (req, res) => {
  // serve the login page (index.html)
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/login', (req, res) => {
  console.log('POST /login received', { username: req.body.username });
  const { username, password } = req.body;

  if (users[username] && users[username] === password) {
    req.session.user = username;
    console.log('Login successful for:', username);
    // Return JSON for AJAX requests; client will handle redirect
    return res.json({ ok: true, message: 'Login successful' });
  }
  console.log('Login failed for:', username);
  // Return JSON error for AJAX requests
  return res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

app.get('/chat', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  // serve the chat page (nexa_chat_app.html)
  res.sendFile(path.join(__dirname, 'nexa_chat_app.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// API endpoint to get current logged-in user
app.get('/api/current-user', (req, res) => {
  if (req.session.user) {
    return res.json({ username: req.session.user });
  }
  return res.status(401).json({ error: 'Not logged in' });
});

// API endpoint to get messages for a specific chat
app.get('/api/messages/:chatName', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  const chatName = req.params.chatName;
  console.log('GET /api/messages for', chatName, 'by', req.session.user);
  try {
    if (usePostgres) {
      const query = `SELECT id, chat_name, sender, text, timestamp FROM messages WHERE chat_name = $1 ORDER BY timestamp ASC`;
      const result = await pool.query(query, [chatName]);
      return res.json({ messages: result.rows || [] });
    }

    // File store fallback
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const store = JSON.parse(raw);
    const msgs = (store.messages || []).filter(m => m.chat_name === chatName).sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp));
    return res.json({ messages: msgs });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API endpoint to save a new message
app.post('/api/messages', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });

  const { chat_name, text } = req.body;
  const sender = req.session.user;

  if (!chat_name || !text) {
    return res.status(400).json({ error: 'Missing chat_name or text' });
  }
  const query = `INSERT INTO messages (chat_name, sender, text) VALUES ($1, $2, $3) RETURNING id, chat_name, sender, text, timestamp`;
  try {
    if (usePostgres) {
      const result = await pool.query(query, [chat_name, sender, text]);
      console.log('Saved message (pg)', { chat_name, sender, id: result.rows[0].id });
      return res.json({ ok: true, message: 'Message saved', messageRow: result.rows[0] });
    }

    // File store fallback: read, append, write
    const raw = await fs.readFile(STORE_FILE, 'utf8');
    const store = JSON.parse(raw);
    const nextId = (store.lastId || 0) + 1;
    const now = new Date().toISOString();
    const messageRow = { id: nextId, chat_name, sender, text, timestamp: now };
    store.lastId = nextId;
    store.messages = store.messages || [];
    store.messages.push(messageRow);
    await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2));
    console.log('Saved message (file)', { chat_name, sender, id: nextId });
    return res.json({ ok: true, message: 'Message saved', messageRow });
  } catch (err) {
    console.error('Error saving message:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Debug endpoint to check session and DB connectivity
app.get('/api/debug', async (req, res) => {
  const sessionUser = req.session ? req.session.user : null;
  let dbOk = false;
  let dbError = null;
  try {
    if (usePostgres) {
      const r = await pool.query('SELECT 1');
      if (r && r.rowCount === 1) dbOk = true;
    } else {
      // file store exists?
      try {
        await fs.access(STORE_FILE);
        dbOk = true;
      } catch (e) {
        dbOk = false;
        dbError = 'File store not accessible';
      }
    }
  } catch (err) {
    dbError = err.message || String(err);
  }
  res.json({ sessionUser, dbOk, dbError, mode: usePostgres ? 'postgres' : 'file' });
});

// ===== STATIC FILES (after routes so routes take priority) =====
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
