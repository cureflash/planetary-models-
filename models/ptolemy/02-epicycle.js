// Model 2: Earth-centered deferent + epicycle, without eccentric or equant.
// Independent program: it does not call the Model 1 implementation.

const EPOCH_JD = 2458849.5;
const MARS_PERIOD_DAYS = 686.97959;
const EARTH_PERIOD_DAYS = 365.256363004;
const OMEGA_MARS = 2 * Math.PI / MARS_PERIOD_DAYS;
const OMEGA_EPICYCLE = 2 * Math.PI / EARTH_PERIOD_DAYS;
const R = 1.0;

const DEFERENT_PHASE = 3.92419707;
const EPICYCLE_RADIUS = 0.67173831;
const EPICYCLE_PHASE = 4.80430219;

export const model = {
  id: 'epicycle-only',
  stage: 2,
  name: '周転円',
  shortName: '周転円',
  sourceFile: 'models/ptolemy/02-epicycle.js',
  description: '地球中心の従円に周転円だけを追加します。逆行そのものは再現できますが、長期間の火星位置にはまだ大きなずれが残ります。',
  elements: ['地球中心', '従円', '周転円', '一様円運動'],
  fittedStats: { maeDeg: 6.6945, rmsDeg: 8.4696, maxAbsDeg: 33.3440 },
};

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

export function predict(jd) {
  const t = jd - EPOCH_JD;
  const deferentAngle = OMEGA_MARS * t + DEFERENT_PHASE;
  const epicycleCenter = {
    x: R * Math.cos(deferentAngle),
    y: R * Math.sin(deferentAngle),
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
      deferentCenter: { x: 0, y: 0 },
      deferentRadius: R,
      epicycleCenter,
      epicycleRadius: EPICYCLE_RADIUS,
      equant: null,
    },
  };
}
