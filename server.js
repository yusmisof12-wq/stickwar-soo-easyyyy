// server.js — Çöp Adam Savaşları (Express + WebSocket)
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
let GameRoom = null, TICK_MS = 50;
try { ({ GameRoom, TICK_MS } = require('./server-game')); } catch (_) {}

const PORT = process.env.PORT || 3847;
const HTML_FILE = process.env.HTML_FILE || 'index.html';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsers() {
    try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
    catch (e) { return {}; }
}
function saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

let users = loadUsers();
function ensureUserShape(u) {
    if (!Array.isArray(u.friends)) u.friends = [];
    if (!Array.isArray(u.incoming)) u.incoming = [];
    if (!Array.isArray(u.outgoing)) u.outgoing = [];
    if (typeof u.maxUnlocked !== 'number') u.maxUnlocked = 1;
    if (!Array.isArray(u.cleared)) u.cleared = [];
    return u;
}
Object.keys(users).forEach(name => ensureUserShape(users[name]));

const sessions = new Map();

function hashPassword(password, salt) {
    return crypto.scryptSync(password, salt, 64).toString('hex');
}
function makeSalt() { return crypto.randomBytes(16).toString('hex'); }
function makeToken() { return crypto.randomBytes(32).toString('hex'); }
function makeRoomId() { return crypto.randomBytes(8).toString('hex'); }

const app = express();
app.use(cors());
app.use(express.json());

// Statik dosyalar (css/, js/) — Render'da mutlaka bu klasörler de deploy edilmeli
const publicRoot = __dirname;
app.use(express.static(publicRoot, {
    index: false,
    // Doğru MIME tipleri
    setHeaders(res, filePath) {
        if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        if (filePath.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
        if (filePath.endsWith('.mp3')) res.setHeader('Content-Type', 'audio/mpeg');
    }
}));

app.get('/', (req, res) => {
    const filePath = path.join(publicRoot, HTML_FILE);
    if (fs.existsSync(filePath)) return res.sendFile(filePath);
    res.status(500).send(
        `Oyun dosyası bulunamadı: ${HTML_FILE}\n` +
        `Kök dizin: ${publicRoot}\n` +
        `Dosyalar: ${fs.readdirSync(publicRoot).join(', ')}`
    );
});

app.get('/healthz', (req, res) => {
    const cssOk = fs.existsSync(path.join(publicRoot, 'style.css'));
    const jsOk = fs.existsSync(path.join(publicRoot, '01-core.js'));
    res.json({
        ok: true,
        html: fs.existsSync(path.join(publicRoot, HTML_FILE)),
        css: cssOk,
        js: jsOk,
        files: fs.readdirSync(publicRoot),
    });
});

// Eksik statik dosya için net 404 (HTML sayfası dönmesin)
app.use((req, res, next) => {
    if (req.path.endsWith('.css') || req.path.endsWith('.js')) {
        return res.status(404).type('text/plain').send('Dosya yok: ' + req.path +
            '\nRender\'da css/ ve js/ klasörlerinin de yüklendiğinden emin ol.');
    }
    next();
});

function requireAuth(req, res, next) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const username = token && sessions.get(token);
    if (!username || !users[username]) return res.status(401).json({ error: 'Yetkisiz istek' });
    req.username = username;
    req.token = token;
    next();
}
function publicUser(username) {
    const u = users[username];
    return { username, maxUnlocked: u.maxUnlocked || 1, cleared: u.cleared || [] };
}

app.post('/api/register', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || username.trim().length < 3)
        return res.status(400).json({ error: 'Kullanıcı adı en az 3 karakter olmalı' });
    if (typeof password !== 'string' || password.length < 3)
        return res.status(400).json({ error: 'Şifre en az 3 karakter olmalı' });
    const name = username.trim();
    if (users[name]) return res.status(409).json({ error: 'Bu kullanıcı adı alınmış' });
    const salt = makeSalt();
    users[name] = ensureUserShape({ salt, hash: hashPassword(password, salt), maxUnlocked: 1, cleared: [] });
    saveUsers(users);
    const token = makeToken();
    sessions.set(token, name);
    res.json({ token, ...publicUser(name) });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string')
        return res.status(400).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    const name = username.trim();
    const u = users[name];
    if (!u) return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    if (hashPassword(password, u.salt) !== u.hash)
        return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
    const token = makeToken();
    sessions.set(token, name);
    res.json({ token, ...publicUser(name) });
});

