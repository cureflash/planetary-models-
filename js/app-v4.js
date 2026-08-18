const THEORIES = [
  { id: 'observation', label: 'Carlsberg実観測', files: [] },
  {
    id: 'ptolemy', label: 'プトレマイオス',
    files: [
      '../models/ptolemy/01-simple-circle.js',
      '../models/ptolemy/02-epicycle.js',
      '../models/ptolemy/03-epicycle-eccentric.js',
      '../models/ptolemy/04-equant.js',
    ],
    historicalFile: '../models/ptolemy/05-almagest-mars.js',
  },
  { id: 'tycho', label: 'ティコ・ブラーエ', files: ['../models/tycho/01-geoheliocentric-circles.js'] },
  { id: 'copernicus', label: 'コペルニクス', files: ['../models/copernicus/01-heliocentric-circles.js'] },
  { id: 'kepler', label: 'ケプラー', files: ['../models/kepler/01-elliptic-orbits.js'] },
];

const OBSERVATION_MODEL = {
  model: {
    id: 'observation',
    stage: 0,
    name: '地球固定・Carlsberg火星実観測',
    shortName: '実観測',
    sourceFile: 'data/mars_observations_carlsberg.csv',
    description: 'Carlsberg Meridian Catalogの子午環による火星実観測です。地球を中央に固定し、観測された見かけ方向だけを一定半径上に表示します。距離は仮定しません。',
    elements: ['地球固定', '火星のみ', '実観測RA/Dec', '見かけ方向'],
  },
};

let observations = [];
let theoryIndex = 0;
let stageIndex = 0;
let ptolemyMode = 'fitted';
let currentModule = null;
let currentPredictions = [];
let selectedIndex = 0;

const els = {
  tabs: [...document.querySelectorAll('.theory-tab')],
  parameterPanel: document.querySelector('#ptolemyParameterPanel'),
  parameterButtons: [...document.querySelectorAll('[data-ptolemy-mode]')],
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
  predictedTerm: document.querySelector('#predictedTerm'),
  referenceTerm: document.querySelector('#referenceTerm'),
  errorTerm: document.querySelector('#errorTerm'),
  orbitKicker: document.querySelector('#orbitKicker'),
  orbitTitle: document.querySelector('#orbitTitle'),
  orbitNote: document.querySelector('#orbitNote'),
  chartKicker: document.querySelector('#chartKicker'),
  chartTitle: document.querySelector('#chartTitle'),
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
    headers.forEach((h, i) => obj[h] = cells[i] ?? '');
    return {
      date: obj.date,
      timestamp: obj.timestamp_tdt,
      jd: Number(obj.tdt_jd),
      raDeg: Number(obj.ra_deg),
      decDeg: Number(obj.dec_deg),
      longitudeDeg: Number(obj.ecliptic_lon_deg),
      qualityFlag: obj.quality_flag || '',
      sourceVolume: obj.source_volume || '',
      sourceCatalog: obj.source_catalog || '',
    };
  }).filter(row => Number.isFinite(row.jd) && Number.isFinite(row.longitudeDeg));
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
    out.push(out[i - 1] + angularDifferenceDeg(values[i], values[i - 1]));
  }
  return out;
}

function polarPoint(longitudeDeg, radius = 1) {
  const a = longitudeDeg * Math.PI / 180;
  return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
}

function isObservationMode() {
  return THEORIES[theoryIndex].id === 'observation';
}

function filesForTheory(theory) {
  if (theory.id === 'ptolemy' && ptolemyMode === 'almagest') return [theory.historicalFile];
  return theory.files;
}

