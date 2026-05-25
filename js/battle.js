// Battle: enemies, moves, turn-based combat against wild bugs.

const ENEMIES = [
  { key: 'mosquito', sprite: 'mosquito', name: '야생 모기',    hp: 15, atk: 4,  def: 1,  spd: 8,  rewardExp: 8,  rewardFood: 1, tier: 1 },
  { key: 'fly',      sprite: 'fly',      name: '집파리',       hp: 22, atk: 5,  def: 2,  spd: 6,  rewardExp: 12, rewardFood: 1, tier: 1 },
  { key: 'cricket',  sprite: 'cricket',  name: '귀뚜라미',     hp: 35, atk: 7,  def: 3,  spd: 5,  rewardExp: 22, rewardFood: 2, tier: 2 },
  { key: 'spider',   sprite: 'spider',   name: '거미',         hp: 55, atk: 11, def: 5,  spd: 6,  rewardExp: 42, rewardFood: 3, tier: 3 },
  { key: 'wasp',     sprite: 'wasp',     name: '말벌',         hp: 70, atk: 14, def: 6,  spd: 9,  rewardExp: 60, rewardFood: 3, tier: 3 },
  { key: 'hornet',   sprite: 'hornet',   name: '장수말벌',     hp: 120,atk: 20, def: 9,  spd: 10, rewardExp: 110,rewardFood: 5, tier: 4 },
];

const MOVES = {
  slash: {
    name: '낫 베기',
    desc: '기본 공격',
    minStage: 1,
    use(attacker, defender) {
      const dmg = damageFormula(attacker.atk, defender.def, 1.0, 0.08);
      defender.hp = Math.max(0, defender.hp - dmg.value);
      return { type: 'attack', dmg: dmg.value, crit: dmg.crit, msg: `낫으로 베어 ${dmg.value} 데미지!` + (dmg.crit ? ' (치명타!)' : '') };
    },
  },
  threaten: {
    name: '위협',
    desc: '적 공격력 ↓',
    minStage: 1,
    use(attacker, defender, state) {
      defender.atkDebuff = (defender.atkDebuff || 0) + 2;
      return { type: 'debuff', msg: '적을 위협했다! 상대 ATK ↓' };
    },
  },
  dash: {
    name: '빠른 일격',
    desc: 'SPD 기반 / 2회 공격 가능',
    minStage: 2,
    use(attacker, defender) {
      const hits = attacker.spd >= defender.spd + 3 ? 2 : 1;
      let total = 0, anyCrit = false;
      for (let i = 0; i < hits; i++) {
        const d = damageFormula(Math.ceil(attacker.atk * 0.7) + Math.ceil(attacker.spd * 0.4), defender.def, 1.0, 0.12);
        defender.hp = Math.max(0, defender.hp - d.value);
        total += d.value;
        anyCrit = anyCrit || d.crit;
        if (defender.hp <= 0) break;
      }
      return { type: 'attack', dmg: total, crit: anyCrit, msg: `빠른 일격! ${hits}회 적중, ${total} 데미지` + (anyCrit ? ' (치명타!)' : '') };
    },
  },
  devour: {
    name: '포식',
    desc: 'HP 흡수',
    minStage: 3,
    use(attacker, defender) {
      const dmg = damageFormula(Math.ceil(attacker.atk * 0.8), defender.def, 1.0, 0.05);
      defender.hp = Math.max(0, defender.hp - dmg.value);
      const heal = Math.ceil(dmg.value * 0.6);
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal);
      return { type: 'lifesteal', dmg: dmg.value, heal, msg: `포식! ${dmg.value} 데미지, HP +${heal}` };
    },
  },
};

function damageFormula(atk, def, mult, critRate) {
  const effAtk = Math.max(1, atk);
  const effDef = Math.max(0, def);
  let base = Math.max(1, Math.round((effAtk * 2 - effDef) * mult));
  const variance = 0.85 + Math.random() * 0.3;  // 0.85..1.15
  let value = Math.max(1, Math.round(base * variance));
  const crit = Math.random() < (critRate || 0.05);
  if (crit) value = Math.round(value * 1.8);
  return { value, crit };
}

// pick an enemy roughly matched to the mantis level
function pickEnemyFor(mantisState) {
  const lv = mantisState.level;
  const stage = mantisState.stageIdx;
  let pool;
  if (stage === 0) {
    pool = []; // egg can't fight
  } else if (stage === 1) {
    pool = ENEMIES.filter(e => e.tier <= 1);
  } else if (stage === 2) {
    pool = ENEMIES.filter(e => e.tier <= 2);
  } else if (lv < 14) {
    pool = ENEMIES.filter(e => e.tier <= 3);
  } else {
    pool = ENEMIES;
  }
  if (!pool.length) return null;
  return JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
}

