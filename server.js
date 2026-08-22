// server.js
// Çöp Adam Savaşları - Express + WebSocket sunucusu
// - Oyunun HTML dosyasını statik olarak sunar
// - /api/register, /api/login, /api/logout, /api/me, /api/progress uçlarını sağlar
// - Arkadaş sistemi: /api/friends, /api/friends/request, /api/friends/accept, /api/friends/decline, /api/friends/remove
// - WebSocket (/ws): çevrimiçi durumu, arkadaşla co-op daveti/kabulü ve oda (room) içi mesaj aktarımı
// - Kullanıcılar data/users.json dosyasında saklanır (basit dosya tabanlı "veritabanı")
//
// NOT (Render için önemli):
//   Render'ın ücretsiz/standart web servislerinde disk kalıcı DEĞİLDİR.
//   Her yeniden başlatma / yeni deploy'da data/ klasörü sıfırlanabilir.
//   Kalıcı kullanıcı verisi istiyorsan Render'da bir "Persistent Disk" ekleyip
//   DATA_DIR env değişkenini o disk'in mount path'ine ayarla (örn: /var/data).

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

// ==================== AYARLAR ====================
const PORT = process.env.PORT || 3847;

// Oyunun ana HTML dosyasının adı. Kendi dosya adınla eşleşmiyorsa
// HTML_FILE env değişkenini Render'da ayarla, ya da dosyayı bu isimle
// (ya da index.html olarak) proje köküne koy.
const HTML_FILE = process.env.HTML_FILE || 'index.html';

// Kalıcı disk kullanıyorsan Render'da DATA_DIR env değişkenini
// disk mount path'ine ayarla (örn: /var/data). Ayarlamazsan proje
// içindeki data/ klasörü kullanılır (Render'da kalıcı olmayabilir).
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
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

let users = loadUsers(); // { username: { salt, hash, maxUnlocked, cleared, friends, incoming, outgoing } }

// Eski kayıtlarda olmayan alanları tamamla (arkadaş sistemi sonradan eklendi)
function ensureUserShape(u) {
    if (!Array.isArray(u.friends)) u.friends = [];
    if (!Array.isArray(u.incoming)) u.incoming = [];
    if (!Array.isArray(u.outgoing)) u.outgoing = [];
    if (typeof u.maxUnlocked !== 'number') u.maxUnlocked = 1;
    if (!Array.isArray(u.cleared)) u.cleared = [];
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
            `Oyun dosyası bulunamadı: ${HTML_FILE}. server.js içindeki HTML_FILE değişkenini (veya HTML_FILE env değişkenini) kontrol et.`
        );
    }
});

app.use(express.static(__dirname, { index: false }));

// Basit sağlık kontrolü (Render health check için faydalı)
app.get('/healthz', (req, res) => {
    res.json({ ok: true });
});

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

// ==================== AUTH ROTALARI ====================

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

const onlineSockets = new Map(); // username -> WebSocket

function isOnline(username) {
    return onlineSockets.has(username);
}

function friendsPayload(username) {
    const u = users[username];
    return {
        friends: (u.friends || []).map(f => ({ username: f, online: isOnline(f) })),
        incoming: u.incoming || [],
        outgoing: u.outgoing || [],
    };
}

function sendTo(username, obj) {
    const ws = onlineSockets.get(username);
    if (ws && ws.readyState === ws.OPEN) {
        try { ws.send(JSON.stringify(obj)); } catch (e) { /* yoksay */ }
    }
}

app.get('/api/friends', requireAuth, (req, res) => {
    res.json(friendsPayload(req.username));
});

app.post('/api/friends/request', requireAuth, (req, res) => {
    const target = ((req.body && req.body.username) || '').trim();
    const me = req.username;

    if (!target || target === me) {
        return res.status(400).json({ error: 'Geçersiz kullanıcı adı' });
    }
    if (!users[target]) {
        return res.status(404).json({ error: 'Böyle bir kullanıcı yok' });
    }
    const meRec = users[me];
    const targetRec = users[target];

    if (meRec.friends.includes(target)) {
        return res.status(409).json({ error: 'Zaten arkadaşsınız' });
    }

    if (meRec.incoming.includes(target)) {
        meRec.friends.push(target);
        targetRec.friends.push(me);
        meRec.incoming = meRec.incoming.filter(x => x !== target);
        targetRec.outgoing = targetRec.outgoing.filter(x => x !== me);
        saveUsers(users);
        sendTo(target, { type: 'friend_accepted', username: me });
        return res.json({ status: 'accepted', ...friendsPayload(me) });
    }

    if (meRec.outgoing.includes(target)) {
        return res.status(409).json({ error: 'İstek zaten gönderildi' });
    }

    meRec.outgoing.push(target);
    targetRec.incoming.push(me);
    saveUsers(users);
    sendTo(target, { type: 'friend_request', username: me });

    res.json({ status: 'sent', ...friendsPayload(me) });
});

