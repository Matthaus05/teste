import { Game } from './game.mjs';
import { Renderer } from './render.mjs';
import { STAGES, POWERS } from './campaign.mjs';

const $ = (id) => document.getElementById(id);
const formatScore = (value) => Math.max(0, Math.floor(value)).toString().padStart(6, '0');
const arcade = $('arcade');
const overlay = $('game-overlay');
const manual = $('manual');
let previousState;
let game;
let muted = false;
try { muted = localStorage.getItem('rtype-nebula-muted') === 'true'; } catch {}

class AudioSystem {
  constructor() { this.context = null; this.lastShot = 0; this.voices = new Set(); }
  unlock() {
    if (muted) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context ||= new AudioContext();
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    } catch {}
  }
  tone(frequency, endFrequency, duration, type = 'sine', volume = .05, delay = 0) {
    if (!this.context || muted || this.context.state !== 'running') return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const voice = { oscillator, gain };
    this.voices.add(voice);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(gain); gain.connect(this.context.destination);
    oscillator.start(now); oscillator.stop(now + duration + .01);
  }
  silence() {
    for (const { oscillator, gain } of this.voices) {
      try { oscillator.stop(); } catch {}
      oscillator.disconnect();
      gain.disconnect();
    }
    this.voices.clear();
  }
  play(name) {
    if (muted || !this.context) return;
    const now = this.context.currentTime;
    if (name === 'shoot') {
      if (now - this.lastShot < .095) return;
      this.lastShot = now;
      this.tone(850, 240, .07, 'triangle', .026);
    } else if (name === 'charge') {
      this.tone(260, 1100, .3, 'sine', .055);
      this.tone(520, 1800, .3, 'triangle', .025);
    } else if (name === 'explosion') {
      this.tone(135, 26, .22, 'sawtooth', .037);
      this.tone(80, 20, .3, 'triangle', .06);
    } else if (name === 'hit') {
      this.tone(240, 45, .2, 'square', .04);
    } else if (name === 'pickup') {
      [520, 780, 1040].forEach((f, i) => this.tone(f, f, .13, 'sine', .045, i * .07));
    } else if (name === 'boss') {
      [0, .24, .48].forEach((delay) => this.tone(170, 90, .2, 'sawtooth', .04, delay));
    } else if (name === 'bomb') {
      this.tone(80, 24, .65, 'sawtooth', .055);
      this.tone(950, 90, .5, 'triangle', .05);
    } else if (name === 'stage') {
      [440, 554, 659].forEach((f, i) => this.tone(f, f, .22, 'triangle', .045, i * .11));
    } else if (name === 'victory') {
      [392, 494, 587, 784].forEach((f, i) => this.tone(f, f, .3, 'triangle', .06, i * .13));
    } else if (name === 'defeat') {
      [330, 247, 165].forEach((f, i) => this.tone(f, f / 1.5, .35, 'triangle', .06, i * .18));
    }
  }
}
const audio = new AudioSystem();

