// Mantis state: species, sex, growth stages (instars), stats, evolution, actions.

// Growth: 알(egg) → 1령 → 2령 → 3령 → 4령(성충). Egg is not an instar.
const STAGES = [
  { key: 'egg', sprite: 'egg', name: '알',   label: 'EGG',     minLv: 1,  expToNext: 10 },
  { key: 'i1',  sprite: 'i1',  name: '1령',  label: '1ST',     minLv: 2,  expToNext: 30 },
  { key: 'i2',  sprite: 'i2',  name: '2령',  label: '2ND',     minLv: 4,  expToNext: 60 },
  { key: 'i3',  sprite: 'i3',  name: '3령',  label: '3RD',     minLv: 7,  expToNext: 90 },
  { key: 'i4',  sprite: 'i4',  name: '4령',  label: '4TH',     minLv: 11, expToNext: Infinity },
];

// Species — picked randomly when a new egg is created.
// `mods` are applied once per evolution (4 times by 4령), so traits grow over time.
const SPECIES = {
  wang:    { key: 'wang',    name: '왕사마귀',     blurb: '크고 힘이 세다',     mods: { hp:  4, atk: 1, def: 1, spd: -1 } },
  hwangla: { key: 'hwangla', name: '황라사마귀',   blurb: '날렵하고 빠르다',     mods: { hp: -1, atk: 0, def: -1, spd: 2 } },
  neopjok: { key: 'neopjok', name: '넓적배사마귀', blurb: '배가 넓고 단단하다',   mods: { hp:  3, atk: 0, def: 2, spd: -1 } },
  jom:     { key: 'jom',     name: '좀사마귀',     blurb: '작지만 균형 잡혔다',   mods: { hp:  0, atk: 1, def: 0, spd: 1 } },
};
const SPECIES_KEYS = Object.keys(SPECIES);

// Sex — picked randomly. Females larger/stronger, males smaller/faster (real dimorphism).
const SEXES = {
  female: { key: 'female', name: '암컷', symbol: '♀', mods: { hp: 2, atk: 1, def: 1, spd: -1 } },
  male:   { key: 'male',   name: '수컷', symbol: '♂', mods: { hp: -1, atk: 0, def: 0, spd: 2 } },
};
const SEX_KEYS = Object.keys(SEXES);

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function defaultMantisState() {
  return {
    schema: 2,                       // bump when shape changes
    species: pickRandom(SPECIES_KEYS),
    sex: pickRandom(SEX_KEYS),
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
      this._migrate(saved);
    }
  },

  // migrate pre-species (schema 1) saves: 4-stage egg/nymph/subadult/adult → 5-stage instars.
  _migrate(saved) {
    const s = this.state;
    if (saved.schema === undefined || saved.species === undefined) {
      // old stageIdx: 0 egg, 1 nymph, 2 subadult, 3 adult → new: 0 egg, 1/2/3 instar, 4 adult(4령)
      const remap = { 0: 0, 1: 1, 2: 2, 3: 4 };
      if (saved.stageIdx in remap) s.stageIdx = remap[saved.stageIdx];
      if (saved.species === undefined) s.species = pickRandom(SPECIES_KEYS);
      if (saved.sex === undefined) s.sex = pickRandom(SEX_KEYS);
      s.schema = 2;
    }
    if (!SPECIES[s.species]) s.species = pickRandom(SPECIES_KEYS);
    if (!SEXES[s.sex]) s.sex = pickRandom(SEX_KEYS);
  },

  get stage() {
    return STAGES[this.state.stageIdx];
  },

  get speciesInfo() { return SPECIES[this.state.species] || SPECIES.wang; },
  get sexInfo() { return SEXES[this.state.sex] || SEXES.female; },

  // sprite/photo key: egg is generic; instars carry species (+ sex on the adult form).
  get sprite() {
    const k = this.stage.key;
    if (k === 'egg') return 'egg';
    const sp = this.state.species;
    if (k === 'i4') return `${sp}_adult_${this.state.sex}`;
    if (k === 'i2' || k === 'i3') return `${sp}_subadult`;
    return `${sp}_nymph`; // i1
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

  // apply species + sex stat traits, once per evolution
  _applyTraitMods() {
    const s = this.state;
    for (const src of [this.speciesInfo.mods, this.sexInfo.mods]) {
      s.maxHp = Math.max(5, s.maxHp + (src.hp || 0));
      s.atk = Math.max(1, s.atk + (src.atk || 0));
      s.def = Math.max(0, s.def + (src.def || 0));
      s.spd = Math.max(1, s.spd + (src.spd || 0));
    }
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
        s.atk += 2;
        s.def += 1;
        s.spd += 1;
        this._applyTraitMods();   // species/sex traits show & grow at each molt
        s.hp = s.maxHp;
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
