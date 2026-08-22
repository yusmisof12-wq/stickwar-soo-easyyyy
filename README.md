# Çöp Adam Savaşları (modüler)

Tek dev HTML yerine dosyalar ayrıldı:

```
cop-adam/
├── index.html              # Sadece arayüz (HTML)
├── css/style.css           # Tüm stiller
├── js/
│   ├── 01-core.js          # Sabitler, canvas, maden slotları, paylaşılan değişkenler
│   ├── 02-units.js         # Miner, Clubman, Archer, Arrow sınıfları
│   ├── 03-draw.js          # Çizim fonksiyonları (stickman, maden, çevre…)
│   ├── 04-gameplay.js      # Komutlar, AI, update/draw döngüsü
│   └── 05-menu-network.js  # Hesap, menü, sefer, arkadaş, WebSocket, co-op
├── server.js               # Express + WS sunucu
├── package.json
└── data/                   # users.json (sunucu kaydı)
```

## Çalıştırma

```bash
cd cop-adam
npm install
npm start
```

Tarayıcı: http://localhost:3847

## Ne nerede düzenlenir?

| İstediğin değişiklik | Dosya |
|----------------------|--------|
| Buton / menü görünümü | `css/style.css` veya `index.html` |
| Madenci / sopalı / okçu davranışı | `js/02-units.js` |
| Animasyon / görünüş | `js/03-draw.js` |
| AI, altın, bölüm bitişi | `js/04-gameplay.js` |
| Giriş, sefer haritası, arkadaş, co-op | `js/05-menu-network.js` |
| API / kayıt / WebSocket | `server.js` |

Script sırası önemli — `index.html` içindeki sırayı değiştirme.
