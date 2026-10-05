const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const genBtn = document.getElementById('generateBtn');
const infoEl = document.getElementById('info');

let W, H;
function resize() {
  W = canvas.width = window.innerWidth * devicePixelRatio;
  H = canvas.height = window.innerHeight * devicePixelRatio;
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
}
window.addEventListener('resize', resize);
resize();

// ---------- Состояние ----------
const state = {
  planet: null,
  // камера: yaw (горизонтальный поворот), pitch (наклон вверх/вниз)
  yaw: 0,
  pitch: 0,
  // позиция "игрока" на сфере (сферические координаты)
  lat: 0,   // широта (-PI/2 .. PI/2)
  lon: 0,   // долгота
  altitude: 1.15, // высота над поверхностью (в радиусах планеты)
  vel: { lat: 0, lon: 0 },
  joyActive: false,
  joyStart: { x: 0, y: 0 },
  joyVec: { x: 0, y: 0 },
  lookActive: false,
  lookStart: { x: 0, y: 0 },
  lookStartYaw: 0,
  lookStartPitch: 0,
  time: 0,
  stars: [],
};

// ---------- Утилиты ----------
function rand(seedObj) { return Math.random(); } // упрощённо

function randRange(a, b) { return a + Math.random() * (b - a); }

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ---------- Генерация планеты ----------
function generatePlanet() {
  const palettes = [
    // каменистая красная (Марс)
    { name: 'Каменистая', base: [140, 70, 50], accent: [190, 110, 70], atmo: [255, 140, 90] },
    // океаническая (Земля)
    { name: 'Океаническая', base: [30, 90, 160], accent: [70, 180, 90], atmo: [120, 190, 255] },
    // ледяная
    { name: 'Ледяная', base: [200, 220, 240], accent: [140, 170, 200], atmo: [180, 220, 255] },
    // лавовая
    { name: 'Лавовая', base: [60, 20, 15], accent: [255, 90, 30], atmo: [255, 80, 40] },
    // газовая (полосатая)
    { name: 'Газовая', base: [210, 170, 120], accent: [140, 90, 60], atmo: [255, 200, 150] },
    // токсичная
    { name: 'Токсичная', base: [110, 140, 40], accent: [180, 220, 60], atmo: [160, 220, 60] },
    // фиолетовая
    { name: 'Кристаллическая', base: [90, 40, 140], accent: [180, 90, 220], atmo: [200, 140, 255] },
  ];
  const p = pick(palettes);
  const r = randRange(0.6, 1.0); // размер для отрисовки (масштаб)

  // ландшафтные "пятна" - несколько синусоидальных полос по широте/долготе
  const blobs = [];
  const blobCount = Math.floor(randRange(8, 20));
  for (let i = 0; i < blobCount; i++) {
    blobs.push({
      lat: randRange(-Math.PI/2, Math.PI/2),
      lon: randRange(0, Math.PI*2),
      r: randRange(0.3, 1.1),
      strength: randRange(0.4, 1.0),
      color: Math.random() < 0.5 ? p.base : p.accent,
    });
  }

  // есть ли жизнь? ~5%
  const hasLife = Math.random() < 0.05;
  const lifeCount = hasLife ? Math.floor(randRange(20, 60)) : 0;
  const life = [];
  for (let i = 0; i < lifeCount; i++) {
    life.push({
      lat: randRange(-Math.PI/3, Math.PI/3),
      lon: randRange(0, Math.PI*2),
      size: randRange(0.01, 0.03),
      hue: randRange(80, 140), // зеленоватые
      phase: randRange(0, Math.PI*2),
    });
  }

  // кольца иногда
  const hasRings = Math.random() < 0.25;
  const rings = hasRings ? {
    inner: randRange(1.4, 1.6),
    outer: randRange(1.9, 2.4),
    tilt: randRange(-0.6, 0.6),
    color: p.accent,
  } : null;

  state.planet = {
    name: p.name,
    palette: p,
    blobs,
    hasLife,
    life,
    rings,
    scale: r,
    atmoColor: p.atmo,
    seed: Math.random(),
  };

  // сброс положения
  state.lat = 0;
  state.lon = 0;
  state.yaw = 0;
  state.pitch = 0;
  state.altitude = 1.3;
  state.vel = { lat: 0, lon: 0 };

  // звёзды
  state.stars = [];
  for (let i = 0; i < 200; i++) {
    state.stars.push({
      x: Math.random(),
      y: Math.random(),
      s: Math.random() * 1.6 + 0.3,
      a: Math.random() * 0.7 + 0.3,
    });
  }

  updateInfo();
}

function updateInfo() {
  if (!state.planet) return;
  const p = state.planet;
  let txt = `🪐 ${p.name}`;
  if (p.hasLife) txt += ` · 🌱 Обнаружена жизнь!`;
  if (p.rings) txt += ` · 💫 Кольца`;
  infoEl.textContent = txt;
}

