// Keplerian educational model: fixed ellipses + variable orbital speed from Kepler's equation.
// Independent program: no other model file is imported.
// J2000 orbital shapes/orientations are held fixed; only mean longitude advances uniformly.
// This avoids reproducing the reference generator's secular element updates exactly.

const J2000_JD = 2451545.0;
const DAYS_PER_CENTURY = 36525.0;

const EARTH = {
  a: 1.00000261,
  e: 0.01671123,
  I: -0.00001531,
  L0: 100.46457166,
  LRate: 35999.37244981,
  peri: 102.93768193,
  node: 0.0,
};

const MARS = {
  a: 1.52371034,
  e: 0.09339410,
  I: 1.84969142,
  L0: -4.55343205,
  LRate: 19140.30268499,
  peri: -23.94362959,
  node: 49.55953891,
};

export const model = {
  id: 'kepler-elliptic',
  theory: 'kepler',
  stage: 1,
  name: 'ケプラー：楕円軌道＋非等速運動',
  shortName: 'ケプラー',
  sourceFile: 'models/kepler/01-elliptic-orbits.js',
  description: '太陽を焦点とする楕円軌道を使い、ケプラー方程式を解いて軌道上の速度変化を入れたモデルです。比較を自己一致にしないため、軌道形状と向きはJ2000値に固定し、基準データ側にある歳差的な要素変化は入れていません。',
  elements: ['太陽中心', '楕円軌道', '焦点', 'ケプラー方程式', '非等速運動'],
};

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function wrap180(deg) {
  return ((deg + 180) % 360 + 360) % 360 - 180;
}

function solveKeplerDeg(meanAnomalyDeg, eccentricity) {
  const M = wrap180(meanAnomalyDeg);
  const eStar = 180 / Math.PI * eccentricity;
  let E = M + eStar * Math.sin(M * Math.PI / 180);
  for (let i = 0; i < 20; i++) {
    const Er = E * Math.PI / 180;
    const deltaM = M - (E - eStar * Math.sin(Er));
    const deltaE = deltaM / (1 - eccentricity * Math.cos(Er));
    E += deltaE;
    if (Math.abs(deltaE) <= 1e-10) break;
  }
  return E;
}

function rotateOrbitalPlane(body, x1, y1) {
  const w = (body.peri - body.node) * Math.PI / 180;
  const O = body.node * Math.PI / 180;
  const I = body.I * Math.PI / 180;
  const cw = Math.cos(w), sw = Math.sin(w);
  const cO = Math.cos(O), sO = Math.sin(O);
  const cI = Math.cos(I);
  return {
    x: (cw * cO - sw * sO * cI) * x1 + (-sw * cO - cw * sO * cI) * y1,
    y: (cw * sO + sw * cO * cI) * x1 + (-sw * sO + cw * cO * cI) * y1,
  };
}

function keplerianPosition(body, jd) {
  const T = (jd - J2000_JD) / DAYS_PER_CENTURY;
  const meanLongitude = body.L0 + body.LRate * T;
  const meanAnomaly = meanLongitude - body.peri;
  const E = solveKeplerDeg(meanAnomaly, body.e) * Math.PI / 180;
  const x1 = body.a * (Math.cos(E) - body.e);
  const y1 = body.a * Math.sqrt(1 - body.e * body.e) * Math.sin(E);
  return rotateOrbitalPlane(body, x1, y1);
}

function buildOrbitPath(body, samples = 180) {
  const points = [];
  for (let i = 0; i <= samples; i++) {
    const E = 2 * Math.PI * i / samples;
    const x1 = body.a * (Math.cos(E) - body.e);
    const y1 = body.a * Math.sqrt(1 - body.e * body.e) * Math.sin(E);
    points.push(rotateOrbitalPlane(body, x1, y1));
  }
  return points;
}

const EARTH_PATH = buildOrbitPath(EARTH);
const MARS_PATH = buildOrbitPath(MARS);

export function predict(jd) {
  const earth = keplerianPosition(EARTH, jd);
  const marsHeliocentric = keplerianPosition(MARS, jd);
  const geocentricMars = {
    x: marsHeliocentric.x - earth.x,
    y: marsHeliocentric.y - earth.y,
  };

  return {
    longitudeDeg: normalizeDeg(Math.atan2(geocentricMars.y, geocentricMars.x) * 180 / Math.PI),
    mars: geocentricMars,
    geometry: {
      system: 'kepler',
      extent: 1.95,
      observer: { x: earth.x, y: earth.y },
      orbits: [
        { kind: 'polyline', points: EARTH_PATH, label: 'EARTH ELLIPSE' },
        { kind: 'polyline', points: MARS_PATH, label: 'MARS ELLIPSE' },
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
