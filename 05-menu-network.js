// ==================== HESAP + MENÜ + SEFER ====================
const TOKEN_KEY = 'copAdamToken_v1';
const LOCAL_USERS_KEY = 'copAdamUsersHashed_v1';
const LOCAL_SESSION_KEY = 'copAdamLocalSession_v1';
const API_BASE = (typeof location !== 'undefined' && location.protocol.startsWith('http'))
    ? ''
    : 'http://127.0.0.1:3847';

let currentUser = null;
let authMode = 'login';
let gameStarted = false;
let useServer = true;

const authScreen = document.getElementById('authScreen');
const mainMenu = document.getElementById('mainMenu');
const campaignScreen = document.getElementById('campaignScreen');
const gameContainer = document.getElementById('game-container');
const friendsScreen = document.getElementById('friendsScreen');
const friendsIncomingList = document.getElementById('friendsIncomingList');
const friendsList = document.getElementById('friendsList');
const friendAddInput = document.getElementById('friendAddInput');
const friendAddError = document.getElementById('friendAddError');
const levelChoiceModal = document.getElementById('levelChoiceModal');
const levelChoiceTitle = document.getElementById('levelChoiceTitle');
const friendPickerModal = document.getElementById('friendPickerModal');
const friendPickerList = document.getElementById('friendPickerList');
const coopWaitingModal = document.getElementById('coopWaitingModal');
const coopWaitingText = document.getElementById('coopWaitingText');
const coopInviteModal = document.getElementById('coopInviteModal');
const coopInviteText = document.getElementById('coopInviteText');
const toastContainer = document.getElementById('toastContainer');
const authUser = document.getElementById('authUser');
const authPass = document.getElementById('authPass');
const authError = document.getElementById('authError');
const authSubmit = document.getElementById('authSubmit');
const tabLogin = document.getElementById('tabLogin');
const tabRegister = document.getElementById('tabRegister');
const userChip = document.getElementById('userChip');
const campaignFlag = document.getElementById('campaignFlag');

function loadLocalUsers() {
    try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '{}'); }
    catch (e) { return {}; }
}
function saveLocalUsers(db) {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(db));
}

async function hashPass(password, salt) {
    const enc = new TextEncoder();
    const data = enc.encode(salt + '::' + password);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function randomSalt() {
    const a = new Uint8Array(16);
    crypto.getRandomValues(a);
    return Array.from(a).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function api(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
        const res = await fetch(API_BASE + path, {
            method: options.method || 'GET',
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
            signal: ctrl.signal,
        });
        let data = null;
        try { data = await res.json(); } catch (_) { data = {}; }
        if (!res.ok) {
            const err = new Error((data && data.error) || ('HTTP ' + res.status));
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data;
    } finally {
        clearTimeout(timer);
    }
}

// ==================== WEBSOCKET / ARKADAŞ / CO-OP SİSTEMİ ====================
let ws = null;
let coopSession = null;
let pendingCoopInvite = null;
let pendingLevelChoice = null;
let latestHostSnapshot = null;
let coopGuestLoopId = null;
let coopBroadcastCounter = 0;
let coopVictoryHandled = false;
let coopNextLevelRequested = false;

function isCoopPlayNow() { return !!(typeof coopSession !== 'undefined' && coopSession && coopSession.roomId); }
function myCoopSlot() { return coopSession ? (coopSession.slot|0) : 0; }
function isSimPeer() { return isCoopPlayNow(); }
function isCoopGuestNow() { return false; }
function isCoopHostNow() { return false; }

function wsUrl() {
    const loc = window.location;
    if (loc.protocol === 'http:' || loc.protocol === 'https:') {
        const proto = loc.protocol === 'https:' ? 'wss:' : 'ws:';
        return proto + '//' + loc.host + '/ws';
    }
    return 'ws://127.0.0.1:3847/ws';
}

let wsReconnectTimer = null;
let wsAuthOk = false;

function scheduleWSReconnect() {
    if (wsReconnectTimer || !useServer || !currentUser) return;
    wsReconnectTimer = setTimeout(() => {
        wsReconnectTimer = null;
        connectWS();
    }, 1000);
}

function connectWS() {
    if (!useServer || !currentUser) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    wsAuthOk = false;
    try {
        ws = new WebSocket(wsUrl());
    } catch (e) {
        scheduleWSReconnect();
        return;
    }
    ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'auth', token }));
    };
    ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.type === 'auth_ok') { if (typeof startPingLoop === 'function') startPingLoop(); }
        if (msg.type === 'auth_error') {
            wsAuthOk = false;
            try { ws.close(); } catch (e) {}
            return;
        }
        handleWsMessage(msg);
    };
    ws.onclose = () => {
        ws = null;
        wsAuthOk = false;
        scheduleWSReconnect();
    };
    ws.onerror = () => {
        wsAuthOk = false;
    };
}