app.post('/api/friends/accept', requireAuth, (req, res) => {
    const from = ((req.body && req.body.username) || '').trim();
    const me = req.username;
    const meRec = users[me];

    if (!from || !meRec.incoming.includes(from) || !users[from]) {
        return res.status(400).json({ error: 'Böyle bir istek yok' });
    }
    const fromRec = users[from];

    meRec.friends.push(from);
    fromRec.friends.push(me);
    meRec.incoming = meRec.incoming.filter(x => x !== from);
    fromRec.outgoing = fromRec.outgoing.filter(x => x !== me);
    saveUsers(users);

    sendTo(from, { type: 'friend_accepted', username: me });
    res.json(friendsPayload(me));
});

app.post('/api/friends/decline', requireAuth, (req, res) => {
    const from = ((req.body && req.body.username) || '').trim();
    const me = req.username;
    const meRec = users[me];

    if (from && users[from]) {
        meRec.incoming = meRec.incoming.filter(x => x !== from);
        users[from].outgoing = users[from].outgoing.filter(x => x !== me);
        saveUsers(users);
    }
    res.json(friendsPayload(me));
});

app.post('/api/friends/remove', requireAuth, (req, res) => {
    const target = ((req.body && req.body.username) || '').trim();
    const me = req.username;
    const meRec = users[me];

    meRec.friends = meRec.friends.filter(x => x !== target);
    if (users[target]) {
        users[target].friends = users[target].friends.filter(x => x !== me);
    }
    saveUsers(users);
    res.json(friendsPayload(me));
});

// ==================== HTTP + WEBSOCKET SUNUCUSU ====================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map(); // roomId -> { members: [usernameA, usernameB] }

function leaveRoomForUser(username, ws) {
    const roomId = ws && ws.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.members = room.members.filter(m => m !== username);
    room.members.forEach(m => sendTo(m, { type: 'partner_left', roomId }));
    if (room.members.length === 0) rooms.delete(roomId);
    ws.roomId = null;
}

wss.on('connection', (ws) => {
    ws.username = null;
    ws.roomId = null;

    ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch (e) { return; }
        if (!msg || typeof msg.type !== 'string') return;

        if (msg.type === 'auth') {
            const username = sessions.get(msg.token);
            if (!username || !users[username]) {
                ws.send(JSON.stringify({ type: 'auth_error', error: 'Geçersiz oturum' }));
                ws.close();
                return;
            }
            ws.username = username;
            const prev = onlineSockets.get(username);
            if (prev && prev !== ws) { try { prev.close(); } catch (e) {} }
            onlineSockets.set(username, ws);
            ws.send(JSON.stringify({ type: 'auth_ok', username }));
            return;
        }

        if (!ws.username) return;

        if (msg.type === 'coop_invite') {
            const to = msg.to;
            const meRec = users[ws.username];
            if (!to || !meRec.friends.includes(to)) {
                ws.send(JSON.stringify({ type: 'error', error: 'Bu kişi arkadaşın değil' }));
                return;
            }
            if (!isOnline(to)) {
                ws.send(JSON.stringify({ type: 'error', error: 'Arkadaşın şu an çevrimiçi değil' }));
                return;
            }
            sendTo(to, { type: 'coop_invite', from: ws.username, level: msg.level });
            ws.send(JSON.stringify({ type: 'invite_sent', to }));
            return;
        }

        if (msg.type === 'coop_response') {
            const to = msg.to;
            if (!msg.accept) {
                sendTo(to, { type: 'coop_declined', from: ws.username });
                return;
            }
            const roomId = makeRoomId();
            rooms.set(roomId, { members: [to, ws.username] });

            const hostWs = onlineSockets.get(to);
            if (hostWs) hostWs.roomId = roomId;
            ws.roomId = roomId;

            sendTo(to, { type: 'coop_start', roomId, role: 'host', level: msg.level, partner: ws.username });
            ws.send(JSON.stringify({ type: 'coop_start', roomId, role: 'guest', level: msg.level, partner: to }));
            return;
        }

        if (msg.type === 'room_relay') {
            const room = rooms.get(msg.roomId);
            if (!room || !room.members.includes(ws.username)) return;
            room.members.forEach(m => {
                if (m === ws.username) return;
                sendTo(m, { type: 'room_relay', payload: msg.payload, from: ws.username });
            });
            return;
        }

        if (msg.type === 'leave_room') {
            leaveRoomForUser(ws.username, ws);
            return;
        }
    });

    ws.on('close', () => {
        if (ws.username) {
            if (onlineSockets.get(ws.username) === ws) onlineSockets.delete(ws.username);
            leaveRoomForUser(ws.username, ws);
        }
    });
});

// ==================== SUNUCUYU BAŞLAT ====================
server.listen(PORT, () => {
    console.log(`Çöp Adam Savaşları sunucusu çalışıyor: http://localhost:${PORT}`);
    console.log(`Oyun dosyası: ${HTML_FILE}`);
    console.log(`Veri klasörü: ${DATA_DIR}`);
    console.log(`WebSocket: ws://localhost:${PORT}/ws`);
});
