const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const db = new sqlite3.Database('./backstage_local.db');

// ========== ИНИЦИАЛИЗАЦИЯ ТАБЛИЦ ==========
db.run(`CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  created_by TEXT,
  used_by TEXT,
  used_at INTEGER,
  created_at INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  password_hash TEXT,
  name TEXT,
  instruments TEXT,
  city TEXT,
  about TEXT,
  created_at INTEGER,
  reset_token TEXT,
  reset_token_expires INTEGER
)`);

db.run(`CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT,
  title TEXT,
  description TEXT,
  tags TEXT,
  created_at INTEGER,
  status TEXT
)`);

// Мастер-инвайт
db.get("SELECT * FROM invites WHERE code = 'BACKSTAGE2026'", (err, row) => {
  if (!row) {
    db.run("INSERT INTO invites (code, created_by, created_at) VALUES ('BACKSTAGE2026', 'system', ?)", [Date.now()]);
    console.log('✅ Мастер-инвайт создан');
  }
});

// ========== API ИНВАЙТОВ ==========
app.get('/api/invites', (req, res) => {
  db.all("SELECT * FROM invites", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/invites', (req, res) => {
  const { code, created_by } = req.body;
  db.run("INSERT INTO invites (code, created_by, created_at) VALUES (?, ?, ?)", 
    [code, created_by, Date.now()], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, code });
    }
  );
});

app.put('/api/invites/:code/use', (req, res) => {
  const { code } = req.params;
  const { used_by } = req.body;
  db.run("UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?", 
    [used_by, Date.now(), code], 
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

// ========== API ПОЛЬЗОВАТЕЛЕЙ ==========
app.get('/api/users', (req, res) => {
  db.all("SELECT id, email, name, instruments, city, about, genres, rating, created_at FROM users", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.get("SELECT id, email, name, instruments, city, about, genres, rating, created_at FROM users WHERE id = ?", [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(row);
  });
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { name, instruments, city, about, genres } = req.body;
  db.run("UPDATE users SET name = ?, instruments = ?, city = ?, about = ?, genres = ? WHERE id = ?",
    [name, instruments || '', city || '', about || '', genres || '', id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
      res.json({ success: true });
    }
  );
});

// ========== API ПОСТОВ ==========
app.get('/api/posts', (req, res) => {
  db.all("SELECT * FROM posts WHERE status = 'active' ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/posts', (req, res) => {
  const { id, user_id, type, title, description, tags, created_at, status } = req.body;
  db.run("INSERT INTO posts (id, user_id, type, title, description, tags, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [id, user_id, type, title, description, tags, created_at, status],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.put('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, tags } = req.body;
  db.run("UPDATE posts SET title = ?, description = ?, tags = ? WHERE id = ?",
    [title, description, JSON.stringify(tags), id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Пост не найден' });
      res.json({ success: true });
    }
  );
});

app.delete('/api/posts/:id', (req, res) => {
  const { id } = req.params;
  db.run("UPDATE posts SET status = 'deleted' WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ========== АУТЕНТИФИКАЦИЯ ==========
// Вставь этот эндпоинт вместо старого /api/register

app.post('/api/register', async (req, res) => {
  const { email, password, name, inviteCode, instruments, city, about, genres } = req.body;
  
  if (!email || !password || !name || !inviteCode) {
    return res.status(400).json({ error: 'Email, пароль, имя и инвайт-код обязательны' });
  }
  
  db.get("SELECT * FROM invites WHERE code = ? AND used_by IS NULL", [inviteCode], async (err, invite) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!invite) {
      return res.status(400).json({ error: 'Неверный или уже использованный инвайт-код' });
    }
    
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    const userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    
    db.run(`INSERT INTO users (id, email, password_hash, name, instruments, city, about, genres, rating, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, email, password_hash, name, instruments || '', city || '', about || '', genres || '', 0, Date.now()],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Email уже зарегистрирован' });
          }
          return res.status(500).json({ error: err.message });
        }
        
        db.run("UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?",
          [userId, Date.now(), inviteCode]);
        
        res.json({ success: true, userId, user: { id: userId, email, name, instruments, city, about, genres, rating: 0 } });
      });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Введите email и пароль' });
  }
  
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
    
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Неверный email или пароль' });
    
    const { password_hash, reset_token, reset_token_expires, ...safeUser } = user;
    res.json({ success: true, user: safeUser });
  });
});

app.post('/api/forgot-password', (req, res) => {
  const { email } = req.body;
  
  db.get("SELECT id FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) {
      return res.json({ success: true, message: 'Если email существует, ссылка отправлена' });
    }
    
    const reset_token = crypto.randomBytes(32).toString('hex');
    const reset_token_expires = Date.now() + 3600000;
    
    db.run("UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
      [reset_token, reset_token_expires, user.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({ 
          success: true, 
          reset_token,
          message: 'Ссылка для восстановления отправлена' 
        });
      });
  });
});

app.post('/api/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Необходим токен и новый пароль' });
  }
  
  db.get("SELECT id FROM users WHERE reset_token = ? AND reset_token_expires > ?",
    [token, Date.now()], async (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(400).json({ error: 'Неверный или просроченный токен' });
      
      const password_hash = await bcrypt.hash(newPassword, 10);
      
      db.run("UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
        [password_hash, user.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true });
        });
    });
});

// Повысить рейтинг пользователя (после успешного проекта)
app.post('/api/users/:id/rate', (req, res) => {
  const { id } = req.params;
  console.log(`⭐ Повышение рейтинга пользователя: ${id}`);
  
  db.run("UPDATE users SET rating = rating + 1 WHERE id = ?", [id], function(err) {
    if (err) {
      console.error('Ошибка обновления рейтинга:', err);
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    // Получаем новый рейтинг
    db.get("SELECT rating FROM users WHERE id = ?", [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, newRating: row.rating });
    });
  });
});

app.listen(port, () => {
  console.log(`🚀 Локальный сервер: http://localhost:${port}`);
  console.log(`📁 Открывай index.html`);
});