// ---------- Отрисовка сферы (простая 2D-проекция) ----------
function drawPlanet(cx, cy, radius) {
  const p = state.planet;
  if (!p) return;

  const R = radius;

  // Атмосферное свечение
  const atmoGrad = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.25);
  atmoGrad.addColorStop(0, `rgba(${p.atmoColor.join(',')},0.35)`);
  atmoGrad.addColorStop(1, `rgba(${p.atmoColor.join(',')},0)`);
  ctx.fillStyle = atmoGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Сама планета - клип по кругу
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // Базовый цвет
  ctx.fillStyle = `rgb(${p.palette.base.join(',')})`;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  // Пятна поверхности - рисуем как круги, проецируя сферические координаты на 2D
  // (упрощённо: без полного 3D-вращения, но с учётом yaw через смещение lon)
  for (const b of p.blobs) {
    // вычисляем экранную позицию с учётом yaw/pitch камеры
    const proj = projectSphere(b.lat, b.lon, R);
    if (proj.front) {
      const grad = ctx.createRadialGradient(
        cx + proj.x, cy + proj.y, 0,
        cx + proj.x, cy + proj.y, b.r * R * 0.6
      );
      const c = b.color;
      grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${b.strength * 0.9})`);
      grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx + proj.x, cy + proj.y, b.r * R * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Жизнь
  if (p.hasLife) {
    for (const l of p.life) {
      const proj = projectSphere(l.lat, l.lon, R);
      if (proj.front) {
        const pulse = 0.6 + 0.4 * Math.sin(state.time * 2 + l.phase);
        ctx.fillStyle = `hsla(${l.hue}, 70%, 55%, ${pulse})`;
        ctx.beginPath();
        ctx.arc(cx + proj.x, cy + proj.y, l.size * R, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Затенение (освещение с верхнего-левого угла)
  const shadeGrad = ctx.createRadialGradient(
    cx - R * 0.4, cy - R * 0.4, R * 0.1,
    cx, cy, R * 1.4
  );
  shadeGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
  shadeGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
  shadeGrad.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

  ctx.restore();

  // Контур
  ctx.strokeStyle = `rgba(${p.atmoColor.join(',')},0.6)`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
}

// Проекция сферической точки на экран (упрощённая)
function projectSphere(lat, lon, R) {
  // поворот на yaw и pitch
  const lonRel = lon - state.yaw;
  const x3 = Math.cos(lat) * Math.sin(lonRel);
  const y3 = Math.sin(lat);
  const z3 = Math.cos(lat) * Math.cos(lonRel);

  // поворот по pitch вокруг X
  const cp = Math.cos(state.pitch);
  const sp = Math.sin(state.pitch);
  const y2 = y3 * cp - z3 * sp;
  const z2 = y3 * sp + z3 * cp;

  // "front" = обращён к камере (z2 > 0)
  const front = z2 > 0.05;
  return {
    x: x3 * R,
    y: -y2 * R,
    front,
    z: z2,
  };
}

// ---------- Главный цикл ----------
function loop(t) {
  state.time = t / 1000;

  // обновление физики движения
  if (state.joyActive) {
    const speed = 0.6;
    state.vel.lon = state.joyVec.x * speed;
    state.vel.lat = -state.joyVec.y * speed;
  } else {
    state.vel.lon *= 0.9;
    state.vel.lat *= 0.9;
  }

  state.lat += state.vel.lat * 0.016;
  state.lon += state.vel.lon * 0.016;

  // ограничение широты
  const maxLat = Math.PI / 2 - 0.1;
  if (state.lat > maxLat) { state.lat = maxLat; state.vel.lat = 0; }
  if (state.lat < -maxLat) { state.lat = -maxLat; state.vel.lat = 0; }

  // Камера следует за игроком плавно
  // yaw привязывается к lon, если не смотрим вручную
  state.yaw += (state.lon - state.yaw) * 0.08;

  // ---------- Отрисовка ----------
  ctx.fillStyle = '#02020a';
  ctx.fillRect(0, 0, W, H);

  // звёзды
  for (const s of state.stars) {
    ctx.fillStyle = `rgba(255,255,255,${s.a})`;
    ctx.fillRect(s.x * W, s.y * H, s.s * devicePixelRatio, s.s * devicePixelRatio);
  }

  const cx = W / 2;
  const cy = H / 2;
  const baseR = Math.min(W, H) * 0.32;
  const R = baseR * (state.planet ? state.planet.scale : 1);

  // "Игрок" всегда в центре, планета вращается относительно камеры
  if (state.planet) {
    drawPlanet(cx, cy, R);

    // Кольца
    if (state.planet.rings) {
      drawRings(cx, cy, R, state.planet.rings);
    }
  } else {
    // Заглушка
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath();
    ctx.arc(cx, cy, baseR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a4a7a';
    ctx.font = `${28 * devicePixelRatio}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('Нажми кнопку выше 👆', cx, cy);
  }

  // Джойстик
  if (state.joyActive) {
    const dx = state.joyStart.x * devicePixelRatio;
    const dy = state.joyStart.y * devicePixelRatio;
    const rOuter = 60 * devicePixelRatio;
    const rInner = 24 * devicePixelRatio;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3 * devicePixelRatio;
    ctx.beginPath();
    ctx.arc(dx, dy, rOuter, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,180,255,0.6)';
    ctx.beginPath();
    ctx.arc(dx + state.joyVec.x * rOuter * 0.7, dy + state.joyVec.y * rOuter * 0.7, rInner, 0, Math.PI * 2);
    ctx.fill();
  }

  requestAnimationFrame(loop);
}

