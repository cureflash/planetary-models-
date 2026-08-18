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

const MAX_CONNECTED_GAP_DAYS = 35;
let observations = [];
let frame = 'sky';

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function angularDifferenceDeg(a, b) {
  let d = (a - b + 180) % 360;
  if (d < 0) d += 360;
  return d - 180;
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
      raDeg: Number(obj.ra_deg),
      decDeg: Number(obj.dec_deg),
      longitudeDeg: Number(obj.ecliptic_lon_deg),
    };
  }).filter(row =>
    Number.isFinite(row.jd) &&
    Number.isFinite(row.raDeg) &&
    Number.isFinite(row.decDeg) &&
    Number.isFinite(row.longitudeDeg)
  );
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

function ring(ctx, x, y, radius, color, lineWidth = 2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();
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

function connectedRunBounds(index) {
  let start = index;
  let end = index;
  while (start > 0 && observations[start].jd - observations[start - 1].jd <= MAX_CONNECTED_GAP_DAYS) start -= 1;
  while (end + 1 < observations.length && observations[end + 1].jd - observations[end].jd <= MAX_CONNECTED_GAP_DAYS) end += 1;
  return { start, end };
}

function unwrapRunRA(start, end) {
  const out = [];
  let previousRaw = observations[start].raDeg;
  let unwrapped = previousRaw;
  out.push(unwrapped);
  for (let i = start + 1; i <= end; i++) {
    const raw = observations[i].raDeg;
    unwrapped += angularDifferenceDeg(raw, previousRaw);
    out.push(unwrapped);
    previousRaw = raw;
  }
  return out;
}

function paddedRange(min, max, minSpan, fraction = 0.10) {
  let span = max - min;
  if (span < minSpan) {
    const center = (min + max) / 2;
    min = center - minSpan / 2;
    max = center + minSpan / 2;
    span = minSpan;
  }
  const pad = span * fraction;
  return { min: min - pad, max: max + pad };
}

function drawSkyTrack() {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const index = selectedIndex();
  const { start, end } = connectedRunBounds(index);
  const raUnwrapped = unwrapRunRA(start, end);
  const decValues = observations.slice(start, end + 1).map(row => row.decDeg);

  const raHours = raUnwrapped.map(value => value / 15);
  const xr = paddedRange(Math.min(...raHours), Math.max(...raHours), 1.0, 0.09);
  const yr = paddedRange(Math.min(...decValues), Math.max(...decValues), 4.0, 0.12);

  const pad = { l: 58, r: 24, t: 38, b: 46 };
  const plotW = Math.max(1, width - pad.l - pad.r);
  const plotH = Math.max(1, height - pad.t - pad.b);
  const xOf = value => pad.l + (value - xr.min) / Math.max(1e-9, xr.max - xr.min) * plotW;
  const yOf = value => pad.t + (yr.max - value) / Math.max(1e-9, yr.max - yr.min) * plotH;

  ctx.font = '11px ui-monospace,SFMono-Regular,Menlo,monospace';
  ctx.lineWidth = 1;
  for (let k = 0; k <= 5; k++) {
    const xv = xr.min + (xr.max - xr.min) * k / 5;
    const x = xOf(xv);
    ctx.strokeStyle = 'rgba(150,170,205,.18)';
    ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, height - pad.b); ctx.stroke();
    ctx.fillStyle = 'rgba(190,205,230,.72)';
    ctx.fillText(`${xv.toFixed(1)}h`, x - 14, height - 20);

    const yv = yr.min + (yr.max - yr.min) * k / 5;
    const y = yOf(yv);
    ctx.strokeStyle = 'rgba(150,170,205,.18)';
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(width - pad.r, y); ctx.stroke();
    ctx.fillStyle = 'rgba(190,205,230,.72)';
    ctx.fillText(`${yv.toFixed(1)}°`, 7, y + 4);
  }

  ctx.fillStyle = 'rgba(229,235,247,.86)';
  ctx.fillText('RIGHT ASCENSION →', pad.l, height - 5);
  ctx.save();
  ctx.translate(13, height / 2 + 45);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('DECLINATION →', 0, 0);
  ctx.restore();

  const visibleEnd = Math.min(index, end);
  const visiblePoints = [];
  for (let i = start; i <= visibleEnd; i++) {
    const local = i - start;
    visiblePoints.push({
      jd: observations[i].jd,
      point: { x: raHours[local], y: observations[i].decDeg },
    });
  }
  const map = point => ({ x: xOf(point.x), y: yOf(point.y) });
  drawPolyline(ctx, map, visiblePoints, { color: '#7de2ab', lineWidth: 2.6 });

  for (let j = 0; j < visiblePoints.length; j++) {
    const p = map(visiblePoints[j].point);
    dot(ctx, p.x, p.y, 2.2, 'rgba(125,226,171,.78)');
  }

  if (visiblePoints.length) {
    const first = map(visiblePoints[0].point);
    ring(ctx, first.x, first.y, 5, 'rgba(105,167,255,.9)', 1.6);
    const current = map(visiblePoints.at(-1).point);
    dot(ctx, current.x, current.y, 6.5, '#ff704d');
    ring(ctx, current.x, current.y, 10, '#ff8a65', 1.5);
  }

  const runStart = observations[start].date;
  const runEnd = observations[end].date;
  label(ctx, `OBSERVING RUN ${runStart} – ${runEnd}`, pad.l, 19, '#7de2ab');
  label(ctx, 'RAW OBSERVED RA / DEC — NO DISTANCE ASSUMED', pad.l, 33, 'rgba(229,235,247,.72)');
}

