// Sunucu taraflı sefer simülasyonu — iki oyuncu eşit (host yok)
const TICK_MS = 50; // 20 Hz
const SPEED = 1.8;
const GROUND = 220;
const WORLD_W = 2600;

const CMD = { ATTACK: 1, DEFEND: 2, RETREAT: 3 };
const COST = { miner: 150, club: 125, archer: 140 };
const SPAWN = { miner: 8 * 20, club: 6 * 20, archer: 7 * 20 }; // ticks @20Hz
const MAX_Q = 8;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function hypot(x, y) { return Math.sqrt(x * x + y * y); }

class GameRoom {
  constructor(roomId, level, name0, name1) {
    this.roomId = roomId;
    this.level = level || 1;
    this.names = [name0, name1];
    this.tickN = 0;
    this.over = false;
    this.winner = null; // 'players' | 'enemy'
    this.worldH = 700;
    this.groundY = this.worldH - GROUND + 40;

    this.players = [this._mkPlayer(130), this._mkPlayer(130)];
    this.enemy = {
      gold: 300, command: CMD.DEFEND, base: { x: WORLD_W - 130, y: this.groundY, hp: level === 1 ? 280 : 500, maxHp: level === 1 ? 280 : 500 },
      aiTimer: 0, minerCd: 0, clubCd: 0, archerCd: 0,
    };
    this.players[0].base = { x: 130, y: this.groundY, hp: 1000, maxHp: 1000 };
    this.players[1].base = this.players[0].base; // shared castle

    this.units = [];
    this.projectiles = [];
    this.floats = [];
    this.nextId = 1;
    this.inputs = [[], []]; // pending inputs per slot
    this.lastMsgAt = [Date.now(), Date.now()];
    this.rtt = [0, 0];
  }

  _mkPlayer() {
    return {
      gold: 300,
      command: CMD.DEFEND,
      minerQ: [], minerT: 0, minerTMax: 0,
      combatQ: [], combatT: 0, combatTMax: 0,
    };
  }

  pushInput(slot, action) {
    if (slot !== 0 && slot !== 1) return;
    this.inputs[slot].push(action);
    this.lastMsgAt[slot] = Date.now();
  }

  setRtt(slot, rtt) {
    if (slot === 0 || slot === 1) this.rtt[slot] = rtt;
  }

  tick() {
    if (this.over) return this.snapshot();
    this.tickN++;
    // inputs
    for (let s = 0; s < 2; s++) {
      while (this.inputs[s].length) {
        this._applyInput(s, this.inputs[s].shift());
      }
    }
    this._processQueues(0);
    this._processQueues(1);
    this._enemyAI();
    this._updateUnits();
    this._updateProjectiles();
    this._updateFloats();
    // passive enemy gold
    if (this.tickN % 60 === 0) {
      this.enemy.gold += Math.floor(8 * 1.3);
    }
    this._checkEnd();
    return this.snapshot();
  }

  _applyInput(slot, action) {
    const p = this.players[slot];
    if (!p) return;
    if (action === 'attack') p.command = CMD.ATTACK;
    else if (action === 'defend') p.command = CMD.DEFEND;
    else if (action === 'retreat') p.command = CMD.RETREAT;
    else if (action === 'buyMiner') this._queue(slot, 'miner');
    else if (action === 'buyClub') this._queue(slot, 'club');
    else if (action === 'buyArcher') this._queue(slot, 'archer');
  }

  _queue(slot, type) {
    const p = this.players[slot];
    const cost = COST[type];
    if (p.gold < cost) return;
    if (type === 'miner') {
      if (p.minerQ.length >= MAX_Q) return;
      p.gold -= cost;
      p.minerQ.push(type);
      if (p.minerQ.length === 1) { p.minerTMax = SPAWN.miner; p.minerT = SPAWN.miner; }
    } else {
      if (p.combatQ.length >= MAX_Q) return;
      p.gold -= cost;
      p.combatQ.push(type);
      if (p.combatQ.length === 1) { p.combatTMax = SPAWN[type]; p.combatT = SPAWN[type]; }
    }
  }

