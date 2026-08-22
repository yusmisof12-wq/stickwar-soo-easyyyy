// ==================== SABİTLER VE DEĞİŞKENLER ====================
        const canvas = document.getElementById('gameCanvas');
        const minerFaceImg = new Image();
        minerFaceImg.src = ''; // yüz fotoğrafı kapalı (geçersiz URL hatasını önler)
        const minerFaceEnemyImg = new Image();
        minerFaceEnemyImg.src = '';
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
            minerQueue: [],
            minerTimer: 0,
            minerTimerMax: 0,
            combatQueue: [],
            combatTimer: 0,
            combatTimerMax: 0,
            clubFormationCounter: 0,
            archerFormationCounter: 0
        };

        // 2. oyuncu (co-op) — ayrı altın, komut, kuyruk; takım aynı
        let player2 = {
            gold: 300,
            command: CMD_DEFEND,
            lastCommand: CMD_DEFEND,
            retreatGraceTimer: 0,
            minerQueue: [],
            minerTimer: 0,
            minerTimerMax: 0,
            combatQueue: [],
            combatTimer: 0,
            combatTimerMax: 0,
            clubFormationCounter: 0,
            archerFormationCounter: 0
        };

        const COLOR_P1 = '#1a1a1a';
        const COLOR_P2 = '#2980b9'; // mavi — 2. oyuncu
        const COLOR_ENEMY = '#c0392b';

        function isCoopActive() {
            return typeof coopSession !== 'undefined' && !!coopSession && !!coopSession.roomId;
        }
        function localOwnerIndex() {
            if (typeof isCoopPlayNow === 'function' && isCoopPlayNow() && typeof myCoopSlot === 'function') {
                return myCoopSlot();
            }
            return 0;
        }
        function getOwnerState(ownerIndex) {
            return ownerIndex === 1 ? player2 : player;
        }
        function unitOwnerState(u) {
            if (!u || !u.isPlayer) return enemy;
            try {
                return (u.ownerIndex === 1) ? player2 : player;
            } catch (e) {
                return player;
            }
        }
        function unitTeamColor(u) {
            if (!u || !u.isPlayer) return COLOR_ENEMY;
            return (u.ownerIndex === 1) ? COLOR_P2 : COLOR_P1;
        }
        function coopGoldMult() {
            // Sadece arkadaş seferi: oyuncular 0.8x
            return isCoopActive() ? 0.8 : 1;
        }
        function coopEnemyGoldMult() {
            // Sadece arkadaş seferi: düşman 1.2x
            return isCoopActive() ? 1.2 : 1;
        }
        function coopEnemySpawnMult() {
            // AI birim yerleştirme hızı 1.2x (cooldown / 1.2)
            return isCoopActive() ? 1.2 : 1;
        }
        
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
