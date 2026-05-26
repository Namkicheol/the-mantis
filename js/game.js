// Main game loop, UI wiring, saving.

const SAVE_KEY = 'the-mantis:v1';
const TIME_SCALE = 5;        // 1 real second = 5 game seconds
const TICK_INTERVAL = 1000;  // real ms

const $ = (id) => document.getElementById(id);

const UI = {
  mantisCanvas: null,
  log: null,
  init() {
    this.mantisCanvas = $('mantisCanvas');
    this.log = $('log');
  },

  refresh() {
    const s = Mantis.state;
    const stage = Mantis.stage;
    $('mantisName').textContent = stage.name;
    $('mantisStage').textContent = `${stage.label} · Lv. ${s.level}`;
    $('dayLabel').textContent = `DAY ${s.day}`;
    $('phaseLabel').textContent = (Math.floor(s.timeMs / 60_000) % 2 === 0) ? '낮' : '밤';

    // bars
    setBar('hpFill', 'hpNum', s.hp, s.maxHp);
    setBar('expFill', 'expNum', s.exp, Mantis.expToNextLevel());
    setBar('hungerFill', 'hungerNum', s.hunger, 100);

    $('statAtk').textContent = s.atk;
    $('statDef').textContent = s.def;
    $('statSpd').textContent = s.spd;
    $('statFood').textContent = s.food;

    // hint
    $('feedHint').textContent = s.food > 0 ? `먹이 -1 (보유 ${s.food}), 배고픔+25` : '먹이 없음 (사냥으로 획득)';

    // mantis sprite
    renderCharacter(this.mantisCanvas, Mantis.sprite);

    // disable actions when egg or dead
    document.querySelectorAll('.action-grid .btn').forEach(b => {
      const action = b.dataset.action;
      let disabled = false;
      if (Mantis.isDead) disabled = true;
      else if (s.stageIdx === 0 && (action === 'train' || action === 'hunt')) disabled = true;
      else if (action === 'feed' && s.food <= 0) disabled = true;
      b.disabled = disabled;
    });
  },

  logRow(text, tone) {
    const row = document.createElement('div');
    row.className = 'row' + (tone ? ' ' + tone : ' dim');
    const time = new Date().toLocaleTimeString('ko-KR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    row.textContent = `[${time}] ${text}`;
    this.log.prepend(row);
    while (this.log.children.length > 60) this.log.removeChild(this.log.lastChild);
  },
};

function setBar(fillId, numId, cur, max) {
  const pct = Math.max(0, Math.min(100, (cur / Math.max(1, max)) * 100));
  const fill = $(fillId);
  fill.style.width = pct + '%';
  $(numId).textContent = `${Math.round(cur)}/${max === Infinity ? '∞' : max}`;
}

// ---- save/load ----
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(Mantis.state));
  } catch (e) {
    console.warn('save failed', e);
  }
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    Mantis.load(parsed);
    // apply offline time, capped at 6 hours
    const now = Date.now();
    if (parsed.lastSavedAt) {
      const diff = Math.min(now - parsed.lastSavedAt, 6 * 60 * 60 * 1000);
      const gameDiff = diff * TIME_SCALE;
      Mantis.tick(gameDiff);
      UI.logRow(`(자리비움 동안 게임시간 ${Math.round(gameDiff / 1000)}초 경과)`, 'dim');
    }
    return true;
  } catch (e) {
    console.warn('load failed', e);
    return false;
  }
}

function saveWithTimestamp() {
  Mantis.state.lastSavedAt = Date.now();
  save();
}

// ---- actions ----
function handleAction(action) {
  if (action === 'feed')      return doSimple(Mantis.feed(), 'feed');
  if (action === 'train')     return doSimple(Mantis.train(), 'train');
  if (action === 'rest')      return doSimple(Mantis.rest(), 'rest');
  if (action === 'hunt')      return startBattle();
}

function doSimple(result, actionName) {
  if (!result.ok) {
    Audio8.sfx('denied');
    UI.logRow(result.msg, 'warn');
    UI.refresh();
    return;
  }
  // per-action sfx
  if (actionName === 'feed') Audio8.sfx('feed');
  else if (actionName === 'train') Audio8.sfx('train');
  else if (actionName === 'rest') Audio8.sfx('rest');
  UI.logRow(result.msg, result.tone || 'good');
  // check evolution events (from gainExp)
  processPendingEvents();
  UI.refresh();
  saveWithTimestamp();
}

// gainExp returns events; we capture them at the call site. To keep ux simple,
// we expose a small queue.
let pendingEvolveEvent = null;

const _origGainExp = Mantis.gainExp.bind(Mantis);
Mantis.gainExp = function(amount) {
  const events = _origGainExp(amount);
  for (const ev of events) {
    if (ev.type === 'levelup') {
      UI.logRow(`레벨업! Lv. ${ev.level}`, 'good');
      Audio8.sfx('levelup');
    } else if (ev.type === 'evolve') {
      pendingEvolveEvent = ev;
    }
  }
  return events;
};

