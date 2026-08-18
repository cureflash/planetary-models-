import { PTOLEMY_FIT } from './fitted-parameters.js';

// Model 4: epicycle + eccentric deferent + equant.
const EPOCH_JD = PTOLEMY_FIT.constants.epoch_jd;
const MARS_PERIOD_DAYS = PTOLEMY_FIT.constants.mars_period_days;
const EARTH_PERIOD_DAYS = PTOLEMY_FIT.constants.earth_period_days;
const OMEGA_MARS = 2 * Math.PI / MARS_PERIOD_DAYS;
const OMEGA_EPICYCLE = 2 * Math.PI / EARTH_PERIOD_DAYS;
const R = 1.0;
const [ECCENTRICITY_DISTANCE, APSIS_ANGLE, EQUANT_PHASE, EPICYCLE_RADIUS, EPICYCLE_PHASE] =
  PTOLEMY_FIT.models.equant.parameters;
const stats = PTOLEMY_FIT.models.equant.stats;

export const model = {
  id: 'equant',
  stage: 4,
  name: '周転円＋離心円＋エカント',
  shortName: 'エカント',
  sourceFile: 'models/ptolemy/04-equant.js',
  description: '周転円と離心円にエカントを追加します。Carlsbergの実観測火星位置に各パラメータを合わせています。',
  elements: ['周転円', '離心円', 'エカント', 'Carlsberg実観測で評価'],
  fittedStats: { maeDeg: stats.mae_deg, rmsDeg: stats.rms_deg, maxAbsDeg: stats.max_abs_deg },
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
  const equant = { x: 2 * center.x, y: 2 * center.y };
  const alpha = OMEGA_MARS * t + EQUANT_PHASE;
  const ux = Math.cos(alpha);
  const uy = Math.sin(alpha);

  const dot = center.x * ux + center.y * uy;
  const c2 = center.x * center.x + center.y * center.y;
  const s = -dot + Math.sqrt(Math.max(0, dot * dot + R * R - c2));
  const epicycleCenter = {
    x: equant.x + s * ux,
    y: equant.y + s * uy,
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
      equant,
    },
  };
}
