const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// WebSocket события
io.on('connection', (socket) => {
  console.log('🔌 Новое подключение:', socket.id);
  
  socket.on('join-room', (roomId, userId, userName) => {
    // ✅ Сохраняем userId в сокете
    socket.userId = userId;
    socket.userName = userName;
    
    socket.join(roomId);
    console.log(`📡 ${userName} (${userId}) присоединился к комнате ${roomId}`);
    
    db.run(`UPDATE live_rooms SET listeners_count = listeners_count + 1 WHERE id = ?`, [roomId]);
    io.to(roomId).emit('user-joined', { userId, userName, timestamp: Date.now() });
  });
  
  socket.on('leave-room', (roomId, userId, userName) => {
    socket.leave(roomId);
    console.log(`📡 ${userName} (${userId}) покинул комнату ${roomId}`);
    
    db.run(`UPDATE live_rooms SET listeners_count = listeners_count - 1 WHERE id = ?`, [roomId]);
    io.to(roomId).emit('user-left', { userId, userName, timestamp: Date.now() });
  });
  
  socket.on('chat-message', (data) => {
    io.to(data.roomId).emit('new-chat-message', data);
  });
  
  socket.on('donation', (data) => {
    io.to(data.roomId).emit('new-donation', data);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 Отключение:', socket.id);
  });

  // WebRTC сигнализация
  socket.on('webrtc-offer', ({ roomId, signal, targetId }) => {
    console.log(`📡 WebRTC offer от ${socket.userId || 'unknown'} в комнату ${roomId}`);
    socket.to(roomId).emit('webrtc-offer', { signal, from: socket.userId });
  });
  
  socket.on('webrtc-answer', ({ roomId, signal, targetId }) => {
    console.log(`📡 WebRTC answer от ${socket.userId} в комнату ${roomId} для ${targetId}`);
    socket.to(roomId).emit('webrtc-answer', { signal, from: socket.userId, targetId });
  });
  
  socket.on('webrtc-ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('webrtc-ice-candidate', { candidate, from: socket.userId });
  });
  
  // ⭐ Ученик запрашивает offer — пересылаем учителю
  socket.on('request-offer', ({ roomId }) => {
    console.log(`📡 Ученик ${socket.userId} запросил offer в комнате ${roomId}`);
    // Отправляем событие всем в комнате, кроме отправителя
    socket.to(roomId).emit('student-requested-offer', { from: socket.userId });
  });
  
  // Запрос на трансляцию (хост начинает вещать)
  socket.on('start-broadcast', (roomId) => {
    console.log(`🎙️ Хост ${socket.userId} начал трансляцию в комнате ${roomId}`);
    socket.to(roomId).emit('broadcast-started');
  });
  
  // Остановка трансляции
  socket.on('stop-broadcast', (roomId) => {
    console.log(`🔇 Хост ${socket.userId} остановил трансляцию в комнате ${roomId}`);
    socket.to(roomId).emit('broadcast-stopped');
  });

  socket.on('request-offer', ({ roomId }) => {
    console.log(`📡 Ученик ${socket.userId} запросил offer в комнате ${roomId}`);
    socket.to(roomId).emit('student-requested-offer', { from: socket.userId });
  });
});

// Запускаем проверку каждые 5 минут
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  db.run(`
    UPDATE live_rooms 
    SET status = 'ended', ended_at = ? 
    WHERE status = 'live' 
    AND started_at < ?
    AND (SELECT COUNT(*) FROM room_participants WHERE room_id = live_rooms.id) = 0
  `, [Date.now(), oneHourAgo], (err) => {
    if (!err) console.log('🧹 Очистка старых комнат выполнена');
  });
}, 5 * 60 * 1000);

// ========== НАСТРОЙКА ЗАГРУЗКИ АУДИО ==========
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.random().toString(36).substring(2, 8) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB для демо-постов
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/mpeg') {
      cb(null, true);
    } else {
      cb(new Error('Только MP3 файлы'));
    }
  }
});

