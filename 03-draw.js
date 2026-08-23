function drawEnvironment(ctx) {
    let w = typeof worldWidth !== 'undefined' ? worldWidth : canvas.width * 2;
    let skyHeight = canvas.height - (typeof GROUND_HEIGHT !== 'undefined' ? GROUND_HEIGHT : 100);
    let era = typeof currentEra !== 'undefined' ? currentEra : 1;
    let t = typeof frames !== 'undefined' ? frames : 0;

    let segW = 1400;
    let count = Math.ceil(w / segW) + 1;

    if (era === 1) {
        // --- 1. BÖLÜM: Ferah Su Değirmeni, Nehir ve Düzenli Kasaba (Açık Tema) ---
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

            // Arka Ufuk Tepeleri
            ctx.fillStyle = '#52be80';
            ctx.beginPath();
            ctx.moveTo(ox, skyHeight - 70);
            ctx.quadraticCurveTo(ox + 350, skyHeight - 140, ox + 700, skyHeight - 80);
            ctx.quadraticCurveTo(ox + 1050, skyHeight - 120, ox + segW, skyHeight - 70);
            ctx.lineTo(ox + segW, skyHeight);
            ctx.lineTo(ox, skyHeight);
            ctx.fill();

            // Nehir / Su Alanı
            ctx.fillStyle = '#3498db';
            ctx.fillRect(ox, skyHeight - 55, segW, 25);

            ctx.fillStyle = '#ebf5fb';
            ctx.globalAlpha = 0.7;
            let waveAnim = (t * 0.5) % 160;
            ctx.fillRect(ox + 150 + waveAnim, skyHeight - 45, 50, 2.5);
            ctx.fillRect(ox + 600 + waveAnim, skyHeight - 40, 70, 2);
            ctx.fillRect(ox + 1000 + waveAnim, skyHeight - 50, 60, 2.5);
            ctx.globalAlpha = 1.0;

            // Su Değirmeni
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

            // Değirmen Çarkı (Dönen)
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

            // Toprak Yollar ve Evler
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

            // Ağaçlar
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
        // --- 2. BÖLÜM: Yoğun Orman ve Animasyonlu Okçuluk Eğitim Sahası ---
        let skyGrad = ctx.createLinearGradient(0, 0, 0, skyHeight);
        skyGrad.addColorStop(0, '#a9dfbf');
        skyGrad.addColorStop(0.6, '#76d7c4');
        skyGrad.addColorStop(1, '#a3e4d7');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, w, skyHeight);

        for (let i = 0; i < count; i++) {
            let ox = i * segW;

            // Yoğun Orman Arka Katmanı
            ctx.fillStyle = '#145a32';
            ctx.beginPath();
            ctx.moveTo(ox, skyHeight - 60);
            ctx.quadraticCurveTo(ox + 300, skyHeight - 150, ox + 700, skyHeight - 80);
            ctx.quadraticCurveTo(ox + 1100, skyHeight - 130, ox + segW, skyHeight - 60);
            ctx.lineTo(ox + segW, skyHeight);
            ctx.lineTo(ox, skyHeight);
            ctx.fill();

            // Sık Çam Ağaçları Sıralaması
            ctx.fillStyle = '#0e6251';
            for (let tx = ox + 40; tx < ox + segW; tx += 120) {
                ctx.beginPath();
                ctx.moveTo(tx, skyHeight - 90);
                ctx.lineTo(tx - 20, skyHeight - 20);
                ctx.lineTo(tx + 20, skyHeight - 20);
                ctx.fill();
            }

            // --- ANİMASYONLU OKÇULUK EĞİTİM SAHASI ---
            // Her segmentte bir okçuluk eğitim noktası (Hedef tahtaları ve okçular)
            let campX = ox + 450;
            let campY = skyHeight - 15;

            // 1. Hedef Tahtaları (Target Boards)
            let targetX = campX + 160;
            let targetY = skyHeight - 45;

            // Tahta Ayakları
            ctx.strokeStyle = '#6e2c00';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(targetX, targetY);
            ctx.lineTo(targetX - 15, campY);
            ctx.moveTo(targetX, targetY);
            ctx.lineTo(targetX + 15, campY);
            ctx.stroke();

            // Hedef Daireleri (Kırmızı - Beyaz)
            let tColors = ['#fff', '#e74c3c', '#fff', '#c0392b'];
            let tSizes = [20, 14, 8, 3];
            for (let r = 0; r < 4; r++) {
                ctx.fillStyle = tColors[r];
                ctx.beginPath();
                ctx.arc(targetX, targetY, tSizes[r], 0, Math.PI * 2);
                ctx.fill();
            }

            // Hedefe Saplanan Animasyonlu Oklar
            let hitAnim = Math.sin(t * 0.1) * 2;
            ctx.strokeStyle = '#2c3e50';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(targetX - 35, targetY + hitAnim);
            ctx.lineTo(targetX, targetY + hitAnim);
            ctx.stroke();
            // Ok Ucu ve Tüyü
            ctx.fillStyle = '#bdc3c7';
            ctx.beginPath();
            ctx.moveTo(targetX, targetY + hitAnim);
            ctx.lineTo(targetX - 6, targetY - 3 + hitAnim);
            ctx.lineTo(targetX - 6, targetY + 3 + hitAnim);
            ctx.closePath();
            ctx.fill();

            // 2. Okçuluk Eğitimi Alanı Okçuları (Stickman Okçular)
            let archerX = campX;
            let archerY = campY;

            // Okçu Vücudu ve Yay Tutuşu (Animasyonlu yay çekme hareketi)
            let drawBow = Math.sin(t * 0.1) * 6; // Yay germe hareketi

            ctx.strokeStyle = '#273746';
            ctx.lineWidth = 3;
            // Ayaklar / Gövde
            ctx.beginPath();
            ctx.moveTo(archerX, archerY - 10);
            ctx.lineTo(archerX - 8, archerY);
            ctx.moveTo(archerX, archerY - 10);
            ctx.lineTo(archerX + 8, archerY);
            ctx.moveTo(archerX, archerY - 10);
            ctx.lineTo(archerX, archerY - 30);
            // Kollar ve Yay
            ctx.moveTo(archerX, archerY - 24);
            ctx.lineTo(archerX + 14 + drawBow, archerY - 24);
            ctx.stroke();

            // Kafa
            ctx.fillStyle = '#273746';
            ctx.beginPath();
            ctx.arc(archerX, archerY - 36, 6, 0, Math.PI * 2);
            ctx.fill();

            // 3. Havada Uçan Ok Animasyonu (Okçudan Hedefe Doğru Giden Ok)
            let arrowTravel = (t * 4) % 150;
            if (arrowTravel < 130) {
                ctx.strokeStyle = '#f1c40f';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(archerX + 15 + arrowTravel, archerY - 24);
                ctx.lineTo(archerX + 28 + arrowTravel, archerY - 24);
                ctx.stroke();
            }

            // Eğitim Kampı Çadırı / Süs Kamp Ateşi
            ctx.fillStyle = '#b03a2e';
            ctx.beginPath();
            ctx.moveTo(campX - 100, campY);
            ctx.lineTo(campX - 75, campY - 35);
            ctx.lineTo(campX - 50, campY);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#f39c12'; // Ateş
            ctx.beginPath();
            ctx.arc(campX - 140, campY - 5, 5 + Math.sin(t * 0.2) * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Ön Plan Savaş Alanı Çimi
    let groundColor = era === 1 ? '#73c6b6' : '#27ae60';
    let patternColor = era === 1 ? '#45b39d' : '#1e8449';

    ctx.fillStyle = groundColor; 
    ctx.fillRect(0, skyHeight, w, typeof GROUND_HEIGHT !== 'undefined' ? GROUND_HEIGHT : 100);
    
    ctx.fillStyle = patternColor; 
    let patternWidth = 40;
    for (let i = 0; i < w / patternWidth + 5; i++) {
        ctx.fillRect(i * patternWidth, skyHeight + 25, 4, 30);
        ctx.fillRect(i * patternWidth + 12, skyHeight + 65, 4, 20);
    }
}
