// ==================== 04-gameplay.js ====================
// Oyun mantığı, sinematik, AI, spawn sistemleri

function setPlayerCommand(cmd) {
    const oi = localOwnerIndex();
    getOwnerState(oi).command = cmd;
    // Solo veya host: player.command senkron (AI tehdit hesabı için host tarafı)
    if (oi === 0) player.command = cmd;
    Object.values(cmdBtns).forEach(b => b.classList.remove('active'));
    if (cmdBtns[cmd]) cmdBtns[cmd].classList.add('active');
}

cmdBtns[CMD_RETREAT].onclick = () => {
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
        sendRoomInput('retreat'); return;
    }
    setPlayerCommand(CMD_RETREAT);
};
cmdBtns[CMD_DEFEND].onclick = () => {
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
        sendRoomInput('defend'); return;
    }
    setPlayerCommand(CMD_DEFEND);
};
cmdBtns[CMD_ATTACK].onclick = () => {
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
        sendRoomInput('attack'); return;
    }
    setPlayerCommand(CMD_ATTACK);
};

// Spawn süreleri (frame) — madenci ayrı; sopalı+okçu ortak sırada
const SPAWN_TIME = { miner: 8 * 60, club: 6 * 60, archer: 7 * 60 };
const UNIT_COST = { miner: 150, club: 125, archer: 140 };
const MAX_QUEUE = 8;

function countPlayerUnits(type) {
    if (type === 'miner') return units.filter(u => u.isPlayer && u instanceof Miner).length;
    if (type === 'club') return units.filter(u => u.isPlayer && u instanceof Clubman).length;
    if (type === 'archer') return units.filter(u => u.isPlayer && u instanceof Archer).length;
    return 0;
}
function maxForType(type) {
    if (type === 'miner') return MAX_MINERS_PER_TEAM;
    if (type === 'club') return MAX_CLUBMEN_PER_TEAM;
    if (type === 'archer') return MAX_ARCHERS_PER_TEAM;
    return 0;
}
function ensureQueues(st) {
    if (!st.minerQueue) st.minerQueue = [];
    if (!st.combatQueue) st.combatQueue = [];
    if (typeof st.minerTimer !== 'number') st.minerTimer = 0;
    if (typeof st.combatTimer !== 'number') st.combatTimer = 0;
}
function countQueuedFor(ownerIndex, type) {
    const st = getOwnerState(ownerIndex);
    ensureQueues(st);
    if (type === 'miner') return st.minerQueue.length;
    return st.combatQueue.filter(t => t === type).length;
}

// ===== TEST CHEAT =====
// Konsol:  unlockAll()  |  godMode()  |  godMode(false)
window.CHEAT_INF = false;
window.unlockAll = function unlockAll() {
    if (typeof currentUser !== 'undefined' && currentUser) {
        currentUser.maxUnlocked = 3;
        if (!currentUser.cleared) currentUser.cleared = [];
        [1, 2, 3].forEach(lv => {
            if (!currentUser.cleared.includes(lv)) currentUser.cleared.push(lv);
        });
        if (typeof saveCurrentUser === 'function') saveCurrentUser();
        if (typeof refreshCampaignNodes === 'function') refreshCampaignNodes();
        if (typeof showToast === 'function') showToast('Tüm seferler açık');
        else alert('Tüm seferler açık');
    } else {
        alert('Önce giriş yap');
    }
};
window.godMode = function godMode(on) {
    window.CHEAT_INF = (on !== false);
    if (window.CHEAT_INF) {
        try {
            const st = typeof getOwnerState === 'function' ? getOwnerState(typeof localOwnerIndex === 'function' ? localOwnerIndex() : 0) : player;
            if (st) st.gold = 999999;
            if (typeof player !== 'undefined') player.gold = 999999;
            if (typeof player2 !== 'undefined') player2.gold = 999999;
        } catch (_) {}
        if (typeof showToast === 'function') showToast('God mode: sonsuz altın + anında spawn');
        else console.log('[cheat] god mode ON');
    } else {
        if (typeof showToast === 'function') showToast('God mode kapalı');
        else console.log('[cheat] god mode OFF');
    }
    return window.CHEAT_INF;
};

function queueUnit(type, ownerIndex) {
    if (ownerIndex === undefined) ownerIndex = localOwnerIndex();
    const st = getOwnerState(ownerIndex);
    ensureQueues(st);
    if (!window.CHEAT_INF && st.gold < UNIT_COST[type]) return false;

    const live = countPlayerUnits(type);
    const q0 = countQueuedFor(0, type);
    const q1 = countQueuedFor(1, type);
    if (live + q0 + q1 >= maxForType(type)) return false;

    if (type === 'miner') {
        if (st.minerQueue.length >= MAX_QUEUE) return false;
        if (!window.CHEAT_INF) st.gold -= UNIT_COST.miner;
        st.minerQueue.push('miner');
        if (st.minerQueue.length === 1 && st.minerTimer <= 0) {
            st.minerTimerMax = window.CHEAT_INF ? 1 : SPAWN_TIME.miner;
            st.minerTimer = window.CHEAT_INF ? 1 : SPAWN_TIME.miner;
        }
    } else {
        if (st.combatQueue.length >= MAX_QUEUE) return false;
        if (!window.CHEAT_INF) st.gold -= UNIT_COST[type];
        st.combatQueue.push(type);
        if (st.combatQueue.length === 1 && st.combatTimer <= 0) {
            st.combatTimerMax = window.CHEAT_INF ? 1 : SPAWN_TIME[type];
            st.combatTimer = window.CHEAT_INF ? 1 : SPAWN_TIME[type];
        }
    }
    return true;
}

function processOneQueue(st, queueKey, timerKey, maxKey, ownerIndex) {
    ensureQueues(st);
    const q = st[queueKey];
    if (!q || q.length === 0) {
        st[timerKey] = 0;
        st[maxKey] = 0;
        return;
    }
    if (st[timerKey] > 0) {
        st[timerKey]--;
        if (st[timerKey] > 0) return;
    }
    const type = q.shift();
    try {
        if (type === 'miner') units.push(new Miner(true, ownerIndex));
        else if (type === 'club') units.push(new Clubman(true, ownerIndex));
        else if (type === 'archer') units.push(new Archer(true, ownerIndex));
    } catch (err) {
        console.error('Spawn hatası:', type, err);
    }
    if (q.length > 0) {
        const next = q[0];
        st[maxKey] = window.CHEAT_INF ? 1 : (SPAWN_TIME[next] || 600);
        st[timerKey] = st[maxKey];
    } else {
        st[timerKey] = 0;
        st[maxKey] = 0;
    }
}

function processSpawnQueueFor(ownerIndex) {
    const st = getOwnerState(ownerIndex);
    if (!st) return;
    processOneQueue(st, 'minerQueue', 'minerTimer', 'minerTimerMax', ownerIndex);
    processOneQueue(st, 'combatQueue', 'combatTimer', 'combatTimerMax', ownerIndex);
}

function processSpawnQueue() {
    processSpawnQueueFor(0);
    if (isCoopActive()) processSpawnQueueFor(1);
}

btnMiner.onclick = () => {
    if (isCinematicActive()) return;
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
        sendRoomInput('buyMiner'); return;
    }
    queueUnit('miner', 0);
};
btnClub.onclick = () => {
    if (isCinematicActive()) return;
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
        sendRoomInput('buyClub'); return;
    }
    queueUnit('club', 0);
};
btnArcher.onclick = () => {
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
        sendRoomInput('buyArcher'); return;
    }
    queueUnit('archer', 0);
};

// ==================== 3. BÖLÜM SİNEMATİK ====================
let cinematic = { active: false, phase: '', timer: 0, bubble: null, bubbleTimer: 0 };
let cinFog = [];
let cinBlood = [];

function isCinematicActive() {
    return !!(cinematic && cinematic.active);
}

function clampCameraToWorld() {
    const maxCam = Math.max(0, worldWidth - canvas.width);
    cameraX = Math.max(0, Math.min(cameraX, maxCam));
}

