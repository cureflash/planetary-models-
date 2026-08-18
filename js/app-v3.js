const THEORIES = [
  { id: 'observation', label: '観測データ', files: [] },
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
    name: '地球固定・火星観測データ',
    shortName: '観測データ',
    sourceFile: 'data/mars_reference_2020_2030.csv',
    description: '地球を画面中央に固定し、基準データの地心座標に従って火星だけを動かします。日付スライダーを動かすと、火星が実際に辿った部分だけを軌跡として表示します。',
    elements: ['地球固定', '火星のみ表示', '地心座標', '基準データ'],
  },
};

let reference = [];
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
      date: obj.date, jd: Number(obj.jd),
      earthX: Number(obj.earth_x_au), earthY: Number(obj.earth_y_au), earthZ: Number(obj.earth_z_au),
      marsX: Number(obj.mars_x_au), marsY: Number(obj.mars_y_au), marsZ: Number(obj.mars_z_au),
      geoX: Number(obj.geo_x_au), geoY: Number(obj.geo_y_au), geoZ: Number(obj.geo_z_au),
      longitudeDeg: Number(obj.geo_lon_deg), distanceAu: Number(obj.geo_distance_au),
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
    out.push(out[i - 1] + angularDifferenceDeg(values[i], values[i - 1]));
  }
  return out;
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
    stageIndex = 0;
    currentModule = OBSERVATION_MODEL;
    currentPredictions = reference.map(row => ({
      longitudeDeg: row.longitudeDeg,
      mars: { x: row.geoX, y: row.geoY },
      geometry: { system: 'observation' },
    }));
    els.prev.disabled = true;
    els.next.disabled = true;
  } else {
    const files = filesForTheory(theory);
    stageIndex = (newIndex + files.length) % files.length;
    const file = files[stageIndex];
    currentModule = await import(`${file}?theory=${theory.id}&mode=${ptolemyMode}&stage=${stageIndex}`);
    currentPredictions = reference.map(row => currentModule.predict(row.jd));
    els.prev.disabled = files.length <= 1;
    els.next.disabled = files.length <= 1;
  }
  renderModelHeader();
  renderStatistics();
  renderSelectedDay();
  drawLongitudeChart();
}

