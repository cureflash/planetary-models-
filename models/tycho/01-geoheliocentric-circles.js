// Tychonic educational model: Earth is fixed; the Sun circles Earth; Mars circles the Sun.
// Independent program: no Copernican or other model file is imported.
// The chosen circular motions are algebraically equivalent to the circular Copernican model
// for the Earth-Mars apparent direction.

const J2000_JD = 2451545.0;
const DAYS_PER_CENTURY = 36525.0;

const EARTH_ORBIT = {
  a0: 1.00000261,
  aRate: 0.00000562,
  L0: 100.46457166,
  LRate: 35999.37244981,
};

const MARS_ORBIT = {
  a0: 1.52371034,
  aRate: 0.00001847,
  L0: -4.55343205,
  LRate: 19140.30268499,
};

export const model = {
  id: 'tycho-circular',
  theory: 'tycho',
  stage: 1,
  name: 'ティコ：地球固定・太陽中心の惑星運動',
  shortName: 'ティコ',
  sourceFile: 'models/tycho/01-geoheliocentric-circles.js',
  description: '地球を静止させ、太陽が地球のまわりを回り、その太陽のまわりを火星が回る簡略ティコモデルです。同じ円運動を使う限り、火星の地球からの見かけ方向は簡略コペルニクスモデルと一致します。',
  elements: ['地球固定', '太陽の地球周回', '火星の太陽周回', '等速円運動'],
};

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function circularVector(body, jd) {
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
  const earthHeliocentric = circularVector(EARTH_ORBIT, jd);
  const marsAroundSun = circularVector(MARS_ORBIT, jd);

  const earth = { x: 0, y: 0 };
  const sun = { x: -earthHeliocentric.x, y: -earthHeliocentric.y };
  const mars = {
    x: sun.x + marsAroundSun.x,
    y: sun.y + marsAroundSun.y,
  };

  return {
    longitudeDeg: normalizeDeg(Math.atan2(mars.y, mars.x) * 180 / Math.PI),
    mars,
    geometry: {
      system: 'tycho',
      extent: 2.75,
      observer: earth,
      orbits: [
        { kind: 'circle', center: earth, radius: earthHeliocentric.radius, label: 'SUN ORBIT' },
        { kind: 'circle', center: sun, radius: marsAroundSun.radius, label: 'MARS ORBIT' },
      ],
      bodies: [
        { name: 'EARTH', role: 'earth', x: 0, y: 0 },
        { name: 'SUN', role: 'sun', x: sun.x, y: sun.y },
        { name: 'MARS', role: 'mars', x: mars.x, y: mars.y },
      ],
      sightline: { from: earth, to: mars },
    },
  };
}
