// ==================== 03-draw.js ====================
// Tüm çizim fonksiyonları burada toplanmıştır.

        
        // Orakçı — fotoğrafa yakın model, gerçek yürüme + vuruş animasyonu
        function drawSicklewrath(ctx, x, y, color, animFrame, isWalking, isFlipped) {
            ctx.save();
            ctx.translate(x, y);
            if (isFlipped) ctx.scale(-1, 1);

            const body = color || '#1a1a1a';
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            const walkPh = (typeof frames !== 'undefined' ? frames : 0) * 0.38;
            const legA = isWalking ? Math.sin(walkPh) * 11 : 0;
            const legB = isWalking ? Math.sin(walkPh + Math.PI) * 11 : 0;
            const bob = isWalking ? Math.abs(Math.sin(walkPh)) * 1.5 : 0;

            let swing = 0;
            let windup = 0;
            if (animFrame > 0) {
                if (animFrame < 28) {
                    windup = animFrame / 28;
                    swing = -0.35 * windup;
                } else if (animFrame < 52) {
                    const t = (animFrame - 28) / 24;
                    swing = -0.35 + t * 1.35;
                    windup = 1 - t;
                } else {
                    const t = Math.min(1, (animFrame - 52) / 40);
                    swing = 1.0 * (1 - t);
                }
            }

            const hipY = -10 + bob;
            const shoulderY = -34 + bob;
            const lean = swing * 4;
            const shoulderX = lean * 0.3;

            // Bacaklar
            ctx.strokeStyle = body;
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(0, hipY);
            ctx.lineTo(-5 + legA * 0.35, -2);
            ctx.lineTo(-6 + legA, 4);
            ctx.moveTo(0, hipY);
            ctx.lineTo(5 + legB * 0.35, -2);
            ctx.lineTo(7 + legB, 4);
            ctx.stroke();
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(-6 + legA, 4);
            ctx.lineTo(-10 + legA, 5);
            ctx.moveTo(7 + legB, 4);
            ctx.lineTo(11 + legB, 5);
            ctx.stroke();

            // Gövde
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(0, hipY);
            ctx.lineTo(shoulderX, shoulderY);
            ctx.stroke();

            // Kafa
            const headX = lean * 0.4;
            const headY = shoulderY - 11;
            ctx.fillStyle = body;
            ctx.beginPath();
            ctx.arc(headX, headY, 10, 0, Math.PI * 2);
            ctx.fill();

            // Yüz: 3 dikey pençe çizik (kullanıcı modeli)
            ctx.save();
            ctx.translate(headX, headY);
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(4, -7); ctx.lineTo(3, 8);
            ctx.moveTo(8, -9); ctx.lineTo(8, 10);
            ctx.moveTo(12, -6); ctx.lineTo(13, 6);
            ctx.stroke();
            ctx.restore();

            // Kollar
            const handX = 8 + lean + swing * 10;
            const handY = shoulderY + 10 - swing * 6 - windup * 4;
            const backHandX = 2 + lean * 0.5;
            const backHandY = shoulderY + 12 - windup * 2;

            ctx.strokeStyle = body;
            ctx.lineWidth = 6.5;
            ctx.beginPath();
            ctx.moveTo(shoulderX, shoulderY);
            ctx.lineTo(backHandX, backHandY);
            ctx.moveTo(shoulderX, shoulderY);
            ctx.lineTo(handX, handY);
            ctx.stroke();

            // Kol çizikleri (omuz → el, %35 noktasında)
            const armDX = handX - shoulderX;
            const armDY = handY - shoulderY;
            const armAng = Math.atan2(armDY, armDX);
            ctx.save();
            ctx.translate(shoulderX + armDX * 0.35, shoulderY + armDY * 0.35);
            ctx.rotate(armAng);
            ctx.strokeStyle = '#c0392b';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(-4, -4); ctx.lineTo(1, 2);
            ctx.moveTo(0, -4); ctx.lineTo(5, 2);
            ctx.moveTo(4, -4); ctx.lineTo(9, 2);
            ctx.stroke();
            ctx.restore();

            // Orak
            ctx.save();
            ctx.translate((handX + backHandX) / 2, (handY + backHandY) / 2);
            const baseAng = -0.95 + swing * 1.4 - windup * 0.3;
            ctx.rotate(baseAng);

            ctx.strokeStyle = '#2c2c2c';
            ctx.lineWidth = 4.5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, 11);
            ctx.lineTo(0, -14);
            ctx.stroke();
            ctx.strokeStyle = '#7f8c8d';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(0, 8);
            ctx.lineTo(0, 12);
            ctx.stroke();

            for (let i = 0; i < 5; i++) {
                const yy = 1 - i * 3.2;
                ctx.strokeStyle = i % 2 === 0 ? '#c0392b' : '#922b21';
                ctx.lineWidth = 6.5;
                ctx.beginPath();
                ctx.moveTo(-0.5, yy);
                ctx.lineTo(-0.5, yy - 2.8);
                ctx.stroke();
            }

            ctx.strokeStyle = '#95a5a6';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(4, -24, 19, -0.45 * Math.PI, 1.0 * Math.PI, false);
            ctx.stroke();
            ctx.strokeStyle = '#d5dbe0';
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(4, -24, 19, -0.42 * Math.PI, 0.95 * Math.PI, false);
            ctx.stroke();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.6;
            ctx.globalAlpha = 0.85;
            ctx.beginPath();
            ctx.arc(4, -24, 20.5, -0.4 * Math.PI, 0.55 * Math.PI, false);
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.fillStyle = '#ecf0f1';
            ctx.beginPath();
            ctx.moveTo(4 - 17, -30);
            ctx.lineTo(4 - 26, -38);
            ctx.lineTo(4 - 12, -32);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.25)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(4, -24, 16, -0.2 * Math.PI, 0.7 * Math.PI, false);
            ctx.stroke();

            ctx.restore();
            ctx.restore();
        }

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

        function updateMiningSparks() {
            if (!miningSparks || !miningSparks.length) return;
            for (let i = miningSparks.length - 1; i >= 0; i--) {
                const s = miningSparks[i];
                s.x += s.vx || 0;
                s.y += s.vy || 0;
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
            const isClub = (weapon === 'club' || weapon === 'sickle');
            const isSickle = (weapon === 'sickle');
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
                // Orakçı: yüzde 2 çizik (kafa içinde; düşman = siyah)
                if (isSickle) {
                    ctx.strokeStyle = isPlayerFace ? '#c0392b' : '#0a0a0a';
                    ctx.lineWidth = 1.8;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(hx + 1, hy - 2);
                    ctx.lineTo(hx + 5, hy - 3.5);
                    ctx.moveTo(hx + 1, hy + 2);
                    ctx.lineTo(hx + 5, hy + 0.5);
                    ctx.stroke();
                }
            }
            ctx.strokeStyle = color;
            ctx.lineWidth = isClub ? 6.5 : (isMinerStyle ? 5 : 3.2);
            ctx.beginPath();
            ctx.moveTo(hipX, hipY);
            ctx.lineTo(shoulderX, shoulderY);
            ctx.lineTo(hx, hy + headR - 1);
            ctx.stroke();
            // Orakçı: el/kol 2 çizik (omuz-el arası, silah kolu)
            // (el pozisyonu sonra belli olur — çizikler silah çiziminden sonra eklenir)
            const walkPhase = frames * (isClub ? 0.32 : 0.20);
            const stride = isClub ? 14 : 10;
            const legSwing = isWalking ? Math.sin(walkPhase) * stride : 0;
            const legSwing2 = isWalking ? Math.sin(walkPhase + Math.PI) * stride : 0;
            const legSpread = isMining ? 3 + bodyLean * 5 : 0;
            ctx.strokeStyle = color;
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
                if (weapon === 'sickle') {
                    // İki el sapta
                    const swingT = animFrame > 30 && animFrame < 55 ? (animFrame - 30) / 25 : 0;
                    const rad = armRot * Math.PI / 180;
                    const gx = shoulderX + 6 + swingT * 8 + Math.sin(rad) * 4;
                    const gy = shoulderY + 10 - swingT * 4;
                    handX = gx + 3;
                    handY = gy;
                    backHandX = gx - 4;
                    backHandY = gy + 3;
                } else if (weapon === 'club') {
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
                    const clubLen = 28 + swingT * 8;
                    ctx.save();
                    ctx.translate(handX, handY);
                    const clubAngle = (-0.5 + armRot * 0.014) + swingT * 0.3;
                    ctx.rotate(clubAngle);
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 5;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -clubLen);
                    ctx.stroke();
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.ellipse(0, -clubLen - 1, 4.5, 6, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#ecf0f1';
                    const tip = -clubLen;
                    [[-5, tip + 1], [5, tip + 1], [-6, tip - 4], [6, tip - 4], [-4, tip - 8], [4, tip - 8], [0, tip - 11]].forEach(([sx, sy]) => {
                        ctx.beginPath();
                        ctx.moveTo(sx, sy);
                        ctx.lineTo(sx * 0.25, sy + 4);
                        ctx.lineTo(sx + (sx > 0 ? 1.5 : -1.5), sy + 1.5);
                        ctx.closePath();
                        ctx.fill();
                    });
                    ctx.restore();
                } else if (weapon === 'sickle') {
                    // Orak resmi (orijinal sağa bakıyor; karakter isFlipped ile döner)
                    const swingT = animFrame > 30 && animFrame < 55 ? (animFrame - 30) / 25 : 0;
                    const gripX = (handX + backHandX) / 2;
                    const gripY = (handY + backHandY) / 2;
                    const img = typeof sickleWeaponImg !== 'undefined' ? sickleWeaponImg : null;
                    if (img && img.complete && img.naturalWidth > 0) {
                        const iw = 42 + swingT * 6;
                        const ih = iw * (img.naturalHeight / img.naturalWidth);
                        ctx.save();
                        ctx.translate(gripX, gripY);
                        // idle hafif açılı; vuruşta savrulma
                        const ang = -0.9 + armRot * 0.012 + swingT * 0.85;
                        ctx.rotate(ang);
                        // tutamak altta, bıçak yukarı-sağa (resim sağa bakıyor)
                        ctx.drawImage(img, -iw * 0.22, -ih * 0.55, iw, ih);
                        ctx.restore();
                    } else {
                        // yedek çizim
                        ctx.save();
                        ctx.translate(gripX, gripY);
                        ctx.rotate(-0.9 + swingT * 0.8);
                        ctx.strokeStyle = '#c0392b';
                        ctx.lineWidth = 5;
                        ctx.beginPath();
                        ctx.moveTo(0, 6);
                        ctx.lineTo(0, -12);
                        ctx.stroke();
                        ctx.strokeStyle = '#bdc3c7';
                        ctx.lineWidth = 4;
                        ctx.beginPath();
                        ctx.arc(4, -18, 14, -0.3 * Math.PI, 0.95 * Math.PI, false);
                        ctx.stroke();
                        ctx.restore();
                    }
                    // Elde 2 çizik (düşman = siyah)
                    ctx.strokeStyle = isPlayerFace ? '#c0392b' : '#0a0a0a';
                    ctx.lineWidth = 1.8;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(handX - 1, handY - 2);
                    ctx.lineTo(handX + 4, handY - 1);
                    ctx.moveTo(handX - 1, handY + 2);
                    ctx.lineTo(handX + 4, handY + 3);
                    ctx.stroke();
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

        // ============================================================
        // 1. BÖLÜM: açık tema  |  2. BÖLÜM: orman kampı  |  3. BÖLÜM: çöl pusu
        // ============================================================
        function drawEnvironment(ctx) {
            let w = typeof worldWidth !== 'undefined' ? worldWidth : canvas.width * 2;
            let skyHeight = canvas.height - (typeof GROUND_HEIGHT !== 'undefined' ? GROUND_HEIGHT : 100);
            let era = (typeof level !== 'undefined' && level >= 3) ? 3 : ((typeof level !== 'undefined' && level >= 2) ? 2 : 1);
            let t = typeof frames !== 'undefined' ? frames : 0;
            let segW = 1400;
            let count = Math.ceil(w / segW) + 1;

            if (era === 3) {
                // --- 3. BÖLÜM: ÇÖL PUSU / GÜN BATIMI ---
                const sunP = (typeof ambushTimer === 'number' && typeof AMBUSH_DURATION_FRAMES === 'number' && AMBUSH_DURATION_FRAMES > 0)
                    ? Math.min(1, ambushTimer / AMBUSH_DURATION_FRAMES) : 0;
                let skyGrad = ctx.createLinearGradient(0, 0, 0, skyHeight);
                skyGrad.addColorStop(0, sunP > 0.65 ? '#1a1028' : '#5c3d7a');
                skyGrad.addColorStop(0.35, sunP > 0.45 ? '#a04030' : '#e67e22');
                skyGrad.addColorStop(0.7, '#f39c12');
                skyGrad.addColorStop(1, '#f5d08a');
                ctx.fillStyle = skyGrad;
                ctx.fillRect(0, 0, w, skyHeight);

                const sunY = skyHeight * (0.2 + sunP * 0.6);
                const sunX = w * 0.55;
                ctx.fillStyle = 'rgba(255, 210, 100, 0.95)';
                ctx.beginPath();
                ctx.arc(sunX, sunY, 55 - sunP * 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(243, 156, 18, 0.22)';
                ctx.beginPath();
                ctx.arc(sunX, sunY, 120, 0, Math.PI * 2);
                ctx.fill();

                for (let i = 0; i < count; i++) {
                    let ox = i * segW;
                    ctx.fillStyle = '#d4a574';
                    ctx.beginPath();
                    ctx.moveTo(ox, skyHeight - 20);
                    ctx.quadraticCurveTo(ox + 300, skyHeight - 95, ox + 700, skyHeight - 30);
                    ctx.quadraticCurveTo(ox + 1100, skyHeight - 85, ox + segW, skyHeight - 25);
                    ctx.lineTo(ox + segW, skyHeight);
                    ctx.lineTo(ox, skyHeight);
                    ctx.fill();
                    ctx.fillStyle = '#c9956c';
                    ctx.beginPath();
                    ctx.moveTo(ox + 80, skyHeight - 10);
                    ctx.quadraticCurveTo(ox + 400, skyHeight - 55, ox + 900, skyHeight - 15);
                    ctx.lineTo(ox + 900, skyHeight);
                    ctx.lineTo(ox + 80, skyHeight);
                    ctx.fill();
                    [ox + 160, ox + 480, ox + 820, ox + 1150].forEach(cx => {
                        ctx.fillStyle = '#1e8449';
                        ctx.fillRect(cx - 6, skyHeight - 55, 12, 45);
                        ctx.fillRect(cx - 18, skyHeight - 40, 12, 8);
                        ctx.fillRect(cx - 18, skyHeight - 40, 6, 22);
                        ctx.fillRect(cx + 6, skyHeight - 34, 12, 8);
                        ctx.fillRect(cx + 12, skyHeight - 34, 6, 18);
                    });
                }
            } else if (era === 1) {
                let skyGrad = ctx.createLinearGradient(0, 0, 0, skyHeight);
                skyGrad.addColorStop(0, '#85c1e9');
                skyGrad.addColorStop(0.5, '#d4efdf');
                skyGrad.addColorStop(1, '#fcf3cf');
                ctx.fillStyle = skyGrad;
                ctx.fillRect(0, 0, w, skyHeight);
                ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.beginPath();
                ctx.arc(w * 0.25, skyHeight * 0.2, 110, 0, Math.PI * 2);
                ctx.fill();
                for (let i = 0; i < count; i++) {
                    let ox = i * segW;
                    ctx.fillStyle = '#52be80';
                    ctx.beginPath();
                    ctx.moveTo(ox, skyHeight - 70);
                    ctx.quadraticCurveTo(ox + 350, skyHeight - 140, ox + 700, skyHeight - 80);
                    ctx.quadraticCurveTo(ox + 1050, skyHeight - 120, ox + segW, skyHeight - 70);
                    ctx.lineTo(ox + segW, skyHeight);
                    ctx.lineTo(ox, skyHeight);
                    ctx.fill();
                    ctx.fillStyle = '#3498db';
                    ctx.fillRect(ox, skyHeight - 55, segW, 25);
                    ctx.fillStyle = '#ebf5fb';
                    ctx.globalAlpha = 0.7;
                    let waveAnim = (t * 0.5) % 160;
                    ctx.fillRect(ox + 150 + waveAnim, skyHeight - 45, 50, 2.5);
                    ctx.fillRect(ox + 600 + waveAnim, skyHeight - 40, 70, 2);
                    ctx.fillRect(ox + 1000 + waveAnim, skyHeight - 50, 60, 2.5);
                    ctx.globalAlpha = 1.0;
                    let millX = ox + 240;
                    let millY = skyHeight - 30;
                    ctx.fillStyle = '#784212';
                    ctx.fillRect(millX - 35, millY - 25, 40, 8);
                    ctx.fillStyle = '#909497';
                    ctx.fillRect(millX - 15, millY - 40, 45, 40);
                    ctx.fillStyle = '#ba4a00';
                    ctx.fillRect(millX - 15, millY - 75, 45, 35);
                    ctx.fillStyle = '#641e16';
                    ctx.beginPath();
                    ctx.moveTo(millX - 20, millY - 75);
                    ctx.lineTo(millX + 7, millY - 98);
                    ctx.lineTo(millX + 35, millY - 75);
                    ctx.closePath();
                    ctx.fill();
                    ctx.fillStyle = '#3e2723';
                    ctx.fillRect(millX + 2, millY - 25, 12, 25);
                    ctx.fillStyle = '#f9e79f';
                    ctx.fillRect(millX + 5, millY - 55, 10, 10);
                    ctx.save();
                    ctx.translate(millX - 22, millY - 20);
                    ctx.rotate(t * 0.035);
                    ctx.strokeStyle = '#5d4037';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.arc(0, 0, 18, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.lineWidth = 3;
                    for (let wRot = 0; wRot < Math.PI * 2; wRot += Math.PI / 3) {
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(Math.cos(wRot) * 18, Math.sin(wRot) * 18);
                        ctx.stroke();
                    }
                    ctx.restore();
                    ctx.fillStyle = '#d4ac0d';
                    ctx.beginPath();
                    ctx.moveTo(ox + 400, skyHeight - 15);
                    ctx.quadraticCurveTo(ox + 650, skyHeight - 5, ox + 950, skyHeight - 15);
                    ctx.lineTo(ox + 900, skyHeight);
                    ctx.lineTo(ox + 450, skyHeight);
                    ctx.closePath();
                    ctx.fill();
                    let housePositions = [ox + 500, ox + 660, ox + 820];
                    housePositions.forEach((hx, index) => {
                        let hy = skyHeight - 10;
                        ctx.fillStyle = index === 1 ? '#e59866' : '#f2f4f4';
                        ctx.fillRect(hx, hy - 40, 50, 40);
                        ctx.fillStyle = index === 0 ? '#922b21' : '#b03a2e';
                        ctx.beginPath();
                        ctx.moveTo(hx - 6, hy - 40);
                        ctx.lineTo(hx + 25, hy - 62);
                        ctx.lineTo(hx + 56, hy - 40);
                        ctx.closePath();
                        ctx.fill();
                        ctx.fillStyle = '#5d4037';
                        ctx.fillRect(hx + 19, hy - 22, 12, 22);
                        ctx.fillStyle = '#f9e79f';
                        ctx.fillRect(hx + 7, hy - 32, 10, 10);
                        ctx.fillRect(hx + 33, hy - 32, 10, 10);
                    });
                    let treePositions = [ox + 100, ox + 170, ox + 430, ox + 590, ox + 900, ox + 980, ox + 1200, ox + 1320];
                    treePositions.forEach((tx, idx) => {
                        ctx.fillStyle = '#873600';
                        ctx.fillRect(tx - 3, skyHeight - 35, 6, 20);
                        ctx.fillStyle = idx % 2 === 0 ? '#27ae60' : '#2ecc71';
                        ctx.beginPath();
                        ctx.arc(tx, skyHeight - 40, 15, 0, Math.PI * 2);
                        ctx.fill();
                    });
                }
            } else {
                // 2. BÖLÜM orman kampı
                let skyGrad = ctx.createLinearGradient(0, 0, 0, skyHeight);
                skyGrad.addColorStop(0, '#1a1c29');
                skyGrad.addColorStop(0.3, '#5b2c6f');
                skyGrad.addColorStop(0.6, '#d35400');
                skyGrad.addColorStop(0.85, '#f39c12');
                skyGrad.addColorStop(1, '#f1c40f');
                ctx.fillStyle = skyGrad;
                ctx.fillRect(0, 0, w, skyHeight);
                ctx.fillStyle = 'rgba(255, 240, 150, 0.9)';
                ctx.beginPath();
                ctx.arc(w * 0.35, skyHeight * 0.4, 75, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(243, 156, 18, 0.25)';
                ctx.beginPath();
                ctx.arc(w * 0.35, skyHeight * 0.4, 150, 0, Math.PI * 2);
                ctx.fill();
                for (let i = 0; i < count; i++) {
                    let ox = i * segW;
                    ctx.fillStyle = '#22382b';
                    ctx.beginPath();
                    ctx.moveTo(ox, skyHeight - 50);
                    ctx.quadraticCurveTo(ox + 250, skyHeight - 120, ox + 500, skyHeight - 60);
                    ctx.quadraticCurveTo(ox + 750, skyHeight - 140, ox + segW, skyHeight - 50);
                    ctx.lineTo(ox + segW, skyHeight);
                    ctx.lineTo(ox, skyHeight);
                    ctx.fill();
                    ctx.fillStyle = '#1e3828';
                    for (let tx = ox + 20; tx < ox + segW; tx += 90) {
                        let treeHeight = 50 + (tx % 30);
                        ctx.beginPath();
                        ctx.moveTo(tx, skyHeight - 20);
                        ctx.lineTo(tx - 20, skyHeight - treeHeight);
                        ctx.lineTo(tx + 20, skyHeight - treeHeight);
                        ctx.closePath();
                        ctx.fill();
                    }
                    for (let tx = ox + 70; tx < ox + segW; tx += 160) {
                        ctx.fillStyle = '#3e2723';
                        ctx.fillRect(tx - 6, skyHeight - 35, 12, 35);
                        ctx.fillStyle = '#194d2c';
                        ctx.beginPath();
                        ctx.moveTo(tx, skyHeight - 100);
                        ctx.lineTo(tx - 35, skyHeight - 40);
                        ctx.lineTo(tx + 35, skyHeight - 40);
                        ctx.closePath();
                        ctx.fill();
                        ctx.fillStyle = '#226639';
                        ctx.beginPath();
                        ctx.moveTo(tx, skyHeight - 75);
                        ctx.lineTo(tx - 25, skyHeight - 30);
                        ctx.lineTo(tx + 25, skyHeight - 30);
                        ctx.closePath();
                        ctx.fill();
                    }
                    let totemX = ox + 150;
                    ctx.fillStyle = '#4e342e';
                    ctx.fillRect(totemX - 10, skyHeight - 110, 20, 105);
                    ctx.fillStyle = '#d35400';
                    ctx.fillRect(totemX - 14, skyHeight - 100, 28, 15);
                    ctx.fillStyle = '#f1c40f';
                    ctx.beginPath();
                    ctx.arc(totemX - 5, skyHeight - 92, 3, 0, Math.PI * 2);
                    ctx.arc(totemX + 5, skyHeight - 92, 3, 0, Math.PI * 2);
                    ctx.fill();
                    let tipiX = ox + 550;
                    ctx.fillStyle = '#6c3483';
                    ctx.beginPath();
                    ctx.moveTo(tipiX - 30, skyHeight - 5);
                    ctx.lineTo(tipiX, skyHeight - 80);
                    ctx.lineTo(tipiX + 30, skyHeight - 5);
                    ctx.closePath();
                    ctx.fill();
                    ctx.strokeStyle = '#f1c40f';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(tipiX, skyHeight - 80);
                    ctx.lineTo(tipiX, skyHeight - 5);
                    ctx.stroke();
                    let targetX = ox + 380;
                    let targetY = skyHeight - 25;
                    ctx.fillStyle = '#3e2723';
                    ctx.fillRect(targetX - 4, targetY - 15, 8, 40);
                    let sizes = [28, 20, 12, 5];
                    let colors = ['#ffffff', '#e74c3c', '#ffffff', '#e74c3c'];
                    for (let r = 0; r < 4; r++) {
                        ctx.fillStyle = colors[r];
                        ctx.beginPath();
                        ctx.arc(targetX, targetY, sizes[r], 0, Math.PI * 2);
                        ctx.fill();
                    }
                    for (let aIdx = 0; aIdx < 4; aIdx++) {
                        let aAngle = -0.6 + aIdx * 0.4;
                        ctx.save();
                        ctx.translate(targetX, targetY);
                        ctx.rotate(aAngle);
                        ctx.strokeStyle = '#2c3e50';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(0, 0);
                        ctx.lineTo(18, 0);
                        ctx.stroke();
                        ctx.fillStyle = '#1abc9c';
                        ctx.fillRect(14, -2, 4, 4);
                        ctx.restore();
                    }
                    let archerX = ox + 300;
                    let archerY = skyHeight - 5;
                    let drawAmount = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.05 + ox));
                    ctx.save();
                    ctx.translate(archerX, archerY);
                    ctx.strokeStyle = '#3e2723';
                    ctx.lineWidth = 3.5;
                    ctx.beginPath();
                    ctx.moveTo(0, -12);
                    ctx.lineTo(-8, 0);
                    ctx.moveTo(0, -12);
                    ctx.lineTo(8, 0);
                    ctx.moveTo(0, -12);
                    ctx.lineTo(0, -32);
                    ctx.stroke();
                    ctx.fillStyle = '#3e2723';
                    ctx.beginPath();
                    ctx.arc(0, -38, 6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = '#e74c3c';
                    ctx.beginPath();
                    ctx.moveTo(2, -42);
                    ctx.lineTo(8, -50);
                    ctx.lineTo(4, -40);
                    ctx.fill();
                    ctx.strokeStyle = '#a0522d';
                    ctx.lineWidth = 2.5;
                    ctx.beginPath();
                    ctx.arc(-8, -25, 14, -Math.PI / 2.2, Math.PI / 2.2);
                    ctx.stroke();
                    let stringPullX = -8 - (drawAmount * 16);
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.moveTo(-8, -37);
                    ctx.lineTo(stringPullX, -25);
                    ctx.lineTo(-8, -13);
                    ctx.stroke();
                    ctx.restore();
                    let flightCycle = (t * 4 + ox * 0.3) % 200;
                    if (flightCycle < 160) {
                        let fProgress = flightCycle / 160;
                        let fX = (archerX + 10) + (targetX - archerX) * fProgress;
                        let fY = (archerY - 25) + (targetY - (archerY - 25)) * fProgress - Math.sin(fProgress * Math.PI) * 20;
                        ctx.save();
                        ctx.translate(fX, fY);
                        ctx.strokeStyle = '#f1c40f';
                        ctx.lineWidth = 2;
                        ctx.shadowColor = '#e67e22';
                        ctx.shadowBlur = 10;
                        ctx.beginPath();
                        ctx.moveTo(-8, 0);
                        ctx.lineTo(8, 0);
                        ctx.stroke();
                        ctx.restore();
                    }
                    let fireX = ox + 110;
                    let fireY = skyHeight - 6;
                    ctx.fillStyle = '#271c19';
                    ctx.fillRect(fireX - 10, fireY - 2, 20, 4);
                    let flamePulse = 14 + Math.sin(t * 0.25) * 4;
                    ctx.fillStyle = '#e67e22';
                    ctx.beginPath();
                    ctx.moveTo(fireX - 8, fireY);
                    ctx.quadraticCurveTo(fireX, fireY - flamePulse * 1.5, fireX + 2, fireY - flamePulse * 2);
                    ctx.quadraticCurveTo(fireX + 8, fireY, fireX + 8, fireY);
                    ctx.fill();
                    ctx.fillStyle = '#f1c40f';
                    ctx.beginPath();
                    ctx.moveTo(fireX - 4, fireY);
                    ctx.quadraticCurveTo(fireX, fireY - flamePulse, fireX + 4, fireY);
                    ctx.fill();
                }
            }

            let groundColor = era === 1 ? '#73c6b6' : (era === 3 ? '#c4a35a' : '#3d2b1f');
            let patternColor = era === 1 ? '#45b39d' : (era === 3 ? '#a88b45' : '#2d1b0f');
            ctx.fillStyle = groundColor;
            ctx.fillRect(0, skyHeight, w, typeof GROUND_HEIGHT !== 'undefined' ? GROUND_HEIGHT : 100);
            ctx.fillStyle = patternColor;
            let patternWidth = 40;
            for (let i = 0; i < w / patternWidth + 5; i++) {
                ctx.fillRect(i * patternWidth, skyHeight + 25, 4, 30);
                ctx.fillRect(i * patternWidth + 12, skyHeight + 65, 4, 20);
            }
        }

        function drawAmbushSpikes(ctx, bx, by) {
            ctx.save();
            ctx.translate(bx, by + 10);
            const poles = [
                { x: -70, ang: -0.55 }, { x: -40, ang: -0.4 }, { x: -10, ang: -0.5 },
                { x: 20, ang: -0.45 }, { x: 50, ang: -0.55 }, { x: 75, ang: -0.35 }
            ];
            poles.forEach(p => {
                ctx.save();
                ctx.translate(p.x, 0);
                ctx.rotate(p.ang);
                ctx.strokeStyle = '#4a3728';
                ctx.lineWidth = 7;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, 20);
                ctx.lineTo(0, -90);
                ctx.stroke();
                ctx.fillStyle = '#2c1e14';
                ctx.beginPath();
                ctx.moveTo(-5, -88);
                ctx.lineTo(0, -108);
                ctx.lineTo(5, -88);
                ctx.fill();
                ctx.strokeStyle = '#8b5a2b';
                ctx.lineWidth = 3;
                for (let y = -20; y > -70; y -= 18) {
                    ctx.beginPath();
                    ctx.moveTo(-5, y);
                    ctx.lineTo(5, y - 4);
                    ctx.stroke();
                }
                ctx.restore();
            });
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.beginPath();
            ctx.ellipse(0, 22, 90, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        function drawBase(ctx, isPlayer) {
            let b = isPlayer ? player.base : enemy.base;
            let bx = b.x;
            let by = b.y;
            if (!isPlayer && typeof isAmbushLevel === 'function' && isAmbushLevel()) {
                drawAmbushSpikes(ctx, bx, by);
                return;
            }
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
            ctx.fillText(Math.floor(b.hp) + '/' + b.maxHp, bx, by - 210);
        }

        function drawMines(ctx) {
            if (typeof isAmbushLevel === 'function' && isAmbushLevel()) {
                // pusuda düşman madeni çizme
                playerMineSlots.forEach(slot => drawOneMine(ctx, slot));
                return;
            }
            [...playerMineSlots, ...enemyMineSlots].forEach(slot => drawOneMine(ctx, slot));
        }

        function drawOneMine(ctx, slot) {
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
        }
