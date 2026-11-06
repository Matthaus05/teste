import { Game } from './game.mjs';
import { Renderer } from './render.mjs';

const $ = (id) => document.getElementById(id);
const formatScore = (value) => Math.max(0, Math.floor(value)).toString().padStart(6, '0');
const sectorNames = ['CINTURÃO DE ÓRION', 'RUÍNAS ORBITAIS', 'O ÚLTIMO HORIZONTE'];
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
  $('score').textContent = formatScore(score);
  $('best-score').textContent = formatScore(best);
  $('sector-name').textContent = bossMaxHp && bossHp > 0 ? 'CONTATO HOSTIL' : sectorNames[sector - 1] || sectorNames[0];
  $('sector-number').textContent = String(sector).padStart(2, '0');
  $('shield').setAttribute('aria-label', `${hp} de ${maxHp} escudos`);
  [...$('shield').children].forEach((cell, index) => cell.classList.toggle('empty', index >= hp));
  $('weapon-name').textContent = `BLASTER ${['I', 'II', 'III'][Math.min(2, weapon - 1)] || 'I'}`;
  $('charge-fill').style.width = `${Math.max(0, Math.min(1, charge)) * 100}%`;
  $('charge-label').textContent = charge >= 1 ? 'CARGA MÁXIMA — SOLTE X' : charge > 0 ? 'CARREGANDO CANHÃO' : 'CANHÃO PRONTO';
  $('mission-progress').style.width = `${progress * 100}%`;
  $('boss-warning').hidden = !(bossMaxHp && bossHp > 0 && state === 'playing');
  $('boss-health').style.width = `${bossMaxHp ? Math.max(0, bossHp / bossMaxHp * 100) : 0}%`;
  $('flight-status').innerHTML = `<i></i> ${state === 'playing' ? 'MISSÃO EM CURSO' : state === 'paused' ? 'VOO EM ESPERA' : state === 'victory' ? 'MISSÃO CONCLUÍDA' : state === 'gameover' ? 'SINAL PERDIDO' : 'AGUARDANDO PILOTO'}`;
  $('pause-button').disabled = !['playing', 'paused'].includes(state);
  $('pause-button').setAttribute('aria-label', state === 'paused' ? 'Retomar jogo' : 'Pausar jogo');
  $('pause-button').title = state === 'paused' ? 'Retomar (P)' : 'Pausar (P)';
  if (previousState === state) return;
  const enteringMission = state === 'playing' && previousState === 'menu';
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
  $('start-hint').hidden = state !== 'menu';
  $('final-score').textContent = formatScore(score);
  const content = {
    menu: ['TRANSMISSÃO RECEBIDA', 'O ÚLTIMO SINAL<br>VEIO DE <em>ÓRION.</em>', 'Além da fronteira, algo despertou.<br>Sua nave é a nossa última resposta.', 'INICIAR MISSÃO'],
    paused: ['TRANSMISSÃO EM ESPERA', 'UM MOMENTO<br>ENTRE <em>ESTRELAS.</em>', 'Seu voo está pausado.<br>Órion estará aqui quando você voltar.', 'RETOMAR MISSÃO'],
    gameover: ['CONEXÃO INTERROMPIDA', 'PERDEMOS<br>SEU <em>SINAL.</em>', 'O espaço ainda guarda seus segredos.<br>Uma nova decolagem. Uma nova chance.', 'TENTAR NOVAMENTE'],
    victory: ['FRONTEIRA PROTEGIDA', 'ÓRION VOLTOU<br>A <em>BRILHAR.</em>', 'O guardião caiu. A rota está livre.<br>O universo vai lembrar deste voo.', 'VOAR NOVAMENTE'],
  }[state];
  if (content) {
    $('overlay-kicker').innerHTML = `<span class="signal-line"></span> ${content[0]}`;
    $('overlay-title').innerHTML = content[1];
    $('overlay-description').innerHTML = content[2];
    $('play-label').textContent = content[3];
  }
}

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
