// server.js
// Çöp Adam Savaşları - Express + Socket.IO sunucu
// - Oyunun HTML dosyasını statik olarak sunar
// - /api/register, /api/login, /api/logout, /api/me, /api/progress
// - Arkadaş sistemi: /api/friends, /api/friends/request|accept|decline|remove, /api/users/search
// - Socket.IO: online durumu, arkadaşlık istekleri (canlı), sefer daveti (co-op),
//   hızlı eşleşme (versus) ve host->guest oyun durumu röle sistemi.
//
// MİMARİ NOTU (host-authoritative):
// Bu oyun canvas üstünde 60fps fizik/animasyon çalıştırıyor. İki tarayıcıda
// aynı simülasyonu bağımsız çalıştırıp senkron tutmak (lockstep) çok kırılgan
// olur. Bunun yerine odadaki bir taraf ("host") oyunun TEK simülasyonunu
// çalıştırır, diğer taraf ("guest") sadece komutlarını (saldırı/savunma/geri
// çekil, birim satın al) sunucu üzerinden host'a yollar; host da düzenli
// aralıklarla basit bir "game:state" anlık görüntüsünü guest'e yollar, guest
// bunu ekranda basitçe çizer. Sunucu burada sadece güvenilir bir röle
// (relay) — oyun mantığının kendisini simüle etmiyor.

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

// ==================== AYARLAR ====================
const PORT = process.env.PORT || 3847;
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
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

let users = loadUsers();

// Eski kayıtlara arkadaş alanlarını ekle (geriye dönük uyumluluk)
function ensureUserShape(u) {
    if (!u.friends) u.friends = [];
    if (!u.incomingRequests) u.incomingRequests = [];
    if (!u.outgoingRequests) u.outgoingRequests = [];
    if (!u.maxUnlocked) u.maxUnlocked = 1;
    if (!u.cleared) u.cleared = [];
    return u;
}
Object.keys(users).forEach(name => ensureUserShape(users[name]));

// Aktif oturum token'ları: token -> username
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
function makeRoomId() {
    return crypto.randomBytes(8).toString('hex');
}

// ==================== EXPRESS UYGULAMASI ====================
const app = express();
app.use(cors());
app.use(express.json());

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

// ==================== HESAP ROTALARI ====================
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
    users[name] = ensureUserShape({
        salt,
        hash: hashPassword(password, salt),
        maxUnlocked: 1,
        cleared: [],
    });
    saveUsers(users);
    const token = makeToken();
    sessions.set(token, name);
    res.json({ token, ...publicUser(name) });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    }
    const name = username.trim();
    const u = users[name];
    if (!u) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    const check = hashPassword(password, u.salt);
    if (check !== u.hash) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    const token = makeToken();
    sessions.set(token, name);
    res.json({ token, ...publicUser(name) });
});

app.post('/api/logout', requireAuth, (req, res) => {
    sessions.delete(req.token);
    res.json({ ok: true });
});

app.get('/api/me', requireAuth, (req, res) => {
    res.json(publicUser(req.username));
});

