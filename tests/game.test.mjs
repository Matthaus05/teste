import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../dist/game.mjs';
import { STAGES, POWERS, POWER_DROP_CYCLE } from '../dist/campaign.mjs';

function advance(game, seconds, step = 0.05) {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const dt = Math.min(remaining, step);
    game.update(dt);
    remaining -= dt;
  }
}

function newGame(t, options) {
  const game = new Game(options);
  t.after(() => game.destroy());
  return game;
}

function enemy(x, { hp = 3, y = 300, id = x } = {}) {
  return {
    id, type: 'turret', x, y, baseY: y, radius: 20,
    hp, maxHp: hp, age: 0, seed: 0, speed: 0,
    value: 100, shotTimer: Infinity, lastHit: 0,
  };
}

function hostileShot(x, y, overrides = {}) {
  return { x, y, vx: 0, vy: 0, radius: 5, damage: 1, life: 6, ...overrides };
}

function collect(game, type) {
  game.pickups.push({ type, x: game.player.x, y: game.player.y, baseY: game.player.y, radius: 17, age: 0 });
  game.update(0.001);
}

function replaceGlobal(t, key, descriptor) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, ...descriptor });
  t.after(() => {
    if (previous) Object.defineProperty(globalThis, key, previous);
    else delete globalThis[key];
  });
}

function keyboard(t) {
  const fakeWindow = new EventTarget();
  replaceGlobal(t, 'window', { value: fakeWindow });
  return (code, type = 'keydown') => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'code', { value: code });
    fakeWindow.dispatchEvent(event);
    return event;
  };
}

test('a new mission starts clean and restarting restores the ship and removes the previous battle', (t) => {
  const snapshots = [];
  const game = newGame(t, { onChange: (value) => snapshots.push(value) });
  assert.equal(game.state, 'menu');
  assert.equal(snapshots[0].state, 'menu');
  game.start();
  assert.equal(game.state, 'playing');
  game.player.hp = 1;
  game.player.weapon = 3;
  game.score = 2300;
  game.enemies.push(enemy(400));
  game.enemyBullets.push(hostileShot(700, 400));
  game.setInput('fire', true);
  advance(game, 0.2);
  game.restart();
  assert.equal(game.state, 'playing');
  assert.equal(game.player.hp, game.player.maxHp);
  assert.equal(game.player.weapon, 1);
  assert.equal(game.player.charge, 0);
  assert.equal(game.elapsed, 0);
  assert.equal(game.score, 0);
  assert.equal(game.sector, 1);
  assert.equal(game.input.fire, false);
  assert.equal(game.bullets.length + game.enemies.length + game.enemyBullets.length, 0);
  assert(game.best >= 2300);
});

test('diagonal movement has the same speed as moving along one axis and respects all screen edges', (t) => {
  const straight = newGame(t);
  const diagonal = newGame(t);
  straight.start();
  diagonal.start();
  straight.setInput('right', true);
  diagonal.setInput('right', true);
  diagonal.setInput('down', true);
  advance(straight, 0.4);
  advance(diagonal, 0.4);
  const straightDistance = straight.player.x - 180;
  const diagonalDistance = Math.hypot(diagonal.player.x - 180, diagonal.player.y - 300);
  assert(Math.abs(straightDistance - diagonalDistance) < 1e-8);
  assert(straightDistance > 100);
  diagonal.releaseInputs();
  diagonal.player.x = 41;
  diagonal.player.y = 44;
  diagonal.setInput('left', true);
  diagonal.setInput('up', true);
  diagonal.update(0.05);
  assert.equal(diagonal.player.x, 40);
  assert.equal(diagonal.player.y, 43);
  diagonal.releaseInputs();
  diagonal.player.x = diagonal.width - 76;
  diagonal.player.y = diagonal.height - 44;
  diagonal.setInput('right', true);
  diagonal.setInput('down', true);
  diagonal.update(0.05);
  assert.equal(diagonal.player.x, diagonal.width - 75);
  assert.equal(diagonal.player.y, diagonal.height - 43);
});

