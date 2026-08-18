const THEORIES = [
  {
    id: 'ptolemy',
    label: 'プトレマイオス',
    files: [
      '../models/ptolemy/01-simple-circle.js',
      '../models/ptolemy/02-eccentric.js',
      '../models/ptolemy/03-epicycle.js',
      '../models/ptolemy/04-equant.js',
    ],
  },
  {
    id: 'tycho',
    label: 'ティコ・ブラーエ',
    files: ['../models/tycho/01-geoheliocentric-circles.js'],
  },
  {
    id: 'copernicus',
    label: 'コペルニクス',
    files: ['../models/copernicus/01-heliocentric-circles.js'],
  },
  {
    id: 'kepler',
    label: 'ケプラー',
    files: ['../models/kepler/01-elliptic-orbits.js'],
  },
];

let reference = [];
let theoryIndex = 0;
let stageIndex = 0;
let currentModule = null;
let currentPredictions = [];
let selectedIndex = 0;

const els = {
  tabs: [...document.querySelectorAll('.theory-tab')],
  prev: document.querySelector('#prevModel'),
  next: document.querySelector('#nextModel'),
  stage: document.querySelector('#stageLabel'),
  name: document.querySelector('#modelName'),
  description: document.querySelector('#modelDescription'),
  elements: document.querySelector('#modelElements'),
  source: document.querySelector('#sourceFile'),
  date: document.querySelector('#dateLabel'),
  slider: document.querySelector('#dateSlider'),
  predicted: document.querySelector('#predictedLongitude'),
  reference: document.querySelector('#referenceLongitude'),
  error: document.querySelector('#angularError'),
  mae: document.querySelector('#mae'),
  rms: document.querySelector('#rms'),
  max: document.querySelector('#maxError'),
  orbit: document.querySelector('#orbitCanvas'),
  referenceOrbit: document.querySelector('#referenceOrbitCanvas'),
  chart: document.querySelector('#longitudeChart'),
};

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map(line => {
    const cells = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = cells[i]);
    return {
      date: obj.date,
      jd: Number(obj.jd),
      earthX: Number(obj.earth_x_au),
      earthY: Number(obj.earth_y_au),
      earthZ: Number(obj.earth_z_au),
      marsX: Number(obj.mars_x_au),
      marsY: Number(obj.mars_y_au),
      marsZ: Number(obj.mars_z_au),
      geoX: Number(obj.geo_x_au),
      geoY: Number(obj.geo_y_au),
      geoZ: Number(obj.geo_z_au),
      longitudeDeg: Number(obj.geo_lon_deg),
      distanceAu: Number(obj.geo_distance_au),
    };
  });
}

function angularDifferenceDeg(a, b) {
  let d = (a - b + 180) % 360;
  if (d < 0) d += 360;
  return d - 180;
}

function unwrapDegrees(values) {
  if (!values.length) return [];
  const out = [values[0]];
  for (let i = 1; i < values.length; i++) {
    const step = angularDifferenceDeg(values[i], values[i - 1]);
    out.push(out[i - 1] + step);
  }
  return out;
}