function setGameplayUIVisible(vis) {
    const layer = document.querySelector('.ui-layer');
    if (layer) layer.style.visibility = vis ? 'visible' : 'hidden';
    const cmds = document.querySelector('.command-bar');
    if (cmds) cmds.style.visibility = vis ? 'visible' : 'hidden';
    try {
        btnMiner.disabled = !vis;
        btnClub.disabled = !vis;
        if (btnArcher) btnArcher.disabled = !vis;
    } catch (_) {}
}

function spawnCinFog(x, y, count) {
    for (let i = 0; i < (count || 14); i++) {
        cinFog.push({
            x: x + (Math.random() - 0.5) * 70,
            y: y + (Math.random() - 0.5) * 40,
            r: 18 + Math.random() * 32,
            life: 50 + Math.random() * 40,
            maxLife: 70,
            vx: (Math.random() - 0.5) * 0.8,
            vy: -0.3 - Math.random() * 0.5,
        });
    }
}

function updateCinFog() {
    for (let i = cinFog.length - 1; i >= 0; i--) {
        const p = cinFog[i];
        p.x += p.vx;
        p.y += p.vy;
        p.r += 0.25;
        p.life--;
        if (p.life <= 0) cinFog.splice(i, 1);
    }
}

function drawCinFog(ctx) {
    cinFog.forEach(p => {
        const a = Math.max(0, p.life / p.maxLife) * 0.45;
        ctx.save();
        ctx.globalAlpha = a;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, 'rgba(180,170,150,0.85)');
        g.addColorStop(0.5, 'rgba(140,130,110,0.4)');
        g.addColorStop(1, 'rgba(100,90,70,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

function spawnBloodDrop(x, y) {
    cinBlood.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y,
        vy: 0.5 + Math.random() * 0.5,
        r: 2 + Math.random() * 2.2,
        life: 45,
        maxLife: 45,
    });
}

function updateCinBlood() {
    for (let i = cinBlood.length - 1; i >= 0; i--) {
        const b = cinBlood[i];
        b.y += b.vy;
        b.life--;
        if (b.life <= 0) cinBlood.splice(i, 1);
    }
}

function drawCinBlood(ctx) {
    cinBlood.forEach(b => {
        const a = Math.max(0, b.life / b.maxLife) * 0.85;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = '#8b0000';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });
}

// ===== SİNEMATİK BAŞLAT =====
function startLevel3Cinematic() {
    cinFog = [];
    cinBlood = [];
    cinematic = {
        active: true,
        phase: 'walk',
        timer: 0,
        bubble: null,
        bubbleTimer: 0,
        bubbleQueue: [
            { at: 50, text: 'İsyancı kampına doğru ilerliyoruz…', hold: 170 },
            { at: 250, text: 'Komutan: “Dikkatli olun.”', hold: 160 },
            { at: 450, text: 'Sessizlik… fazla sessiz.', hold: 160 },
            { at: 650, text: 'İzleri takip edin.', hold: 150 },
        ],
        ambushSaid: false,
        fightStarted: false,
        wave2: false,
        wave3: false,
        archersSpawned: false,
        commanderFleeStarted: false,
        supportArcherSpawned: false,
        duelReinforced: false,
        survivorArcher: null,
    };
    setGameplayUIVisible(false);
    setPlayerCommand(CMD_ATTACK);

    for (let i = 0; i < 3; i++) {
        const c = new Clubman(true, 0);
        c.x = player.base.x + 50 + i * 36;
        c.y = player.base.y + (i - 1) * 28;
        c.hp = c.maxHp = 150;
        c._cinematic = true;
        c._cinRole = 'scout';
        c._cinLane = i;
        units.push(c);
    }
    cameraX = Math.max(0, player.base.x - canvas.width * 0.35);
    clampCameraToWorld();
}

// ===== SİNEMATİK BİTİR =====
function endLevel3Cinematic() {
    const survivor = (cinematic.survivorArcher && cinematic.survivorArcher.hp > 0) ? cinematic.survivorArcher : null;

    units = units.filter(u => {
        if (u === survivor) return true;
        if (u._cinematic) {
            if (u instanceof Miner && typeof u.releaseSlot === 'function') u.releaseSlot();
            return false;
        }
        return true;
    });

    if (survivor) {
        survivor._cinematic = false;
        survivor._cinRole = null;
        survivor._cinLane = null;
        survivor._spawnWalkIn = 0;
        survivor.ownerIndex = 0;
        survivor.x = player.base.x + 60;
        survivor.y = player.base.y;
        survivor.target = null;
        survivor.isAttacking = false;
        survivor._isActuallyWalking = false;
    }

    player.base.hp = Math.max(1, player.base.hp - 10);

    cinFog = [];
    cinBlood = [];
    cinematic = { active: false, phase: '', timer: 0, bubble: null, bubbleTimer: 0 };
    setGameplayUIVisible(true);
    setPlayerCommand(CMD_DEFEND);
    
    // ===== DÜZELTME: Pusu hemen başlasın =====
    ambushTimer = 20 * 60; // 20 saniyeyi doldur → ilk dalga hemen gelir
    
    enemy.ambushWaves = null;
    enemy.ambushWaveIndex = 0;
    cameraX = Math.max(0, Math.min(player.base.x - 80, worldWidth - canvas.width));
    clampCameraToWorld();
    if (typeof showToast === 'function') showToast('Pusu başladı — heykeli savunun!');
}

function cinFocusCamera(xs, bias) {
    if (!xs || !xs.length) return;
    const avgX = xs.reduce((s, v) => s + v, 0) / xs.length;
    const targetCam = avgX - canvas.width * (bias != null ? bias : 0.42);
    cameraX += (targetCam - cameraX) * 0.055;
    clampCameraToWorld();
}

// ===== ORAKÇI SPAWN (HARİTA DIŞINDAN YÜRÜYEREK) =====
function spawnAmbusherAt(targetX, targetY, lane) {
    const s = new Sicklewrath(false);
    // Haritanın sağ kenarının 300 piksel dışından başlasın
    const startX = worldWidth + 300 + Math.random() * 100;
    s.x = startX;
    s.y = targetY + (Math.random() - 0.5) * 20;
    s.hp = s.maxHp = 75;
    s._cinematic = true;
    s._cinRole = 'ambusher';
    s._cinLane = lane;
    s._spawnTargetX = targetX;
    s._spawnTargetY = targetY;
    s._spawnWalkIn = 120; // 2 saniye yürüme
    units.push(s);
    return s;
}

// ===== OKÇU SPAWN (DAĞA YAKIN, YÜRÜYEREK) =====
function spawnCinArcher(targetX, targetY, lane, fromOffset) {
    const a = new Archer(true, 0);
    const offset = fromOffset || 90;
    const startX = targetX - offset - Math.random() * 30;
    a.x = Math.max(startX, 20);
    a.y = targetY + (Math.random() - 0.5) * 20;
    a.hp = a.maxHp = 80;
    a._cinematic = true;
    a._cinRole = 'archer';
    a._cinLane = lane;
    a._spawnTargetX = targetX;
    a._spawnTargetY = targetY;
    a._spawnWalkIn = 60; // 1 saniye yürüme
    units.push(a);
    return a;
}

// ===== SİNEMATİK GÜNCELLEME =====
function updateCinematic() {
    if (!cinematic.active) return;
    cinematic.timer++;
    frames++;
    updateCinFog();
    updateCinBlood();

    let scouts = units.filter(u => u._cinematic && u._cinRole === 'scout' && u.hp > 0);
    let foes = units.filter(u => u._cinematic && u._cinRole === 'ambusher' && u.hp > 0);
    let archers = units.filter(u => u._cinematic && u._cinRole === 'archer' && u.hp > 0);

    // Konuşma balonu sayaçları
    units.forEach(u => {
        if (u._speechTimer > 0) {
            u._speechTimer--;
            if (u._speechTimer <= 0) u._speechText = null;
        }
    });

    if (cinematic.bubbleQueue && cinematic.bubbleQueue.length) {
        const next = cinematic.bubbleQueue[0];
        if (cinematic.timer >= next.at && cinematic.bubbleTimer <= 0) {
            cinematic.bubble = next.text;
            cinematic.bubbleTimer = next.hold || 150;
            cinematic.bubbleQueue.shift();
        }
    }
    if (cinematic.bubbleTimer > 0) cinematic.bubbleTimer--;
    else if (cinematic.phase === 'walk' || cinematic.phase === 'aftermath') {
        if (cinematic.bubbleTimer <= 0) cinematic.bubble = null;
    }
    if (cinematic.bubbleTimer <= 0 && cinematic.phase !== 'ambush' && cinematic.phase !== 'fight' && cinematic.phase !== 'notice'
        && cinematic.phase !== 'commanderFlee' && cinematic.phase !== 'archerDuel' && cinematic.phase !== 'escape') {
        cinematic.bubble = null;
    }

    const spikeX = Math.min(enemy.base.x - 320, worldWidth - 400);
    const walkStop = Math.min(spikeX - 60, worldWidth - canvas.width * 0.55);

    // ===== FAZ: YÜRÜYÜŞ =====
    if (cinematic.phase === 'walk') {
        if (scouts.length) {
            cinFocusCamera(scouts.map(u => u.x), 0.4);
            scouts.forEach((u) => {
                u.prevX = u.x;
                const laneY = player.base.y + (u._cinLane - 1) * 30;
                const tx = walkStop + (u._cinLane - 1) * 18;
                if (u.x < tx - 2) {
                    u.x += 1.1 * SPEED_MULT;
                    u.y += (laneY - u.y) * 0.04;
                    u._isActuallyWalking = true;
                    u.isAttacking = false;
                } else {
                    u.x = tx;
                    u._isActuallyWalking = false;
                }
            });
            const minX = Math.min(...scouts.map(u => u.x));
            if (minX >= walkStop - 30 && !cinematic.ambushSaid) {
                cinematic.phase = 'notice';
                cinematic.timer = 0;
                cinematic.bubble = 'Durun… dikenler mi o?';
                cinematic.bubbleTimer = 150;
                cinematic.ambushSaid = true;
            }
        }
    }
    // ===== FAZ: FARK ETTİ =====
    else if (cinematic.phase === 'notice') {
        scouts.forEach(u => { u._isActuallyWalking = false; u.isAttacking = false; });
        if (scouts.length) cinFocusCamera(scouts.map(u => u.x), 0.38);
        if (cinematic.timer === 160) {
            cinematic.bubble = 'BU BİR PUSU!';
            cinematic.bubbleTimer = 170;
        }
        if (cinematic.timer > 340) {
            cinematic.phase = 'ambush';
            cinematic.timer = 0;
        }
    }
    // ===== FAZ: PUSU BAŞLANGICI =====
    else if (cinematic.phase === 'ambush') {
        if (scouts.length) cinFocusCamera(scouts.map(u => u.x), 0.4);
        scouts.forEach(u => { u._isActuallyWalking = false; });
        if (cinematic.timer === 15 && !cinematic.fightStarted) {
            const spots = [
                { x: walkStop + 150, y: player.base.y - 55 },
                { x: walkStop + 190, y: player.base.y + 8 },
                { x: walkStop + 170, y: player.base.y + 55 },
                { x: walkStop + 250, y: player.base.y - 28 },
                { x: walkStop + 270, y: player.base.y + 38 },
                { x: walkStop + 230, y: player.base.y - 80 },
                { x: walkStop + 290, y: player.base.y + 75 },
            ];
            spots.forEach((sp, i) => spawnAmbusherAt(sp.x, sp.y, i));
            cinematic.fightStarted = true;
            cinematic.bubble = 'Dikenlerin arkasından çıktılar!';
            cinematic.bubbleTimer = 130;
        }
        if (cinematic.timer > 100) {
            cinematic.phase = 'fight';
            cinematic.timer = 0;
        }
    }
    // ===== FAZ: SAVAŞ =====
    else if (cinematic.phase === 'fight') {
        scouts = units.filter(u => u._cinematic && u._cinRole === 'scout' && u.hp > 0);
        foes = units.filter(u => u._cinematic && u._cinRole === 'ambusher' && u.hp > 0);
        archers = units.filter(u => u._cinematic && u._cinRole === 'archer' && u.hp > 0);
        const allAlive = units.filter(u => u._cinematic && u.hp > 0);
        if (allAlive.length) cinFocusCamera(allAlive.map(u => u.x), 0.44);

        // Dalga 2
        if (cinematic.timer === 180 && !cinematic.wave2) {
            cinematic.wave2 = true;
            [
                { x: walkStop + 200, y: player.base.y - 70 },
                { x: walkStop + 230, y: player.base.y + 5 },
                { x: walkStop + 210, y: player.base.y + 70 },
                { x: walkStop + 300, y: player.base.y - 20 },
                { x: walkStop + 260, y: player.base.y - 95 },
                { x: walkStop + 280, y: player.base.y + 95 },
            ].forEach((sp, i) => spawnAmbusherAt(sp.x, sp.y, 10 + i));
            cinematic.bubble = 'Daha fazlası geliyor!';
            cinematic.bubbleTimer = 130;
        }

        // Okçular gelir (dağa yakın)
        if (cinematic.timer === 320 && !cinematic.archersSpawned) {
            cinematic.archersSpawned = true;
            for (let i = 0; i < 4; i++) {
                spawnCinArcher(walkStop - 80 - i * 25, player.base.y + (i - 1.5) * 28, i, 80);
            }
            cinematic.bubble = 'Okçular arkadan geliyor!';
            cinematic.bubbleTimer = 130;
        }

        // Dalga 3
        if (cinematic.timer === 450 && !cinematic.wave3) {
            cinematic.wave3 = true;
            [
                { x: walkStop + 220, y: player.base.y - 50 },
                { x: walkStop + 260, y: player.base.y + 15 },
                { x: walkStop + 240, y: player.base.y + 60 },
                { x: walkStop + 310, y: player.base.y - 35 },
                { x: walkStop + 320, y: player.base.y + 45 },
                { x: walkStop + 270, y: player.base.y - 100 },
                { x: walkStop + 340, y: player.base.y + 90 },
            ].forEach((sp, i) => spawnAmbusherAt(sp.x, sp.y, 20 + i));
            cinematic.bubble = 'Her yerdeler…!';
            cinematic.bubbleTimer = 130;
        }

        // Tüm birimleri güncelle
        allAlive.forEach(u => {
            try {
                u.prevX = u.x;

                // ===== YÜRÜME MEKANİĞİ (DÜZELTİLMİŞ) =====
                if (u._spawnWalkIn > 0) {
                    u._spawnWalkIn--;
                    const speed = 2.0 * SPEED_MULT;
                    const dx = u._spawnTargetX - u.x;
                    const dy = (u._spawnTargetY || u.y) - u.y;
                    const dist = Math.hypot(dx, dy);
                    if (dist > 5) {
                        const angle = Math.atan2(dy, dx);
                        u.x += Math.cos(angle) * speed;
                        u.y += Math.sin(angle) * speed;
                    } else {
                        u.x = u._spawnTargetX;
                        u.y = u._spawnTargetY || u.y;
                        u._spawnWalkIn = 0;
                    }
                    u._isActuallyWalking = true;
                    u.isAttacking = false;
                    return;
                }

                if (u._cinRole === 'scout') {
                    const lane = u._cinLane || 0;
                    if (lane !== 1 && cinematic.timer < 100) {
                        u.x -= 1.2 * SPEED_MULT;
                        u._isActuallyWalking = true;
                        u.isAttacking = false;
                        if (cinematic.timer === 50 && lane === 0) {
                            cinematic.bubble = 'Geri çekilin!';
                            cinematic.bubbleTimer = 110;
                        }
                    } else {
                        const target = foes[lane % Math.max(1, foes.length)] || foes[0];
                        u.target = target || null;
                        if (target) {
                            const dist = Math.hypot(target.x - u.x, target.y - u.y);
                            if (dist > 46) {
                                const ang = Math.atan2(target.y - u.y, target.x - u.x);
                                u.x += Math.cos(ang) * 1.7 * SPEED_MULT;
                                u.y += Math.sin(ang) * 1.1 * SPEED_MULT;
                                u._isActuallyWalking = true;
                                u.isAttacking = false;
                            } else {
                                u._isActuallyWalking = false;
                                u.isAttacking = true;
                                u.attackTimer = (u.attackTimer || 0) + 1;
                                if (u.attackTimer === 50) {
                                    target.hp -= u.damage || 12;
                                    if (typeof addFloatingText === 'function')
                                        addFloatingText(target.x, target.y - 20, '-' + (u.damage || 12), '#e74c3c');
                                }
                                if (u.attackTimer >= 90) u.attackTimer = 0;
                            }
                        }
                    }
                } else if (u._cinRole === 'archer') {
                    const target = foes[0];
                    u.target = target || null;
                    u._isActuallyWalking = false;
                    if (target) {
                        u.attackTimer = (u.attackTimer || 0) + 1;
                        if (u.attackTimer === 40) {
                            target.hp -= 8;
                            if (typeof addFloatingText === 'function')
                                addFloatingText(target.x, target.y - 20, '-8', '#3498db');
                            if (typeof projectiles !== 'undefined') {
                                try {
                                    projectiles.push(new Arrow(u.x, u.y - 20, target, true));
                                } catch (_) {}
                            }
                        }
                        if (u.attackTimer >= 70) u.attackTimer = 0;
                    }
                } else if (u._cinRole !== 'commander') {
                    const target = scouts[u._cinLane % Math.max(1, scouts.length)] || scouts[0] || archers[0];
                    u.target = target || null;
                    if (target) {
                        const dist = Math.hypot(target.x - u.x, target.y - u.y);
                        if (dist > 50) {
                            const ang = Math.atan2(target.y - u.y, target.x - u.x);
                            const side = (u._cinLane % 2 === 0) ? 1 : -1;
                            u.x += Math.cos(ang) * 1.45 * SPEED_MULT;
                            u.y += Math.sin(ang) * 1.05 * SPEED_MULT + side * 0.35;
                            u._isActuallyWalking = true;
                            u.isAttacking = false;
                        } else {
                            u._isActuallyWalking = false;
                            u.isAttacking = true;
                            u.attackTimer = (u.attackTimer || 0) + 1;
                            if (u.attackTimer === 18) {
                                target.hp -= u.damage || 15;
                                if (typeof addFloatingText === 'function')
                                    addFloatingText(target.x, target.y - 20, '-' + (u.damage || 15), '#c0392b');
                            }
                            if (u.attackTimer >= 48) u.attackTimer = 0;
                        }
                    }
                }
            } catch (err) { console.error(err); }
        });

        // Dalga 3'ten sonra komutan kaçar
        if (cinematic.timer === 520 && cinematic.wave3 && !cinematic.commanderFleeStarted) {
            cinematic.commanderFleeStarted = true;
            const aliveScouts = units.filter(u => u._cinematic && u._cinRole === 'scout' && u.hp > 0);
            const commander = aliveScouts.find(u => u._cinLane === 1) || aliveScouts[0] || null;
            if (commander) {
                commander._cinRole = 'commander';
                commander.target = null;
                commander.isAttacking = false;
                commander._isActuallyWalking = true;
            }
            cinematic.phase = 'commanderFlee';
            cinematic.timer = 0;
            cinematic.bubble = commander
                ? 'Komutan: Geri çekilin! Okçular, destek!'
                : 'Hatlar dağılıyor!';
            cinematic.bubbleTimer = 150;
        }
    }
    // ===== FAZ: KOMUTAN KAÇIYOR =====
    else if (cinematic.phase === 'commanderFlee') {
        const commander = units.find(u => u._cinematic && u._cinRole === 'commander' && u.hp > 0);
        const remaining = units.filter(u => u._cinematic && (u._cinRole === 'scout' || u._cinRole === 'archer') && u.hp > 0);
        const foesNow = units.filter(u => u._cinematic && u._cinRole === 'ambusher' && u.hp > 0);

        const focusXs = remaining.map(u => u.x);
        if (commander) focusXs.push(commander.x);
        cinFocusCamera(focusXs, 0.5);

        if (commander) {
            commander.prevX = commander.x;
            commander.x -= 1.5 * SPEED_MULT;
            commander._isActuallyWalking = true;
            commander.isAttacking = false;
        }

        remaining.forEach(u => {
            u.prevX = u.x;
            if (u._spawnWalkIn > 0) {
                u._spawnWalkIn--;
                const speed = 2.0 * SPEED_MULT;
                const dx = u._spawnTargetX - u.x;
                const dy = (u._spawnTargetY || u.y) - u.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 5) {
                    const angle = Math.atan2(dy, dx);
                    u.x += Math.cos(angle) * speed;
                    u.y += Math.sin(angle) * speed;
                } else {
                    u.x = u._spawnTargetX;
                    u.y = u._spawnTargetY || u.y;
                    u._spawnWalkIn = 0;
                }
                u._isActuallyWalking = true;
                u.isAttacking = false;
                return;
            }
            const target = foesNow[0];
            u.target = target || null;
            if (!target) { u._isActuallyWalking = false; return; }
            const reach = u._cinRole === 'archer' ? 220 : 50;
            const dist = Math.hypot(target.x - u.x, target.y - u.y);
            if (dist > reach && u._cinRole !== 'archer') {
                const ang = Math.atan2(target.y - u.y, target.x - u.x);
                u.x += Math.cos(ang) * 1.4 * SPEED_MULT;
                u._isActuallyWalking = true;
                u.isAttacking = false;
            } else {
                u._isActuallyWalking = false;
                u.isAttacking = true;
            }
        });

        if (cinematic.timer === 40) {
            cinematic.bubble = 'Okçular! Onu koruyun!';
            cinematic.bubbleTimer = 130;
        }

        if (cinematic.timer === 90 && !cinematic.supportArcherSpawned) {
            cinematic.supportArcherSpawned = true;
            const anchorX = commander ? commander.x : (player.base.x + 150);
            for (let i = 0; i < 3; i++) {
                spawnCinArcher(anchorX - 20 - i * 30, player.base.y + (i - 1) * 30, 30 + i, 70);
            }
            cinematic.bubble = 'Takviye okçular arkadan geliyor!';
            cinematic.bubbleTimer = 130;
        }

        if (cinematic.timer > 160) {
            cinematic.phase = 'archerDuel';
            cinematic.timer = 0;
            cinematic.bubble = 'Nişan alın… ateş!';
            cinematic.bubbleTimer = 140;
        }
    }
    // ===== FAZ: OKÇU DÜELLOSU =====
    else if (cinematic.phase === 'archerDuel') {
        const archersNow = units.filter(u => u._cinematic && u._cinRole === 'archer' && u.hp > 0);
        const foesNow = units.filter(u => u._cinematic && u._cinRole === 'ambusher' && u.hp > 0);
        cinFocusCamera(archersNow.map(u => u.x).concat(foesNow.map(u => u.x)), 0.42);

        if (cinematic.timer === 10 && !cinematic.duelReinforced) {
            cinematic.duelReinforced = true;
            const anchor = foesNow[0] ? foesNow[0].x : (walkStop + 250);
            [
                { x: anchor + 40, y: player.base.y - 60 },
                { x: anchor + 70, y: player.base.y + 10 },
                { x: anchor + 50, y: player.base.y + 65 },
                { x: anchor + 90, y: player.base.y - 15 },
            ].forEach((sp, i) => spawnAmbusherAt(sp.x, sp.y, 40 + i));
            cinematic.bubble = 'Takviye orakçılar geldi!';
            cinematic.bubbleTimer = 120;
        }

        archersNow.forEach((u, idx) => {
            if (u._spawnWalkIn > 0) {
                u._spawnWalkIn--;
                const speed = 2.0 * SPEED_MULT;
                const dx = u._spawnTargetX - u.x;
                const dy = (u._spawnTargetY || u.y) - u.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 5) {
                    const angle = Math.atan2(dy, dx);
                    u.x += Math.cos(angle) * speed;
                    u.y += Math.sin(angle) * speed;
                } else {
                    u.x = u._spawnTargetX;
                    u.y = u._spawnTargetY || u.y;
                    u._spawnWalkIn = 0;
                }
                u._isActuallyWalking = true;
                u.isAttacking = false;
                return;
            }
            u._isActuallyWalking = false;
            const target = foesNow[idx % Math.max(1, foesNow.length)] || foesNow[0];
            u.target = target || null;
            if (!target) return;
            u.attackTimer = (u.attackTimer || 0) + 1;
            if (u.attackTimer === 40) {
                target.hp -= 9;
                if (typeof addFloatingText === 'function')
                    addFloatingText(target.x, target.y - 20, '-9', '#3498db');
                if (typeof projectiles !== 'undefined' && typeof Arrow !== 'undefined') {
                    try { projectiles.push(new Arrow(u.x, u.y - 20, target, true)); } catch (_) {}
                }
            }
            if (u.attackTimer >= 70) u.attackTimer = 0;
        });

        foesNow.forEach((f, idx) => {
            if (f._spawnWalkIn > 0) {
                f._spawnWalkIn--;
                const speed = 2.0 * SPEED_MULT;
                const dx = f._spawnTargetX - f.x;
                const dy = (f._spawnTargetY || f.y) - f.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 5) {
                    const angle = Math.atan2(dy, dx);
                    f.x += Math.cos(angle) * speed;
                    f.y += Math.sin(angle) * speed;
                } else {
                    f.x = f._spawnTargetX;
                    f.y = f._spawnTargetY || f.y;
                    f._spawnWalkIn = 0;
                }
                f._isActuallyWalking = true;
                f.isAttacking = false;
                return;
            }
            const target = archersNow[idx % Math.max(1, archersNow.length)] || archersNow[0];
            f.target = target || null;
            if (!target) return;
            const dist = Math.hypot(target.x - f.x, target.y - f.y);
            if (dist > 60) {
                const ang = Math.atan2(target.y - f.y, target.x - f.x);
                f.x += Math.cos(ang) * 1.3 * SPEED_MULT;
                f.y += Math.sin(ang) * 1.0 * SPEED_MULT;
                f._isActuallyWalking = true;
                f.isAttacking = false;
            } else {
                f._isActuallyWalking = false;
                f.isAttacking = true;
                f.attackTimer = (f.attackTimer || 0) + 1;
                if (f.attackTimer === 18) {
                    target.hp -= f.damage || 15;
                    if (typeof addFloatingText === 'function')
                        addFloatingText(target.x, target.y - 20, '-' + (f.damage || 15), '#c0392b');
                }
                if (f.attackTimer >= 48) f.attackTimer = 0;
            }
        });

        if (cinematic.timer === 150) { cinematic.bubble = 'Dayanın, çok kalabalıklar!'; cinematic.bubbleTimer = 120; }
        if (cinematic.timer === 350) { cinematic.bubble = 'Oklar bitmek üzere!'; cinematic.bubbleTimer = 120; }
        if (cinematic.timer === 550) { cinematic.bubble = 'Dayanın, az kaldı!'; cinematic.bubbleTimer = 120; }
        if (cinematic.timer === 750) { cinematic.bubble = 'Son nefes… çekilin!'; cinematic.bubbleTimer = 120; }

        if (cinematic.timer >= 900 || archersNow.length === 0) {
            const survivors = units
                .filter(u => u._cinematic && u._cinRole === 'archer' && u.hp > 0)
                .sort((a, b) => b.hp - a.hp);
            const survivor = survivors[0] || null;

            units.forEach(u => {
                if (u._cinematic && (u._cinRole === 'archer' || u._cinRole === 'ambusher' || u._cinRole === 'commander') && u !== survivor) {
                    u.hp = 0;
                }
            });

            if (survivor) {
                survivor._cinRole = 'survivorArcher';
                survivor.target = null;
                survivor.isAttacking = false;
                survivor._spawnWalkIn = 0;
                survivor.hp = Math.max(1, (survivor.maxHp || 80) - 10);
                cinematic.survivorArcher = survivor;
                cinematic.bubble = 'Bir okçu hayatta kaldı — heykele koşuyor!';
            } else {
                cinematic.bubble = 'Okçular… düştü.';
            }
            cinematic.bubbleTimer = 150;
            cinematic.phase = 'escape';
            cinematic.timer = 0;
        }
    }
    // ===== FAZ: KAÇIŞ =====
    else if (cinematic.phase === 'escape') {
        const survivor = (cinematic.survivorArcher && cinematic.survivorArcher.hp > 0) ? cinematic.survivorArcher : null;
        const homeStopX = player.base.x + 60;

        if (survivor) {
            survivor.prevX = survivor.x;
            if (survivor.x > homeStopX) {
                survivor.x -= 2.0 * SPEED_MULT;
                survivor._isActuallyWalking = true;
            } else {
                survivor.x = homeStopX;
                survivor._isActuallyWalking = false;
            }
            survivor.isAttacking = false;
            cinFocusCamera([survivor.x], 0.35);

            if (cinematic.timer % 6 === 0) {
                spawnBloodDrop(survivor.x - 8, survivor.y + 16);
            }
        }

        if (cinematic.timer === 30) {
            cinematic.bubble = 'Okçu: Heykele ulaşmalıyım!';
            cinematic.bubbleTimer = 130;
        }
        if (cinematic.timer === 150) {
            cinematic.bubble = 'Az kaldı… dayan!';
            cinematic.bubbleTimer = 110;
        }

        if (cinematic.timer >= 300) {
            cinematic.phase = 'aftermath';
            cinematic.timer = 0;
        }
    }
    // ===== FAZ: SONRASI =====
    else if (cinematic.phase === 'aftermath') {
        const home = player.base.x - 40;
        cameraX += ((home - canvas.width * 0.25) - cameraX) * 0.045;
        clampCameraToWorld();

        if (cinematic.timer === 60) {
            cinematic.bubble = 'Heykeli savunun!';
            cinematic.bubbleTimer = 140;
        }
        if (cinematic.timer > 200) {
            endLevel3Cinematic();
        }
    }

    units.forEach(u => { if (u.hp < 0) u.hp = 0; });
    units = units.filter(u => u._cinRole === 'survivorArcher' ? true : u.hp > 0);
    clampCameraToWorld();
}