test('holding fire produces a controlled stream rather than one shot per update', (t) => {
  const game = newGame(t);
  game.start();
  game.setInput('fire', true);
  game.update(0.01);
  assert.equal(game.bullets.length, 1);
  advance(game, 0.1, 0.01);
  assert.equal(game.bullets.length, 1);
  advance(game, 0.89, 0.01);
  assert(game.bullets.length >= 6 && game.bullets.length <= 8);
  const before = game.bullets.length;
  game.setInput('fire', false);
  advance(game, 0.1, 0.01);
  assert.equal(game.bullets.length, before);
});

test('a fully charged shot pierces three enemies and awards each kill once', (t) => {
  const game = newGame(t);
  game.start();
  game.setInput('charge', true);
  advance(game, 1.4);
  assert.equal(game.player.charge, 1);
  game.enemies = [enemy(380), enemy(480), enemy(580)];
  game.setInput('charge', false);
  assert.equal(game.player.charge, 0);
  assert.equal(game.bullets.filter((bullet) => bullet.charged).length, 1);
  advance(game, 0.5);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.kills, 3);
  assert.equal(game.score, 300);
  advance(game, 0.2);
  assert.equal(game.score, 300);
});

test('fast projectiles still hit an enemy they cross between frames', (t) => {
  const game = newGame(t);
  game.start();
  game.enemies = [enemy(440, { hp: 1 })];
  game.bullets.push({ x: 300, y: 300, vx: 5000, vy: 0, radius: 4, damage: 1, life: 1 });
  game.update(0.05);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.score, 100);
});

test('a normal shot hits the nearest intersecting enemy regardless of creation order', (t) => {
  const game = newGame(t);
  game.start();
  game.enemies = [enemy(366, { hp: 1 }), enemy(326, { hp: 1 })];
  game.bullets.push({ x: 300, y: 300, vx: 880, vy: 0, radius: 4, damage: 1, life: 1 });
  game.update(0.05);
  assert.deepEqual(game.enemies.map((target) => target.id), [366]);
  assert.equal(game.kills, 1);
});

test('a charged beam uses its pierce limit on the nearest targets first', (t) => {
  const game = newGame(t);
  game.start();
  game.enemies = [enemy(600), enemy(500), enemy(450), enemy(400)];
  game.bullets.push({
    x: 300, y: 300, vx: 7000, vy: 0, radius: 26, damage: 15, life: 1,
    charged: true, pierce: 3, hitIds: new Set(),
  });
  game.update(0.05);
  assert.deepEqual(game.enemies.map((target) => target.id), [600]);
  assert.equal(game.kills, 3);
});

test('damage grants a grace period and reaching zero shield ends the mission', (t) => {
  const game = newGame(t);
  game.start();
  game.player.invulnerable = 0;
  game.enemyBullets = [hostileShot(180, 300), hostileShot(180, 300)];
  game.update(0.01);
  assert.equal(game.player.hp, 3);
  advance(game, 1);
  assert.equal(game.player.hp, 3);
  advance(game, 1);
  assert.equal(game.player.hp, 2);
  game.player.invulnerable = 0;
  game.player.hp = 1;
  game.enemyBullets = [hostileShot(game.player.x, game.player.y)];
  game.update(0.01);
  assert.equal(game.player.hp, 0);
  assert.equal(game.state, 'gameover');
});

