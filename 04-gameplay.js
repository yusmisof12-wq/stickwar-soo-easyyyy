// ==================== OYUN DÖNGÜSÜ / SATIN ALMA / YZ ====================
const UNIT_COST = { miner: 150, club: 125, archer: 140 };
const UNIT_TRAIN = { miner: 8 * 60, club: 6 * 60, archer: 7 * 60 };
const MAX_QUEUE = 8;

function countTeam(isPlayer, Ctor) {
    return units.filter(u => u.isPlayer === isPlayer && u instanceof Ctor && u.hp > 0).length;
}

function resetLevel() {
    isGameOver = false;
    frames = 0;
    lastFrameTime = 0;
    accumulatedTime = 0;
    units.length = 0;
    projectiles.length = 0;
    floatingTexts.length = 0;
    miningSparks.length = 0;
    retreatArchers.length = 0;
    cameraX = 0;

    player.gold = 300;
    player.command = CMD_DEFEND;
    player.lastCommand = CMD_DEFEND;
    player.retreatGraceTimer = 0;
    player.base.hp = player.base.maxHp = 1000;
    player.minerQueue = [];
    player.minerTimer = 0;
    player.minerTimerMax = 0;
    player.combatQueue = [];
    player.combatTimer = 0;
    player.combatTimerMax = 0;
    player.clubFormationCounter = 0;
    player.archerFormationCounter = 0;
    player.minerCooldown = 0;
    player.clubCooldown = 0;
    player.archerCooldown = 0;

    player2.gold = 300;
    player2.command = CMD_DEFEND;
    player2.lastCommand = CMD_DEFEND;
    player2.retreatGraceTimer = 0;
    player2.minerQueue = [];
    player2.minerTimer = 0;
    player2.minerTimerMax = 0;
    player2.combatQueue = [];
    player2.combatTimer = 0;
    player2.combatTimerMax = 0;
    player2.clubFormationCounter = 0;
    player2.archerFormationCounter = 0;

    const diff = getAiDifficulty();
    const eMax = level === 1 ? 280 : (level === 2 ? 420 : 500);
    enemy.gold = 300;
    enemy.command = CMD_DEFEND;
    enemy.lastCommand = CMD_DEFEND;
    enemy.base.hp = enemy.base.maxHp = eMax;
    enemy.aiTimer = 0;
    enemy.aiState = 'defend';
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

    initMines();
    updateMineSlots(true);
    if (levelEl) levelEl.textContent = level + '/3';
    if (btnArcher) btnArcher.style.display = level >= 2 ? '' : 'none';
    updateActionButtonsUI();
}

function spawnUnit(type, isPlayer, ownerIndex) {
    let u = null;
    if (type === 'miner') u = new Miner(isPlayer, ownerIndex);
    else if (type === 'club') u = new Clubman(isPlayer, ownerIndex);
    else if (type === 'archer') u = new Archer(isPlayer, ownerIndex);
    if (u) units.push(u);
    return u;
}

function queueUnit(type, slot) {
    slot = slot | 0;
    const owner = getOwnerState(slot);
    const cost = UNIT_COST[type];
    if (!owner || owner.gold < cost) return false;

    if (type === 'miner') {
        if (owner.minerQueue.length >= MAX_QUEUE) return false;
        if (countTeam(true, Miner) + owner.minerQueue.length >= MAX_MINERS_PER_TEAM) return false;
        owner.gold -= cost;
        owner.minerQueue.push('miner');
        if (owner.minerQueue.length === 1) {
            owner.minerTimerMax = UNIT_TRAIN.miner;
            owner.minerTimer = UNIT_TRAIN.miner;
        }
    } else {
        if (owner.combatQueue.length >= MAX_QUEUE) return false;
        if (type === 'club' && countTeam(true, Clubman) >= MAX_CLUBMEN_PER_TEAM) return false;
        if (type === 'archer' && countTeam(true, Archer) >= MAX_ARCHERS_PER_TEAM) return false;
        owner.gold -= cost;
        owner.combatQueue.push(type);
        if (owner.combatQueue.length === 1) {
            owner.combatTimerMax = UNIT_TRAIN[type];
            owner.combatTimer = UNIT_TRAIN[type];
        }
    }
    updateActionButtonsUI();
    return true;
}

function processOwnerQueues(owner, slot) {
    if (owner.minerQueue.length) {
        if (owner.minerTimer > 0) owner.minerTimer--;
        if (owner.minerTimer <= 0) {
            owner.minerQueue.shift();
            spawnUnit('miner', true, slot);
            if (owner.minerQueue.length) {
                owner.minerTimerMax = UNIT_TRAIN.miner;
                owner.minerTimer = UNIT_TRAIN.miner;
            } else {
                owner.minerTimer = 0;
                owner.minerTimerMax = 0;
            }
        }
    }
    if (owner.combatQueue.length) {
        if (owner.combatTimer > 0) owner.combatTimer--;
        if (owner.combatTimer <= 0) {
            const t = owner.combatQueue.shift();
            spawnUnit(t, true, slot);
            if (owner.combatQueue.length) {
                const n = owner.combatQueue[0];
                owner.combatTimerMax = UNIT_TRAIN[n];
                owner.combatTimer = UNIT_TRAIN[n];
            } else {
                owner.combatTimer = 0;
                owner.combatTimerMax = 0;
            }
        }
    }
}