function wsSend(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
}

function showToast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    toastContainer.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function handleWsMessage(msg) {
    if (msg.type === 'friend_request') {
        showToast('👤 ' + msg.username + ' sana arkadaşlık isteği gönderdi');
        if (!friendsScreen.classList.contains('hidden')) refreshFriendsPanel();
        return;
    }
    if (msg.type === 'friend_accepted') {
        showToast('👤 ' + msg.username + ' arkadaşlık isteğini kabul etti');
        if (!friendsScreen.classList.contains('hidden')) refreshFriendsPanel();
        return;
    }
    if (msg.type === 'pong') {
        if (typeof msg.t === 'number') {
            currentPing = Math.max(0, Date.now() - msg.t);
            wsSend({ type: 'rtt', rtt: currentPing });
            updatePingUI();
        }
        return;
    }
    if (msg.type === 'coop_invite') {
        pendingCoopInvite = { from: msg.from, level: msg.level };
        coopInviteText.textContent = msg.from + ' seni ' + msg.level + '. bölüme davet ediyor';
        coopInviteModal.classList.remove('hidden');
        return;
    }
    if (msg.type === 'coop_declined') {
        coopWaitingModal.classList.add('hidden');
        showToast(msg.from + ' daveti reddetti');
        return;
    }
    if (msg.type === 'invite_sent') {
        coopWaitingText.textContent = 'Arkadaşına davet gönderildi, bekleniyor...';
        return;
    }
    if (msg.type === 'coop_start') {
        coopWaitingModal.classList.add('hidden');
        coopInviteModal.classList.add('hidden');
        coopSession = { roomId: msg.roomId, slot: msg.slot|0, partner: msg.partner, layout: msg.layout || null };
        coopVictoryHandled = false;
        coopNextLevelRequested = false;
        if (typeof applySharedWorldLayout === 'function') applySharedWorldLayout(msg.layout);
        beginCoopLevel(msg.level);
        return;
    }
    if (msg.type === 'partner_left') {
        if (coopSession) {
            showToast('Arkadaşın oyundan ayrıldı.');
            leaveCoopSession();
        }
        return;
    }
    if (msg.type === 'room_relay') {
        handleRoomRelay(msg.payload);
        return;
    }
    if (msg.type === 'error') {
        showToast(msg.error);
        return;
    }
}

async function refreshFriendsPanel() {
    if (!useServer) {
        friendsIncomingList.innerHTML = '';
        friendsList.innerHTML = '<div class="friend-empty">Arkadaş sistemi için sunucu bağlantısı gerekli.</div>';
        return;
    }
    try {
        const data = await api('/api/friends');
        renderFriendsPanel(data);
    } catch (e) {
        friendsList.innerHTML = '<div class="friend-empty">Arkadaşlar yüklenemedi.</div>';
    }
}