app.post('/api/progress', requireAuth, (req, res) => {
    const { maxUnlocked, cleared } = req.body || {};
    const u = users[req.username];
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

// ==================== ARKADAŞ SİSTEMİ ====================
app.get('/api/friends', requireAuth, (req, res) => {
    const u = ensureUserShape(users[req.username]);
    res.json({
        friends: u.friends.map(f => ({ username: f, online: onlineUsers.has(f) })),
        incomingRequests: u.incomingRequests,
        outgoingRequests: u.outgoingRequests,
    });
});

app.get('/api/users/search', requireAuth, (req, res) => {
    const q = (req.query.q || '').toString().trim().toLowerCase();
    if (q.length < 2) return res.json({ results: [] });
    const results = Object.keys(users)
        .filter(name => name.toLowerCase().includes(q) && name !== req.username)
        .slice(0, 10)
        .map(name => ({ username: name, online: onlineUsers.has(name) }));
    res.json({ results });
});

app.post('/api/friends/request', requireAuth, (req, res) => {
    const { toUsername } = req.body || {};
    const from = req.username;
    if (!toUsername || !users[toUsername]) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    if (toUsername === from) return res.status(400).json({ error: 'Kendine istek atamazsın' });
    const a = ensureUserShape(users[from]);
    const b = ensureUserShape(users[toUsername]);
    if (a.friends.includes(toUsername)) return res.status(409).json({ error: 'Zaten arkadaşsınız' });
    if (a.outgoingRequests.includes(toUsername)) return res.status(409).json({ error: 'İstek zaten gönderildi' });

    if (a.incomingRequests.includes(toUsername)) {
        // Karşılıklı istek → otomatik arkadaş ol
        a.incomingRequests = a.incomingRequests.filter(x => x !== toUsername);
        b.outgoingRequests = b.outgoingRequests.filter(x => x !== from);
        a.friends.push(toUsername);
        b.friends.push(from);
        saveUsers(users);
        notifyUser(toUsername, 'friend:accepted', { username: from });
        return res.json({ status: 'accepted' });
    }

    a.outgoingRequests.push(toUsername);
    b.incomingRequests.push(from);
    saveUsers(users);
    notifyUser(toUsername, 'friend:request', { username: from });
    res.json({ status: 'sent' });
});

app.post('/api/friends/accept', requireAuth, (req, res) => {
    const { fromUsername } = req.body || {};
    const me = req.username;
    const a = ensureUserShape(users[me]);
    const b = users[fromUsername] && ensureUserShape(users[fromUsername]);
    if (!b || !a.incomingRequests.includes(fromUsername)) {
        return res.status(404).json({ error: 'İstek bulunamadı' });
    }
    a.incomingRequests = a.incomingRequests.filter(x => x !== fromUsername);
    b.outgoingRequests = b.outgoingRequests.filter(x => x !== me);
    a.friends.push(fromUsername);
    b.friends.push(me);
    saveUsers(users);
    notifyUser(fromUsername, 'friend:accepted', { username: me });
    res.json({ status: 'accepted' });
});

app.post('/api/friends/decline', requireAuth, (req, res) => {
    const { fromUsername } = req.body || {};
    const me = req.username;
    const a = ensureUserShape(users[me]);
    const b = users[fromUsername] && ensureUserShape(users[fromUsername]);
    a.incomingRequests = a.incomingRequests.filter(x => x !== fromUsername);
    if (b) b.outgoingRequests = b.outgoingRequests.filter(x => x !== me);
    saveUsers(users);
    res.json({ status: 'declined' });
});

app.post('/api/friends/remove', requireAuth, (req, res) => {
    const { username: target } = req.body || {};
    const me = req.username;
    const a = ensureUserShape(users[me]);
    const b = users[target] && ensureUserShape(users[target]);
    a.friends = a.friends.filter(x => x !== target);
    if (b) b.friends = b.friends.filter(x => x !== me);
    saveUsers(users);
    res.json({ status: 'removed' });
});

// ==================== SOCKET.IO ====================
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const onlineUsers = new Map();  // username -> socket.id
const quickQueue = [];          // [{ username, socketId }]  — hızlı eşleşme (versus) kuyruğu
const rooms = new Map();        // roomId -> { host, guest, mode: 'coop'|'versus', level }

function notifyUser(username, event, payload) {
    const sid = onlineUsers.get(username);
    if (sid) io.to(sid).emit(event, payload);
}

// Bağlantı kurarken token doğrulama (login token'ı ile aynı)
io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const username = token && sessions.get(token);
    if (!username || !users[username]) return next(new Error('unauthorized'));
    socket.username = username;
    next();
});