function drawCinematicBubble(ctx) {
    if (!cinematic.active || !cinematic.bubble || cinematic.bubbleTimer <= 0) return;
    const scouts = units.filter(u => u._cinematic && u._cinRole === 'scout' && u.hp > 0);
    const any = units.filter(u => u._cinematic && u.hp > 0);
    const anchor = scouts[1] || scouts[0] || any[0];
    if (!anchor) return;
    const text = cinematic.bubble;
    ctx.save();
    ctx.font = 'bold 15px Arial';
    const tw = ctx.measureText(text).width;
    const bx = anchor.x;
    const by = anchor.y - 88;
    const pad = 12;
    const bw = tw + pad * 2;
    const bh = 30;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.strokeStyle = text === 'BU BİR PUSU!' ? '#c0392b' : '#2c3e50';
    ctx.lineWidth = 2.5;
    const rx = bx - bw / 2, ry = by - bh;
    ctx.beginPath();
    ctx.moveTo(rx + 8, ry);
    ctx.arcTo(rx + bw, ry, rx + bw, ry + bh, 8);
    ctx.arcTo(rx + bw, ry + bh, rx, ry + bh, 8);
    ctx.arcTo(rx, ry + bh, rx, ry, 8);
    ctx.arcTo(rx, ry, rx + bw, ry, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 6, by);
    ctx.lineTo(bx, by + 10);
    ctx.lineTo(bx + 6, by);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = text === 'BU BİR PUSU!' ? '#c0392b' : '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, bx, by - bh / 2);
    ctx.restore();
}