// Отдельный загрузчик для товаров (большие файлы)
const productUpload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB для товаров
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'audio/mpeg' || file.mimetype === 'audio/wav') {
      cb(null, true);
    } else {
      cb(new Error('Только MP3 или WAV файлы'));
    }
  }
});

// Раздача статики из папки uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ========== БАЗА ДАННЫХ ==========
const db = new sqlite3.Database('./backstage_local.db');

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
  genres TEXT,
  rating INTEGER DEFAULT 0,
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
  audio_url TEXT,
  created_at INTEGER,
  status TEXT
)`);

// ===== ТАБЛИЦЫ ДЛЯ ТАЙМКОД-КОММЕНТАРИЕВ =====
db.run(`CREATE TABLE IF NOT EXISTS timeline_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  timestamp_seconds REAL NOT NULL,
  comment_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS comment_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(comment_id, user_id)
)`);

// Таблица подписок
db.run(`CREATE TABLE IF NOT EXISTS follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id TEXT NOT NULL,
  following_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(follower_id, following_id)
)`);

// Таблица публичных обсуждений постов
db.run(`CREATE TABLE IF NOT EXISTS post_discussions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);
console.log('✅ Таблица post_discussions готова');

// ===== ТАБЛИЦЫ ДЛЯ АУДИО-КОМНАТ =====

// Комнаты (концерты/трансляции)
db.run(`CREATE TABLE IF NOT EXISTS live_rooms (
  id TEXT PRIMARY KEY,
  host_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'waiting', -- waiting, live, ended
  started_at INTEGER,
  ended_at INTEGER,
  listeners_count INTEGER DEFAULT 0,
  FOREIGN KEY (host_id) REFERENCES users(id)
)`);

// Участники комнат
db.run(`CREATE TABLE IF NOT EXISTS room_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT DEFAULT 'listener', -- host, speaker, listener
  joined_at INTEGER,
  left_at INTEGER,
  FOREIGN KEY (room_id) REFERENCES live_rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// Сообщения чата в комнате
db.run(`CREATE TABLE IF NOT EXISTS room_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES live_rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
)`);

// Донаты
db.run(`CREATE TABLE IF NOT EXISTS room_donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  message TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES live_rooms(id),
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id)
)`);

console.log('✅ Таблицы для аудио-комнат готовы');

// Таблица видео-звонков (временные комнаты)
db.run(`CREATE TABLE IF NOT EXISTS video_calls (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL,
  participant_id TEXT NOT NULL,
  created_at INTEGER,
  status TEXT DEFAULT 'active',
  FOREIGN KEY (creator_id) REFERENCES users(id),
  FOREIGN KEY (participant_id) REFERENCES users(id)
)`);
console.log('✅ Таблица video_calls готова');

// Таблица сообщений (личные чаты)
db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id TEXT NOT NULL,
  to_user_id TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (from_user_id) REFERENCES users(id),
  FOREIGN KEY (to_user_id) REFERENCES users(id)
)`);
console.log('✅ Таблица messages готова');


// Добавляем счётчики в users (если нет)
db.all("PRAGMA table_info(users)", (err, columns) => {
  if (err) return console.error(err);
  const columnNames = columns.map(c => c.name);
  if (!columnNames.includes('followers_count')) {
    db.run("ALTER TABLE users ADD COLUMN followers_count INTEGER DEFAULT 0");
    console.log('✅ Добавлена колонка followers_count');
  }
  if (!columnNames.includes('following_count')) {
    db.run("ALTER TABLE users ADD COLUMN following_count INTEGER DEFAULT 0");
    console.log('✅ Добавлена колонка following_count');
  }
});

console.log('✅ Таблицы timeline_comments и comment_likes готовы');