function renderStatus(snapshot) {
  const { state, score, best, hp, maxHp, weapon, charge, sector, progress, bossHp, bossMaxHp } = snapshot;
  const stageIndex = snapshot.stageIndex ?? Math.max(0, (sector || 1) - 1);
  const stage = STAGES[stageIndex] || STAGES[0];
  const stageCount = snapshot.stageCount || STAGES.length;
  const stageNumber = String(stageIndex + 1).padStart(2, '0');
  const power = POWERS[snapshot.power] || POWERS.blaster;
  const bombs = snapshot.bombs ?? 2;
  arcade.style.setProperty('--stage-color', stage.color);
  $('score').textContent = formatScore(score);
  $('best-score').textContent = formatScore(best);
  $('sector-name').textContent = snapshot.stageName || stage.name;
  $('stage-counter').textContent = `FASE ${stageNumber} / ${String(stageCount).padStart(2, '0')}`;
  $('sector-number').textContent = stageNumber;
  $('shield').setAttribute('aria-label', `${hp} de ${maxHp} escudos`);
  [...$('shield').children].forEach((cell, index) => cell.classList.toggle('empty', index >= hp));
  $('weapon-name').textContent = snapshot.power && snapshot.power !== 'blaster' ? power.name : `BLASTER ${['I', 'II', 'III'][Math.min(2, weapon - 1)] || 'I'}`;
  $('weapon-name').style.color = power.color;
  $('power-timer').hidden = !(snapshot.powerTime > 0);
  $('power-timer').textContent = `${Math.ceil(snapshot.powerTime || 0)}s`;
  $('bomb-count').textContent = String(bombs);
  $('touch-bomb-count').textContent = `×${bombs}`;
  $('bomb-button').disabled = state !== 'playing' || bombs <= 0;
  $('touch-bomb').disabled = state !== 'playing' || bombs <= 0;
  $('bomb-button').setAttribute('aria-label', `Usar bomba nova. ${bombs} disponíveis. Atalho C.`);
  $('touch-bomb').setAttribute('aria-label', `Usar bomba nova. ${bombs} disponíveis.`);
  const effects = [];
  if (snapshot.rapidTime > 0) effects.push({ type: 'rapid', label: `${POWERS.rapid.symbol} ${Math.ceil(snapshot.rapidTime)}s`, title: 'Tiro rápido' });
  if (snapshot.shieldTime > 0 && snapshot.shieldHits > 0) effects.push({ type: 'shield', label: `${POWERS.shield.symbol} ${snapshot.shieldHits} · ${Math.ceil(snapshot.shieldTime)}s`, title: 'Barreira: impactos restantes e duração' });
  $('active-effects').hidden = effects.length === 0;
  $('active-effects').replaceChildren(...effects.map((effect) => {
    const badge = document.createElement('span');
    badge.style.color = POWERS[effect.type].color;
    badge.textContent = effect.label;
    badge.title = effect.title;
    badge.setAttribute('aria-label', `${effect.title}: ${effect.label}`);
    return badge;
  }));
  $('charge-fill').style.width = `${Math.max(0, Math.min(1, charge)) * 100}%`;
  $('charge-label').textContent = charge >= 1 ? 'CARGA MÁXIMA — SOLTE X' : charge > 0 ? 'CARREGANDO CANHÃO' : 'CANHÃO PRONTO';
  $('mission-progress').style.width = `${progress * 100}%`;
  $('boss-warning').hidden = !(bossMaxHp && bossHp > 0 && state === 'playing');
  $('boss-name').textContent = snapshot.bossName || stage.boss.name;
  $('boss-health').style.width = `${bossMaxHp ? Math.max(0, bossHp / bossMaxHp * 100) : 0}%`;
  $('flight-status').innerHTML = `<i></i> ${state === 'playing' ? 'MISSÃO EM CURSO' : state === 'paused' ? 'VOO EM ESPERA' : state === 'intermission' ? 'ROTA LIBERADA' : state === 'victory' ? 'CAMPANHA CONCLUÍDA' : state === 'gameover' ? 'SINAL PERDIDO' : 'AGUARDANDO PILOTO'}`;
  $('pause-button').disabled = !['playing', 'paused'].includes(state);
  $('pause-button').setAttribute('aria-label', state === 'paused' ? 'Retomar jogo' : 'Pausar jogo');
  $('pause-button').title = state === 'paused' ? 'Retomar (P)' : 'Pausar (P)';
  if (previousState === state) return;
  const enteringMission = state === 'playing' && ['menu', 'intermission'].includes(previousState);
  previousState = state;
  if (state === 'paused') audio.silence();
  arcade.dataset.state = state;
  overlay.hidden = state === 'playing';
  if (enteringMission) requestAnimationFrame(() => {
    const bounds = arcade.getBoundingClientRect();
    if (bounds.bottom > innerHeight || bounds.top < 0) arcade.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  });
  $('restart-button').hidden = state !== 'paused';
  $('result-score').hidden = !['gameover', 'victory'].includes(state);
  $('stage-briefing-panel').hidden = state !== 'intermission';
  $('campaign-features').hidden = state !== 'menu';
  $('start-hint').hidden = !['menu', 'intermission'].includes(state);
  $('start-hint').innerHTML = state === 'intermission' ? 'PRESSIONE <kbd>ENTER</kbd> PARA CONTINUAR' : 'PRESSIONE <kbd>ENTER</kbd> PARA DECOLAR';
  $('final-score').textContent = formatScore(score);
  const content = {
    menu: ['TRANSMISSÃO RECEBIDA', 'O ÚLTIMO SINAL<br>VEIO DE <em>ÓRION.</em>', 'Seis rotas. Seis ameaças diferentes.<br>Arme sua nave e atravesse a fronteira.', 'INICIAR CAMPANHA'],
    intermission: [`FASE ${stageNumber} / ${String(stageCount).padStart(2, '0')} CONCLUÍDA`, 'ROTA LIBERADA.<br><em>O VOO CONTINUA.</em>', `${stage.boss.name} foi derrotado.<br>Ao partir: +1 ponto de escudo e +1 bomba.`, 'PRÓXIMA FASE'],
    paused: ['TRANSMISSÃO EM ESPERA', 'UM MOMENTO<br>ENTRE <em>ESTRELAS.</em>', 'Seu voo está pausado.<br>Órion estará aqui quando você voltar.', 'RETOMAR MISSÃO'],
    gameover: ['CONEXÃO INTERROMPIDA', 'PERDEMOS<br>SEU <em>SINAL.</em>', 'O espaço ainda guarda seus segredos.<br>Uma nova decolagem. Uma nova chance.', 'TENTAR NOVAMENTE'],
    victory: ['SEIS ROTAS. UMA VITÓRIA.', 'O VAZIO PERDEU<br>SEU <em>IMPÉRIO.</em>', 'Os seis chefes caíram. A fronteira está livre.<br>O universo vai lembrar deste voo.', 'JOGAR NOVAMENTE'],
  }[state];
  if (content) {
    $('overlay-kicker').innerHTML = `<span class="signal-line"></span> ${content[0]}`;
    $('overlay-title').innerHTML = content[1];
    $('overlay-description').innerHTML = content[2];
    $('play-label').textContent = content[3];
  }
  if (state === 'intermission') {
    const nextStage = STAGES[stageIndex + 1];
    $('next-stage-name').textContent = snapshot.nextStageName || nextStage?.name || 'FRONTEIRA PROTEGIDA';
    $('stage-briefing').textContent = nextStage?.briefing || '';
  }
}

