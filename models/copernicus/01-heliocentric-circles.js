// Copernican educational model: Earth and Mars move on uniform circles around the Sun.
// Independent program: no Ptolemaic, Tychonic, or Kepler model file is imported.
// Modern J2000 mean longitudes/rates are used so the comparison isolates the geometry.

const J2000_JD = 2451545.0;
const DAYS_PER_CENTURY = 36525.0;

const EARTH = {
  a0: 1.00000261,
  aRate: 0.00000562,
  L0: 100.46457166,
  LRate: 35999.37244981,
};

const MARS = {
  a0: 1.52371034,
  aRate: 0.00001847,
  L0: -4.55343205,
  LRate: 19140.30268499,
};

export const model = {
  id: 'copernicus-circular',
  theory: 'copernicus',
  stage: 1,
  name: 'コペルニクス：太陽中心・等速円運動',
  shortName: 'コペルニクス',
  sourceFile: 'models/copernicus/01-heliocentric-circles.js',
  description: '地球と火星が太陽を中心とする円軌道を、それぞれ一定角速度で回る簡略コペルニクスモデルです。地球から見た火星の方向は、火星の太陽中心位置から地球の太陽中心位置を引いて求めます。',
  elements: ['太陽中心', '地球の円軌道', '火星の円軌道', '等速円運動'],
};

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function circularPosition(body, jd) {
  const T = (jd - J2000_JD) / DAYS_PER_CENTURY;
  const radius = body.a0 + body.aRate * T;
  const longitude = (body.L0 + body.LRate * T) * Math.PI / 180;
  return {
    x: radius * Math.cos(longitude),
    y: radius * Math.sin(longitude),
    radius,
  };
}

export function predict(jd) {
  const earth = circularPosition(EARTH, jd);
  const marsHeliocentric = circularPosition(MARS, jd);
  const geocentricMars = {
    x: marsHeliocentric.x - earth.x,
    y: marsHeliocentric.y - earth.y,
  };

  return {
    longitudeDeg: normalizeDeg(Math.atan2(geocentricMars.y, geocentricMars.x) * 180 / Math.PI),
    mars: geocentricMars,
    geometry: {
      system: 'copernicus',
      extent: 1.95,
      observer: { x: earth.x, y: earth.y },
      orbits: [
        { kind: 'circle', center: { x: 0, y: 0 }, radius: earth.radius, label: 'EARTH ORBIT' },
        { kind: 'circle', center: { x: 0, y: 0 }, radius: marsHeliocentric.radius, label: 'MARS ORBIT' },
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
