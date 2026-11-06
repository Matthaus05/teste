const W = 1200;
const H = 600;
const BOSS_TIME = 66;
const BEST_KEY = 'rtype-nebula-best';
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const rand = (min, max) => min + Math.random() * (max - min);

export function circlesOverlap(a, b) {
  const radius = (a.radius || 0) + (b.radius || 0);
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= radius ** 2;
}

function bulletHitTime(bullet, target) {
  const start = bullet.previousX ?? bullet.x;
  const startY = bullet.previousY ?? bullet.y;
  const dx = bullet.x - start;
  const dy = bullet.y - startY;
  const offsetX = start - target.x;
  const offsetY = startY - target.y;
  const radius = (bullet.radius || 0) + (target.radius || 0);
  const outside = offsetX * offsetX + offsetY * offsetY - radius * radius;
  if (outside <= 0) return 0;
  const length = dx * dx + dy * dy;
  if (!length) return null;
  const approach = offsetX * dx + offsetY * dy;
  const discriminant = approach * approach - length * outside;
  if (discriminant < 0) return null;
  const time = (-approach - Math.sqrt(discriminant)) / length;
  return time >= 0 && time <= 1 ? time : null;
}

const bulletHits = (bullet, target) => bulletHitTime(bullet, target) !== null;

export function createInitialState() {
  return {
    state: 'menu', width: W, height: H,
    player: {
      x: 180, y: 300, radius: 13, hp: 4, maxHp: 4,
      invulnerable: 2, charge: 0, weapon: 1, fireCooldown: 0,
      thrust: 0, bank: 0,
    },
    enemies: [], bullets: [], enemyBullets: [], particles: [], pickups: [],
    boss: null, score: 0, elapsed: 0, sector: 1, progress: 0,
    shake: 0, flash: 0, modeTime: 0, bossDefeated: false, kills: 0,
  };
}

export class Game {
  constructor({ canvas = null, renderer = null, onChange = () => {}, onSound = () => {} } = {}) {
    Object.assign(this, createInitialState());
    this.canvas = canvas;
    this.renderer = renderer;
    this.onChange = onChange;
    this.onSound = onSound;
    this.best = this._readBest();
    this.input = { up: false, down: false, left: false, right: false, fire: false, charge: false };
    this._inputSources = Object.fromEntries(Object.keys(this.input).map((action) => [action, new Set()]));
    this.muted = false;
    this._spawnTimer = 0.9;
    this._emitTimer = 0;
    this._lastFrame = null;
    this._frameId = null;
    this._disposed = false;
    this._listeners = [];
    this._installEvents();
    this.renderer?.resize?.(canvas);
    this._emit();
    if (typeof requestAnimationFrame === 'function') {
      const frame = (now) => {
        if (this._disposed) return;
        const dt = this._lastFrame === null ? 0 : Math.min((now - this._lastFrame) / 1000, 0.05);
        this._lastFrame = now;
        this.update(dt);
        this.renderer?.render?.(this, dt);
        this._frameId = requestAnimationFrame(frame);
      };
      this._frameId = requestAnimationFrame(frame);
    }
  }

