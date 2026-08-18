const panel = document.querySelector('#observationFramePanel');
const buttons = [...document.querySelectorAll('[data-observation-frame]')];
const tabs = [...document.querySelectorAll('.theory-tab')];
const slider = document.querySelector('#dateSlider');
const canvas = document.querySelector('#orbitCanvas');
const orbitKicker = document.querySelector('#orbitKicker');
const orbitTitle = document.querySelector('#orbitTitle');
const orbitNote = document.querySelector('#orbitNote');
const stageLabel = document.querySelector('#stageLabel');
const modelName = document.querySelector('#modelName');
const modelDescription = document.querySelector('#modelDescription');
const modelElements = document.querySelector('#modelElements');

let observations = [];
let frame = 'geocentric';

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  return lines.map(line => {
    const cells = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h] = cells[i] ?? '');
    return {
      date: obj.date,
      jd: Number(obj.jd_ut1),
      longitudeDeg: Number(obj.ecliptic_lon_deg),
    };
  }).filter(row => Number.isFinite(row.jd) && Number.isFinite(row.longitudeDeg));
}

function isObservationTab() {
  return document.querySelector('.theory-tab.active')?.dataset.theory === 'observation';
}

function selectedIndex() {
  if (!observations.length) return 0;
  const value = Number(slider?.value ?? 0);
  return Math.max(0, Math.min(observations.length - 1, Number.isFinite(value) ? value : 0));
}

function polarPoint(longitudeDeg, radius = 1) {
  const a = longitudeDeg * Math.PI / 180;
  return { x: radius * Math.cos(a), y: radius * Math.sin(a) };
}

function fitCanvas(target) {
  const ratio = window.devicePixelRatio || 1;
  const rect = target.getBoundingClientRect();
  const widthPx = Math.max(1, Math.round(rect.width * ratio));
  const heightPx = Math.max(1, Math.round(rect.height * ratio));
  if (target.width !== widthPx || target.height !== heightPx) {
    target.width = widthPx;
    target.height = heightPx;
  }
  const ctx = target.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function drawAxes(ctx, width, height, ox, oy) {
  ctx.strokeStyle = 'rgba(150,170,205,.20)';
  ctx.lineWidth = 1;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, oy); ctx.lineTo(width, oy);
  ctx.moveTo(ox, 0); ctx.lineTo(ox, height);
  ctx.stroke();
}

function dot(ctx, x, y, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
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
  let previous = null;
  for (const item of points) {
    const p = map(item.point);
    const gap = previous ? item.jd - previous.jd : 0;
    if (!previous || gap > maxGapDays) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
    previous = item;
  }
  ctx.stroke();
  ctx.restore();
}

function earthHeliocentricLongitudeDeg(jd) {
  // Low-precision apparent solar longitude from date, then +180° for Earth.
  // This supplies only the heliocentric coordinate frame. The Mars direction
  // remains the Tokyo PMC88 measurement and no Mars distance is inferred.
  const n = jd - 2451545.0;
  const meanLongitude = normalizeDeg(280.460 + 0.9856474 * n);
  const anomaly = normalizeDeg(357.528 + 0.9856003 * n) * Math.PI / 180;
  const sunLongitude = normalizeDeg(
    meanLongitude + 1.915 * Math.sin(anomaly) + 0.020 * Math.sin(2 * anomaly)
  );
  return normalizeDeg(sunLongitude + 180);
}

function earthPosition(jd) {
  return polarPoint(earthHeliocentricLongitudeDeg(jd), 1.0);
}

function drawGeocentric() {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const extent = 1.9;
  const scale = Math.min(width, height) * 0.42 / extent;
  const ox = width / 2;
  const oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const index = selectedIndex();
  const history = observations.slice(0, index + 1).map(row => ({
    jd: row.jd,
    point: polarPoint(row.longitudeDeg, 1.5),
  }));
  drawPolyline(ctx, map, history, {
    color: '#7de2ab',
    dashed: true,
    lineWidth: 2.2,
    maxGapDays: 35,
  });
  for (const item of history) {
    const p = map(item.point);
    dot(ctx, p.x, p.y, 2.2, 'rgba(125,226,171,.85)');
  }

  const earth = map({ x: 0, y: 0 });
  const current = observations[index];
  const direction = map(polarPoint(current.longitudeDeg, 1.5));
  dot(ctx, earth.x, earth.y, 8, '#69a7ff');
  label(ctx, 'EARTH (FIXED)', earth.x + 10, earth.y - 10);
  dot(ctx, direction.x, direction.y, 8, '#ff704d');
  label(ctx, 'MARS (OBSERVED DIRECTION)', direction.x + 10, direction.y - 10);
  label(ctx, 'TOKYO PMC88 / MEASURED DIRECTION', 12, 20, '#7de2ab');
}