app.post('/api/logout', requireAuth, (req, res) => {
    sessions.delete(req.token);
    res.json({ ok: true });
});
app.get('/api/me', requireAuth, (req, res) => res.json(publicUser(req.username)));

app.post('/api/progress', requireAuth, (req, res) => {
    const { maxUnlocked, cleared } = req.body || {};
    const u = users[req.username];
    if (typeof maxUnlocked === 'number' && maxUnlocked > (u.maxUnlocked || 1)) u.maxUnlocked = maxUnlocked;
    else if (!u.maxUnlocked) u.maxUnlocked = 1;
    if (Array.isArray(cleared)) {
        u.cleared = Array.from(new Set([...(u.cleared || []), ...cleared]));
    }
    saveUsers(users);
    res.json(publicUser(req.username));
});


const ADMIN_KEY = process.env.ADMIN_KEY || 'changeme';
function requireAdmin(req, res, next) {
    const key = req.headers['x-admin-key'] || req.query.key || '';
    // Varsayılan "changeme" ile asla izin verme — Render'da ADMIN_KEY zorunlu
    if (!ADMIN_KEY || ADMIN_KEY === 'changeme') {
        return res.status(403).json({ error: "Admin kapalı: Render ortaminda ADMIN_KEY ayarla" });
    }
    if (!key || key !== ADMIN_KEY) return res.status(403).json({ error: 'Yetkisiz' });
    next();
}
app.get('/api/admin/export', requireAdmin, (req, res) => {
    res.json({ exportedAt: new Date().toISOString(), users });
});
app.post('/api/admin/import', requireAdmin, (req, res) => {
    const incoming = req.body && req.body.users;
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return res.status(400).json({ error: 'Geçersiz veri' });
    }
    Object.keys(incoming).forEach(name => ensureUserShape(incoming[name]));
    users = incoming;
    saveUsers(users);
    sessions.clear();
    res.json({ ok: true, count: Object.keys(users).length });
});

const onlineSockets = new Map();
function isOnline(username) { return onlineSockets.has(username); }
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
        try { ws.send(JSON.stringify(obj)); } catch (e) {}
    }
}

app.get('/api/friends', requireAuth, (req, res) => res.json(friendsPayload(req.username)));

app.post('/api/friends/request', requireAuth, (req, res) => {
    const target = ((req.body && req.body.username) || '').trim();
    const me = req.username;
    if (!target || target === me) return res.status(400).json({ error: 'Geçersiz kullanıcı adı' });
    if (!users[target]) return res.status(404).json({ error: 'Böyle bir kullanıcı yok' });
    const meRec = users[me], targetRec = users[target];
    if (meRec.friends.includes(target)) return res.status(409).json({ error: 'Zaten arkadaşsınız' });
    if (meRec.incoming.includes(target)) {
        meRec.friends.push(target); targetRec.friends.push(me);
        meRec.incoming = meRec.incoming.filter(x => x !== target);
        targetRec.outgoing = targetRec.outgoing.filter(x => x !== me);
        saveUsers(users);
        sendTo(target, { type: 'friend_accepted', username: me });
        return res.json({ status: 'accepted', ...friendsPayload(me) });
    }
    if (meRec.outgoing.includes(target)) return res.status(409).json({ error: 'İstek zaten gönderildi' });
    meRec.outgoing.push(target); targetRec.incoming.push(me);
    saveUsers(users);
    sendTo(target, { type: 'friend_request', username: me });
    res.json({ status: 'sent', ...friendsPayload(me) });
});

app.post('/api/friends/accept', requireAuth, (req, res) => {
    const from = ((req.body && req.body.username) || '').trim();
    const me = req.username, meRec = users[me];
    if (!from || !meRec.incoming.includes(from) || !users[from])
        return res.status(400).json({ error: 'Böyle bir istek yok' });
    const fromRec = users[from];
    meRec.friends.push(from); fromRec.friends.push(me);
    meRec.incoming = meRec.incoming.filter(x => x !== from);
    fromRec.outgoing = fromRec.outgoing.filter(x => x !== me);
    saveUsers(users);
    sendTo(from, { type: 'friend_accepted', username: me });
    res.json(friendsPayload(me));
});

