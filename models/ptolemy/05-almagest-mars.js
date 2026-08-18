// Ptolemy's Mars model using numerical parameters and mean motions from the Almagest.
// This is a historical-parameter extrapolation, not a fit to the 2020-2030 reference data.
// Longitudinal model only: latitude is intentionally omitted.

const DEG = Math.PI / 180;

function sexagesimal(...parts) {
  let value = parts[0];
  let divisor = 60;
  for (let i = 1; i < parts.length; i++) {
    value += parts[i] / divisor;
    divisor *= 60;
  }
  return value;
}

// 1 Thoth, year 1 of Nabonassar: 26 Feb 747 BCE (proleptic Julian),
// mean local noon at Alexandria, approximated as 10:00 UT (30 degrees E).
const NABONASSAR_EPOCH_JD = 1448637.9166667;

// Almagest Mars geometry. Deferent radius is the conventional 60 parts.
const DEFERENT_RADIUS = 1.0;
const CENTER_OFFSET = 6 / 60;       // Earth -> deferent centre
const EQUANT_OFFSET = 12 / 60;      // Earth -> equant
const EPICYCLE_RADIUS = 39.5 / 60;  // 39;30 / 60

// Epoch values quoted for Mars.
const EPOCH_MEAN_LONGITUDE = sexagesimal(3, 32);
const EPOCH_EPICYCLE_ANOMALY = sexagesimal(327, 13);
const EPOCH_APOGEE = sexagesimal(106, 40);

// Almagest IX.3 mean daily motions.
const MEAN_LONGITUDE_PER_DAY = sexagesimal(0, 31, 26, 36, 53, 51, 33);
const EPICYCLE_ANOMALY_PER_DAY = sexagesimal(0, 27, 41, 40, 19, 20, 58);

// Ptolemy's precession: 1 degree per century.
// His tropical year is 365;14,48 days.
const PTOLEMY_TROPICAL_YEAR_DAYS = sexagesimal(365, 14, 48);
const APOGEE_PRECESSION_PER_DAY = 1 / (100 * PTOLEMY_TROPICAL_YEAR_DAYS);

export const model = {
  id: 'almagest-mars',
  theory: 'ptolemy',
  stage: 1,
  parameterSet: 'almagest',
  name: '『アルマゲスト』火星モデル',
  shortName: 'アルマゲスト史実値',
  sourceFile: 'models/ptolemy/05-almagest-mars.js',
  description: '離心円・周転円・エカントというプトレマイオスの完成形に、『アルマゲスト』で火星に与えられた幾何比・元期位置・平均日運動を入れ、そのまま2020–2030年まで外挿した史実パラメータ版です。現代データへの再フィットはしていません。',
  elements: ['史実パラメータ', '離心円 60', '中心ずれ 6', '周転円 39;30', 'エカント 12', '古代の平均日運動'],
};

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

export function predict(jd) {
  const t = jd - NABONASSAR_EPOCH_JD;

  const meanLongitudeDeg = normalizeDeg(EPOCH_MEAN_LONGITUDE + MEAN_LONGITUDE_PER_DAY * t);
  const epicycleAnomalyDeg = normalizeDeg(EPOCH_EPICYCLE_ANOMALY + EPICYCLE_ANOMALY_PER_DAY * t);
  const apogeeDeg = normalizeDeg(EPOCH_APOGEE + APOGEE_PRECESSION_PER_DAY * t);

  const apogee = apogeeDeg * DEG;
  const center = {
    x: CENTER_OFFSET * Math.cos(apogee),
    y: CENTER_OFFSET * Math.sin(apogee),
  };
  const equant = {
    x: EQUANT_OFFSET * Math.cos(apogee),
    y: EQUANT_OFFSET * Math.sin(apogee),
  };

  // Uniform angular motion is measured from the equant. Intersect that ray
  // with the deferent circle to obtain the epicycle centre.
  const alpha = meanLongitudeDeg * DEG;
  const ux = Math.cos(alpha);
  const uy = Math.sin(alpha);
  const dx = equant.x - center.x;
  const dy = equant.y - center.y;
  const projection = dx * ux + dy * uy;
  const discriminant = projection * projection - (dx * dx + dy * dy - DEFERENT_RADIUS * DEFERENT_RADIUS);
  const s = -projection + Math.sqrt(Math.max(0, discriminant));
  const epicycleCenter = {
    x: equant.x + s * ux,
    y: equant.y + s * uy,
  };

  // Epicyclic anomaly is measured from the epicycle apogee, i.e. outward
  // from Earth through the epicycle centre.
  const centreDirection = Math.atan2(epicycleCenter.y, epicycleCenter.x);
  const epicycleAngle = centreDirection + epicycleAnomalyDeg * DEG;
  const mars = {
    x: epicycleCenter.x + EPICYCLE_RADIUS * Math.cos(epicycleAngle),
    y: epicycleCenter.y + EPICYCLE_RADIUS * Math.sin(epicycleAngle),
  };

  return {
    longitudeDeg: normalizeDeg(Math.atan2(mars.y, mars.x) / DEG),
    mars,
    geometry: {
      earth: { x: 0, y: 0 },
      deferentCenter: center,
      deferentRadius: DEFERENT_RADIUS,
      epicycleCenter,
      epicycleRadius: EPICYCLE_RADIUS,
      equant,
      historical: true,
      apogeeDeg,
      meanLongitudeDeg,
      epicycleAnomalyDeg,
    },
  };
}
