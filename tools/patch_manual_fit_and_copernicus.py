from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing marker for {label}: {old[:100]!r}')
    return text.replace(old, new, 1)


# index.html: make Ptolemy fit choice independent of dataset.
index = ROOT / 'index.html'
html = index.read_text(encoding='utf-8')
html = replace_once(
    html,
    '<p>同じプトレマイオス型の幾何を、USNO W2J00実観測へのフィット値と『アルマゲスト』の史実値で切り替えます。</p>',
    '<p>比較データとは独立に、W2J00フィット・JPL計算値フィット・『アルマゲスト』史実値を選びます。データを切り替えてもパラメータは勝手に変わりません。</p>',
    'ptolemy panel description',
)
html = replace_once(
    html,
    '<button class="parameter-button active" data-ptolemy-mode="fitted" aria-pressed="true">USNO W2J00フィット</button>\n        <button class="parameter-button" data-ptolemy-mode="almagest" aria-pressed="false">アルマゲスト史実値</button>',
    '<button class="parameter-button active" data-ptolemy-mode="w2j00" aria-pressed="true">USNO W2J00フィット</button>\n        <button class="parameter-button" data-ptolemy-mode="jpl" aria-pressed="false">JPL計算値フィット</button>\n        <button class="parameter-button" data-ptolemy-mode="almagest" aria-pressed="false">アルマゲスト史実値</button>',
    'ptolemy parameter buttons',
)
html = replace_once(
    html,
    '<p>緑はUSNO W2J00実観測、赤は選択中モデルです。プトレマイオスのW2J00フィットは、単純円 → 周転円 → 周転円＋離心円 → 周転円＋離心円＋エカントの順で、同じ623観測点への角度誤差を評価します。</p>',
    '<p>緑はUSNO W2J00実観測、赤は選択中モデルです。プトレマイオスのパラメータセットは比較データとは独立に選べます。W2J00で合わせた固定値をJPL計算値へぶつける、またはその逆の比較もできます。</p>',
    'methodology Ptolemy note',
)
html = html.replace('dataset-switch-2', 'dataset-switch-3')
index.write_text(html, encoding='utf-8')


