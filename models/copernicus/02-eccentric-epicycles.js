// Copernican educational stage 2.
// Copernicus retained combinations of uniform circular motions, eccentrics and epicycles.
// This is a historically inspired first-order construction, not a transcription of De revolutionibus tables.
// The eccentric + epicycle terms approximate each planet's orbital eccentricity while avoiding an equant.

const J2000_JD = 2451545.0;
const DAYS_PER_CENTURY = 36525.0;

const EARTH = {
  a0: 1.00000261,
  aRate: 0.00000562,
  e0: 0.01671123,
  eRate: -0.00004392,
  L0: 100.46457166,
  LRate: 35999.37244981,
  peri0: 102.93768193,
  periRate: 0.32327364,
};

const MARS = {
  a0: 1.52371034,
  aRate: 0.00001847,
  e0: 0.09339410,
  eRate: 0.00007882,
  L0: -4.55343205,
  LRate: 19140.30268499,
  peri0: -23.94362959,
  periRate: 0.44441088,
};

export const model = {
  id: 'copernicus-eccentric-epicycles',
  theory: 'copernicus',
  stage: 2,
  name: 'コペルニクス：離心円＋周転円補正',
  shortName: 'コペルニクス＋周転円',
  sourceFile: 'models/copernicus/02-eccentric-epicycles.js',
  description: '太陽中心を保ったまま、地球と火星の運動を離心した従円と小さな周転円の合成で補正します。すべて一様円運動で、エカントは使いません。コペルニクスが円運動・離心円・周転円を組み合わせた考え方を再現する教育用近似で、『天球回転論』の数表をそのまま実装したものではありません。',
  elements: ['太陽中心', '一様円運動', '離心円', '周転円', 'エカント不使用', '教育用近似'],
};

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function polar(radius, angle) {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function epicyclePosition(body, jd) {
  const T = (jd - J2000_JD) / DAYS_PER_CENTURY;
  const a = body.a0 + body.aRate * T;
  const e = body.e0 + body.eRate * T;
  const L = (body.L0 + body.LRate * T) * Math.PI / 180;
  const peri = (body.peri0 + body.periRate * T) * Math.PI / 180;

  // First-order circular decomposition of an eccentric orbit:
  // eccentric deferent center = -3ae/2 toward perihelion,
  // epicycle radius = ae/2, rotating at 2L - peri.
  const deferentCenter = polar(-1.5 * a * e, peri);
  const deferentVector = polar(a, L);
  const epicycleCenter = add(deferentCenter, deferentVector);
  const epicycleRadius = 0.5 * a * e;
  const epicycleVector = polar(epicycleRadius, 2 * L - peri);
  const position = add(epicycleCenter, epicycleVector);

  return { position, deferentCenter, deferentRadius: a, epicycleCenter, epicycleRadius };
}

export function predict(jd) {
  const earthModel = epicyclePosition(EARTH, jd);
  const marsModel = epicyclePosition(MARS, jd);
  const earth = earthModel.position;
  const marsHeliocentric = marsModel.position;
  const geocentricMars = {
    x: marsHeliocentric.x - earth.x,
    y: marsHeliocentric.y - earth.y,
  };

  return {
    longitudeDeg: normalizeDeg(Math.atan2(geocentricMars.y, geocentricMars.x) * 180 / Math.PI),
    mars: geocentricMars,
    geometry: {
      system: 'copernicus',
      extent: 2.0,
      observer: { x: earth.x, y: earth.y },
      orbits: [
        { kind: 'circle', center: earthModel.deferentCenter, radius: earthModel.deferentRadius, label: 'EARTH ECCENTRIC DEFERENT' },
        { kind: 'circle', center: marsModel.deferentCenter, radius: marsModel.deferentRadius, label: 'MARS ECCENTRIC DEFERENT' },
        { kind: 'circle', center: earthModel.epicycleCenter, radius: earthModel.epicycleRadius, label: 'EARTH EPICYCLE' },
        { kind: 'circle', center: marsModel.epicycleCenter, radius: marsModel.epicycleRadius, label: 'MARS EPICYCLE' },
      ],
      bodies: [
        { name: 'SUN', role: 'sun', x: 0, y: 0 },
        { name: 'EARTH', role: 'earth', x: earth.x, y: earth.y },
        { name: 'MARS', role: 'mars', x: marsHeliocentric.x, y: marsHeliocentric.y },
      ],
      sightline: {
        from: { x: earth.x, y: earth.y },
        to: { x: marsHeliocentric.x, y: marsHeliocentric.y },
      },
    },
  };
}