test('pausing freezes the battle, releases held inputs and resumes without skipping time', (t) => {
  const game = newGame(t);
  game.start();
  game.setInput('right', true);
  game.setInput('charge', true);
  advance(game, 0.2);
  game.enemyBullets.push(hostileShot(700, 400, { vx: -200 }));
  game.pause();
  const before = { elapsed: game.elapsed, x: game.player.x, bulletX: game.enemyBullets[0].x };
  advance(game, 4);
  assert.equal(game.state, 'paused');
  assert.equal(game.elapsed, before.elapsed);
  assert.equal(game.player.x, before.x);
  assert.equal(game.enemyBullets[0].x, before.bulletX);
  assert.equal(game.player.charge, 0);
  assert(Object.values(game.input).every((pressed) => !pressed));
  game.start();
  game.update(0.05);
  assert.equal(game.state, 'playing');
  assert(Math.abs(game.elapsed - before.elapsed - 0.05) < 1e-8);
  assert.equal(game.player.x, before.x);
  assert(game.enemyBullets[0].x < before.bulletX);
});

test('each stage replaces waves with its own boss and victory requires all six bosses', (t) => {
  const sounds = [];
  const snapshots = [];
  const game = newGame(t, {
    onSound: (sound) => sounds.push(sound),
    onChange: (snapshot) => snapshots.push(snapshot),
  });
  game.start();
  game.player.invulnerable = 999;
  const defeated = [];
  assert.equal(STAGES.length, 6);
  assert.equal(new Set(STAGES.map((stage) => stage.boss.type)).size, STAGES.length);
  for (let index = 0; index < STAGES.length; index++) {
    assert.equal(game.stageIndex, index);
    assert.equal(game.sector, index + 1);
    game.enemies.push(enemy(800));
    game.enemyBullets.push(hostileShot(700, 400));
    game.stageElapsed = STAGES[index].waveDuration - 0.01;
    game.update(0.05);
    assert(game.boss);
    assert.equal(game.boss.type, STAGES[index].boss.type);
    assert.equal(game.boss.name, STAGES[index].boss.name);
    assert.equal(game.enemies.length, 0);
    assert.equal(game.enemyBullets.length, 0);
    const boss = game.boss;
    defeated.push(boss.type);
    boss.x = 1020;
    boss.hp = 1;
    game.bullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, radius: 10, damage: 2, life: 1 });
    game.update(0.01);
    assert.equal(game.boss, null);
    assert.equal(game.state, index === STAGES.length - 1 ? 'victory' : 'intermission');
    assert(Math.abs(game.progress - (index + 1) / STAGES.length) < 1e-8);
    const stageScore = game.score;
    const finishTime = game.elapsed;
    advance(game, 1);
    assert.equal(game.score, stageScore);
    assert.equal(game.elapsed, finishTime);
    if (index < STAGES.length - 1) {
      game.player.hp = 2;
      game.player.weapon = 3;
      game.player.bombs = 0;
      game.start();
      assert.equal(game.state, 'playing');
      assert.equal(game.player.hp, 3);
      assert.equal(game.player.weapon, 3);
      assert.equal(game.player.bombs, 1);
      assert.equal(game.stageElapsed, 0);
      assert.equal(game.enemies.length + game.enemyBullets.length + game.bullets.length, 0);
    }
  }
  assert.equal(game.state, 'victory');
  assert.equal(game.progress, 1);
  assert.deepEqual(game.defeatedBosses, defeated);
  assert.equal(sounds.filter((sound) => sound === 'boss').length, STAGES.length);
  const finishTime = game.elapsed;
  const finalScore = game.score;
  advance(game, 2);
  assert.equal(game.score, finalScore);
  assert.equal(game.elapsed, finishTime);
  assert.equal(sounds.filter((sound) => sound === 'victory').length, 1);
  assert(snapshots.some((snapshot) => snapshot.state === 'victory' && snapshot.progress === 1));
});

