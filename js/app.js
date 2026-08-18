const MODEL_FILES = [
  '../models/ptolemy/01-simple-circle.js',
  '../models/ptolemy/02-eccentric.js',
  '../models/ptolemy/03-epicycle.js',
  '../models/ptolemy/04-equant.js',
];

let reference = [];
let stageIndex = 0;
let currentModule = null;
let currentPredictions = [];
let selectedIndex = 0;

const els = {
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
      longitudeDeg: Number(obj.geo_lon_deg),
      geoX: Number(obj.geo_x_au),
      geoY: Number(obj.geo_y_au),
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

async function switchModel(newIndex) {
  stageIndex = (newIndex + MODEL_FILES.length) % MODEL_FILES.length;
  currentModule = await import(`${MODEL_FILES[stageIndex]}?stage=${stageIndex}`);
  currentPredictions = reference.map(row => currentModule.predict(row.jd));
  renderModelHeader();
  renderStatistics();
  renderSelectedDay();
  drawLongitudeChart();
}

function renderModelHeader() {
  const m = currentModule.model;
  els.stage.textContent = `STAGE ${m.stage} / 4`;
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
  drawOrbit(pred, ref);
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

function drawOrbit(pred, ref) {
  const { ctx, width, height } = fitCanvas(els.orbit);
  ctx.clearRect(0, 0, width, height);
  const g = pred.geometry;
  const extent = 2.15;
  const scale = Math.min(width, height) * 0.42 / extent;
  const ox = width / 2;
  const oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(150, 170, 205, .28)';
  ctx.beginPath();
  ctx.moveTo(0, oy); ctx.lineTo(width, oy);
  ctx.moveTo(ox, 0); ctx.lineTo(ox, height);
  ctx.stroke();

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
  label(ctx, 'JPL REF.', rp.x + 8, rp.y - 8);
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
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
  ymin -= margin; ymax += margin;

  const xOf = i => pad.l + i / (reference.length - 1) * w;
  const yOf = v => pad.t + (ymax - v) / (ymax - ymin) * h;

  ctx.strokeStyle = 'rgba(150,170,205,.25)';
  ctx.fillStyle = 'rgba(190,205,230,.7)';
  ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
  for (let k = 0; k <= 4; k++) {
    const yv = ymin + (ymax - ymin) * k / 4;
    const y = yOf(yv);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    ctx.fillText(`${Math.round(yv)}°`, 3, y + 4);
  }

  plotSeries(ctx, refU, xOf, yOf, '#7de2ab', 2);
  plotSeries(ctx, predU, xOf, yOf, '#ff8a65', 2);

  const sx = xOf(selectedIndex);
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.beginPath(); ctx.moveTo(sx, pad.t); ctx.lineTo(sx, height - pad.b); ctx.stroke();

  ctx.fillStyle = '#7de2ab'; ctx.fillRect(pad.l, 5, 13, 3);
  ctx.fillStyle = 'rgba(229,235,247,.85)'; ctx.fillText('JPL reference', pad.l + 18, 10);
  ctx.fillStyle = '#ff8a65'; ctx.fillRect(pad.l + 110, 5, 13, 3);
  ctx.fillStyle = 'rgba(229,235,247,.85)'; ctx.fillText('model', pad.l + 128, 10);

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
    const x = xOf(i), y = yOf(v);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
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

  await switchModel(0);
}

init().catch(err => {
  console.error(err);
  document.querySelector('#app').innerHTML = `<div class="fatal">読み込みに失敗しました: ${err.message}</div>`;
});
