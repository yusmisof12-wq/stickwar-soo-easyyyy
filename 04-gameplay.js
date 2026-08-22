        function setPlayerCommand(cmd) {
            player.command = cmd;
            Object.values(cmdBtns).forEach(b => b.classList.remove('active'));
            cmdBtns[cmd].classList.add('active');
        }

        cmdBtns[CMD_RETREAT].onclick = () => {
            if (isCoopGuestNow()) { sendRoomInput('retreat'); return; }
            setPlayerCommand(CMD_RETREAT);
        };
        cmdBtns[CMD_DEFEND].onclick = () => {
            if (isCoopGuestNow()) { sendRoomInput('defend'); return; }
            setPlayerCommand(CMD_DEFEND);
        };
        cmdBtns[CMD_ATTACK].onclick = () => {
            if (isCoopGuestNow()) { sendRoomInput('attack'); return; }
            setPlayerCommand(CMD_ATTACK);
        };

        btnMiner.onclick = () => {
            if (isCoopGuestNow()) { sendRoomInput('buyMiner'); return; }
            const playerMiners = units.filter(u => u.isPlayer && u instanceof Miner).length;
            if (player.gold >= 150 && player.minerCooldown <= 0 && playerMiners < MAX_MINERS_PER_TEAM) {
                player.gold -= 150;
                units.push(new Miner(true));
                player.minerCooldown = player.minerMaxCooldown;
            }
        };
        btnClub.onclick = () => {
            if (isCoopGuestNow()) { sendRoomInput('buyClub'); return; }
            const playerClubmen = units.filter(u => u.isPlayer && u instanceof Clubman).length;
            if (player.gold >= 125 && player.clubCooldown <= 0 && playerClubmen < MAX_CLUBMEN_PER_TEAM) {
                player.gold -= 125;
                units.push(new Clubman(true));
                player.clubCooldown = player.clubMaxCooldown;
            }
        };
        btnArcher.onclick = () => {
            if (isCoopGuestNow()) { sendRoomInput('buyArcher'); return; }
            const playerArchers = units.filter(u => u.isPlayer && u instanceof Archer).length;
            if (player.gold >= 140 && player.archerCooldown <= 0 && playerArchers < MAX_ARCHERS_PER_TEAM) {
                player.gold -= 140;
                units.push(new Archer(true));
                player.archerCooldown = player.archerMaxCooldown;
            }
        };

        function resetLevel() {
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
                    enemy.gold += goldAmount;
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
                enemy.minerCooldown = player.minerMaxCooldown * diff.cooldownMult;
            }

            if (enemy.clubCooldown <= 0 && enemy.gold >= 125 && aiFighters.length < Math.min(diff.maxClubmen, MAX_CLUBMEN_PER_TEAM)) {
                if (Math.random() >= diff.mistakeChance) {
                    enemy.gold -= 125;
                    units.push(new Clubman(false));
                    if (enemy.aiState === 'retreat') enemy.recoveryUnitsPurchased++;
                }
                enemy.clubCooldown = player.clubMaxCooldown * diff.cooldownMult;
            }

            if (enemy.archerCooldown <= 0 && enemy.gold >= 140 && aiArchers.length < Math.min(diff.maxArchers || 0, MAX_ARCHERS_PER_TEAM)) {
                if (Math.random() >= diff.mistakeChance) {
                    enemy.gold -= 140;
                    units.push(new Archer(false));
                    if (enemy.aiState === 'retreat') enemy.recoveryUnitsPurchased++;
                }
                enemy.archerCooldown = 11 * 60 * diff.cooldownMult;
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
            const setRetreatArchers = isPlayer => {
                const isRetreating = isPlayer ? player.command === CMD_RETREAT : enemy.command === CMD_RETREAT;
                const hasArchers = retreatArchers.some(archer => archer.isPlayer === isPlayer);
                if (isRetreating && !hasArchers) {
                    const base = isPlayer ? player.base : enemy.base;
                    const climbSpeed = 1.2;
                    retreatArchers.push(
                        new BaseArcherUnit(isPlayer, -25, -15, climbSpeed),
                        new BaseArcherUnit(isPlayer, 25, 15, climbSpeed)
                    );
                }
                if (!isRetreating) {
                    retreatArchers = retreatArchers.filter(archer => archer.isPlayer !== isPlayer);
                }
            };

            setRetreatArchers(true);
            setRetreatArchers(false);
            retreatArchers.forEach(archer => archer.update());
        }

        function handleFormationAndCollisions() {
            ['player', 'enemy'].forEach(team => {
                let isPlayer = (team === 'player');
                let fighters = units.filter(u => u.isPlayer === isPlayer && u instanceof Clubman && u.hp > 0);

                fighters.sort((a, b) => a.formationIndex - b.formationIndex);

                fighters.forEach((u, index) => {
                    let cmd = u.isPlayer ? player.command : enemy.command;
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

        function updateActionButtonsUI() {
            if (player.minerCooldown > 0) {
                let fillPercent = ((player.minerMaxCooldown - player.minerCooldown) / player.minerMaxCooldown) * 100;
                minerCdFill.style.height = (100 - fillPercent) + '%';
            } else {
                minerCdFill.style.height = '0%';
            }
            if (player.clubCooldown > 0) {
                let fillPercent = ((player.clubMaxCooldown - player.clubCooldown) / player.clubMaxCooldown) * 100;
                clubCdFill.style.height = (100 - fillPercent) + '%';
            } else {
                clubCdFill.style.height = '0%';
            }
            if (player.archerCooldown > 0) {
                let fillPercent = ((player.archerMaxCooldown - player.archerCooldown) / player.archerMaxCooldown) * 100;
                archerCdFill.style.height = (100 - fillPercent) + '%';
            } else {
                archerCdFill.style.height = '0%';
            }

            goldEl.innerText = Math.floor(player.gold);
            levelEl.innerText = Math.min(level, 3) + "/3";

            const playerMiners = units.filter(u => u.isPlayer && getUnitType(u) === 'miner').length;
            const playerClubmen = units.filter(u => u.isPlayer && getUnitType(u) === 'clubman').length;
            const playerArchers = units.filter(u => u.isPlayer && getUnitType(u) === 'archer').length;

            btnMiner.disabled = player.gold < 150 || player.minerCooldown > 0 || playerMiners >= MAX_MINERS_PER_TEAM;
            btnClub.disabled = player.gold < 125 || player.clubCooldown > 0 || playerClubmen >= MAX_CLUBMEN_PER_TEAM;

            if (level >= 3) {
                btnArcher.style.display = '';
                btnArcher.disabled = player.gold < 140 || player.archerCooldown > 0 || playerArchers >= MAX_ARCHERS_PER_TEAM;
            } else {
                btnArcher.style.display = 'none';
            }
        }

        function update() {
            if (isCoopGuestNow()) return;
            frames++;

            if (isCoopHostNow()) {
                coopBroadcastCounter++;
                if (coopBroadcastCounter >= 3) {
                    coopBroadcastCounter = 0;
                    broadcastHostState();
                }
            }

            if (frames % (player.command === CMD_RETREAT ? 150 : 300) === 0) {
                player.gold += 15;
                addFloatingText(player.base.x, player.base.y - 120, '+15', '#f1c40f');
            }

            [player, enemy].forEach(team => {
                if (team.command !== CMD_RETREAT && team.lastCommand === CMD_RETREAT) {
                    team.retreatGraceTimer = 180;
                }
                if (team.retreatGraceTimer > 0) team.retreatGraceTimer--;
                team.lastCommand = team.command;
            });

            units.forEach(u => {
                const team = u.isPlayer ? player : enemy;
                u.isInvulnerable = team.command === CMD_RETREAT || team.retreatGraceTimer > 0;
            });

            updateAI();
            updateArchers();

            handleFormationAndCollisions();
            units.forEach(u => u.update());
            projectiles.forEach(p => p.update());

            units.forEach(u => {
                if (u.hp <= 0 && u instanceof Miner && typeof u.releaseSlot === 'function') {
                    u.releaseSlot();
                }
            });
            units = units.filter(u => u.hp > 0);
            projectiles = projectiles.filter(p => p.active);

            if (enemy.base.hp <= 0 && !coopVictoryHandled) {
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