test('collecting upgrades increases weapon strength and repair never exceeds maximum shield', (t) => {
  const game = newGame(t);
  game.start();
  const pickup = (type) => ({ type, x: game.player.x, y: game.player.y, baseY: game.player.y, radius: 17, age: 0 });
  game.pickups.push(pickup('weapon'));
  game.update(0.01);
  assert.equal(game.player.weapon, 2);
  assert.equal(game.pickups.length, 0);
  game.player.weapon = 3;
  game.pickups.push(pickup('weapon'), pickup('repair'));
  game.update(0.01);
  assert.equal(game.player.weapon, 3);
  assert.equal(game.player.hp, game.player.maxHp);
  game.player.hp = 2;
  game.pickups.push(pickup('repair'));
  game.update(0.01);
  assert.equal(game.player.hp, 3);
});

test('the record survives a new game and a lower score cannot replace it', (t) => {
  const values = new Map();
  replaceGlobal(t, 'localStorage', { value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } });
  const first = newGame(t);
  first.start();
  first.score = 9200;
  first.player.hp = 1;
  first.player.invulnerable = 0;
  first.enemyBullets.push(hostileShot(180, 300));
  first.update(0.01);
  const second = newGame(t);
  assert.equal(second.best, 9200);
  second.start();
  second.score = 100;
  second.restart();
  assert.equal(second.best, 9200);
  assert.equal(values.get('rtype-nebula-best'), '9200');
});

test('unavailable browser storage cannot prevent starting or finishing a mission', (t) => {
  replaceGlobal(t, 'localStorage', { get() { throw new Error('Storage access denied'); } });
  const game = newGame(t);
  assert.equal(game.best, 0);
  assert.doesNotThrow(() => game.start());
  game.score = 300;
  game.player.hp = 1;
  game.player.invulnerable = 0;
  game.enemyBullets.push(hostileShot(180, 300));
  assert.doesNotThrow(() => game.update(0.01));
  assert.equal(game.state, 'gameover');
  assert.equal(game.best, 300);
});

test('keyboard movement works after focusing a button while native button keys and open dialogs remain usable', (t) => {
  const fakeWindow = new EventTarget();
  replaceGlobal(t, 'window', { value: fakeWindow });
  const game = newGame(t);
  game.start();
  const target = (kind) => ({ closest: (selector) => selector.includes(kind) ? {} : null });
  const key = (code, focus, type = 'keydown') => {
    const event = new Event(type, { cancelable: true });
    Object.defineProperties(event, { code: { value: code }, target: { value: focus } });
    fakeWindow.dispatchEvent(event);
    return event;
  };
  const button = target('button');
  assert(key('KeyD', button).defaultPrevented);
  game.update(0.05);
  assert(game.player.x > 180);
  key('KeyD', button, 'keyup');
  assert.equal(game.input.right, false);
  assert.equal(key('Space', button).defaultPrevented, false);
  assert.equal(game.input.fire, false);
  assert.equal(key('KeyX', target('dialog[open]')).defaultPrevented, false);
  assert.equal(game.input.charge, false);
  assert.equal(key('KeyP', button).defaultPrevented, true);
  assert.equal(game.state, 'paused');
});

test('equivalent keys and touch controls keep an action active until its last source is released', (t) => {
  const key = keyboard(t);
  const game = newGame(t);
  game.start();
  key('KeyW');
  key('ArrowUp');
  key('KeyW', 'keyup');
  game.update(0.05);
  assert.equal(game.input.up, true);
  assert(game.player.y < 300);
  key('ArrowUp', 'keyup');
  assert.equal(game.input.up, false);

  key('Space');
  key('KeyZ');
  key('Space', 'keyup');
  assert.equal(game.input.fire, true);
  game.setInput('fire', true, 'pointer:1');
  key('KeyZ', 'keyup');
  assert.equal(game.input.fire, true);
  game.cancelInput('fire', 'pointer:1');
  assert.equal(game.input.fire, false);
  game.setInput('toString', true);
  assert.equal(Object.hasOwn(game.input, 'toString'), false);
});