  _processQueues(slot) {
    const p = this.players[slot];
    const spawn = (type) => {
      const baseX = 130;
      const u = {
        id: this.nextId++, type, owner: slot, isPlayer: true,
        x: baseX + 40 + Math.random() * 30, y: this.groundY + (Math.random() * 20 - 10),
        hp: type === 'miner' ? 100 : (type === 'club' ? 120 : 80),
        maxHp: type === 'miner' ? 100 : (type === 'club' ? 120 : 80),
        state: type === 'miner' ? 'mine' : 'idle',
        timer: 0, bag: 0, targetId: null, atkT: 0, walk: 0, flip: false,
        lean: 0, raise: 0, swing: 0, draw: 0,
      };
      if (type === 'miner') {
        u.mineX = baseX + 180 + (slot * 40);
        u.mineY = this.groundY;
      }
      this.units.push(u);
    };
    // miner queue
    if (p.minerQ.length) {
      if (p.minerT > 0) p.minerT--;
      if (p.minerT <= 0) {
        const t = p.minerQ.shift();
        spawn(t);
        if (p.minerQ.length) { p.minerTMax = SPAWN.miner; p.minerT = SPAWN.miner; }
        else { p.minerT = 0; p.minerTMax = 0; }
      }
    }
    // combat queue
    if (p.combatQ.length) {
      if (p.combatT > 0) p.combatT--;
      if (p.combatT <= 0) {
        const t = p.combatQ.shift();
        spawn(t);
        if (p.combatQ.length) {
          const n = p.combatQ[0];
          p.combatTMax = SPAWN[n]; p.combatT = SPAWN[n];
        } else { p.combatT = 0; p.combatTMax = 0; }
      }
    }
  }

  _enemyAI() {
    this.enemy.aiTimer++;
    if (this.enemy.minerCd > 0) this.enemy.minerCd--;
    if (this.enemy.clubCd > 0) this.enemy.clubCd--;
    const eMiners = this.units.filter(u => !u.isPlayer && u.type === 'miner').length;
    const eClubs = this.units.filter(u => !u.isPlayer && u.type === 'club').length;
    const pCombat = this.units.filter(u => u.isPlayer && u.type !== 'miner').length;
    if (this.enemy.minerCd <= 0 && this.enemy.gold >= 150 && eMiners < 3) {
      this.enemy.gold -= 150;
      this.units.push({
        id: this.nextId++, type: 'miner', owner: -1, isPlayer: false,
        x: WORLD_W - 180, y: this.groundY, hp: 100, maxHp: 100,
        state: 'mine', timer: 0, bag: 0, targetId: null, atkT: 0, walk: 0, flip: true,
        lean: 0, raise: 0, swing: 0, draw: 0, mineX: WORLD_W - 220, mineY: this.groundY,
      });
      this.enemy.minerCd = 200;
    }
    if (this.enemy.clubCd <= 0 && this.enemy.gold >= 125 && eClubs < 6) {
      this.enemy.gold -= 125;
      this.units.push({
        id: this.nextId++, type: 'club', owner: -1, isPlayer: false,
        x: WORLD_W - 160, y: this.groundY, hp: 120, maxHp: 120,
        state: 'idle', timer: 0, bag: 0, targetId: null, atkT: 0, walk: 0, flip: true,
        lean: 0, raise: 0, swing: 0, draw: 0,
      });
      this.enemy.clubCd = 140;
    }
    // command
    if (pCombat > eClubs + 1) this.enemy.command = CMD.DEFEND;
    else if (eClubs >= 3) this.enemy.command = CMD.ATTACK;
    else this.enemy.command = CMD.DEFEND;
  }

  _findUnit(id) {
    return this.units.find(u => u.id === id);
  }

