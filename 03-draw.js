<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stickman Savaşı - 2 Bölüm</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            background: #1a1a2e;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: Arial, sans-serif;
            overflow: hidden;
        }
        #gameContainer {
            border: 3px solid #e67e22;
            border-radius: 12px;
            box-shadow: 0 0 40px rgba(230, 126, 34, 0.3);
            overflow: hidden;
            position: relative;
        }
        canvas {
            display: block;
            width: 1000px;
            height: 600px;
            background: #2c3e50;
            cursor: crosshair;
        }
        #ui {
            position: absolute;
            bottom: 12px;
            left: 0;
            right: 0;
            display: flex;
            justify-content: space-between;
            padding: 0 20px;
            pointer-events: none;
            color: #ecf0f1;
            font-size: 14px;
            font-weight: bold;
            text-shadow: 0 0 10px rgba(0, 0, 0, 0.8);
        }
        #ui span {
            background: rgba(0, 0, 0, 0.5);
            padding: 4px 14px;
            border-radius: 20px;
            backdrop-filter: blur(4px);
        }
        #ui .gold {
            color: #f1c40f;
        }
        #ui .hp {
            color: #e74c3c;
        }
        .controls {
            position: absolute;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            gap: 14px;
            background: rgba(0, 0, 0, 0.6);
            padding: 8px 20px;
            border-radius: 30px;
            backdrop-filter: blur(4px);
            pointer-events: none;
        }
        .controls kbd {
            background: #2c3e50;
            color: #ecf0f1;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 13px;
            border: 1px solid #555;
        }
        #levelDisplay {
            position: absolute;
            top: 70px;
            right: 20px;
            color: #f1c40f;
            font-size: 22px;
            font-weight: bold;
            text-shadow: 0 0 20px rgba(241, 196, 15, 0.5);
            background: rgba(0, 0, 0, 0.5);
            padding: 4px 18px;
            border-radius: 30px;
            backdrop-filter: blur(4px);
            pointer-events: none;
        }
    </style>