function renderFriendsPanel(data) {
    friendsIncomingList.innerHTML = '';
    const incoming = data.incoming || [];
    if (incoming.length === 0) {
        friendsIncomingList.innerHTML = '<div class="friend-empty">Bekleyen istek yok.</div>';
    }
    incoming.forEach(name => {
        const row = document.createElement('div');
        row.className = 'friend-row';
        const label = document.createElement('span');
        label.textContent = name;
        row.appendChild(label);
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'menu-btn primary small';
        acceptBtn.textContent = 'Kabul Et';
        acceptBtn.onclick = async () => {
            await api('/api/friends/accept', { method: 'POST', body: { username: name } });
            refreshFriendsPanel();
        };
        const declineBtn = document.createElement('button');
        declineBtn.className = 'menu-btn danger small';
        declineBtn.textContent = 'Reddet';
        declineBtn.onclick = async () => {
            await api('/api/friends/decline', { method: 'POST', body: { username: name } });
            refreshFriendsPanel();
        };
        row.appendChild(acceptBtn);
        row.appendChild(declineBtn);
        friendsIncomingList.appendChild(row);
    });

    friendsList.innerHTML = '';
    const friendsArr = data.friends || [];
    if (friendsArr.length === 0) {
        friendsList.innerHTML = '<div class="friend-empty">Henüz arkadaşın yok. Yukarıdan kullanıcı adıyla istek gönder.</div>';
    }
    friendsArr.forEach(f => {
        const row = document.createElement('div');
        row.className = 'friend-row';
        row.innerHTML = '<span class="dot ' + (f.online ? 'dot-online' : 'dot-offline') + '"></span>';
        const label = document.createElement('span');
        label.textContent = f.username;
        row.appendChild(label);
        const removeBtn = document.createElement('button');
        removeBtn.className = 'menu-btn danger small';
        removeBtn.textContent = 'Çıkar';
        removeBtn.onclick = async () => {
            await api('/api/friends/remove', { method: 'POST', body: { username: f.username } });
            refreshFriendsPanel();
        };
        row.appendChild(removeBtn);
        friendsList.appendChild(row);
    });

    if ((data.outgoing || []).length) {
        const pend = document.createElement('div');
        pend.className = 'friend-empty';
        pend.textContent = 'Gönderdiğin bekleyen istekler: ' + data.outgoing.join(', ');
        friendsList.appendChild(pend);
    }
}

document.getElementById('btnFriends').onclick = () => {
    showScreen('friends');
    refreshFriendsPanel();
};
document.getElementById('btnFriendsBack').onclick = () => showScreen('menu');

document.getElementById('btnAddFriend').onclick = async () => {
    const name = friendAddInput.value.trim();
    friendAddError.textContent = '';
    if (!name) return;
    if (!useServer) {
        friendAddError.textContent = 'Arkadaş sistemi için sunucu bağlantısı gerekli.';
        return;
    }
    try {
        await api('/api/friends/request', { method: 'POST', body: { username: name } });
        friendAddInput.value = '';
        refreshFriendsPanel();
    } catch (e) {
        friendAddError.textContent = e.message || 'İstek gönderilemedi';
    }
};

document.querySelectorAll('.campaign-node').forEach(node => {
    node.onclick = () => {
        const lv = parseInt(node.dataset.level, 10);
        if (lv > (currentUser.maxUnlocked || 1)) {
            alert('Bu bölüm henüz kilitli!');
            return;
        }
        pendingLevelChoice = lv;
        levelChoiceTitle.textContent = 'Bölüm ' + lv;
        document.getElementById('btnPlayWithFriend').style.display = '';
        levelChoiceModal.classList.remove('hidden');
    };
});

document.getElementById('btnPlaySolo').onclick = () => {
    const lv = Number(pendingLevelChoice);
    levelChoiceModal.classList.add('hidden');
    if (lv >= 1 && lv <= 3) startCampaignLevel(lv);
};

document.getElementById('btnLevelChoiceCancel').onclick = () => {
    levelChoiceModal.classList.add('hidden');
};

document.getElementById('btnPlayWithFriend').onclick = async () => {
    levelChoiceModal.classList.add('hidden');
    try {
        const data = await api('/api/friends');
        const onlineFriends = (data.friends || []).filter(f => f.online);
        if (onlineFriends.length === 0) {
            alert('Şu an çevrimiçi arkadaşın yok. Arkadaşının da oyunu açık tutması gerekiyor.');
            return;
        }
        friendPickerList.innerHTML = '';
        onlineFriends.forEach(f => {
            const btn = document.createElement('button');
            btn.className = 'menu-btn primary friend-picker-btn';
            btn.textContent = f.username;
            btn.onclick = () => {
                friendPickerModal.classList.add('hidden');
                coopWaitingText.textContent = f.username + ' bekleniyor...';
                coopWaitingModal.classList.remove('hidden');
                wsSend({ type: 'coop_invite', to: f.username, level: pendingLevelChoice });
            };
            friendPickerList.appendChild(btn);
        });
        friendPickerModal.classList.remove('hidden');
    } catch (e) {
        alert('Arkadaş listesi alınamadı.');
    }
};

