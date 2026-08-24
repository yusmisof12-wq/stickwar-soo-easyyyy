// ==================== MADENCİ ====================
class Miner {
    constructor(isPlayer, ownerIndex = 0) {
        this.isPlayer = isPlayer;
        this.ownerIndex = isPlayer ? (ownerIndex || 0) : 0;
        this.baseX = isPlayer ? player.base.x : enemy.base.x;
        this.baseY = isPlayer ? player.base.y : enemy.base.y;
        const myTeam = units.filter(u => u.isPlayer === isPlayer && u instanceof Miner);
        const index = myTeam.length % minerSpawnOffsets.length;
        const offset = minerSpawnOffsets[index];
        this.x = this.baseX + (isPlayer ? offset.dx : -offset.dx);
        this.y = this.baseY + offset.dy;
        this.hp = 100;
        this.maxHp = 100;
        this.state = 'assigning_slot';
        this.targetSlot = null;
        this.mineX = 0;
        this.mineY = 0;
        this.hits = 0;
        this.actionTimer = 0;
        this.prevX = this.x;
        this.localOffset = { dx: 0, dy: 0 };
        this.attackCooldown = 60;
        this.attackTimer = 0;
        this.range = 30;
        this.damage = 8;
        this.target = null;
        this.isInvulnerable = false;
        this.combatMode = false;
        this.wanderTimer = 0;
        this.wanderTargetX = this.x;
        this.wanderTargetY = this.y;
        this.isWandering = false;
        this.miningSwing = 0;
        this.miningPhase = 0;
        this.bodyLean = 0;
        this.armRaise = 0;
        this.holdingRock = false;
        this.bagGold = 0;
        this.deliverTimer = 0;
        this.bagHold = false;
        this.bagOffsetX = 0;
        this.bagOffsetY = 0;
        this.stunTimer = 0;
        this.slowTimer = 0;
        this.stuckArrows = [];
        this._isActuallyWalking = false;
    }
    releaseSlot() {
        if (this.targetSlot) {
            this.targetSlot.miners = this.targetSlot.miners.filter(m => m !== this);
            this.targetSlot = null;
        }
    }
    assignSlot() {
        this.releaseSlot();
        this.baseX = this.isPlayer ? player.base.x : enemy.base.x;
        this.baseY = this.isPlayer ? player.base.y : enemy.base.y;
        let mySlots = this.isPlayer ? playerMineSlots : enemyMineSlots;
        let available = mySlots.find(slot => slot.miners.length < 2);
        if (!available) {
            let enemySlots = this.isPlayer ? enemyMineSlots : playerMineSlots;
            available = enemySlots.find(slot => slot.miners.length < 2);
            if (!available) {
                this.state = 'idle';
                this.combatMode = false;
                this.isWandering = false;
                return;
            }
        }
        this.targetSlot = available;
        available.miners.push(this);
        const offsets = [
            { dx: -32, dy: 4 },
            { dx: 32, dy: 4 },
            { dx: -32, dy: -12 },
            { dx: 32, dy: -12 }
        ];
        let usedOffsets = available.miners.slice(0, -1).map(m => m.localOffset);
        let freeOffset = offsets.find(o => !usedOffsets.some(u => u.dx === o.dx && u.dy === o.dy));
        if (!freeOffset) {
            freeOffset = offsets[available.miners.length % offsets.length];
        }
        this.localOffset = freeOffset;
        this.mineX = available.x + freeOffset.dx;
        this.mineY = available.y + freeOffset.dy;
        this.state = 'going_mine';
        this.isWandering = false;
        this.combatMode = false;
    }
    findTarget() {}
    updateWander() {
        this.wanderTimer++;
        if (this.wanderTimer > 180 + Math.random() * 120) {
            this.wanderTimer = 0;
            let range = 80;
            this.wanderTargetX = this.baseX + (this.isPlayer ? 1 : -1) * (Math.random() * range - range/2);
            this.wanderTargetY = this.baseY + (Math.random() * range - range/2);
            this.isWandering = true;
        }
        if (this.isWandering) {
            let dx = this.wanderTargetX - this.x;
            let dy = this.wanderTargetY - this.y;
            let dist = Math.hypot(dx, dy);
            if (dist > 5) {
                let angle = Math.atan2(dy, dx);
                this.x += Math.cos(angle) * 0.8 * SPEED_MULT;
                this.y += Math.sin(angle) * 0.8 * SPEED_MULT;
            } else {
                this.isWandering = false;
                this.wanderTimer = 0;
            }
        }
    }
    update() {
        let cmd = this.isPlayer ? unitOwnerState(this).command : enemy.command;
        this.prevX = this.x;
        this.baseX = this.isPlayer ? player.base.x : enemy.base.x;
        this.baseY = this.isPlayer ? player.base.y : enemy.base.y;
        if (this.stunTimer > 0) {
            this.stunTimer--;
            this._isActuallyWalking = false;
            return;
        }
        if (this.slowTimer > 0) this.slowTimer--;
        const slowMul = this.slowTimer > 0 ? 0.4 : 1;
        if (cmd === CMD_RETREAT) {
            this.releaseSlot();
            this.isWandering = false;
            let targetX = this.isPlayer ? -150 : worldWidth + 150;
            let targetY = this.baseY;
            if (Math.hypot(this.x - targetX, this.y - targetY) > 3) {
                let angle = Math.atan2(targetY - this.y, targetX - this.x);
                this.x += Math.cos(angle) * 1.5 * SPEED_MULT * slowMul;
                this.y += Math.sin(angle) * 1.2 * SPEED_MULT * slowMul;
                this.state = 'retreating';
                this._isActuallyWalking = true;
            } else {
                this.state = 'outside';
                this._isActuallyWalking = false;
            }
            return;
        }
        if (this.state === 'outside') this.assignSlot();
        if (this.state === 'retreating' || this.state === 'idle' || this.state === 'assigning_slot') this.assignSlot();
        if (this.state === 'going_mine') {
            let dist = Math.hypot(this.mineX - this.x, this.mineY - this.y);
            if (dist > 4) {
                let angle = Math.atan2(this.mineY - this.y, this.mineX - this.x);
                this.x += Math.cos(angle) * 1.5 * SPEED_MULT;
                this.y += Math.sin(angle) * 1.5 * SPEED_MULT;
            } else {
                this.x = this.mineX;
                this.y = this.mineY;
                this.state = 'mining';
                this.hits = 0;
                this.actionTimer = 0;
                this.miningSwing = 0;
                this.miningPhase = 0;
                this.bodyLean = 0.1;
                this.armRaise = 0;
                this.holdingRock = false;
                this.bagGold = 0;
            }
        } else if (this.state === 'mining') {
            this.actionTimer++;
            const CYCLE = 70;
            const cycle = this.actionTimer % CYCLE;
            this.holdingRock = false;
            const easeInOut = (t) => t * t * (3 - 2 * t);
            if (cycle < 28) {
                const t = easeInOut(cycle / 28);
                this.miningPhase = 0;
                this.bodyLean = 0.28 + t * 0.08;
                this.armRaise = 0.3 + t * 0.7;
                this.miningSwing = -0.85 + t * 0.25;
            } else if (cycle < 48) {
                const t = easeInOut((cycle - 28) / 20);
                this.miningPhase = 1;
                this.bodyLean = 0.36 + t * 0.12;
                this.armRaise = 1 - t;
                this.miningSwing = -0.6 + t * 2.0;
                if (cycle === 40) {
                    const side = (this.localOffset && this.localOffset.dx > 0) ? -14 : 14;
                    if (typeof spawnMiningSparks === 'function') spawnMiningSparks(this.x + side, this.y - 8);
                }
            } else {
                const t = easeInOut((cycle - 48) / 22);
                this.miningPhase = 2;
                this.bodyLean = 0.48 - t * 0.18;
                this.armRaise = 0.15 + t * 0.2;
                this.miningSwing = 1.4 - t * 0.5;
            }
            if (cycle === 40) {
                this.bagGold = Math.min(6, this.bagGold + 1);
                this.hits++;
                if (this.isPlayer) addFloatingText(this.x + 10, this.y - 40, '+1', '#f1c40f');
            }
            if (this.hits >= 6 && cycle >= 55) {
                const t = easeInOut((cycle - 55) / 15);
                this.bodyLean = 0.3 * (1 - t);
                this.armRaise = 0.3 * (1 - t);
                this.miningSwing = 0.5 * (1 - t);
                if (cycle >= 69) {
                    this.releaseSlot();
                    this.state = 'going_base';
                    this.miningSwing = 0;
                    this.miningPhase = 0;
                    this.bodyLean = 0;
                    this.armRaise = 0;
                    this.holdingRock = false;
                }
            }
        } else if (this.state === 'going_base') {
            let dist = Math.hypot(this.baseX - this.x, this.baseY - this.y);
            if (dist > 35) {
                let angle = Math.atan2(this.baseY - this.y, this.baseX - this.x);
                this.x += Math.cos(angle) * 1.5 * SPEED_MULT;
                this.y += Math.sin(angle) * 1.5 * SPEED_MULT;
            } else {
                this.state = 'delivering';
                this.deliverTimer = 0;
                this.bagHold = false;
                this.bagOffsetX = 0;
                this.bagOffsetY = 0;
                this.bodyLean = 0;
                this.armRaise = 0;
            }
        } else if (this.state === 'delivering') {
            this.deliverTimer++;
            const t = this.deliverTimer;
            if (t <= 45) {
                const p = t / 45;
                this.bagHold = true;
                this.bagOffsetX = -18 + p * 28;
                this.bagOffsetY = -18 + p * 12;
                this.bodyLean = p * 0.25;
                this.armRaise = p * 0.6;
            } else if (t <= 160) {
                this.bagHold = true;
                this.bagOffsetX = 10;
                this.bagOffsetY = -6;
                this.bodyLean = 0.25;
                this.armRaise = 0.5;
                if ((t - 46) % 18 === 0 && this.bagGold > 0) {
                    this.bagGold--;
                    const gx = this.x + (this.isPlayer ? 20 : -20);
                    const gy = this.y - 30;
                    if (typeof spawnMiningSparks === 'function') spawnMiningSparks(gx, gy);
                    if (this.isPlayer) {
                        const g = Math.max(1, Math.floor(13 * (typeof coopGoldMult === 'function' ? coopGoldMult() : 1)));
                        unitOwnerState(this).gold += g;
                        addFloatingText(gx, gy - 20, '+' + g, '#f1c40f');
                    } else {
                        const g = Math.max(1, Math.floor(13 * (typeof coopEnemyGoldMult === 'function' ? coopEnemyGoldMult() : 1)));
                        enemy.gold += g;
                    }
                }
            } else if (t <= 200) {
                const p = (t - 160) / 40;
                this.bagHold = true;
                this.bagOffsetX = 10 - p * 28;
                this.bagOffsetY = -6 - p * 12;
                this.bodyLean = 0.25 * (1 - p);
                this.armRaise = 0.5 * (1 - p);
                this.bagGold = 0;
            } else {
                if (this.bagGold > 0) {
                    const leftover = this.bagGold * 13;
                    if (this.isPlayer) {
                        player.gold += leftover;
                        addFloatingText(this.x, this.y - 50, '+' + leftover, '#f1c40f');
                    } else {
                        enemy.gold += leftover;
                    }
                    this.bagGold = 0;
                }
                this.bagHold = false;
                this.bagOffsetX = 0;
                this.bagOffsetY = 0;
                this.deliverTimer = 0;
                this.bodyLean = 0;
                this.armRaise = 0;
                this.assignSlot();
            }
        } else {
            this.updateWander();
        }
        let grassTop = canvas.height - GROUND_HEIGHT;
        let minY = grassTop + 20;
        let maxY = canvas.height - 20;
        if (this.y < minY) this.y = minY;
        if (this.y > maxY) this.y = maxY;
    }
    draw(ctx) {
        if (this.state === 'outside') return;
        let isFlipped = false;
        if (this.state === 'mining' || this.state === 'going_mine') {
            if (this.localOffset && this.localOffset.dx !== 0) isFlipped = this.localOffset.dx > 0;
            else if (this.targetSlot) isFlipped = this.x > this.targetSlot.x;
        } else {
            const mdx = this.x - this.prevX;
            if (Math.abs(mdx) > 0.3) isFlipped = mdx < 0;
            else if (this.state === 'going_base' || this.state === 'delivering') isFlipped = !this.isPlayer;
            else isFlipped = !this.isPlayer;
        }
        const isDeliver = this.state === 'delivering';
        const moved = Math.hypot(this.x - this.prevX, 0) > 0.35;
        let isWalking = moved && this.state !== 'mining' && !isDeliver;
        let swingAngle = this.state === 'mining' ? this.miningSwing : 0;
        let lean = (this.state === 'mining' || isDeliver) ? this.bodyLean : 0;
        let raise = (this.state === 'mining' || isDeliver) ? this.armRaise : 0;
        const bagOX = isDeliver ? (this.bagOffsetX || 0) : 0;
        const bagOY = isDeliver ? (this.bagOffsetY || 0) : 0;
        if (typeof drawMinerBackpack === 'function') {
            drawMinerBackpack(ctx, this.x + (isFlipped ? -bagOX : bagOX), this.y + bagOY, isFlipped, this.bagGold || 0, isDeliver && this.bagHold);
        }
        const minerColor = unitTeamColor(this);
        const animFrame = this.state === 'mining' ? this.actionTimer : 0;
        if (typeof drawStickman === 'function') {
            drawStickman(ctx, this.x, this.y, minerColor, isDeliver ? 'none' : 'pickaxe',
                animFrame, isWalking, isFlipped, swingAngle, lean, raise, false, false, this.isPlayer);
        }
        if (typeof drawStuckArrows === 'function') drawStuckArrows(ctx, this);
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 15, this.y - 65, 30, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 65, 30 * (this.hp / this.maxHp), 4);
    }
}