</head>
<body>

    <div id="gameContainer">
        <canvas id="gameCanvas" width="1000" height="600"></canvas>

        <div id="levelDisplay">🏰 Bölüm 1</div>

        <div class="controls">
            <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> Hareket ·
            <kbd>E</kbd> Kazma ·
            <kbd>Q</kbd> Silah değiştir ·
            <kbd>F</kbd> Saldır
        </div>

        <div id="ui">
            <span>❤️ <span class="hp" id="playerHp">100</span> / 100</span>
            <span>💰 <span class="gold" id="playerGold">0</span> Altın</span>
            <span>⚔️ <span id="playerWeapon">Kazma</span></span>
            <span>🏹 <span id="enemyHp">100</span> / 100</span>
        </div>
    </div>

    <script>
        // --------------------------------------------------------------
        // CANVAS VE TEMEL AYARLAR
        // --------------------------------------------------------------
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        const worldWidth = 1000;
        const GROUND_HEIGHT = 80;
        const GRAVITY = 0.6;
        let frames = 0;
        let level = 1;

        // --------------------------------------------------------------
        // YÜZ RESİMLERİ (placeholder)
        // --------------------------------------------------------------
        const minerFaceImg = new Image();
        minerFaceImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"%3E%3Ccircle cx="12" cy="12" r="12" fill="%23f1c40f"/%3E%3Ccircle cx="8" cy="10" r="2" fill="%232c3e50"/%3E%3Ccircle cx="16" cy="10" r="2" fill="%232c3e50"/%3E%3Cpath d="M7 15 Q12 19 17 15" stroke="%232c3e50" stroke-width="2" fill="none"/%3E%3C/svg%3E';
        const minerFaceEnemyImg = new Image();
        minerFaceEnemyImg.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"%3E%3Ccircle cx="12" cy="12" r="12" fill="%23e74c3c"/%3E%3Ccircle cx="8" cy="10" r="2" fill="%232c3e50"/%3E%3Ccircle cx="16" cy="10" r="2" fill="%232c3e50"/%3E%3Cpath d="M7 17 Q12 13 17 17" stroke="%232c3e50" stroke-width="2" fill="none"/%3E%3C/svg%3E';

        // --------------------------------------------------------------
        // OYUNCU / DÜŞMAN
        // --------------------------------------------------------------
        const player = {
            x: 150,
            y: 0,
            w: 30,
            h: 50,
            vx: 0,
            vy: 0,
            speed: 3.2,
            hp: 100,
            maxHp: 100,
            gold: 0,
            weapon: 'pickaxe',
            isFlipped: false,
            isWalking: false,
            isGrounded: true,
            animFrame: 0,
            swingAngle: 0,
            bodyLean: 0,
            armRaise: 0,
            attackCooldown: 0,
            isAttacking: false,
            attackTimer: 0,
            miningTimer: 0,
            isMining: false,
            stuckArrows: [],
            base: { x: 120, y: 0, hp: 300, maxHp: 300 },
            mineSlots: []
        };

        const enemy = {
            x: 850,
            y: 0,
            w: 30,
            h: 50,
            vx: 0,
            vy: 0,
            speed: 1.6,
            hp: 100,
            maxHp: 100,
            gold: 0,
            weapon: 'pickaxe',
            isFlipped: true,
            isWalking: false,
            isGrounded: true,
            animFrame: 0,
            swingAngle: 0,
            bodyLean: 0,
            armRaise: 0,
            attackCooldown: 0,
            isAttacking: false,
            attackTimer: 0,
            miningTimer: 0,
            isMining: false,
            stuckArrows: [],
            base: { x: 880, y: 0, hp: 300, maxHp: 300 },
            mineSlots: [],
            state: 'idle',
            targetX: 850,
            targetY: 0,
            decisionTimer: 0
        };

        // --------------------------------------------------------------
        // MADEN YATAKLARI
        // --------------------------------------------------------------
        const playerMineSlots = [];
        const enemyMineSlots = [];
        const miningSparks = [];

        for (let i = 0; i < 3; i++) {
            playerMineSlots.push({
                x: 180 + i * 50,
                y: 0,
                gold: 20 + Math.floor(Math.random() * 15),
                maxGold: 35,
                respawnTimer: 0,
                active: true
            });
            enemyMineSlots.push({
                x: 720 + i * 50,
                y: 0,
                gold: 20 + Math.floor(Math.random() * 15),
                maxGold: 35,
                respawnTimer: 0,
                active: true
            });
        }

        // --------------------------------------------------------------
        // 1. BÖLÜM: KASABA SİLÜETİ
        // --------------------------------------------------------------
        function drawTownBackground(ctx) {
            const skyHeight = canvas.height - GROUND_HEIGHT;
            const baseY = skyHeight;
            const townCenterX = worldWidth * 0.5;

            const houseColors = ['#5b3a29', '#6b4226', '#4a2e1e', '#5e3c28'];
            const houses = [
                { dx: -260, w: 46, h: 60 },
                { dx: -190, w: 38, h: 48 },
                { dx: -120, w: 52, h: 70 },
                { dx: 70, w: 44, h: 55 },
                { dx: 145, w: 36, h: 42 },
                { dx: 215, w: 50, h: 66 },
            ];
            houses.forEach((h, i) => {
                const hx = townCenterX + h.dx;
                ctx.fillStyle = houseColors[i % houseColors.length];
                ctx.fillRect(hx - h.w / 2, baseY - h.h, h.w, h.h);
                ctx.fillStyle = '#3a2418';
                ctx.beginPath();
                ctx.moveTo(hx - h.w / 2 - 4, baseY - h.h);
                ctx.lineTo(hx, baseY - h.h - h.w * 0.45);
                ctx.lineTo(hx + h.w / 2 + 4, baseY - h.h);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = 'rgba(241,196,15,0.55)';
                ctx.fillRect(hx - 5, baseY - h.h * 0.55, 6, 8);
            });

            const towerX = townCenterX - 20;
            const towerW = 30,
                towerH = 110;
            ctx.fillStyle = '#4b3222';
            ctx.fillRect(towerX - towerW / 2, baseY - towerH, towerW, towerH);
            ctx.fillStyle = '#2c1e14';
            ctx.beginPath();
            ctx.moveTo(towerX - towerW / 2 - 6, baseY - towerH);
            ctx.lineTo(towerX, baseY - towerH - 34);
            ctx.lineTo(towerX + towerW / 2 + 6, baseY - towerH);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(towerX - 8, baseY - towerH + 20, 16, 20);
            ctx.fillStyle = '#caa24a';
            ctx.beginPath();
            ctx.moveTo(towerX - 5, baseY - towerH + 26);
            ctx.quadraticCurveTo(towerX, baseY - towerH + 20, towerX + 5, baseY - towerH + 26);
            ctx.lineTo(towerX + 4, baseY - towerH + 36);
            ctx.lineTo(towerX - 4, baseY - towerH + 36);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ecf0f1';
            ctx.beginPath();
            ctx.arc(towerX, baseY - towerH + 60, 9, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#2c1e14';
            ctx.lineWidth = 1.4;
            ctx.stroke();

            const millX = townCenterX + 195;
            const millW = 34,
                millH = 70;
            ctx.fillStyle = '#8d6e4a';
            ctx.beginPath();
            ctx.moveTo(millX - millW / 2, baseY);
            ctx.lineTo(millX - millW / 2 + 6, baseY - millH);
            ctx.lineTo(millX + millW / 2 - 6, baseY - millH);
            ctx.lineTo(millX + millW / 2, baseY);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#5c4531';
            ctx.beginPath();
            ctx.moveTo(millX - millW / 2 + 2, baseY - millH);
            ctx.lineTo(millX, baseY - millH - 22);
            ctx.lineTo(millX + millW / 2 - 2, baseY - millH);
            ctx.closePath();
            ctx.fill();
            ctx.save();
            ctx.translate(millX, baseY - millH - 6);
            ctx.rotate((frames || 0) * 0.012);
            ctx.strokeStyle = '#d7c9a3';
            ctx.lineWidth = 5;
            ctx.lineCap = 'round';
            for (let i = 0; i < 4; i++) {
                ctx.save();
                ctx.rotate((Math.PI / 2) * i);
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(0, -32);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(-6, -22);
                ctx.lineTo(6, -22);
                ctx.stroke();
                ctx.restore();
            }
            ctx.restore();
        }

        // --------------------------------------------------------------
        // 2. BÖLÜM: ORMAN + OKÇU EĞİTİM ALANI
        // --------------------------------------------------------------
        function drawForestBackground(ctx) {
            const skyHeight = canvas.height - GROUND_HEIGHT;
            const baseY = skyHeight;

            const treePositions = [40, 120, 200, 280, 400, 520, 620, 720, 830, 920];
            treePositions.forEach((tx) => {
                const treeH = 60 + Math.sin(tx * 0.5) * 20;
                ctx.fillStyle = '#2d5016';
                ctx.beginPath();
                ctx.moveTo(tx, baseY);
                ctx.lineTo(tx - 18, baseY - treeH);
                ctx.lineTo(tx + 18, baseY - treeH);
                ctx.closePath();
                ctx.fill();
                ctx.fillStyle = '#1e3a0e';
                ctx.beginPath();
                ctx.arc(tx, baseY - treeH - 10, 28 + Math.sin(tx) * 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#2a4f14';
                ctx.beginPath();
                ctx.arc(tx - 10, baseY - treeH - 20, 18, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(tx + 12, baseY - treeH - 18, 16, 0, Math.PI * 2);
                ctx.fill();
            });

            const targetX = 600;
            const targetY = baseY - 80;
            for (let i = 0; i < 3; i++) {
                const tx = targetX + i * 65;
                ctx.fillStyle = '#5d4037';
                ctx.fillRect(tx - 2, targetY + 20, 4, 40);
                ctx.fillStyle = '#8d6e63';
                ctx.beginPath();
                ctx.arc(tx, targetY, 22, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = '#4e342e';
                ctx.lineWidth = 2;
                ctx.stroke();
                const rings = [
                    ['#f44336', 18],
                    ['#ffffff', 13],
                    ['#f44336', 8],
                    ['#ffffff', 4],
                    ['#f44336', 2]
                ];
                rings.forEach(([color, radius]) => {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(tx, targetY, radius, 0, Math.PI * 2);
                    ctx.fill();
                });
                for (let j = 0; j < 3; j++) {
                    const ox = (j - 1) * 6 + ((tx + j * 7) % 5);
                    const oy = (j - 1) * 6 + ((tx * 3 + j * 11) % 5);
                    ctx.strokeStyle = '#bdc3c7';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(tx + ox - 6, targetY + oy);
                    ctx.lineTo(tx + ox + 4, targetY + oy + 2);
                    ctx.stroke();
                }
            }
        }

        // --------------------------------------------------------------
        // ÇEVRE ÇİZİMİ (ana fonksiyon)
        // --------------------------------------------------------------
        function drawEnvironment(ctx) {
            let skyHeight = canvas.height - GROUND_HEIGHT;

            let grad = ctx.createLinearGradient(0, 0, 0, skyHeight);
            if (level === 1) {
                grad.addColorStop(0, '#2c3e50');
                grad.addColorStop(0.4, '#8e44ad');
                grad.addColorStop(0.7, '#c0392b');
                grad.addColorStop(1, '#f39c12');
            } else {
                grad.addColorStop(0, '#1a4d2a');
                grad.addColorStop(0.5, '#2d6a3a');
                grad.addColorStop(1, '#4a8c5a');
            }
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, worldWidth, skyHeight);

            if (level === 1) {
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath();
                ctx.arc(worldWidth - 220, 140, 90, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = 'rgba(255,255,200,0.3)';
                ctx.beginPath();
                ctx.arc(worldWidth - 220, 140, 70, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,200,0.1)';
                ctx.beginPath();
                ctx.arc(worldWidth - 220, 140, 120, 0, Math.PI * 2);
                ctx.fill();
            }

            if (level === 1) {
                drawTownBackground(ctx);
            } else {
                drawForestBackground(ctx);
            }

            ctx.fillStyle = level === 1 ? '#27ae60' : '#2d6a2a';
            ctx.fillRect(0, skyHeight, worldWidth, GROUND_HEIGHT);
            ctx.fillStyle = level === 1 ? '#1e8449' : '#1e4a1a';
            let patternWidth = 40;
            for (let i = 0; i < worldWidth / patternWidth + 5; i++) {
                ctx.fillRect(i * patternWidth, skyHeight + 25, 4, 30);
                ctx.fillRect(i * patternWidth + 12, skyHeight + 65, 4, 20);
            }
        }

        // --------------------------------------------------------------
        // YARDIMCI FONKSİYONLAR (çizimler)
        // --------------------------------------------------------------
        function drawStuckArrows(ctx, unit) {
            if (!unit.stuckArrows || unit.stuckArrows.length === 0) return;
            for (let i = unit.stuckArrows.length - 1; i >= 0; i--) {
                const a = unit.stuckArrows[i];
                a.life--;
                if (a.life <= 0) {
                    unit.stuckArrows.splice(i, 1);
                    continue;
                }
                ctx.save();
                ctx.translate(unit.x + a.ox, unit.y + a.oy);
                ctx.rotate(a.angle);
                ctx.globalAlpha = Math.min(1, a.life / 60);
                ctx.strokeStyle = '#ecf0f1';
                ctx.lineWidth = 1.8;
                ctx.beginPath();
                ctx.moveTo(-8, 0);
                ctx.lineTo(6, 0);
                ctx.stroke();
                ctx.fillStyle = '#bdc3c7';
                ctx.beginPath();
                ctx.moveTo(6, 0);
                ctx.lineTo(1, -2.5);
                ctx.lineTo(1, 2.5);
                ctx.fill();
                ctx.restore();
            }
        }

        function spawnMiningSparks(x, y) {
            for (let i = 0; i < 12; i++) {
                const angle = (Math.PI * 1.2) + (Math.random() - 0.5) * 1.4;
                const speed = 2.5 + Math.random() * 4;
                miningSparks.push({
                    x: x + (Math.random() - 0.5) * 10,
                    y: y + (Math.random() - 0.5) * 6,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed - 1.5,
                    life: 18 + Math.random() * 12,
                    maxLife: 30,
                    size: 2 + Math.random() * 3
                });
            }
        }

        function updateMiningSparks() {
            for (let i = miningSparks.length - 1; i >= 0; i--) {
                const s = miningSparks[i];
                s.x += s.vx;
                s.y += s.vy;
                s.vy += 0.18;
                s.life--;
                if (s.life <= 0) miningSparks.splice(i, 1);
            }
        }

        function drawMiningSparks(ctx) {
            miningSparks.forEach(s => {
                const alpha = Math.max(0, s.life / s.maxLife);
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = alpha > 0.6 ? '#fff9c4' : '#f1c40f';
                ctx.beginPath();
                ctx.arc(s.x, s.y, s.size * alpha, 0, Math.PI * 2);
                ctx.fill();
                if (alpha > 0.4) {
                    ctx.globalAlpha = alpha * 0.35;
                    ctx.fillStyle = '#f39c12';
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.size * 2.5, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.restore();
            });
        }

        function drawMinerBackpack(ctx, x, y, isFlipped, bagGold, inHand = false) {
            ctx.save();
            ctx.translate(x, y);
            if (isFlipped) ctx.scale(-1, 1);

            const cx = inHand ? 0 : -18;
            const cy = inHand ? 0 : -18;

            ctx.fillStyle = '#2c2c2c';
            ctx.beginPath();
            ctx.moveTo(cx - 10, cy + 8);
            ctx.quadraticCurveTo(cx - 14, cy - 6, cx - 4, cy - 16);
            ctx.lineTo(cx + 10, cy - 14);
            ctx.quadraticCurveTo(cx + 16, cy - 4, cx + 12, cy + 10);
            ctx.quadraticCurveTo(cx, cy + 14, cx - 10, cy + 8);
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = '#1f1f1f';
            ctx.beginPath();
            ctx.ellipse(cx + 1, cy - 12, 9, 4, -0.15, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#6d4c2b';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(cx - 6, cy - 10);
            ctx.quadraticCurveTo(cx - 2, cy - 22, cx + 8, cy - 12);
            ctx.stroke();

            const crystalCount = Math.min(6, Math.max(0, bagGold | 0));
            const crystalColors = ['#5dade2', '#f1c40f', '#85c1e9', '#f39c12', '#3498db', '#e67e22'];
            for (let i = 0; i < crystalCount; i++) {
                const ox = (i % 3) * 5 - 4;
                const oy = -14 - Math.floor(i / 3) * 7 - (i % 2) * 2;
                ctx.fillStyle = crystalColors[i % crystalColors.length];
                ctx.beginPath();
                ctx.moveTo(cx + ox, cy + oy - 6);
                ctx.lineTo(cx + ox + 3, cy + oy);
                ctx.lineTo(cx + ox, cy + oy + 3);
                ctx.lineTo(cx + ox - 3, cy + oy);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        }

        function drawStickman(ctx, x, y, color, weapon, animFrame, isWalking, isFlipped = false, swingAngle = 0, bodyLean = 0,
            armRaise = 0, holdingRock = false, isMinerStyle = false, isPlayerFace = true
        ) {
            ctx.save();
            ctx.translate(x, y);
            if (isFlipped) ctx.scale(-1, 1);
            ctx.strokeStyle = color;
            ctx.lineWidth = isMinerStyle ? 4 : 3.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const isMining = (weapon === 'pickaxe' && animFrame > 0);
            const isClimbing = (weapon === 'climb');

            const leanX = isMining ? bodyLean * 10 : 0;
            const leanY = isMining ? bodyLean * 4 : 0;
            const isClub = (weapon === 'club');

            const hipX = 0;
            const hipY = -12;
            const shoulderX = leanX * 0.85;
            const shoulderY = isClub ? (-36 + leanY * 0.4) : (-32 + leanY * 0.55);

            let headR = isMinerStyle ? 11 : (isClub ? 9 : 7.5);
            let hx = isMining ? leanX + bodyLean * 2 : shoulderX;
            let hy = shoulderY - headR + 1;
            if (isMining && bodyLean > 0.6) {
                hx = leanX + 6;
                hy = shoulderY - headR + 4;
            }

            const faceImg = isPlayerFace ? minerFaceImg : minerFaceEnemyImg;
            if (isMinerStyle && faceImg && faceImg.complete && faceImg.naturalWidth > 0) {
                const faceSize = 24;
                ctx.drawImage(faceImg, hx - faceSize / 2, hy - faceSize / 2, faceSize, faceSize);
            } else {
                ctx.beginPath();
                ctx.arc(hx, hy, headR, 0, Math.PI * 2);
                ctx.fillStyle = color;
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = isClub ? 6.5 : (isMinerStyle ? 5 : 3.2);
            ctx.beginPath();
            ctx.moveTo(hipX, hipY);
            ctx.lineTo(shoulderX, shoulderY);
            ctx.lineTo(hx, hy + headR - 1);
            ctx.stroke();

            const walkPhase = frames * (isClub ? 0.32 : 0.20);
            const stride = isClub ? 14 : 10;
            const legSwing = isWalking ? Math.sin(walkPhase) * stride : 0;
            const legSwing2 = isWalking ? Math.sin(walkPhase + Math.PI) * stride : 0;
            const legSpread = isMining ? 3 + bodyLean * 5 : 0;
            ctx.lineWidth = isClub ? 5.5 : (isMinerStyle ? 4.5 : 3.2);
            ctx.lineCap = 'round';
            ctx.beginPath();
            if (isClimbing) {
                let climbLeg = Math.sin(animFrame * 0.2) * 8;
                ctx.moveTo(hipX, hipY);
                ctx.lineTo(-8, -5 + climbLeg);
                ctx.moveTo(hipX, hipY);
                ctx.lineTo(8, -5 - climbLeg);
            } else if (isWalking) {
                const L = legSwing;
                const R = legSwing2;
                ctx.moveTo(hipX, hipY);
                ctx.lineTo(-3 + L * 0.4, -5);
                ctx.lineTo(-4 + L, 2);
                ctx.moveTo(hipX, hipY);
                ctx.lineTo(3 + R * 0.4, -5);
                ctx.lineTo(4 + R, 2);
            } else {
                ctx.moveTo(hipX, hipY);
                ctx.lineTo(-7 - legSpread, 2);
                ctx.moveTo(hipX, hipY);
                ctx.lineTo(7 + legSpread * 0.5, 2);
            }
            ctx.stroke();

            if (isClimbing) {
                let climbArm = Math.sin(animFrame * 0.2) * 12;
                ctx.beginPath();
                ctx.moveTo(0, -28);
                ctx.lineTo(-12, -48 + climbArm);
                ctx.moveTo(0, -28);
                ctx.lineTo(12, -48 - climbArm);
                ctx.stroke();
            } else {
                let armRot = 0;
                let backArmRot = 0;

                if (isMining) {
                    armRot = -50 + (1 - armRaise) * 100 + swingAngle * 25;
                    backArmRot = 5;
                } else if (weapon === 'club') {
                    if (animFrame > 0) {
                        if (animFrame < 30) {
                            const t = animFrame / 30;
                            armRot = -40 - t * 50;
                        } else if (animFrame < 55) {
                            const t = (animFrame - 30) / 25;
                            armRot = -90 + t * 140;
                        } else {
                            const t = Math.min(1, (animFrame - 55) / 45);
                            armRot = 50 - t * 85;
                        }
                        backArmRot = 25;
                    } else {
                        armRot = -35 + (isWalking ? Math.sin(frames * 0.22) * 8 : 0);
                        backArmRot = 20 + (isWalking ? Math.sin(frames * 0.22 + Math.PI) * 10 : 0);
                    }
                } else if (weapon === 'bow') {
                    armRot = -78;
                    backArmRot = -15 - swingAngle * 45;
                } else if (isWalking) {
                    armRot = Math.sin(frames * 0.22) * 25;
                    backArmRot = Math.sin(frames * 0.22 + Math.PI) * 25;
                }

                let backHandX, backHandY, handX, handY;
                if (weapon === 'club') {
                    backHandX = shoulderX - 8;
                    backHandY = shoulderY + 12;
                    const swingT = animFrame > 30 && animFrame < 55 ? (animFrame - 30) / 25 : 0;
                    const reach = 12 + swingT * 14;
                    const rad = armRot * Math.PI / 180;
                    handX = shoulderX + 4 + Math.sin(rad) * reach * 0.4 + swingT * 10;
                    handY = shoulderY + 6 - Math.cos(rad) * 8;
                } else if (isMining) {
                    backHandX = shoulderX - 8;
                    backHandY = shoulderY + 14;
                    const reach = 18 + (1 - armRaise) * 16;
                    handX = shoulderX + reach * Math.sin((armRot + 30) * Math.PI / 180) + 6;
                    handY = shoulderY + 2 - reach * 0.45 * Math.cos(armRot * Math.PI / 180) - armRaise * 6;
                } else if (weapon === 'bow') {
                    handX = shoulderX + 15;
                    handY = shoulderY - 3;
                    backHandX = shoulderX - 4 - swingAngle * 11;
                    backHandY = shoulderY + 5;
                } else {
                    backHandX = shoulderX - 10 + backArmRot / 5;
                    backHandY = shoulderY + 6 + bodyLean * 10;
                    const reach = 10;
                    handX = shoulderX + reach * Math.sin((armRot + 20) * Math.PI / 180);
                    handY = shoulderY + 8 - reach * 0.7 * Math.cos((armRot) * Math.PI / 180) - armRaise * 10;
                }
                ctx.beginPath();
                ctx.moveTo(shoulderX, shoulderY);
                ctx.lineTo(backHandX, backHandY);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(shoulderX, shoulderY);
                ctx.lineTo(handX, handY);
                ctx.stroke();

                if (weapon === 'pickaxe') {
                    ctx.save();
                    ctx.translate(handX, handY);
                    const pickAngle = (-1.0 + (1 - armRaise) * 1.4) + swingAngle * 0.25;
                    ctx.rotate(pickAngle);

                    ctx.strokeStyle = '#a0522d';
                    ctx.lineWidth = 3.2;
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -28);
                    ctx.stroke();

                    ctx.strokeStyle = '#4a4a4a';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(-13, -26);
                    ctx.lineTo(13, -26);
                    ctx.stroke();
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.moveTo(-13, -26);
                    ctx.lineTo(-16, -18);
                    ctx.moveTo(13, -26);
                    ctx.lineTo(16, -18);
                    ctx.stroke();
                    ctx.restore();
                } else if (weapon === 'club') {
                    const swingT = animFrame > 30 && animFrame < 55 ? (animFrame - 30) / 25 : 0;
                    const clubLen = 30 + swingT * 12;
                    ctx.save();
                    ctx.translate(handX, handY);
                    const clubAngle = (-0.5 + armRot * 0.014) + swingT * 0.3;
                    ctx.rotate(clubAngle);

                    ctx.strokeStyle = color;
                    ctx.lineWidth = 6;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -clubLen);
                    ctx.stroke();

                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.ellipse(0, -clubLen - 2, 5, 7, 0, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.fillStyle = '#ecf0f1';
                    const tip = -clubLen;
                    const spikes = [
                        [-6, tip + 2],
                        [6, tip + 2],
                        [-7, tip - 4],
                        [7, tip - 4],
                        [-5, tip - 8],
                        [5, tip - 8],
                        [0, tip - 12]
                    ];
                    spikes.forEach(([sx, sy]) => {
                        ctx.beginPath();
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(sx * 0.3, sy + 5);
                        ctx.lineTo(sx + (sx > 0 ? 2 : -2), sy + 2);
                        ctx.closePath();
                        ctx.fill();
                    });
                    ctx.restore();
                } else if (weapon === 'bow') {
                    ctx.save();
                    ctx.translate(handX, handY);
                    const bowHalf = 15;
                    const drawT = Math.max(0, Math.min(1, swingAngle));
                    const pullX = -5 - drawT * 11;

                    ctx.strokeStyle = '#8b5a2b';
                    ctx.lineWidth = 2.6;
                    ctx.beginPath();
                    ctx.arc(0, 0, bowHalf, -Math.PI / 2, Math.PI / 2);
                    ctx.stroke();

                    ctx.strokeStyle = '#ecf0f1';
                    ctx.lineWidth = 1.3;
                    ctx.beginPath();
                    ctx.moveTo(0, -bowHalf);
                    ctx.lineTo(pullX, 0);
                    ctx.lineTo(0, bowHalf);
                    ctx.stroke();

                    ctx.strokeStyle = '#6d4c2f';
                    ctx.lineWidth = 1.8;
                    ctx.beginPath();
                    ctx.moveTo(pullX - 4, 0);
                    ctx.lineTo(pullX + 20, 0);
                    ctx.stroke();
                    ctx.fillStyle = '#95a5a6';
                    ctx.beginPath();
                    ctx.moveTo(pullX + 20, 0);
                    ctx.lineTo(pullX + 14, -3);
                    ctx.lineTo(pullX + 14, 3);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#e74c3c';
                    ctx.lineWidth = 1.6;
                    ctx.beginPath();
                    ctx.moveTo(pullX - 4, -3);
                    ctx.lineTo(pullX + 1, 0);
                    ctx.lineTo(pullX - 4, 3);
                    ctx.stroke();
                    ctx.restore();
                }
            }
            ctx.restore();
        }

        function drawBase(ctx, isPlayer) {
            let b = isPlayer ? player.base : enemy.base;
            let bx = b.x;
            let by = b.y;

            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath();
            ctx.ellipse(bx, by + 30, 70, 18, 0, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = isPlayer ? '#bdc3c7' : '#34495e';
            ctx.fillRect(bx - 35, by - 140, 70, 170);
            ctx.fillStyle = isPlayer ? '#ecf0f1' : '#2c3e50';
            ctx.beginPath();
            ctx.arc(bx, by - 160, 45, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#c0392b';
            ctx.fillRect(bx - 45, by - 220, 90, 12);
            ctx.fillStyle = '#2ecc71';
            ctx.fillRect(bx - 45, by - 220, 90 * (b.hp / b.maxHp), 12);
            ctx.fillStyle = '#fff';
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(Math.floor(b.hp) + "/" + b.maxHp, bx, by - 210);
        }

        function drawMines(ctx) {
            let allSlots = [...playerMineSlots, ...enemyMineSlots];
            allSlots.forEach(slot => {
                let mx = slot.x;
                let my = slot.y;

                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                ctx.beginPath();
                ctx.ellipse(mx, my + 12, 28, 9, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = '#6b7280';
                ctx.beginPath();
                ctx.ellipse(mx, my + 2, 26, 16, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#4b5563';
                ctx.beginPath();
                ctx.ellipse(mx - 4, my + 4, 14, 10, -0.2, 0, Math.PI * 2);
                ctx.fill();

                let crystals = [
                    { x: -10, y: -6, w: 7, h: 16, rot: -0.25 },
                    { x: -1, y: -10, w: 8, h: 20, rot: 0.05 },
                    { x: 9, y: -5, w: 7, h: 15, rot: 0.3 }
                ];
                crystals.forEach(c => {
                    ctx.save();
                    ctx.translate(mx + c.x, my + c.y);
                    ctx.rotate(c.rot);
                    ctx.fillStyle = '#f1c40f';
                    ctx.fillRect(-c.w / 2, -c.h, c.w, c.h);
                    ctx.beginPath();
                    ctx.moveTo(-c.w / 2, -c.h);
                    ctx.lineTo(0, -c.h - 5);
                    ctx.lineTo(c.w / 2, -c.h);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#f7dc6f';
                    ctx.fillRect(-c.w / 4, -c.h + 2, c.w / 2, c.h * 0.4);
                    ctx.restore();
                });
            });
        }

        // --------------------------------------------------------------
        // OYUN MANTIĞI
        // --------------------------------------------------------------
        const keys = {};
        document.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true;
            handleKeyPress(e.key.toLowerCase()); });
        document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

        let weaponIndex = 0;
        const weapons = ['pickaxe', 'club', 'bow'];

        function handleKeyPress(key) {
            if (key === 'q') {
                weaponIndex = (weaponIndex + 1) % weapons.length;
                player.weapon = weapons[weaponIndex];
                document.getElementById('playerWeapon').textContent =
                    player.weapon === 'pickaxe' ? 'Kazma' :
                    player.weapon === 'club' ? 'Sopa' : 'Yay';
            }
            if (key === 'f') {
                if (player.attackCooldown <= 0) {
                    player.isAttacking = true;
                    player.attackTimer = 40;
                    player.attackCooldown = 20;
                    if (player.weapon === 'bow') {
                        const angle = player.isFlipped ? -0.2 : 0.2;
                        enemy.stuckArrows.push({
                            ox: 10,
                            oy: -10,
                            angle: angle,
                            life: 120
                        });
                    }
                }
            }
            if (key === 'e') {
                player.isMining = true;
                player.miningTimer = 30;
            }
        }

        function updateUnit(unit, isPlayer) {
            const skyHeight = canvas.height - GROUND_HEIGHT;

            unit.vy += GRAVITY;
            unit.x += unit.vx;
            unit.y += unit.vy;

            if (unit.y + unit.h / 2 >= skyHeight) {
                unit.y = skyHeight - unit.h / 2;
                unit.vy = 0;
                unit.isGrounded = true;
            } else {
                unit.isGrounded = false;
            }

            if (unit.x < 20) unit.x = 20;
            if (unit.x > worldWidth - 20) unit.x = worldWidth - 20;

            let moving = false;
            if (isPlayer) {
                if (keys['a']) { unit.vx = -unit.speed;
                    unit.isFlipped = true;
                    moving = true; }
                if (keys['d']) { unit.vx = unit.speed;
                    unit.isFlipped = false;
                    moving = true; }
                if (!keys['a'] && !keys['d']) { unit.vx *= 0.85; if (Math.abs(unit.vx) < 0.1) unit.vx = 0; }
                if (keys['w'] && unit.isGrounded) { unit.vy = -8;
                    unit.isGrounded = false; }
            } else {
                unit.decisionTimer--;
                if (unit.decisionTimer <= 0) {
                    unit.decisionTimer = 60 + Math.floor(Math.random() * 90);
                    const r = Math.random();
                    if (r < 0.4) {
                        unit.state = 'chase';
                        unit.targetX = player.x + (Math.random() - 0.5) * 150;
                    } else if (r < 0.7 && enemyMineSlots.some(s => s.active && s.gold > 0)) {
                        unit.state = 'mine';
                        const valid = enemyMineSlots.filter(s => s.active && s.gold > 0);
                        if (valid.length > 0) {
                            const slot = valid[Math.floor(Math.random() * valid.length)];
                            unit.targetX = slot.x;
                            unit.targetY = slot.y;
                        }
                    } else {
                        unit.state = 'idle';
                        unit.targetX = unit.x + (Math.random() - 0.5) * 200;
                    }
                }

                const dx = unit.targetX - unit.x;
                if (Math.abs(dx) > 10) {
                    unit.vx = Math.sign(dx) * unit.speed * 0.6;
                    unit.isFlipped = dx < 0;
                    moving = true;
                } else {
                    unit.vx *= 0.9;
                    if (Math.abs(unit.vx) < 0.1) unit.vx = 0;
                }

                if (unit.state === 'mine') {
                    const nearSlot = enemyMineSlots.find(s =>
                        s.active && s.gold > 0 && Math.abs(s.x - unit.x) < 40
                    );
                    if (nearSlot && unit.isGrounded) {
                        unit.isMining = true;
                        unit.miningTimer = 25;
                    }
                }
            }

            unit.isWalking = moving && unit.isGrounded;

            if (unit.attackCooldown > 0) unit.attackCooldown--;
            if (unit.isAttacking) {
                unit.attackTimer--;
                if (unit.attackTimer <= 0) unit.isAttacking = false;
            }

            if (unit.isMining) {
                unit.miningTimer--;
                if (unit.miningTimer <= 0) {
                    unit.isMining = false;
                    unit.miningTimer = 0;
                    const slots = isPlayer ? playerMineSlots : enemyMineSlots;
                    const nearSlot = slots.find(s => s.active && s.gold > 0 && Math.abs(s.x - unit.x) < 40);
                    if (nearSlot) {
                        const goldMined = Math.min(5, nearSlot.gold);
                        nearSlot.gold -= goldMined;
                        unit.gold += goldMined;
                        spawnMiningSparks(nearSlot.x, nearSlot.y - 10);
                        if (nearSlot.gold <= 0) {
                            nearSlot.active = false;
                            nearSlot.respawnTimer = 200;
                        }
                        if (isPlayer) {
                            document.getElementById('playerGold').textContent = unit.gold;
                        }
                    }
                }
            }

            if (moving) unit.animFrame++;
        }

        function updateEnemyMines() {
            enemyMineSlots.forEach(s => {
                if (!s.active) {
                    s.respawnTimer--;
                    if (s.respawnTimer <= 0) {
                        s.active = true;
                        s.gold = s.maxGold;
                        s.respawnTimer = 0;
                    }
                }
            });
            playerMineSlots.forEach(s => {
                if (!s.active) {
                    s.respawnTimer--;
                    if (s.respawnTimer <= 0) {
                        s.active = true;
                        s.gold = s.maxGold;
                        s.respawnTimer = 0;
                    }
                }
            });
        }

        function update() {
            frames++;

            updateUnit(player, true);
            updateUnit(enemy, false);
            updateMiningSparks();
            updateEnemyMines();

            if (enemy.isAttacking && enemy.attackTimer > 20) {
                if (Math.abs(enemy.x - player.x) < 50 && Math.abs(enemy.y - player.y) < 40) {
                    player.hp -= 0.5;
                    if (player.hp < 0) player.hp = 0;
                    document.getElementById('playerHp').textContent = Math.floor(player.hp);
                }
            }

            if (player.isAttacking && player.attackTimer > 20) {
                if (Math.abs(player.x - enemy.x) < 50 && Math.abs(player.y - enemy.y) < 40) {
                    enemy.hp -= 0.8;
                    if (enemy.hp < 0) enemy.hp = 0;
                    document.getElementById('enemyHp').textContent = Math.floor(enemy.hp);
                }
            }

            if (enemy.hp <= 0 && level === 1) {
                level = 2;
                document.getElementById('levelDisplay').textContent = '🌲 Bölüm 2';
                enemy.hp = 150;
                enemy.maxHp = 150;
                enemy.x = 850;
                enemy.y = 0;
                document.getElementById('enemyHp').textContent = enemy.hp;
                enemyMineSlots.forEach(s => { s.active = true;
                    s.gold = s.maxGold; });
            }

            if (player.hp <= 0) {
                ctx.fillStyle = 'rgba(0,0,0,0.7)';
                ctx.fillRect(0, 0, worldWidth, canvas.height);
                ctx.fillStyle = '#e74c3c';
                ctx.font = 'bold 48px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('💀 ÖLDÜN!', worldWidth / 2, canvas.height / 2 - 20);
                ctx.fillStyle = '#fff';
                ctx.font = '20px Arial';
                ctx.fillText('Sayfayı yenileyip tekrar dene', worldWidth / 2, canvas.height / 2 + 40);
                return;
            }

            if (enemy.hp <= 0 && level === 2) {
                enemy.hp = 150;
                enemy.maxHp = 150;
                enemy.x = 850;
                enemy.y = 0;
                document.getElementById('enemyHp').textContent = enemy.hp;
                enemyMineSlots.forEach(s => { s.active = true;
                    s.gold = s.maxGold; });
            }
        }

        // --------------------------------------------------------------
        // ÇİZİM
        // --------------------------------------------------------------
        function draw() {
            ctx.clearRect(0, 0, worldWidth, canvas.height);

            drawEnvironment(ctx);
            drawMines(ctx);
            drawMiningSparks(ctx);

            drawBase(ctx, true);
            drawBase(ctx, false);

            drawMinerBackpack(ctx, player.x - 25, player.y - 18, player.isFlipped, player.gold, false);
            drawMinerBackpack(ctx, enemy.x + 25, enemy.y - 18, enemy.isFlipped, enemy.gold, false);

            drawStickman(ctx, player.x, player.y, '#3498db', player.weapon,
                player.animFrame, player.isWalking, player.isFlipped,
                player.swingAngle, player.bodyLean, player.armRaise,
                false, true, true
            );
            drawStuckArrows(ctx, player);

            drawStickman(ctx, enemy.x, enemy.y, '#e74c3c', enemy.weapon,
                enemy.animFrame, enemy.isWalking, enemy.isFlipped,
                enemy.swingAngle, enemy.bodyLean, enemy.armRaise,
                false, true, false
            );
            drawStuckArrows(ctx, enemy);

            document.getElementById('playerHp').textContent = Math.floor(player.hp);
            document.getElementById('enemyHp').textContent = Math.floor(enemy.hp);
            document.getElementById('playerGold').textContent = player.gold;
        }

        // --------------------------------------------------------------
        // OYUN DÖNGÜSÜ
        // --------------------------------------------------------------
        function gameLoop() {
            update();
            draw();
            requestAnimationFrame(gameLoop);
        }

        function init() {
            const skyHeight = canvas.height - GROUND_HEIGHT;
            player.y = skyHeight - player.h / 2;
            enemy.y = skyHeight - enemy.h / 2;
            player.base.y = skyHeight;
            enemy.base.y = skyHeight;
            playerMineSlots.forEach(s => s.y = skyHeight - 8);
            enemyMineSlots.forEach(s => s.y = skyHeight - 8);
            enemy.decisionTimer = 60;

            document.getElementById('playerHp').textContent = player.hp;
            document.getElementById('enemyHp').textContent = enemy.hp;
            document.getElementById('playerGold').textContent = player.gold;
        }

        init();
        gameLoop();

        function resizeCanvas() {
            const container = document.getElementById('gameContainer');
            const maxWidth = window.innerWidth - 20;
            const maxHeight = window.innerHeight - 20;
            const ratio = 1000 / 600;
            let w = maxWidth;
            let h = w / ratio;
            if (h > maxHeight) {
                h = maxHeight;
                w = h * ratio;
            }
            canvas.style.width = w + 'px';
            canvas.style.height = h + 'px';
        }
        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();
    </script>

</body>
</html>
