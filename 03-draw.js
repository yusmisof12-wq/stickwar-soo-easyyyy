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

function drawStickman(ctx, x, y, color, weapon, animFrame, isWalking, isFlipped = false, swingAngle = 0, bodyLean = 0, armRaise = 0, holdingRock = false, isMinerStyle = false, isPlayerFace = true) {
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
                [-6, tip + 2], [6, tip + 2], [-7, tip - 4], [7, tip - 4],
                [-5, tip - 8], [5, tip - 8], [0, tip - 12]
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
function drawEnvironment(ctx) {
    let w = typeof worldWidth !== 'undefined' ? worldWidth : canvas.width * 2;
    let skyHeight = canvas.height - (typeof GROUND_HEIGHT !== 'undefined' ? GROUND_HEIGHT : 100);
    let t = typeof frames !== 'undefined' ? frames : 0;

    // 1. Gökyüzü Gradiyanı (Huzurlu Şafak / Akşamüstü Tonları)
    let skyGrad = ctx.createLinearGradient(0, 0, 0, skyHeight);
    skyGrad.addColorStop(0, '#f8c471');
    skyGrad.addColorStop(0.5, '#f39c12');
    skyGrad.addColorStop(1, '#e67e22');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, skyHeight);

    // Güneş
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    ctx.arc(w * 0.2, skyHeight * 0.25, 130, 0, Math.PI * 2);
    ctx.fill();

    // Harita boyunca kusursuz tekrar eden segmentler (Kasaba, Değirmen ve Sular)
    let segW = 1400;
    let count = Math.ceil(w / segW) + 1;

    for (let i = 0; i < count; i++) {
        let ox = i * segW;

        // 2. Arka Ufuk Tepeleri
        ctx.fillStyle = '#7d6608';
        ctx.beginPath();
        ctx.moveTo(ox, skyHeight - 80);
        ctx.quadraticCurveTo(ox + 350, skyHeight - 160, ox + 700, skyHeight - 90);
        ctx.quadraticCurveTo(ox + 1050, skyHeight - 140, ox + segW, skyHeight - 80);
        ctx.lineTo(ox + segW, skyHeight);
        ctx.lineTo(ox, skyHeight);
        ctx.fill();

        // 3. Arka Planı Kaplayan Geniş Su / Göl Alanı
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(ox, skyHeight - 75, segW, 45);

        // Suyun Üzerindeki Dalga / Işık Animasyonları
        ctx.fillStyle = '#85c1e9';
        ctx.globalAlpha = 0.6;
        let waveAnim = (t * 0.4) % 150;
        ctx.fillRect(ox + 100 + waveAnim, skyHeight - 55, 60, 3);
        ctx.fillRect(ox + 500 + waveAnim, skyHeight - 45, 90, 2.5);
        ctx.fillRect(ox + 950 + waveAnim, skyHeight - 60, 70, 3);
        ctx.globalAlpha = 1.0;

        // 4. Su Değirmeni (Suyun kenarında konumlandırılmış ve hareketli çarklı)
        let millX = ox + 220;
        let millY = skyHeight - 65;

        // Değirmen Binası
        ctx.fillStyle = '#b9770e';
        ctx.fillRect(millX, millY - 45, 40, 45);
        // Değirmen Çatısı
        ctx.fillStyle = '#922b21';
        ctx.beginPath();
        ctx.moveTo(millX - 5, millY - 45);
        ctx.lineTo(millX + 20, millY - 70);
        ctx.lineTo(millX + 45, millY - 45);
        ctx.closePath();
        ctx.fill();

        // Su Değirmeni Çarkı (Animasyonlu Dönen Tekerlek)
        ctx.save();
        let wheelX = millX - 12;
        let wheelY = millY - 20;
        ctx.translate(wheelX, wheelY);
        let wheelAngle = t * 0.03; // Dönüş hızı
        ctx.rotate(wheelAngle);
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.stroke();
        // Çark Kanatları
        for (let wRot = 0; wRot < Math.PI * 2; wRot += Math.PI / 2) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(wRot) * 16, Math.sin(wRot) * 16);
            ctx.stroke();
        }
        ctx.restore();

        // 5. Toprak Yollar (Kasaba içi bağlantılar)
        ctx.fillStyle = '#b09062';
        ctx.beginPath();
        ctx.moveTo(ox + 350, skyHeight - 30);
        ctx.quadraticCurveTo(ox + 600, skyHeight - 15, ox + 950, skyHeight - 30);
        ctx.lineTo(ox + 900, skyHeight);
        ctx.lineTo(ox + 400, skyHeight);
        ctx.closePath();
        ctx.fill();

        // 6. Düzenli Kasaba Evleri (Orta Alanda Sıralı)
        let housePositions = [ox + 480, ox + 620, ox + 760];
        housePositions.forEach((hx, index) => {
            let hy = skyHeight - 35;
            // Ev Gövdesi
            ctx.fillStyle = index === 1 ? '#d35400' : '#d5d8dc';
            ctx.fillRect(hx, hy - 35, 45, 35);
            // Ev Çatısı
            ctx.fillStyle = '#78281f';
            ctx.beginPath();
            ctx.moveTo(hx - 5, hy - 35);
            ctx.lineTo(hx + 22, hy - 55);
            ctx.lineTo(hx + 50, hy - 35);
            ctx.closePath();
            ctx.fill();
            // Kapı ve Pencereler
            ctx.fillStyle = '#5d4037';
            ctx.fillRect(hx + 17, hy - 20, 12, 20);
            ctx.fillStyle = '#f9e79f';
            ctx.fillRect(hx + 5, hy - 28, 9, 9);
            ctx.fillRect(hx + 31, hy - 28, 9, 9);
        });

        // 7. Ağaçlar ve Bitkiler (Doğal Çeşitlilik)
        ctx.fillStyle = '#1e8449';
        let treePositions = [
            ox + 80, ox + 140, 
            ox + 420, ox + 570, ox + 850, ox + 920, 
            ox + 1150, ox + 1280
        ];
        
        treePositions.forEach((tx, idx) => {
            // Ağaç Gövdesi
            ctx.fillStyle = '#784212';
            ctx.fillRect(tx - 3, skyHeight - 45, 6, 20);
            // Ağaç Yaprakları (Çam veya Yuvarlak)
            ctx.fillStyle = idx % 2 === 0 ? '#196f3d' : '#27ae60';
            ctx.beginPath();
            ctx.arc(tx, skyHeight - 50, 16, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    // 8. Ön Plan (Savaş Alanı Zemin Katmanı)
    ctx.fillStyle = '#548235'; 
    ctx.fillRect(0, skyHeight, w, typeof GROUND_HEIGHT !== 'undefined' ? GROUND_HEIGHT : 100);
    
    // Çim Desenleri
    ctx.fillStyle = '#385723'; 
    let patternWidth = 40;
    for (let i = 0; i < w / patternWidth + 5; i++) {
        ctx.fillRect(i * patternWidth, skyHeight + 25, 4, 30);
        ctx.fillRect(i * patternWidth + 12, skyHeight + 65, 4, 20);
    }
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

function draw() {
    if (!ctx || !canvas) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(-cameraX, 0);
    
    drawEnvironment(ctx);
    drawMines(ctx);
    drawBase(ctx, true);
    drawBase(ctx, false);
    
    units.forEach(u => {
        if (u && typeof u.draw === 'function') u.draw(ctx);
    });
    
    projectiles.forEach(p => {
        if (p && typeof p.draw === 'function') p.draw(ctx);
    });
    
    drawMiningSparks(ctx);
    
    floatingTexts.forEach(f => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, (f.life || 0) / 60));
        ctx.fillStyle = f.color || '#f1c40f';
        ctx.font = (f.isBig ? 'bold 22px' : 'bold 14px') + ' Arial';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
    });
    
    retreatArchers.forEach(a => {
        if (a && typeof a.draw === 'function') a.draw(ctx);
    });
    
    ctx.restore();
}
