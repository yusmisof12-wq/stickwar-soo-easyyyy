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

        function queueUnit(type, ownerIndex) {
            if (ownerIndex === undefined) ownerIndex = localOwnerIndex();
            const st = getOwnerState(ownerIndex);
            ensureQueues(st);
            if (st.gold < UNIT_COST[type]) return false;

            const live = countPlayerUnits(type);
            const q0 = countQueuedFor(0, type);
            const q1 = countQueuedFor(1, type);
            if (live + q0 + q1 >= maxForType(type)) return false;

            if (type === 'miner') {
                if (st.minerQueue.length >= MAX_QUEUE) return false;
                st.gold -= UNIT_COST.miner;
                st.minerQueue.push('miner');
                if (st.minerQueue.length === 1 && st.minerTimer <= 0) {
                    st.minerTimerMax = SPAWN_TIME.miner;
                    st.minerTimer = SPAWN_TIME.miner;
                }
            } else {
                // club + archer aynı combat kuyruğu (sıra korunur)
                if (st.combatQueue.length >= MAX_QUEUE) return false;
                st.gold -= UNIT_COST[type];
                st.combatQueue.push(type);
                if (st.combatQueue.length === 1 && st.combatTimer <= 0) {
                    st.combatTimerMax = SPAWN_TIME[type];
                    st.combatTimer = SPAWN_TIME[type];
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
                st[maxKey] = SPAWN_TIME[next] || 600;
                st[timerKey] = st[maxKey];
            } else {
                st[timerKey] = 0;
                st[maxKey] = 0;
            }
        }

        function processSpawnQueueFor(ownerIndex) {
            const st = getOwnerState(ownerIndex);
            if (!st) return;
            // Madenci ve savaş birimleri paralel (ayrı kuyruklar)
            processOneQueue(st, 'minerQueue', 'minerTimer', 'minerTimerMax', ownerIndex);
            processOneQueue(st, 'combatQueue', 'combatTimer', 'combatTimerMax', ownerIndex);
        }

        function processSpawnQueue() {
            processSpawnQueueFor(0);
            if (isCoopActive()) processSpawnQueueFor(1);
        }

        btnMiner.onclick = () => {
            if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
                sendRoomInput('buyMiner'); return;
            }
            queueUnit('miner', 0);
        };
        btnClub.onclick = () => {
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
            else if (level === 3) enemy.base.maxHp = 1800;

            enemy.base.hp = enemy.base.maxHp;
            frames = 0;
            cameraX = 0;
        }

        function updateAI() {
            enemy.aiTimer++;
            const diff = getAiDifficulty();
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
            // Geri çekilme okçusu SADECE co-op (arkadaşla oyun)
            const ensurePlayerArcher = (ownerIndex, offsetX) => {
                const st = getOwnerState(ownerIndex);
                const retreating = st.command === CMD_RETREAT;
                const has = retreatArchers.some(a => a.isPlayer && (a.ownerIndex || 0) === ownerIndex);
                if (retreating && !has) {
                    retreatArchers.push(new BaseArcherUnit(true, offsetX, ownerIndex === 1 ? 12 : -12, 1.2, ownerIndex));
                }
                if (!retreating) {
                    retreatArchers = retreatArchers.filter(a => !(a.isPlayer && (a.ownerIndex || 0) === ownerIndex));
                }
            };
            if (typeof isCoopActive === 'function' && isCoopActive()) {
                ensurePlayerArcher(0, -28);
                ensurePlayerArcher(1, 28);
            } else {
                // Solo: geri çekilmede okçu yok
                retreatArchers = retreatArchers.filter(a => !a.isPlayer);
            }

            // Düşman: 2 okçu
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
                let fighters = units.filter(u => u.isPlayer === isPlayer && u instanceof Clubman && u.hp > 0);

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

            // Madenci kuyruğu ayrı; combat kuyruğunun başı club veya archer
            setCircularCooldown(minerCdFill, st.minerQueue.length ? st.minerTimer : 0, st.minerTimerMax || 1);
            const combatHead = st.combatQueue[0];
            setCircularCooldown(clubCdFill, combatHead === 'club' ? st.combatTimer : 0, combatHead === 'club' ? (st.combatTimerMax || 1) : 1);
            setCircularCooldown(archerCdFill, combatHead === 'archer' ? st.combatTimer : 0, combatHead === 'archer' ? (st.combatTimerMax || 1) : 1);

            goldEl.innerText = Math.floor(st.gold);
            levelEl.innerText = Math.min(level, 3) + "/3";
            if (typeof isCoopPlayNow === 'function' && isCoopPlayNow()) {
                const slot = typeof myCoopSlot === 'function' ? myCoopSlot() : 0;
                goldEl.parentElement && (goldEl.parentElement.title = slot === 1 ? 'Senin altının (Oyuncu 2)' : 'Senin altının (Oyuncu 1)');
            }

            // Kuyruk sayacı rozetleri
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
            // Co-op: çift yerel motor — fizik her istemcide (solo ile aynı)
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

            if (enemy.base.hp <= 0 && !isGameOver) {
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
                level++;
                if (typeof onLevelVictory === 'function') onLevelVictory();
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

            // Spawn kuyruğu: sırayla birim üret
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
