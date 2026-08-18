// Model 1: uniform circular motion centered on Earth.
// Complete independent prediction program for this stage.

const EPOCH_JD = 2458849.5; // 2020-01-01
const MARS_PERIOD_DAYS = 686.97959;
const OMEGA = 2 * Math.PI / MARS_PERIOD_DAYS;
const PHASE = 3.92741138;
const R = 1.0;

export const model = {
  id: 'simple-circle',
  stage: 1,
  name: '単純な円運動',
  shortName: '単純円',
  sourceFile: 'models/ptolemy/01-simple-circle.js',
  description: '地球を中心に、火星が一定角速度で円運動すると仮定します。離心円・周転円・エカントは使いません。',
  elements: ['地球中心', '一様円運動'],
  fittedStats: { maeDeg: 28.3227, rmsDeg: 31.5563, maxAbsDeg: 53.7904 },
};

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

export function predict(jd) {
  const t = jd - EPOCH_JD;
  const theta = OMEGA * t + PHASE;
  const mars = { x: R * Math.cos(theta), y: R * Math.sin(theta) };
  return {
    longitudeDeg: normalizeDeg(Math.atan2(mars.y, mars.x) * 180 / Math.PI),
    mars,
    geometry: {
      earth: { x: 0, y: 0 },
      deferentCenter: { x: 0, y: 0 },
      deferentRadius: R,
      epicycleCenter: null,
      epicycleRadius: null,
      equant: null,
    },
  };
}