// ==================== OYUN DÖNGÜSÜ ====================
function resetLevel() {
    if (typeof coopVictoryHandled !== 'undefined') coopVictoryHandled = false;

    units.forEach(u => { if (u instanceof Miner) u.releaseSlot(); });
    units = [];
    projectiles = [];
    floatingTexts = [];
    retreatArchers = [];
    miningSparks = [];

    player.gold = 300;
    player.base.hp = 1000;
    player.base.maxHp = 1000;
    setPlayerCommand(CMD_DEFEND);
    player.minerCooldown = 0;
    player.clubCooldown = 0;
    player.archerCooldown = 0;
    player.minerQueue = []; player.minerTimer = 0; player.minerTimerMax = 0;
    player.combatQueue = []; player.combatTimer = 0; player.combatTimerMax = 0;
    player2.gold = 300;
    player2.command = CMD_DEFEND;
    player2.lastCommand = CMD_DEFEND;
    player2.retreatGraceTimer = 0;
    player2.minerQueue = []; player2.minerTimer = 0; player2.minerTimerMax = 0;
    player2.combatQueue = []; player2.combatTimer = 0; player2.combatTimerMax = 0;
    player2.clubFormationCounter = 0;
    player2.archerFormationCounter = 0;
    player.clubFormationCounter = 0;
    player.archerFormationCounter = 0;
    player.lastCommand = CMD_DEFEND;
    player.retreatGraceTimer = 0;

    enemy.gold = 300;
    enemy.command = CMD_DEFEND;
    enemy.aiTimer = 0;
    enemy.aiState = 'defend';
    enemy.lastCommand = CMD_DEFEND;
    enemy.retreatGraceTimer = 0;
    enemy.retreatTimer = 0;
    enemy.regroupTimer = 0;
    enemy.attackLossCount = 0;
    enemy.lastAttackUnits = 0;
    enemy.clubFormationCounter = 0;
    enemy.archerFormationCounter = 0;
    enemy.minerCooldown = 0;
    enemy.clubCooldown = 0;
    enemy.archerCooldown = 0;
    enemy.retreatGoldSaved = 0;
    enemy.recoveryUnitsPurchased = 0;
    enemy.retreatCooldown = 0;

    if (typeof initMines === 'function') initMines();

    if (level === 1) enemy.base.maxHp = 280;
    else if (level === 2) enemy.base.maxHp = 900;
    else if (level === 3) enemy.base.maxHp = 99999;

    enemy.base.hp = enemy.base.maxHp;
    frames = 0;
    ambushTimer = 0;
    enemy.ambushWaves = null;
    enemy.ambushWaveIndex = 0;
    cameraX = 0;
    if (level === 3 && typeof startLevel3Cinematic === 'function') {
        startLevel3Cinematic();
    } else {
        cinematic = { active: false, phase: '', timer: 0 };
        setGameplayUIVisible(true);
    }
}