function renderModelHeader() {
  const theory = THEORIES[theoryIndex];
  const files = filesForTheory(theory);
  const m = currentModule.model;
  if (theory.id === 'observation') {
    els.stage.textContent = 'OBSERVATION / GEOCENTRIC';
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
  if (isObservationMode()) {
    els.orbitKicker.textContent = 'OBSERVED MOTION';
    els.orbitTitle.textContent = '地球を固定した火星の動き';
    els.orbitNote.textContent = '地球を中央に固定し、現代基準データの火星だけを表示します。破線の軌跡はスライダー位置までに実際に辿った部分だけを描き、先頭では軌跡を表示しません。';
    els.chartKicker.textContent = '2020–2030';
    els.chartTitle.textContent = '火星の地心黄経：観測データ';
    els.predictedTerm.textContent = '火星の地心黄経';
    els.referenceTerm.textContent = '地心距離';
    els.errorTerm.textContent = '表示座標';
  } else {
    els.orbitKicker.textContent = 'MODEL + REFERENCE';
    els.orbitTitle.textContent = 'モデルと現代基準の火星';
    els.orbitNote.textContent = '赤い実線がモデルの火星軌跡、緑の破線が現代基準データの軌跡です。どちらもスライダー位置までの履歴だけを表示します。プトレマイオスでは距離尺度が異なるため、現代基準はモデルと同じ半径上に方向だけを重ねます。';
    els.chartKicker.textContent = '2020–2030';
    els.chartTitle.textContent = '火星の地心黄経：モデル vs 基準データ';
    els.predictedTerm.textContent = 'モデル予測';
    els.referenceTerm.textContent = '現代基準値';
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
  if (isObservationMode()) {
    els.predicted.textContent = `${ref.longitudeDeg.toFixed(2)}°`;
    els.reference.textContent = `${ref.distanceAu.toFixed(3)} AU`;
    els.error.textContent = '地球固定';
  } else {
    els.predicted.textContent = `${pred.longitudeDeg.toFixed(2)}°`;
    els.reference.textContent = `${ref.longitudeDeg.toFixed(2)}°`;
    els.error.textContent = `${angularDifferenceDeg(pred.longitudeDeg, ref.longitudeDeg).toFixed(2)}°`;
  }
  drawModelOrbit(pred, ref);
  drawReferenceOrbit(ref);
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
  ctx.strokeStyle = 'rgba(150,170,205,.22)';
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
function label(ctx, text, x, y) {
  ctx.fillStyle = 'rgba(229,235,247,.9)';
  ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
  ctx.fillText(text, x, y);
}
function labelGreen(ctx, text, x, y) {
  ctx.fillStyle = '#7de2ab';
  ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
  ctx.fillText(text, x, y);
}

function drawTrail(ctx, map, points, color, dashed = false, lineWidth = 2) {
  if (selectedIndex < 1 || points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.setLineDash(dashed ? [7, 6] : []);
  ctx.beginPath();
  let started = false;
  for (const point of points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    const p = map(point);
    if (!started) { ctx.moveTo(p.x, p.y); started = true; }
    else ctx.lineTo(p.x, p.y);
  }
  if (started) ctx.stroke();
  ctx.restore();
}

function historyThroughSelected(mapper) {
  const points = [];
  for (let i = 0; i <= selectedIndex; i++) points.push(mapper(i));
  return points;
}

function drawModelOrbit(pred, ref) {
  const { ctx, width, height } = fitCanvas(els.orbit);
  ctx.clearRect(0, 0, width, height);
  if (isObservationMode()) drawObservationGeometry(ctx, width, height, ref);
  else if (pred.geometry.system) drawSystemGeometry(ctx, width, height, pred.geometry, ref);
  else drawPtolemyGeometry(ctx, width, height, pred, ref);
}

function drawObservationGeometry(ctx, width, height, ref) {
  const extent = 2.75;
  const scale = Math.min(width, height) * 0.42 / extent;
  const ox = width / 2, oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const observedTrail = historyThroughSelected(i => ({ x: reference[i].geoX, y: reference[i].geoY }));
  drawTrail(ctx, map, observedTrail, '#7de2ab', true, 2.2);

  const earth = map({ x: 0, y: 0 });
  const mars = map({ x: ref.geoX, y: ref.geoY });
  ctx.strokeStyle = 'rgba(125,226,171,.48)';
  ctx.lineWidth = 1.3;
  ctx.beginPath(); ctx.moveTo(earth.x, earth.y); ctx.lineTo(mars.x, mars.y); ctx.stroke();
  dot(ctx, earth.x, earth.y, 8, '#69a7ff'); label(ctx, 'EARTH (FIXED)', earth.x + 10, earth.y - 10);
  dot(ctx, mars.x, mars.y, 8, '#ff704d'); label(ctx, 'MARS', mars.x + 10, mars.y - 10);
  ctx.fillStyle = 'rgba(190,205,230,.72)';
  ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
  ctx.fillText('GEOCENTRIC REFERENCE DATA', 12, 20);
}

function drawReferenceOrbit(ref) {
  const { ctx, width, height } = fitCanvas(els.referenceOrbit);
  ctx.clearRect(0, 0, width, height);
  if (!Number.isFinite(ref.earthX) || !Number.isFinite(ref.marsX)) return;
  const extent = 1.85;
  const scale = Math.min(width, height) * 0.43 / extent;
  const ox = width / 2, oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);
  const sun = map({ x: 0, y: 0 });
  const earth = map({ x: ref.earthX, y: ref.earthY });
  const mars = map({ x: ref.marsX, y: ref.marsY });
  ctx.strokeStyle = 'rgba(125,226,171,.55)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(earth.x, earth.y); ctx.lineTo(mars.x, mars.y); ctx.stroke();
  dot(ctx, sun.x, sun.y, 8, '#ffd166'); label(ctx, 'SUN', sun.x + 10, sun.y - 10);
  dot(ctx, earth.x, earth.y, 7, '#69a7ff'); label(ctx, 'EARTH', earth.x + 10, earth.y - 10);
  dot(ctx, mars.x, mars.y, 7, '#ff704d'); label(ctx, 'MARS', mars.x + 10, mars.y - 10);
}

function modelMarsForSystem(prediction) {
  if (!prediction?.geometry?.bodies) return null;
  const body = prediction.geometry.bodies.find(x => x.role === 'mars');
  return body ? { x: body.x, y: body.y } : null;
}

function referenceMarsForSystem(system, ref) {
  if (system === 'tycho') return { x: ref.geoX, y: ref.geoY };
  return { x: ref.marsX, y: ref.marsY };
}

function drawSystemGeometry(ctx, width, height, g, ref) {
  const extent = g.extent || 2.75;
  const scale = Math.min(width, height) * 0.43 / extent;
  const ox = width / 2, oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const modelTrail = historyThroughSelected(i => modelMarsForSystem(currentPredictions[i]));
  const referenceTrail = historyThroughSelected(i => referenceMarsForSystem(g.system, reference[i]));
  drawTrail(ctx, map, modelTrail, '#ff8a65', false, 2.2);
  drawTrail(ctx, map, referenceTrail, '#7de2ab', true, 2.2);

  const colors = ['rgba(105,167,255,.62)', 'rgba(241,145,85,.70)', 'rgba(216,108,240,.60)'];
  (g.orbits || []).forEach((orbit, i) => {
    ctx.strokeStyle = colors[i % colors.length]; ctx.lineWidth = 2;
    if (orbit.kind === 'circle') {
      const c = map(orbit.center); ctx.beginPath(); ctx.arc(c.x, c.y, orbit.radius * scale, 0, Math.PI * 2); ctx.stroke();
    } else if (orbit.kind === 'polyline' && orbit.points?.length) {
      ctx.beginPath(); orbit.points.forEach((p, j) => { const q = map(p); if (!j) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); }); ctx.stroke();
    }
  });
  if (g.sightline) {
    const a = map(g.sightline.from), b = map(g.sightline.to);
    ctx.strokeStyle = 'rgba(255,138,101,.55)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  (g.bodies || []).forEach(body => {
    const p = map(body); const style = bodyStyle(body.role);
    dot(ctx, p.x, p.y, style.radius, style.color); label(ctx, body.name, p.x + 9, p.y - 9);
  });
  drawReferenceOverlayForSystem(ctx, map, g, ref);
}

function referenceBodiesForSystem(system, ref) {
  if (!Number.isFinite(ref.earthX) || !Number.isFinite(ref.marsX)) return null;
  if (system === 'tycho') return { earth: { x: 0, y: 0 }, sun: { x: -ref.earthX, y: -ref.earthY }, mars: { x: ref.geoX, y: ref.geoY } };
  return { sun: { x: 0, y: 0 }, earth: { x: ref.earthX, y: ref.earthY }, mars: { x: ref.marsX, y: ref.marsY } };
}

function drawReferenceOverlayForSystem(ctx, map, g, ref) {
  const rb = referenceBodiesForSystem(g.system, ref); if (!rb) return;
  const modelMars = (g.bodies || []).find(body => body.role === 'mars');
  if (modelMars) {
    const m = map(modelMars), r = map(rb.mars);
    ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(125,226,171,.72)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(r.x, r.y); ctx.stroke(); ctx.setLineDash([]);
  }
  const refMars = map(rb.mars); ring(ctx, refMars.x, refMars.y, 10, '#7de2ab', 2.5); labelGreen(ctx, 'REF MARS', refMars.x + 12, refMars.y + 15);
  if (rb.earth && g.system !== 'tycho') {
    const refEarth = map(rb.earth); ring(ctx, refEarth.x, refEarth.y, 9, '#7de2ab', 1.5); labelGreen(ctx, 'REF EARTH', refEarth.x + 11, refEarth.y + 15);
  }
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
  const ox = width / 2, oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const modelTrail = historyThroughSelected(i => currentPredictions[i].mars);
  const referenceTrail = historyThroughSelected(i => {
    const p = currentPredictions[i];
    const radius = Math.hypot(p.mars.x, p.mars.y);
    const a = reference[i].longitudeDeg * Math.PI / 180;
    return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
  });
  drawTrail(ctx, map, modelTrail, '#ff8a65', false, 2.2);
  drawTrail(ctx, map, referenceTrail, '#7de2ab', true, 2.2);

  const dc = map(g.deferentCenter);
  ctx.strokeStyle = 'rgba(98,153,255,.68)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(dc.x, dc.y, g.deferentRadius * scale, 0, Math.PI * 2); ctx.stroke();
  if (g.epicycleCenter) {
    const ec = map(g.epicycleCenter); ctx.strokeStyle = 'rgba(241,145,85,.72)'; ctx.beginPath(); ctx.arc(ec.x, ec.y, g.epicycleRadius * scale, 0, Math.PI * 2); ctx.stroke(); dot(ctx, ec.x, ec.y, 4, '#f19155');
  }
  if (g.equant) { const q = map(g.equant); dot(ctx, q.x, q.y, 5, '#d86cf0'); label(ctx, 'EQUANT', q.x + 8, q.y - 8); }
  const earth = map(g.earth); dot(ctx, earth.x, earth.y, 8, '#69a7ff'); label(ctx, 'EARTH', earth.x + 10, earth.y - 10);
  const mars = map(pred.mars); dot(ctx, mars.x, mars.y, 7, '#ff704d'); label(ctx, 'MARS', mars.x + 10, mars.y - 10);
  const modelRadius = Math.hypot(pred.mars.x, pred.mars.y);
  const a = ref.longitudeDeg * Math.PI / 180;
  const refMars = map({ x: modelRadius * Math.cos(a), y: modelRadius * Math.sin(a) });
  ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(125,226,171,.72)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(mars.x, mars.y); ctx.lineTo(refMars.x, refMars.y); ctx.stroke(); ctx.setLineDash([]);
  ring(ctx, refMars.x, refMars.y, 10, '#7de2ab', 2.5); labelGreen(ctx, 'REF MARS (ANGLE)', refMars.x + 12, refMars.y + 15);
  ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(125,226,171,.46)'; ctx.beginPath(); ctx.moveTo(earth.x, earth.y); ctx.lineTo(refMars.x, refMars.y); ctx.stroke(); ctx.setLineDash([]);
  if (g.historical) {
    ctx.fillStyle = 'rgba(255,209,102,.88)'; ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
    ctx.fillText('ALMAGEST PARAMETERS — NOT FITTED TO MODERN DATA', 12, 20);
  }
}

function drawLongitudeChart() {
  const { ctx, width, height } = fitCanvas(els.chart);
  ctx.clearRect(0, 0, width, height);
  const pad = { l: 48, r: 18, t: 22, b: 30 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const refU = unwrapDegrees(reference.map(x => x.longitudeDeg));
  const predU = isObservationMode() ? [] : unwrapDegrees(currentPredictions.map(x => x.longitudeDeg));
  if (!isObservationMode()) {
    const branch = Math.round((refU[0] - predU[0]) / 360) * 360;
    for (let i = 0; i < predU.length; i++) predU[i] += branch;
  }
  let ymin = isObservationMode() ? Math.min(...refU) : Math.min(...refU, ...predU);
  let ymax = isObservationMode() ? Math.max(...refU) : Math.max(...refU, ...predU);
  const margin = Math.max(20, (ymax - ymin) * 0.05); ymin -= margin; ymax += margin;
  const xOf = i => pad.l + i / (reference.length - 1) * w;
  const yOf = v => pad.t + (ymax - v) / (ymax - ymin) * h;
  ctx.strokeStyle = 'rgba(150,170,205,.25)'; ctx.fillStyle = 'rgba(190,205,230,.7)'; ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
  for (let k = 0; k <= 4; k++) {
    const yv = ymin + (ymax - ymin) * k / 4, y = yOf(yv);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke(); ctx.fillText(`${Math.round(yv)}°`, 3, y + 4);
  }
  plotSeries(ctx, refU, xOf, yOf, '#7de2ab', 2);
  if (!isObservationMode()) plotSeries(ctx, predU, xOf, yOf, '#ff8a65', 2);
  const sx = xOf(selectedIndex); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.moveTo(sx, pad.t); ctx.lineTo(sx, height - pad.b); ctx.stroke();
  ctx.fillStyle = '#7de2ab'; ctx.fillRect(pad.l, 5, 13, 3); ctx.fillStyle = 'rgba(229,235,247,.85)'; ctx.fillText(isObservationMode() ? 'observation' : 'reference', pad.l + 18, 10);
  if (!isObservationMode()) {
    ctx.fillStyle = '#ff8a65'; ctx.fillRect(pad.l + 110, 5, 13, 3); ctx.fillStyle = 'rgba(229,235,247,.85)'; ctx.fillText('model', pad.l + 128, 10);
  }
  ctx.fillStyle = 'rgba(190,205,230,.7)'; ctx.fillText(reference[0].date, pad.l, height - 8);
  const end = reference[reference.length - 1].date; ctx.fillText(end, width - pad.r - ctx.measureText(end).width, height - 8);
}

function plotSeries(ctx, values, xOf, yOf, color, lineWidth) {
  ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath();
  values.forEach((v, i) => { const x = xOf(i), y = yOf(v); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
}

async function init() {
  const text = await fetch('./data/mars_reference_2020_2030.csv').then(r => {
    if (!r.ok) throw new Error(`reference data: HTTP ${r.status}`);
    return r.text();
  });
  reference = parseCSV(text);
  els.slider.max = String(reference.length - 1);
  selectedIndex = 0;
  els.slider.value = '0';
  els.tabs.forEach((tab, i) => tab.addEventListener('click', () => switchTheory(i)));
  els.parameterButtons.forEach(button => button.addEventListener('click', () => setPtolemyMode(button.dataset.ptolemyMode)));
  els.prev.addEventListener('click', () => switchModel(stageIndex - 1));
  els.next.addEventListener('click', () => switchModel(stageIndex + 1));
  els.slider.addEventListener('input', e => { selectedIndex = Number(e.target.value); renderSelectedDay(); drawLongitudeChart(); });
  window.addEventListener('resize', () => { renderSelectedDay(); drawLongitudeChart(); });
  updatePtolemyControls();
  await switchTheory(0);
}

init().catch(err => {
  console.error(err);
  document.querySelector('#app').innerHTML = `<div class="fatal">読み込みに失敗しました: ${err.message}</div>`;
});