app.post('/api/friends/decline', requireAuth, (req, res) => {
    const from = ((req.body && req.body.username) || '').trim();
    const me = req.username, meRec = users[me];
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
    users[me].friends = users[me].friends.filter(x => x !== target);
    if (users[target]) users[target].friends = users[target].friends.filter(x => x !== me);
    saveUsers(users);
    res.json(friendsPayload(me));
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map(); // roomId -> { members: [name0, name1], slots: {name:0|1}, game: GameRoom, interval }

function leaveRoomForUser(username, ws) {
    const roomId = ws && ws.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.members = room.members.filter(m => m !== username);
    room.members.forEach(m => sendTo(m, { type: 'partner_left', roomId }));
    if (room.members.length === 0) {
        if (room.interval) clearInterval(room.interval);
        rooms.delete(roomId);
    }
    ws.roomId = null;
    ws.slot = null;
}

function broadcastRoom(roomId, obj) {
    const room = rooms.get(roomId);
    if (!room) return;
    room.members.forEach(m => sendTo(m, obj));
}

function startRoomLoop(roomId) {
    const room = rooms.get(roomId);
    if (!room || !room.game) return;
    if (room.interval) clearInterval(room.interval);
    room.interval = setInterval(() => {
        const snap = room.game.tick();
        broadcastRoom(roomId, { type: 'room_relay', payload: snap });
        if (snap.over) {
            broadcastRoom(roomId, { type: 'room_relay', payload: { kind: 'victory', winner: snap.winner, level: snap.level } });
            clearInterval(room.interval);
            room.interval = null;
        }
    }, TICK_MS);
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
            // Çift yerel motor: her iki istemci solo gibi çalışır, sunucu sadece komut iletir
            const roomId = makeRoomId();
            const level = msg.level || 1;
            const room = {
                members: [to, ws.username],
                slots: { [to]: 0, [ws.username]: 1 },
                game: null,
                interval: null,
                inputSeq: 0,
            };
            rooms.set(roomId, room);
            const inviterWs = onlineSockets.get(to);
            if (inviterWs) { inviterWs.roomId = roomId; inviterWs.slot = 0; }
            ws.roomId = roomId;
            ws.slot = 1;
            sendTo(to, { type: 'coop_start', roomId, slot: 0, level, partner: ws.username });
            ws.send(JSON.stringify({ type: 'coop_start', roomId, slot: 1, level, partner: to }));
            return;
        }
        if (msg.type === 'room_input') {
            const room = rooms.get(msg.roomId);
            if (!room || !room.members.includes(ws.username)) return;
            const slot = room.slots[ws.username];
            if (slot === undefined) return;
            room.inputSeq = (room.inputSeq || 0) + 1;
            const payload = { kind: 'input', action: msg.action, slot, seq: room.inputSeq };
            // Her iki oyuncuya da gönder (gönderen dahil) — aynı sırada uygulansın
            room.members.forEach(m => sendTo(m, { type: 'room_relay', payload }));
            return;
        }
        if (msg.type === 'ping') {
            const room = rooms.get(ws.roomId);
            const now = Date.now();
            if (room && room.game && room.slots[ws.username] !== undefined) {
                const slot = room.slots[ws.username];
                room.game.lastMsgAt[slot] = now;
                if (typeof msg.t === 'number') {
                    // client RTT reported optionally
                }
            }
            ws.send(JSON.stringify({ type: 'pong', t: msg.t, serverTime: now }));
            return;
        }
        if (msg.type === 'rtt') {
            const room = rooms.get(ws.roomId);
            if (room && room.game && room.slots[ws.username] !== undefined) {
                room.game.setRtt(room.slots[ws.username], msg.rtt || 0);
            }
            return;
        }
        if (msg.type === 'leave_room') {
            leaveRoomForUser(ws.username, ws);
        }
    });
    ws.on('close', () => {
        if (ws.username) {
            if (onlineSockets.get(ws.username) === ws) onlineSockets.delete(ws.username);
            leaveRoomForUser(ws.username, ws);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Çöp Adam Savaşları: http://localhost:${PORT}`);
    console.log(`Oyun: ${HTML_FILE} | Veri: ${DATA_DIR}`);
    const need = [
        HTML_FILE,
        'style.css',
        '01-core.js',
        '02-units.js',
        '03-draw.js',
        '04-gameplay.js',
        '05-menu-network.js',
    ];
    need.forEach(f => {
        const full = path.join(__dirname, f);
        console.log(fs.existsSync(full) ? `  ✓ ${f}` : `  ✗ EKSİK: ${f}`);
    });
});
