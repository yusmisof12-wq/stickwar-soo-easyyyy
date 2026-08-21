// server.js
// Çöp Adam Savaşları - Express sunucu
// - Oyunun HTML dosyasını statik olarak sunar
// - /api/register, /api/login, /api/logout, /api/me, /api/progress uçlarını sağlar
// - Kullanıcılar data/users.json dosyasında saklanır (basit dosya tabanlı "veritabanı")

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ==================== AYARLAR ====================
const PORT = process.env.PORT || 3847;
// Oyunun ana HTML dosyasının adı. Kendi dosya adınla eşleşmiyorsa burayı güncelle
// ya da dosyayı bu isimle (ya da index.html olarak) proje köküne koy.
const HTML_FILE = 'cop-adam-savaslari-gelistirilmis.html';
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// ==================== BASİT "VERİTABANI" (JSON dosyası) ====================
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsers() {
    try {
        return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    } catch (e) {
        return {};
    }
}

function saveUsers(users) {
    // Basit senkron yazım; kullanıcı sayısı azken sorun çıkarmaz.
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

let users = loadUsers(); // { username: { salt, hash, maxUnlocked, cleared: [] } }

// Aktif oturum token'ları: token -> username (sunucu yeniden başlarsa temizlenir,
// istemci tarafı bunu 401 alınca otomatik olarak ele alıyor)
const sessions = new Map();

// ==================== ŞİFRE YARDIMCI FONKSİYONLARI ====================
function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}

function makeSalt() {
    return crypto.randomBytes(16).toString('hex');
}

function makeToken() {
    return crypto.randomBytes(32).toString('hex');
}

// ==================== EXPRESS UYGULAMASI ====================
const app = express();

app.use(cors()); // file:// üzerinden açılan sayfalar dahil her origin'e izin ver
app.use(express.json());

// Oyunun kendisini kök adreste sun
app.get('/', (req, res) => {
    const filePath = path.join(__dirname, HTML_FILE);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(500).send(
            `Oyun dosyası bulunamadı: ${HTML_FILE}. server.js içindeki HTML_FILE değişkenini kontrol et.`
        );
    }
});

// Aynı klasördeki diğer statik dosyaları da sun (varsa ek görsel/ses vs.)
app.use(express.static(__dirname, { index: false }));

// ==================== AUTH MIDDLEWARE ====================
function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const username = token && sessions.get(token);
    if (!username || !users[username]) {
        return res.status(401).json({ error: 'Yetkisiz istek' });
    }
    req.username = username;
    req.token = token;
    next();
}

function publicUser(username) {
    const u = users[username];
    return {
        username,
        maxUnlocked: u.maxUnlocked || 1,
        cleared: u.cleared || [],
    };
}

// ==================== ROTALAR ====================

// Kayıt ol
app.post('/api/register', (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || username.trim().length < 3) {
        return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalı' });
    }
    if (typeof password !== 'string' || password.length < 3) {
        return res.status(400).json({ error: 'Şifre en az 3 karakter olmalı' });
    }

    const name = username.trim();
    if (users[name]) {
        return res.status(409).json({ error: 'Bu kullanıcı adı alınmış' });
    }

    const salt = makeSalt();
    users[name] = {
        salt,
        hash: hashPassword(password, salt),
        maxUnlocked: 1,
        cleared: [],
    };
    saveUsers(users);

    const token = makeToken();
    sessions.set(token, name);

    res.json({ token, ...publicUser(name) });
});

// Giriş yap
app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }

    const name = username.trim();
    const u = users[name];
    if (!u) {
        return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }

    const check = hashPassword(password, u.salt);
    if (check !== u.hash) {
        return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }

    const token = makeToken();
    sessions.set(token, name);

    res.json({ token, ...publicUser(name) });
});

// Çıkış yap
app.post('/api/logout', requireAuth, (req, res) => {
    sessions.delete(req.token);
    res.json({ ok: true });
});

// Mevcut kullanıcı bilgisi
app.get('/api/me', requireAuth, (req, res) => {
    res.json(publicUser(req.username));
});

// İlerlemeyi kaydet (seviye kilidi ve tamamlanan bölümler)
app.post('/api/progress', requireAuth, (req, res) => {
    const { maxUnlocked, cleared } = req.body || {};
    const u = users[req.username];

    // Geriye gitmesini önlemek için mevcut değerle karşılaştırıp büyüğünü/birleşimini al
    if (typeof maxUnlocked === 'number' && maxUnlocked > (u.maxUnlocked || 1)) {
        u.maxUnlocked = maxUnlocked;
    } else if (!u.maxUnlocked) {
        u.maxUnlocked = 1;
    }

    if (Array.isArray(cleared)) {
        const merged = new Set([...(u.cleared || []), ...cleared]);
        u.cleared = Array.from(merged);
    }

    saveUsers(users);
    res.json(publicUser(req.username));
});

// ==================== SUNUCUYU BAŞLAT ====================
app.listen(PORT, () => {
    console.log(`Çöp Adam Savaşları sunucusu çalışıyor: http://localhost:${PORT}`);
    console.log(`Oyun dosyası: ${HTML_FILE}`);
});
