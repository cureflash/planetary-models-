// Model 4: epicycle + eccentric deferent + equant.
// Independent program: previous model files are not imported.

const EPOCH_JD = 2458849.5;
const MARS_PERIOD_DAYS = 686.97959;
const EARTH_PERIOD_DAYS = 365.256363004;
const OMEGA_MARS = 2 * Math.PI / MARS_PERIOD_DAYS;
const OMEGA_EPICYCLE = 2 * Math.PI / EARTH_PERIOD_DAYS;
const R = 1.0;

const ECCENTRICITY_DISTANCE = 0.09869241;
const APSIS_ANGLE = 2.64475709;
const EQUANT_PHASE = 3.89634728;
const EPICYCLE_RADIUS = 0.65715804;
const EPICYCLE_PHASE = 4.88197935;

export const model = {
  id: 'equant',
  stage: 4,
  name: '周転円＋離心円＋エカント',
  shortName: 'エカント',
  sourceFile: 'models/ptolemy/04-equant.js',
  description: '周転円と離心円にエカントを追加します。周転円の中心は、エカントから見た角度が一定速度で増えるように離心円上を動きます。',
  elements: ['周転円', '離心円', 'エカント'],
  fittedStats: { maeDeg: 0.2436, rmsDeg: 0.2971, maxAbsDeg: 0.9274 },
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