function processPendingEvents() {
  if (pendingEvolveEvent) {
    showEvolveOverlay(pendingEvolveEvent.stage);
    pendingEvolveEvent = null;
  }
  if (Mantis.isDead) {
    UI.logRow('사마귀가 쓰러졌다… 리셋을 눌러 새로 시작.', 'bad');
  }
}

// ---- evolve overlay ----
function showEvolveOverlay(stage) {
  $('evolveText').textContent = `사마귀가 ${stage.name}(으)로 진화했다!`;
  renderCharacter($('evolveCanvas'), stage.sprite);
  $('evolveOverlay').classList.remove('hidden');
  UI.logRow(`✨ 진화! → ${stage.name}`, 'good');
  Audio8.sfx('evolve');
}

// ---- battle UI ----
function startBattle() {
  if (Mantis.state.stageIdx === 0) {
    Audio8.sfx('denied');
    UI.logRow('아직 알이라 사냥할 수 없다.', 'warn');
    return;
  }
  const b = Battle.start(Mantis.state);
  if (!b) { UI.logRow('사냥감을 찾지 못했다.', 'warn'); return; }

  Audio8.playBgm('battle');

  $('battleTitle').textContent = `VS ${b.enemy.name}`;
  $('enemyCombatName').textContent = b.enemy.name;
  $('playerCombatName').textContent = `${Mantis.stage.name} (Lv. ${Mantis.state.level})`;
  renderCharacter($('playerBattleCanvas'), Mantis.sprite);
  renderCharacter($('enemyBattleCanvas'), b.enemy.sprite, { flip: true });

  refreshBattleHud();
  clearBattleLog();
  appendBattleLog(`야생 ${b.enemy.name}이(가) 나타났다!`, 'warn');

  // enable/disable moves by stage
  document.querySelectorAll('.battle-actions .btn.move').forEach(btn => {
    const moveKey = btn.dataset.move;
    const move = MOVES[moveKey];
    btn.disabled = (move.minStage || 1) > Mantis.state.stageIdx;
  });

  $('battleEnd').classList.add('hidden');
  $('battleActions').style.display = 'grid';
  $('battleOverlay').classList.remove('hidden');
}

function refreshBattleHud() {
  if (!Battle.active) return;
  const { player, enemy } = Battle.active;
  setBar('playerBattleHp', 'playerBattleHpNum', player.hp, player.maxHp);
  setBar('enemyBattleHp', 'enemyBattleHpNum', enemy.hp, enemy.maxHp);
}

function clearBattleLog() {
  $('battleLog').innerHTML = '';
}

function appendBattleLog(text, tone) {
  const log = $('battleLog');
  const row = document.createElement('div');
  row.className = 'row' + (tone ? ' ' + tone : '');
  row.textContent = text;
  log.appendChild(row);
  log.scrollTop = log.scrollHeight;
}

function shake(canvasId) {
  const el = $(canvasId);
  el.classList.remove('shake');
  // force reflow
  void el.offsetWidth;
  el.classList.add('shake');
}

function handleMove(moveKey) {
  if (!Battle.active || Battle.active.done) return;
  const events = Battle.playerMove(moveKey);
  for (const ev of events) {
    if (ev.type === 'attack' || ev.type === 'lifesteal') {
      Audio8.sfx(ev.crit ? 'crit' : 'hit');
      appendBattleLog(ev.msg, ev.crit ? 'good' : '');
      shake('enemyBattleCanvas');
    } else if (ev.type === 'debuff') {
      Audio8.sfx('select');
      appendBattleLog(ev.msg, 'warn');
    } else if (ev.type === 'enemyAttack') {
      Audio8.sfx('enemyHit');
      appendBattleLog(ev.msg, 'bad');
      shake('playerBattleCanvas');
    } else if (ev.type === 'enemyDebuff') {
      appendBattleLog(ev.msg, 'warn');
    } else if (ev.type === 'win') {
      Audio8.sfx('win');
      appendBattleLog(`${ev.enemy.name}을(를) 쓰러뜨렸다!`, 'good');
    } else if (ev.type === 'lose') {
      Audio8.sfx('lose');
      appendBattleLog('사마귀가 쓰러졌다…', 'bad');
    } else if (ev.type === 'invalid') {
      Audio8.sfx('denied');
      appendBattleLog(ev.msg, 'warn');
    }
  }
  refreshBattleHud();
  if (Battle.active && Battle.active.done) endBattle();
}