// ==================== KULÜP ADAMI ====================
class Clubman {
    constructor(isPlayer, ownerIndex = 0) {
        this.isPlayer = isPlayer;
        this.ownerIndex = isPlayer ? (ownerIndex || 0) : 0;
        this.baseX = isPlayer ? player.base.x : enemy.base.x;
        this.baseY = isPlayer ? player.base.y : enemy.base.y;
        this.x = this.baseX + (isPlayer ? -60 : 60);
        this.y = this.baseY + (Math.random() * 40 - 20);
        const formOwner = isPlayer ? (this.ownerIndex === 1 ? player2 : player) : enemy;
        if (typeof formOwner.clubFormationCounter !== 'number') formOwner.clubFormationCounter = 0;
        this.formationIndex = formOwner.clubFormationCounter++;
        this.hp = 100;
        this.maxHp = 100;
        this.damage = 10;
        this.attackCooldown = 100;
        this.attackTimer = 0;
        this.range = 52;
        this.isAttacking = false;
        this.didHitThisSwing = false;
        this.attackRecover = 0;
        this.target = null;
        this.prevX = this.x;
        this.isInvulnerable = false;
        this.targetX = null;
        this.targetY = null;
        this._isActuallyWalking = false;
        this.stunTimer = 0;
        this.slowTimer = 0;
        this.stuckArrows = [];
    }
    update() {
        if (typeof cinematicHoldUnit === 'function' && cinematicHoldUnit(this)) return;
        let cmd = this.isPlayer ? unitOwnerState(this).command : enemy.command;
        let enemies = units.filter(u => u.isPlayer !== this.isPlayer && u.hp > 0 && !u.isInvulnerable);
        let enemyBase = this.isPlayer ? enemy.base : player.base;
        let myBase = this.isPlayer ? player.base : enemy.base;
        this.prevX = this.x;
        this.baseX = this.isPlayer ? player.base.x : enemy.base.x;
        this.baseY = this.isPlayer ? player.base.y : enemy.base.y;
        if (this.stunTimer > 0) {
            this.stunTimer--;
            this.isAttacking = false;
            this._isActuallyWalking = false;
            return;
        }
        if (this.slowTimer > 0) this.slowTimer--;
        const slowMul = this.slowTimer > 0 ? 0.4 : 1;
        let grassTop = canvas.height - GROUND_HEIGHT;
        let minY = grassTop + 15;
        let maxY = canvas.height - 20;
        if (this.y < minY) this.y = minY;
        if (this.y > maxY) this.y = maxY;
        let targetFrontlineX = this.x;
        let targetFrontlineY = this.baseY;
        if (cmd === CMD_RETREAT) {
            targetFrontlineX = this.isPlayer ? -150 : worldWidth + 150;
            targetFrontlineY = this.baseY;
        } else if (cmd === CMD_DEFEND) {
            if (this.targetX !== null && this.targetY !== null) {
                targetFrontlineX = this.targetX;
                targetFrontlineY = this.targetY;
            } else {
                targetFrontlineX = myBase.x + (this.isPlayer ? 300 : -300);
                targetFrontlineY = myBase.y;
            }
        } else if (cmd === CMD_ATTACK) {
            targetFrontlineX = enemyBase.x + (this.isPlayer ? -100 : 100);
            targetFrontlineY = enemyBase.y;
        }
        const visibleEnemies = enemies.filter(e =>
            cmd === CMD_ATTACK || (cmd === CMD_DEFEND && Math.abs(e.x - myBase.x) < 550)
        );
        // Kule/heykel (enemyBase) de geçerli hedef — aksi halde her kare attackTimer sıfırlanır, hasar gitmez
        const targetingBase = this.target === enemyBase && enemyBase.hp > 0 && cmd === CMD_ATTACK;
        const hasValidTarget = targetingBase || (this.target && this.target !== enemyBase &&
            this.target.hp > 0 && visibleEnemies.includes(this.target));
        if (!hasValidTarget) {
            this.target = null;
            this.isAttacking = false;
            this.attackTimer = 0;
            this.didHitThisSwing = false;
        }
        if (!this.target) {
            if (typeof pickFrontEnemy === 'function') {
                this.target = pickFrontEnemy(this, visibleEnemies);
            } else {
                let bestScore = Infinity;
                for (let e of visibleEnemies) {
                    let dist = Math.hypot(e.x - this.x, e.y - this.y);
                    let currentAttackers = units.filter(u => u.isPlayer === this.isPlayer && u instanceof Clubman && u.target === e).length;
                    let score = dist + (currentAttackers * 120);
                    if (score < bestScore) {
                        bestScore = score;
                        this.target = e;
                    }
                }
            }
        }
        let distToTarget = this.target ? Math.hypot(this.target.x - this.x, this.target.y - this.y) : Infinity;
        if (cmd === CMD_ATTACK && !this.target) {
            this.target = enemyBase;
            distToTarget = Math.hypot(enemyBase.x - this.x, enemyBase.y - this.y);
        } else if (cmd !== CMD_ATTACK && this.target === enemyBase) {
            this.target = null;
            distToTarget = Infinity;
            this.isAttacking = false;
            this.attackTimer = 0;
        }
        if (this.target && this.target.hp <= 0) {
            this.target = null;
            this.isAttacking = false;
            this.attackTimer = 0;
            this.didHitThisSwing = false;
            distToTarget = Infinity;
        }
        this.isAttacking = false;
        let actualMoved = false;
        if (cmd === CMD_RETREAT) {
            if (Math.hypot(this.x - targetFrontlineX, this.y - targetFrontlineY) > 5) {
                let angle = Math.atan2(targetFrontlineY - this.y, targetFrontlineX - this.x);
                this.x += Math.cos(angle) * 2.0 * SPEED_MULT * slowMul;
                this.y += Math.sin(angle) * 1.5 * SPEED_MULT * slowMul;
                actualMoved = true;
            } else {
                this.x = targetFrontlineX;
                this.y = targetFrontlineY;
            }
            this.attackTimer = 0;
            this.isAttacking = false;
        } else {
            // Kuleye vuruşta X mesafesi yeterli (yükseklik farkı menzili bozmasın)
            const hitRange = (this.target === enemyBase) ? Math.max(this.range, 90) : this.range;
            const distHit = (this.target === enemyBase)
                ? Math.abs(this.target.x - this.x)
                : distToTarget;
            if (this.target && distHit <= hitRange) {
                const foe = this.target;
                const myTurn = typeof meleeCanSwing !== 'function' || meleeCanSwing(this);
                if (!myTurn) {
                    this.isAttacking = false;
                    this.attackTimer = 0;
                    this.didHitThisSwing = false;
                } else {
                    this.isAttacking = true;
                    this.attackTimer++;
                    if (this.attackTimer === 50 && !this.didHitThisSwing) {
                        foe.hp -= this.damage;
                        if (foe.stunTimer !== undefined) foe.stunTimer = 40;
                        const ty = (foe === enemyBase) ? (foe.y - 160) : (foe.y || 320);
                        addFloatingText(foe.x, ty, '-' + this.damage, this.isPlayer ? '#e74c3c' : '#c0392b');
                        this.didHitThisSwing = true;
                    }
                    if (this.attackTimer >= this.attackCooldown) {
                        this.attackTimer = 0;
                        this.didHitThisSwing = false;
                        this.isAttacking = false;
                        this.attackRecover = 18;
                        if (typeof meleeFinishSwing === 'function') meleeFinishSwing(this);
                    }
                }
            } else if (this.target) {
                let speedX = (cmd === CMD_ATTACK) ? 2.2 : 1.8;
                let speedY = (cmd === CMD_ATTACK) ? 1.6 : 1.3;
                let angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
                this.x += Math.cos(angle) * speedX * SPEED_MULT * slowMul;
                this.y += Math.sin(angle) * speedY * SPEED_MULT * slowMul;
                this.attackTimer = 0;
                this.isAttacking = false;
                actualMoved = true;
            } else {
                let distToFrontline = Math.hypot(this.x - targetFrontlineX, this.y - targetFrontlineY);
                if (distToFrontline > 10) {
                    let speedX = (cmd === CMD_ATTACK) ? 2.2 : 1.7;
                    let speedY = (cmd === CMD_ATTACK) ? 1.6 : 1.2;
                    let angle = Math.atan2(targetFrontlineY - this.y, targetFrontlineX - this.x);
                    this.x += Math.cos(angle) * speedX * SPEED_MULT * slowMul;
                    this.y += Math.sin(angle) * speedY * SPEED_MULT * slowMul;
                    actualMoved = true;
                } else if (cmd === CMD_DEFEND) {
                    this.x = targetFrontlineX;
                    this.y = targetFrontlineY;
                }
                this.attackTimer = 0;
                this.isAttacking = false;
            }
        }
        const movedCheck = Math.hypot(this.x - this.prevX, 0) > 0.4;
        this._isActuallyWalking = actualMoved && movedCheck && !this.isAttacking;
        if ((!this.target || this.target.hp <= 0) && this.isAttacking) {
            this.isAttacking = false;
            this.attackTimer = 0;
        }
    }
    draw(ctx) {
        if (this.x < -50 || this.x > worldWidth + 50) return;
        let isFlipped = !this.isPlayer;
        const dx = this.x - this.prevX;
        if (Math.abs(dx) > 0.3) isFlipped = dx < 0;
        else if (this.isAttacking && this.target && this.target.hp > 0) isFlipped = (this.target.x < this.x);
        else {
            let cmd = this.isPlayer ? unitOwnerState(this).command : enemy.command;
            if (cmd === CMD_RETREAT) isFlipped = this.isPlayer;
            else if (cmd === CMD_ATTACK) isFlipped = !this.isPlayer;
            else isFlipped = !this.isPlayer;
        }
        const clubColor = unitTeamColor(this);
        let clubAnim = 0;
        if (this.isAttacking) clubAnim = this.attackTimer;
        else if (this.attackRecover > 0) {
            clubAnim = Math.max(0, 100 - (18 - this.attackRecover) * 5);
            this.attackRecover--;
        }
        if (typeof drawStickman === 'function') {
            drawStickman(ctx, this.x, this.y, clubColor, this._weapon || 'club', clubAnim, this._isActuallyWalking && clubAnim === 0, isFlipped, 0);
        }
        if (typeof drawStuckArrows === 'function') drawStuckArrows(ctx, this);
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 15, this.y - 65, 30, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 65, 30 * (this.hp / this.maxHp), 4);
    }
}