document.getElementById('btnFriendPickerCancel').onclick = () => {
    friendPickerModal.classList.add('hidden');
};

document.getElementById('btnCoopWaitingCancel').onclick = () => {
    coopWaitingModal.classList.add('hidden');
    if (coopSession) wsSend({ type: 'leave_room', roomId: coopSession.roomId });
    coopSession = null;
};

document.getElementById('btnCoopInviteAccept').onclick = () => {
    coopInviteModal.classList.add('hidden');
    if (pendingCoopInvite) {
        wsSend({ type: 'coop_response', to: pendingCoopInvite.from, accept: true, level: pendingCoopInvite.level });
    }
    pendingCoopInvite = null;
};
document.getElementById('btnCoopInviteDecline').onclick = () => {
    coopInviteModal.classList.add('hidden');
    if (pendingCoopInvite) {
        wsSend({ type: 'coop_response', to: pendingCoopInvite.from, accept: false });
    }
    pendingCoopInvite = null;
};

function beginCoopLevel(lv) {
    lv = Number(lv) || 1;
    level = lv;
    isGameOver = false;
    gameStarted = true;
    coopVictoryHandled = false;
    const layout = (coopSession && coopSession.layout) ? coopSession.layout : null;
    if (typeof applySharedWorldLayout === 'function') applySharedWorldLayout(layout);
    showScreen('game');
    resizeCanvas();
    if (typeof resetLevel === 'function') resetLevel();
    if (typeof applySharedWorldLayout === 'function') applySharedWorldLayout(layout);
    if (typeof updateMineSlots === 'function') updateMineSlots(false);
    player2.gold = 300;
    player2.command = CMD_DEFEND;
    player2.minerQueue = []; player2.combatQueue = [];
    player2.minerTimer = 0; player2.combatTimer = 0;
    player2.minerTimerMax = 0; player2.combatTimerMax = 0;
    updateActionButtonsUI();
    stopCoopGuestRenderLoop();
    startGameLoop();
    showToast('Arkadaş seferi · Oyuncu ' + (myCoopSlot() + 1) + ' (mavi=2)');
}

function showCoopVictory(lv, winner) {
    if (coopVictoryHandled) return;
    coopVictoryHandled = true;
    isGameOver = true;
    stopCoopGuestRenderLoop();
    if (winner === 'enemy') {
        modalTitle.innerText = 'Kaybettiniz!';
    } else {
        modalTitle.innerText = Number(lv) >= 3 ? 'Tebrikler! Seferi Bitirdiniz!' : 'Bölüm Tamamlandı!';
    }
    modalBtn.innerText = 'Sefer Haritası';
    modal.classList.remove('hidden');
    modalBtn.onclick = () => {
        modal.classList.add('hidden');
        leaveCoopSession();
        if (typeof openCampaignMap === 'function') openCampaignMap(true);
    };
}

function leaveCoopSession() {
    stopCoopGuestRenderLoop();
    if (coopSession) {
        wsSend({ type: 'leave_room', roomId: coopSession.roomId });
    }
    coopSession = null;
    if (typeof clearSharedWorldLayout === 'function') clearSharedWorldLayout();
    stopGameLoop();
    showScreen('menu');
}

function sendRoomInput(action) {
    if (!coopSession) return;
    wsSend({ type: 'room_input', roomId: coopSession.roomId, action });
}

function handleRoomRelay(payload) {
    if (!coopSession || !payload) return;
    if (payload.kind === 'input') {
        applyCoopInput(payload.slot|0, payload.action);
        return;
    }
    if (payload.kind === 'victory') {
        showCoopVictory(payload.level, payload.winner);
    }
}