// Автоматическое добавление колонок, если их нет
db.all("PRAGMA table_info(posts)", (err, columns) => {
  if (err) return console.error(err);
  const columnNames = columns.map(c => c.name);
  if (!columnNames.includes('audio_url')) {
    db.run("ALTER TABLE posts ADD COLUMN audio_url TEXT");
    console.log('✅ Добавлена колонка audio_url');
  }
});

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
  db.all("SELECT id, email, name, instruments, city, about, genres, rating, created_at, followers_count, following_count FROM users", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  db.get("SELECT id, email, name, instruments, city, about, genres, rating, created_at, followers_count, following_count FROM users WHERE id = ?", [id], (err, row) => {
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

app.post('/api/users/:id/rate', (req, res) => {
  const { id } = req.params;
  db.run("UPDATE users SET rating = rating + 1 WHERE id = ?", [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    db.get("SELECT rating FROM users WHERE id = ?", [id], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, newRating: row.rating });
    });
  });
});

// ========== API ПОСТОВ ==========
app.get('/api/posts', (req, res) => {
  db.all("SELECT * FROM posts WHERE status = 'active' ORDER BY created_at DESC", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/posts', (req, res) => {
  const { id, user_id, type, title, description, tags, audio_url, created_at, status } = req.body;
  db.run("INSERT INTO posts (id, user_id, type, title, description, tags, audio_url, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [id, user_id, type, title, description, tags, audio_url || null, created_at, status],
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

// ========== ЭНДПОИНТ ДЛЯ ЗАГРУЗКИ АУДИО ==========
app.post('/api/upload-audio', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  const audioUrl = `/uploads/${req.file.filename}`;
  console.log('🎵 Загружен аудиофайл:', audioUrl);
  res.json({ success: true, audioUrl });
});

// ========== АУТЕНТИФИКАЦИЯ ==========
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

// ========== API ТАЙМКОД-КОММЕНТАРИЕВ ==========

// GET /api/timeline-comments/:postId
app.get('/api/timeline-comments/:postId', (req, res) => {
  const { postId } = req.params;
  const userId = req.query.userId || null;
  
  let query = `
    SELECT 
      tc.id,
      tc.post_id,
      tc.user_id,
      tc.start_time,
      tc.end_time,
      tc.comment_text,
      tc.created_at,
      u.name as author_name,
      (SELECT COUNT(*) FROM comment_likes WHERE comment_id = tc.id) as likes_count
  `;
  
  if (userId) {
    query += `,
      (SELECT COUNT(*) > 0 FROM comment_likes WHERE comment_id = tc.id AND user_id = ?) as is_liked
    `;
  }
  
  query += `
    FROM timeline_comments tc
    JOIN users u ON tc.user_id = u.id
    WHERE tc.post_id = ?
    ORDER BY tc.start_time ASC
  `;
  
  const params = userId ? [userId, postId] : [postId];
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Ошибка загрузки комментариев:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

// POST /api/timeline-comments
app.post('/api/timeline-comments', (req, res) => {
  const { post_id, user_id, start_time, end_time, comment_text } = req.body;
  
  if (!post_id || !user_id || start_time === undefined || !comment_text) {
    return res.status(400).json({ error: 'Не все поля заполнены' });
  }
  
  db.run(
    `INSERT INTO timeline_comments (post_id, user_id, start_time, end_time, comment_text, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [post_id, user_id, start_time, end_time || null, comment_text.trim(), Date.now()],
    function(err) {
      if (err) {
        console.error('Ошибка добавления комментария:', err);
        return res.status(500).json({ error: err.message });
      }
      
      db.get(
        `SELECT tc.*, u.name as author_name,
         (SELECT COUNT(*) FROM comment_likes WHERE comment_id = tc.id) as likes_count,
         0 as is_liked
         FROM timeline_comments tc
         JOIN users u ON tc.user_id = u.id
         WHERE tc.id = ?`,
        [this.lastID],
        (err, comment) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json(comment);
        }
      );
    }
  );
});

// DELETE /api/timeline-comments/:commentId
app.delete('/api/timeline-comments/:commentId', (req, res) => {
  const { commentId } = req.params;
  const { user_id } = req.body;
  
  db.get(`SELECT user_id FROM timeline_comments WHERE id = ?`, [commentId], (err, comment) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!comment) return res.status(404).json({ error: 'Комментарий не найден' });
    if (comment.user_id !== user_id) {
      return res.status(403).json({ error: 'Нет прав на удаление' });
    }
    
    db.run(`DELETE FROM comment_likes WHERE comment_id = ?`, [commentId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.run(`DELETE FROM timeline_comments WHERE id = ?`, [commentId], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    });
  });
});

// POST /api/comment-likes/:commentId (остаётся без изменений)
app.post('/api/comment-likes/:commentId', (req, res) => {
  const { commentId } = req.params;
  const { user_id } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'Не указан пользователь' });
  }
  
  db.get(`SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?`, [commentId, user_id], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (existing) {
      db.run(`DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?`, [commentId, user_id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, action: 'unliked' });
      });
    } else {
      db.run(`INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES (?, ?, ?)`, [commentId, user_id, Date.now()], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, action: 'liked' });
      });
    }
  });
});

// ========== API ПОДПИСОК ==========

// Подписаться
app.post('/api/follow', (req, res) => {
  const { follower_id, following_id } = req.body;
  
  if (!follower_id || !following_id) {
    return res.status(400).json({ error: 'Не указаны ID' });
  }
  
  if (follower_id === following_id) {
    return res.status(400).json({ error: 'Нельзя подписаться на себя' });
  }
  
  db.run(
    `INSERT INTO follows (follower_id, following_id, created_at) VALUES (?, ?, ?)`,
    [follower_id, following_id, Date.now()],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Уже подписан' });
        }
        return res.status(500).json({ error: err.message });
      }
      
      // Обновляем счётчики
      db.run(`UPDATE users SET followers_count = followers_count + 1 WHERE id = ?`, [following_id]);
      db.run(`UPDATE users SET following_count = following_count + 1 WHERE id = ?`, [follower_id]);
      
      res.json({ success: true, action: 'follow' });
    }
  );
});

// Отписаться
app.delete('/api/follow', (req, res) => {
  const { follower_id, following_id } = req.body;
  
  db.run(
    `DELETE FROM follows WHERE follower_id = ? AND following_id = ?`,
    [follower_id, following_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      
      if (this.changes > 0) {
        db.run(`UPDATE users SET followers_count = followers_count - 1 WHERE id = ?`, [following_id]);
        db.run(`UPDATE users SET following_count = following_count - 1 WHERE id = ?`, [follower_id]);
      }
      
      res.json({ success: true, action: 'unfollow' });
    }
  );
});

// Проверить, подписан ли
app.get('/api/follow/check', (req, res) => {
  const { follower_id, following_id } = req.query;
  
  db.get(
    `SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?`,
    [follower_id, following_id],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ isFollowing: !!row });
    }
  );
});

// Получить подписки пользователя (на кого подписан)
app.get('/api/follow/following/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all(
    `SELECT u.id, u.name, u.instruments, u.city, u.genres 
     FROM follows f
     JOIN users u ON f.following_id = u.id
     WHERE f.follower_id = ?`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Получить подписчиков пользователя
app.get('/api/follow/followers/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all(
    `SELECT u.id, u.name, u.instruments, u.city, u.genres 
     FROM follows f
     JOIN users u ON f.follower_id = u.id
     WHERE f.following_id = ?`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// ========== API ПУБЛИЧНЫХ ОБСУЖДЕНИЙ ==========

// Получить все сообщения обсуждения поста
app.get('/api/post-discussions/:postId', (req, res) => {
  const { postId } = req.params;
  
  db.all(`
    SELECT 
      pd.id,
      pd.post_id,
      pd.user_id,
      pd.message,
      pd.created_at,
      u.name as user_name
    FROM post_discussions pd
    JOIN users u ON pd.user_id = u.id
    WHERE pd.post_id = ?
    ORDER BY pd.created_at ASC
  `, [postId], (err, rows) => {
    if (err) {
      console.error('Ошибка загрузки обсуждений:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

// Добавить сообщение в обсуждение
app.post('/api/post-discussions', (req, res) => {
  const { post_id, user_id, message } = req.body;
  
  if (!post_id || !user_id || !message || !message.trim()) {
    return res.status(400).json({ error: 'Не все поля заполнены' });
  }
  
  db.run(`
    INSERT INTO post_discussions (post_id, user_id, message, created_at)
    VALUES (?, ?, ?, ?)
  `, [post_id, user_id, message.trim(), Date.now()], function(err) {
    if (err) {
      console.error('Ошибка добавления сообщения:', err);
      return res.status(500).json({ error: err.message });
    }
    
    // Возвращаем созданное сообщение с именем пользователя
    db.get(`
      SELECT 
        pd.id,
        pd.post_id,
        pd.user_id,
        pd.message,
        pd.created_at,
        u.name as user_name
      FROM post_discussions pd
      JOIN users u ON pd.user_id = u.id
      WHERE pd.id = ?
    `, [this.lastID], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row);
    });
  });
});

// Удалить своё сообщение из обсуждения
app.delete('/api/post-discussions/:messageId', (req, res) => {
  const { messageId } = req.params;
  const { user_id } = req.body;
  
  if (!user_id) {
    return res.status(400).json({ error: 'Не указан пользователь' });
  }
  
  // Проверяем, что сообщение принадлежит пользователю
  db.get(`SELECT user_id FROM post_discussions WHERE id = ?`, [messageId], (err, msg) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!msg) return res.status(404).json({ error: 'Сообщение не найдено' });
    if (msg.user_id !== user_id) {
      return res.status(403).json({ error: 'Нельзя удалить чужое сообщение' });
    }
    
    db.run(`DELETE FROM post_discussions WHERE id = ?`, [messageId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });
});

// ========== API АУДИО-КОМНАТ ==========

// Получить все активные комнаты
app.get('/api/live-rooms', (req, res) => {
  db.all(`
    SELECT lr.*, u.name as host_name,
      (SELECT COUNT(*) FROM room_participants WHERE room_id = lr.id AND role != 'listener') as speakers_count
    FROM live_rooms lr
    JOIN users u ON lr.host_id = u.id
    WHERE lr.status = 'live'
    ORDER BY lr.started_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Создать комнату
app.post('/api/live-rooms', (req, res) => {
  const { host_id, title, description } = req.body;
  
  const roomId = 'room_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  
  db.run(`
    INSERT INTO live_rooms (id, host_id, title, description, status, started_at, listeners_count)
    VALUES (?, ?, ?, ?, 'waiting', ?, 0)
  `, [roomId, host_id, title, description || '', Date.now()], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    // Добавляем создателя как участника (роль host)
    db.run(`
      INSERT INTO room_participants (room_id, user_id, role, joined_at)
      VALUES (?, ?, 'host', ?)
    `, [roomId, host_id, Date.now()]);
    
    res.json({ success: true, roomId, room: { id: roomId, host_id, title, description } });
  });
});

// Получить данные комнаты
app.get('/api/live-rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  
  db.get(`
    SELECT lr.*, u.name as host_name
    FROM live_rooms lr
    JOIN users u ON lr.host_id = u.id
    WHERE lr.id = ?
  `, [roomId], (err, room) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!room) return res.status(404).json({ error: 'Комната не найдена' });
    res.json(room);
  });
});

// Получить сообщения чата комнаты
app.get('/api/room-messages/:roomId', (req, res) => {
  const { roomId } = req.params;
  
  db.all(`
    SELECT rm.*, u.name as user_name
    FROM room_messages rm
    JOIN users u ON rm.user_id = u.id
    WHERE rm.room_id = ?
    ORDER BY rm.created_at ASC
    LIMIT 100
  `, [roomId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Отправить сообщение в чат комнаты
app.post('/api/room-messages', (req, res) => {
  const { room_id, user_id, message } = req.body;
  
  if (!room_id || !user_id || !message || !message.trim()) {
    return res.status(400).json({ error: 'Не все поля заполнены' });
  }
  
  db.run(`
    INSERT INTO room_messages (room_id, user_id, message, created_at)
    VALUES (?, ?, ?, ?)
  `, [room_id, user_id, message.trim(), Date.now()], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get(`
      SELECT rm.*, u.name as user_name
      FROM room_messages rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.id = ?
    `, [this.lastID], (err, msg) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(msg);
    });
  });
});

// Получить донаты комнаты
app.get('/api/room-donations/:roomId', (req, res) => {
  const { roomId } = req.params;
  
  db.all(`
    SELECT rd.*, u.name as from_user_name
    FROM room_donations rd
    JOIN users u ON rd.from_user_id = u.id
    WHERE rd.room_id = ?
    ORDER BY rd.created_at DESC
    LIMIT 50
  `, [roomId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Отправить донат (тестовый режим)
app.post('/api/room-donations', (req, res) => {
  const { room_id, from_user_id, to_user_id, amount, message } = req.body;
  
  db.run(`
    INSERT INTO room_donations (room_id, from_user_id, to_user_id, amount, message, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [room_id, from_user_id, to_user_id, amount, message || '', Date.now()], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, donationId: this.lastID });
  });
});

// Начать трансляцию (обновить статус)
app.put('/api/live-rooms/:roomId/start', (req, res) => {
  const { roomId } = req.params;
  
  db.run(`
    UPDATE live_rooms SET status = 'live', started_at = ? WHERE id = ?
  `, [Date.now(), roomId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Завершить трансляцию
app.put('/api/live-rooms/:roomId/end', (req, res) => {
  const { roomId } = req.params;
  
  db.run(`
    UPDATE live_rooms SET status = 'ended', ended_at = ? WHERE id = ?
  `, [Date.now(), roomId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ========== API ТОВАРОВ (МАРКЕТ) ==========

// Получить все активные товары для витрины
app.get('/api/products', (req, res) => {
  db.all(`
    SELECT p.*, u.name as seller_name, u.instruments as seller_instruments
    FROM products p
    JOIN users u ON p.user_id = u.id
    WHERE p.status = 'active'
    ORDER BY p.created_at DESC
  `, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Получить товары текущего пользователя
app.get('/api/products/my/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all(`
    SELECT * FROM products
    WHERE user_id = ? AND status = 'active'
    ORDER BY created_at DESC
  `, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Создать товар
app.post('/api/products', (req, res) => {
  const { user_id, title, description, price, license_type, demo_url, full_url } = req.body;
  
  if (!user_id || !title || !price) {
    return res.status(400).json({ error: 'Не все поля заполнены' });
  }
  
  const productId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  
  db.run(`
    INSERT INTO products (id, user_id, title, description, price, license_type, demo_url, full_url, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `, [productId, user_id, title, description || '', price, license_type || 'non-exclusive', demo_url || null, full_url || null, Date.now()],
  function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, productId });
  });
});

// Удалить товар (скрыть)
app.delete('/api/products/:productId', (req, res) => {
  const { productId } = req.params;
  const { user_id } = req.body;
  
  db.run(`UPDATE products SET status = 'removed' WHERE id = ? AND user_id = ?`,
    [productId, user_id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Товар не найден' });
      res.json({ success: true });
    }
  );
});

// Загрузка демо-файла для товара
app.post('/api/upload-product-demo', productUpload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  const audioUrl = `/uploads/${req.file.filename}`;
  console.log('🎵 Загружено демо товара:', audioUrl);
  res.json({ success: true, audioUrl });
});

// Загрузка полного файла для товара
app.post('/api/upload-product-full', productUpload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Файл не загружен' });
  }
  const audioUrl = `/uploads/${req.file.filename}`;
  console.log('🎵 Загружен полный файл товара:', audioUrl);
  res.json({ success: true, audioUrl });
});

// ========== API ВИДЕО-КОМНАТ ==========

app.post('/api/lessons', (req, res) => {
  const { teacher_id, student_id, scheduled_at, duration, price } = req.body;
  const lessonId = 'lesson_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const roomId = 'video_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  
  db.run(`
    INSERT INTO lessons (id, teacher_id, student_id, scheduled_at, duration, price, room_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [lessonId, teacher_id, student_id, scheduled_at, duration, price, roomId, Date.now()], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, lessonId, roomId });
  });
});

// ========== API ВИДЕО-ЗВОНКОВ ==========

// Создать видео-звонок
app.post('/api/video-calls', (req, res) => {
  const { id, creator_id, participant_id } = req.body;
  
  db.run(`
    INSERT INTO video_calls (id, creator_id, participant_id, created_at, status)
    VALUES (?, ?, ?, ?, 'active')
  `, [id, creator_id, participant_id, Date.now()], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, callId: id });
  });
});

// Получить информацию о звонке
app.get('/api/video-calls/:callId', (req, res) => {
  const { callId } = req.params;
  
  db.get(`
    SELECT vc.*, 
           u1.name as creator_name,
           u2.name as participant_name
    FROM video_calls vc
    JOIN users u1 ON vc.creator_id = u1.id
    JOIN users u2 ON vc.participant_id = u2.id
    WHERE vc.id = ?
  `, [callId], (err, call) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!call) return res.status(404).json({ error: 'Звонок не найден' });
    res.json(call);
  });
});

// Завершить звонок
app.put('/api/video-calls/:callId/end', (req, res) => {
  const { callId } = req.params;
  
  db.run(`
    UPDATE video_calls SET status = 'ended' WHERE id = ?
  `, [callId], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ========== API СООБЩЕНИЙ ==========

// Получить список диалогов (с последним сообщением)
app.get('/api/dialogs/:userId', (req, res) => {
  const { userId } = req.params;
  
  db.all(`
    SELECT 
      u.id as user_id,
      u.name as user_name,
      u.instruments,
      u.city,
      (SELECT message FROM messages 
       WHERE (from_user_id = u.id AND to_user_id = ?) 
          OR (from_user_id = ? AND to_user_id = u.id)
       ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages 
       WHERE (from_user_id = u.id AND to_user_id = ?) 
          OR (from_user_id = ? AND to_user_id = u.id)
       ORDER BY created_at DESC LIMIT 1) as last_message_time,
      (SELECT COUNT(*) FROM messages 
       WHERE from_user_id = u.id AND to_user_id = ? AND is_read = 0) as unread_count
    FROM users u
    WHERE u.id IN (
      SELECT DISTINCT 
        CASE 
          WHEN from_user_id = ? THEN to_user_id
          ELSE from_user_id
        END as other_user
      FROM messages
      WHERE from_user_id = ? OR to_user_id = ?
    )
    ORDER BY last_message_time DESC
  `, [userId, userId, userId, userId, userId, userId, userId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// Получить сообщения с конкретным пользователем
app.get('/api/messages/:userId/:otherUserId', (req, res) => {
  const { userId, otherUserId } = req.params;
  
  db.all(`
    SELECT * FROM messages
    WHERE (from_user_id = ? AND to_user_id = ?)
       OR (from_user_id = ? AND to_user_id = ?)
    ORDER BY created_at ASC
  `, [userId, otherUserId, otherUserId, userId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Отмечаем сообщения как прочитанные
    db.run(`
      UPDATE messages 
      SET is_read = 1 
      WHERE from_user_id = ? AND to_user_id = ?
    `, [otherUserId, userId]);
    
    res.json(rows || []);
  });
});

// Отправить сообщение
app.post('/api/messages', (req, res) => {
  const { from_user_id, to_user_id, message } = req.body;
  
  if (!from_user_id || !to_user_id || !message || !message.trim()) {
    return res.status(400).json({ error: 'Не все поля заполнены' });
  }
  
  db.run(`
    INSERT INTO messages (from_user_id, to_user_id, message, created_at, is_read)
    VALUES (?, ?, ?, ?, 0)
  `, [from_user_id, to_user_id, message.trim(), Date.now()], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get(`
      SELECT m.*, u.name as from_user_name
      FROM messages m
      JOIN users u ON m.from_user_id = u.id
      WHERE m.id = ?
    `, [this.lastID], (err, msg) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(msg);
    });
  });
});


server.listen(port, () => {
  console.log(`🚀 Локальный сервер: http://localhost:${port}`);
  console.log(`📁 Открывай index.html`);
});
