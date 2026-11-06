import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../dist/game.mjs';

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

test('the boss replaces normal waves and defeating it completes the mission exactly once', (t) => {
  const sounds = [];
  const snapshots = [];
  const game = newGame(t, {
    onSound: (sound) => sounds.push(sound),
    onChange: (snapshot) => snapshots.push(snapshot),
  });
  game.start();
  game.enemies.push(enemy(800));
  game.enemyBullets.push(hostileShot(700, 400));
  game.elapsed = 65.99;
  game.update(0.05);
  assert.equal(game.sector, 3);
  assert(game.boss);
  assert.equal(game.enemies.length, 0);
  assert.equal(game.enemyBullets.length, 0);
  assert(sounds.includes('boss'));
  const boss = game.boss;
  boss.x = 1020;
  boss.hp = 1;
  game.bullets.push({ x: boss.x, y: boss.y, vx: 0, vy: 0, radius: 10, damage: 2, life: 1 });
  game.update(0.01);
  assert.equal(game.state, 'victory');
  assert.equal(game.boss, null);
  assert.equal(game.progress, 1);
  assert.equal(game.score, 5000);
  const finishTime = game.elapsed;
  advance(game, 2);
  assert.equal(game.score, 5000);
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