function applyCoopInput(slot, action) {
    if (!isCoopPlayNow()) return;
    if (action === 'buyMiner') queueUnit('miner', slot);
    else if (action === 'buyClub') queueUnit('club', slot);
    else if (action === 'buyArcher') queueUnit('archer', slot);
    else if (action === 'attack') {
        if (slot === 1) player2.command = CMD_ATTACK;
        else player.command = CMD_ATTACK;
        // Co-op'ta iki oyuncudan hangisi komut verirse versin düşman aynı komutu alır.
        // room_relay ile her iki istemciye de aynı sırada geldiği için senkron bozulmaz.
        if (typeof mirrorEnemyCommand === 'function') mirrorEnemyCommand(CMD_ATTACK);
    } else if (action === 'defend') {
        if (slot === 1) player2.command = CMD_DEFEND;
        else player.command = CMD_DEFEND;
        if (typeof mirrorEnemyCommand === 'function') mirrorEnemyCommand(CMD_DEFEND);
    } else if (action === 'retreat') {
        if (slot === 1) player2.command = CMD_RETREAT;
        else player.command = CMD_RETREAT;
        if (typeof mirrorEnemyCommand === 'function') mirrorEnemyCommand(CMD_RETREAT);
    }
    updateActionButtonsUI();
}

function stopCoopGuestRenderLoop() {
    if (coopGuestLoopId) cancelAnimationFrame(coopGuestLoopId);
    coopGuestLoopId = null;
}

async function localRegister(username, password) {
    const db = loadLocalUsers();
    if (db[username]) throw new Error('Bu kullanıcı adı alınmış');
    const salt = randomSalt();
    const passHash = await hashPass(password, salt);
    db[username] = { salt, passHash, maxUnlocked: 1, cleared: [] };
    saveLocalUsers(db);
    localStorage.setItem(LOCAL_SESSION_KEY, username);
    return { username, maxUnlocked: 1, cleared: [] };
}

async function localLogin(username, password) {
    const db = loadLocalUsers();
    const u = db[username];
    if (!u) throw new Error('Kullanıcı adı veya şifre hatalı');
    const check = await hashPass(password, u.salt);
    if (check !== u.passHash) throw new Error('Kullanıcı adı veya şifre hatalı');
    localStorage.setItem(LOCAL_SESSION_KEY, username);
    return {
        username,
        maxUnlocked: u.maxUnlocked || 1,
        cleared: u.cleared || [],
    };
}

async function saveCurrentUser() {
    if (!currentUser) return;
    if (useServer) {
        try {
            const data = await api('/api/progress', {
                method: 'POST',
                body: {
                    maxUnlocked: currentUser.maxUnlocked,
                    cleared: currentUser.cleared,
                },
            });
            currentUser.maxUnlocked = data.maxUnlocked;
            currentUser.cleared = data.cleared;
            return;
        } catch (e) {
            useServer = false;
        }
    }
    const db = loadLocalUsers();
    if (db[currentUser.username]) {
        db[currentUser.username].maxUnlocked = currentUser.maxUnlocked;
        db[currentUser.username].cleared = currentUser.cleared;
        saveLocalUsers(db);
    }
}

function showScreen(which) {
    authScreen.classList.add('hidden');
    mainMenu.classList.add('hidden');
    campaignScreen.classList.add('hidden');
    friendsScreen.classList.add('hidden');
    if (which === 'auth') authScreen.classList.remove('hidden');
    if (which === 'menu') mainMenu.classList.remove('hidden');
    if (which === 'campaign') campaignScreen.classList.remove('hidden');
    if (which === 'friends') friendsScreen.classList.remove('hidden');
    if (which === 'game') {
        gameContainer.classList.remove('menu-hidden');
    } else {
        gameContainer.classList.add('menu-hidden');
    }

    if (typeof setMusicMode === 'function') {
        if (which === 'game') setMusicMode('battle');
        else setMusicMode('menu');
    }
}

function stopGameLoop() {
    isGameOver = true;
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    modal.classList.add('hidden');
    gameStarted = false;
}

