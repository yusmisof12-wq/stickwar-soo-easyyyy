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
function jitter(n) { return Math.round((Math.random() * 2 - 1) * n); }
function makeCoopLayout() {
    const worldWidth = 2600;
    const spots = [
        { x: 220, y: -50 },
        { x: 220, y: 50 },
        { x: 180, y: -80 },
        { x: 180, y: 80 }
    ];
    return {
        worldWidth,
        playerBaseX: 130,
        enemyBaseX: worldWidth - 130,
        pMines: spots.map(p => ({ x: p.x + jitter(10), y: p.y + jitter(10) })),
        eMines: spots.map(p => ({ x: -p.x + jitter(10), y: p.y + jitter(10) })),
    };
}
const app = express();
app.use(cors());
app.use(express.json());
const publicRoot = __dirname;
app.use(express.static(publicRoot, {
    index: false,
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
    const musicDir = path.join(publicRoot, 'music');
    const musicDirExists = fs.existsSync(musicDir) && fs.statSync(musicDir).isDirectory();
    let musicFiles = [];
    if (musicDirExists) {
        try { musicFiles = fs.readdirSync(musicDir); } catch (e) { musicFiles = ['okuma hatası: ' + e.message]; }
    }
    const menuMp3 = fs.existsSync(path.join(musicDir, 'menu.mp3'));
    const battleMp3 = fs.existsSync(path.join(musicDir, 'battle.mp3'));
    res.json({
        ok: true,
        html: fs.existsSync(path.join(publicRoot, HTML_FILE)),
        css: cssOk,
        js: jsOk,
        publicRoot,
        files: fs.readdirSync(publicRoot),
        music: {
            klasorVar: musicDirExists,
            klasorIcerigi: musicFiles,
            'menu.mp3': menuMp3,
            'battle.mp3': battleMp3
        }
    });
});
app.use((req, res, next) => {
    if (req.path.endsWith('.css') || req.path.endsWith('.js')) {
        return res.status(404).type('text/plain').send('Dosya yok: ' + req.path);
    }
    if (req.path.endsWith('.mp3')) {
        return res.status(404).type('text/plain').send(
            'Ses dosyası bulunamadı: ' + req.path +
            '\nBeklenen tam yol: ' + path.join(publicRoot, req.path)
        );
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
const rooms = new Map();
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
            const roomId = makeRoomId();
            const level = msg.level || 1;
            const layout = makeCoopLayout();
            const room = {
                members: [to, ws.username],
                slots: { [to]: 0, [ws.username]: 1 },
                game: null,
                interval: null,
                inputSeq: 0,
                layout,
            };
            rooms.set(roomId, room);
            const inviterWs = onlineSockets.get(to);
            if (inviterWs) { inviterWs.roomId = roomId; inviterWs.slot = 0; }
            ws.roomId = roomId;
            ws.slot = 1;
            sendTo(to, { type: 'coop_start', roomId, slot: 0, level, partner: ws.username, layout });
            ws.send(JSON.stringify({ type: 'coop_start', roomId, slot: 1, level, partner: to, layout }));
            return;
        }
        if (msg.type === 'room_input') {
            const room = rooms.get(msg.roomId);
            if (!room || !room.members.includes(ws.username)) return;
            const slot = room.slots[ws.username];
            if (slot === undefined) return;
            room.inputSeq = (room.inputSeq || 0) + 1;
            const payload = { kind: 'input', action: msg.action, slot, seq: room.inputSeq };
            room.members.forEach(m => sendTo(m, { type: 'room_relay', payload }));
            return;
        }
        if (msg.type === 'ping') {
            const now = Date.now();
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
        console.log(fs.existsSync(full) ? ` ✓ ${f}` : ` ✗ EKSİK: ${f}`);
    });
    const musicNeed = ['music/menu.mp3', 'music/battle.mp3'];
    musicNeed.forEach(f => {
        const full = path.join(__dirname, f);
        console.log(fs.existsSync(full) ? ` ✓ ${f}` : ` ✗ EKSİK: ${f}`);
    });
});