io.on('connection', socket => {
    const username = socket.username;
    onlineUsers.set(username, socket.id);

    const me = ensureUserShape(users[username]);
    me.friends.forEach(f => notifyUser(f, 'friend:online', { username }));

    socket.on('friends:refresh', () => {
        const u = ensureUserShape(users[username]);
        socket.emit('friends:state', {
            friends: u.friends.map(f => ({ username: f, online: onlineUsers.has(f) })),
            incomingRequests: u.incomingRequests,
        });
    });

    // ---- Sefer daveti (co-op) ----
    socket.on('invite:send', ({ toUsername, level }) => {
        if (!onlineUsers.has(toUsername)) {
            socket.emit('invite:failed', { reason: 'offline', toUsername });
            return;
        }
        notifyUser(toUsername, 'invite:received', { fromUsername: username, level });
    });

    socket.on('invite:accept', ({ toUsername, level }) => {
        // toUsername = daveti gönderen kişi → o host olur
        const roomId = makeRoomId();
        rooms.set(roomId, { host: toUsername, guest: username, mode: 'coop', level });
        notifyUser(toUsername, 'invite:accepted', { roomId, guestUsername: username, level, isHost: true });
        socket.emit('invite:accepted', { roomId, guestUsername: toUsername, level, isHost: false });
    });

    socket.on('invite:decline', ({ toUsername }) => {
        notifyUser(toUsername, 'invite:declined', { byUsername: username });
    });

    // ---- Hızlı eşleşme (rastgele rakip, versus) ----
    socket.on('mp:queue:join', () => {
        if (quickQueue.some(q => q.username === username)) return;
        quickQueue.push({ username, socketId: socket.id });
        if (quickQueue.length >= 2) {
            const a = quickQueue.shift();
            const b = quickQueue.shift();
            const roomId = makeRoomId();
            rooms.set(roomId, { host: a.username, guest: b.username, mode: 'versus' });
            io.to(a.socketId).emit('mp:matched', { roomId, opponent: b.username, isHost: true });
            io.to(b.socketId).emit('mp:matched', { roomId, opponent: a.username, isHost: false });
        } else {
            socket.emit('mp:queue:waiting');
        }
    });
    socket.on('mp:queue:leave', () => {
        const idx = quickQueue.findIndex(q => q.username === username);
        if (idx >= 0) quickQueue.splice(idx, 1);
    });

    // ---- Oda içi röle: host <-> guest ----
    socket.on('room:join', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (!room || (room.host !== username && room.guest !== username)) return;
        socket.join(roomId);
        socket.roomId = roomId;
        const other = room.host === username ? room.guest : room.host;
        socket.emit('room:ready', { otherOnline: onlineUsers.has(other), mode: room.mode, level: room.level });
        socket.to(roomId).emit('room:peerJoined');
    });

    // host -> guest: periyodik oyun durumu anlık görüntüsü
    socket.on('game:state', payload => {
        if (socket.roomId) socket.to(socket.roomId).emit('game:state', payload);
    });
    // guest -> host: komutlar (saldırı/savunma/geri çekil, birim satın al)
    socket.on('game:input', payload => {
        if (socket.roomId) socket.to(socket.roomId).emit('game:input', payload);
    });
    socket.on('room:leave', () => {
        if (socket.roomId) {
            socket.to(socket.roomId).emit('room:peerLeft');
            rooms.delete(socket.roomId);
            socket.leave(socket.roomId);
            socket.roomId = null;
        }
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(username);
        const idx = quickQueue.findIndex(q => q.username === username);
        if (idx >= 0) quickQueue.splice(idx, 1);
        if (socket.roomId) {
            socket.to(socket.roomId).emit('room:peerLeft');
            rooms.delete(socket.roomId);
        }
        const u2 = ensureUserShape(users[username] || { friends: [] });
        (u2.friends || []).forEach(f => notifyUser(f, 'friend:offline', { username }));
    });
});

// ==================== SUNUCUYU BAŞLAT ====================
server.listen(PORT, () => {
    console.log(`Çöp Adam Savaşları sunucusu çalışıyor: http://localhost:${PORT}`);
    console.log(`Oyun dosyası: ${HTML_FILE}`);
});