function enterMainMenu() {
    stopGameLoop();
    userChip.textContent = '👤 ' + currentUser.username;
    showScreen('menu');
    connectWS();
    if (typeof startPingLoop === 'function') startPingLoop();
}

tabLogin.onclick = () => {
    authMode = 'login';
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    authSubmit.textContent = 'Giriş Yap';
    authError.textContent = '';
};
tabRegister.onclick = () => {
    authMode = 'register';
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    authSubmit.textContent = 'Hesap Oluştur';
    authError.textContent = '';
};

authSubmit.onclick = async () => {
    const u = (authUser.value || '').trim();
    const p = authPass.value || '';
    authError.textContent = '';
    if (u.length < 3) { authError.textContent = 'Kullanıcı adı en az 3 karakter olmalı'; return; }
    if (p.length < 3) { authError.textContent = 'Şifre en az 3 karakter olmalı'; return; }

    authSubmit.disabled = true;
    const prevText = authSubmit.textContent;
    authSubmit.textContent = 'Bekle...';
    try {
        let data = null;
        if (useServer) {
            try {
                const path = authMode === 'register' ? '/api/register' : '/api/login';
                data = await api(path, {
                    method: 'POST',
                    body: { username: u, password: p },
                });
                localStorage.setItem(TOKEN_KEY, data.token);
                localStorage.removeItem(LOCAL_SESSION_KEY);
            } catch (e) {
                if (e.status && e.status >= 400 && e.status < 500) throw e;
                useServer = false;
            }
        }
        if (!data) {
            data = authMode === 'register'
                ? await localRegister(u, p)
                : await localLogin(u, p);
            localStorage.removeItem(TOKEN_KEY);
        }
        currentUser = {
            username: data.username,
            maxUnlocked: data.maxUnlocked || 1,
            cleared: data.cleared || [],
        };
        authPass.value = '';
        enterMainMenu();
    } catch (e) {
        authError.textContent = e.message || 'Giriş başarısız';
    } finally {
        authSubmit.disabled = false;
        authSubmit.textContent = prevText;
    }
};

document.getElementById('btnLogout').onclick = async () => {
    try { if (useServer) await api('/api/logout', { method: 'POST' }); } catch (_) {}
    currentUser = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOCAL_SESSION_KEY);
    authUser.value = '';
    authPass.value = '';
    showScreen('auth');
};

document.getElementById('btnMultiplayer').onclick = () => {
    alert('Multiplayer yakında geliyor!');
};

document.getElementById('btnCampaign').onclick = () => {
    openCampaignMap(false);
};
document.getElementById('btnCampaignBack').onclick = () => {
    showScreen('menu');
};

const NODE_POS = {
    1: { left: '15.5%', top: '73%' },
    2: { left: '50%', top: '38%' },
    3: { left: '84%', top: '23%' }
};

function setFlagToLevel(lv, animate) {
    const pos = NODE_POS[lv] || NODE_POS[1];
    if (!animate) {
        campaignFlag.style.transition = 'none';
    } else {
        campaignFlag.style.transition = 'left 1.2s cubic-bezier(0.4,0,0.2,1), top 1.2s cubic-bezier(0.4,0,0.2,1)';
    }
    campaignFlag.style.left = pos.left;
    campaignFlag.style.top = pos.top;
    if (!animate) {
        void campaignFlag.offsetWidth;
        campaignFlag.style.transition = 'left 1.2s cubic-bezier(0.4,0,0.2,1), top 1.2s cubic-bezier(0.4,0,0.2,1)';
    }
}

function refreshCampaignNodes() {
    document.querySelectorAll('.campaign-node').forEach(node => {
        const lv = parseInt(node.dataset.level, 10);
        node.classList.remove('locked', 'cleared', 'current');
        const unlocked = lv <= (currentUser.maxUnlocked || 1);
        const cleared = (currentUser.cleared || []).includes(lv);
        if (!unlocked) node.classList.add('locked');
        else if (cleared) node.classList.add('cleared');
        if (lv === Math.min(currentUser.maxUnlocked || 1, 3) && !cleared) node.classList.add('current');
        if (lv === 3 && cleared) node.classList.add('current');
    });
}

