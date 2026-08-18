import { PTOLEMY_FIT } from './fitted-parameters.js';

// Model 3: eccentric deferent + epicycle.
const EPOCH_JD = PTOLEMY_FIT.constants.epoch_jd;
const MARS_PERIOD_DAYS = PTOLEMY_FIT.constants.mars_period_days;
const EARTH_PERIOD_DAYS = PTOLEMY_FIT.constants.earth_period_days;
const OMEGA_MARS = 2 * Math.PI / MARS_PERIOD_DAYS;
const OMEGA_EPICYCLE = 2 * Math.PI / EARTH_PERIOD_DAYS;
const R = 1.0;
const [ECCENTRICITY_DISTANCE, APSIS_ANGLE, DEFERENT_PHASE, EPICYCLE_RADIUS, EPICYCLE_PHASE] =
  PTOLEMY_FIT.models.epicycle_eccentric.parameters;
const stats = PTOLEMY_FIT.models.epicycle_eccentric.stats;
const fitLabel = PTOLEMY_FIT.source?.catalog === 'USNO W2J00 Transit Circle Catalog'
  ? 'USNO W2J00実観測'
  : 'JPL計算基準値 2020–2030';

export const model = {
  id: 'epicycle-eccentric',
  stage: 3,
  name: '周転円＋離心円',
  shortName: '離心円',
  sourceFile: 'models/ptolemy/03-epicycle-eccentric.js',
  description: `周転円モデルに離心円を追加し、従円の中心を地球からずらします。${fitLabel}に各パラメータを合わせています。`,
  elements: ['周転円', '離心円', '一様円運動', `${fitLabel}で評価`],
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