async function switchTheory(newTheoryIndex) {
  theoryIndex = (newTheoryIndex + THEORIES.length) % THEORIES.length;
  stageIndex = 0;
  els.tabs.forEach((tab, i) => {
    const active = i === theoryIndex;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  await switchModel(0);
}

async function switchModel(newIndex) {
  const theory = THEORIES[theoryIndex];
  stageIndex = (newIndex + theory.files.length) % theory.files.length;
  const file = theory.files[stageIndex];
  currentModule = await import(`${file}?theory=${theory.id}&stage=${stageIndex}`);
  currentPredictions = reference.map(row => currentModule.predict(row.jd));
  els.prev.disabled = theory.files.length <= 1;
  els.next.disabled = theory.files.length <= 1;
  renderModelHeader();
  renderStatistics();
  renderSelectedDay();
  drawLongitudeChart();
}

function renderModelHeader() {
  const theory = THEORIES[theoryIndex];
  const m = currentModule.model;
  els.stage.textContent = theory.files.length > 1
    ? `STAGE ${stageIndex + 1} / ${theory.files.length}`
    : theory.label;
  els.name.textContent = m.name;
  els.description.textContent = m.description;
  els.elements.innerHTML = m.elements.map(x => `<span>${x}</span>`).join('');
  els.source.textContent = m.sourceFile;
}

function renderStatistics() {
  const errors = currentPredictions.map((p, i) => angularDifferenceDeg(p.longitudeDeg, reference[i].longitudeDeg));
  const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
  const rms = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
  const max = Math.max(...errors.map(Math.abs));
  els.mae.textContent = `${mae.toFixed(2)}°`;
  els.rms.textContent = `${rms.toFixed(2)}°`;
  els.max.textContent = `${max.toFixed(2)}°`;
}

function renderSelectedDay() {
  const ref = reference[selectedIndex];
  const pred = currentPredictions[selectedIndex];
  if (!ref || !pred) return;
  els.date.textContent = ref.date;
  els.predicted.textContent = `${pred.longitudeDeg.toFixed(2)}°`;
  els.reference.textContent = `${ref.longitudeDeg.toFixed(2)}°`;
  els.error.textContent = `${angularDifferenceDeg(pred.longitudeDeg, ref.longitudeDeg).toFixed(2)}°`;
  drawModelOrbit(pred, ref);
  drawReferenceOrbit(ref);
}

function fitCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * ratio));
  const h = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawModelOrbit(pred, ref) {
  const { ctx, width, height } = fitCanvas(els.orbit);
  ctx.clearRect(0, 0, width, height);
  const g = pred.geometry;
  if (g.system) drawSystemGeometry(ctx, width, height, g, ref);
  else drawPtolemyGeometry(ctx, width, height, pred, ref);
}

function drawReferenceOrbit(ref) {
  const { ctx, width, height } = fitCanvas(els.referenceOrbit);
  ctx.clearRect(0, 0, width, height);

  if (!Number.isFinite(ref.earthX) || !Number.isFinite(ref.marsX)) {
    ctx.fillStyle = 'rgba(229,235,247,.85)';
    ctx.font = '14px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('現代基準の軌道座標を生成中…', 24, 38);
    return;
  }

  const extent = 1.85;
  const scale = Math.min(width, height) * 0.43 / extent;
  const ox = width / 2;
  const oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  drawReferencePath(ctx, map, 'earthX', 'earthY', 'rgba(105,167,255,.58)', 2);
  drawReferencePath(ctx, map, 'marsX', 'marsY', 'rgba(255,112,77,.58)', 2);

  const sun = map({ x: 0, y: 0 });
  const earth = map({ x: ref.earthX, y: ref.earthY });
  const mars = map({ x: ref.marsX, y: ref.marsY });

  ctx.strokeStyle = 'rgba(125,226,171,.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(earth.x, earth.y);
  ctx.lineTo(mars.x, mars.y);
  ctx.stroke();

  dot(ctx, sun.x, sun.y, 8, '#ffd166');
  label(ctx, 'SUN', sun.x + 10, sun.y - 10);
  dot(ctx, earth.x, earth.y, 7, '#69a7ff');
  label(ctx, 'EARTH', earth.x + 10, earth.y - 10);
  dot(ctx, mars.x, mars.y, 7, '#ff704d');
  label(ctx, 'MARS', mars.x + 10, mars.y - 10);

  ctx.fillStyle = 'rgba(190,205,230,.72)';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('JPL-derived heliocentric reference', 12, 20);
}

function drawReferencePath(ctx, map, xKey, yKey, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < reference.length; i += 3) {
    const row = reference[i];
    const x = row[xKey];
    const y = row[yKey];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const p = map({ x, y });
    if (!started) {
      ctx.moveTo(p.x, p.y);
      started = true;
    } else {
      ctx.lineTo(p.x, p.y);
    }
  }
  ctx.stroke();
}

function drawAxes(ctx, width, height, ox, oy) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(150, 170, 205, .22)';
  ctx.beginPath();
  ctx.moveTo(0, oy); ctx.lineTo(width, oy);
  ctx.moveTo(ox, 0); ctx.lineTo(ox, height);
  ctx.stroke();
}