function openCampaignMap(fromVictory) {
    levelChoiceModal.classList.add('hidden');
    showScreen('campaign');
    refreshCampaignNodes();
    const flagLv = Math.min(currentUser.maxUnlocked || 1, 3);
    setFlagToLevel(fromVictory ? Math.max(1, flagLv - 1) : flagLv, false);
    if (fromVictory) {
        setTimeout(() => setFlagToLevel(flagLv, true), 80);
    }
}

function startCampaignLevel(lv) {
    lv = Number(lv);
    if (!Number.isInteger(lv) || lv < 1 || lv > 3) return;
    if (!currentUser) {
        showScreen('auth');
        return;
    }

    const maxUnlocked = Number(currentUser.maxUnlocked || 1);
    if (lv > maxUnlocked) {
        alert('Bu bölüm henüz kilitli!');
        return;
    }

    levelChoiceModal.classList.add('hidden');
    friendPickerModal.classList.add('hidden');
    coopWaitingModal.classList.add('hidden');
    coopInviteModal.classList.add('hidden');
    coopSession = null;
    if (typeof clearSharedWorldLayout === 'function') clearSharedWorldLayout();

    if (typeof stopGameLoop === 'function') stopGameLoop();

    level = lv;
    isGameOver = false;
    gameStarted = false;

    showScreen('game');
    resizeCanvas();
    resetLevel();
    if (typeof player2 !== "undefined") {
        player2.gold = 300;
        player2.command = CMD_DEFEND;
        player2.minerQueue = []; player2.minerTimer = 0; player2.minerTimerMax = 0;
        player2.combatQueue = []; player2.combatTimer = 0; player2.combatTimerMax = 0;
    }

    gameStarted = true;
    lastFrameTime = 0;
    accumulatedTime = 0;

    updateActionButtonsUI();
    draw();
    startGameLoop();
}

function onLevelVictory() {
    if (!currentUser) return;
    const completed = Math.max(1, level);
    if (!currentUser.cleared.includes(completed)) currentUser.cleared.push(completed);
    if (completed >= currentUser.maxUnlocked && currentUser.maxUnlocked < 3) {
        currentUser.maxUnlocked = completed + 1;
    }
    if (completed >= 3) currentUser.maxUnlocked = 3;
    saveCurrentUser();
}

modalBtn.onclick = () => {
    if (isCoopHostNow() && coopVictoryHandled && isGameOver) {
        const nextLevel = level;
        if (nextLevel <= 3) {
            modal.classList.add('hidden');
            coopNextLevelRequested = true;
            wsSend({
                type: 'room_relay',
                roomId: coopSession.roomId,
                payload: { kind: 'next_level', level: nextLevel }
            });
            beginCoopLevel(nextLevel);
        } else {
            modal.classList.add('hidden');
            leaveCoopSession();
        }
        return;
    }
    if (isCoopGuestNow() && coopVictoryHandled) {
        showToast('Diğer oyuncu sonraki bölümü başlatıyor...');
        return;
    }
    modal.classList.add('hidden');
    if (player.base.hp <= 0) {
        isGameOver = false;
        resetLevel();
        startGameLoop();
        return;
    }
    stopGameLoop();
    openCampaignMap(true);
};

(async function bootMenu() {
    const token = localStorage.getItem(TOKEN_KEY);
    useServer = true;
    try {
        if (token) {
            const data = await api('/api/me');
            currentUser = {
                username: data.username,
                maxUnlocked: data.maxUnlocked || 1,
                cleared: data.cleared || [],
            };
            enterMainMenu();
            return;
        }
    } catch (e) {
        if (e && e.status === 401) {
            localStorage.removeItem(TOKEN_KEY);
        } else {
            useServer = false;
        }
    }

    const localName = localStorage.getItem(LOCAL_SESSION_KEY);
    if (localName) {
        const db = loadLocalUsers();
        if (db[localName]) {
            currentUser = {
                username: localName,
                maxUnlocked: db[localName].maxUnlocked || 1,
                cleared: db[localName].cleared || [],
            };
            enterMainMenu();
            return;
        }
        localStorage.removeItem(LOCAL_SESSION_KEY);
    }
    showScreen('auth');
})();