function drawHeliocentric() {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const extent = 3.1;
  const scale = Math.min(width, height) * 0.42 / extent;
  const ox = width / 2;
  const oy = height / 2;
  const map = p => ({ x: ox + p.x * scale, y: oy - p.y * scale });
  drawAxes(ctx, width, height, ox, oy);

  const sun = map({ x: 0, y: 0 });
  ctx.strokeStyle = 'rgba(105,167,255,.36)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(sun.x, sun.y, scale, 0, Math.PI * 2);
  ctx.stroke();

  const index = selectedIndex();
  const earthTrail = observations.slice(0, index + 1).map(row => ({ jd: row.jd, point: earthPosition(row.jd) }));
  drawPolyline(ctx, map, earthTrail, {
    color: 'rgba(105,167,255,.58)',
    lineWidth: 1.6,
    maxGapDays: 35,
  });

  const rayLength = 2.0;
  for (let i = 0; i <= index; i++) {
    const row = observations[i];
    const earth = earthPosition(row.jd);
    const ray = polarPoint(row.longitudeDeg, rayLength);
    const end = { x: earth.x + ray.x, y: earth.y + ray.y };
    const a = map(earth);
    const b = map(end);
    ctx.strokeStyle = i === index ? '#7de2ab' : 'rgba(125,226,171,.20)';
    ctx.lineWidth = i === index ? 2.5 : 1;
    ctx.setLineDash(i === index ? [] : [4, 5]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (i !== index) dot(ctx, a.x, a.y, 1.8, 'rgba(105,167,255,.55)');
  }
  ctx.setLineDash([]);

  dot(ctx, sun.x, sun.y, 8, '#ffd166');
  label(ctx, 'SUN (FIXED)', sun.x + 10, sun.y - 10);

  const current = observations[index];
  const currentEarth = earthPosition(current.jd);
  const currentEarthScreen = map(currentEarth);
  dot(ctx, currentEarthScreen.x, currentEarthScreen.y, 8, '#69a7ff');
  label(ctx, 'EARTH', currentEarthScreen.x + 10, currentEarthScreen.y - 10);

  const currentRay = polarPoint(current.longitudeDeg, rayLength);
  const currentEnd = map({ x: currentEarth.x + currentRay.x, y: currentEarth.y + currentRay.y });
  label(ctx, 'TOKYO PMC88 LINE OF SIGHT', currentEnd.x + 8, currentEnd.y - 8, '#7de2ab');
  label(ctx, 'MARS DISTANCE IS NOT IN THE OBSERVATION', 12, 20, '#ffd166');
}

function applyObservationLabels() {
  if (!isObservationTab()) return;
  if (frame === 'geocentric') {
    stageLabel.textContent = 'TOKYO PMC88 / GEOCENTRIC';
    modelName.textContent = '実観測・天動説表示（地球固定）';
    modelDescription.textContent = 'Tokyo PMC88の火星実観測を、地球を固定した座標で表示します。観測された方向だけを使い、火星までの距離は仮定しません。';
    modelElements.innerHTML = ['地球固定', '実観測RA/Dec', '地心黄経', '距離は不明'].map(x => `<span>${x}</span>`).join('');
    orbitKicker.textContent = 'ACTUAL ASTROMETRY / GEOCENTRIC';
    orbitTitle.textContent = '実観測：天動説表示（地球固定）';
    orbitNote.textContent = 'Tokyo PMC88で実際に測定された火星の見かけ方向です。火星までの距離は観測表にないため、方向を見せるための一定半径に置いています。';
  } else {
    stageLabel.textContent = 'TOKYO PMC88 / HELIOCENTRIC FRAME';
    modelName.textContent = '実観測・地動説表示（太陽固定）';
    modelDescription.textContent = '太陽を固定し、地球を日付に応じて動かした座標枠の中で、Tokyo PMC88の実測方向を地球から伸びる視線として表示します。火星の距離や太陽中心位置は捏造しません。';
    modelElements.innerHTML = ['太陽固定', '地球移動', '実測視線', '火星距離は不明'].map(x => `<span>${x}</span>`).join('');
    orbitKicker.textContent = 'ACTUAL ASTROMETRY / HELIOCENTRIC FRAME';
    orbitTitle.textContent = '実観測：地動説表示（太陽固定）';
    orbitNote.textContent = '緑線がTokyo PMC88で測った火星の実際の見かけ方向です。地球位置は座標枠を作るため日付から求めた太陽黄経の近似を使っています。実観測だけでは火星までの距離が分からないため、火星の太陽中心位置そのものは点として描きません。';
  }
}

function draw() {
  if (!isObservationTab() || !observations.length || !canvas) return;
  applyObservationLabels();
  if (frame === 'heliocentric') drawHeliocentric();
  else drawGeocentric();
}

function updateVisibility() {
  if (!panel) return;
  panel.hidden = !isObservationTab();
  if (!panel.hidden) draw();
}

function setFrame(next) {
  if (!['geocentric', 'heliocentric'].includes(next)) return;
  frame = next;
  buttons.forEach(button => {
    const active = button.dataset.observationFrame === frame;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  draw();
}

async function init() {
  if (!panel || !canvas || !slider) return;
  const text = await fetch('./data/mars_observations_tokyo_pmc88.csv?v=tokyo-pmc88-frames-1').then(response => {
    if (!response.ok) throw new Error(`Tokyo PMC88 observations: HTTP ${response.status}`);
    return response.text();
  });
  observations = parseCSV(text);

  buttons.forEach(button => button.addEventListener('click', () => setFrame(button.dataset.observationFrame)));
  slider.addEventListener('input', () => setTimeout(draw, 0));
  tabs.forEach(tab => tab.addEventListener('click', () => setTimeout(updateVisibility, 60)));
  window.addEventListener('resize', () => setTimeout(draw, 0));
  window.addEventListener('load', () => setTimeout(updateVisibility, 120));

  updateVisibility();
  setTimeout(updateVisibility, 150);
}

init().catch(error => console.error('observation frame view:', error));
