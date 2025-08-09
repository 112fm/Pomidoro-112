// Простое хранилище
const store = {
  get: (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};

const timeEl = document.getElementById('time');
const modeEl = document.getElementById('mode');
const startPauseBtn = document.getElementById('startPause');
const resetBtn = document.getElementById('reset');
const applyBtn = document.getElementById('apply');
const workInput = document.getElementById('workInput');
const breakInput = document.getElementById('breakInput');
const testSoundBtn = document.getElementById('testSound');

// 1) Канал через файл (HTMLAudio)
const bell = new Audio('./bell.wav');
bell.preload = 'auto';
bell.playsInline = true;

// 2) Канал через Web Audio API (надёжный для десктопа)
let ac; // AudioContext
function ensureAudioUnlocked() {
  try {
    if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    // разлочим HTMLAudio (некоторые браузеры требуют жест)
    if (!bell._unlocked) {
      const prev = bell.volume;
      bell.volume = 0;
      bell.play().then(() => { bell.pause(); bell.currentTime = 0; bell.volume = prev; bell._unlocked = true; }).catch(()=>{});
    }
  } catch(e) {}
}
['mousedown','touchstart','keydown'].forEach(ev => {
  window.addEventListener(ev, ensureAudioUnlocked, { once:false, passive:true });
});

function beepWebAudio() {
  try {
    ensureAudioUnlocked();
    if (!ac) return;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'sine';
    o.frequency.value = 880; // «дзынь»
    g.gain.setValueAtTime(0.001, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.25);
    o.connect(g).connect(ac.destination);
    o.start();
    o.stop(ac.currentTime + 0.27);
  } catch(e){}
}

function playBell() {
  // Пытаемся файл, если не получилось — WebAudio
  try {
    bell.currentTime = 0;
    bell.play().catch(beepWebAudio);
  } catch(e) { beepWebAudio(); }
}

let state = store.get('state', {
  work: 25,
  rest: 5,
  mode: 'work', // work | rest
  remaining: 25*60,
  running: false,
  lastTick: null
});

function save(){ store.set('state', state); }

function syncUI(){
  workInput.value = state.work;
  breakInput.value = state.rest;
  modeEl.textContent = state.mode === 'work' ? 'Работа' : 'Отдых';
  startPauseBtn.textContent = state.running ? 'Пауза' : 'Старт';
  renderTime(state.remaining);
}

function renderTime(sec){
  const m = Math.floor(sec/60);
  const s = sec % 60;
  timeEl.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function setDurations(work, rest){
  state.work = Math.max(1, Math.min(180, work|0));
  state.rest = Math.max(1, Math.min(60, rest|0));
  if(!state.running){
    state.remaining = (state.mode === 'work' ? state.work : state.rest) * 60;
    renderTime(state.remaining);
  }
  save();
}

applyBtn.addEventListener('click', () => setDurations(+workInput.value, +breakInput.value));

startPauseBtn.addEventListener('click', () => {
  ensureAudioUnlocked();
  state.running = !state.running;
  state.lastTick = Date.now();
  startPauseBtn.textContent = state.running ? 'Пауза' : 'Старт';
  save();
});

resetBtn.addEventListener('click', () => {
  state.running = false;
  state.remaining = (state.mode === 'work' ? state.work : state.rest) * 60;
  startPauseBtn.textContent = 'Старт';
  renderTime(state.remaining);
  save();
});

if (testSoundBtn) {
  testSoundBtn.addEventListener('click', () => {
    ensureAudioUnlocked();
    playBell();
  });
}

function switchMode(){
  state.mode = state.mode === 'work' ? 'rest' : 'work';
  modeEl.textContent = state.mode === 'work' ? 'Работа' : 'Отдых';
  state.remaining = (state.mode === 'work' ? state.work : state.rest) * 60;
  playBell();
}

function tick(){
  if(!state.running) return;
  const now = Date.now();
  const dt = Math.floor((now - (state.lastTick || now)) / 1000);
  if(dt > 0){
    state.lastTick = now;
    state.remaining -= dt;
    if(state.remaining <= 0){
      switchMode();
    }
    save();
    renderTime(Math.max(0, state.remaining));
    modeEl.textContent = state.mode === 'work' ? 'Работа' : 'Отдых';
  }
}
setInterval(tick, 250);

// Инициализация
if(!state.remaining){
  state.remaining = (state.mode === 'work' ? state.work : state.rest) * 60;
}
setDurations(state.work, state.rest);
syncUI();

// Регистрация SW
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js');
  });
}