test('canceling the final charge input discards the charge while canceling another source preserves it', (t) => {
  const game = newGame(t);
  game.start();
  game.setInput('charge', true, 'key:KeyX');
  advance(game, 1.4);
  game.setInput('charge', true, 'pointer:1');
  game.cancelInput('charge', 'pointer:1');
  assert.equal(game.player.charge, 1);
  assert.equal(game.input.charge, true);
  assert.equal(game.bullets.length, 0);
  game.setInput('charge', false, 'key:KeyX');
  assert.equal(game.bullets.filter((bullet) => bullet.charged).length, 1);

  game.setInput('charge', true, 'pointer:2');
  advance(game, 0.4);
  const before = game.bullets.length;
  game.cancelInput('charge', 'pointer:2');
  assert.equal(game.player.charge, 0);
  assert.equal(game.input.charge, false);
  assert.equal(game.bullets.length, before);
});

test('holding fire has the same cadence at 30, 60 and 120 updates per second', (t) => {
  const counts = [30, 60, 120].map((frequency) => {
    let shots = 0;
    const game = newGame(t, { onSound: (sound) => { if (sound === 'shoot') shots += 1; } });
    game.start();
    game._spawnTimer = Infinity;
    game.setInput('fire', true);
    advance(game, 10, 1 / frequency);
    return shots;
  });
  assert(Math.max(...counts) - Math.min(...counts) <= 1, `Shot counts: ${counts}`);
  assert(counts.every((count) => count >= 68 && count <= 70));
});

test('a stale tab cannot overwrite a higher record saved by another tab', (t) => {
  const values = new Map();
  replaceGlobal(t, 'localStorage', { value: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  } });
  const first = newGame(t);
  const stale = newGame(t);
  first.start();
  stale.start();
  first.score = 9000;
  first.restart();
  stale.score = 100;
  stale.restart();
  assert.equal(values.get('rtype-nebula-best'), '9000');
  assert.equal(stale.best, 9000);
});

test('arrow keys keep their native scrolling behavior outside an active mission', (t) => {
  const key = keyboard(t);
  const game = newGame(t);
  assert.equal(key('ArrowDown').defaultPrevented, false);
  game.start();
  assert.equal(key('ArrowDown').defaultPrevented, true);
  game.pause();
  assert.equal(key('ArrowDown').defaultPrevented, false);
  assert.equal(game.input.down, false);
});

test('temporary weapons replace one another, produce distinct shots and expire back to the upgraded blaster', (t) => {
  const game = newGame(t);
  game.start();
  game._spawnTimer = Infinity;
  game.player.weapon = 3;
  for (const type of ['laser', 'spread', 'homing']) {
    game.bullets = [];
    collect(game, type);
    assert.equal(game.player.power, type);
    assert(game.player.powerTime >= POWERS[type].duration - 0.01);
    game.player.fireCooldown = 0;
    game.setInput('fire', true);
    game.update(0.01);
    game.setInput('fire', false);
    assert(game.bullets.length > 0);
    assert(game.bullets.every((bullet) => bullet.kind === type));
    if (type === 'spread') assert.equal(game.bullets.length, 5);
    if (type === 'laser') assert(game.bullets.every((bullet) => bullet.pierce === 3));
  }
  advance(game, POWERS.homing.duration + 0.1);
  assert.equal(game.player.power, 'blaster');
  assert.equal(game.player.powerTime, 0);
  assert.equal(game.player.weapon, 3);
});

test('laser pierces three enemies and guided missiles actually turn toward a target', (t) => {
  const laser = newGame(t);
  laser.start();
  laser._spawnTimer = Infinity;
  collect(laser, 'laser');
  laser.enemies = [380, 480, 580, 680].map((x) => enemy(x, { hp: 1 }));
  laser.setInput('fire', true);
  laser.update(0.01);
  laser.setInput('fire', false);
  advance(laser, 0.65);
  assert.deepEqual(laser.enemies.map((target) => target.id), [680]);
  assert.equal(laser.kills, 3);

  const guided = newGame(t);
  guided.start();
  guided._spawnTimer = Infinity;
  collect(guided, 'homing');
  guided.enemies = [enemy(700, { y: 100, hp: 100 })];
  guided.setInput('fire', true);
  guided.update(0.01);
  guided.setInput('fire', false);
  advance(guided, 0.2);
  assert(guided.bullets.some((bullet) => bullet.kind === 'homing' && bullet.vy < -20 && bullet.y < 290));
});