const Battle = {
  active: null,

  // start a battle, returns combatant snapshot
  start(mantisState) {
    const enemy = pickEnemyFor(mantisState);
    if (!enemy) return null;
    this.active = {
      player: {
        hp: mantisState.hp,
        maxHp: mantisState.maxHp,
        atk: mantisState.atk,
        def: mantisState.def,
        spd: mantisState.spd,
        stageIdx: mantisState.stageIdx,
        atkDebuff: 0,
      },
      enemy: {
        ...enemy,
        maxHp: enemy.hp,
        atkDebuff: 0,
      },
      log: [],
      turn: 0,
      done: false,
      result: null,
    };
    return this.active;
  },

  effAtk(c) {
    return Math.max(1, c.atk - (c.atkDebuff || 0));
  },

  // player uses a move; returns events
  playerMove(moveKey) {
    if (!this.active || this.active.done) return [];
    const move = MOVES[moveKey];
    if (!move) return [];
    if ((move.minStage || 1) > this.active.player.stageIdx) {
      return [{ type: 'invalid', msg: '아직 익히지 못한 기술이다.' }];
    }
    const events = [];
    // wear off debuffs slightly each player turn
    if (this.active.enemy.atkDebuff > 0) this.active.enemy.atkDebuff -= 0; // persist
    const ev = move.use(this.proxiedPlayer(), this.active.enemy);
    events.push(ev);
    if (this.active.enemy.hp <= 0) {
      this.active.done = true;
      this.active.result = 'win';
      events.push({ type: 'win', enemy: this.active.enemy });
      return events;
    }
    // enemy turn
    const enemyEvent = this.enemyTurn();
    events.push(enemyEvent);
    if (this.active.player.hp <= 0) {
      this.active.done = true;
      this.active.result = 'lose';
      events.push({ type: 'lose' });
    }
    this.active.turn += 1;
    return events;
  },

  proxiedPlayer() {
    // expose effAtk via getter trick: just pass effective stats
    const p = this.active.player;
    return {
      get hp() { return p.hp; }, set hp(v) { p.hp = v; },
      get maxHp() { return p.maxHp; },
      get atk() { return Math.max(1, p.atk - (p.atkDebuff || 0)); },
      get def() { return p.def; },
      get spd() { return p.spd; },
    };
  },

  enemyTurn() {
    const e = this.active.enemy;
    const p = this.active.player;
    // simple AI: 70% basic attack, 30% threaten when player atk high
    const useThreaten = Math.random() < 0.2 && (p.atkDebuff || 0) < 4;
    if (useThreaten) {
      p.atkDebuff = (p.atkDebuff || 0) + 2;
      return { type: 'enemyDebuff', msg: `${e.name}이(가) 위협한다! 사마귀 ATK ↓` };
    }
    const effAtk = Math.max(1, e.atk - (e.atkDebuff || 0));
    const dmg = damageFormula(effAtk, p.def, 1.0, 0.06);
    p.hp = Math.max(0, p.hp - dmg.value);
    return { type: 'enemyAttack', dmg: dmg.value, crit: dmg.crit, msg: `${e.name}의 반격! ${dmg.value} 데미지` + (dmg.crit ? ' (치명타!)' : '') };
  },

  // try to flee — 50% chance, costs a turn
  tryFlee() {
    if (!this.active || this.active.done) return [];
    const events = [];
    if (Math.random() < 0.5 + (this.active.player.spd - this.active.enemy.spd) * 0.03) {
      this.active.done = true;
      this.active.result = 'flee';
      events.push({ type: 'flee', msg: '도망쳤다!' });
    } else {
      events.push({ type: 'fleeFail', msg: '도망에 실패했다!' });
      events.push(this.enemyTurn());
      if (this.active.player.hp <= 0) {
        this.active.done = true;
        this.active.result = 'lose';
        events.push({ type: 'lose' });
      }
    }
    return events;
  },

  // commit battle result back to mantis state
  finalize(mantisState) {
    if (!this.active || !this.active.done) return null;
    mantisState.hp = this.active.player.hp;
    const summary = { result: this.active.result };
    if (this.active.result === 'win') {
      summary.exp = this.active.enemy.rewardExp;
      summary.food = this.active.enemy.rewardFood;
      summary.enemyName = this.active.enemy.name;
    }
    return summary;
  },

  end() {
    this.active = null;
  },
};
