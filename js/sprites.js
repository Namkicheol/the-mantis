// Pixel art sprites. Each sprite is a 16x16 array of palette indices.
// Palette index 0 = transparent.

const Palettes = {
  egg:    ['', '#5c3a1e', '#8a5a2c', '#caa066', '#f5e0a8', '#fffadd', '#3a230f'],
  mantis: ['', '#1d3a14', '#3a7728', '#62b840', '#a6e07a', '#e7f7c2', '#0e1f08', '#f2c14e', '#c43c3c'],
  enemy:  ['', '#222', '#4a4a4a', '#888', '#bbb', '#e0e0e0', '#c43c3c', '#f2c14e', '#5a3a16', '#8a5a2c'],
  // species recolors (body indices 1-5, eye 6, accents 7-8 shared)
  wang:    ['', '#15300f', '#2f6a22', '#4fa235', '#8fd06a', '#dcf3b0', '#0a1805', '#f2c14e', '#c43c3c'],
  hwangla: ['', '#5a3a12', '#8a6320', '#bb9038', '#ddc070', '#f3e6b0', '#241400', '#f2c14e', '#c43c3c'],
  neopjok: ['', '#36401a', '#5d6e2a', '#86a23f', '#b6cd74', '#e8f3c2', '#161c06', '#f2c14e', '#c43c3c'],
  jom:     ['', '#3a3a30', '#5e5e4c', '#8a8a72', '#b6b6a0', '#e4e4d6', '#15150f', '#f2c14e', '#c43c3c'],
};

// helper: build 16x16 from a string template (16 chars × 16 rows)
// '.' = 0 (transparent), digits 1-9 + letters a-f = palette index
function S(rows) {
  const out = [];
  for (const row of rows) {
    const line = [];
    for (let i = 0; i < 16; i++) {
      const ch = row[i] || '.';
      if (ch === '.' || ch === ' ') line.push(0);
      else if (ch >= '0' && ch <= '9') line.push(parseInt(ch, 10));
      else line.push(parseInt(ch, 16));
    }
    out.push(line);
  }
  while (out.length < 16) out.push(new Array(16).fill(0));
  return out;
}

const Sprites = {
  // ---- mantis growth stages ----
  egg: {
    palette: 'egg',
    data: S([
      '................',
      '................',
      '......1111......',
      '.....122221.....',
      '....12233221....',
      '...1223443221...',
      '..122344544221..',
      '..123445544321..',
      '..123445544321..',
      '..122344544221..',
      '...1223443221...',
      '....12233221....',
      '.....122221.....',
      '......1111......',
      '................',
      '................',
    ]),
  },

  nymph: {
    palette: 'mantis',
    data: S([
      '................',
      '................',
      '.......222......',
      '......23332.....',
      '......26762.....',  // 6=eye black, 7=eye highlight... actually using 6 dark
      '......23332.....',
      '...2..22222..2..',
      '..222.22222.222.',
      '.22.2.22222.2.22',
      '.....2222222....',
      '......22222.....',
      '......2.2.2.....',
      '.....2..2..2....',
      '................',
      '................',
      '................',
    ]),
  },

  subadult: {
    palette: 'mantis',
    data: S([
      '................',
      '................',
      '......33333.....',
      '.....3344433....',
      '.....3406603....',  // 6=black eye, 0/transparent inside... use 6
      '.....3344433....',
      '..3...33333...3.',
      '.333..34443..333',
      '3.3..3344433..3.',
      '.....3344433....',
      '......34443.....',
      '......34443.....',
      '.....3.343.3....',
      '....3...3...3...',
      '................',
      '................',
    ]),
  },

  adult: {
    palette: 'mantis',
    data: S([
      '................',
      '.....4444444....',
      '....455554544...',
      '....465645654...',
      '....455555554...',
      '....455555554...',
      '.4..45544455..4.',
      '444.45444454.444',
      '4.44455555544.4.',
      '..4.4555555444..',
      '....4554555544..',
      '....4544445454..',
      '....4.45454.4...',
      '....4..454..4...',
      '...4...4.4...4..',
      '................',
    ]),
  },

  // ---- enemies (use enemy palette) ----
  mosquito: {
    palette: 'enemy',
    data: S([
      '................',
      '.....3.....3....',
      '......3...3.....',
      '.......333......',
      '......32223.....',
      '.....3222223....',
      '...332222223....',
      '..222226612232..',  // 6 = red eye
      '...332222223....',
      '.....3222223....',
      '......32223.....',
      '.......333......',
      '......3...3.....',
      '.....3.....3....',
      '................',
      '................',
    ]),
  },

  fly: {
    palette: 'enemy',
    data: S([
      '................',
      '................',
      '....4....4......',
      '...4544..4544...',
      '..454454454454..',
      '..454454454454..',
      '...4544..4544...',
      '....4444444.....',
      '...422666224....',  // 6 red eye
      '...422222224....',
      '....4222224.....',
      '.....42224......',
      '......444.......',
      '................',
      '................',
      '................',
    ]),
  },

  cricket: {
    palette: 'enemy',
    data: S([
      '................',
      '................',
      '.......888......',
      '......88688.....',  // 6 dark
      '......88888.....',
      '...8.88888..8...',
      '..888888888888..',
      '.888899998888...',
      '..888899988....',
      '...8888888.....',
      '...8.8.8.8.....',
      '..8..8.8..8....',
      '................',
      '................',
      '................',
      '................',
    ]),
  },

  spider: {
    palette: 'enemy',
    data: S([
      '................',
      '..2..........2..',
      '...2..2222..2...',
      '....22222222....',
      '...22266622....',
      '..2226666622....',
      '..2226666622....',
      '..2222222222....',
      '..2222222222....',
      '...22222222.....',
      '..2..22.22..2...',
      '.2...2...2...2..',
      '2...2.....2...2.',
      '................',
      '................',
      '................',
    ]),
  },

  wasp: {
    palette: 'enemy',
    data: S([
      '................',
      '................',
      '......7777......',
      '.....726627.....',  // 6 red eye
      '.....777777.....',
      '...4.722227..4..',
      '..444777777444..',
      '...4.722227.4...',
      '.....777777.....',
      '.....122221.....',  // bands (1 dark / 7 yellow)
      '.....777777.....',
      '.....122221.....',
      '.....777771.....',
      '......1221......',
      '.......11.......',
      '................',
    ]),
  },

  hornet: {
    palette: 'enemy',
    data: S([
      '................',
      '................',
      '......77777.....',
      '....7766667.....',
      '....7777777.....',
      '..4.7722277..4..',
      '.4444777777444..',
      '..4.7722277.4...',
      '....7777777.....',
      '....1111111.....',
      '....7777777.....',
      '....1111111.....',
      '....7777777.....',
      '.....11111......',
      '......111.......',
      '................',
    ]),
  },
};