$('manual-powers').replaceChildren(...Object.entries(POWERS).filter(([key]) => key !== 'blaster').map(([, power]) => {
  const row = document.createElement('div');
  row.className = 'manual-power';
  const icon = document.createElement('b');
  icon.textContent = power.symbol;
  icon.style.color = power.color;
  const detail = document.createElement('div');
  const title = document.createElement('strong');
  title.textContent = `${power.name}${power.duration ? ` · ${power.duration}s` : ''}`;
  const description = document.createElement('p');
  description.textContent = power.description;
  detail.append(title, description);
  row.append(icon, detail);
  return row;
}));
$('campaign-list').replaceChildren(...STAGES.map((stage, index) => {
  const item = document.createElement('li');
  const title = document.createElement('strong');
  title.textContent = `${String(index + 1).padStart(2, '0')} / ${stage.name}`;
  title.style.color = stage.color;
  const boss = document.createElement('span');
  boss.textContent = stage.boss.name;
  item.append(title, boss);
  return item;
}));

game = new Game({ canvas: $('game'), renderer: new Renderer($('game')), onChange: renderStatus, onSound: (name) => audio.play(name) });
game.setMuted(muted);

function updateSoundButton() {
  $('sound-button').classList.toggle('muted', muted);
  $('sound-button').setAttribute('aria-pressed', String(!muted));
  $('sound-button').setAttribute('aria-label', muted ? 'Ativar som' : 'Desativar som');
  $('sound-button').title = muted ? 'Ativar som' : 'Desativar som';
}
updateSoundButton();
$('sound-button').addEventListener('click', (event) => {
  muted = !muted;
  game.setMuted(muted);
  updateSoundButton();
  if (muted) audio.silence();
  else { audio.unlock(); audio.play('pickup'); }
  try { localStorage.setItem('rtype-nebula-muted', String(muted)); } catch {}
  if (game.state === 'playing') $('game').focus({ preventScroll: true });
});
$('play-button').addEventListener('click', () => { audio.unlock(); game.start(); $('game').focus({ preventScroll: true }); });
$('restart-button').addEventListener('click', () => { audio.unlock(); game.restart(); $('game').focus({ preventScroll: true }); });
$('pause-button').addEventListener('click', () => { audio.unlock(); game.pause(); (game.state === 'paused' ? $('play-button') : $('game')).focus({ preventScroll: true }); });
$('bomb-button').addEventListener('click', () => { audio.unlock(); game.useBomb(); $('game').focus({ preventScroll: true }); });
document.addEventListener('keydown', () => audio.unlock(), { capture: true });
document.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

