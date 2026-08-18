// Model 2: eccentric deferent.
// Independent program: it does not call the Model 1 implementation.

const EPOCH_JD = 2458849.5;
const MARS_PERIOD_DAYS = 686.97959;
const OMEGA = 2 * Math.PI / MARS_PERIOD_DAYS;
const R = 1.0;

const ECCENTRICITY_DISTANCE = 0.35;
const APSIS_ANGLE = 2.11137031;
const PHASE = 3.93413983;

export const model = {
  id: 'eccentric',
  stage: 2,
  name: '離心円',
  shortName: '離心円',
  sourceFile: 'models/ptolemy/02-eccentric.js',
  description: '円の中心を地球からずらします。火星は離心円の中心のまわりを一定角速度で動きます。',
  elements: ['地球中心の観測', '一様円運動', '離心円'],
  fittedStats: { maeDeg: 22.9500, rmsDeg: 25.8845, maxAbsDeg: 45.3466 },
};

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

export function predict(jd) {
  const t = jd - EPOCH_JD;
  const center = {
    x: ECCENTRICITY_DISTANCE * Math.cos(APSIS_ANGLE),
    y: ECCENTRICITY_DISTANCE * Math.sin(APSIS_ANGLE),
  };
  const theta = OMEGA * t + PHASE;
  const mars = {
    x: center.x + R * Math.cos(theta),
    y: center.y + R * Math.sin(theta),
  };
  return {
    longitudeDeg: normalizeDeg(Math.atan2(mars.y, mars.x) * 180 / Math.PI),
    mars,
    geometry: {
      earth: { x: 0, y: 0 },
      deferentCenter: center,
      deferentRadius: R,
      epicycleCenter: null,
      epicycleRadius: null,
      equant: null,
    },
  };
}