test('rapid fire increases cadence and combines with a temporary weapon', (t) => {
  const counts = [false, true].map((rapid) => {
    let shots = 0;
    const game = newGame(t, { onSound: (sound) => { if (sound === 'shoot') shots++; } });
    game.start();
    game._spawnTimer = Infinity;
    collect(game, 'laser');
    if (rapid) collect(game, 'rapid');
    game.setInput('fire', true);
    advance(game, 5);
    assert.equal(game.player.power, 'laser');
    return shots;
  });
  assert(counts[1] >= counts[0] * 1.6, `normal/rapid shot counts: ${counts}`);
});

test('barrier absorbs two impacts before damage reaches the ship and expires on time', (t) => {
  const game = newGame(t);
  game.start();
  game._spawnTimer = Infinity;
  collect(game, 'shield');
  assert.equal(game.player.shieldHits, 2);
  for (let hit = 0; hit < 3; hit++) {
    game.player.invulnerable = 0;
    game.enemyBullets = [hostileShot(game.player.x, game.player.y)];
    game.update(0.01);
    assert.equal(game.player.hp, hit < 2 ? 4 : 3);
  }
  collect(game, 'shield');
  advance(game, POWERS.shield.duration + 0.1);
  assert.equal(game.player.shieldTime, 0);
  assert.equal(game.player.shieldHits, 0);
});

test('bomb clears hostile fire, damages visible targets, costs one charge per press and respects the inventory cap', (t) => {
  const game = newGame(t);
  assert.equal(game.player.bombs, 2);
  game.useBomb();
  assert.equal(game.player.bombs, 2);
  game.start();
  game._spawnTimer = Infinity;
  game.enemies = [enemy(600, { hp: 5 }), enemy(1400, { hp: 5 })];
  game.enemyBullets = [hostileShot(500, 300), hostileShot(600, 200)];
  game.setInput('bomb', true, 'key:KeyC');
  assert.equal(game.player.bombs, 1);
  assert.equal(game.enemyBullets.length, 0);
  assert(!game.enemies.some((target) => target.id === 600 && target.hp > 0));
  assert.equal(game.enemies.find((target) => target.id === 1400).hp, 5);
  const score = game.score;
  game.setInput('bomb', true, 'key:KeyC');
  assert.equal(game.player.bombs, 1);
  assert.equal(game.score, score);
  game.setInput('bomb', false, 'key:KeyC');
  collect(game, 'bomb'); collect(game, 'bomb'); collect(game, 'bomb');
  assert.equal(game.player.bombs, 3);
  game.pause();
  game.useBomb();
  assert.equal(game.player.bombs, 3);
});

test('bomb damages an engaged boss but cannot hit an offscreen boss or be used with no ammunition', (t) => {
  const game = newGame(t);
  game.start();
  game._spawnBoss();
  const initialHp = game.boss.hp;
  game.useBomb();
  assert.equal(game.boss.hp, initialHp);
  game.boss.x = 1020;
  game.boss.entering = false;
  game.useBomb();
  assert.equal(game.boss.hp, initialHp - 90);
  assert.equal(game.player.bombs, 0);
  game.useBomb();
  assert.equal(game.boss.hp, initialHp - 90);
});