function updateAI() {
    enemy.aiTimer++;
    const diff = getAiDifficulty();

    // 3. bölüm pusu dalgaları
    if (typeof isAmbushLevel === 'function' && isAmbushLevel()) {
        enemy.command = CMD_ATTACK;
        enemy.aiState = 'attack';
        if (!enemy.ambushWaves) {
            enemy.ambushWaves = [
                { at: 0, count: 1 },   // hemen başla
                { at: 25, count: 2 },
                { at: 50, count: 2 },
                { at: 80, count: 3 },
                { at: 110, count: 3 },
                { at: 140, count: 3 },
            ];
            enemy.ambushWaveIndex = 0;
        }
        const sec = Math.floor((ambushTimer || 0) / 60);
        while (enemy.ambushWaveIndex < enemy.ambushWaves.length) {
            const w = enemy.ambushWaves[enemy.ambushWaveIndex];
            if (sec < w.at) break;
            for (let i = 0; i < w.count; i++) {
                units.push(new Sicklewrath(false));
            }
            enemy.ambushWaveIndex++;
            if (typeof addFloatingText === 'function') {
                addFloatingText(enemy.base.x - 40, enemy.base.y - 80, 'Dalga ' + enemy.ambushWaveIndex + '!', '#e74c3c');
            }
        }
        return;
    }

    // Normal AI (1. ve 2. bölüm)
    const passiveGoldInterval = enemy.command === CMD_RETREAT ? 150 : 300;
    if (enemy.retreatCooldown > 0) enemy.retreatCooldown--;

    if (enemy.aiTimer % passiveGoldInterval === 0) {
        const goldAmount = Math.floor(15 * diff.passiveGoldMult);
        if (goldAmount > 0) {
            enemy.gold += Math.floor(goldAmount * coopEnemyGoldMult());
            if (enemy.aiState === 'retreat') enemy.retreatGoldSaved += goldAmount;
        }
    }

    const aiMiners = units.filter(u => !u.isPlayer && u instanceof Miner);
    const aiFighters = units.filter(u => !u.isPlayer && u instanceof Clubman && u.hp > 0);
    const aiArchers = units.filter(u => !u.isPlayer && u instanceof Archer && u.hp > 0);
    const aiCombatUnits = aiFighters.concat(aiArchers);
    const visiblePlayerFighters = units.filter(u => {
        if (!(u.isPlayer && (u instanceof Clubman || u instanceof Archer) && u.hp > 0)) return false;
        if (Math.abs(u.x - enemy.base.x) < AI_VISION_RANGE) return true;
        for (const af of aiCombatUnits) {
            if (Math.hypot(u.x - af.x, u.y - af.y) < 350) return true;
        }
        return false;
    });
    const knownPlayerCount = visiblePlayerFighters.length;

    if (enemy.minerCooldown > 0) enemy.minerCooldown--;
    if (enemy.clubCooldown > 0) enemy.clubCooldown--;
    if (enemy.archerCooldown > 0) enemy.archerCooldown--;

    if (enemy.minerCooldown <= 0 && enemy.gold >= 150 && aiMiners.length < Math.min(diff.maxMiners, MAX_MINERS_PER_TEAM)) {
        if (Math.random() >= diff.mistakeChance) {
            enemy.gold -= 150;
            units.push(new Miner(false));
        }
        enemy.minerCooldown = Math.floor(player.minerMaxCooldown * diff.cooldownMult / (typeof coopEnemySpawnMult === "function" ? coopEnemySpawnMult() : 1));
    }

    if (enemy.clubCooldown <= 0 && enemy.gold >= 125 && aiFighters.length < Math.min(diff.maxClubmen, MAX_CLUBMEN_PER_TEAM)) {
        if (Math.random() >= diff.mistakeChance) {
            enemy.gold -= 125;
            units.push(new Clubman(false));
            if (enemy.aiState === 'retreat') enemy.recoveryUnitsPurchased++;
        }
        enemy.clubCooldown = Math.floor(player.clubMaxCooldown * diff.cooldownMult / (typeof coopEnemySpawnMult === "function" ? coopEnemySpawnMult() : 1));
    }

    if (enemy.archerCooldown <= 0 && enemy.gold >= 140 && aiArchers.length < Math.min(diff.maxArchers || 0, MAX_ARCHERS_PER_TEAM)) {
        if (Math.random() >= diff.mistakeChance) {
            enemy.gold -= 140;
            units.push(new Archer(false));
            if (enemy.aiState === 'retreat') enemy.recoveryUnitsPurchased++;
        }
        enemy.archerCooldown = Math.floor(11 * 60 * diff.cooldownMult / (typeof coopEnemySpawnMult === "function" ? coopEnemySpawnMult() : 1));
    }

    const playerThreatVisible = knownPlayerCount > 0;
    const defenseTarget = 1;
    const armyGoal = Math.max(diff.attackThreshold + 2, knownPlayerCount + 2, 5);

    if (enemy.aiState === 'attack') {
        if (aiCombatUnits.length < enemy.lastAttackUnits) {
            enemy.attackLossCount += enemy.lastAttackUnits - aiCombatUnits.length;
        }
        enemy.lastAttackUnits = aiCombatUnits.length;
    }

    let newState = 'defend';
    let newCommand = CMD_DEFEND;

    if (enemy.aiState === 'retreat') {
        enemy.retreatTimer = Math.max(0, enemy.retreatTimer - 1);
        const recovered = aiCombatUnits.length >= defenseTarget && enemy.retreatGoldSaved >= 30;
        if (enemy.retreatTimer === 0 && recovered) {
            newState = 'defend';
            newCommand = CMD_DEFEND;
            enemy.attackLossCount = 0;
            enemy.lastAttackUnits = aiCombatUnits.length;
            enemy.retreatCooldown = 300;
        } else {
            newState = 'retreat';
            newCommand = CMD_RETREAT;
        }
    } else {
        const canRetreat = enemy.retreatCooldown <= 0;
        const weakCastle = enemy.base.hp < enemy.base.maxHp * diff.retreatHpThreshold;
        const tookHeavyLosses = enemy.attackLossCount >= 4;
        const shouldRetreat = canRetreat && (
            (aiCombatUnits.length === 0 && playerThreatVisible) || weakCastle || tookHeavyLosses
        );

        if (shouldRetreat) {
            newState = 'retreat';
            newCommand = CMD_RETREAT;
            enemy.retreatTimer = 300;
            enemy.retreatGoldSaved = 0;
            enemy.recoveryUnitsPurchased = 0;
        } else {
            const castleCritical = enemy.base.hp < enemy.base.maxHp * 0.35;
            const hasAdvantage = aiCombatUnits.length >= knownPlayerCount + 1;
            const combatCap = Math.min(diff.maxClubmen, MAX_CLUBMEN_PER_TEAM) + Math.min(diff.maxArchers || 0, MAX_ARCHERS_PER_TEAM);
            const canOutproduce = aiCombatUnits.length < combatCap;

            if (castleCritical && !hasAdvantage) {
                newState = 'defend';
                newCommand = CMD_DEFEND;
            } else {
                const attackCommitFrames = 600;
                const inAttackCommit = enemy.aiState === 'attack'
                    && enemy.aiTimer - (enemy.attackStartTimer || 0) < attackCommitFrames
                    && aiCombatUnits.length >= 1 && !tookHeavyLosses && !castleCritical;

                if (inAttackCommit) {
                    newState = 'attack';
                    newCommand = CMD_ATTACK;
                } else if (playerThreatVisible && knownPlayerCount > 0) {
                    if (aiCombatUnits.length >= knownPlayerCount + 1 || aiCombatUnits.length >= armyGoal) {
                        newState = 'attack';
                        newCommand = CMD_ATTACK;
                    } else {
                        newState = 'defend';
                        newCommand = CMD_DEFEND;
                    }
                } else {
                    if (aiCombatUnits.length >= armyGoal) {
                        newState = 'attack';
                        newCommand = CMD_ATTACK;
                    } else {
                        newState = 'defend';
                        newCommand = CMD_DEFEND;
                    }
                }

                if (newState === 'attack' && enemy.aiState !== 'attack') {
                    enemy.attackLossCount = 0;
                    enemy.lastAttackUnits = aiCombatUnits.length;
                    enemy.attackStartTimer = enemy.aiTimer;
                }
            }
        }
    }

    enemy.aiState = newState;
    enemy.command = newCommand;
}