function setLocalCommand(cmd) {
    const slot = localOwnerIndex();
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow() && typeof sendRoomInput === 'function') {
        const name = cmd === CMD_ATTACK ? 'attack' : (cmd === CMD_RETREAT ? 'retreat' : 'defend');
        sendRoomInput(name);
    }
    const owner = getOwnerState(slot);
    owner.command = cmd;
    owner.lastCommand = cmd;
    updateActionButtonsUI();
}

function buyLocal(type) {
    const slot = localOwnerIndex();
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow() && typeof sendRoomInput === 'function') {
        const map = { miner: 'buyMiner', club: 'buyClub', archer: 'buyArcher' };
        sendRoomInput(map[type]);
        return;
    }
    queueUnit(type, slot);
}

function updateActionButtonsUI() {
    const slot = localOwnerIndex();
    const me = getOwnerState(slot);
    if (goldEl) goldEl.textContent = String(Math.floor(me.gold));
    if (levelEl) levelEl.textContent = level + '/3';

    const setBadge = (id, n) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (n > 0) {
            el.textContent = String(n);
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    };
    setBadge('minerQBadge', me.minerQueue.length);
    setBadge('clubQBadge', me.combatQueue.filter(t => t === 'club').length);
    setBadge('archerQBadge', me.combatQueue.filter(t => t === 'archer').length);

    const paintCd = (fill, timer, max) => {
        if (!fill) return;
        if (max > 0 && timer > 0) {
            const pct = timer / max;
            fill.style.setProperty('--cd-deg', (pct * 360) + 'deg');
            fill.classList.add('active');
        } else {
            fill.classList.remove('active');
        }
    };
    paintCd(minerCdFill, me.minerTimer, me.minerTimerMax);
    paintCd(clubCdFill, me.combatTimer, me.combatTimerMax);
    paintCd(archerCdFill, me.combatTimer, me.combatTimerMax);

    if (btnMiner) btnMiner.disabled = me.gold < UNIT_COST.miner && me.minerQueue.length === 0;
    if (btnClub) btnClub.disabled = me.gold < UNIT_COST.club && me.combatQueue.length === 0;
    if (btnArcher) {
        btnArcher.style.display = level >= 2 ? '' : 'none';
        btnArcher.disabled = me.gold < UNIT_COST.archer && me.combatQueue.length === 0;
    }

    Object.keys(cmdBtns).forEach(k => {
        const btn = cmdBtns[k];
        if (!btn) return;
        btn.classList.toggle('active', Number(k) === me.command);
    });
}

function updatePingUI() {
    // istatistik satırında ping göstermek isteğe bağlı
}

function startPingLoop() {
    if (pingLoopId) return;
    pingLoopId = setInterval(() => {
        if (typeof wsSend === 'function') wsSend({ type: 'ping', t: Date.now() });
    }, 2000);
}

function enemyTryBuy(type) {
    const cost = UNIT_COST[type];
    if (enemy.gold < cost) return false;
    const diff = getAiDifficulty();
    if (type === 'miner' && countTeam(false, Miner) >= diff.maxMiners) return false;
    if (type === 'club' && countTeam(false, Clubman) >= diff.maxClubmen) return false;
    if (type === 'archer' && countTeam(false, Archer) >= diff.maxArchers) return false;
    enemy.gold -= cost;
    spawnUnit(type, false, 0);
    return true;
}

function updateEnemyAI() {
    const diff = getAiDifficulty();
    enemy.aiTimer++;
    if (enemy.minerCooldown > 0) enemy.minerCooldown--;
    if (enemy.clubCooldown > 0) enemy.clubCooldown--;
    if (enemy.archerCooldown > 0) enemy.archerCooldown--;
    if (enemy.retreatCooldown > 0) enemy.retreatCooldown--;

    if (frames % 60 === 0) {
        enemy.gold += Math.max(1, Math.floor(6 * diff.passiveGoldMult * coopEnemyGoldMult()));
    }

    const spawnMul = coopEnemySpawnMult();
    const minerWait = Math.floor(180 * diff.cooldownMult / spawnMul);
    const clubWait = Math.floor(140 * diff.cooldownMult / spawnMul);
    const archerWait = Math.floor(160 * diff.cooldownMult / spawnMul);

    if (Math.random() < diff.mistakeChance * 0.01) return;

    if (enemy.minerCooldown <= 0 && enemyTryBuy('miner')) enemy.minerCooldown = minerWait;
    if (enemy.clubCooldown <= 0 && enemyTryBuy('club')) enemy.clubCooldown = clubWait;
    if (level >= 2 && enemy.archerCooldown <= 0 && enemyTryBuy('archer')) enemy.archerCooldown = archerWait;

    const myCombat = units.filter(u => !u.isPlayer && u.hp > 0 && !(u instanceof Miner)).length;
    const theirCombat = units.filter(u => u.isPlayer && u.hp > 0 && !(u instanceof Miner)).length;
    const hpRatio = enemy.base.hp / enemy.base.maxHp;

    if (hpRatio < diff.retreatHpThreshold && enemy.retreatCooldown <= 0) {
        enemy.command = CMD_RETREAT;
        enemy.retreatTimer++;
        if (enemy.retreatTimer > 240) {
            enemy.command = CMD_DEFEND;
            enemy.retreatCooldown = 400;
            enemy.retreatTimer = 0;
        }
    } else if (myCombat >= theirCombat + diff.attackThreshold && myCombat >= 2) {
        enemy.command = CMD_ATTACK;
    } else {
        enemy.command = CMD_DEFEND;
    }
}

