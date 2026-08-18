import { PTOLEMY_FIT } from './fitted-parameters.js';

// Model 1: uniform circular motion centered on Earth.
const EPOCH_JD = PTOLEMY_FIT.constants.epoch_jd;
const MARS_PERIOD_DAYS = PTOLEMY_FIT.constants.mars_period_days;
const OMEGA = 2 * Math.PI / MARS_PERIOD_DAYS;
const [PHASE] = PTOLEMY_FIT.models.simple_circle.parameters;
const R = 1.0;
const stats = PTOLEMY_FIT.models.simple_circle.stats;

export const model = {
  id: 'simple-circle',
  stage: 1,
  name: '単純な円運動',
  shortName: '単純円',
  sourceFile: 'models/ptolemy/01-simple-circle.js',
  description: '地球を中心に、火星が一定角速度で円運動すると仮定します。離心円・周転円・エカントは使いません。Tokyo PMC88の実観測火星位置に位相を合わせています。',
  elements: ['地球中心', '一様円運動', 'Tokyo PMC88実観測で評価'],
  fittedStats: { maeDeg: stats.mae_deg, rmsDeg: stats.rms_deg, maxAbsDeg: stats.max_abs_deg },
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
