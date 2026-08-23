// ==================== HESAP + MENÜ + SEFER ====================
        const TOKEN_KEY = 'copAdamToken_v1';
        const PROGRESS_PREFIX = 'copAdamProgress_v1_';

        function mirrorProgressLocal(user) {
            if (!user || !user.username) return;
            try {
                localStorage.setItem(PROGRESS_PREFIX + user.username, JSON.stringify({
                    username: user.username,
                    maxUnlocked: user.maxUnlocked || 1,
                    cleared: Array.isArray(user.cleared) ? user.cleared : [],
                    savedAt: Date.now(),
                }));
            } catch (_) {}
        }
        function loadMirroredProgress(username) {
            try {
                const raw = localStorage.getItem(PROGRESS_PREFIX + username);
                if (!raw) return null;
                const p = JSON.parse(raw);
                return {
                    maxUnlocked: Math.max(1, Number(p.maxUnlocked) || 1),
                    cleared: Array.isArray(p.cleared) ? p.cleared : [],
                };
            } catch (_) { return null; }
        }
        function mergeProgress(serverUser, localProg) {
            if (!localProg) return serverUser;
            const maxU = Math.max(serverUser.maxUnlocked || 1, localProg.maxUnlocked || 1);
            const cleared = new Set([...(serverUser.cleared || []), ...(localProg.cleared || [])]);
            return {
                ...serverUser,
                maxUnlocked: maxU,
                cleared: Array.from(cleared).sort((a, b) => a - b),
            };
        }

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
        // Çift yerel motor: ikisi de tam sefer gibi simüle eder
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
            if (false && msg.type === 'auth_ok_UNUSED') {
                    wsAuthOk = true;
                    return;
                }
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
                coopSession = { roomId: msg.roomId, slot: msg.slot|0, partner: msg.partner };
                coopVictoryHandled = false;
                coopNextLevelRequested = false;
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
            showScreen('game');
            resizeCanvas();
            // Solo ile aynı motor — ikimizde de
            if (typeof resetLevel === 'function') resetLevel();
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
            stopGameLoop();
            showScreen('menu');
        }

        function clientGroundY() {
            return (typeof canvas !== 'undefined' ? canvas.height : 700) - GROUND_HEIGHT + 28;
        }

        class GhostUnit {
            constructor(d) {
                this.x = d.x;
                const gy = clientGroundY();
                if (typeof d.yOff === 'number') this.y = gy + d.yOff;
                else if (typeof d.y === 'number') this.y = d.y; // tam motor: gerçek y
                else this.y = gy;
                this.hp = d.hp; this.maxHp = d.mhp || 1;
                this.isPlayer = d.p;
                this.type = d.t === 'club' ? 'clubman' : d.t;
                this.walking = d.w; this.drawAmt = d.d || 0;
                this.deliver = !!d.dl; this.bagGold = d.bg || 0;
                this.bodyLean = d.bl || 0; this.armRaise = d.ar || 0; this.swingAngle = d.sw || 0;
                this.ownerIndex = (d.oi|0);
                this.flip = !!d.fl;
                this.anim = d.an || 0;
                this.state = d.st || '';
                this.stuckArrows = d.sa || [];
                this.attacking = !!d.atk;
                this._walkPhase = Math.random() * 60;
            }
            draw(ctx) {
                if (this._fromServerGame) {
                    this.y = clientGroundY() + (this._yOff || 0);
                }
                const isFlipped = this.flip;
                const color = !this.isPlayer ? '#c0392b' : (this.ownerIndex === 1 ? '#2980b9' : '#1a1a1a');

                if (this.type === 'miner') {
                    drawMinerBackpack(ctx, this.x, this.y, isFlipped, this.bagGold, this.deliver);
                    const mining = this.state === 'mine' || this.state === 'mining' || Math.abs(this.swingAngle) > 0.05;
                    drawStickman(ctx, this.x, this.y, color, this.deliver ? 'none' : 'pickaxe',
                        mining ? Math.max(1, this.anim || 20) : 0,
                        !!this.walking && !mining, isFlipped, this.swingAngle, this.bodyLean, this.armRaise,
                        false, true, this.isPlayer);
                } else if (this.type === 'clubman') {
                    let clubAnim = 0;
                    let isWalk = false;
                    if (this.anim > 0) {
                        clubAnim = this.anim; // host saldırı timer
                        isWalk = false;
                    } else if (this.walking) {
                        this._walkPhase = (this._walkPhase || 0) + 1.5;
                        isWalk = true;
                        clubAnim = 0;
                    }
                    drawStickman(ctx, this.x, this.y, color, 'club', clubAnim, isWalk, isFlipped, 0);
                } else if (this.type === 'archer') {
                    drawStickman(ctx, this.x, this.y, color, 'bow', 0, !!this.walking, isFlipped, this.drawAmt);
                } else {
                    drawStickman(ctx, this.x, this.y, color, 'pickaxe', 0, !!this.walking, isFlipped, 0);
                }

                ctx.fillStyle = 'red';
                ctx.fillRect(this.x - 15, this.y - 65, 30, 4);
                ctx.fillStyle = '#2ecc71';
                ctx.fillRect(this.x - 15, this.y - 65, 30 * Math.max(0, this.hp / (this.maxHp || 1)), 4);
            }
        }

        function serializeUnitForNet(u) {
            let t = 'miner';
            if (u instanceof Clubman) t = 'clubman';
            else if (u instanceof Archer) t = 'archer';
            // Yön
            let flip = !u.isPlayer;
            if (u.target && u.target.x !== undefined) flip = u.target.x < u.x;
            else if (Math.abs((u.x || 0) - (u.prevX || 0)) > 0.3) flip = u.x < u.prevX;
            if (t === 'miner' && (u.state === 'mining' || u.state === 'going_mine') && u.localOffset) {
                flip = u.localOffset.dx > 0;
            }
            const base = {
                t, p: !!u.isPlayer,
                oi: (u.ownerIndex|0),
                x: Math.round(u.x), y: Math.round(u.y),
                hp: Math.round(u.hp), mhp: Math.round(u.maxHp || 1),
                w: !!u._isActuallyWalking,
                d: u.drawAmount ? Math.round(u.drawAmount * 100) / 100 : 0,
                fl: !!flip,
                an: 0,
                st: u.state || '',
                sa: (u.stuckArrows || []).slice(0, 6).map(a => ({ ox: a.ox, oy: a.oy, angle: a.angle, life: a.life })),
            };
            if (t === 'miner') {
                base.dl = u.state === 'delivering';
                base.bg = u.bagGold || 0;
                base.bl = Math.round((u.bodyLean || 0) * 100) / 100;
                base.ar = Math.round((u.armRaise || 0) * 100) / 100;
                base.sw = Math.round((u.miningSwing || 0) * 100) / 100;
                base.an = u.state === 'mining' ? (u.actionTimer || 0) : 0;
                base.w = u.state !== 'mining' && u.state !== 'delivering' && Math.hypot(u.x - (u.prevX || u.x), 0) > 0.35;
            } else if (t === 'clubman') {
                base.an = u.isAttacking ? (u.attackTimer || 0) : 0;
                base.w = !!u._isActuallyWalking && !u.isAttacking;
            } else if (t === 'archer') {
                base.d = u.drawAmount || 0;
            }
            return base;
        }

        function broadcastHostState() {
            return; // state sunucudan gelir
            if (!isSimPeer() || !coopSession) return;
            wsSend({
                type: 'room_state',
                roomId: coopSession.roomId,
                payload: {
                    kind: 'state',
                    gold: player.gold,
                    gold2: player2.gold,
                    baseHp: player.base.hp,
                    enemyGold: enemy.gold,
                    enemyBaseHp: enemy.base.hp,
                    command: player.command,
                    command2: player2.command,
                    level: level,
                    minerQueue: player.minerQueue,
                    minerTimer: player.minerTimer,
                    minerTimerMax: player.minerTimerMax,
                    combatQueue: player.combatQueue,
                    combatTimer: player.combatTimer,
                    combatTimerMax: player.combatTimerMax,
                    minerQueue2: player2.minerQueue,
                    minerTimer2: player2.minerTimer,
                    minerTimerMax2: player2.minerTimerMax,
                    combatQueue2: player2.combatQueue,
                    combatTimer2: player2.combatTimer,
                    combatTimerMax2: player2.combatTimerMax,
                    units: units.map(serializeUnitForNet),
                    floats: (floatingTexts || []).slice(0, 40).map(f => ({
                        x: Math.round(f.x), y: Math.round(f.y),
                        text: f.text, color: f.color, isBig: !!f.isBig, life: f.life
                    })),
                    arrows: (projectiles || []).filter(p => p.active).slice(0, 30).map(p => ({
                        x: Math.round(p.x), y: Math.round(p.y), a: p.angle
                    })),
                }
            });
        }

        function applyServerSnapshot(payload) {
            latestHostSnapshot = payload;

            // Yeni sunucu formatı (p0/p1)
            if (payload.p0 && payload.p1) {
                const slot = myCoopSlot();
                const me = slot === 1 ? payload.p1 : payload.p0;
                const other = slot === 1 ? payload.p0 : payload.p1;
                player.gold = me.gold;
                player2.gold = other.gold;
                player.command = me.command;
                player2.command = other.command;
                player.minerQueue = Array(me.minerQ || 0).fill('miner');
                player.minerTimer = me.minerT || 0;
                player.minerTimerMax = me.minerTMax || 0;
                player.combatQueue = (me.combatQ || []).slice();
                player.combatTimer = me.combatT || 0;
                player.combatTimerMax = me.combatTMax || 0;
                partnerPing = other.rtt || 0;
                if (typeof payload.baseHp === 'number') player.base.hp = payload.baseHp;
                if (typeof payload.enemyBaseHp === 'number') enemy.base.hp = payload.enemyBaseHp;
                if (typeof payload.level === 'number') level = payload.level;
                units.length = 0;
                (payload.units || []).forEach(d => {
                    const g = new GhostUnit(d);
                    g._yOff = typeof d.yOff === 'number' ? d.yOff : 0;
                    g._fromServerGame = typeof d.yOff === 'number';
                    units.push(g);
                });
                const gy = clientGroundY();
                if (Array.isArray(payload.floats)) {
                    floatingTexts = payload.floats.map(f => ({
                        x: f.x,
                        y: (typeof f.yOff === 'number' ? gy + f.yOff : f.y),
                        text: f.text, color: f.color || '#f1c40f',
                        isBig: !!f.isBig, life: f.life || 40
                    }));
                }
                if (Array.isArray(payload.arrows)) {
                    projectiles = payload.arrows.map(a => ({
                        x: a.x,
                        y: (typeof a.yOff === 'number' ? gy + a.yOff : a.y),
                        angle: a.a, active: true,
                        draw(ctx) {
                            ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle);
                            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                            ctx.beginPath(); ctx.moveTo(-10,0); ctx.lineTo(10,0); ctx.stroke();
                            ctx.restore();
                        },
                        update() {}
                    }));
                }
                updateActionButtonsUI();
                updatePingUI();
                if (payload.over) {
                    // victory comes separate
                }
                return;
            }
            // Klasik format — slot'a göre kendi altın / kuyruk / komut
            const slot = myCoopSlot();
            if (typeof payload.baseHp === 'number') player.base.hp = payload.baseHp;
            if (typeof payload.enemyGold === 'number') enemy.gold = payload.enemyGold;
            if (typeof payload.enemyBaseHp === 'number') enemy.base.hp = payload.enemyBaseHp;
            if (typeof payload.level === 'number') level = payload.level;

            if (slot === 1) {
                // Misafir = oyuncu 2 verisi
                if (typeof payload.gold2 === 'number') player.gold = payload.gold2;
                if (typeof payload.gold === 'number') player2.gold = payload.gold;
                if (typeof payload.command2 === 'number') player.command = payload.command2;
                if (typeof payload.command === 'number') player2.command = payload.command;
                player.minerQueue = payload.minerQueue2 || [];
                player.minerTimer = payload.minerTimer2 || 0;
                player.minerTimerMax = payload.minerTimerMax2 || 0;
                player.combatQueue = payload.combatQueue2 || [];
                player.combatTimer = payload.combatTimer2 || 0;
                player.combatTimerMax = payload.combatTimerMax2 || 0;
            } else {
                if (typeof payload.gold === 'number') player.gold = payload.gold;
                if (typeof payload.gold2 === 'number') player2.gold = payload.gold2;
                if (typeof payload.command === 'number') player.command = payload.command;
                if (typeof payload.command2 === 'number') player2.command = payload.command2;
                player.minerQueue = payload.minerQueue || [];
                player.minerTimer = payload.minerTimer || 0;
                player.minerTimerMax = payload.minerTimerMax || 0;
                player.combatQueue = payload.combatQueue || [];
                player.combatTimer = payload.combatTimer || 0;
                player.combatTimerMax = payload.combatTimerMax || 0;
            }
            units.length = 0;
            (payload.units || []).forEach(d => {
                    const g = new GhostUnit(d);
                    g._yOff = typeof d.yOff === 'number' ? d.yOff : 0;
                    units.push(g);
                });

            // Uçan yazılar + oklar (misafir de görsün)
            if (Array.isArray(payload.floats)) {
                floatingTexts = payload.floats.map(f => ({
                    x: f.x, y: f.y, text: f.text, color: f.color || '#f1c40f',
                    isBig: !!f.isBig, life: f.life || 40
                }));
            }
            if (Array.isArray(payload.arrows)) {
                projectiles = payload.arrows.map(a => ({
                    x: a.x, y: a.y, angle: a.a, active: true,
                    draw(ctx) {
                        if (!this.active) return;
                        ctx.save();
                        ctx.translate(this.x, this.y);
                        ctx.rotate(this.angle);
                        ctx.strokeStyle = '#fff';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(-10, 0);
                        ctx.lineTo(10, 0);
                        ctx.stroke();
                        ctx.restore();
                    },
                    update() {}
                }));
            }
            // kamera senkron DEĞİL — her oyuncu kendi ekranını kaydırır

            updateActionButtonsUI();
        }

        function startCoopGuestRenderLoop() {
            stopCoopGuestRenderLoop();
            function loop() {
                // Misafirde yazıları hafif yukarı kaydır (akıcılık)
                if (Array.isArray(floatingTexts)) {
                    for (let i = floatingTexts.length - 1; i >= 0; i--) {
                        floatingTexts[i].y -= 0.8;
                        floatingTexts[i].life = (floatingTexts[i].life || 40) - 1;
                        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
                    }
                }
                draw();
                coopGuestLoopId = requestAnimationFrame(loop);
            }
            coopGuestLoopId = requestAnimationFrame(loop);
        }
        function stopCoopGuestRenderLoop() {
            if (coopGuestLoopId) cancelAnimationFrame(coopGuestLoopId);
            coopGuestLoopId = null;
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
            // slot 0 → player, slot 1 → player2
            if (action === 'buyMiner') queueUnit('miner', slot);
            else if (action === 'buyClub') queueUnit('club', slot);
            else if (action === 'buyArcher') queueUnit('archer', slot);
            else if (action === 'attack') {
                if (slot === 1) player2.command = CMD_ATTACK;
                else player.command = CMD_ATTACK;
            } else if (action === 'defend') {
                if (slot === 1) player2.command = CMD_DEFEND;
                else player.command = CMD_DEFEND;
            } else if (action === 'retreat') {
                if (slot === 1) player2.command = CMD_RETREAT;
                else player.command = CMD_RETREAT;
            }
            updateActionButtonsUI();
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
            // Her zaman tarayıcıya yedekle (Render veri silinse bile)
            mirrorProgressLocal(currentUser);
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
                    mirrorProgressLocal(currentUser);
                    return;
                } catch (e) {
                    // Ağ hatası: token'ı silme, sadece local'e yaz
                    console.warn('[progress] sunucu kaydı başarısız, local yedek kullanılıyor', e);
                }
            }
            const db = loadLocalUsers();
            if (!db[currentUser.username]) {
                db[currentUser.username] = { maxUnlocked: 1, cleared: [] };
            }
            db[currentUser.username].maxUnlocked = currentUser.maxUnlocked;
            db[currentUser.username].cleared = currentUser.cleared;
            saveLocalUsers(db);
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
                        mirrorProgressLocal({
                            username: data.username,
                            maxUnlocked: data.maxUnlocked || 1,
                            cleared: data.cleared || [],
                        });
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
                // Sunucu sıfırlanmış olsa bile tarayıcıdaki ilerlemeyi geri yükle
                const localProg = loadMirroredProgress(currentUser.username);
                if (localProg) {
                    currentUser = mergeProgress(currentUser, localProg);
                    try { await saveCurrentUser(); } catch (_) {}
                }
                mirrorProgressLocal(currentUser);
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

        function onLevelVictory(completedLevel) {
            if (!currentUser) return;
            // completedLevel: bitirdiğin bölüm (level++ öncesi). Yoksa level-1 yedek.
            const completed = Math.max(1, Math.min(3, Number(completedLevel) || (level - 1) || 1));
            if (!currentUser.cleared.includes(completed)) currentUser.cleared.push(completed);
            if (completed >= (currentUser.maxUnlocked || 1) && currentUser.maxUnlocked < 3) {
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

        
// ==================== MÜZİK ====================
        const MUSIC_KEY = 'copAdamMusicMuted_v1';
        const MUSIC_VOL_KEY = 'copAdamMusicVol_v1';
        // Varsayılan: müzik AÇIK
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
            // Önce music/ klasörü, yoksa kök
            try {
                return new URL('music/' + name, window.location.href).href;
            } catch (_) {
                return 'music/' + name;
            }
        }
        function musicUrlFallback(name) {
            try {
                return new URL(name, window.location.href).href;
            } catch (_) {
                return name;
            }
        }

        function ensureTracks() {
            if (!audioMenu) {
                audioMenu = new Audio(musicUrl('menu.mp3'));
                audioMenu.loop = true;
                audioMenu.preload = 'auto';
                audioMenu.addEventListener('error', () => {
                    console.warn('[müzik] music/menu.mp3 yok, kök deneniyor');
                    audioMenu.src = musicUrlFallback('menu.mp3');
                    audioMenu.load();
                });
            }
            if (!audioBattle) {
                audioBattle = new Audio(musicUrl('battle.mp3'));
                audioBattle.loop = true;
                audioBattle.preload = 'auto';
                audioBattle.addEventListener('error', () => {
                    console.warn('[müzik] music/battle.mp3 yok, kök deneniyor');
                    audioBattle.src = musicUrlFallback('battle.mp3');
                    audioBattle.load();
                });
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

            // İlk etkileşimde otomatik çal (tarayıcı kuralı)
            const kick = () => { if (!musicMuted) playTrack(musicMode); };
            ['pointerdown', 'touchstart', 'keydown', 'click'].forEach(ev => {
                document.addEventListener(ev, kick, { passive: true });
            });
            // Birkaç kez dene
            setTimeout(kick, 300);
            setTimeout(kick, 1000);
            setTimeout(kick, 2000);
        })()

(async function bootMenu() {
            // Sunucu var mı diye hafif kontrol (token yoksa /api/me çağırma → 401 spam olmasın)
            const token = localStorage.getItem(TOKEN_KEY);
            useServer = true;
            try {
                if (token) {
                    const data = await api('/api/me');
                    let user = {
                        username: data.username,
                        maxUnlocked: data.maxUnlocked || 1,
                        cleared: data.cleared || [],
                    };
                    // Tarayıcı yedeği daha ilerideyse birleştir ve sunucuya yaz
                    const localProg = loadMirroredProgress(data.username);
                    user = mergeProgress(user, localProg);
                    currentUser = user;
                    mirrorProgressLocal(currentUser);
                    if (localProg && (
                        (localProg.maxUnlocked || 1) > (data.maxUnlocked || 1) ||
                        (localProg.cleared || []).length > (data.cleared || []).length
                    )) {
                        try { await saveCurrentUser(); } catch (_) {}
                    }
                    enterMainMenu();
                    return;
                }
            } catch (e) {
                // 401: token gerçekten geçersiz (sunucu verisi silinmiş olabilir)
                // Ağ hatası: token'ı KORU, local yedekle devam et
                if (e && e.status === 401) {
                    localStorage.removeItem(TOKEN_KEY);
                } else {
                    useServer = false;
                    console.warn('[boot] sunucu erişilemedi, local oturum denenecek', e);
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






        
        // ==================== "P" TUŞU: TÜM SEFERLERİ AÇ ====================
        document.addEventListener('keydown', (e) => {
            const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            // P = tüm seferler
            if (e.key === 'p' || e.key === 'P') {
                if (!currentUser) return;
                if (typeof unlockAll === 'function') unlockAll();
                else {
                    currentUser.maxUnlocked = 3;
                    saveCurrentUser();
                    if (campaignScreen && !campaignScreen.classList.contains('hidden')) refreshCampaignNodes();
                    showToast('Tüm seferler açıldı');
                }
                return;
            }
            // G = god mode (sonsuz altın + anında spawn)
            if (e.key === 'g' || e.key === 'G') {
                if (typeof godMode === 'function') godMode(!window.CHEAT_INF);
                return;
            }
        });

        // ==================== VERI YEDEKLEME / KURTARMA (kilitli) ====================
        // Herkese gorunmez. Kod paylassan bile Render ADMIN_KEY olmadan API calismaz.
        // Acmak: Shift+B
        const ADMIN_BACKUP_KEY_STORAGE = 'copAdamAdminKey_v1';
        let adminBackupUnlocked = false;

        function getAdminKey(forcePrompt) {
            let key = localStorage.getItem(ADMIN_BACKUP_KEY_STORAGE) || '';
            if (!key || forcePrompt) {
                key = prompt('Admin anahtari (Render ADMIN_KEY ile ayni):', key || '') || '';
                if (key) localStorage.setItem(ADMIN_BACKUP_KEY_STORAGE, key);
            }
            return key;
        }

        async function adminExportData() {
            const key = getAdminKey(false);
            if (!key) return;
            try {
                const res = await fetch(API_BASE + '/api/admin/export', {
                    headers: { 'x-admin-key': key }
                });
                const data = await res.json();
                if (!res.ok) {
                    if (res.status === 403) {
                        showToast('Anahtar hatali veya admin kapali');
                        localStorage.removeItem(ADMIN_BACKUP_KEY_STORAGE);
                        adminBackupUnlocked = false;
                        const panel = document.getElementById('adminBackupPanel');
                        if (panel) panel.style.display = 'none';
                    } else showToast('Yedekleme basarisiz');
                    return;
                }
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'cop-adam-yedek-' + new Date().toISOString().slice(0, 10) + '.json';
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                showToast('Yedek indirildi');
            } catch (e) {
                showToast('Yedekleme hatasi: ' + e.message);
            }
        }

        function adminImportData() {
            const key = getAdminKey(false);
            if (!key) return;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'application/json';
            input.onchange = async () => {
                const file = input.files[0];
                if (!file) return;
                if (!confirm('Sunucudaki TUM kullanici verisi degisecek. Sadece kendi yedegin icin kullan.')) return;
                try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    const res = await fetch(API_BASE + '/api/admin/import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-admin-key': key },
                        body: JSON.stringify(parsed),
                    });
                    const result = await res.json();
                    if (!res.ok) {
                        showToast('Kurtarma basarisiz');
                        return;
                    }
                    showToast('Kurtarildi: ' + result.count + ' kullanici');
                } catch (e) {
                    showToast('Kurtarma hatasi: ' + e.message);
                }
            };
            input.click();
        }

        function ensureAdminBackupUI() {
            let panel = document.getElementById('adminBackupPanel');
            if (!panel) {
                panel = document.createElement('div');
                panel.id = 'adminBackupPanel';
                panel.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9999;display:none;gap:6px;opacity:0.9;';
                panel.innerHTML =
                    '<button type="button" id="btnAdminExport" style="padding:6px 10px;font-size:12px;border-radius:6px;border:1px solid #444;background:#1a1a1a;color:#fff;cursor:pointer;">Yedekle</button>' +
                    '<button type="button" id="btnAdminImport" style="padding:6px 10px;font-size:12px;border-radius:6px;border:1px solid #444;background:#1a1a1a;color:#fff;cursor:pointer;">Kurtar</button>';
                document.body.appendChild(panel);
                document.getElementById('btnAdminExport').onclick = adminExportData;
                document.getElementById('btnAdminImport').onclick = adminImportData;
            }
            panel.style.display = adminBackupUnlocked ? 'flex' : 'none';
        }

        function unlockAdminBackup() {
            const key = getAdminKey(true);
            if (!key) return;
            adminBackupUnlocked = true;
            ensureAdminBackupUI();
            showToast('Admin yedek paneli acildi');
        }
        window.unlockAdminBackup = unlockAdminBackup;

        document.addEventListener('keydown', (e) => {
            if (!(e.shiftKey && (e.key === 'b' || e.key === 'B'))) return;
            const tag = (document.activeElement && document.activeElement.tagName || '').toLowerCase();
            if (tag === 'input' || tag === 'textarea') return;
            unlockAdminBackup();
        });

        ensureAdminBackupUI();