  _readBest() {
    try {
      const value = Number(globalThis.localStorage?.getItem(BEST_KEY));
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch { return 0; }
  }

  _saveBest() {
    this.best = Math.max(this.best, this.score, this._readBest());
    try { globalThis.localStorage?.setItem(BEST_KEY, String(this.best)); } catch { /* Storage may be disabled. */ }
  }

  _sound(name) {
    if (!this.muted) this.onSound(name);
  }

  setMuted(muted) { this.muted = Boolean(muted); }

  start() {
    if (this.state === 'paused') {
      this.state = 'playing';
      this._lastFrame = null;
      this._emit();
      return;
    }
    if (this.state === 'playing') return;
    const time = this.modeTime;
    Object.assign(this, createInitialState());
    this.modeTime = time;
    this.state = 'playing';
    this._spawnTimer = 0.9;
    this._emitTimer = 0;
    this._lastFrame = null;
    this.releaseInputs();
    this._emit();
  }

  restart() {
    if (this.state === 'playing' || this.state === 'paused') this._saveBest();
    this.state = 'menu';
    this.start();
  }

  pause() {
    if (this.state === 'playing') {
      this.releaseInputs();
      this.state = 'paused';
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this._lastFrame = null;
    } else return;
    this._emit();
  }

  setInput(action, pressed, source = 'external') {
    this._setInput(action, pressed, source, false);
  }

  cancelInput(action, source = 'external') {
    this._setInput(action, false, source, true);
  }

  _setInput(action, pressed, source, canceled) {
    if (!Object.hasOwn(this.input, action)) return;
    const wasPressed = this.input[action];
    const sources = this._inputSources[action];
    if (pressed) sources.add(source);
    else sources.delete(source);
    this.input[action] = sources.size > 0;
    if (action === 'charge' && wasPressed && !this.input[action]) {
      if (canceled || this.state !== 'playing') this.player.charge = 0;
      else this._releaseCharge();
    }
  }

  releaseInputs() {
    for (const action of Object.keys(this.input)) {
      this._inputSources[action].clear();
      this.input[action] = false;
    }
    this.player.charge = 0;
  }

  _installEvents() {
    if (typeof window === 'undefined') return;
    const bind = (target, event, handler, options) => {
      target.addEventListener(event, handler, options);
      this._listeners.push(() => target.removeEventListener(event, handler, options));
    };
    const keyMap = {
      ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
      ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
      Space: 'fire', KeyZ: 'fire', KeyX: 'charge',
    };
    const ignored = (event) => {
      const target = event.target;
      if (target?.closest?.('input, textarea, select, dialog[open], [contenteditable="true"]')) return true;
      return ['Enter', 'Space'].includes(event.code) && target?.closest?.('button, a');
    };
    bind(window, 'keydown', (event) => {
      if (ignored(event) || event.ctrlKey || event.metaKey || event.altKey) return;
      const action = keyMap[event.code];
      const canStart = ['menu', 'gameover', 'victory'].includes(this.state);
      const canPause = this.state === 'playing' || this.state === 'paused';
      if ((action && this.state === 'playing') ||
          (event.code === 'Enter' && (canStart || this.state === 'paused')) ||
          (event.code === 'Space' && canStart) ||
          (['KeyP', 'Escape'].includes(event.code) && canPause) ||
          (event.code === 'KeyR' && ['gameover', 'victory', 'paused'].includes(this.state))) event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'Enter' && this.state === 'paused') this.start();
      else if ((event.code === 'Enter' || event.code === 'Space') && ['menu', 'gameover', 'victory'].includes(this.state)) this.start();
      else if (event.code === 'KeyP' || event.code === 'Escape') this.pause();
      else if (event.code === 'KeyR' && ['gameover', 'victory', 'paused'].includes(this.state)) this.restart();
      if (action && this.state === 'playing') this.setInput(action, true, `key:${event.code}`);
    });
    bind(window, 'keyup', (event) => {
      const action = keyMap[event.code];
      if (action) this.setInput(action, false, `key:${event.code}`);
    });
    const leave = () => {
      this.releaseInputs();
      if (this.state === 'playing') this.pause();
    };
    bind(window, 'blur', leave);
    if (typeof document !== 'undefined') bind(document, 'visibilitychange', () => {
      if (document.hidden) leave();
    });
    bind(window, 'resize', () => this.renderer?.resize?.(this.canvas));
  }

  destroy() {
    this._disposed = true;
    if (this._frameId !== null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._frameId);
    this._listeners.forEach((remove) => remove());
    this._listeners = [];
    this.releaseInputs();
  }

