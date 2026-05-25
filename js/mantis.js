// Mantis state: growth stages, stats, evolution, actions.

const STAGES = [
  { key: 'egg',      sprite: 'egg',      name: '알',     label: 'EGG',      minLv: 1,  expToNext: 10 },
  { key: 'nymph',    sprite: 'nymph',    name: '약충',    label: 'NYMPH',    minLv: 2,  expToNext: 30 },
  { key: 'subadult', sprite: 'subadult', name: '준성충',  label: 'SUBADULT', minLv: 5,  expToNext: 80 },
  { key: 'adult',    sprite: 'adult',    name: '성충',    label: 'ADULT',    minLv: 10, expToNext: Infinity },
];

function defaultMantisState() {
  return {
    stageIdx: 0,
    level: 1,
    exp: 0,
    hp: 20,
    maxHp: 20,
    atk: 3,
    def: 2,
    spd: 3,
    hunger: 80,        // 0..100, higher is more full
    food: 3,           // food inventory
    day: 1,
    timeMs: 0,         // accumulated game time in ms
    createdAt: Date.now(),
  };
}

const Mantis = {
  state: defaultMantisState(),

  load(saved) {
    if (saved && typeof saved === 'object') {
      this.state = Object.assign(defaultMantisState(), saved);
    }
  },

  get stage() {
    return STAGES[this.state.stageIdx];
  },

  get sprite() {
    return this.stage.sprite;
  },

  // ---- core mutations (return log entries) ----
  feed() {
    const s = this.state;
    if (s.food <= 0) return { ok: false, msg: '먹이가 없다.', tone: 'warn' };
    s.food -= 1;
    const before = s.hunger;
    s.hunger = Math.min(100, s.hunger + 25);
    const gainedExp = s.stageIdx === 0 ? 4 : 2;
    this.gainExp(gainedExp);
    return { ok: true, msg: `먹이를 먹었다. 배고픔 ${before}→${s.hunger}, EXP +${gainedExp}`, tone: 'good' };
  },

  train() {
    const s = this.state;
    if (s.stageIdx === 0) return { ok: false, msg: '알은 아직 훈련할 수 없다.', tone: 'warn' };
    if (s.hunger < 15) return { ok: false, msg: '너무 배고파서 훈련할 수 없다.', tone: 'warn' };
    if (s.hp < 8) return { ok: false, msg: 'HP가 너무 낮다. 휴식이 필요.', tone: 'warn' };

    // pick a random stat to bump (weighted)
    const roll = Math.random();
    let bumped, name;
    if (roll < 0.45)      { bumped = ++s.atk; name = 'ATK'; }
    else if (roll < 0.8)  { bumped = ++s.def; name = 'DEF'; }
    else                  { bumped = ++s.spd; name = 'SPD'; }
    s.hunger = Math.max(0, s.hunger - 10);
    s.hp = Math.max(1, s.hp - 5);
    this.gainExp(3);
    return { ok: true, msg: `훈련 완료! ${name} +1 → ${bumped}`, tone: 'good' };
  },

  rest() {
    const s = this.state;
    const before = s.hp;
    s.hp = Math.min(s.maxHp, s.hp + Math.ceil(s.maxHp * 0.4));
    // fast-forward 60s of game time
    this.tick(60_000);
    return { ok: true, msg: `푹 쉬었다. HP ${before}→${s.hp}`, tone: 'good' };
  },

  // exp gain + level/evolution check
  gainExp(amount) {
    const s = this.state;
    s.exp += amount;
    const events = [];
    while (true) {
      const need = this.expToNextLevel();
      if (s.exp < need) break;
      s.exp -= need;
      s.level += 1;
      // level up bonuses
      s.maxHp += 4;
      s.hp = Math.min(s.maxHp, s.hp + 4);
      s.atk += 1;
      if (s.level % 2 === 0) s.def += 1;
      if (s.level % 3 === 0) s.spd += 1;
      events.push({ type: 'levelup', level: s.level });
      // evolution?
      const nextStage = STAGES[s.stageIdx + 1];
      if (nextStage && s.level >= nextStage.minLv) {
        s.stageIdx += 1;
        s.maxHp += 10;
        s.hp = s.maxHp;
        s.atk += 2;
        s.def += 1;
        s.spd += 1;
        events.push({ type: 'evolve', stage: this.stage });
      }
    }
    return events;
  },

  expToNextLevel() {
    return 10 + this.state.level * 4 + this.state.stageIdx * 10;
  },

  // time progression: every 30s of game time, hunger -1
  // when hunger 0 for a while, HP drops
  tick(deltaMs) {
    const s = this.state;
    const prev = Math.floor(s.timeMs / 30_000);
    s.timeMs += deltaMs;
    const now = Math.floor(s.timeMs / 30_000);
    const ticks = now - prev;
    const events = [];
    for (let i = 0; i < ticks; i++) {
      // hunger drains slower for egg
      const drain = s.stageIdx === 0 ? 0.5 : 1;
      s.hunger = Math.max(0, s.hunger - drain);
      if (s.hunger === 0 && s.stageIdx > 0) {
        s.hp = Math.max(0, s.hp - 1);
        events.push({ type: 'starve' });
      }
      // egg auto-gains exp slowly
      if (s.stageIdx === 0) {
        const lvEvents = this.gainExp(1);
        events.push(...lvEvents);
      }
    }
    // day clock: 5 minutes real = 1 day
    s.day = 1 + Math.floor(s.timeMs / (5 * 60_000));
    return events;
  },

  // is the mantis dead?
  get isDead() { return this.state.hp <= 0 && this.state.stageIdx > 0; },

  // can perform action right now?
  canAct() {
    return !this.isDead && this.state.stageIdx > 0; // egg can only feed/rest
  },

  reset() {
    this.state = defaultMantisState();
  },
};
