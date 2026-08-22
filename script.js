(function () {
    'use strict';
    const SOCKET_CDN_LOADED = typeof io !== 'undefined';
    if (!SOCKET_CDN_LOADED) {
        console.error('Socket.IO client yüklenmedi. index.html içine <script src="/socket.io/socket.io.js"></script> ekleyin.');
        return;
    }
    // ==================== NET DURUMU ====================
    const Net = {
        socket: null,
        connected: false,
        active: false,
        mode: null,
        isHost: false,
        roomId: null,
        peerUsername: null,
        lastSnapshotAt: 0,
        myGold: 0
    };
    window.Net = Net;

    function connectSocket() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) return;
        if (Net.socket) { Net.socket.disconnect(); }
        Net.socket = io(API_BASE || undefined, { auth: { token } });

        Net.socket.on('connect', () => { Net.connected = true; Net.socket.emit('friends:refresh'); });
        Net.socket.on('disconnect', () => { Net.connected = false; });

        Net.socket.on('friends:state', renderFriendsFromState);
        Net.socket.on('friend:request', ({ username }) => { refreshFriends(); toast(`${username} sana arkadaşlık isteği gönderdi.`); });
        Net.socket.on('friend:accepted', ({ username }) => { refreshFriends(); toast(`${username} arkadaşlık isteğini kabul etti.`); });
        Net.socket.on('friend:online', () => refreshFriends());
        Net.socket.on('friend:offline', () => refreshFriends());

        Net.socket.on('invite:received', ({ fromUsername, level }) => { showInviteToast(fromUsername, level); });
        Net.socket.on('invite:failed', ({ toUsername }) => { toast(`${toUsername} şu anda çevrimdışı.`); });
        Net.socket.on('invite:declined', ({ byUsername }) => { toast(`${byUsername} daveti reddetti.`); hideWaitingForFriendScreen(); });
        Net.socket.on('invite:accepted', ({ roomId, guestUsername, level, isHost }) => {
            hideWaitingForFriendScreen();
            joinRoomAndStart({ roomId, mode: 'coop', level, isHost, peerUsername: guestUsername });
        });

        Net.socket.on('mp:queue:waiting', () => setMatchmakingStatus('Rakip aranıyor...'));
        Net.socket.on('mp:matched', ({ roomId, opponent, isHost }) => {
            hideMatchmakingScreen();
            joinRoomAndStart({ roomId, mode: 'versus', level: 1, isHost, peerUsername: opponent });
        });

        Net.socket.on('room:peerLeft', () => { toast('Rakip/ortak bağlantıyı kesti.'); leaveNetGame(); });
        Net.socket.on('game:state', onGuestReceiveState);
        Net.socket.on('game:input', onHostReceiveInput);
    }

    let toastTimer = null;
    function toast(msg) {
        let el = document.getElementById('netToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'netToast';
            el.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.85);color:#fff;padding:10px 18px;border-radius:10px;font-size:14px;z-index:5000;box-shadow:0 6px 16px rgba(0,0,0,0.5);';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.style.display = 'block';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { el.style.display = 'none'; }, 3500);
    }

    function buildFriendsScreenDom() {
        if (document.getElementById('friendsScreen')) return;
        const wrap = document.createElement('div');
        wrap.id = 'friendsScreen';
        wrap.className = 'screen-overlay hidden';
        wrap.innerHTML = `
            <div class="menu-panel" style="min-width:360px;max-width:420px;">
                <h1>👥 Arkadaşlar</h1>
                <div style="display:flex;gap:6px;margin-bottom:10px;">
                    <input class="auth-input" id="friendSearchInput" placeholder="Kullanıcı adı ara..." style="margin:0;">
                    <button class="menu-btn secondary small" id="friendSearchBtn" style="margin:0;">Ara</button>
                </div>
                <div id="friendSearchResults" style="text-align:left;font-size:14px;margin-bottom:10px;"></div>
                <div id="friendIncomingRequests" style="text-align:left;font-size:14px;margin-bottom:10px;"></div>
                <div id="friendList" style="text-align:left;font-size:14px;max-height:220px;overflow-y:auto;"></div>
                <button class="menu-btn secondary" id="btnFriendsBack">← Ana Menü</button>
            </div>`;
        document.body.appendChild(wrap);
        document.getElementById('btnFriendsBack').onclick = () => { showScreen('menu'); };
        document.getElementById('friendSearchBtn').onclick = doFriendSearch;
        document.getElementById('friendSearchInput').addEventListener('keydown', e => {
            if (e.key === 'Enter') doFriendSearch();
        });
    }

    async function doFriendSearch() {
        const q = document.getElementById('friendSearchInput').value.trim();
        const box = document.getElementById('friendSearchResults');
        box.innerHTML = '';
        if (q.length < 2) return;
        try {
            const data = await api('/api/users/search?q=' + encodeURIComponent(q));
            data.results.forEach(r => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #34495e33;';
                row.innerHTML = `<span>${r.username} ${r.online ? '🟢' : '⚪'}</span>`;
                const btn = document.createElement('button');
                btn.className = 'menu-btn primary small';
                btn.style.margin = '0';
                btn.textContent = 'İstek Gönder';
                btn.onclick = async () => {
                    try {
                        await api('/api/friends/request', { method: 'POST', body: { toUsername: r.username } });
                        toast('İstek gönderildi: ' + r.username);
                        refreshFriends();
                    } catch (e) { toast(e.message || 'Hata'); }
                };
                row.appendChild(btn);
                box.appendChild(row);
            });
        } catch (e) { }
    }

    async function refreshFriends() {
        try {
            const data = await api('/api/friends');
            renderFriendsFromState({
                friends: data.friends,
                incomingRequests: data.incomingRequests,
            });
        } catch (e) { }
    }

    function renderFriendsFromState(state) {
        const incBox = document.getElementById('friendIncomingRequests');
        const listBox = document.getElementById('friendList');
        if (!incBox || !listBox) return;

        incBox.innerHTML = (state.incomingRequests || []).map(name => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
                <span>📩 ${name}</span>
                <span>
                    <button class="menu-btn primary small" style="margin:2px;" data-acc="${name}">Kabul Et</button>
                    <button class="menu-btn danger small" style="margin:2px;" data-dec="${name}">Reddet</button>
                </span>
            </div>`).join('');

        incBox.querySelectorAll('[data-acc]').forEach(btn => {
            btn.onclick = async () => {
                await api('/api/friends/accept', { method: 'POST', body: { fromUsername: btn.dataset.acc } });
                refreshFriends();
            };
        });
        incBox.querySelectorAll('[data-dec]').forEach(btn => {
            btn.onclick = async () => {
                await api('/api/friends/decline', { method: 'POST', body: { fromUsername: btn.dataset.dec } });
                refreshFriends();
            };
        });

        const friends = state.friends || [];
        listBox.innerHTML = friends.length === 0
            ? '<div style="opacity:0.7;">Henüz arkadaşın yok. Yukarıdan kullanıcı ara.</div>'
            : friends.map(f => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #34495e33;">
                    <span>${f.username} ${f.online ? '🟢' : '⚪'}</span>
                </div>`).join('');
    }

    let pendingLevel = null;
    function buildLevelChoiceDom() {
        if (document.getElementById('levelChoiceScreen')) return;
        const wrap = document.createElement('div');
        wrap.id = 'levelChoiceScreen';
        wrap.className = 'screen-overlay hidden';
        wrap.innerHTML = `
            <div class="menu-panel">
                <h1 id="levelChoiceTitle">Bölüm</h1>
                <div class="subtitle">Nasıl oynamak istersin?</div>
                <button class="menu-btn primary" id="btnPlaySolo">🧍 Tek Başına Oyna</button>
                <button class="menu-btn secondary" id="btnPlayWithFriend">🤝 Arkadaşımla Oyna</button>
                <button class="menu-btn danger small" id="btnLevelChoiceBack">← Geri</button>
            </div>`;
        document.body.appendChild(wrap);
        document.getElementById('btnLevelChoiceBack').onclick = () => showScreen('campaign');
        document.getElementById('btnPlaySolo').onclick = () => {
            showScreen('game');
            startCampaignLevel(pendingLevel);
        };
        document.getElementById('btnPlayWithFriend').onclick = () => openFriendPickerForLevel(pendingLevel);
    }

    function openLevelChoice(lv) {
        pendingLevel = lv;
        document.getElementById('levelChoiceTitle').textContent = lv + '. Bölüm';
        hideAllOverlays();
        document.getElementById('levelChoiceScreen').classList.remove('hidden');
    }

    function buildFriendPickerDom() {
        if (document.getElementById('friendPickerScreen')) return;
        const wrap = document.createElement('div');
        wrap.id = 'friendPickerScreen';
        wrap.className = 'screen-overlay hidden';
        wrap.innerHTML = `
            <div class="menu-panel">
                <h1>🤝 Arkadaşını Davet Et</h1>
                <div class="subtitle" id="friendPickerSubtitle"></div>
                <div id="friendPickerList" style="text-align:left;max-height:260px;overflow-y:auto;"></div>
                <button class="menu-btn danger small" id="btnFriendPickerBack">← Geri</button>
            </div>`;
        document.body.appendChild(wrap);
        document.getElementById('btnFriendPickerBack').onclick = () => openLevelChoice(pendingLevel);
    }

    async function openFriendPickerForLevel(lv) {
        buildFriendPickerDom();
        hideAllOverlays();
        document.getElementById('friendPickerScreen').classList.remove('hidden');
        document.getElementById('friendPickerSubtitle').textContent = lv + '. Bölüm için davet edilecek arkadaş';
        const list = document.getElementById('friendPickerList');
        list.innerHTML = 'Yükleniyor...';
        try {
            const data = await api('/api/friends');
            const online = (data.friends || []).filter(f => f.online);
            if (online.length === 0) {
                list.innerHTML = '<div style="opacity:0.8;">Şu an çevrimiçi arkadaşın yok.</div>';
                return;
            }
            list.innerHTML = '';
            online.forEach(f => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #34495e33;';
                row.innerHTML = `<span>${f.username} 🟢</span>`;
                const btn = document.createElement('button');
                btn.className = 'menu-btn primary small';
                btn.style.margin = '0';
                btn.textContent = 'Davet Et';
                btn.onclick = () => {
                    Net.socket.emit('invite:send', { toUsername: f.username, level: lv });
                    showWaitingForFriendScreen(f.username);
                };
                row.appendChild(btn);
                list.appendChild(row);
            });
        } catch (e) { list.innerHTML = 'Hata: ' + (e.message || ''); }
    }

    function buildWaitingForFriendDom() {
        if (document.getElementById('waitingFriendScreen')) return;
        const wrap = document.createElement('div');
        wrap.id = 'waitingFriendScreen';
        wrap.className = 'screen-overlay hidden';
        wrap.innerHTML = `
            <div class="menu-panel">
                <h1>⏳ Bekleniyor...</h1>
                <div class="subtitle" id="waitingFriendText">Davet gönderildi.</div>
                <button class="menu-btn danger small" id="btnCancelWaitFriend">İptal</button>
            </div>`;
        document.body.appendChild(wrap);
        document.getElementById('btnCancelWaitFriend').onclick = () => {
            hideWaitingForFriendScreen();
            openFriendPickerForLevel(pendingLevel);
        };
    }

    function showWaitingForFriendScreen(name) {
        buildWaitingForFriendDom();
        hideAllOverlays();
        document.getElementById('waitingFriendText').textContent = name + ' kabul etmesini bekliyoruz...';
        document.getElementById('waitingFriendScreen').classList.remove('hidden');
    }

    function hideWaitingForFriendScreen() {
        const el = document.getElementById('waitingFriendScreen');
        if (el) el.classList.add('hidden');
    }

    function showInviteToast(fromUsername, level) {
        let el = document.getElementById('inviteToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'inviteToast';
            el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.92);color:#fff;padding:16px 20px;border-radius:12px;z-index:6000;box-shadow:0 10px 24px rgba(0,0,0,0.6);text-align:center;';
            document.body.appendChild(el);
        }
        el.innerHTML = `
            <div style="margin-bottom:10px;">🎮 <b>${fromUsername}</b> seni ${level}. bölüme davet ediyor</div>
            <button class="menu-btn primary small" id="inviteAcceptBtn">Kabul Et</button>
            <button class="menu-btn danger small" id="inviteDeclineBtn">Reddet</button>`;
        el.style.display = 'block';
        document.getElementById('inviteAcceptBtn').onclick = () => {
            Net.socket.emit('invite:accept', { toUsername: fromUsername, level });
            el.style.display = 'none';
        };
        document.getElementById('inviteDeclineBtn').onclick = () => {
            Net.socket.emit('invite:decline', { toUsername: fromUsername });
            el.style.display = 'none';
        };
    }

    function buildMatchmakingDom() {
        if (document.getElementById('matchmakingScreen')) return;
        const wrap = document.createElement('div');
        wrap.id = 'matchmakingScreen';
        wrap.className = 'screen-overlay hidden';
        wrap.innerHTML = `
            <div class="menu-panel">
                <h1>⚔️ Hızlı Eşleşme</h1>
                <div class="subtitle" id="mmStatusText">Rakip aranıyor...</div>
                <button class="menu-btn danger small" id="btnCancelMatchmaking">İptal</button>
            </div>`;
        document.body.appendChild(wrap);
        document.getElementById('btnCancelMatchmaking').onclick = () => {
            Net.socket.emit('mp:queue:leave');
            hideMatchmakingScreen();
            showScreen('menu');
        };
    }

    function setMatchmakingStatus(txt) {
        const el = document.getElementById('mmStatusText');
        if (el) el.textContent = txt;
    }

    function hideMatchmakingScreen() {
        const el = document.getElementById('matchmakingScreen');
        if (el) el.classList.add('hidden');
    }

    function startQuickMatch() {
        buildMatchmakingDom();
        hideAllOverlays();
        document.getElementById('matchmakingScreen').classList.remove('hidden');
        setMatchmakingStatus('Rakip aranıyor...');
        Net.socket.emit('mp:queue:join');
    }

    function hideAllOverlays() {
        ['authScreen','mainMenu','campaignScreen','friendsScreen','levelChoiceScreen','friendPickerScreen','waitingFriendScreen','matchmakingScreen'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        gameContainerRef().classList.add('menu-hidden');
    }

    function gameContainerRef() { return document.getElementById('game-container'); }

    function joinRoomAndStart({ roomId, mode, level, isHost, peerUsername }) {
        Net.active = true;
        Net.mode = mode;
        Net.isHost = isHost;
        Net.roomId = roomId;
        Net.peerUsername = peerUsername;
        Net.socket.emit('room:join', { roomId });
        hideAllOverlays();
        showScreen('game');
        resizeCanvas();
        if (isHost) {
            level = level || 1;
            window.level = level;
            isGameOver = false;
            modal.classList.add('hidden');
            resetLevel();
            startGameLoop();
            hostBroadcastLoop();
            if (mode === 'versus') startNetCooldownTicker();
            toast((mode === 'coop' ? 'Ortak sefer' : 'Versus maç') + ' başladı: ' + peerUsername);
        } else {
            isGameOver = false;
            guestSpectatorLoop();
            toast((mode === 'coop' ? 'Ortak sefer' : 'Versus maç') + ' başladı: ' + peerUsername);
        }
    }

    function leaveNetGame() {
        if (Net.socket) Net.socket.emit('room:leave');
        Net.active = false;
        Net.mode = null;
        Net.isHost = false;
        Net.roomId = null;
        isGameOver = true;
        if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        showScreen('menu');
    }

    const _origShowScreen = window.showScreen;
    window.showScreen = function (which) {
        ['friendsScreen', 'levelChoiceScreen', 'friendPickerScreen', 'waitingFriendScreen', 'matchmakingScreen'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        _origShowScreen(which);
    };

    const _originalUpdateAI = window.updateAI;
    window.updateAI = function () {
        if (Net.active && Net.isHost && Net.mode === 'versus') return;
        _originalUpdateAI();
    };

    function onHostReceiveInput(msg) {
        if (!Net.active || !Net.isHost) return;
        const targetTeam = (Net.mode === 'versus') ? enemy : player;
        if (msg.type === 'command') {
            targetTeam.command = msg.cmd;
        } else if (msg.type === 'buy') {
            buyUnitForTeam(targetTeam, msg.unit, Net.mode === 'versus' ? false : true);
        }
    }

    const NET_COOLDOWNS = {
        miner: { cost: 150, cdField: 'minerCooldown', maxCd: 15 * 60 },
        club: { cost: 125, cdField: 'clubCooldown', maxCd: 10 * 60 },
        archer: { cost: 140, cdField: 'archerCooldown', maxCd: 11 * 60 },
    };

    function buyUnitForTeam(team, unitType, isPlayerSide) {
        const info = NET_COOLDOWNS[unitType];
        if (!info) return;
        if (team.gold < info.cost) return;
        if ((team[info.cdField] || 0) > 0) return;
        const count = units.filter(u => u.isPlayer === isPlayerSide &&
            ((unitType === 'miner' && u instanceof Miner) ||
             (unitType === 'club' && u instanceof Clubman) ||
             (unitType === 'archer' && u instanceof Archer))).length;
        const cap = unitType === 'miner' ? MAX_MINERS_PER_TEAM : unitType === 'club' ? MAX_CLUBMEN_PER_TEAM : MAX_ARCHERS_PER_TEAM;
        if (count >= cap) return;
        team.gold -= info.cost;
        team[info.cdField] = info.maxCd;
        if (unitType === 'miner') units.push(new Miner(isPlayerSide));
        else if (unitType === 'club') units.push(new Clubman(isPlayerSide));
        else if (unitType === 'archer') units.push(new Archer(isPlayerSide));
    }

    let netCooldownTicker = null;
    function startNetCooldownTicker() {
        if (netCooldownTicker) clearInterval(netCooldownTicker);
        netCooldownTicker = setInterval(() => {
            if (!Net.active || !Net.isHost || Net.mode !== 'versus' || isGameOver) return;
            ['minerCooldown', 'clubCooldown', 'archerCooldown'].forEach(f => {
                if (enemy[f] > 0) enemy[f]--;
            });
        }, 1000 / 60);
    }

    let hostBroadcastTimer = null;
    function hostBroadcastLoop() {
        if (hostBroadcastTimer) clearInterval(hostBroadcastTimer);
        hostBroadcastTimer = setInterval(() => {
            if (!Net.active || !Net.isHost || isGameOver) { clearInterval(hostBroadcastTimer); return; }
            const snapshot = {
                worldWidth,
                level,
                playerBase: { x: player.base.x, y: player.base.y, hp: player.base.hp, maxHp: player.base.maxHp },
                enemyBase: { x: enemy.base.x, y: enemy.base.y, hp: enemy.base.hp, maxHp: enemy.base.maxHp },
                playerGold: player.gold,
                enemyGold: enemy.gold,
                playerCommand: player.command,
                enemyCommand: enemy.command,
                units: units.map(u => ({
                    x: Math.round(u.x), y: Math.round(u.y),
                    hp: Math.round(u.hp), maxHp: u.maxHp,
                    isPlayer: u.isPlayer,
                    type: u instanceof Miner ? 'miner' : (u instanceof Clubman ? 'club' : 'archer'),
                })),
                over: isGameOver,
            };
            Net.socket.emit('game:state', snapshot);
        }, 80);
    }

    class NetUnit {
        constructor(d) {
            this.x = d.x; this.y = d.y; this.hp = d.hp; this.maxHp = d.maxHp;
            this.isPlayer = d.isPlayer; this.type = d.type;
        }
        draw(ctx) {
            const color = this.isPlayer ? '#1a1a1a' : '#c0392b';
            const weapon = this.type === 'miner' ? 'pickaxe' : (this.type === 'club' ? 'club' : 'bow');
            drawStickman(ctx, this.x, this.y, color, weapon, 0, false, !this.isPlayer, 0);
            ctx.fillStyle = 'red'; ctx.fillRect(this.x - 15, this.y - 65, 30, 4);
            ctx.fillStyle = '#2ecc71'; ctx.fillRect(this.x - 15, this.y - 65, 30 * (this.hp / (this.maxHp || 1)), 4);
        }
    }

    function onGuestReceiveState(snapshot) {
        if (!Net.active || Net.isHost) return;
        Net.lastSnapshotAt = performance.now();
        worldWidth = snapshot.worldWidth;
        level = snapshot.level;
        player.base.x = snapshot.playerBase.x; player.base.y = snapshot.playerBase.y;
        player.base.hp = snapshot.playerBase.hp; player.base.maxHp = snapshot.playerBase.maxHp;
        enemy.base.x = snapshot.enemyBase.x; enemy.base.y = snapshot.enemyBase.y;
        enemy.base.hp = snapshot.enemyBase.hp; enemy.base.maxHp = snapshot.enemyBase.maxHp;
        player.gold = snapshot.playerGold; enemy.gold = snapshot.enemyGold;
        player.command = snapshot.playerCommand; enemy.command = snapshot.enemyCommand;
        units = snapshot.units.map(u => new NetUnit(u));
        Net.myGold = (Net.mode === 'versus') ? snapshot.enemyGold : snapshot.playerGold;
        goldEl.innerText = Net.myGold;
        levelEl.innerText = Math.min(level, 3) + '/3';
        if (snapshot.over) leaveNetGame();
    }

    let guestLoopActive = false;
    function guestSpectatorLoop() {
        guestLoopActive = true;
        if (playerMineSlots.length === 0) initMines();
        function frame() {
            if (!Net.active || Net.isHost) { guestLoopActive = false; return; }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(-cameraX, 0);
            drawEnvironment(ctx);
            drawBase(ctx, true);
            drawBase(ctx, false);
            units.slice().sort((a, b) => a.y - b.y).forEach(u => u.draw(ctx));
            ctx.restore();
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    function guestSendCommand(cmd) { Net.socket.emit('game:input', { type: 'command', cmd }); }
    function guestSendBuy(unitType) { Net.socket.emit('game:input', { type: 'buy', unit: unitType }); }

    function hookUI() {
        buildFriendsScreenDom();
        buildLevelChoiceDom();
        const menuPanel = document.querySelector('#mainMenu .menu-panel');
        if (menuPanel && !document.getElementById('btnFriends')) {
            const btn = document.createElement('button');
            btn.className = 'menu-btn secondary';
            btn.id = 'btnFriends';
            btn.textContent = '👥 Arkadaşlar';
            btn.onclick = () => { hideAllOverlays(); document.getElementById('friendsScreen').classList.remove('hidden'); refreshFriends(); };
            const logoutBtn = document.getElementById('btnLogout');
            menuPanel.insertBefore(btn, logoutBtn);
        }
        const mpBtn = document.getElementById('btnMultiplayer');
        if (mpBtn) {
            mpBtn.classList.remove('muted');
            mpBtn.classList.add('secondary');
            mpBtn.textContent = '2. Hızlı Eşleşme Oyna (Versus)';
            mpBtn.onclick = () => startQuickMatch();
        }
        document.querySelectorAll('.campaign-node').forEach(node => {
            node.onclick = () => {
                const lv = parseInt(node.dataset.level, 10);
                if (lv > (currentUser.maxUnlocked || 1)) { toast('Bu bölüm henüz kilitli!'); return; }
                openLevelChoice(lv);
            };
        });
        wrapCommandAndBuyButtons();
    }

    function wrapCommandAndBuyButtons() {
        const origSetPlayerCommand = window.setPlayerCommand;
        window.setPlayerCommand = function (cmd) {
            if (Net.active && !Net.isHost) { guestSendCommand(cmd); return; }
            origSetPlayerCommand(cmd);
        };
        document.getElementById('cmdRetreat').onclick = () => window.setPlayerCommand(CMD_RETREAT);
        document.getElementById('cmdDefend').onclick = () => window.setPlayerCommand(CMD_DEFEND);
        document.getElementById('cmdAttack').onclick = () => window.setPlayerCommand(CMD_ATTACK);

        const btnMinerEl = document.getElementById('btnMiner');
        btnMinerEl.onclick = () => {
            if (Net.active && !Net.isHost) { guestSendBuy('miner'); return; }
            const playerMiners = units.filter(u => u.isPlayer && u instanceof Miner).length;
            if (player.gold >= 150 && player.minerCooldown <= 0 && playerMiners < MAX_MINERS_PER_TEAM) {
                player.gold -= 150; units.push(new Miner(true)); player.minerCooldown = player.minerMaxCooldown;
            }
        };

        const btnClubEl = document.getElementById('btnClub');
        btnClubEl.onclick = () => {
            if (Net.active && !Net.isHost) { guestSendBuy('club'); return; }
            const playerClubmen = units.filter(u => u.isPlayer && u instanceof Clubman).length;
            if (player.gold >= 125 && player.clubCooldown <= 0 && playerClubmen < MAX_CLUBMEN_PER_TEAM) {
                player.gold -= 125; units.push(new Clubman(true)); player.clubCooldown = player.clubMaxCooldown;
            }
        };

        const btnArcherEl = document.getElementById('btnArcher');
        btnArcherEl.onclick = () => {
            if (Net.active && !Net.isHost) { guestSendBuy('archer'); return; }
            const playerArchers = units.filter(u => u.isPlayer && u instanceof Archer).length;
            if (player.gold >= 140 && player.archerCooldown <= 0 && playerArchers < MAX_ARCHERS_PER_TEAM) {
                player.gold -= 140; units.push(new Archer(true)); player.archerCooldown = player.archerMaxCooldown;
            }
        };
    }

    const _origEnterMainMenu = window.enterMainMenu;
    window.enterMainMenu = function () {
        _origEnterMainMenu();
        connectSocket();
        hookUI();
        refreshFriends();
    };

    document.getElementById('btnLogout') && document.getElementById('btnLogout').addEventListener('click', () => {
        if (Net.socket) { Net.socket.disconnect(); Net.socket = null; }
    });
})();
        incBox.querySelectorAll('[data-dec]').forEach(btn => {
            btn.onclick = async () => {
                await api('/api/friends/decline', { method: 'POST', body: { fromUsername: btn.dataset.dec } });
                refreshFriends();
            };
        });

        const friends = state.friends || [];
        listBox.innerHTML = friends.length === 0
            ? '<div style="opacity:0.7;">Henüz arkadaşın yok. Yukarıdan kullanıcı ara.</div>'
            : friends.map(f => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #34495e33;">
                    <span>${f.username} ${f.online ? '🟢' : '⚪'}</span>
                </div>`).join('');
    }

    // ==================== SEVİYE SEÇİM MODALI (Tek/Arkadaş) ====================
    let pendingLevel = null;

    function buildLevelChoiceDom() {
        if (document.getElementById('levelChoiceScreen')) return;
        const wrap = document.createElement('div');
        wrap.id = 'levelChoiceScreen';
        wrap.className = 'screen-overlay hidden';
        wrap.innerHTML = `
            <div class="menu-panel">
                <h1 id="levelChoiceTitle">Bölüm</h1>
                <div class="subtitle">Nasıl oynamak istersin?</div>
                <button class="menu-btn primary" id="btnPlaySolo">🧍 Tek Başına Oyna</button>
                <button class="menu-btn secondary" id="btnPlayWithFriend">🤝 Arkadaşımla Oyna</button>
                <button class="menu-btn danger small" id="btnLevelChoiceBack">← Geri</button>
            </div>`;
        document.body.appendChild(wrap);

        document.getElementById('btnLevelChoiceBack').onclick = () => showScreen('campaign');
        document.getElementById('btnPlaySolo').onclick = () => {
            showScreen('game');
            startCampaignLevel(pendingLevel);
        };
        document.getElementById('btnPlayWithFriend').onclick = () => openFriendPickerForLevel(pendingLevel);
    }

    function openLevelChoice(lv) {
        pendingLevel = lv;
        document.getElementById('levelChoiceTitle').textContent = lv + '. Bölüm';
        hideAllOverlays();
        document.getElementById('levelChoiceScreen').classList.remove('hidden');
    }

    // ==================== ARKADAŞ SEÇ + DAVET GÖNDER ====================
    function buildFriendPickerDom() {
        if (document.getElementById('friendPickerScreen')) return;
        const wrap = document.createElement('div');
        wrap.id = 'friendPickerScreen';
        wrap.className = 'screen-overlay hidden';
        wrap.innerHTML = `
            <div class="menu-panel">
                <h1>🤝 Arkadaşını Davet Et</h1>
                <div class="subtitle" id="friendPickerSubtitle"></div>
                <div id="friendPickerList" style="text-align:left;max-height:260px;overflow-y:auto;"></div>
                <button class="menu-btn danger small" id="btnFriendPickerBack">← Geri</button>
            </div>`;
        document.body.appendChild(wrap);
        document.getElementById('btnFriendPickerBack').onclick = () => openLevelChoice(pendingLevel);
    }

    async function openFriendPickerForLevel(lv) {
        buildFriendPickerDom();
        hideAllOverlays();
        document.getElementById('friendPickerScreen').classList.remove('hidden');
        document.getElementById('friendPickerSubtitle').textContent = lv + '. Bölüm için davet edilecek arkadaş';
        const list = document.getElementById('friendPickerList');
        list.innerHTML = 'Yükleniyor...';
        try {
            const data = await api('/api/friends');
            const online = (data.friends || []).filter(f => f.online);
            if (online.length === 0) {
                list.innerHTML = '<div style="opacity:0.8;">Şu an çevrimiçi arkadaşın yok.</div>';
                return;
            }
            list.innerHTML = '';
            online.forEach(f => {
                const row = document.createElement('div');
                row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #34495e33;';
                row.innerHTML = `<span>${f.username} 🟢</span>`;
                const btn = document.createElement('button');
                btn.className = 'menu-btn primary small';
                btn.style.margin = '0';
                btn.textContent = 'Davet Et';
                btn.onclick = () => {
                    Net.socket.emit('invite:send', { toUsername: f.username, level: lv });
                    showWaitingForFriendScreen(f.username);
                };
                row.appendChild(btn);
                list.appendChild(row);
            });
        } catch (e) { list.innerHTML = 'Hata: ' + (e.message || ''); }
    }

    function buildWaitingForFriendDom() {
        if (document.getElementById('waitingFriendScreen')) return;
        const wrap = document.createElement('div');
        wrap.id = 'waitingFriendScreen';
        wrap.className = 'screen-overlay hidden';
        wrap.innerHTML = `
            <div class="menu-panel">
                <h1>⏳ Bekleniyor...</h1>
                <div class="subtitle" id="waitingFriendText">Davet gönderildi.</div>
                <button class="menu-btn danger small" id="btnCancelWaitFriend">İptal</button>
            </div>`;
        document.body.appendChild(wrap);
        document.getElementById('btnCancelWaitFriend').onclick = () => {
            hideWaitingForFriendScreen();
            openFriendPickerForLevel(pendingLevel);
        };
    }
    function showWaitingForFriendScreen(name) {
        buildWaitingForFriendDom();
        hideAllOverlays();
        document.getElementById('waitingFriendText').textContent = name + ' kabul etmesini bekliyoruz...';
        document.getElementById('waitingFriendScreen').classList.remove('hidden');
    }
    function hideWaitingForFriendScreen() {
        const el = document.getElementById('waitingFriendScreen');
        if (el) el.classList.add('hidden');
    }

    // ==================== DAVET BİLDİRİMİ (gelen istek) ====================
    function showInviteToast(fromUsername, level) {
        let el = document.getElementById('inviteToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'inviteToast';
            el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);' +
                'background:rgba(0,0,0,0.92);color:#fff;padding:16px 20px;border-radius:12px;' +
                'z-index:6000;box-shadow:0 10px 24px rgba(0,0,0,0.6);text-align:center;';
            document.body.appendChild(el);
        }
        el.innerHTML = `
            <div style="margin-bottom:10px;">🎮 <b>${fromUsername}</b> seni ${level}. bölüme davet ediyor</div>
            <button class="menu-btn primary small" id="inviteAcceptBtn">Kabul Et</button>
            <button class="menu-btn danger small" id="inviteDeclineBtn">Reddet</button>`;
        el.style.display = 'block';
        document.getElementById('inviteAcceptBtn').onclick = () => {
            Net.socket.emit('invite:accept', { toUsername: fromUsername, level });
            el.style.display = 'none';
        };
        document.getElementById('inviteDeclineBtn').onclick = () => {
            Net.socket.emit('invite:decline', { toUsername: fromUsername });
            el.style.display = 'none';
        };
    }

    // ==================== HIZLI EŞLEŞME (VERSUS) ====================
    function buildMatchmakingDom() {
        if (document.getElementById('matchmakingScreen')) return;
        const wrap = document.createElement('div');
        wrap.id = 'matchmakingScreen';
        wrap.className = 'screen-overlay hidden';
        wrap.innerHTML = `
            <div class="menu-panel">
                <h1>⚔️ Hızlı Eşleşme</h1>
                <div class="subtitle" id="mmStatusText">Rakip aranıyor...</div>
                <button class="menu-btn danger small" id="btnCancelMatchmaking">İptal</button>
            </div>`;
        document.body.appendChild(wrap);
        document.getElementById('btnCancelMatchmaking').onclick = () => {
            Net.socket.emit('mp:queue:leave');
            hideMatchmakingScreen();
            showScreen('menu');
        };
    }
    function setMatchmakingStatus(txt) {
        const el = document.getElementById('mmStatusText');
        if (el) el.textContent = txt;
    }
    function hideMatchmakingScreen() {
        const el = document.getElementById('matchmakingScreen');
        if (el) el.classList.add('hidden');
    }
    function startQuickMatch() {
        buildMatchmakingDom();
        hideAllOverlays();
        document.getElementById('matchmakingScreen').classList.remove('hidden');
        setMatchmakingStatus('Rakip aranıyor...');
        Net.socket.emit('mp:queue:join');
    }

    function hideAllOverlays() {
        ['authScreen','mainMenu','campaignScreen','friendsScreen','levelChoiceScreen',
         'friendPickerScreen','waitingFriendScreen','matchmakingScreen'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        gameContainerRef().classList.add('menu-hidden');
    }
    function gameContainerRef() { return document.getElementById('game-container'); }

    // ==================== AĞ ÜZERİNDEN OYUN BAŞLATMA ====================
    function joinRoomAndStart({ roomId, mode, level, isHost, peerUsername }) {
        Net.active = true;
        Net.mode = mode;
        Net.isHost = isHost;
        Net.roomId = roomId;
        Net.peerUsername = peerUsername;
        Net.socket.emit('room:join', { roomId });

        hideAllOverlays();
        showScreen('game');
        resizeCanvas();

        if (isHost) {
            level = level || 1;
            window.level = level;
            isGameOver = false;
            modal.classList.add('hidden');
            resetLevel();
            // Versus'ta düşman tarafı artık YZ değil, guest'in komutlarıyla yönetiliyor.
            startGameLoop();
            hostBroadcastLoop();
            if (mode === 'versus') startNetCooldownTicker();
            toast((mode === 'coop' ? 'Ortak sefer' : 'Versus maç') + ' başladı: ' + peerUsername);
        } else {
            // Guest: yerel fizik SİMÜLE ETMEZ, sadece host'tan gelen görüntüyü çizer.
            isGameOver = false;
            guestSpectatorLoop();
            toast((mode === 'coop' ? 'Ortak sefer' : 'Versus maç') + ' başladı: ' + peerUsername);
        }
    }

    function leaveNetGame() {
        if (Net.socket) Net.socket.emit('room:leave');
        Net.active = false;
        Net.mode = null;
        Net.isHost = false;
        Net.roomId = null;
        isGameOver = true;
        if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
        showScreen('menu');
    }

        // ---- BUG FİX: showScreen, yeni eklenen ekranlardan (arkadaşlar, bölüm
    // seçimi, davet bekleme, eşleşme) haberi olmadığı için onları kapatmıyordu
    // -> ekranlar üst üste binip oyunu/menüyü kilitliyordu. showScreen'i
    // sarmalayıp her çağrıda önce hepsini kapatıyoruz.
    const _origShowScreen = window.showScreen;
    window.showScreen = function (which) {
        ['friendsScreen', 'levelChoiceScreen', 'friendPickerScreen',
         'waitingFriendScreen', 'matchmakingScreen'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add('hidden');
        });
        _origShowScreen(which);
    };

    // ---- HOST: YZ'yi versus modunda devre dışı bırak ----
    const _originalUpdateAI = window.updateAI;
    window.updateAI = function () {
        if (Net.active && Net.isHost && Net.mode === 'versus') {
            return; // enemy tarafı guest'in komutlarıyla yönetiliyor (game:input)
        }
        _originalUpdateAI();
    };

    // ---- HOST: guest'ten gelen komutları uygula ----
    function onHostReceiveInput(msg) {
        if (!Net.active || !Net.isHost) return;
        const targetTeam = (Net.mode === 'versus') ? enemy : player; // coop'ta ortak takım = player
        if (msg.type === 'command') {
            targetTeam.command = msg.cmd;
        } else if (msg.type === 'buy') {
            buyUnitForTeam(targetTeam, msg.unit, Net.mode === 'versus' ? false : true);
        }
    }

    const NET_COOLDOWNS = {
        miner: { cost: 150, cdField: 'minerCooldown', maxCd: 15 * 60 },
        club: { cost: 125, cdField: 'clubCooldown', maxCd: 10 * 60 },
        archer: { cost: 140, cdField: 'archerCooldown', maxCd: 11 * 60 },
    };

    function buyUnitForTeam(team, unitType, isPlayerSide) {
        const info = NET_COOLDOWNS[unitType];
        if (!info) return;
        if (team.gold < info.cost) return;
        if ((team[info.cdField] || 0) > 0) return; // eşleşen kişi için de bekleme süresi geçerli
        const count = units.filter(u => u.isPlayer === isPlayerSide &&
            ((unitType === 'miner' && u instanceof Miner) ||
             (unitType === 'club' && u instanceof Clubman) ||
             (unitType === 'archer' && u instanceof Archer))).length;
        const cap = unitType === 'miner' ? MAX_MINERS_PER_TEAM : unitType === 'club' ? MAX_CLUBMEN_PER_TEAM : MAX_ARCHERS_PER_TEAM;
        if (count >= cap) return;
        team.gold -= info.cost;
        team[info.cdField] = info.maxCd;
        if (unitType === 'miner') units.push(new Miner(isPlayerSide));
        else if (unitType === 'club') units.push(new Clubman(isPlayerSide));
        else if (unitType === 'archer') units.push(new Archer(isPlayerSide));
    }

    // Versus modunda enemy tarafının YZ'si kapalı olduğu için kendi bekleme
    // sürelerini biz azaltmalıyız (co-op'ta player zaten ana oyun döngüsünde azalıyor).
    let netCooldownTicker = null;
    function startNetCooldownTicker() {
        if (netCooldownTicker) clearInterval(netCooldownTicker);
        netCooldownTicker = setInterval(() => {
            if (!Net.active || !Net.isHost || Net.mode !== 'versus' || isGameOver) {
                clearInterval(netCooldownTicker);
                return;
            }
            ['minerCooldown', 'clubCooldown', 'archerCooldown'].forEach(f => {
                if (enemy[f] > 0) enemy[f]--;
            });
        }, 1000 / 60);
    }

    // ---- HOST: periyodik anlık görüntü yayınla ----
    let hostBroadcastTimer = null;
    function hostBroadcastLoop() {
        if (hostBroadcastTimer) clearInterval(hostBroadcastTimer);
        hostBroadcastTimer = setInterval(() => {
            if (!Net.active || !Net.isHost || isGameOver) { clearInterval(hostBroadcastTimer); return; }
            const snapshot = {
                worldWidth,
                level,
                playerBase: { x: player.base.x, y: player.base.y, hp: player.base.hp, maxHp: player.base.maxHp },
                enemyBase: { x: enemy.base.x, y: enemy.base.y, hp: enemy.base.hp, maxHp: enemy.base.maxHp },
                playerGold: player.gold,
                enemyGold: enemy.gold,
                playerCommand: player.command,
                enemyCommand: enemy.command,
                units: units.map(u => ({
                    x: Math.round(u.x), y: Math.round(u.y),
                    hp: Math.round(u.hp), maxHp: u.maxHp,
                    isPlayer: u.isPlayer,
                    type: u instanceof Miner ? 'miner' : (u instanceof Clubman ? 'club' : 'archer'),
                })),
                over: isGameOver,
            };
            Net.socket.emit('game:state', snapshot);
        }, 80); // ~12.5 Hz — canvas'ı boğmayacak, guest için yeterince akıcı
    }

    // ---- GUEST: gelen anlık görüntüyü basitçe çiz ----
    class NetUnit {
        constructor(d) {
            this.x = d.x; this.y = d.y; this.hp = d.hp; this.maxHp = d.maxHp;
            this.isPlayer = d.isPlayer; this.type = d.type;
        }
        draw(ctx) {
            const color = this.isPlayer ? '#1a1a1a' : '#c0392b';
            const weapon = this.type === 'miner' ? 'pickaxe' : (this.type === 'club' ? 'club' : 'bow');
            drawStickman(ctx, this.x, this.y, color, weapon, 0, false, !this.isPlayer, 0);
            ctx.fillStyle = 'red'; ctx.fillRect(this.x - 15, this.y - 65, 30, 4);
            ctx.fillStyle = '#2ecc71'; ctx.fillRect(this.x - 15, this.y - 65, 30 * (this.hp / (this.maxHp || 1)), 4);
        }
    }

    function onGuestReceiveState(snapshot) {
        if (!Net.active || Net.isHost) return;
        Net.lastSnapshotAt = performance.now();
        worldWidth = snapshot.worldWidth;
        level = snapshot.level;
        player.base.x = snapshot.playerBase.x; player.base.y = snapshot.playerBase.y;
        player.base.hp = snapshot.playerBase.hp; player.base.maxHp = snapshot.playerBase.maxHp;
        enemy.base.x = snapshot.enemyBase.x; enemy.base.y = snapshot.enemyBase.y;
        enemy.base.hp = snapshot.enemyBase.hp; enemy.base.maxHp = snapshot.enemyBase.maxHp;
        player.gold = snapshot.playerGold; enemy.gold = snapshot.enemyGold;
        player.command = snapshot.playerCommand; enemy.command = snapshot.enemyCommand;
        units = snapshot.units.map(u => new NetUnit(u));
        Net.myGold = (Net.mode === 'versus') ? snapshot.enemyGold : snapshot.playerGold;

        goldEl.innerText = Net.myGold;
        levelEl.innerText = Math.min(level, 3) + '/3';

        if (snapshot.over) leaveNetGame();
    }

    let guestLoopActive = false;
    function guestSpectatorLoop() {
        guestLoopActive = true;
        if (playerMineSlots.length === 0) initMines();
        function frame() {
            if (!Net.active || Net.isHost) { guestLoopActive = false; return; }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(-cameraX, 0);
            drawEnvironment(ctx);
            drawBase(ctx, true);
            drawBase(ctx, false);
            units.slice().sort((a, b) => a.y - b.y).forEach(u => u.draw(ctx));
            ctx.restore();
            requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    }

    // ---- GUEST: komut/satın alma gönderimi ----
    function guestSendCommand(cmd) { Net.socket.emit('game:input', { type: 'command', cmd }); }
    function guestSendBuy(unitType) { Net.socket.emit('game:input', { type: 'buy', unit: unitType }); }

    // ==================== MEVCUT UI'A BAĞLANTI (hook) ====================
    function hookUI() {
        buildFriendsScreenDom();
        buildLevelChoiceDom();

        // Ana menüde "Arkadaşlar" butonu ekle
        const menuPanel = document.querySelector('#mainMenu .menu-panel');
        if (menuPanel && !document.getElementById('btnFriends')) {
            const btn = document.createElement('button');
            btn.className = 'menu-btn secondary';
            btn.id = 'btnFriends';
            btn.textContent = '👥 Arkadaşlar';
            btn.onclick = () => { hideAllOverlays(); document.getElementById('friendsScreen').classList.remove('hidden'); refreshFriends(); };
            const logoutBtn = document.getElementById('btnLogout');
            menuPanel.insertBefore(btn, logoutBtn);
        }

        // Multiplayer butonunu gerçek eşleştirmeye bağla
        const mpBtn = document.getElementById('btnMultiplayer');
        if (mpBtn) {
            mpBtn.classList.remove('muted');
            mpBtn.classList.add('secondary');
            mpBtn.textContent = '2. Hızlı Eşleşme Oyna (Versus)';
            mpBtn.onclick = () => startQuickMatch();
        }

        // Sefer haritasındaki bölüm düğmelerini "tek/arkadaş" seçimine yönlendir
        document.querySelectorAll('.campaign-node').forEach(node => {
            node.onclick = () => {
                const lv = parseInt(node.dataset.level, 10);
                if (lv > (currentUser.maxUnlocked || 1)) { toast('Bu bölüm henüz kilitli!'); return; }
                openLevelChoice(lv);
            };
        });

        // Komut ve satın alma butonlarını ağ-farkında yap
        wrapCommandAndBuyButtons();
    }

    function wrapCommandAndBuyButtons() {
        const origSetPlayerCommand = window.setPlayerCommand;
        window.setPlayerCommand = function (cmd) {
            if (Net.active && !Net.isHost) { guestSendCommand(cmd); return; }
            origSetPlayerCommand(cmd);
            if (Net.active && Net.isHost && Net.mode === 'coop') { /* host zaten player.command'ı değiştirdi, paylaşılan */ }
        };
        document.getElementById('cmdRetreat').onclick = () => window.setPlayerCommand(CMD_RETREAT);
        document.getElementById('cmdDefend').onclick = () => window.setPlayerCommand(CMD_DEFEND);
        document.getElementById('cmdAttack').onclick = () => window.setPlayerCommand(CMD_ATTACK);

        const btnMinerEl = document.getElementById('btnMiner');
        const btnClubEl = document.getElementById('btnClub');
        const btnArcherEl = document.getElementById('btnArcher');

        btnMinerEl.onclick = () => {
            if (Net.active && !Net.isHost) { guestSendBuy('miner'); return; }
            const playerMiners = units.filter(u => u.isPlayer && u instanceof Miner).length;
            if (player.gold >= 150 && player.minerCooldown <= 0 && playerMiners < MAX_MINERS_PER_TEAM) {
                player.gold -= 150; units.push(new Miner(true)); player.minerCooldown = player.minerMaxCooldown;
            }
        };
        btnClubEl.onclick = () => {
            if (Net.active && !Net.isHost) { guestSendBuy('club'); return; }
            const playerClubmen = units.filter(u => u.isPlayer && u instanceof Clubman).length;
            if (player.gold >= 125 && player.clubCooldown <= 0 && playerClubmen < MAX_CLUBMEN_PER_TEAM) {
                player.gold -= 125; units.push(new Clubman(true)); player.clubCooldown = player.clubMaxCooldown;
            }
        };
        btnArcherEl.onclick = () => {
            if (Net.active && !Net.isHost) { guestSendBuy('archer'); return; }
            const playerArchers = units.filter(u => u.isPlayer && u instanceof Archer).length;
            if (player.gold >= 140 && player.archerCooldown <= 0 && playerArchers < MAX_ARCHERS_PER_TEAM) {
                player.gold -= 140; units.push(new Archer(true)); player.archerCooldown = player.archerMaxCooldown;
            }
        };
    }

    // ==================== BAŞLAT ====================
    // Giriş/kayıt sonrası socket bağlan; her enterMainMenu çağrısında da dene.
    const _origEnterMainMenu = window.enterMainMenu;
    window.enterMainMenu = function () {
        _origEnterMainMenu();
        connectSocket();
        hookUI();
        refreshFriends();
    };

    document.getElementById('btnLogout') && document.getElementById('btnLogout').addEventListener('click', () => {
        if (Net.socket) { Net.socket.disconnect(); Net.socket = null; }
    });
})();