class Sicklewrath extends Clubman {
    constructor(isPlayer, ownerIndex = 0) {
        super(isPlayer, ownerIndex);
        this._weapon = 'sickle';
        this.damage = 8;
        this.hp = 75;
        this.maxHp = 75;
        this.attackCooldown = 118;
        this.range = 48;
    }
}

class Archer {
    constructor(isPlayer, ownerIndex = 0) {
        this.isPlayer = isPlayer;
        this.ownerIndex = isPlayer ? (ownerIndex || 0) : 0;
        this.baseX = isPlayer ? player.base.x : enemy.base.x;
        this.baseY = isPlayer ? player.base.y : enemy.base.y;
        this.x = this.baseX + (isPlayer ? -70 : 70);
        this.y = this.baseY + (Math.random() * 40 - 20);
        this.formationIndex = isPlayer
            ? (player.archerFormationCounter = (player.archerFormationCounter || 0) + 1)
            : (enemy.archerFormationCounter = (enemy.archerFormationCounter || 0) + 1);
        this.formationOffsetY = (this.formationIndex - 2) * 25;
        this.hp = 50;
        this.maxHp = 50;
        this.range = 520;
        this.safeGap = 32;
        this.tooClose = 240;
        this.attackCooldown = 130;
        this.attackTimer = 0;
        this.drawAmount = 0;
        this.target = null;
        this.prevX = this.x;
        this.isInvulnerable = false;
        this._isActuallyWalking = false;
        this.stunTimer = 0;
        this.slowTimer = 0;
        this.stuckArrows = [];
    }
    update() {
        if (typeof cinematicHoldUnit === 'function' && cinematicHoldUnit(this)) return;
        let cmd = this.isPlayer ? unitOwnerState(this).command : enemy.command;
        let enemies = units.filter(u => u.isPlayer !== this.isPlayer && u.hp > 0 && !u.isInvulnerable);
        let enemyBase = this.isPlayer ? enemy.base : player.base;
        let myBase = this.isPlayer ? player.base : enemy.base;
        this.prevX = this.x;
        this.baseX = this.isPlayer ? player.base.x : enemy.base.x;
        this.baseY = this.isPlayer ? player.base.y : enemy.base.y;
        if (this.stunTimer > 0) {
            this.stunTimer--;
            this._isActuallyWalking = false;
            return;
        }
        if (this.slowTimer > 0) this.slowTimer--;
        const slowMul = this.slowTimer > 0 ? 0.4 : 1;
        let grassTop = canvas.height - GROUND_HEIGHT;
        let minY = grassTop + 15;
        let maxY = canvas.height - 20;
        if (this.y < minY) this.y = minY;
        if (this.y > maxY) this.y = maxY;
        if (cmd === CMD_RETREAT) {
            let targetX = this.isPlayer ? -150 : worldWidth + 150;
            if (Math.hypot(this.x - targetX, this.y - this.baseY) > 5) {
                let angle = Math.atan2(this.baseY - this.y, targetX - this.x);
                this.x += Math.cos(angle) * 1.2 * SPEED_MULT * slowMul;
                this.y += Math.sin(angle) * 0.9 * SPEED_MULT * slowMul;
                this._isActuallyWalking = true;
            } else {
                this.x = targetX;
                this.y = this.baseY;
                this._isActuallyWalking = false;
            }
            this.attackTimer = 0;
            this.drawAmount = 0;
            this.target = null;
            return;
        }
        const visibleEnemies = enemies.filter(e =>
            cmd === CMD_ATTACK || (cmd === CMD_DEFEND && Math.abs(e.x - myBase.x) < AI_VISION_RANGE)
        );
        let closest = null, minDist = Infinity;
        for (let e of visibleEnemies) {
            let d = Math.hypot(e.x - this.x, e.y - this.y);
            if (d < minDist) { minDist = d; closest = e; }
        }
        this.target = (closest && minDist <= this.range) ? closest : null;
        if (!this.target && cmd === CMD_ATTACK) {
            const distToBase = Math.hypot(enemyBase.x - this.x, enemyBase.y - this.y);
            if (distToBase <= this.range) this.target = enemyBase;
        }
        const onMap = this.x > -50 && this.x < worldWidth + 50;
        if (!onMap) this.target = null;
        if (!this.target) {
            const myClubmen = units.filter(u => u.isPlayer === this.isPlayer && u instanceof Clubman && u.hp > 0);
            let frontClubman = null;
            if (myClubmen.length > 0) {
                frontClubman = this.isPlayer
                    ? myClubmen.reduce((a, b) => b.x > a.x ? b : a)
                    : myClubmen.reduce((a, b) => b.x < a.x ? b : a);
            }
            let desiredX;
            let desiredY = this.baseY + this.formationOffsetY;
            if (cmd === CMD_ATTACK) desiredX = enemyBase.x + (this.isPlayer ? -260 : 260);
            else desiredX = myBase.x + (this.isPlayer ? 220 : -220);
            if (frontClubman) {
                desiredX = this.isPlayer
                    ? Math.min(desiredX, frontClubman.x - this.safeGap)
                    : Math.max(desiredX, frontClubman.x + this.safeGap);
                desiredY = frontClubman.y + this.formationOffsetY;
            }
            let actualMoved = false;
            const distToDesired = Math.hypot(desiredX - this.x, desiredY - this.y);
            if (distToDesired > 8) {
                let angle = Math.atan2(desiredY - this.y, desiredX - this.x);
                this.x += Math.cos(angle) * 1.2 * SPEED_MULT * slowMul;
                this.y += Math.sin(angle) * 0.9 * SPEED_MULT * slowMul;
                actualMoved = true;
            }
            this._isActuallyWalking = actualMoved;
        } else {
            this._isActuallyWalking = false;
        }
        const canShoot = this.target && this.target.hp > 0 &&
            Math.hypot(this.target.x - this.x, this.target.y - this.y) < this.range + 40;
        if (canShoot) {
            this.attackTimer++;
            const CYCLE = this.attackCooldown;
            const DRAW_START = Math.floor(CYCLE * 0.55);
            const SHOOT_AT = CYCLE - 6;
            if (this.attackTimer < DRAW_START) this.drawAmount = 0;
            else if (this.attackTimer < SHOOT_AT) {
                this.drawAmount = (this.attackTimer - DRAW_START) / (SHOOT_AT - DRAW_START);
                this.drawAmount = Math.min(1, this.drawAmount);
            } else this.drawAmount = 0;
            if (this.attackTimer === SHOOT_AT) {
                projectiles.push(new Arrow(this.x, this.y - 30, this.target, this.isPlayer));
            }
            if (this.attackTimer >= CYCLE) {
                this.attackTimer = 0;
                this.drawAmount = 0;
            }
        } else {
            if (this.attackTimer > 0) {
                this.attackTimer = 0;
                this.drawAmount = Math.max(0, this.drawAmount - 0.15);
            } else {
                this.drawAmount = Math.max(0, this.drawAmount - 0.05);
            }
        }
    }
    draw(ctx) {
        if (this.x < -50 || this.x > worldWidth + 50) return;
        let isFlipped = !this.isPlayer;
        const dx = this.x - this.prevX;
        if (this.target && this.target.hp > 0) isFlipped = (this.target.x < this.x);
        else if (Math.abs(dx) > 0.3) isFlipped = dx < 0;
        const archerColor = unitTeamColor(this);
        if (typeof drawStickman === 'function') {
            drawStickman(ctx, this.x, this.y, archerColor, 'bow', 0, this._isActuallyWalking, isFlipped, this.drawAmount);
        }
        if (typeof drawStuckArrows === 'function') drawStuckArrows(ctx, this);
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - 15, this.y - 65, 30, 4);
        ctx.fillStyle = '#2ecc71';
        ctx.fillRect(this.x - 15, this.y - 65, 30 * (this.hp / this.maxHp), 4);
    }
}

