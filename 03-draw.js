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
                } else if (weapon === 'club' || weapon === 'sickle') {
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
                if (weapon === 'club' || weapon === 'sickle') {
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
                    {
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
                    }
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
                } else if (weapon === 'sickle') {
                    // Orak: kavisli bıçak + kırmızı sargı sap
                    const swingT = animFrame > 30 && animFrame < 55 ? (animFrame - 30) / 25 : 0;
                    ctx.save();
                    ctx.translate(handX, handY);
                    const ang = (-0.6 + (typeof armRot !== 'undefined' ? armRot * 0.012 : 0)) + swingT * 0.35;
                    ctx.rotate(ang);
                    // sap
                    ctx.strokeStyle = '#5d4037';
                    ctx.lineWidth = 4;
                    ctx.lineCap = 'round';
                    ctx.beginPath();
                    ctx.moveTo(0, 0);
                    ctx.lineTo(0, -14);
                    ctx.stroke();
                    // kırmızı sargı
                    ctx.strokeStyle = '#c0392b';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.moveTo(0, -2);
                    ctx.lineTo(0, -12);
                    ctx.stroke();
                    // orak bıçağı
                    ctx.strokeStyle = '#bdc3c7';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(2, -22, 14, -Math.PI * 0.15, Math.PI * 0.95, false);
                    ctx.stroke();
                    ctx.strokeStyle = '#ecf0f1';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(2, -22, 14, -Math.PI * 0.1, Math.PI * 0.9, false);
                    ctx.stroke();
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
            const w = worldWidth;
            const skyHeight = canvas.height - GROUND_HEIGHT;
            const era = (typeof level !== 'undefined' && level >= 3) ? 3 : ((typeof level !== 'undefined' && level >= 2) ? 2 : 1);
            const t = typeof frames !== 'undefined' ? frames : 0;

            if (era === 3) {
                // Çöl / gün batımı pusu
                const sunP = (typeof ambushTimer === 'number' && typeof AMBUSH_DURATION_FRAMES === 'number' && AMBUSH_DURATION_FRAMES > 0)
                    ? Math.min(1, ambushTimer / AMBUSH_DURATION_FRAMES) : 0;
                let skyGrad = ctx.createLinearGradient(0, 0, 0, skyHeight);
                skyGrad.addColorStop(0, sunP > 0.65 ? '#1a1028' : '#4a2c6a');
                skyGrad.addColorStop(0.4, sunP > 0.45 ? '#a04030' : '#e67e22');
                skyGrad.addColorStop(0.75, '#f39c12');
                skyGrad.addColorStop(1, '#f5d08a');
                ctx.fillStyle = skyGrad;
                ctx.fillRect(0, 0, w, skyHeight);

                const sunY = skyHeight * (0.22 + sunP * 0.58);
                const sunX = w * 0.5;
                ctx.fillStyle = 'rgba(255, 210, 100, 0.95)';
                ctx.beginPath();
                ctx.arc(sunX, sunY, 50 - sunP * 8, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(243, 156, 18, 0.22)';
                ctx.beginPath();
                ctx.arc(sunX, sunY, 100, 0, Math.PI * 2);
                ctx.fill();

                // Kum tepeleri
                ctx.fillStyle = '#d4a574';
                ctx.beginPath();
                ctx.moveTo(0, skyHeight - 15);
                for (let x = 0; x <= w; x += 200) {
                    ctx.quadraticCurveTo(x + 100, skyHeight - 60 - (x % 400) / 10, x + 200, skyHeight - 20);
                }
                ctx.lineTo(w, skyHeight);
                ctx.lineTo(0, skyHeight);
                ctx.fill();

                // Kaktüs
                for (let cx = 150; cx < w; cx += 280) {
                    ctx.fillStyle = '#1e8449';
                    ctx.fillRect(cx - 5, skyHeight - 50, 10, 40);
                    ctx.fillRect(cx - 16, skyHeight - 38, 10, 6);
                    ctx.fillRect(cx - 16, skyHeight - 38, 5, 18);
                    ctx.fillRect(cx + 6, skyHeight - 32, 10, 6);
                    ctx.fillRect(cx + 11, skyHeight - 32, 5, 14);
                }

                ctx.fillStyle = '#c4a35a';
                ctx.fillRect(0, skyHeight, w, GROUND_HEIGHT);
                ctx.fillStyle = '#a88b45';
                for (let i = 0; i < w / 40 + 5; i++) {
                    ctx.fillRect(i * 40, skyHeight + 25, 4, 28);
                    ctx.fillRect(i * 40 + 12, skyHeight + 60, 4, 18);
                }
                return;
            }

            if (era === 2) {
                let skyGrad = ctx.createLinearGradient(0, 0, 0, skyHeight);
                skyGrad.addColorStop(0, '#1a1c29');
                skyGrad.addColorStop(0.35, '#5b2c6f');
                skyGrad.addColorStop(0.65, '#d35400');
                skyGrad.addColorStop(1, '#f1c40f');
                ctx.fillStyle = skyGrad;
                ctx.fillRect(0, 0, w, skyHeight);
                ctx.fillStyle = 'rgba(255, 240, 150, 0.85)';
                ctx.beginPath();
                ctx.arc(w * 0.35, skyHeight * 0.4, 60, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1e3828';
                ctx.beginPath();
                ctx.moveTo(0, skyHeight - 40);
                ctx.quadraticCurveTo(w * 0.3, skyHeight - 100, w * 0.6, skyHeight - 50);
                ctx.quadraticCurveTo(w * 0.85, skyHeight - 110, w, skyHeight - 45);
                ctx.lineTo(w, skyHeight);
                ctx.lineTo(0, skyHeight);
                ctx.fill();
                ctx.fillStyle = '#3d2b1f';
                ctx.fillRect(0, skyHeight, w, GROUND_HEIGHT);
                ctx.fillStyle = '#2d1b0f';
                for (let i = 0; i < w / 40 + 5; i++) {
                    ctx.fillRect(i * 40, skyHeight + 25, 4, 28);
                }
                return;
            }

            // Bölüm 1 varsayılan
            let grad = ctx.createLinearGradient(0, 0, 0, skyHeight);
            grad.addColorStop(0, '#85c1e9');
            grad.addColorStop(0.5, '#d4efdf');
            grad.addColorStop(1, '#fcf3cf');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, skyHeight);
            ctx.fillStyle = 'rgba(255,255,255,0.55)';
            ctx.beginPath();
            ctx.arc(w * 0.25, skyHeight * 0.2, 80, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#52be80';
            ctx.beginPath();
            ctx.moveTo(0, skyHeight - 50);
            ctx.quadraticCurveTo(w * 0.4, skyHeight - 120, w * 0.8, skyHeight - 55);
            ctx.lineTo(w, skyHeight);
            ctx.lineTo(0, skyHeight);
            ctx.fill();
            ctx.fillStyle = '#73c6b6';
            ctx.fillRect(0, skyHeight, w, GROUND_HEIGHT);
            ctx.fillStyle = '#45b39d';
            for (let i = 0; i < w / 40 + 5; i++) {
                ctx.fillRect(i * 40, skyHeight + 25, 4, 28);
            }
        }


        function drawAmbushSpikes(ctx, bx, by) {
            // Fotoğraftaki gibi çapraz dikenli barikat
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
                // kazık
                ctx.strokeStyle = '#4a3728';
                ctx.lineWidth = 7;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(0, 20);
                ctx.lineTo(0, -90);
                ctx.stroke();
                // sivri uç
                ctx.fillStyle = '#2c1e14';
                ctx.beginPath();
                ctx.moveTo(-5, -88);
                ctx.lineTo(0, -108);
                ctx.lineTo(5, -88);
                ctx.fill();
                // sargı
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
            // gölge
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
            // 3. bölüm: düşman heykeli yok — dikenli barikat
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
