// ==================== SABİTLER VE DEĞİŞKENLER ====================
        const canvas = document.getElementById('gameCanvas');
        const minerFaceImg = new Image();
        minerFaceImg.src = 'data:image/png;base64,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';
        const minerFaceEnemyImg = new Image();
        minerFaceEnemyImg.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAmkElEQVR4nO2deXQc1ZX/P6+qultqyVYvkiV5kQ22wTarscHYLLLZl0kmJIhDlpnJTGYymcnBNgQIEBjZgRCHsNie7MlkMgOTObHIjxkS8gvwG4JJYjMhNjDY2IANGIMXyZZka+vuWt7vj6pXqm71pG4ttszoe04fqaurXt16975777vvvlswjnGMYxzjGMc4xjGOcYxjHOMYxzjGMY5xjGMc4xjHOMYxjnGMHv4/4VZuKtkYFgUAAAAASUVORK5CYII=';
        const ctx = canvas.getContext('2d');
        const GROUND_HEIGHT = 220;
        const MIN_WORLD_WIDTH = 2600;
        const AI_VISION_RANGE = 620;
        const MAX_MINERS_PER_TEAM = 99; // limit yok
        const MAX_CLUBMEN_PER_TEAM = 28;
        const MAX_ARCHERS_PER_TEAM = 14;
        const SPEED_MULT = 1.8; // %80 hız artışı

        let worldWidth = MIN_WORLD_WIDTH;
        let cameraX = 0;
        let isPanning = false;
        let panStartX = 0;
        let panCameraStartX = 0;

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            worldWidth = Math.max(MIN_WORLD_WIDTH, canvas.width + 800);
            cameraX = Math.max(0, Math.min(cameraX, worldWidth - canvas.width));
            updateMineSlots(false);
        }
        window.addEventListener('resize', resizeCanvas);

        const CMD_ATTACK = 1;
        const CMD_DEFEND = 2;
        const CMD_RETREAT = 3;

        const AI_DIFFICULTY = {
            1: { 
                cooldownMult: 3.5,
                mistakeChance: 0.55,
                badReaction: true,
                attackThreshold: 7,
                maxMiners: 2,
                maxClubmen: 4,
                maxArchers: 0,
                retreatHpThreshold: 0.35,
                passiveGoldMult: 0.45
            },
            2: { 
                cooldownMult: 1.5,
                mistakeChance: 0.15,
                badReaction: false,
                attackThreshold: 3,
                maxMiners: 6,
                maxClubmen: 0,
                maxArchers: 8,
                retreatHpThreshold: 0.35,
                passiveGoldMult: 0.85
            },
            3: { 
                cooldownMult: 1.0,
                mistakeChance: 0.0,
                badReaction: false,
                attackThreshold: 2,
                maxMiners: 999,
                maxClubmen: 999,
                maxArchers: 10,
                retreatHpThreshold: 0.4,
                passiveGoldMult: 1.0
            }
        };
        
        function getAiDifficulty() {
            return AI_DIFFICULTY[level] || AI_DIFFICULTY[3];
        }

        let frames = 0;
        let level = 1;
        let isGameOver = false;
        let lastFrameTime = 0;
        let accumulatedTime = 0;
        let animationFrameId = null;
        const FIXED_TIMESTEP = 1000 / 60;

        let player = {
            gold: 300,
            command: CMD_DEFEND,
            lastCommand: CMD_DEFEND,
            retreatGraceTimer: 0,
            base: { x: 130, y: 0, hp: 1000, maxHp: 1000 },
            minerCooldown: 0, minerMaxCooldown: 15 * 60,
            clubCooldown: 0, clubMaxCooldown: 10 * 60,
            archerCooldown: 0, archerMaxCooldown: 11 * 60,
            clubFormationCounter: 0,
            archerFormationCounter: 0
        };
        
        let enemy = {
            gold: 300,
            command: CMD_DEFEND,
            base: { x: 0, y: 0, hp: 500, maxHp: 500 },
            aiTimer: 0,
            aiState: 'defend',
            lastCommand: CMD_DEFEND,
            retreatGraceTimer: 0,
            retreatTimer: 0,
            regroupTimer: 0,
            attackLossCount: 0,
            lastAttackUnits: 0,
            clubFormationCounter: 0,
            archerFormationCounter: 0,
            minerCooldown: 0,
            clubCooldown: 0,
            archerCooldown: 0,
            retreatGoldSaved: 0,
            recoveryUnitsPurchased: 0,
            retreatCooldown: 0
        };

        let playerMineSlots = [];
        let enemyMineSlots = [];
        let pMineOffsets = [];
        let eMineOffsets = [];

        const clubSpawnOffsets = [
            { dx: 80, dy: 0 },
            { dx: 140, dy: 45 },
            { dx: 50, dy: -45 },
            { dx: 170, dy: 70 },
            { dx: 110, dy: -70 },
            { dx: 60, dy: 55 },
            { dx: 150, dy: -25 },
            { dx: 90, dy: 30 },
            { dx: 180, dy: -55 },
            { dx: 120, dy: 80 },
            { dx: 40, dy: -80 },
            { dx: 160, dy: 60 }
        ];
        const minerSpawnOffsets = [
            { dx: 70, dy: 0 },
            { dx: 120, dy: 30 },
            { dx: 30, dy: -30 },
            { dx: 150, dy: 50 },
            { dx: 80, dy: -50 },
            { dx: 100, dy: 40 },
            { dx: 50, dy: 45 },
            { dx: 130, dy: -40 },
            { dx: 90, dy: -60 }
        ];

        function initMines() {
            const baseOffsets = [
                { x: 220, y: -50 },
                { x: 220, y: 50 },
                { x: 180, y: -80 },
                { x: 180, y: 80 }
            ];
            pMineOffsets = baseOffsets.map(pos => ({
                x: pos.x + (Math.random() * 20 - 10),
                y: pos.y + (Math.random() * 20 - 10)
            }));
            eMineOffsets = baseOffsets.map(pos => ({
                x: -pos.x + (Math.random() * 20 - 10),
                y: pos.y + (Math.random() * 20 - 10)
            }));
            updateMineSlots(true);
        }

        function updateMineSlots(resetAssignments = false) {
            enemy.base.x = worldWidth - 130;
            let grassTop = canvas.height - GROUND_HEIGHT;
            let baseCenterY = grassTop + (GROUND_HEIGHT / 2);
            player.base.y = baseCenterY;
            enemy.base.y = baseCenterY;

            const refreshSlots = (slots, offsets, base) => {
                slots.length = offsets.length;
                offsets.forEach((offset, index) => {
                    const slot = slots[index] || (slots[index] = { x: 0, y: 0, miners: [] });
                    slot.x = base.x + offset.x;
                    slot.y = baseCenterY + offset.y;
                    if (resetAssignments) slot.miners = [];
                    slot.miners.forEach(miner => {
                        miner.mineX = slot.x + miner.localOffset.dx;
                        miner.mineY = slot.y + miner.localOffset.dy;
                    });
                });
            };

            refreshSlots(playerMineSlots, pMineOffsets, player.base);
            refreshSlots(enemyMineSlots, eMineOffsets, enemy.base);
        }
        resizeCanvas();

        canvas.addEventListener('pointerdown', event => {
            isPanning = true;
            panStartX = event.clientX;
            panCameraStartX = cameraX;
            canvas.setPointerCapture(event.pointerId);
        });
        canvas.addEventListener('pointermove', event => {
            if (!isPanning) return;
            const maxCameraX = Math.max(0, worldWidth - canvas.width);
            cameraX = Math.max(0, Math.min(maxCameraX, panCameraStartX - (event.clientX - panStartX)));
        });
        const stopPanning = event => {
            isPanning = false;
            if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
        };
        canvas.addEventListener('pointerup', stopPanning);
        canvas.addEventListener('pointercancel', stopPanning);

        let units = [];
        let projectiles = [];
        let floatingTexts = [];
        let retreatArchers = [];
        let miningSparks = [];

        const goldEl = document.getElementById('goldText');
        const levelEl = document.getElementById('levelText');
        const btnMiner = document.getElementById('btnMiner');
        const btnClub = document.getElementById('btnClub');
        const btnArcher = document.getElementById('btnArcher');
        const minerCdFill = document.getElementById('minerCdFill');
        const clubCdFill = document.getElementById('clubCdFill');
        const archerCdFill = document.getElementById('archerCdFill');
        const modal = document.getElementById('modalScreen');
        const modalTitle = document.getElementById('modalTitle');
        const modalBtn = document.getElementById('modalBtn');
        const cmdBtns = {
            [CMD_RETREAT]: document.getElementById('cmdRetreat'),
            [CMD_DEFEND]: document.getElementById('cmdDefend'),
            [CMD_ATTACK]: document.getElementById('cmdAttack')
        };

        function addFloatingText(x, y, text, color, isBig = false) {
            floatingTexts.push({ x, y, text, color, life: isBig ? 90 : 60, isBig });
        }