class BaseArcherUnit {
    constructor(isPlayer, offsetX, offsetY, climbSpeed, ownerIndex = 0) {
        this.isPlayer = isPlayer;
        this.ownerIndex = isPlayer ? (ownerIndex || 0) : 0;
        const base = isPlayer ? player.base : enemy.base;
        this.x = base.x + offsetX;
        this.y = base.y + 100;
        this.targetX = base.x + offsetX;
        this.targetY = base.y - 140 + offsetY;
        this.climbSpeed = climbSpeed * SPEED_MULT;
        this.state = 'climbing';
        this.attackTimer = 0;
        this.drawAmount = 0;
        this.active = true;
        this.isWalking = false;
        this.climbAnim = 0;
    }
    update() {
        if (!this.active) return;
        if (this.state === 'climbing') {
            let dx = this.targetX - this.x;
            let dy = this.targetY - this.y;
            let dist = Math.hypot(dx, dy);
            this.climbAnim++;
            if (dist > this.climbSpeed) {
                let angle = Math.atan2(dy, dx);
                this.x += Math.cos(angle) * this.climbSpeed;
                this.y += Math.sin(angle) * this.climbSpeed;
                this.isWalking = true;
            } else {
                this.x = this.targetX;
                this.y = this.targetY;
                this.state = 'active';
                this.attackTimer = 0;
                this.isWalking = false;
            }
        } else if (this.state === 'active') {
            let enemies = units.filter(u => u.isPlayer !== this.isPlayer && u.hp > 0 && !u.isInvulnerable);
            let target = null;
            if (enemies.length > 0) {
                target = enemies.reduce((prev, curr) =>
                    Math.abs(curr.x - this.x) < Math.abs(prev.x - this.x) ? curr : prev);
                if (Math.abs(target.x - this.x) >= 700) target = null;
            }
            if (!target) {
                this.attackTimer = 0;
                this.drawAmount = Math.max(0, this.drawAmount - 0.12);
            } else {
                this.attackTimer++;
                const CYCLE = 120;
                const DRAW_START = 80;
                const SHOOT_AT = 116;
                if (this.attackTimer < DRAW_START) this.drawAmount = 0;
                else if (this.attackTimer < SHOOT_AT) {
                    this.drawAmount = (this.attackTimer - DRAW_START) / (SHOOT_AT - DRAW_START);
                    this.drawAmount = Math.min(1, this.drawAmount);
                } else this.drawAmount = 0;
                if (this.attackTimer === SHOOT_AT) {
                    projectiles.push(new Arrow(this.x, this.y - 30, target, this.isPlayer));
                }
                if (this.attackTimer >= CYCLE) {
                    this.attackTimer = 0;
                    this.drawAmount = 0;
                }
            }
            this.isWalking = false;
        }
    }
    draw(ctx) {
        if (!this.active) return;
        let isFlipped = false;
        let currentWeapon = 'bow';
        if (this.state === 'climbing') {
            isFlipped = (this.targetX < this.x);
            currentWeapon = 'climb';
        } else {
            let enemies = units.filter(u => u.isPlayer !== this.isPlayer && u.hp > 0 && !u.isInvulnerable);
            if (enemies.length > 0) {
                let target = enemies.reduce((prev, curr) => Math.abs(curr.x - this.x) < Math.abs(prev.x - this.x) ? curr : prev);
                isFlipped = (target.x < this.x);
            }
        }
        if (typeof drawStickman === 'function') {
            drawStickman(ctx, this.x, this.y, unitTeamColor(this), currentWeapon, this.climbAnim, this.isWalking, isFlipped, this.state === 'active' ? this.drawAmount : 0);
        }
    }
}