let resumeAfterManual = false;
function showManual() {
  resumeAfterManual = game.state === 'playing';
  if (resumeAfterManual) game.pause();
  game.releaseInputs();
  manual.showModal();
}
for (const id of ['help-button', 'manual-button']) $(id).addEventListener('click', showManual);
for (const id of ['close-manual', 'manual-done']) $(id).addEventListener('click', () => manual.close());
manual.addEventListener('click', (event) => { if (event.target === manual) { const r = manual.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) manual.close(); } });
manual.addEventListener('close', () => {
  if (resumeAfterManual && game.state === 'paused') {
    game.start();
    $('game').focus({ preventScroll: true });
  }
  resumeAfterManual = false;
});

$('fullscreen-button').addEventListener('click', async (event) => {
  event.currentTarget.blur();
  if (document.fullscreenElement) {
    try { await document.exitFullscreen(); } catch {}
  } else if (arcade.classList.contains('expanded')) arcade.classList.remove('expanded');
  else {
    try {
      if (arcade.requestFullscreen) await arcade.requestFullscreen();
      else arcade.classList.add('expanded');
    } catch { arcade.classList.add('expanded'); }
  }
  updateFullscreenButton();
  if (game.state === 'playing') $('game').focus({ preventScroll: true });
});
function updateFullscreenButton() {
  const expanded = Boolean(document.fullscreenElement || arcade.classList.contains('expanded'));
  $('fullscreen-button').title = expanded ? 'Sair da tela cheia' : 'Tela cheia';
  $('fullscreen-button').setAttribute('aria-label', expanded ? 'Sair da tela cheia' : 'Abrir tela cheia');
}
document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('keydown', (event) => { if (event.code === 'Escape' && !manual.open && arcade.classList.contains('expanded')) { arcade.classList.remove('expanded'); updateFullscreenButton(); } });

const touchPointers = new Map();
for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    if (game.state !== 'playing') return;
    button.setPointerCapture(event.pointerId);
    touchPointers.set(event.pointerId, button.dataset.action);
    game.setInput(button.dataset.action, true, `pointer:${event.pointerId}`);
    button.blur();
  });
  const release = (event) => {
    const action = touchPointers.get(event.pointerId);
    touchPointers.delete(event.pointerId);
    if (!action) return;
    const source = `pointer:${event.pointerId}`;
    if (event.type === 'pointerup') game.setInput(action, false, source);
    else game.cancelInput(action, source);
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
  button.addEventListener('contextmenu', (event) => event.preventDefault());
}
window.addEventListener('blur', () => touchPointers.clear());
// A small inspection surface allows automated play checks without changing normal play.
if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') window.nebula = game;