  update(seconds) {
    const dt = clamp(Number(seconds) || 0, 0, 0.05);
    this.modeTime += dt;
    if (this.state !== 'playing' || !dt) {
      if (dt && this.state !== 'paused') {
        this.shake = Math.max(0, this.shake - dt * 30);
        this.flash = Math.max(0, this.flash - dt * 3);
        this._updateParticles(dt);
      }
      return;
    }
    this.elapsed += dt;
    this.sector = Math.min(3, Math.floor(this.elapsed / 22) + 1);
    this.progress = this.boss ? 0.78 + 0.22 * (1 - this.boss.hp / this.boss.maxHp) : Math.min(0.78, this.elapsed / BOSS_TIME * 0.78);
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3);
    this._updatePlayer(dt);
    if (!this.boss && !this.bossDefeated && this.elapsed >= BOSS_TIME) this._spawnBoss();
    if (!this.boss) {
      this._spawnTimer -= dt;
      if (this._spawnTimer <= 0 && !this.bossDefeated) {
        this._spawnWave();
        this._spawnTimer += rand(2.0, 2.8) - this.sector * 0.22;
      }
    }
    this._updateEnemies(dt);
    this._updateBoss(dt);
    this._updateProjectiles(dt);
    this._updatePickups(dt);
    this._updateParticles(dt);
    this._collisions();
    this._emitTimer -= dt;
    if (this._emitTimer <= 0) {
      this._emitTimer = 0.08;
      this._emit();
    }
  }

  _updatePlayer(dt) {
    const p = this.player;
    let dx = Number(this.input.right) - Number(this.input.left);
    let dy = Number(this.input.down) - Number(this.input.up);
    const length = Math.hypot(dx, dy);
    if (length) { dx /= length; dy /= length; }
    p.x = clamp(p.x + dx * 360 * dt, 40, W - 75);
    p.y = clamp(p.y + dy * 360 * dt, 43, H - 43);
    p.thrust = dx;
    p.bank += (dy - p.bank) * Math.min(1, dt * 10);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.fireCooldown -= dt;
    if (this.input.fire && p.fireCooldown <= 0) this._fire();
    else if (!this.input.fire) p.fireCooldown = Math.max(0, p.fireCooldown);
    if (this.input.charge) {
      const previous = p.charge;
      p.charge = Math.min(1, p.charge + dt / 1.35);
      if (previous < 1 && p.charge === 1) this._sound('charge');
    }
  }

  _fire() {
    const p = this.player;
    const angles = p.weapon === 1 ? [0] : p.weapon === 2 ? [-0.045, 0.045] : [-0.105, 0, 0.105];
    for (const angle of angles) {
      this.bullets.push({
        x: p.x + 34, y: p.y, previousX: p.x + 34, previousY: p.y,
        vx: Math.cos(angle) * 880, vy: Math.sin(angle) * 880,
        radius: 4, damage: p.weapon === 3 ? 0.85 : 1, life: 1.7,
        charged: false,
      });
    }
    p.fireCooldown += 0.145;
    this._sound('shoot');
  }

  _releaseCharge() {
    const p = this.player;
    const charge = p.charge;
    p.charge = 0;
    if (charge < 0.2) return;
    this.bullets.push({
      x: p.x + 36, y: p.y, previousX: p.x + 36, previousY: p.y,
      vx: 1060, vy: 0, radius: 9 + charge * 17,
      damage: 3 + charge * 12, life: 1.6, charged: true,
      power: charge, pierce: charge > 0.85 ? 3 : 1, hitIds: new Set(),
    });
    this.shake = Math.max(this.shake, charge * 3);
    this._sound('charge');
  }

  _spawnWave() {
    const formation = Math.random();
    const count = this.sector === 1 ? 3 : 4;
    const center = rand(110, H - 110);
    const seed = rand(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      let type = formation < 0.34 ? 'zigzag' : 'scout';
      if (this.sector >= 2 && i === count - 1 && Math.random() < 0.55) type = 'heavy';
      if (formation > 0.78) type = i % 2 ? 'turret' : 'scout';
      const y = formation > 0.78 ? 85 + i * 130 : clamp(center + (i - (count - 1) / 2) * 58, 55, H - 55);
      const stats = {
        scout: [20, 2, 155, 100], zigzag: [22, 3, 170, 150],
        turret: [25, 4, 105, 200], heavy: [35, 9, 90, 350],
      }[type];
      this.enemies.push({
        id: Symbol('enemy'), type, x: W + 60 + i * 76, y, baseY: y,
        radius: stats[0], hp: stats[1], maxHp: stats[1],
        speed: stats[2] + (this.sector - 1) * 15, value: stats[3],
        seed: seed + i * 0.45, age: 0, shotTimer: rand(1.4, 2.6), lastHit: 0,
      });
    }
  }

  _updateEnemies(dt) {
    for (const enemy of this.enemies) {
      enemy.age += dt;
      enemy.x -= enemy.speed * dt;
      enemy.lastHit = Math.max(0, enemy.lastHit - dt);
      if (enemy.type === 'zigzag') enemy.y = clamp(enemy.baseY + Math.sin(enemy.age * 2.6 + enemy.seed) * 55, 42, H - 42);
      if (enemy.type === 'scout') enemy.y = clamp(enemy.baseY + Math.sin(enemy.age * 1.8 + enemy.seed) * 22, 42, H - 42);
      enemy.shotTimer -= dt;
      if (enemy.shotTimer <= 0 && enemy.x < W - 45 && enemy.x > this.player.x + 90) {
        const angle = Math.atan2(this.player.y - enemy.y, this.player.x - enemy.x);
        const speed = 195 + this.sector * 15;
        this._enemyShot(enemy.x - 15, enemy.y, angle, speed);
        if (enemy.type === 'heavy' || enemy.type === 'turret') {
          this._enemyShot(enemy.x - 15, enemy.y, angle - 0.22, speed);
          this._enemyShot(enemy.x - 15, enemy.y, angle + 0.22, speed);
        }
        enemy.shotTimer = enemy.type === 'heavy' ? 2.0 : rand(2.5, 3.6);
      }
    }
    this.enemies = this.enemies.filter((enemy) => enemy.x > -90 && enemy.hp > 0);
  }

  _enemyShot(x, y, angle, speed, radius = 5) {
    this.enemyBullets.push({ x, y, previousX: x, previousY: y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius, damage: 1, life: 8, age: 0 });
  }

  _spawnBoss() {
    this.enemies.forEach((enemy) => this._explode(enemy.x, enemy.y, '#fa9b55', 10));
    this.enemies = [];
    this.enemyBullets = [];
    this.boss = {
      id: Symbol('boss'), x: W + 130, y: H / 2, radius: 86,
      hp: 260, maxHp: 260, age: 0, phase: 1, shotTimer: 2.4,
      sweepTimer: 5.5, lastHit: 0, entering: true,
    };
    this.player.invulnerable = Math.max(this.player.invulnerable, 2);
    this._sound('boss');
    this._emit();
  }

  _updateBoss(dt) {
    const boss = this.boss;
    if (!boss) return;
    boss.age += dt;
    boss.lastHit = Math.max(0, boss.lastHit - dt);
    boss.x = Math.max(1020, boss.x - 95 * dt);
    boss.entering = boss.x > 1020;
    boss.y = H / 2 + Math.sin(boss.age * 0.8) * (boss.phase === 3 ? 125 : 105);
    boss.phase = boss.hp / boss.maxHp > 0.66 ? 1 : boss.hp / boss.maxHp > 0.32 ? 2 : 3;
    if (boss.entering) return;
    boss.shotTimer -= dt;
    boss.sweepTimer -= dt;
    if (boss.shotTimer <= 0) {
      const angle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);
      const count = boss.phase + 2;
      for (let i = 0; i < count; i++) {
        this._enemyShot(boss.x - 72, boss.y, angle + (i - (count - 1) / 2) * 0.19, 205 + boss.phase * 15, 6);
      }
      boss.shotTimer = boss.phase === 3 ? 1.1 : 1.6;
    }
    if (boss.sweepTimer <= 0) {
      const gap = Math.floor(rand(1, 6));
      for (let i = 0; i < 8; i++) {
        if (i === gap || i === gap + 1) continue;
        this._enemyShot(boss.x - 50, 53 + i * 70, Math.PI, 195 + boss.phase * 13, 7);
      }
      boss.sweepTimer = boss.phase === 3 ? 4 : 5.5;
    }
  }

  _updateProjectiles(dt) {
    for (const list of [this.bullets, this.enemyBullets]) {
      for (const bullet of list) {
        bullet.previousX = bullet.x;
        bullet.previousY = bullet.y;
        bullet.x += bullet.vx * dt;
        bullet.y += bullet.vy * dt;
        bullet.life -= dt;
        bullet.age = (bullet.age || 0) + dt;
      }
    }
    const keep = (bullet) => bullet.life > 0 && bullet.x > -80 && bullet.x < W + 100 && bullet.y > -50 && bullet.y < H + 50;
    this.bullets = this.bullets.filter(keep);
    this.enemyBullets = this.enemyBullets.filter(keep);
  }

  _updatePickups(dt) {
    for (const pickup of this.pickups) {
      pickup.age += dt;
      pickup.x -= 88 * dt;
      pickup.y = pickup.baseY + Math.sin(pickup.age * 3) * 8;
    }
    this.pickups = this.pickups.filter((pickup) => pickup.x > -40);
  }

  _updateParticles(dt) {
    for (const particle of this.particles) {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= Math.max(0, 1 - dt * 2);
      particle.vy *= Math.max(0, 1 - dt * 2);
      particle.life -= dt;
    }
    this.particles = this.particles.filter((particle) => particle.life > 0);
  }

  _collisions() {
    for (const bullet of this.bullets) {
      if (bullet.life <= 0) continue;
      const targets = this.boss ? [...this.enemies, this.boss] : this.enemies;
      const hits = [];
      for (const target of targets) {
        if (target.hp <= 0 || bullet.hitIds?.has(target.id)) continue;
        const time = bulletHitTime(bullet, target);
        if (time !== null) hits.push({ target, time });
      }
      hits.sort((a, b) => a.time - b.time);
      for (const { target } of hits) {
        target.hp = Math.max(0, target.hp - bullet.damage);
        target.lastHit = 0.09;
        this._explode(bullet.x, bullet.y, bullet.charged ? '#96f6ff' : '#ffc778', bullet.charged ? 9 : 3, 0.2);
        if (bullet.charged) {
          bullet.hitIds.add(target.id);
          bullet.pierce -= 1;
          if (bullet.pierce <= 0) bullet.life = 0;
        } else bullet.life = 0;
        if (target.hp <= 0) {
          if (target === this.boss) this._defeatBoss();
          else this._defeatEnemy(target);
        }
        if (bullet.life <= 0 || this.state !== 'playing') break;
      }
      if (this.state !== 'playing') return;
    }
    this.enemies = this.enemies.filter((enemy) => enemy.hp > 0);
    if (this.player.invulnerable <= 0) {
      for (const bullet of this.enemyBullets) {
        if (bullet.life > 0 && bulletHits(bullet, this.player)) {
          bullet.life = 0;
          this._damagePlayer();
          break;
        }
      }
      if (this.player.invulnerable <= 0) {
        const enemy = this.enemies.find((target) => circlesOverlap(this.player, target));
        if (enemy) {
          this._explode(enemy.x, enemy.y, '#ffae64', 22);
          enemy.hp = 0;
          this._damagePlayer();
        } else if (this.boss && circlesOverlap(this.player, this.boss)) this._damagePlayer();
      }
    }
    if (this.state !== 'playing') return;
    for (const pickup of this.pickups) {
      if (!pickup.collected && circlesOverlap({ ...this.player, radius: 25 }, pickup)) {
        pickup.collected = true;
        if (pickup.type === 'repair') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
        else this.player.weapon = Math.min(3, this.player.weapon + 1);
        this._awardScore(150);
        this._explode(pickup.x, pickup.y, '#81f5d2', 18);
        this._sound('pickup');
        this._emit();
      }
    }
    this.pickups = this.pickups.filter((pickup) => !pickup.collected);
  }

  _awardScore(points) {
    this.score += points;
    this.best = Math.max(this.best, this.score);
  }

  _defeatEnemy(enemy) {
    this.kills += 1;
    this._awardScore(enemy.value || 100);
    this._explode(enemy.x, enemy.y, enemy.type === 'heavy' ? '#ff886b' : '#ffc176', enemy.type === 'heavy' ? 32 : 19);
    this.shake = Math.max(this.shake, enemy.type === 'heavy' ? 4 : 1.7);
    this._sound('explosion');
    const repair = this.player.hp < this.player.maxHp && this.kills % 7 === 0;
    const weapon = this.kills % 6 === 0;
    if (repair || weapon) {
      this.pickups.push({
        type: repair ? 'repair' : 'weapon', x: clamp(enemy.x, 80, W - 80),
        y: clamp(enemy.y, 65, H - 65), baseY: clamp(enemy.y, 65, H - 65), radius: 17, age: 0,
      });
    }
  }

  _damagePlayer() {
    if (this.state !== 'playing' || this.player.invulnerable > 0) return;
    this.player.hp = Math.max(0, this.player.hp - 1);
    this.player.invulnerable = 1.9;
    this.shake = 11;
    this.flash = 0.65;
    this._explode(this.player.x, this.player.y, '#71e7ff', 24);
    this._sound('hit');
    if (this.player.hp === 0) {
      this.releaseInputs();
      this._explode(this.player.x, this.player.y, '#ffa86a', 65);
      this.state = 'gameover';
      this._saveBest();
      this._sound('defeat');
    }
    this._emit();
  }

  _defeatBoss() {
    const boss = this.boss;
    if (!boss) return;
    this.bossDefeated = true;
    this._awardScore(5000);
    this._explode(boss.x, boss.y, '#ffb969', 100, 1.4);
    this.boss = null;
    this.enemyBullets = [];
    this.enemies = [];
    this.progress = 1;
    this.shake = 15;
    this.flash = 0.85;
    this.state = 'victory';
    this.releaseInputs();
    this._saveBest();
    this._sound('victory');
    this._emit();
  }

  _explode(x, y, color, count = 15, duration = 0.65) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(30, 210);
      const life = rand(duration * 0.4, duration);
      this.particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        life, maxLife: life, size: rand(1.5, 4.5), color,
      });
    }
    if (this.particles.length > 700) this.particles.splice(0, this.particles.length - 700);
  }

  _emit() {
    this.onChange({
      state: this.state, score: this.score, best: this.best,
      hp: this.player.hp, maxHp: this.player.maxHp, weapon: this.player.weapon,
      charge: this.player.charge, sector: this.sector, progress: this.progress,
      bossHp: this.boss?.hp ?? null, bossMaxHp: this.boss?.maxHp ?? null,
      elapsed: this.elapsed, kills: this.kills,
    });
  }
}