function updateArchers() {
    const ensurePlayerArchers = (ownerIndex, baseOffsetX) => {
        const st = getOwnerState(ownerIndex);
        const retreating = st.command === CMD_RETREAT;
        const mine = () => retreatArchers.filter(a => a.isPlayer && (a.ownerIndex || 0) === ownerIndex);
        if (retreating && mine().length === 0) {
            retreatArchers.push(
                new BaseArcherUnit(true, baseOffsetX - 15, -15, 1.2, ownerIndex),
                new BaseArcherUnit(true, baseOffsetX + 15, 15, 1.2, ownerIndex)
            );
        }
        if (!retreating) {
            retreatArchers = retreatArchers.filter(a => !(a.isPlayer && (a.ownerIndex || 0) === ownerIndex));
        }
    };
    ensurePlayerArchers(0, -25);
    if (typeof isCoopActive === 'function' && isCoopActive()) {
        ensurePlayerArchers(1, 28);
    }
    {
        const isRetreating = enemy.command === CMD_RETREAT;
        const enemyArchers = retreatArchers.filter(a => !a.isPlayer);
        if (isRetreating && enemyArchers.length === 0) {
            retreatArchers.push(
                new BaseArcherUnit(false, -25, -15, 1.2, 0),
                new BaseArcherUnit(false, 25, 15, 1.2, 0)
            );
        }
        if (!isRetreating) {
            retreatArchers = retreatArchers.filter(a => a.isPlayer);
        }
    }
    retreatArchers.forEach(archer => archer.update());
}