// ==================== MÜZİK ====================
const MUSIC_KEY = 'copAdamMusicMuted_v1';
const MUSIC_VOL_KEY = 'copAdamMusicVol_v1';
let musicMuted = localStorage.getItem(MUSIC_KEY) === '1';
let musicVol = Math.min(1, Math.max(0.1, (parseInt(localStorage.getItem(MUSIC_VOL_KEY) || '55', 10) || 55) / 100));
let musicMode = 'menu';
let audioMenu = null;
let audioBattle = null;

function ensureMusicHud() {
    let hud = document.getElementById('musicHud');
    if (!hud) {
        hud = document.createElement('div');
        hud.id = 'musicHud';
        hud.innerHTML = '<button type="button" id="musicBtn" title="Müzik">🎵</button>' +
            '<input type="range" id="musicVol" min="0" max="100" value="55" title="Ses">';
        document.body.appendChild(hud);
    } else if (hud.parentElement !== document.body) {
        document.body.appendChild(hud);
    }
    return hud;
}

function musicUrl(name) {
    return name; // Artık 'music/' klasörüne bakmaz, doğrudan kök dosyayı çağırır.
}
function ensureTracks() {
    if (!audioMenu) {
        audioMenu = new Audio(musicUrl('menu.mp3'));
        audioMenu.loop = true;
        audioMenu.preload = 'auto';
    }
    if (!audioBattle) {
        audioBattle = new Audio(musicUrl('battle.mp3'));
        audioBattle.loop = true;
        audioBattle.preload = 'auto';
    }
}

function volFor(mode) {
    if (musicMuted) return 0;
    return musicVol * (mode === 'battle' ? 0.9 : 0.65);
}

function applyVolumes() {
    if (audioMenu) audioMenu.volume = volFor('menu');
    if (audioBattle) audioBattle.volume = volFor('battle');
}

async function playTrack(mode) {
    ensureTracks();
    musicMode = mode === 'battle' ? 'battle' : 'menu';
    applyVolumes();
    updateMusicBtn();
    if (musicMuted) {
        try { audioMenu.pause(); audioBattle.pause(); } catch (_) {}
        return;
    }
    const want = musicMode === 'battle' ? audioBattle : audioMenu;
    const other = musicMode === 'battle' ? audioMenu : audioBattle;
    try { other.pause(); } catch (_) {}
    try {
        await want.play();
    } catch (e) {
        console.warn('[müzik] autoplay bekleniyor — ekrana tıkla', e.message);
    }
}

function setMusicMode(mode) { playTrack(mode); }

function setMusicVolume(v) {
    musicVol = Math.min(1, Math.max(0, v));
    localStorage.setItem(MUSIC_VOL_KEY, String(Math.round(musicVol * 100)));
    applyVolumes();
    const volEl = document.getElementById('musicVol');
    if (volEl) volEl.value = String(Math.round(musicVol * 100));
}

function updateMusicBtn() {
    const btn = document.getElementById('musicBtn');
    if (!btn) return;
    btn.textContent = musicMuted ? '🔇' : '🎵';
    btn.classList.toggle('muted', musicMuted);
}

function toggleMusic() {
    musicMuted = !musicMuted;
    localStorage.setItem(MUSIC_KEY, musicMuted ? '1' : '0');
    playTrack(musicMode);
}

(function initMusicUI() {
    ensureMusicHud();
    ensureTracks();
    const btn = document.getElementById('musicBtn');
    const vol = document.getElementById('musicVol');
    if (vol) {
        vol.value = String(Math.round(musicVol * 100));
        vol.oninput = () => setMusicVolume((parseInt(vol.value, 10) || 0) / 100);
    }
    if (btn) btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); toggleMusic(); };
    updateMusicBtn();

    const kick = () => { if (!musicMuted) playTrack(musicMode); };
    ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(ev => {
        document.addEventListener(ev, kick, { passive: true });
    });
    setTimeout(kick, 300);
    setTimeout(kick, 1000);
    setTimeout(kick, 2000);
})();
