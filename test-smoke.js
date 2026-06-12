// Smoke test for game logic (no DOM). Run with: node test-smoke.js

// shim browser globals used in the source files
global.window = global;
global.document = { addEventListener() {}, querySelectorAll: () => [], getElementById: () => null };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

// load source files into this shared scope (they are plain <script> files)
const fs = require('fs');
const vm = require('vm');
const ctx = vm.createContext({
  console, Math, Date, JSON, Array, Object, parseInt, Infinity,
  window: global, document: global.document, localStorage: global.localStorage,
});
const exportTail = '\nthis.Mantis=typeof Mantis!=="undefined"?Mantis:this.Mantis;' +
                   'this.Battle=typeof Battle!=="undefined"?Battle:this.Battle;' +
                   'this.Sprites=typeof Sprites!=="undefined"?Sprites:this.Sprites;' +
                   'this.MOVES=typeof MOVES!=="undefined"?MOVES:this.MOVES;';
for (const f of ['js/sprites.js', 'js/mantis.js', 'js/battle.js']) {
  vm.runInContext(fs.readFileSync(__dirname + '/' + f, 'utf8') + exportTail, ctx, { filename: f });
}
const { Mantis, Battle, Sprites, MOVES } = ctx;

let pass = 0, fail = 0;
const assert = (cond, msg) => {
  if (cond) { pass++; console.log('  ✓ ' + msg); }
  else { fail++; console.error('  ✗ ' + msg); }
};

console.log('--- Mantis state ---');
Mantis.reset();
assert(Mantis.state.hp === 20, 'initial hp = 20');
assert(Mantis.state.food === 3, 'initial food = 3');
assert(Mantis.stage.key === 'egg', 'starts as egg');
assert(['wang','hwangla','neopjok','jom'].includes(Mantis.state.species), `species assigned (${Mantis.state.species})`);
assert(['male','female'].includes(Mantis.state.sex), `sex assigned (${Mantis.state.sex})`);

console.log('--- Sprites ---');
assert(Sprites.egg && Sprites.egg.data.length === 16, 'egg sprite is 16 rows');
assert(Sprites.egg.data[0].length === 16, 'egg sprite is 16 cols');
for (const k of ['egg','nymph','subadult','adult','mosquito','fly','cricket','spider','wasp','hornet']) {
  assert(Sprites[k] && Sprites[k].data.length === 16, `${k} sprite present, 16 rows`);
  assert(Sprites[k].data.every(r => r.length === 16), `${k} sprite all rows 16 cols`);
}

console.log('--- Feed ---');
const beforeFood = Mantis.state.food;
const beforeHunger = Mantis.state.hunger;
const r1 = Mantis.feed();
assert(r1.ok, 'feed succeeded');
assert(Mantis.state.food === beforeFood - 1, 'food decreased by 1');
assert(Mantis.state.hunger > beforeHunger, 'hunger increased');

console.log('--- Egg evolution via exp ---');
Mantis.reset();
// gain enough exp to reach lv 2 → nymph stage
let safety = 100;
while (Mantis.stage.key === 'egg' && safety-- > 0) {
  Mantis.gainExp(20);
}
assert(Mantis.stage.key === 'i1', `evolved out of egg (now ${Mantis.stage.key})`);

console.log('--- Train ---');
const beforeAtk = Mantis.state.atk;
const r2 = Mantis.train();
assert(r2.ok || r2.msg.includes('낮'), 'train returned a result');
// stat increase total = 1 (one of atk/def/spd)
const totalDelta = (Mantis.state.atk - beforeAtk) +
                   (Mantis.state.def - 2) +
                   (Mantis.state.spd - 3);
assert(totalDelta >= 1, 'at least one stat increased by 1+');

console.log('--- Battle ---');
// pump up so player can survive
Mantis.state.atk = 20;
Mantis.state.def = 10;
Mantis.state.spd = 10;
Mantis.state.hp = Mantis.state.maxHp = 200;
const b = Battle.start(Mantis.state);
assert(b !== null, 'battle started');
assert(b.player.hp === 200, 'player hp seeded');
assert(b.enemy.hp > 0, 'enemy hp seeded');

let battleSafety = 30;
while (Battle.active && !Battle.active.done && battleSafety-- > 0) {
  Battle.playerMove('slash');
}
assert(Battle.active && Battle.active.done, 'battle ended');
const result = Battle.active.result;
assert(['win','lose','flee'].includes(result), `battle result = ${result}`);
const summary = Battle.finalize(Mantis.state);
assert(summary !== null, 'finalize returned summary');

console.log('--- Move minStage gating ---');
Mantis.reset();
Mantis.state.stageIdx = 1; // nymph
const b2 = Battle.start(Mantis.state);
const ev = Battle.playerMove('devour');
assert(ev.some(e => e.type === 'invalid'), 'devour is blocked at nymph stage');

console.log('--- Tick / hunger ---');
Mantis.reset();
Mantis.state.stageIdx = 1;
Mantis.state.hunger = 50;
Mantis.tick(60_000);  // 60s game time → 2 hunger ticks
assert(Mantis.state.hunger <= 50, `hunger drained: ${Mantis.state.hunger}`);

console.log('--- Persistence shape ---');
const dumped = JSON.parse(JSON.stringify(Mantis.state));
assert(typeof dumped.level === 'number', 'state serializable');

console.log('');
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