# data-bootstrap.js: persist manual pfit independently of dataset.
bootstrap = ROOT / 'js' / 'data-bootstrap.js'
text = bootstrap.read_text(encoding='utf-8')
text = replace_once(
    text,
    "const dataset = params.get('dataset') === 'jpl' ? 'jpl' : 'w2j00';\nwindow.__PLANETARY_DATASET__ = dataset;",
    "const dataset = params.get('dataset') === 'jpl' ? 'jpl' : 'w2j00';\nconst requestedFit = params.get('pfit');\nconst ptolemyFitMode = ['w2j00', 'jpl', 'almagest'].includes(requestedFit) ? requestedFit : 'w2j00';\nwindow.__PLANETARY_DATASET__ = dataset;\nwindow.__PTOLEMY_FIT_MODE__ = ptolemyFitMode;",
    'bootstrap pfit state',
)
text = replace_once(
    text,
    "const datasetButtons = [...document.querySelectorAll('[data-dataset]')];",
    "document.querySelectorAll('[data-ptolemy-mode]').forEach(button => {\n  const active = button.dataset.ptolemyMode === ptolemyFitMode;\n  button.classList.toggle('active', active);\n  button.setAttribute('aria-pressed', String(active));\n});\n\nconst datasetButtons = [...document.querySelectorAll('[data-dataset]')];",
    'bootstrap pfit buttons',
)
text = text.replace("const fittedButton = document.querySelector('[data-ptolemy-mode=\"fitted\"]');\n", '')
text = text.replace("const ptolemyPanelText = document.querySelector('#ptolemyParameterPanel p');\n", '')
text = text.replace("  setText(fittedButton, 'JPL計算値フィット');\n", '')
text = text.replace("  setText(ptolemyPanelText, '同じプトレマイオス型の幾何を、JPL計算基準値へのフィット値と『アルマゲスト』の史実値で切り替えます。');\n", '')
text = replace_once(
    text,
    "  const description = document.querySelector('#modelDescription');\n  if (description) {\n    setText(\n      description,\n      replaceJplText(description.textContent)\n        .replaceAll('実際に辿った', '計算上の')\n        .replaceAll('火星観測データ', 'JPL火星計算基準値')\n    );\n  }\n\n  document.querySelectorAll('#modelElements span').forEach(span => {\n    setText(span, replaceJplText(span.textContent).replaceAll('観測データ', 'JPL計算基準値'));\n  });",
    "  const activeTheory = document.querySelector('.theory-tab.active')?.dataset.theory;\n  if (activeTheory !== 'ptolemy') {\n    const description = document.querySelector('#modelDescription');\n    if (description) {\n      setText(\n        description,\n        replaceJplText(description.textContent)\n          .replaceAll('実際に辿った', '計算上の')\n          .replaceAll('火星観測データ', 'JPL火星計算基準値')\n      );\n    }\n\n    document.querySelectorAll('#modelElements span').forEach(span => {\n      setText(span, replaceJplText(span.textContent).replaceAll('観測データ', 'JPL計算基準値'));\n    });\n  }",
    'avoid relabeling manual Ptolemy fit',
)
text = replace_once(
    text,
    '<p>プトレマイオスの「フィット」は、この2020–2030年計算基準値に合わせて以前求めたパラメータへ自動的に切り替わります。USNO W2J00モードではW2J00実観測へのフィット値へ戻ります。</p>',
    '<p>プトレマイオスのパラメータは比較データとは独立です。PTOLEMY PARAMETER SETでW2J00フィット、JPL計算値フィット、アルマゲスト史実値を手動選択でき、データ切替では自動変更しません。</p>',
    'JPL methodology fit note',
)
text = text.replace('jpl-dataset-5', 'jpl-dataset-6').replace('w2j00-dataset-5', 'w2j00-dataset-6')
bootstrap.write_text(text, encoding='utf-8')


# The fit selector is read dynamically; model modules are re-imported with a mode-specific URL.
selector = ROOT / 'models' / 'ptolemy' / 'fitted-parameters.js'
selector.write_text("""import { W2J00_FIT } from './fitted-parameters-w2j00.js';
import { JPL_FIT } from './fitted-parameters-jpl.js';

function selectedFit() {
  const mode = typeof window !== 'undefined' ? window.__PTOLEMY_FIT_MODE__ : 'w2j00';
  return mode === 'jpl' ? JPL_FIT : W2J00_FIT;
}

export const PTOLEMY_FIT = new Proxy({}, {
  get(_target, property) {
    return selectedFit()[property];
  },
});
""", encoding='utf-8')


# Both frontends share the same explicit fit-mode choices and Copernicus stages.
for rel in ['js/app-v3.js', 'js/app-v4.js']:
    path = ROOT / rel
    src = path.read_text(encoding='utf-8')
    src = replace_once(
        src,
        "{ id: 'copernicus', label: 'コペルニクス', files: ['../models/copernicus/01-heliocentric-circles.js'] }",
        "{ id: 'copernicus', label: 'コペルニクス', files: ['../models/copernicus/01-heliocentric-circles.js', '../models/copernicus/02-eccentric-epicycles.js'] }",
        f'{rel} Copernicus stages',
    )
    src = replace_once(
        src,
        "let ptolemyMode = 'fitted';",
        "let ptolemyMode = window.__PTOLEMY_FIT_MODE__ || 'w2j00';",
        f'{rel} initial Ptolemy mode',
    )
    src = replace_once(
        src,
        "if (!['fitted', 'almagest'].includes(mode) || ptolemyMode === mode) return;\n  ptolemyMode = mode;\n  stageIndex = 0;",
        "if (!['w2j00', 'jpl', 'almagest'].includes(mode) || ptolemyMode === mode) return;\n  ptolemyMode = mode;\n  window.__PTOLEMY_FIT_MODE__ = mode;\n  const url = new URL(window.location.href);\n  url.searchParams.set('pfit', mode);\n  window.history.replaceState(null, '', url);\n  stageIndex = 0;",
        f'{rel} manual Ptolemy mode switch',
    )
    path.write_text(src, encoding='utf-8')


