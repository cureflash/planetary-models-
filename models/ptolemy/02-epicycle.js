import { PTOLEMY_FIT } from './fitted-parameters.js';

// Model 2: Earth-centered deferent + epicycle, without eccentric or equant.
const EPOCH_JD = PTOLEMY_FIT.constants.epoch_jd;
const MARS_PERIOD_DAYS = PTOLEMY_FIT.constants.mars_period_days;
const EARTH_PERIOD_DAYS = PTOLEMY_FIT.constants.earth_period_days;
const OMEGA_MARS = 2 * Math.PI / MARS_PERIOD_DAYS;
const OMEGA_EPICYCLE = 2 * Math.PI / EARTH_PERIOD_DAYS;
const R = 1.0;
const [DEFERENT_PHASE, EPICYCLE_RADIUS, EPICYCLE_PHASE] = PTOLEMY_FIT.models.epicycle_only.parameters;
const stats = PTOLEMY_FIT.models.epicycle_only.stats;

export const model = {
  id: 'epicycle-only',
  stage: 2,
  name: '周転円',
  shortName: '周転円',
  sourceFile: 'models/ptolemy/02-epicycle.js',
  description: '地球中心の従円に周転円だけを追加します。逆行を再現し、Tokyo PMC88の実観測火星位置に位相と周転円半径を合わせています。',
  elements: ['地球中心', '従円', '周転円', '一様円運動', 'Tokyo PMC88実観測で評価'],
  fittedStats: { maeDeg: stats.mae_deg, rmsDeg: stats.rms_deg, maxAbsDeg: stats.max_abs_deg },
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