// pixel fallback aliases for enemies that only have a photo (no unique pixel art).
// keeps "image not loaded" state visually meaningful instead of an empty canvas.
Sprites.ant         = Sprites.fly;
Sprites.ladybug     = Sprites.cricket;
Sprites.moth        = Sprites.fly;
Sprites.grasshopper = Sprites.cricket;
Sprites.dragonfly   = Sprites.mosquito;
Sprites.centipede   = Sprites.spider;
Sprites.stagbeetle  = Sprites.cricket;
Sprites.scorpion    = Sprites.spider;

// instar generic shapes (egg + 1령~4령), used as ultimate pixel fallback
Sprites.i1 = Sprites.nymph;
Sprites.i2 = Sprites.subadult;
Sprites.i3 = Sprites.subadult;
Sprites.i4 = Sprites.adult;

// species-colored pixel variants (same shapes, swapped palette) for each life form
for (const sp of ['wang', 'hwangla', 'neopjok', 'jom']) {
  Sprites[`${sp}_nymph`]    = { palette: sp, data: Sprites.nymph.data };
  Sprites[`${sp}_subadult`] = { palette: sp, data: Sprites.subadult.data };
  Sprites[`${sp}_adult`]    = { palette: sp, data: Sprites.adult.data };
}

// draw a 16x16 sprite onto a canvas, scaled to fit
function drawSprite(ctx, spriteName, scale, opts = {}) {
  const sprite = Sprites[spriteName];
  if (!sprite) return;
  const palette = Palettes[sprite.palette];
  const data = sprite.data;
  const ox = opts.ox || 0;
  const oy = opts.oy || 0;
  const flip = !!opts.flip;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = data[y][x];
      if (!idx) continue;
      const color = palette[idx];
      if (!color) continue;
      const px = flip ? (15 - x) : x;
      ctx.fillStyle = color;
      ctx.fillRect(ox + px * scale, oy + y * scale, scale, scale);
    }
  }
}