test('a bomb can finish a boss without losing stage progress and its visual pulse fades during the interval', (t) => {
  const game = newGame(t);
  game.start();
  game._spawnBoss();
  game.boss.x = 1020;
  game.boss.hp = 80;
  game.useBomb();
  assert.equal(game.state, 'intermission');
  assert.equal(game.boss, null);
  assert.equal(game.progress, 1 / STAGES.length);
  assert.equal(game.stageProgress, 1);
  assert.equal(game.defeatedBosses.length, 1);
  assert.equal(game.player.bombs, 1);
  advance(game, 1.5);
  assert.equal(game.bombPulse, 0);
  assert.equal(game.progress, 1 / STAGES.length);
});

test('every new power is obtainable from the actual enemy drop cycle', (t) => {
  const game = newGame(t);
  game.start();
  game._spawnTimer = Infinity;
  const found = new Set();
  for (let index = 1; index <= 60; index++) {
    game.enemies = [enemy(400, { hp: 1, id: index })];
    game.bullets = [{ x: 400, y: 300, vx: 0, vy: 0, radius: 4, damage: 1, life: 1 }];
    game.update(0.001);
    for (const pickup of game.pickups) found.add(pickup.type);
    game.pickups = [];
  }
  for (const type of POWER_DROP_CYCLE) assert(found.has(type), `Missing drop: ${type}`);
});

test('all power timers freeze in pause and between stages', (t) => {
  const game = newGame(t);
  game.start();
  game._spawnTimer = Infinity;
  collect(game, 'homing'); collect(game, 'rapid'); collect(game, 'shield');
  const timers = () => [game.player.powerTime, game.player.rapidTime, game.player.shieldTime];
  game.pause();
  const paused = timers();
  advance(game, 3);
  assert.deepEqual(timers(), paused);
  game.start();
  game._spawnBoss();
  game.boss.x = 1020;
  game.boss.hp = 1;
  game.bullets = [{ x: game.boss.x, y: game.boss.y, vx: 0, vy: 0, radius: 10, damage: 2, life: 1 }];
  game.update(0.01);
  assert.equal(game.state, 'intermission');
  const betweenStages = timers();
  advance(game, 3);
  assert.deepEqual(timers(), betweenStages);
});

test('all six bosses attack, carrier sends support, forge warns before firing and prism shots bounce', (t) => {
  for (let stageIndex = 0; stageIndex < STAGES.length; stageIndex++) {
    const game = newGame(t);
    game.start();
    game.stageIndex = stageIndex;
    game.sector = stageIndex + 1;
    game.player.invulnerable = 999;
    game._spawnBoss();
    game.boss.x = 1020;
    game.boss.entering = false;
    let sawBullet = false, sawSupport = false, sawWarning = false, sawBeam = false, sawBounce = false;
    const positions = [];
    for (let frame = 0; frame < 240; frame++) {
      game.update(0.05);
      positions.push(game.boss.y);
      sawBullet ||= game.enemyBullets.length > 0;
      sawSupport ||= game.enemies.length > 0;
      sawWarning ||= Boolean(game.boss.telegraph);
      sawBeam ||= game.enemyBullets.some((bullet) => bullet.kind === 'beam');
      sawBounce ||= game.enemyBullets.some((bullet) => bullet.kind === 'ricochet' && bullet.bounces > 0);
      for (const bullet of game.enemyBullets) assert(Number.isFinite(bullet.x) && Number.isFinite(bullet.y));
    }
    assert(sawBullet, `Boss does not attack: ${game.stage.boss.type}`);
    if (game.boss.type === 'carrier') assert(sawSupport);
    if (game.boss.type === 'serpent') assert(Math.max(...positions) - Math.min(...positions) > 200);
    if (game.boss.type === 'forge') assert(sawWarning && sawBeam);
    if (game.boss.type === 'prism') assert(sawBounce);
  }
  const game = newGame(t);
  game.start();
  game._spawnTimer = Infinity;
  game.enemyBullets = [hostileShot(800, 590, { vy: 300, bounces: 2, kind: 'ricochet' })];
  game.update(0.05);
  assert(game.enemyBullets[0].vy < 0);
  assert.equal(game.enemyBullets[0].bounces, 1);
});