function handleFormationAndCollisions() {
    ['player', 'enemy'].forEach(team => {
        let isPlayer = (team === 'player');
        let fighters = units.filter(u => u.isPlayer === isPlayer && (u instanceof Clubman || (typeof Sicklewrath !== 'undefined' && u instanceof Sicklewrath)) && u.hp > 0);

        fighters.sort((a, b) => a.formationIndex - b.formationIndex);

        fighters.forEach((u, index) => {
            let cmd = u.isPlayer ? unitOwnerState(u).command : enemy.command;
            if (cmd === CMD_DEFEND) {
                let row = index % 5;
                let col = Math.floor(index / 5);
                let baseX = isPlayer ? player.base.x + 320 : enemy.base.x - 320;
                let direction = isPlayer ? 1 : -1;
                u.targetX = baseX + (col * 70 * direction);
                u.targetY = (canvas.height - GROUND_HEIGHT + 25) + (row * 35);
            }
        });

        for (let i = 0; i < fighters.length; i++) {
            for (let j = i + 1; j < fighters.length; j++) {
                let u1 = fighters[i];
                let u2 = fighters[j];
                let dx = u1.x - u2.x;
                let dy = u1.y - u2.y;
                let dist = Math.hypot(dx, dy);
                let minDist = 28;
                if (dist < minDist && dist > 0.01) {
                    let push = (minDist - dist) * 0.08;
                    let nx = dx / dist;
                    let ny = dy / dist;
                    u1.x += nx * push;
                    u1.y += ny * push;
                    u2.x -= nx * push;
                    u2.y -= ny * push;
                }
            }
        }

        let archers = units.filter(u => u.isPlayer === isPlayer && u instanceof Archer && u.hp > 0);
        for (let i = 0; i < archers.length; i++) {
            for (let j = i + 1; j < archers.length; j++) {
                let u1 = archers[i];
                let u2 = archers[j];
                let dx = u1.x - u2.x;
                let dy = u1.y - u2.y;
                let dist = Math.hypot(dx, dy);
                let minDist = 24;
                if (dist < minDist && dist > 0.01) {
                    let push = (minDist - dist) * 0.08;
                    let nx = dx / dist;
                    let ny = dy / dist;
                    u1.x += nx * push;
                    u1.y += ny * push;
                    u2.x -= nx * push;
                    u2.y -= ny * push;
                }
            }
        }
    });
}

function getUnitType(u) {
    if (u instanceof Miner) return 'miner';
    if (u instanceof Clubman) return 'clubman';
    if (typeof Sicklewrath !== 'undefined' && u instanceof Sicklewrath) return 'sickle';
    if (u instanceof Archer) return 'archer';
    return 'other';
}

function setCircularCooldown(el, remaining, max) {
    if (!el) return;
    if (remaining > 0 && max > 0) {
        const pct = Math.max(0, Math.min(100, (remaining / max) * 100));
        el.style.setProperty('--cd-deg', (pct * 3.6) + 'deg');
        el.classList.add('active');
    } else {
        el.style.setProperty('--cd-deg', '0deg');
        el.classList.remove('active');
    }
}