# Make Ptolemy model metadata describe the actually selected fit, not the current comparison dataset.
model_keys = {
    'models/ptolemy/01-simple-circle.js': 'simple_circle',
    'models/ptolemy/02-epicycle.js': 'epicycle_only',
    'models/ptolemy/03-epicycle-eccentric.js': 'epicycle_eccentric',
    'models/ptolemy/04-equant.js': 'equant',
}
for rel, key in model_keys.items():
    path = ROOT / rel
    src = path.read_text(encoding='utf-8')
    marker = f'const stats = PTOLEMY_FIT.models.{key}.stats;'
    if 'const fitLabel =' not in src:
        src = replace_once(
            src,
            marker,
            marker + "\nconst fitLabel = PTOLEMY_FIT.source?.catalog === 'USNO W2J00 Transit Circle Catalog'\n  ? 'USNO W2J00実観測'\n  : 'JPL計算基準値 2020–2030';",
            f'{rel} fit label',
        )
    lines = []
    for line in src.splitlines():
        if 'description:' in line and 'USNO W2J00' in line:
            line = line.replace("description: '", 'description: `').replace("',", '`,')
            line = line.replace('USNO W2J00の火星実観測', '${fitLabel}').replace('USNO W2J00実観測', '${fitLabel}')
        if 'elements:' in line and 'USNO W2J00実観測で評価' in line:
            line = line.replace("'USNO W2J00実観測で評価'", '`${fitLabel}で評価`')
        lines.append(line)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


