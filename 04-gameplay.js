function setPlayerCommand(cmd) {
    const oi = localOwnerIndex();
    getOwnerState(oi).command = cmd;
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
let cinFog = []; // artık kullanılmıyor (geriye dönük uyumluluk için boş bırakıldı)

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

// ---- Konuşma balonu sistemi (bireysel birimler için) ----
function cinSay(u, text, frames = 90) {
    if (!u) return;
    u._speechText = text;
    u._speechTimer = frames;
}
const CIN_LINES_ALLY_HIT = ['Tutun!', 'Geri çekilme!', 'Kalkanı kaldır!', 'Dayan!'];
const CIN_LINES_ALLY_DEATH = ['Ahh...', 'Beni unutmayın...', 'Kaçının...'];
const CIN_LINES_FOE_HIT = ['Argh!', 'İmkansız...', 'Geri püskürtün beni!'];
const CIN_LINES_FOE_DEATH = ['Hkh...', 'Bu daha bitmedi...', 'Orkkh...'];

function cinMaybeSpeak(u, lines, chance = 0.3) {
    if (u && Math.random() < chance) {
        cinSay(u, lines[(Math.random() * lines.length) | 0], 80);
    }
}

// ---- Sıralı (turn-based) melee dövüş yardımcı fonksiyonu ----
// Aynı hedefe birden fazla saldırgan yapışmışsa, sırayla tek tek vururlar.
function resolveTurnBasedMelee(attackers, targetOf, hitFn, cycleLen) {
    const groups = new Map();
    attackers.forEach(u => {
        const foe = targetOf(u);
        if (!foe || foe.hp <= 0) { u.isAttacking = false; return; }
        if (!groups.has(foe)) groups.set(foe, []);
        groups.get(foe).push(u);
    });

    groups.forEach((group, foe) => {
        if (group.length === 1) {
            const u = group[0];
            u.isAttacking = true;
            u.attackTimer = (u.attackTimer || 0) + 1;
            if (u.attackTimer === Math.round(cycleLen * 0.4)) hitFn(u, foe);
            if (u.attackTimer >= cycleLen) u.attackTimer = 0;
            return;
        }
        if (foe._turnQueueUnit === undefined || !group.includes(foe._turnQueueUnit) || foe._turnQueueUnit.hp <= 0) {
            foe._turnQueueUnit = group[0];
        }
        group.forEach((u) => {
            const isMyTurn = (u === foe._turnQueueUnit);
            if (!isMyTurn) {
                u.isAttacking = false;
                u.attackTimer = 0;
                return;
            }
            u.isAttacking = true;
            u.attackTimer = (u.attackTimer || 0) + 1;
            if (u.attackTimer === Math.round(cycleLen * 0.4)) hitFn(u, foe);
            if (u.attackTimer >= cycleLen) {
                u.attackTimer = 0;
                u.isAttacking = false;
                const idx = group.indexOf(u);
                const nextIdx = (idx + 1) % group.length;
                foe._turnQueueUnit = group[nextIdx];
            }
        });
    });
}

function startLevel3Cinematic() {
    cinFog = [];
    // Harita 3x uzatılıyor — orakçılar/okçular gerçekten "arkadan" (kazık
    // bölgesinden) yürüyerek gelsin diye.
    worldWidth = Math.max(MIN_WORLD_WIDTH, canvas.width + 800) * 3;
    cameraX = Math.max(0, Math.min(cameraX, worldWidth - canvas.width));
    if (typeof updateMineSlots === 'function') updateMineSlots(false);

    const spikeXVal = worldWidth - 150;

    cinematic = {
        active: true,
        phase: 'walk',
        timer: 0,
        bubble: null,
        bubbleTimer: 0,
        spikeX: spikeXVal,
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
        reinforceCalled: false,
        commanderFleeStarted: false,
        supportArcherSpawned: false,
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

function cinFocusCamera(xs, bias) {
    if (!xs || !xs.length) return;
    const avgX = xs.reduce((s, v) => s + v, 0) / xs.length;
    const targetCam = avgX - canvas.width * (bias != null ? bias : 0.42);
    cameraX += (targetCam - cameraX) * 0.055;
    clampCameraToWorld();
}

// Orakçı/okçu artık sisten değil, kazık bölgesinden (spikeX) yürüyerek
// gelir. Spawn anında x konumu spikeX civarında, _isActuallyWalking=true.
function spawnAmbusherAt(spawnX, y, lane) {
    const s = new Sicklewrath(false);
    s.x = Math.min(spawnX, worldWidth - 60);
    s.y = y;
    s.hp = s.maxHp = 75;
    s._cinematic = true;
    s._cinRole = 'ambusher';
    s._cinLane = lane;
    s._isActuallyWalking = true;
    units.push(s);
    return s;
}
function updateCinematic() {
    if (!cinematic.active) return;
    cinematic.timer++;
    frames++;

    let scouts = units.filter(u => u._cinematic && u._cinRole === 'scout' && u.hp > 0);
    let foes = units.filter(u => u._cinematic && u._cinRole === 'ambusher' && u.hp > 0);
    let archers = units.filter(u => u._cinematic && u._cinRole === 'archer' && u.hp > 0);

    // Konuşma balonu sayaçları (bireysel birimler)
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
    if (cinematic.bubbleTimer <= 0 && cinematic.phase !== 'ambush' && cinematic.phase !== 'fight' && cinematic.phase !== 'notice') {
        cinematic.bubble = null;
    }

    const spikeX = cinematic.spikeX || (worldWidth - 150);
    const walkStop = Math.min(spikeX - 60, worldWidth - canvas.width * 0.55);

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
                cinematic.bubble = 'Durun… bir şey var mı orada?';
                cinematic.bubbleTimer = 150;
                cinematic.ambushSaid = true;
            }
        }
    } else if (cinematic.phase === 'notice') {
        scouts.forEach(u => { u._isActuallyWalking = false; u.isAttacking = false; });
        if (scouts.length) cinFocusCamera(scouts.map(u => u.x), 0.38);
        if (cinematic.timer === 160) {
            cinematic.bubble = 'BU BİR PUSU! Arkamızdan geliyorlar!';
            cinematic.bubbleTimer = 170;
        }
        if (cinematic.timer > 340) {
            cinematic.phase = 'ambush';
            cinematic.timer = 0;
        }
    } else if (cinematic.phase === 'ambush') {
        if (scouts.length) cinFocusCamera(scouts.map(u => u.x), 0.4);
        scouts.forEach(u => { u._isActuallyWalking = false; });
        if (cinematic.timer === 15 && !cinematic.fightStarted) {
            // Orakçılar artık sisten değil, kazık bölgesinden (spikeX)
            // yürüyerek geliyor.
            const lanes = [-55, 8, 55, -28, 38];
            lanes.forEach((off, i) => spawnAmbusherAt(spikeX, player.base.y + off, i));
            cinematic.fightStarted = true;
            cinematic.bubble = 'Arkadan çıktılar!';
            cinematic.bubbleTimer = 130;
            if (scouts[0]) cinSay(scouts[0], 'Arkamızdalar!', 90);
        }
        if (cinematic.timer > 100) {
            cinematic.phase = 'fight';
            cinematic.timer = 0;
        }
    } else if (cinematic.phase === 'fight') {
        scouts = units.filter(u => u._cinematic && u._cinRole === 'scout' && u.hp > 0);
        foes = units.filter(u => u._cinematic && u._cinRole === 'ambusher' && u.hp > 0);
        archers = units.filter(u => u._cinematic && u._cinRole === 'archer' && u.hp > 0);
        const allAlive = units.filter(u => u._cinematic && u.hp > 0);
        if (allAlive.length) cinFocusCamera(allAlive.map(u => u.x), 0.44);

        // Dalga 2 — arkadan (kazık bölgesinden) yürüyerek
        if (cinematic.timer === 180 && !cinematic.wave2) {
            cinematic.wave2 = true;
            [-70, -30, 10, 60].forEach((off, i) => spawnAmbusherAt(spikeX, player.base.y + off, 10 + i));
            cinematic.bubble = 'Arkadan hâlâ geliyorlar!';
            cinematic.bubbleTimer = 130;
        }

        // Okçular savunmaya — ışınlanma yok, arkadan yürüyerek gelir
        if (cinematic.timer === 320 && !cinematic.archersSpawned) {
            cinematic.archersSpawned = true;
            for (let i = 0; i < 3; i++) {
                const a = new Archer(true, 0);
                a.x = walkStop - 260 - i * 40;
                a.y = player.base.y + (i - 1) * 30;
                a.hp = a.maxHp = 80;
                a._cinematic = true;
                a._cinRole = 'archer';
                a._cinLane = i;
                a._isActuallyWalking = true;
                units.push(a);
            }
            cinematic.bubble = 'Okçular! Destek gelin!';
            cinematic.bubbleTimer = 130;
        }

        // Sopalı destek çağrısı (bizim ordu)
        if (cinematic.timer === 380 && !cinematic.reinforceCalled) {
            cinematic.reinforceCalled = true;
            for (let i = 0; i < 2; i++) {
                const c = new Clubman(true, 0);
                c.x = walkStop - 300 - i * 30;
                c.y = player.base.y + (i === 0 ? -20 : 20);
                c.hp = c.maxHp = 130;
                c._cinematic = true;
                c._cinRole = 'scout';
                c._cinLane = 10 + i;
                c._isActuallyWalking = true;
                units.push(c);
            }
            cinematic.bubble = 'Sopalılar, hemen hatta!';
            cinematic.bubbleTimer = 130;
        }

        // Dalga 3 — yine kazık bölgesinden, arkadan
        if (cinematic.timer === 450 && !cinematic.wave3) {
            cinematic.wave3 = true;
            [-50, 15, 60, -35, 45].forEach((off, i) => spawnAmbusherAt(spikeX, player.base.y + off, 20 + i));
            cinematic.bubble = 'Her yerdeler…!';
            cinematic.bubbleTimer = 130;
        }

        // Hareket / yaklaşma
        allAlive.forEach(u => {
            u.prevX = u.x;
            u._isActuallyWalking = false;
        });

        const scoutTargetOf = (u) => {
            const lane = u._cinLane || 0;
            if (lane !== 1 && cinematic.timer < 100) return null;
            return foes[lane % Math.max(1, foes.length)] || foes[0] || null;
        };
        const foeTargetOf = (u) => {
            const lane = u._cinLane || 0;
            return scouts[lane % Math.max(1, scouts.length)] || scouts[0] || archers[0] || null;
        };

        scouts.forEach(u => {
            const lane = u._cinLane || 0;
            if (lane !== 1 && cinematic.timer < 100) {
                u.x -= 1.2 * SPEED_MULT;
                u._isActuallyWalking = true;
                u.isAttacking = false;
                if (cinematic.timer === 50 && lane === 0) {
                    cinematic.bubble = 'Geri çekilin!';
                    cinematic.bubbleTimer = 110;
                }
                return;
            }
            const target = scoutTargetOf(u);
            if (!target) return;
            const dist = Math.hypot(target.x - u.x, target.y - u.y);
            if (dist > 46) {
                const ang = Math.atan2(target.y - u.y, target.x - u.x);
                u.x += Math.cos(ang) * 1.7 * SPEED_MULT;
                u.y += Math.sin(ang) * 1.1 * SPEED_MULT;
                u._isActuallyWalking = true;
                u.isAttacking = false;
            }
        });
        foes.forEach(u => {
            const target = foeTargetOf(u);
            if (!target) return;
            const dist = Math.hypot(target.x - u.x, target.y - u.y);
            if (dist > 50) {
                const ang = Math.atan2(target.y - u.y, target.x - u.x);
                u.x += Math.cos(ang) * 1.45 * SPEED_MULT;
                u.y += Math.sin(ang) * 1.05 * SPEED_MULT;
                u._isActuallyWalking = true;
                u.isAttacking = false;
            }
        });

        // Sıralı (turn-based) melee: 2'ye karşı 1 varsa önce 2'nin sırası biter
        resolveTurnBasedMelee(
            scouts.filter(u => { const t = scoutTargetOf(u); return t && Math.hypot(t.x - u.x, t.y - u.y) <= 46; }),
            scoutTargetOf,
            (u, foe) => {
                foe.hp -= u.damage || 12;
                if (typeof addFloatingText === 'function') addFloatingText(foe.x, foe.y - 20, '-' + (u.damage || 12), '#e74c3c');
                cinMaybeSpeak(foe, CIN_LINES_FOE_HIT, 0.3);
                if (foe.hp <= 0) cinMaybeSpeak(foe, CIN_LINES_FOE_DEATH, 0.8);
            },
            90
        );
        resolveTurnBasedMelee(
            foes.filter(u => { const t = foeTargetOf(u); return t && Math.hypot(t.x - u.x, t.y - u.y) <= 50; }),
            foeTargetOf,
            (u, foe) => {
                foe.hp -= u.damage || 15;
                if (typeof addFloatingText === 'function') addFloatingText(foe.x, foe.y - 20, '-' + (u.damage || 15), '#c0392b');
                cinMaybeSpeak(foe, CIN_LINES_ALLY_HIT, 0.3);
                if (foe.hp <= 0) cinMaybeSpeak(foe, CIN_LINES_ALLY_DEATH, 0.9);
            },
            48
        );

        // Okçular ateş eder — arkadan gelip yay çekip GERÇEK ok atıyor (Arrow sınıfı)
        archers.forEach(u => {
            const target = foes[0];
            u.target = target || null;
            if (!target) { u._isActuallyWalking = false; return; }
            const dist = Math.hypot(target.x - u.x, target.y - u.y);
            if (dist > 500) {
                const ang = Math.atan2(target.y - u.y, target.x - u.x);
                u.x += Math.cos(ang) * 1.6 * SPEED_MULT;
                u._isActuallyWalking = true;
                return;
            }
            u._isActuallyWalking = false;
            u.attackTimer = (u.attackTimer || 0) + 1;
            const DRAW_START = 40, SHOOT_AT = 70, CYCLE = 76;
            u.drawAmount = u.attackTimer < DRAW_START ? 0
                : u.attackTimer < SHOOT_AT ? (u.attackTimer - DRAW_START) / (SHOOT_AT - DRAW_START)
                : 0;
            if (u.attackTimer === SHOOT_AT) {
                projectiles.push(new Arrow(u.x, u.y - 30, target, true));
            }
            if (u.attackTimer >= CYCLE) u.attackTimer = 0;
        });

        if (cinematic.timer === 560) {
            cinematic.bubble = 'Çevrildik!';
            cinematic.bubbleTimer = 120;
        }
        if (cinematic.timer === 700) {
            cinematic.bubble = 'Dayanın… sonuna kadar!';
            cinematic.bubbleTimer = 130;
        }

        // Dalga 3'ten kısa süre sonra: komutan heykelden hâlâ uzakken kaçmaya başlar
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
    } else if (cinematic.phase === 'commanderFlee') {
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

        const meleeAttackers = remaining.filter(u => u._cinRole !== 'archer');
        const targetOf = () => foesNow[0] || null;
        meleeAttackers.forEach(u => {
            u.prevX = u.x;
            const target = targetOf();
            if (!target) { u._isActuallyWalking = false; return; }
            const dist = Math.hypot(target.x - u.x, target.y - u.y);
            if (dist > 50) {
                const ang = Math.atan2(target.y - u.y, target.x - u.x);
                u.x += Math.cos(ang) * 1.4 * SPEED_MULT;
                u._isActuallyWalking = true;
            } else {
                u._isActuallyWalking = false;
            }
        });
        resolveTurnBasedMelee(
            meleeAttackers.filter(u => { const t = targetOf(); return t && Math.hypot(t.x - u.x, t.y - u.y) <= 50; }),
            targetOf,
            (u, foe) => {
                foe.hp -= u.damage || 12;
                if (typeof addFloatingText === 'function') addFloatingText(foe.x, foe.y - 20, '-' + (u.damage || 12), '#e74c3c');
                cinMaybeSpeak(foe, CIN_LINES_FOE_HIT, 0.3);
            },
            90
        );
        remaining.filter(u => u._cinRole === 'archer').forEach(u => {
            const target = foesNow[0];
            if (!target) { u._isActuallyWalking = false; return; }
            u._isActuallyWalking = false;
            u.attackTimer = (u.attackTimer || 0) + 1;
            if (u.attackTimer === 45) projectiles.push(new Arrow(u.x, u.y - 30, target, true));
            if (u.attackTimer >= 80) u.attackTimer = 0;
        });

        if (cinematic.timer === 40) {
            cinematic.bubble = 'Okçular! Onu koruyun!';
            cinematic.bubbleTimer = 130;
        }

        if (cinematic.timer === 90 && !cinematic.supportArcherSpawned) {
            cinematic.supportArcherSpawned = true;
            const anchorX = commander ? commander.x : (player.base.x + 150);
            for (let i = 0; i < 2; i++) {
                const a = new Archer(true, 0);
                a.x = anchorX - 200 - i * 40;
                a.y = player.base.y + (i === 0 ? -25 : 25);
                a.hp = a.maxHp = 80;
                a._cinematic = true;
                a._cinRole = 'archer';
                a._cinLane = 20 + i;
                a._isActuallyWalking = true;
                units.push(a);
            }
            cinematic.bubble = 'Takviye okçular geldi!';
            cinematic.bubbleTimer = 130;
        }

        if (cinematic.timer > 160) {
            cinematic.phase = 'archerDuel';
            cinematic.timer = 0;
            cinematic.bubble = 'Nişan alın… ateş!';
            cinematic.bubbleTimer = 140;
        }
    } else if (cinematic.phase === 'archerDuel') {
        const archersNow = units.filter(u => u._cinematic && u._cinRole === 'archer' && u.hp > 0);
        const foesNow = units.filter(u => u._cinematic && u._cinRole === 'ambusher' && u.hp > 0);
        cinFocusCamera(archersNow.map(u => u.x).concat(foesNow.map(u => u.x)), 0.42);

        archersNow.forEach((u, idx) => {
            u._isActuallyWalking = false;
            const target = foesNow[idx % Math.max(1, foesNow.length)] || foesNow[0];
            u.target = target || null;
            if (!target) return;
            u.attackTimer = (u.attackTimer || 0) + 1;
            const DRAW_START = 30, SHOOT_AT = 64, CYCLE = 70;
            u.drawAmount = u.attackTimer < DRAW_START ? 0
                : u.attackTimer < SHOOT_AT ? (u.attackTimer - DRAW_START) / (SHOOT_AT - DRAW_START)
                : 0;
            if (u.attackTimer === SHOOT_AT) {
                projectiles.push(new Arrow(u.x, u.y - 30, target, true));
            }
            if (u.attackTimer >= CYCLE) u.attackTimer = 0;
        });

        const foeTargetOf = (f) => {
            const aliveArchers = units.filter(u => u._cinematic && u._cinRole === 'archer' && u.hp > 0);
            return aliveArchers[(f._cinLane || 0) % Math.max(1, aliveArchers.length)] || aliveArchers[0] || null;
        };
        foesNow.forEach(f => {
            const target = foeTargetOf(f);
            if (!target) return;
            const dist = Math.hypot(target.x - f.x, target.y - f.y);
            if (dist > 60) {
                const ang = Math.atan2(target.y - f.y, target.x - f.x);
                f.x += Math.cos(ang) * 1.3 * SPEED_MULT;
                f.y += Math.sin(ang) * 1.0 * SPEED_MULT;
                f._isActuallyWalking = true;
            } else {
                f._isActuallyWalking = false;
            }
        });
        resolveTurnBasedMelee(
            foesNow.filter(f => { const t = foeTargetOf(f); return t && Math.hypot(t.x - f.x, t.y - f.y) <= 60; }),
            foeTargetOf,
            (f, target) => {
                target.hp -= f.damage || 15;
                if (typeof addFloatingText === 'function') addFloatingText(target.x, target.y - 20, '-' + (f.damage || 15), '#c0392b');
                cinMaybeSpeak(target, CIN_LINES_ALLY_HIT, 0.35);
                if (target.hp <= 0) cinMaybeSpeak(target, CIN_LINES_ALLY_DEATH, 0.9);
            },
            48
        );

        if (cinematic.timer === 200) { cinematic.bubble = 'Oklar bitmek üzere!'; cinematic.bubbleTimer = 120; }
        if (cinematic.timer === 400) { cinematic.bubble = 'Dayanın, az kaldı!'; cinematic.bubbleTimer = 120; }

        // 10 saniye (600 frame) doldu veya bütün okçular düştü
        if (cinematic.timer >= 600 || archersNow.length === 0) {
            const survivors = units
                .filter(u => u._cinematic && u._cinRole === 'archer' && u.hp > 0)
                .sort((a, b) => b.hp - a.hp);
            const survivor = survivors[0] || null;

            units.forEach(u => {
                if (u._cinematic && (u._cinRole === 'archer' || u._cinRole === 'ambusher' || u._cinRole === 'commander') && u !== survivor) {
                    if (u.hp > 0) cinMaybeSpeak(u, u._cinRole === 'ambusher' ? CIN_LINES_FOE_DEATH : CIN_LINES_ALLY_DEATH, 0.6);
                    u.hp = 0;
                }
            });

            if (survivor) {
                survivor._cinRole = 'survivorArcher';
                survivor.target = null;
                survivor.isAttacking = false;
                survivor.hp = Math.max(1, (survivor.maxHp || 80) - 10);
                cinematic.survivorArcher = survivor;
                cinematic.bubble = 'Bir okçu hayatta kaldı — kaçıyor!';
                cinSay(survivor, 'Kaçmalıyım!', 100);
            } else {
                cinematic.bubble = 'Okçular… düştü.';
            }
            cinematic.bubbleTimer = 150;
            cinematic.phase = 'escape';
            cinematic.timer = 0;
        }
    } else if (cinematic.phase === 'escape') {
        // 5 saniye (300 frame @60fps) sürer, kamera kaçan okçuyu sıkı takip eder
        const ESCAPE_DURATION = 300;
        const survivor = (cinematic.survivorArcher && cinematic.survivorArcher.hp > 0) ? cinematic.survivorArcher : null;

        if (survivor) {
            survivor.prevX = survivor.x;
            survivor.x -= 2.0 * SPEED_MULT;
            survivor._isActuallyWalking = true;
            survivor.isAttacking = false;
            cinFocusCamera([survivor.x], 0.22);
        } else {
            cinFocusCamera([player.base.x + 200], 0.3);
        }

        if (cinematic.timer === 1) cinSay(survivor, 'Heykele ulaşmalıyım!', 110);
        if (cinematic.timer === 90) cinSay(survivor, 'Yaklaşıyorum...', 100);
        if (cinematic.timer === 180) cinSay(survivor, 'Neredeyse geldim!', 100);
        if (cinematic.timer === 250) cinSay(survivor, 'Son adımlar...', 80);

        const arrived = survivor && survivor.x <= player.base.x + 120;
        if (arrived || cinematic.timer >= ESCAPE_DURATION) {
            if (survivor) cinSay(survivor, 'Kurtuldum!', 90);
            cinematic.phase = 'aftermath';
            cinematic.timer = 0;
        }
    } else if (cinematic.phase === 'aftermath') {
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
    units = units.filter(u => u.hp > 0);
    clampCameraToWorld();
}

function endLevel3Cinematic() {
    const survivor = (cinematic.survivorArcher && cinematic.survivorArcher.hp > 0) ? cinematic.survivorArcher : null;

    units = units.filter(u => {
        if (u === survivor) return true; // hayatta kalan okçu gerçek oyuna geçiyor
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
        survivor.ownerIndex = 0;
        survivor.x = player.base.x + 60;
        survivor.y = player.base.y;
        survivor.target = null;
        survivor.isAttacking = false;
        survivor._isActuallyWalking = false;
        survivor._speechText = null;
        survivor._speechTimer = 0;
    }

    // Pusunun heykele verdiği hasar
    player.base.hp = Math.max(1, player.base.hp - 10);

    // Harita normal (3x büyütülmemiş) boyutuna dönsün
    worldWidth = Math.max(MIN_WORLD_WIDTH, canvas.width + 800);

    cinFog = [];
    cinematic = { active: false, phase: '', timer: 0, bubble: null, bubbleTimer: 0 };
    setGameplayUIVisible(true);
    setPlayerCommand(CMD_DEFEND);
    ambushTimer = 0;
    enemy.ambushWaves = null;
    enemy.ambushWaveIndex = 0;
    cameraX = Math.max(0, Math.min(player.base.x - 80, worldWidth - canvas.width));
    if (typeof updateMineSlots === 'function') updateMineSlots(false);
    clampCameraToWorld();
    if (typeof showToast === 'function') showToast('Pusu başladı — heykeli savunun!');
}

function drawCinematicBubble(ctx) {
    // Sahne geneli baloncuk (üstteki bubble metni)
    if (cinematic.active && cinematic.bubble && cinematic.bubbleTimer > 0) {
        const scouts = units.filter(u => u._cinematic && u._cinRole === 'scout' && u.hp > 0);
        const any = units.filter(u => u._cinematic && u.hp > 0);
        const anchor = scouts[1] || scouts[0] || any[0];
        if (anchor) {
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
            ctx.strokeStyle = text.indexOf('PUSU') >= 0 ? '#c0392b' : '#2c3e50';
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
            ctx.fillStyle = text.indexOf('PUSU') >= 0 ? '#c0392b' : '#1a1a1a';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, bx, by - bh / 2);
            ctx.restore();
        }
    }

    // Bireysel birim konuşma balonları (_speechText) — hem müttefik hem düşman
    units.forEach(u => {
        if (!u._speechText || !(u._speechTimer > 0)) return;
        const text = u._speechText;
        ctx.save();
        ctx.font = 'bold 13px Arial';
        const tw = ctx.measureText(text).width;
        const bx = u.x;
        const by = u.y - 72;
        const pad = 9;
        const bw = tw + pad * 2;
        const bh = 24;
        const isFoe = u._cinRole === 'ambusher';
        ctx.globalAlpha = Math.min(1, u._speechTimer / 20);
        ctx.fillStyle = isFoe ? 'rgba(60,20,20,0.92)' : 'rgba(255,255,255,0.94)';
        ctx.strokeStyle = isFoe ? '#e74c3c' : '#2c3e50';
        ctx.lineWidth = 2;
        const rx = bx - bw / 2, ry = by - bh;
        ctx.beginPath();
        ctx.moveTo(rx + 6, ry);
        ctx.arcTo(rx + bw, ry, rx + bw, ry + bh, 6);
        ctx.arcTo(rx + bw, ry + bh, rx, ry + bh, 6);
        ctx.arcTo(rx, ry + bh, rx, ry, 6);
        ctx.arcTo(rx, ry, rx + bw, ry, 6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(bx - 5, by);
        ctx.lineTo(bx, by + 8);
        ctx.lineTo(bx + 5, by);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = isFoe ? '#f5b7b1' : '#1a1a1a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, bx, by - bh / 2);
        ctx.restore();
    });
}
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

    // ===== 3. BÖLÜM PUSU: dalga spawn (normal zorluk) =====
    if (typeof isAmbushLevel === 'function' && isAmbushLevel()) {
        enemy.command = CMD_ATTACK;
        enemy.aiState = 'attack';
        if (!enemy.ambushWaves) {
            enemy.ambushWaves = [
                { at: 20, count: 1 },
                { at: 45, count: 2 },
                { at: 70, count: 2 },
                { at: 100, count: 3 },
                { at: 130, count: 3 },
                { at: 160, count: 3 },
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

    if (level >= 2) {
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