function earthHeliocentricLongitudeDeg(jd) {
  // Low-precision apparent solar longitude from date, then +180° for Earth.
  // This supplies only the heliocentric coordinate frame. The Mars direction
  // remains the W2J00 measurement and no Mars distance is inferred.
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
    maxGapDays: MAX_CONNECTED_GAP_DAYS,
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
  label(ctx, 'DIRECTION ONLY — THIS IS NOT A PHYSICAL ORBIT', 12, 20, '#ffd166');
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
    maxGapDays: MAX_CONNECTED_GAP_DAYS,
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
  label(ctx, 'USNO W2J00 LINE OF SIGHT', currentEnd.x + 8, currentEnd.y - 8, '#7de2ab');
  label(ctx, 'MARS DISTANCE IS NOT IN THE OBSERVATION', 12, 20, '#ffd166');
}

function applyObservationLabels() {
  if (!isObservationTab()) return;
  if (frame === 'sky') {
    const index = selectedIndex();
    const { start, end } = connectedRunBounds(index);
    stageLabel.textContent = 'USNO W2J00 / RA–DEC SKY TRACK';
    modelName.textContent = '実観測・天球上の火星軌跡';
    modelDescription.textContent = 'USNO W2J00が実際に測った火星の赤経と赤緯を、そのまま2次元の天球座標に描きます。逆行すると進行方向が反転し、観測条件がそろった区間ではループ状の見かけの軌跡が現れます。';
    modelElements.innerHTML = ['実観測RA', '実観測Dec', '距離不要', '逆行ループ', '軌道理論なし'].map(x => `<span>${x}</span>`).join('');
    orbitKicker.textContent = 'ACTUAL ASTROMETRY / SKY PLANE';
    orbitTitle.textContent = '実観測：赤経 × 赤緯の天球上の軌跡';
    orbitNote.textContent = `スライダー位置を含む連続観測区間（${observations[start].date}〜${observations[end].date}）を自動拡大しています。緑線は実測点を時系列で結んだもの、橙点が現在位置です。赤経0hをまたぐ場合も連続するよう補正します。35日を超える欠測は別区間として扱います。`;
  } else if (frame === 'geocentric') {
    stageLabel.textContent = 'USNO W2J00 / GEOCENTRIC DIRECTION';
    modelName.textContent = '実観測・天動説表示（地球固定）';
    modelDescription.textContent = 'USNO W2J00の火星実観測を、地球を固定した方向表示にします。一定半径は見やすさのためだけで、火星までの距離や物理的軌道を表しません。';
    modelElements.innerHTML = ['地球固定', '実測方向', '地心黄経', '距離は不明'].map(x => `<span>${x}</span>`).join('');
    orbitKicker.textContent = 'ACTUAL ASTROMETRY / GEOCENTRIC DIRECTION';
    orbitTitle.textContent = '実観測：天動説表示（地球固定）';
    orbitNote.textContent = 'USNO W2J00で実際に測定された火星の見かけ方向です。35日を超える欠測区間は線を切っています。円周上の半径は表示用であり、火星の実際の距離や軌道ではありません。';
  } else {
    stageLabel.textContent = 'USNO W2J00 / HELIOCENTRIC FRAME';
    modelName.textContent = '実観測・地動説表示（太陽固定）';
    modelDescription.textContent = '太陽を固定し、地球を日付に応じて動かした座標枠の中で、USNO W2J00の実測方向を地球から伸びる視線として表示します。火星の距離や太陽中心位置は捏造しません。';
    modelElements.innerHTML = ['太陽固定', '地球移動', '実測視線', '火星距離は不明'].map(x => `<span>${x}</span>`).join('');
    orbitKicker.textContent = 'ACTUAL ASTROMETRY / HELIOCENTRIC FRAME';
    orbitTitle.textContent = '実観測：地動説表示（太陽固定）';
    orbitNote.textContent = '緑線がUSNO W2J00で測った火星の実際の見かけ方向です。地球位置は座標枠を作るため日付から求めた太陽黄経の近似を使っています。実観測だけでは火星までの距離が分からないため、火星の太陽中心位置そのものは点として描きません。';
  }
}

function draw() {
  if (!isObservationTab() || !observations.length || !canvas) return;
  applyObservationLabels();
  if (frame === 'sky') drawSkyTrack();
  else if (frame === 'heliocentric') drawHeliocentric();
  else drawGeocentric();
}

function updateVisibility() {
  if (!panel) return;
  panel.hidden = !isObservationTab();
  if (!panel.hidden) draw();
}

function setFrame(next) {
  if (!['sky', 'geocentric', 'heliocentric'].includes(next)) return;
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
  const text = await fetch('./data/mars_observations_usno_w2j00.csv?v=usno-w2j00-sky-1').then(response => {
    if (!response.ok) throw new Error(`USNO W2J00 observations: HTTP ${response.status}`);
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