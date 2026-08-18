// Model 3: eccentric deferent + epicycle.
// Independent program: previous model files are not imported.

const EPOCH_JD = 2458849.5;
const MARS_PERIOD_DAYS = 686.97959;
const EARTH_PERIOD_DAYS = 365.256363004;
const OMEGA_MARS = 2 * Math.PI / MARS_PERIOD_DAYS;
const OMEGA_EPICYCLE = 2 * Math.PI / EARTH_PERIOD_DAYS;
const R = 1.0;

const ECCENTRICITY_DISTANCE = 0.17258591;
const APSIS_ANGLE = 2.67128128;
const DEFERENT_PHASE = 3.88689959;
const EPICYCLE_RADIUS = 0.65339158;
const EPICYCLE_PHASE = 4.86261660;

export const model = {
  id: 'epicycle',
  stage: 3,
  name: '離心円＋周転円',
  shortName: '周転円',
  sourceFile: 'models/ptolemy/03-epicycle.js',
  description: '離心円の上を動く周転円の中心と、その周転円上を動く火星を組み合わせます。逆行を幾何学的に再現できます。',
  elements: ['離心円', '周転円', '一様円運動'],
  fittedStats: { maeDeg: 1.5636, rmsDeg: 2.1539, maxAbsDeg: 6.9691 },
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
  const deferentAngle = OMEGA_MARS * t + DEFERENT_PHASE;
  const epicycleCenter = {
    x: center.x + R * Math.cos(deferentAngle),
    y: center.y + R * Math.sin(deferentAngle),
  };
  const epicycleAngle = OMEGA_EPICYCLE * t + EPICYCLE_PHASE;
  const mars = {
    x: epicycleCenter.x + EPICYCLE_RADIUS * Math.cos(epicycleAngle),
    y: epicycleCenter.y + EPICYCLE_RADIUS * Math.sin(epicycleAngle),
  };
  return {
    longitudeDeg: normalizeDeg(Math.atan2(mars.y, mars.x) * 180 / Math.PI),
    mars,
    geometry: {
      earth: { x: 0, y: 0 },
      deferentCenter: center,
      deferentRadius: R,
      epicycleCenter,
      epicycleRadius: EPICYCLE_RADIUS,
      equant: null,
    },
  };
}