function updateActionButtonsUI() {
    const oi = localOwnerIndex();
    const st = getOwnerState(oi);
    ensureQueues(st);

    setCircularCooldown(minerCdFill, st.minerQueue.length ? st.minerTimer : 0, st.minerTimerMax || 1);
    const combatHead = st.combatQueue[0];
    setCircularCooldown(clubCdFill, combatHead === 'club' ? st.combatTimer : 0, combatHead === 'club' ? (st.combatTimerMax || 1) : 1);
    setCircularCooldown(archerCdFill, combatHead === 'archer' ? st.combatTimer : 0, combatHead === 'archer' ? (st.combatTimerMax || 1) : 1);

    if (window.CHEAT_INF && st.gold < 999999) st.gold = 999999;
    goldEl.innerText = Math.floor(st.gold);
    if (typeof isAmbushLevel === 'function' && isAmbushLevel()) {
        const left = Math.max(0, (AMBUSH_DURATION_FRAMES || 10800) - (ambushTimer || 0));
        const sec = Math.ceil(left / 60);
        const mm = Math.floor(sec / 60);
        const ss = String(sec % 60).padStart(2, '0');
        levelEl.innerText = 'Pusu ' + mm + ':' + ss;
    } else {
        levelEl.innerText = Math.min(level, 3) + "/3";
    }
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
        const slot = typeof myCoopSlot === 'function' ? myCoopSlot() : 0;
        goldEl.parentElement && (goldEl.parentElement.title = slot === 1 ? 'Senin altının (Oyuncu 2)' : 'Senin altının (Oyuncu 1)');
    }

    function setBadge(id, n) {
        const el = document.getElementById(id);
        if (!el) return;
        if (n > 0) { el.textContent = String(n); el.classList.remove('hidden'); }
        else { el.classList.add('hidden'); }
    }
    setBadge('minerQBadge', st.minerQueue.length);
    setBadge('clubQBadge', st.combatQueue.filter(x => x === 'club').length);
    setBadge('archerQBadge', st.combatQueue.filter(x => x === 'archer').length);

    const qAll = (typ) => countQueuedFor(0, typ) + countQueuedFor(1, typ);
    btnMiner.disabled = st.gold < 150 || st.minerQueue.length >= MAX_QUEUE ||
        (countPlayerUnits('miner') + qAll('miner') >= MAX_MINERS_PER_TEAM);
    btnClub.disabled = st.gold < 125 || st.combatQueue.length >= MAX_QUEUE ||
        (countPlayerUnits('club') + qAll('club') >= MAX_CLUBMEN_PER_TEAM);

    if (level >= 3) {
        btnArcher.style.display = '';
        btnArcher.disabled = st.gold < 140 || st.combatQueue.length >= MAX_QUEUE ||
            (countPlayerUnits('archer') + qAll('archer') >= MAX_ARCHERS_PER_TEAM);
    } else {
        btnArcher.style.display = 'none';
    }

    Object.values(cmdBtns).forEach(b => b.classList.remove('active'));
    if (cmdBtns[st.command]) cmdBtns[st.command].classList.add('active');
}

function update() {
    if (isCinematicActive()) {
        updateCinematic();
        return;
    }
    frames++;

    if (isCoopHostNow()) {
        broadcastHostState();
    }

    if (frames % (player.command === CMD_RETREAT ? 150 : 300) === 0) {
        const g1 = Math.max(1, Math.floor(15 * (typeof coopGoldMult === 'function' ? coopGoldMult() : 1)));
        player.gold += g1;
        addFloatingText(player.base.x, player.base.y - 120, '+' + g1, '#f1c40f');
    }
    if (typeof isCoopActive === 'function' && isCoopActive() && frames % (player2.command === CMD_RETREAT ? 150 : 300) === 0) {
        const g2 = Math.max(1, Math.floor(15 * coopGoldMult()));
        player2.gold += g2;
    }

    [player, enemy].forEach(team => {
        if (team.command !== CMD_RETREAT && team.lastCommand === CMD_RETREAT) {
            team.retreatGraceTimer = 180;
        }
        if (team.retreatGraceTimer > 0) team.retreatGraceTimer--;
        team.lastCommand = team.command;
    });

    units.forEach(u => {
        const team = u.isPlayer ? unitOwnerState(u) : enemy;
        u.isInvulnerable = team.command === CMD_RETREAT || (team.retreatGraceTimer > 0);
    });

    updateAI();
    updateArchers();

    handleFormationAndCollisions();
    units.forEach(u => {
        try { u.update(); } catch (err) { console.error('Unit update hatası', err); }
    });
    projectiles.forEach(p => p.update());

    units.forEach(u => {
        if (u.hp <= 0 && u instanceof Miner && typeof u.releaseSlot === 'function') {
            u.releaseSlot();
        }
    });
    units = units.filter(u => u.hp > 0);
    projectiles = projectiles.filter(p => p.active);

    if (enemy.base.hp < 0) enemy.base.hp = 0;
    if (player.base.hp < 0) player.base.hp = 0;

    if (typeof isAmbushLevel === 'function' && isAmbushLevel() && !isGameOver) {
        ambushTimer++;
        if (ambushTimer >= AMBUSH_DURATION_FRAMES) {
            isGameOver = true;
            coopVictoryHandled = true;
            const completedLevel = level;
            if (typeof onLevelVictory === 'function') onLevelVictory(completedLevel);
            level++;
            modalTitle.innerText = 'Güneş battı! Pusu savuşturuldu!';
            modalBtn.innerText = level > 3 ? 'Sefer Haritasına Dön' : 'Sonraki Bölüm';
            modal.classList.remove('hidden');
        }
    }

    if (!(typeof isAmbushLevel === 'function' && isAmbushLevel()) && enemy.base.hp <= 0 && !isGameOver) {
        enemy.base.hp = 0;
        isGameOver = true;
        coopVictoryHandled = true;
        const completedLevel = level;
        if (isCoopHostNow()) {
            wsSend({
                type: 'room_relay',
                roomId: coopSession.roomId,
                payload: { kind: 'victory', level: completedLevel }
            });
        }
        if (typeof onLevelVictory === 'function') onLevelVictory(completedLevel);
        level++;
        if (level > 3) {
            modalTitle.innerText = "Tebrikler! Seferi Bitirdiniz!";
            modalBtn.innerText = "Sefer Haritasına Dön";
        } else {
            modalTitle.innerText = (level - 1) + ". Bölüm Tamamlandı!";
            modalBtn.innerText = "Sonraki Bölüm";
        }
        modal.classList.remove('hidden');
    } else if (player.base.hp <= 0) {
        isGameOver = true;
        modalTitle.innerText = "Kaybettiniz! Heykeliniz Yıkıldı.";
        modalBtn.innerText = "Tekrar Dene";
        modal.classList.remove('hidden');
    }

    processSpawnQueue();
    updateActionButtonsUI();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cameraX, 0);

    drawEnvironment(ctx);
    drawBase(ctx, true);
    drawBase(ctx, false);
    drawMines(ctx);

    retreatArchers.forEach(archer => archer.draw(ctx));

    units.sort((a, b) => a.y - b.y);
    if (typeof drawCinFog === 'function') drawCinFog(ctx);
    if (typeof drawCinBlood === 'function') drawCinBlood(ctx);
    units.forEach(u => u.draw(ctx));
    if (typeof drawCinematicBubble === 'function') drawCinematicBubble(ctx);

    projectiles.forEach(p => p.draw(ctx));
    drawMiningSparks(ctx);

    floatingTexts.forEach(ft => {
        ctx.fillStyle = ft.color;
        ctx.font = ft.isBig ? "bold 26px Arial" : "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
    });
    ctx.restore();
}

function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        const ft = floatingTexts[i];
        ft.y -= 1.2;
        ft.life--;
        if (ft.life <= 0) floatingTexts.splice(i, 1);
    }
}

function startGameLoop() {
    if (typeof setMusicMode === 'function') setMusicMode('battle');
    if (animationFrameId !== null) return;
    lastFrameTime = 0;
    accumulatedTime = 0;
    animationFrameId = requestAnimationFrame(loop);
}

function loop(timestamp) {
    animationFrameId = null;
    if (isGameOver) return;

    if (!lastFrameTime) lastFrameTime = timestamp;
    accumulatedTime += Math.min(100, timestamp - lastFrameTime);
    lastFrameTime = timestamp;
    while (accumulatedTime >= FIXED_TIMESTEP && !isGameOver) {
        update();
        updateFloatingTexts();
        updateMiningSparks();
        accumulatedTime -= FIXED_TIMESTEP;
    }
    draw();
    if (!isGameOver) animationFrameId = requestAnimationFrame(loop);
}