function drawSystemGeometry(ctx, width, height, g, ref) {
  const extent = g.extent || 2.75;
  const scale = Math.min(width, height) * 0.43 / extent;
  const ox = width / 2;
  const oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const orbitColors = ['rgba(105,167,255,.62)', 'rgba(241,145,85,.70)', 'rgba(216,108,240,.60)'];
  (g.orbits || []).forEach((orbit, i) => {
    ctx.strokeStyle = orbitColors[i % orbitColors.length];
    ctx.lineWidth = 2;
    if (orbit.kind === 'circle') {
      const c = map(orbit.center);
      ctx.beginPath();
      ctx.arc(c.x, c.y, orbit.radius * scale, 0, Math.PI * 2);
      ctx.stroke();
    } else if (orbit.kind === 'polyline' && orbit.points?.length) {
      ctx.beginPath();
      orbit.points.forEach((p, j) => {
        const q = map(p);
        if (j === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      });
      ctx.stroke();
    }
  });

  if (g.sightline) {
    const a = map(g.sightline.from);
    const b = map(g.sightline.to);
    ctx.strokeStyle = 'rgba(255,138,101,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  const observer = g.observer || { x: 0, y: 0 };
  const rr = Math.min(1.35, extent * 0.55);
  const angle = ref.longitudeDeg * Math.PI / 180;
  const refEnd = {
    x: observer.x + rr * Math.cos(angle),
    y: observer.y + rr * Math.sin(angle),
  };
  const ro = map(observer);
  const rp = map(refEnd);
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = 'rgba(125, 226, 171, .82)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(ro.x, ro.y); ctx.lineTo(rp.x, rp.y); ctx.stroke();
  ctx.setLineDash([]);
  dot(ctx, rp.x, rp.y, 4, '#7de2ab');
  label(ctx, 'REF. DIRECTION', rp.x + 8, rp.y - 8);

  (g.bodies || []).forEach(body => {
    const p = map(body);
    const style = bodyStyle(body.role);
    dot(ctx, p.x, p.y, style.radius, style.color);
    label(ctx, body.name, p.x + 9, p.y - 9);
  });
}

function bodyStyle(role) {
  if (role === 'sun') return { radius: 8, color: '#ffd166' };
  if (role === 'earth') return { radius: 7, color: '#69a7ff' };
  if (role === 'mars') return { radius: 7, color: '#ff704d' };
  return { radius: 5, color: '#dbe7f7' };
}

function drawPtolemyGeometry(ctx, width, height, pred, ref) {
  const g = pred.geometry;
  const extent = 2.15;
  const scale = Math.min(width, height) * 0.42 / extent;
  const ox = width / 2;
  const oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const dc = map(g.deferentCenter);
  ctx.strokeStyle = 'rgba(98, 153, 255, .68)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(dc.x, dc.y, g.deferentRadius * scale, 0, Math.PI * 2);
  ctx.stroke();

  if (g.epicycleCenter) {
    const ec = map(g.epicycleCenter);
    ctx.strokeStyle = 'rgba(241, 145, 85, .72)';
    ctx.beginPath();
    ctx.arc(ec.x, ec.y, g.epicycleRadius * scale, 0, Math.PI * 2);
    ctx.stroke();
    dot(ctx, ec.x, ec.y, 4, '#f19155');
  }

  if (g.equant) {
    const q = map(g.equant);
    dot(ctx, q.x, q.y, 5, '#d86cf0');
    label(ctx, 'EQUANT', q.x + 8, q.y - 8);
  }

  const earth = map(g.earth);
  dot(ctx, earth.x, earth.y, 8, '#69a7ff');
  label(ctx, 'EARTH', earth.x + 10, earth.y - 10);

  const mars = map(pred.mars);
  dot(ctx, mars.x, mars.y, 7, '#ff704d');
  label(ctx, 'MARS', mars.x + 10, mars.y - 10);

  const rr = 1.85;
  const a = ref.longitudeDeg * Math.PI / 180;
  const rp = map({ x: rr * Math.cos(a), y: rr * Math.sin(a) });
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = 'rgba(125, 226, 171, .78)';
  ctx.beginPath();
  ctx.moveTo(earth.x, earth.y); ctx.lineTo(rp.x, rp.y); ctx.stroke();
  ctx.setLineDash([]);
  dot(ctx, rp.x, rp.y, 4, '#7de2ab');
  label(ctx, 'REF. DIRECTION', rp.x + 8, rp.y - 8);
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function label(ctx, text, x, y) {
  ctx.fillStyle = 'rgba(229,235,247,.9)';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(text, x, y);
}

function drawLongitudeChart() {
  const { ctx, width, height } = fitCanvas(els.chart);
  ctx.clearRect(0, 0, width, height);
  const pad = { l: 48, r: 18, t: 22, b: 30 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  const refU = unwrapDegrees(reference.map(x => x.longitudeDeg));
  const predU = unwrapDegrees(currentPredictions.map(x => x.longitudeDeg));
  const branch = Math.round((refU[0] - predU[0]) / 360) * 360;
  for (let i = 0; i < predU.length; i++) predU[i] += branch;

  let ymin = Math.min(...refU, ...predU);
  let ymax = Math.max(...refU, ...predU);
  const margin = Math.max(20, (ymax - ymin) * 0.05);
  ymin -= margin;
  ymax += margin;

  const xOf = i => pad.l + i / (reference.length - 1) * w;
  const yOf = v => pad.t + (ymax - v) / (ymax - ymin) * h;

  ctx.strokeStyle = 'rgba(150,170,205,.25)';
  ctx.fillStyle = 'rgba(190,205,230,.7)';
  ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
  for (let k = 0; k <= 4; k++) {
    const yv = ymin + (ymax - ymin) * k / 4;
    const y = yOf(yv);
    ctx.beginPath();
    ctx.moveTo(pad.l, y);
    ctx.lineTo(width - pad.r, y);
    ctx.stroke();
    ctx.fillText(`${Math.round(yv)}°`, 3, y + 4);
  }

  plotSeries(ctx, refU, xOf, yOf, '#7de2ab', 2);
  plotSeries(ctx, predU, xOf, yOf, '#ff8a65', 2);

  const sx = xOf(selectedIndex);
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath();
  ctx.moveTo(sx, pad.t);
  ctx.lineTo(sx, height - pad.b);
  ctx.stroke();

  ctx.fillStyle = '#7de2ab';
  ctx.fillRect(pad.l, 5, 13, 3);
  ctx.fillStyle = 'rgba(229,235,247,.85)';
  ctx.fillText('JPL reference', pad.l + 18, 10);
  ctx.fillStyle = '#ff8a65';
  ctx.fillRect(pad.l + 110, 5, 13, 3);
  ctx.fillStyle = 'rgba(229,235,247,.85)';
  ctx.fillText('model', pad.l + 128, 10);

  ctx.fillStyle = 'rgba(190,205,230,.7)';
  ctx.fillText(reference[0].date, pad.l, height - 8);
  const end = reference[reference.length - 1].date;
  ctx.fillText(end, width - pad.r - ctx.measureText(end).width, height - 8);
}

function plotSeries(ctx, values, xOf, yOf, color, lineWidth) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = xOf(i);
    const y = yOf(v);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

async function init() {
  const text = await fetch('./data/mars_reference_2020_2030.csv').then(r => {
    if (!r.ok) throw new Error(`reference data: HTTP ${r.status}`);
    return r.text();
  });
  reference = parseCSV(text);
  els.slider.max = String(reference.length - 1);
  selectedIndex = Math.floor(reference.length * 0.45);
  els.slider.value = String(selectedIndex);

  els.tabs.forEach((tab, i) => tab.addEventListener('click', () => switchTheory(i)));
  els.prev.addEventListener('click', () => switchModel(stageIndex - 1));
  els.next.addEventListener('click', () => switchModel(stageIndex + 1));
  els.slider.addEventListener('input', e => {
    selectedIndex = Number(e.target.value);
    renderSelectedDay();
    drawLongitudeChart();
  });
  window.addEventListener('resize', () => {
    renderSelectedDay();
    drawLongitudeChart();
  });

  await switchTheory(0);
}

init().catch(err => {
  console.error(err);
  document.querySelector('#app').innerHTML = `<div class="fatal">読み込みに失敗しました: ${err.message}</div>`;
});