// Photo overrides — when available, drawn instead of pixel sprites.
// Same keys as Sprites so callers stay unchanged.
const PhotoSources = {
  // mantis stages (generic fallbacks)
  egg:      'assets/img/egg.jpg',
  nymph:    'assets/img/nymph.jpg',
  subadult: 'assets/img/subadult.jpg',
  adult:    'assets/img/adult.jpg',
  // transition cutscenes
  molting:  'assets/img/molting.jpg',
  hatch:    'assets/img/hatch.jpg',
  // species real photos (4령 adult per species; subadult/nymph where available)
  wang_adult:        'assets/img/sp_wang_adult.jpg',
  wang_subadult:     'assets/img/sp_wang_subadult.jpg',
  hwangla_adult:     'assets/img/sp_hwangla_adult.jpg',
  hwangla_subadult:  'assets/img/sp_hwangla_subadult.jpg',
  neopjok_adult:     'assets/img/sp_neopjok_adult.jpg',
  neopjok_subadult:  'assets/img/sp_neopjok_subadult.jpg',
  neopjok_nymph:     'assets/img/sp_neopjok_nymph.jpg',
  jom_adult:         'assets/img/sp_jom_adult.jpg',
  jom_subadult:      'assets/img/sp_jom_subadult.jpg',
  // enemies — original 6
  mosquito: 'assets/img/mosquito.jpg',
  fly:      'assets/img/fly.jpg',
  cricket:  'assets/img/cricket.jpg',
  spider:   'assets/img/spider.jpg',
  wasp:     'assets/img/wasp.jpg',
  hornet:   'assets/img/hornet.jpg',
  // enemies — added pack
  ant:         'assets/img/ant.jpg',
  ladybug:     'assets/img/ladybug.jpg',
  moth:        'assets/img/moth.jpg',
  grasshopper: 'assets/img/grasshopper.jpg',
  dragonfly:   'assets/img/dragonfly.jpg',
  centipede:   'assets/img/centipede.jpg',
  stagbeetle:  'assets/img/stagbeetle.jpg',
  scorpion:    'assets/img/scorpion.jpg',
};

// Resolve a render key (e.g. 'wang_adult_female', 'jom_subadult', 'egg') to the
// best available real photo / pixel sprite. Photos only match species-qualified
// or bare keys — never the generic stage photo — so a species without its own
// juvenile photo shows species-tinted pixel art instead of a mismatched photo.
function photoFallbackKeys(key) {
  const p = key.split('_');
  if (p.length === 3) return [key, p[0] + '_' + p[1]]; // wang_adult_female → wang_adult
  return [key];                                         // species_subadult / egg / molting
}
function resolvePhotoKey(key) {
  for (const k of photoFallbackKeys(key)) if (PhotoSources[k]) return k;
  return null;
}
function resolveSpriteKey(key) {
  const p = key.split('_');
  const candidates = [key];
  if (p.length === 3) { candidates.push(p[0] + '_' + p[1]); candidates.push(p[1]); }
  else if (p.length === 2) { candidates.push(p[1]); }
  for (const k of candidates) if (Sprites[k]) return k;
  return 'i4';
}

// image cache + per-canvas pending redraws
const PhotoCache = {};
const PendingRedraws = new Map(); // canvas -> { name, photoKey, opts }

function getPhoto(name) {
  if (PhotoCache[name]) return PhotoCache[name];
  const src = PhotoSources[name];
  if (!src) return null;
  const img = new Image();
  img.loaded = false;
  img.failed = false;
  img.onload = () => {
    img.loaded = true;
    // re-render any canvases that were waiting on this image
    for (const [canvas, pending] of PendingRedraws.entries()) {
      if (pending.photoKey === name) {
        renderCharacter(canvas, pending.name, pending.opts);
        PendingRedraws.delete(canvas);
      }
    }
  };
  img.onerror = () => { img.failed = true; };
  img.src = src;
  PhotoCache[name] = img;
  return img;
}

// "contain"-style draw: preserve aspect ratio, center inside box
function drawPhotoContain(ctx, img, x, y, w, h, flip) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) return;
  const s = Math.min(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  if (flip) {
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0, dw, dh);
  } else {
    ctx.drawImage(img, dx, dy, dw, dh);
  }
  ctx.restore();
}

// render character onto a canvas, centered, with optional ground shadow.
// Uses photographic image when available, falls back to pixel sprite.
function renderCharacter(canvas, spriteName, opts = {}) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const W = canvas.width, H = canvas.height;
  const photoKey = resolvePhotoKey(spriteName);
  const photo = photoKey ? getPhoto(photoKey) : null;

  // ground shadow ellipse (under either renderer)
  if (opts.shadow !== false) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    const cy = H * 0.92;
    ctx.ellipse(W / 2, cy, W * 0.35, H * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (photo && photo.loaded && !photo.failed) {
    // inset a few pixels for breathing room
    const pad = Math.floor(Math.min(W, H) * 0.06);
    drawPhotoContain(ctx, photo, pad, pad, W - pad * 2, H - pad * 2, opts.flip);
    return;
  }

  if (photo && !photo.failed) {
    // queue a redraw when the image finishes loading
    PendingRedraws.set(canvas, { name: spriteName, photoKey, opts });
  }

  // pixel-art fallback (also used as the initial placeholder)
  ctx.imageSmoothingEnabled = false;
  const scale = Math.floor(Math.min(W, H) / 16);
  const w = scale * 16;
  const ox = Math.floor((W - w) / 2);
  const oy = Math.floor((H - w) / 2);
  drawSprite(ctx, resolveSpriteKey(spriteName), scale, { ox, oy, flip: opts.flip });
}