function updateFloatingTexts() {
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].y -= 0.7;
        floatingTexts[i].life--;
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
}

function dealBaseMelee() {
    for (const u of units) {
        if (u.hp <= 0) continue;
        if (u instanceof Miner && u.state !== 'attacking') continue;
        const foeBase = u.isPlayer ? enemy.base : player.base;
        const d = Math.hypot(foeBase.x - u.x, foeBase.y - u.y);
        if (d < 55) {
            const dmg = (u instanceof Clubman) ? 0.35 : (u instanceof Archer ? 0.12 : 0.18);
            foeBase.hp -= dmg;
        }
    }
}

function checkEnd() {
    if (isGameOver) return;
    if (enemy.base.hp <= 0) {
        enemy.base.hp = 0;
        isGameOver = true;
        if (typeof isCoopPlayNow === 'function' && isCoopPlayNow() && typeof showCoopVictory === 'function') {
            showCoopVictory(level, 'players');
            return;
        }
        if (typeof onLevelVictory === 'function') onLevelVictory();
        modalTitle.innerText = level >= 3 ? 'Tebrikler! Seferi Bitirdiniz!' : 'Bölüm Tamamlandı!';
        modalBtn.innerText = 'Sefer Haritası';
        modal.classList.remove('hidden');
        return;
    }
    if (player.base.hp <= 0) {
        player.base.hp = 0;
        isGameOver = true;
        if (typeof isCoopPlayNow === 'function' && isCoopPlayNow() && typeof showCoopVictory === 'function') {
            showCoopVictory(level, 'enemy');
            return;
        }
        modalTitle.innerText = 'Kaybettiniz!';
        modalBtn.innerText = 'Tekrar Dene';
        modal.classList.remove('hidden');
    }
}

function gameTick() {
    if (isGameOver) return;
    frames++;
    processOwnerQueues(player, 0);
    if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
        processOwnerQueues(player2, 1);
    }
    updateEnemyAI();
    units.forEach(u => { if (u && typeof u.update === 'function') u.update(); });
    projectiles.forEach(p => { if (p && typeof p.update === 'function') p.update(); });
    retreatArchers.forEach(a => { if (a && typeof a.update === 'function') a.update(); });
    units = units.filter(u => u.hp > 0);
    projectiles = projectiles.filter(p => p.active !== false);
    updateMiningSparks();
    updateFloatingTexts();
    dealBaseMelee();
    checkEnd();
    updateActionButtonsUI();
}

function loop(ts) {
    if (isGameOver && !gameStarted) return;
    animationFrameId = requestAnimationFrame(loop);
    if (!lastFrameTime) lastFrameTime = ts;
    let dt = ts - lastFrameTime;
    lastFrameTime = ts;
    if (dt > 100) dt = 100;
    accumulatedTime += dt;
    let steps = 0;
    while (accumulatedTime >= FIXED_TIMESTEP && steps < 5) {
        if (!isGameOver && gameStarted) gameTick();
        accumulatedTime -= FIXED_TIMESTEP;
        steps++;
    }
    draw();
}

function startGameLoop() {
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    isGameOver = false;
    gameStarted = true;
    lastFrameTime = 0;
    accumulatedTime = 0;
    animationFrameId = requestAnimationFrame(loop);
}

if (btnMiner) btnMiner.onclick = () => buyLocal('miner');
if (btnClub) btnClub.onclick = () => buyLocal('club');
if (btnArcher) btnArcher.onclick = () => buyLocal('archer');
if (cmdBtns[CMD_RETREAT]) cmdBtns[CMD_RETREAT].onclick = () => setLocalCommand(CMD_RETREAT);
if (cmdBtns[CMD_DEFEND]) cmdBtns[CMD_DEFEND].onclick = () => setLocalCommand(CMD_DEFEND);
if (cmdBtns[CMD_ATTACK]) cmdBtns[CMD_ATTACK].onclick = () => setLocalCommand(CMD_ATTACK);