  _nearestEnemy(u) {
    let best = null, bd = 1e9;
    for (const o of this.units) {
      if (o.isPlayer === u.isPlayer || o.hp <= 0) continue;
      const d = hypot(o.x - u.x, o.y - u.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  _updateUnits() {
    const baseP = this.players[0].base;
    const baseE = this.enemy.base;
    for (const u of this.units) {
      if (u.hp <= 0) continue;
      u.walk = 0;
      const cmd = u.isPlayer ? this.players[u.owner].command : this.enemy.command;

      if (u.type === 'miner') {
        if (cmd === CMD.RETREAT) {
          const tx = u.isPlayer ? -100 : WORLD_W + 100;
          this._moveToward(u, tx, u.y, 2.2);
          continue;
        }
        if (u.state === 'mine') {
          if (hypot(u.x - u.mineX, u.y - u.mineY) > 8) {
            this._moveToward(u, u.mineX, u.mineY, 2.4);
          } else {
            u.timer++;
            u.lean = 0.3 + Math.sin(u.timer / 8) * 0.15;
            u.raise = 0.4 + Math.sin(u.timer / 6) * 0.4;
            u.swing = Math.sin(u.timer / 7) * 1.2;
            if (u.timer % 35 === 0) {
              u.bag = Math.min(6, u.bag + 1);
              this.floats.push({ x: u.x, y: u.y - 40, text: '+1', color: '#f1c40f', life: 40, isBig: false });
            }
            if (u.bag >= 6) { u.state = 'deliver'; u.timer = 0; }
          }
        } else if (u.state === 'deliver') {
          const bx = u.isPlayer ? baseP.x : baseE.x;
          if (hypot(u.x - bx, u.y - baseP.y) > 40) {
            this._moveToward(u, bx, baseP.y, 2.4);
          } else {
            const gold = Math.max(1, Math.floor(u.bag * 13 * (u.isPlayer ? 0.8 : 1.3)));
            if (u.isPlayer) {
              this.players[u.owner].gold += gold;
            } else {
              this.enemy.gold += gold;
            }
            this.floats.push({ x: bx, y: baseP.y - 60, text: '+' + gold, color: '#f1c40f', life: 50, isBig: false });
            u.bag = 0; u.state = 'mine'; u.timer = 0;
          }
        }
        continue;
      }

      // combat units
      if (cmd === CMD.RETREAT) {
        const tx = u.isPlayer ? baseP.x + 80 : baseE.x - 80;
        this._moveToward(u, tx, this.groundY, 2.5);
        continue;
      }
      if (cmd === CMD.DEFEND) {
        const tx = u.isPlayer ? baseP.x + 280 + u.owner * 30 : baseE.x - 280;
        if (hypot(u.x - tx, 0) > 20) this._moveToward(u, tx, this.groundY, 2.2);
        // still fight if enemy near
        const near = this._nearestEnemy(u);
        if (near && hypot(near.x - u.x, near.y - u.y) < 50) this._fight(u, near);
        continue;
      }
      // ATTACK
      const foe = this._nearestEnemy(u);
      if (foe) {
        const d = hypot(foe.x - u.x, foe.y - u.y);
        if (u.type === 'archer') {
          if (d > 280) this._moveToward(u, foe.x, foe.y, 1.8);
          else {
            u.atkT++;
            u.draw = clamp((u.atkT % 50) / 40, 0, 1);
            if (u.atkT % 50 === 45) {
              this.projectiles.push({ x: u.x, y: u.y - 30, tx: foe.x, ty: foe.y - 10, targetId: foe.id, speed: 9, fromPlayer: u.isPlayer });
              u.draw = 0;
            }
          }
        } else {
          if (d > 32) this._moveToward(u, foe.x, foe.y, 2.6);
          else this._fight(u, foe);
        }
      } else {
        // march to enemy base
        const tx = u.isPlayer ? baseE.x - 40 : baseP.x + 40;
        this._moveToward(u, tx, this.groundY, 2.4);
        if (hypot(u.x - tx, 0) < 40) {
          // hit base
          if (u.isPlayer) {
            baseE.hp -= 0.4;
          } else {
            baseP.hp -= 0.4;
          }
        }
      }
    }
    this.units = this.units.filter(u => u.hp > 0);
  }

  _fight(u, foe) {
    u.flip = foe.x < u.x;
    u.atkT++;
    u.walk = 0;
    if (u.atkT % 25 === 20) {
      foe.hp -= u.type === 'club' ? 12 : 8;
      this.floats.push({ x: foe.x, y: foe.y - 30, text: '-' + (u.type === 'club' ? 12 : 8), color: '#e74c3c', life: 35, isBig: false });
    }
  }

  _moveToward(u, tx, ty, spd) {
    const dx = tx - u.x, dy = ty - u.y;
    const d = hypot(dx, dy) || 1;
    u.x += (dx / d) * spd * SPEED * 0.55;
    u.y += (dy / d) * spd * SPEED * 0.35;
    u.flip = dx < 0;
    u.walk = 1;
    u.y = clamp(u.y, this.groundY - 30, this.groundY + 40);
  }

  _updateProjectiles() {
    for (const p of this.projectiles) {
      const dx = p.tx - p.x, dy = p.ty - p.y;
      const d = hypot(dx, dy) || 1;
      p.x += (dx / d) * p.speed;
      p.y += (dy / d) * p.speed;
      if (d < 12) {
        const t = this._findUnit(p.targetId);
        if (t) {
          t.hp -= 12;
          this.floats.push({ x: t.x, y: t.y - 30, text: '-12', color: '#e74c3c', life: 35, isBig: false });
        }
        p.dead = true;
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  _updateFloats() {
    for (const f of this.floats) {
      f.y -= 1.2;
      f.life--;
    }
    this.floats = this.floats.filter(f => f.life > 0);
  }

  _checkEnd() {
    if (this.enemy.base.hp <= 0) {
      this.over = true;
      this.winner = 'players';
    } else if (this.players[0].base.hp <= 0) {
      this.over = true;
      this.winner = 'enemy';
    }
  }

  snapshot() {
    return {
      kind: 'state',
      tick: this.tickN,
      level: this.level,
      over: this.over,
      winner: this.winner,
      baseHp: Math.round(this.players[0].base.hp),
      baseMax: this.players[0].base.maxHp,
      enemyBaseHp: Math.round(this.enemy.base.hp),
      enemyBaseMax: this.enemy.base.maxHp,
      enemyGold: Math.floor(this.enemy.gold),
      p0: {
        gold: Math.floor(this.players[0].gold),
        command: this.players[0].command,
        minerQ: this.players[0].minerQ.length,
        combatQ: this.players[0].combatQ.slice(),
        minerT: this.players[0].minerT,
        minerTMax: this.players[0].minerTMax,
        combatT: this.players[0].combatT,
        combatTMax: this.players[0].combatTMax,
        name: this.names[0],
        rtt: this.rtt[0],
      },
      p1: {
        gold: Math.floor(this.players[1].gold),
        command: this.players[1].command,
        minerQ: this.players[1].minerQ.length,
        combatQ: this.players[1].combatQ.slice(),
        minerT: this.players[1].minerT,
        minerTMax: this.players[1].minerTMax,
        combatT: this.players[1].combatT,
        combatTMax: this.players[1].combatTMax,
        name: this.names[1],
        rtt: this.rtt[1],
      },
      units: this.units.map(u => ({
        id: u.id, t: u.type, p: u.isPlayer, oi: u.owner < 0 ? 0 : u.owner,
        x: Math.round(u.x), y: Math.round(u.y),
        hp: Math.round(u.hp), mhp: u.maxHp,
        w: !!u.walk, fl: !!u.flip,
        bg: u.bag || 0, dl: u.state === 'deliver',
        bl: Math.round((u.lean || 0) * 100) / 100,
        ar: Math.round((u.raise || 0) * 100) / 100,
        sw: Math.round((u.swing || 0) * 100) / 100,
        d: u.draw || 0,
        an: u.atkT || 0,
        st: u.state || '',
      })),
      floats: this.floats.slice(0, 30).map(f => ({
        x: Math.round(f.x), y: Math.round(f.y), text: f.text, color: f.color, life: f.life, isBig: !!f.isBig,
      })),
      arrows: this.projectiles.slice(0, 20).map(p => ({
        x: Math.round(p.x), y: Math.round(p.y), a: Math.atan2(p.ty - p.y, p.tx - p.x),
      })),
    };
  }
}

module.exports = { GameRoom, TICK_MS, CMD };