function updatePtolemyControls() {
  const isPtolemy = THEORIES[theoryIndex].id === 'ptolemy';
  els.parameterPanel.hidden = !isPtolemy;
  els.parameterButtons.forEach(button => {
    const active = button.dataset.ptolemyMode === ptolemyMode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

async function switchTheory(newTheoryIndex) {
  theoryIndex = (newTheoryIndex + THEORIES.length) % THEORIES.length;
  stageIndex = 0;
  els.tabs.forEach((tab, i) => {
    const active = i === theoryIndex;
    tab.classList.toggle('active', active);
    if (active) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  });
  updatePtolemyControls();
  await switchModel(0);
}

async function setPtolemyMode(mode) {
  if (!['fitted', 'almagest'].includes(mode) || ptolemyMode === mode) return;
  ptolemyMode = mode;
  stageIndex = 0;
  updatePtolemyControls();
  await switchModel(0);
}

async function switchModel(newIndex) {
  const theory = THEORIES[theoryIndex];
  if (theory.id === 'observation') {
    currentModule = OBSERVATION_MODEL;
    currentPredictions = observations.map(row => ({
      longitudeDeg: row.longitudeDeg,
      mars: polarPoint(row.longitudeDeg, 1.5),
      geometry: { system: 'observation' },
    }));
    stageIndex = 0;
    els.prev.disabled = true;
    els.next.disabled = true;
  } else {
    const files = filesForTheory(theory);
    stageIndex = (newIndex + files.length) % files.length;
    const file = files[stageIndex];
    currentModule = await import(`${file}?theory=${theory.id}&mode=${ptolemyMode}&stage=${stageIndex}&v=carlsberg`);
    currentPredictions = observations.map(row => currentModule.predict(row.jd));
    els.prev.disabled = files.length <= 1;
    els.next.disabled = files.length <= 1;
  }
  renderModelHeader();
  renderStatistics();
  renderSelectedObservation();
  drawLongitudeChart();
}

function renderModelHeader() {
  const theory = THEORIES[theoryIndex];
  const files = filesForTheory(theory);
  const m = currentModule.model;
  if (theory.id === 'observation') {
    els.stage.textContent = 'CARLSBERG / OBSERVED';
  } else if (theory.id === 'ptolemy' && ptolemyMode === 'almagest') {
    els.stage.textContent = 'ALMAGEST / HISTORICAL PARAMETERS';
  } else if (files.length > 1) {
    els.stage.textContent = `STAGE ${stageIndex + 1} / ${files.length}`;
  } else {
    els.stage.textContent = theory.label;
  }
  els.name.textContent = m.name;
  els.description.textContent = m.description;
  els.elements.innerHTML = m.elements.map(x => `<span>${x}</span>`).join('');
  els.source.textContent = m.sourceFile;
  updateViewLabels();
}

function updateViewLabels() {
  const first = observations[0]?.date || '';
  const last = observations.at(-1)?.date || '';
  if (isObservationMode()) {
    els.orbitKicker.textContent = 'ACTUAL ASTROMETRY';
    els.orbitTitle.textContent = '地球を固定した火星の実観測方向';
    els.orbitNote.textContent = '地球は中央に固定しています。緑の破線はCarlsbergで実際に測られた火星の見かけ方向を、観測順に結んだものです。距離は測定値ではないため一定半径で表示します。スライダー先頭では軌跡はありません。';
    els.chartKicker.textContent = `${first} – ${last}`;
    els.chartTitle.textContent = 'Carlsberg火星実観測：地心黄経';
    els.predictedTerm.textContent = '観測地心黄経';
    els.referenceTerm.textContent = '赤経 / 赤緯';
    els.errorTerm.textContent = '観測資料';
  } else {
    els.orbitKicker.textContent = 'MODEL + CARLSBERG';
    els.orbitTitle.textContent = 'モデルとCarlsberg実観測';
    els.orbitNote.textContent = '赤い実線がモデルがスライダー位置までに辿った軌跡、緑の破線がCarlsberg実観測です。観測データは方向だけなので、プトレマイオスでは各時刻のモデル火星と同じ半径上へ観測方向を投影して比較します。';
    els.chartKicker.textContent = `${first} – ${last}`;
    els.chartTitle.textContent = '火星の地心黄経：モデル vs Carlsberg実観測';
    els.predictedTerm.textContent = 'モデル予測';
    els.referenceTerm.textContent = 'Carlsberg実観測';
    els.errorTerm.textContent = '角度誤差';
  }
}

function renderStatistics() {
  if (isObservationMode()) {
    els.mae.textContent = '—';
    els.rms.textContent = '—';
    els.max.textContent = '—';
    return;
  }
  const errors = currentPredictions.map((p, i) => angularDifferenceDeg(p.longitudeDeg, observations[i].longitudeDeg));
  const mae = errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
  const rms = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / errors.length);
  const max = Math.max(...errors.map(Math.abs));
  els.mae.textContent = `${mae.toFixed(3)}°`;
  els.rms.textContent = `${rms.toFixed(3)}°`;
  els.max.textContent = `${max.toFixed(3)}°`;
}

function renderSelectedObservation() {
  const ref = observations[selectedIndex];
  const pred = currentPredictions[selectedIndex];
  if (!ref || !pred) return;
  els.date.textContent = `${ref.date}  ${ref.sourceVolume}`;
  if (isObservationMode()) {
    els.predicted.textContent = `${ref.longitudeDeg.toFixed(3)}°`;
    els.reference.textContent = `${(ref.raDeg / 15).toFixed(3)}h / ${ref.decDeg.toFixed(3)}°`;
    els.error.textContent = ref.sourceCatalog || 'Carlsberg';
  } else {
    els.predicted.textContent = `${pred.longitudeDeg.toFixed(3)}°`;
    els.reference.textContent = `${ref.longitudeDeg.toFixed(3)}°`;
    els.error.textContent = `${angularDifferenceDeg(pred.longitudeDeg, ref.longitudeDeg).toFixed(3)}°`;
  }
  drawOrbit(pred, ref);
}

function fitCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * ratio));
  const h = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawAxes(ctx, width, height, ox, oy) {
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(150,170,205,.20)';
  ctx.beginPath();
  ctx.moveTo(0, oy); ctx.lineTo(width, oy);
  ctx.moveTo(ox, 0); ctx.lineTo(ox, height);
  ctx.stroke();
}