function drawRings(cx, cy, R, rings) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rings.tilt);
  const grad = ctx.createLinearGradient(-R * rings.outer, 0, R * rings.outer, 0);
  const c = rings.color;
  grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  grad.addColorStop(0.5, `rgba(${c[0]},${c[1]},${c[2]},0.5)`);
  grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
  ctx.strokeStyle = grad;
  ctx.lineWidth = (rings.outer - rings.inner) * R;
  ctx.beginPath();
  const midR = (rings.inner + rings.outer) / 2 * R;
  ctx.ellipse(0, 0, midR, midR * 0.3, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ---------- Управление ----------
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const x = t.clientX;
    const y = t.clientY;
    // Джойстик - левый нижний угол
    if (x < window.innerWidth * 0.5 && y > window.innerHeight * 0.5 && !state.joyActive) {
      state.joyActive = true;
      state.joyStart.x = x;
      state.joyStart.y = y;
      state.joyVec.x = 0;
      state.joyVec.y = 0;
    }
    // Look - правый верхний угол
    else if (x > window.innerWidth * 0.5 && y < window.innerHeight * 0.5 && !state.lookActive) {
      state.lookActive = true;
      state.lookStart.x = x;
      state.lookStart.y = y;
      state.lookStartYaw = state.yaw;
      state.lookStartPitch = state.pitch;
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const x = t.clientX;
    const y = t.clientY;

    if (state.joyActive) {
      const dx = x - state.joyStart.x;
      const dy = y - state.joyStart.y;
      const maxD = 60;
      const d = Math.hypot(dx, dy);
      const k = d > maxD ? maxD / d : 1;
      state.joyVec.x = (dx * k) / maxD;
      state.joyVec.y = (dy * k) / maxD;
    }

    if (state.lookActive) {
      const dx = x - state.lookStart.x;
      const dy = y - state.lookStart.y;
      state.yaw = state.lookStartYaw - dx * 0.01;
      state.pitch = state.lookStartPitch - dy * 0.008;
      // ограничим pitch
      state.pitch = Math.max(-1.2, Math.min(1.2, state.pitch));
      // При ручном повороте отвязываем yaw от lon — плавно
    }
  }
}, { passive: false });

function endTouch(e) {
  for (const t of e.changedTouches) {
    if (state.joyActive && t.clientX < window.innerWidth * 0.5 && t.clientY > window.innerHeight * 0.5) {
      state.joyActive = false;
      state.joyVec.x = 0;
      state.joyVec.y = 0;
    }
    if (state.lookActive && t.clientX > window.innerWidth * 0.5 && t.clientY < window.innerHeight * 0.5) {
      state.lookActive = false;
    }
  }
}
canvas.addEventListener('touchend', endTouch, { passive: false });
canvas.addEventListener('touchcancel', endTouch, { passive: false });

// Мышь для десктопа
let mouseDown = false;
canvas.addEventListener('mousedown', (e) => {
  mouseDown = true;
  const x = e.clientX, y = e.clientY;
  if (x < window.innerWidth * 0.5 && y > window.innerHeight * 0.5) {
    state.joyActive = true;
    state.joyStart.x = x; state.joyStart.y = y;
  } else if (x > window.innerWidth * 0.5 && y < window.innerHeight * 0.5) {
    state.lookActive = true;
    state.lookStart.x = x; state.lookStart.y = y;
    state.lookStartYaw = state.yaw;
    state.lookStartPitch = state.pitch;
  }
});
canvas.addEventListener('mousemove', (e) => {
  if (!mouseDown) return;
  const x = e.clientX, y = e.clientY;
  if (state.joyActive) {
    const dx = x - state.joyStart.x;
    const dy = y - state.joyStart.y;
    const maxD = 60;
    const d = Math.hypot(dx, dy);
    const k = d > maxD ? maxD / d : 1;
    state.joyVec.x = (dx * k) / maxD;
    state.joyVec.y = (dy * k) / maxD;
  }
  if (state.lookActive) {
    const dx = x - state.lookStart.x;
    const dy = y - state.lookStart.y;
    state.yaw = state.lookStartYaw - dx * 0.01;
    state.pitch = Math.max(-1.2, Math.min(1.2, state.lookStartPitch - dy * 0.008));
  }
});
canvas.addEventListener('mouseup', () => {
  mouseDown = false;
  state.joyActive = false;
  state.lookActive = false;
  state.joyVec.x = 0; state.joyVec.y = 0;
});

// Кнопка
genBtn.addEventListener('click', () => {
  generatePlanet();
});

// Первая планета
generatePlanet();
requestAnimationFrame(loop);