# Copernican stage 2: historically inspired eccentric + epicycle construction using only uniform circles.
cop = ROOT / 'models' / 'copernicus' / '02-eccentric-epicycles.js'
cop.write_text(r'''// Copernican educational stage 2.
// Copernicus retained combinations of uniform circular motions, eccentrics and epicycles.
// This is a historically inspired first-order construction, not a transcription of De revolutionibus tables.
// The eccentric + epicycle terms approximate each planet's orbital eccentricity while avoiding an equant.

const J2000_JD = 2451545.0;
const DAYS_PER_CENTURY = 36525.0;

const EARTH = {
  a0: 1.00000261,
  aRate: 0.00000562,
  e0: 0.01671123,
  eRate: -0.00004392,
  L0: 100.46457166,
  LRate: 35999.37244981,
  peri0: 102.93768193,
  periRate: 0.32327364,
};

const MARS = {
  a0: 1.52371034,
  aRate: 0.00001847,
  e0: 0.09339410,
  eRate: 0.00007882,
  L0: -4.55343205,
  LRate: 19140.30268499,
  peri0: -23.94362959,
  periRate: 0.44441088,
};

export const model = {
  id: 'copernicus-eccentric-epicycles',
  theory: 'copernicus',
  stage: 2,
  name: 'コペルニクス：離心円＋周転円補正',
  shortName: 'コペルニクス＋周転円',
  sourceFile: 'models/copernicus/02-eccentric-epicycles.js',
  description: '太陽中心を保ったまま、地球と火星の運動を離心した従円と小さな周転円の合成で補正します。すべて一様円運動で、エカントは使いません。コペルニクスが円運動・離心円・周転円を組み合わせた考え方を再現する教育用近似で、『天球回転論』の数表をそのまま実装したものではありません。',
  elements: ['太陽中心', '一様円運動', '離心円', '周転円', 'エカント不使用', '教育用近似'],
};

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

function polar(radius, angle) {
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function add(a, b) {
  return { x: a.x + b.x, y: a.y + b.y };
}

function epicyclePosition(body, jd) {
  const T = (jd - J2000_JD) / DAYS_PER_CENTURY;
  const a = body.a0 + body.aRate * T;
  const e = body.e0 + body.eRate * T;
  const L = (body.L0 + body.LRate * T) * Math.PI / 180;
  const peri = (body.peri0 + body.periRate * T) * Math.PI / 180;

  // First-order circular decomposition of an eccentric orbit:
  // eccentric deferent center = -3ae/2 toward perihelion,
  // epicycle radius = ae/2, rotating at 2L - peri.
  const deferentCenter = polar(-1.5 * a * e, peri);
  const deferentVector = polar(a, L);
  const epicycleCenter = add(deferentCenter, deferentVector);
  const epicycleRadius = 0.5 * a * e;
  const epicycleVector = polar(epicycleRadius, 2 * L - peri);
  const position = add(epicycleCenter, epicycleVector);

  return { position, deferentCenter, deferentRadius: a, epicycleCenter, epicycleRadius };
}

export function predict(jd) {
  const earthModel = epicyclePosition(EARTH, jd);
  const marsModel = epicyclePosition(MARS, jd);
  const earth = earthModel.position;
  const marsHeliocentric = marsModel.position;
  const geocentricMars = {
    x: marsHeliocentric.x - earth.x,
    y: marsHeliocentric.y - earth.y,
  };

  return {
    longitudeDeg: normalizeDeg(Math.atan2(geocentricMars.y, geocentricMars.x) * 180 / Math.PI),
    mars: geocentricMars,
    geometry: {
      system: 'copernicus',
      extent: 2.0,
      observer: { x: earth.x, y: earth.y },
      orbits: [
        { kind: 'circle', center: earthModel.deferentCenter, radius: earthModel.deferentRadius, label: 'EARTH ECCENTRIC DEFERENT' },
        { kind: 'circle', center: marsModel.deferentCenter, radius: marsModel.deferentRadius, label: 'MARS ECCENTRIC DEFERENT' },
        { kind: 'circle', center: earthModel.epicycleCenter, radius: earthModel.epicycleRadius, label: 'EARTH EPICYCLE' },
        { kind: 'circle', center: marsModel.epicycleCenter, radius: marsModel.epicycleRadius, label: 'MARS EPICYCLE' },
      ],
      bodies: [
        { name: 'SUN', role: 'sun', x: 0, y: 0 },
        { name: 'EARTH', role: 'earth', x: earth.x, y: earth.y },
        { name: 'MARS', role: 'mars', x: marsHeliocentric.x, y: marsHeliocentric.y },
      ],
      sightline: {
        from: { x: earth.x, y: earth.y },
        to: { x: marsHeliocentric.x, y: marsHeliocentric.y },
      },
    },
  };
}
''', encoding='utf-8')


# CI: track/check the new frontend pieces and Copernicus stages.
wf = ROOT / '.github' / 'workflows' / 'generate-reference.yml'
yml = wf.read_text(encoding='utf-8')
for anchor in ['      - "js/app-v4.js"\n', '      - "js/app-v4.js"\n']:
    pass
# Add paths in both push and pull_request sections using replacements on each occurrence.
yml = yml.replace('      - "js/app-v4.js"\n      - "js/observation-frames.js"', '      - "js/app-v3.js"\n      - "js/app-v4.js"\n      - "js/data-bootstrap.js"\n      - "js/observation-frames.js"')
yml = yml.replace('      - "models/ptolemy/**"\n      - "index.html"', '      - "models/ptolemy/**"\n      - "models/copernicus/**"\n      - "index.html"')
if 'node --check models/copernicus/02-eccentric-epicycles.js' not in yml:
    yml = replace_once(
        yml,
        '          node --check models/ptolemy/fitted-parameters-jpl.js\n',
        '          node --check models/ptolemy/fitted-parameters-jpl.js\n          node --check models/copernicus/01-heliocentric-circles.js\n          node --check models/copernicus/02-eccentric-epicycles.js\n',
        'Copernicus syntax checks',
    )
wf.write_text(yml, encoding='utf-8')

print('patched manual Ptolemy fit controls and Copernicus epicycle stage')