function endBattle() {
  const summary = Battle.finalize(Mantis.state);
  if (summary) {
    if (summary.result === 'win') {
      Mantis.state.food += summary.food;
      Mantis.gainExp(summary.exp);
      appendBattleLog(`보상: EXP +${summary.exp}, 먹이 +${summary.food}`, 'good');
      UI.logRow(`${summary.enemyName} 처치 — EXP+${summary.exp}, 먹이+${summary.food}`, 'good');
    } else if (summary.result === 'lose') {
      Mantis.state.hp = 1; // not dead from battle, just 1 HP left
      UI.logRow('전투에서 패배… HP 1로 겨우 살아남았다.', 'bad');
    } else if (summary.result === 'flee') {
      UI.logRow('전투에서 도망쳤다.', 'warn');
    }
  }
  Battle.end();
  $('battleActions').style.display = 'none';
  $('battleEnd').classList.remove('hidden');
}

// ---- main loop ----
let loopHandle = null;
function startLoop() {
  if (loopHandle) clearInterval(loopHandle);
  loopHandle = setInterval(() => {
    const events = Mantis.tick(TICK_INTERVAL * TIME_SCALE);
    let needsRefresh = events.length > 0;
    for (const ev of events) {
      if (ev.type === 'starve') UI.logRow('굶주림으로 HP -1', 'bad');
      if (ev.type === 'levelup') UI.logRow(`자동 성장! Lv. ${ev.level}`, 'good');
      if (ev.type === 'evolve') pendingEvolveEvent = ev;
    }
    if (pendingEvolveEvent) {
      processPendingEvents();
      needsRefresh = true;
    }
    if (needsRefresh) {
      UI.refresh();
      saveWithTimestamp();
    } else {
      // still update clock cheaply
      $('dayLabel').textContent = `DAY ${Mantis.state.day}`;
    }
  }, TICK_INTERVAL);
}

// ---- init ----
function init() {
  UI.init();
  const loaded = load();
  if (!loaded) {
    UI.logRow('새로운 알이 부화를 기다리는 중…', 'dim');
    UI.logRow('먹이를 주거나 시간이 지나면 약충으로 부화한다.', 'dim');
  } else {
    UI.logRow('저장된 사마귀를 불러왔다.', 'dim');
  }
  UI.refresh();
  startLoop();

  // action buttons
  document.querySelectorAll('.action-grid .btn').forEach(btn => {
    btn.addEventListener('click', () => handleAction(btn.dataset.action));
  });

  // battle moves
  document.querySelectorAll('.battle-actions .btn.move').forEach(btn => {
    btn.addEventListener('click', () => handleMove(btn.dataset.move));
  });

  $('battleCloseBtn').addEventListener('click', () => {
    $('battleOverlay').classList.add('hidden');
    Audio8.playBgm('main');
    UI.refresh();
    saveWithTimestamp();
  });

  $('evolveCloseBtn').addEventListener('click', () => {
    $('evolveOverlay').classList.add('hidden');
    UI.refresh();
  });

  $('resetBtn').addEventListener('click', () => {
    if (!confirm('정말 리셋할까? 사마귀가 사라진다.')) return;
    Mantis.reset();
    localStorage.removeItem(SAVE_KEY);
    UI.logRow('리셋. 새로운 알이다.', 'warn');
    UI.refresh();
    Audio8.playBgm('main');
  });

  // mute toggle (restore from storage)
  const muteBtn = $('muteBtn');
  try {
    const savedMute = localStorage.getItem('the-mantis:muted') === '1';
    if (savedMute) { Audio8.muted = true; muteBtn.classList.add('muted'); muteBtn.textContent = '🔇 BGM'; }
  } catch {}
  muteBtn.addEventListener('click', () => {
    Audio8.ensure();
    const next = !Audio8.muted;
    Audio8.setMuted(next);
    muteBtn.textContent = next ? '🔇 BGM' : '🔊 BGM';
    muteBtn.classList.toggle('muted', next);
    if (!next) Audio8.playBgm(Battle.active ? 'battle' : 'main');
  });

  // start BGM + click sounds on first user interaction (browser autoplay policy)
  const startAudioOnce = () => {
    Audio8.ensure();
    Audio8.resumeIfNeeded();
    if (!Audio8.muted) Audio8.playBgm('main');
    document.removeEventListener('pointerdown', startAudioOnce, true);
    document.removeEventListener('keydown', startAudioOnce, true);
  };
  document.addEventListener('pointerdown', startAudioOnce, true);
  document.addEventListener('keydown', startAudioOnce, true);

  // light click sfx on every button (excluding mute itself to avoid double-trigger UX)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button.btn, button.ghost-btn');
    if (!btn) return;
    if (btn.id === 'muteBtn') return;
    Audio8.sfx('click');
  }, true);

  // save on unload
  window.addEventListener('beforeunload', saveWithTimestamp);
}

document.addEventListener('DOMContentLoaded', init);