function dot(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function ring(ctx, x, y, r, color, lineWidth = 2) {
  ctx.strokeStyle = color; ctx.lineWidth = lineWidth;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
}

function label(ctx, text, x, y, color = 'rgba(229,235,247,.9)') {
  ctx.fillStyle = color;
  ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
  ctx.fillText(text, x, y);
}

function drawPolyline(ctx, map, points, { color, dashed = false, lineWidth = 2, maxGapDays = Infinity } = {}) {
  if (points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dashed ? [7, 6] : []);
  ctx.beginPath();
  let prev = null;
  for (const item of points) {
    if (!item?.point || !Number.isFinite(item.point.x) || !Number.isFinite(item.point.y)) continue;
    const p = map(item.point);
    const gap = prev ? item.jd - prev.jd : 0;
    if (!prev || gap > maxGapDays) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
    prev = item;
  }
  ctx.stroke();
  ctx.restore();
}

function observationHistory(radiusForIndex) {
  const out = [];
  for (let i = 0; i <= selectedIndex; i++) {
    const row = observations[i];
    const radius = radiusForIndex(i);
    out.push({ jd: row.jd, point: polarPoint(row.longitudeDeg, radius) });
  }
  return out;
}

function modelHistoryPtolemy() {
  const out = [];
  if (selectedIndex < 1) return out;
  const start = observations[0].jd;
  const stop = observations[selectedIndex].jd;
  for (let jd = start; jd <= stop; jd += 1) {
    const p = currentModule.predict(jd);
    out.push({ jd, point: p.mars });
  }
  const final = currentModule.predict(stop);
  if (!out.length || out.at(-1).jd !== stop) out.push({ jd: stop, point: final.mars });
  return out;
}

function drawOrbit(pred, ref) {
  const { ctx, width, height } = fitCanvas(els.orbit);
  ctx.clearRect(0, 0, width, height);
  if (isObservationMode()) return drawObservationGeometry(ctx, width, height, ref);
  if (pred.geometry?.system) return drawSystemGeometry(ctx, width, height, pred, ref);
  return drawPtolemyGeometry(ctx, width, height, pred, ref);
}

function drawObservationGeometry(ctx, width, height, ref) {
  const extent = 1.9;
  const scale = Math.min(width, height) * 0.42 / extent;
  const ox = width / 2, oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const history = observationHistory(() => 1.5);
  drawPolyline(ctx, map, history, { color: '#7de2ab', dashed: true, lineWidth: 2.2, maxGapDays: 35 });
  for (const item of history) {
    const p = map(item.point);
    dot(ctx, p.x, p.y, 2.2, 'rgba(125,226,171,.85)');
  }

  const earth = map({ x: 0, y: 0 });
  const mars = map(polarPoint(ref.longitudeDeg, 1.5));
  dot(ctx, earth.x, earth.y, 8, '#69a7ff');
  label(ctx, 'EARTH (FIXED)', earth.x + 10, earth.y - 10);
  dot(ctx, mars.x, mars.y, 8, '#ff704d');
  label(ctx, 'MARS (OBSERVED DIRECTION)', mars.x + 10, mars.y - 10);
  label(ctx, 'DASHED = CARLSBERG OBSERVATIONS', 12, 20, '#7de2ab');
}

function modelMarsForSystem(prediction) {
  const body = prediction?.geometry?.bodies?.find(x => x.role === 'mars');
  return body ? { x: body.x, y: body.y } : null;
}

function observerForSystem(prediction) {
  if (prediction?.geometry?.system === 'tycho') return { x: 0, y: 0 };
  const earth = prediction?.geometry?.bodies?.find(x => x.role === 'earth');
  return earth ? { x: earth.x, y: earth.y } : { x: 0, y: 0 };
}

function observedPointForSystem(prediction, observation) {
  const observer = observerForSystem(prediction);
  const modelMars = modelMarsForSystem(prediction);
  if (!modelMars) return null;
  const distance = Math.hypot(modelMars.x - observer.x, modelMars.y - observer.y);
  const v = polarPoint(observation.longitudeDeg, distance);
  return { x: observer.x + v.x, y: observer.y + v.y };
}

function drawSystemGeometry(ctx, width, height, g, ref) {
  const extent = g.extent || 2.75;
  const scale = Math.min(width, height) * 0.42 / extent;
  const ox = width / 2, oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const modelTrail = [];
  const observedTrail = [];
  for (let i = 0; i <= selectedIndex; i++) {
    const p = currentPredictions[i];
    modelTrail.push({ jd: observations[i].jd, point: modelMarsForSystem(p) });
    observedTrail.push({ jd: observations[i].jd, point: observedPointForSystem(p, observations[i]) });
  }
  drawPolyline(ctx, map, modelTrail, { color: '#ff8a65', lineWidth: 2.2, maxGapDays: 35 });
  drawPolyline(ctx, map, observedTrail, { color: '#7de2ab', dashed: true, lineWidth: 2.2, maxGapDays: 35 });

  const colors = ['rgba(105,167,255,.55)', 'rgba(241,145,85,.55)', 'rgba(216,108,240,.52)'];
  (g.orbits || []).forEach((orbit, i) => {
    ctx.strokeStyle = colors[i % colors.length];
    ctx.lineWidth = 1.5;
    if (orbit.kind === 'circle') {
      const c = map(orbit.center);
      ctx.beginPath(); ctx.arc(c.x, c.y, orbit.radius * scale, 0, Math.PI * 2); ctx.stroke();
    } else if (orbit.kind === 'polyline' && orbit.points?.length) {
      ctx.beginPath();
      orbit.points.forEach((p, j) => {
        const q = map(p);
        if (!j) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      });
      ctx.stroke();
    }
  });

  (g.bodies || []).forEach(body => {
    const p = map(body);
    const color = body.role === 'sun' ? '#ffd166' : body.role === 'earth' ? '#69a7ff' : '#ff704d';
    dot(ctx, p.x, p.y, body.role === 'sun' ? 8 : 7, color);
    label(ctx, body.name, p.x + 9, p.y - 9);
  });

  const observed = observedPointForSystem(currentPredictions[selectedIndex], ref);
  if (observed) {
    const p = map(observed);
    ring(ctx, p.x, p.y, 10, '#7de2ab', 2.4);
    label(ctx, 'OBSERVED DIRECTION', p.x + 12, p.y + 15, '#7de2ab');
  }
}

function drawPtolemyGeometry(ctx, width, height, pred, ref) {
  const g = pred.geometry;
  const extent = 2.15;
  const scale = Math.min(width, height) * 0.42 / extent;
  const ox = width / 2, oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const modelTrail = modelHistoryPtolemy();
  const observedTrail = observationHistory(i => {
    const p = currentPredictions[i];
    return Math.hypot(p.mars.x, p.mars.y);
  });
  drawPolyline(ctx, map, modelTrail, { color: '#ff8a65', lineWidth: 2.25 });
  drawPolyline(ctx, map, observedTrail, { color: '#7de2ab', dashed: true, lineWidth: 2.25, maxGapDays: 35 });

  const dc = map(g.deferentCenter);
  ctx.strokeStyle = 'rgba(98,153,255,.60)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(dc.x, dc.y, g.deferentRadius * scale, 0, Math.PI * 2); ctx.stroke();
  if (g.epicycleCenter) {
    const ec = map(g.epicycleCenter);
    ctx.strokeStyle = 'rgba(241,145,85,.62)';
    ctx.beginPath(); ctx.arc(ec.x, ec.y, g.epicycleRadius * scale, 0, Math.PI * 2); ctx.stroke();
    dot(ctx, ec.x, ec.y, 3.5, '#f19155');
  }
  if (g.equant) {
    const q = map(g.equant);
    dot(ctx, q.x, q.y, 5, '#d86cf0');
    label(ctx, 'EQUANT', q.x + 8, q.y - 8);
  }

  const earth = map(g.earth);
  const mars = map(pred.mars);
  dot(ctx, earth.x, earth.y, 8, '#69a7ff');
  label(ctx, 'EARTH', earth.x + 10, earth.y - 10);
  dot(ctx, mars.x, mars.y, 7, '#ff704d');
  label(ctx, 'MARS', mars.x + 10, mars.y - 10);

  const modelRadius = Math.hypot(pred.mars.x, pred.mars.y);
  const observed = map(polarPoint(ref.longitudeDeg, modelRadius));
  ring(ctx, observed.x, observed.y, 10, '#7de2ab', 2.4);
  label(ctx, 'CARLSBERG (ANGLE)', observed.x + 12, observed.y + 15, '#7de2ab');

  if (g.historical) {
    label(ctx, 'ALMAGEST PARAMETERS — NOT FITTED TO CMC', 12, 20, '#ffd166');
  }
}

function drawLongitudeChart() {
  const { ctx, width, height } = fitCanvas(els.chart);
  ctx.clearRect(0, 0, width, height);
  if (!observations.length) return;

  const pad = { l: 50, r: 18, t: 24, b: 32 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const refU = unwrapDegrees(observations.map(x => x.longitudeDeg));
  const predU = isObservationMode() ? [] : unwrapDegrees(currentPredictions.map(x => x.longitudeDeg));
  if (!isObservationMode()) {
    const branch = Math.round((refU[0] - predU[0]) / 360) * 360;
    for (let i = 0; i < predU.length; i++) predU[i] += branch;
  }

  const all = isObservationMode() ? refU : [...refU, ...predU];
  let ymin = Math.min(...all), ymax = Math.max(...all);
  const margin = Math.max(8, (ymax - ymin) * 0.08);
  ymin -= margin; ymax += margin;
  const jd0 = observations[0].jd;
  const jd1 = observations.at(-1).jd;
  const xOf = i => pad.l + (observations[i].jd - jd0) / Math.max(1e-9, jd1 - jd0) * w;
  const yOf = v => pad.t + (ymax - v) / Math.max(1e-9, ymax - ymin) * h;

  ctx.strokeStyle = 'rgba(150,170,205,.25)';
  ctx.fillStyle = 'rgba(190,205,230,.72)';
  ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
  for (let k = 0; k <= 4; k++) {
    const yv = ymin + (ymax - ymin) * k / 4;
    const y = yOf(yv);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    ctx.fillText(`${Math.round(yv)}°`, 3, y + 4);
  }

  plotSeries(ctx, refU, xOf, yOf, '#7de2ab', 2, true);
  if (!isObservationMode()) plotSeries(ctx, predU, xOf, yOf, '#ff8a65', 2, false);

  const sx = xOf(selectedIndex);
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(sx, pad.t); ctx.lineTo(sx, height - pad.b); ctx.stroke();

  ctx.fillStyle = '#7de2ab'; ctx.fillRect(pad.l, 6, 13, 3);
  ctx.fillStyle = 'rgba(229,235,247,.85)'; ctx.fillText('Carlsberg observed', pad.l + 18, 11);
  if (!isObservationMode()) {
    ctx.fillStyle = '#ff8a65'; ctx.fillRect(pad.l + 150, 6, 13, 3);
    ctx.fillStyle = 'rgba(229,235,247,.85)'; ctx.fillText('model', pad.l + 168, 11);
  }
  ctx.fillStyle = 'rgba(190,205,230,.72)';
  ctx.fillText(observations[0].date, pad.l, height - 8);
  const end = observations.at(-1).date;
  ctx.fillText(end, width - pad.r - ctx.measureText(end).width, height - 8);
}

function plotSeries(ctx, values, xOf, yOf, color, lineWidth, dashed) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dashed ? [7, 5] : []);
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = xOf(i), y = yOf(v);
    if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();
  ctx.restore();
}