class Arrow {
    constructor(startX, startY, targetUnit, isPlayer) {
        this.x = startX;
        this.y = startY;
        this.isPlayer = isPlayer;
        this.target = targetUnit;
        this.active = true;
        this.speed = 8 * SPEED_MULT;
        this.angle = 0;
        if (targetUnit) {
            this.angle = Math.atan2(targetUnit.y - startY, targetUnit.x - startX);
        }
    }
    update() {
        if (!this.active) return;
        if (this.target && this.target.hp > 0) {
            this.angle = Math.atan2(this.target.y - this.y, this.target.x - this.x);
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;
            if (Math.hypot(this.target.x - this.x, this.target.y - this.y) < 15) {
                this.active = false;
                let isHeadshot = Math.random() < 0.2;
                let dmg = isHeadshot ? 25 : 12;
                this.target.hp -= dmg;
                if (this.target.slowTimer !== undefined) {
                    this.target.slowTimer = Math.max(this.target.slowTimer || 0, 150);
                }
                if (!this.target.stuckArrows) this.target.stuckArrows = [];
                this.target.stuckArrows.push({
                    ox: (Math.random() * 8 - 4),
                    oy: isHeadshot ? -32 - Math.random() * 6 : -12 + Math.random() * 10,
                    angle: this.angle,
                    life: 360
                });
                if (this.target.stuckArrows.length > 6) this.target.stuckArrows.shift();
                if (isHeadshot) {
                    addFloatingText(this.target.x, this.target.y - 30, 'KAFADAN! -25', '#e67e22', true);
                } else {
                    addFloatingText(this.target.x, this.target.y - 30, '-12', '#e74c3c');
                }
            }
        } else {
            this.x += Math.cos(this.angle) * this.speed;
            this.y += Math.sin(this.angle) * this.speed;
        }
        if (this.x < 0 || this.x > worldWidth || this.y < 0 || this.y > canvas.height) {
            this.active = false;
        }
    }
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
        ctx.fillStyle = '#bdc3c7';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(4, -3);
        ctx.lineTo(4, 3);
        ctx.fill();
        ctx.restore();
    }
}