async function init() {
  const text = await fetch('./data/mars_observations_carlsberg.csv').then(r => {
    if (!r.ok) throw new Error(`Carlsberg observations: HTTP ${r.status}`);
    return r.text();
  });
  observations = parseCSV(text);
  if (!observations.length) throw new Error('Carlsberg火星観測が0件です');

  els.slider.max = String(observations.length - 1);
  selectedIndex = 0;
  els.slider.value = '0';

  els.tabs.forEach((tab, i) => tab.addEventListener('click', () => switchTheory(i)));
  els.parameterButtons.forEach(button => button.addEventListener('click', () => setPtolemyMode(button.dataset.ptolemyMode)));
  els.prev.addEventListener('click', () => switchModel(stageIndex - 1));
  els.next.addEventListener('click', () => switchModel(stageIndex + 1));
  els.slider.addEventListener('input', e => {
    selectedIndex = Number(e.target.value);
    renderSelectedObservation();
    drawLongitudeChart();
  });
  window.addEventListener('resize', () => {
    renderSelectedObservation();
    drawLongitudeChart();
  });

  updatePtolemyControls();
  await switchTheory(0);
}

init().catch(err => {
  console.error(err);
  document.querySelector('#app').innerHTML = `<div class="fatal">読み込みに失敗しました: ${err.message}</div>`;
});
