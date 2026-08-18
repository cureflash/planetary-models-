from pathlib import Path

index = Path('index.html')
html = index.read_text(encoding='utf-8')

panel = '''
    <section id="datasetPanel" class="parameter-switch card" aria-label="比較に使うデータ">
      <div>
        <span class="kicker">DATA SOURCE</span>
        <p>実際の天体位置観測と、最初に使っていたJPL軌道要素由来の2020–2030年計算基準値を切り替えます。</p>
      </div>
      <div class="segmented" role="group" aria-label="比較データ">
        <button class="parameter-button active" data-dataset="w2j00" aria-pressed="true">USNO W2J00実観測</button>
        <button class="parameter-button" data-dataset="jpl" aria-pressed="false">JPL計算基準値 2020–2030</button>
      </div>
    </section>
'''
marker = '    </header>\n\n    <nav class="theory-tabs"'
if 'id="datasetPanel"' not in html:
    if marker not in html:
        raise SystemExit('dataset panel insertion marker not found')
    html = html.replace(marker, '    </header>\n' + panel + '\n    <nav class="theory-tabs"', 1)

canvas_marker = '        <canvas id="orbitCanvas" aria-label="火星の実観測または選択中の惑星モデル"></canvas>'
if 'id="referenceOrbitCanvas"' not in html:
    if canvas_marker not in html:
        raise SystemExit('orbit canvas marker not found')
    html = html.replace(
        canvas_marker,
        canvas_marker + '\n        <canvas id="referenceOrbitCanvas" hidden aria-hidden="true"></canvas>',
        1,
    )

old_scripts = '''  <script type="module" src="./js/app-v5.js?v=1"></script>
  <script type="module" src="./js/observation-frames.js?v=usno-w2j00-sky-2"></script>'''
new_scripts = '  <script type="module" src="./js/data-bootstrap.js?v=dataset-switch-1"></script>'
if old_scripts in html:
    html = html.replace(old_scripts, new_scripts, 1)
elif new_scripts not in html:
    raise SystemExit('script replacement marker not found')

index.write_text(html, encoding='utf-8')

bootstrap = r'''const params = new URLSearchParams(window.location.search);
const dataset = params.get('dataset') === 'jpl' ? 'jpl' : 'w2j00';
window.__PLANETARY_DATASET__ = dataset;

const datasetButtons = [...document.querySelectorAll('[data-dataset]')];
datasetButtons.forEach(button => {
  const active = button.dataset.dataset === dataset;
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
  button.addEventListener('click', () => {
    if (button.dataset.dataset === dataset) return;
    const next = new URL(window.location.href);
    next.searchParams.set('dataset', button.dataset.dataset);
    window.location.assign(next.toString());
  });
});

const firstTheoryTab = document.querySelector('.theory-tab[data-theory="observation"]');
const observationFramePanel = document.querySelector('#observationFramePanel');
const lead = document.querySelector('.hero .lead');
const fittedButton = document.querySelector('[data-ptolemy-mode="fitted"]');
const ptolemyPanelText = document.querySelector('#ptolemyParameterPanel p');
const methodology = document.querySelector('.methodology');

if (dataset === 'jpl') {
  if (observationFramePanel) observationFramePanel.hidden = true;
  if (firstTheoryTab) firstTheoryTab.textContent = 'JPL計算基準値';
  if (lead) lead.textContent = 'JPLの近似惑星位置用軌道要素から計算した2020–2030年の火星基準値と、プトレマイオス、ティコ、コペルニクス、ケプラーのモデルを比較する。';
  if (fittedButton) fittedButton.textContent = 'JPL計算値フィット';
  if (ptolemyPanelText) ptolemyPanelText.textContent = '同じプトレマイオス型の幾何を、JPL計算基準値へのフィット値と『アルマゲスト』の史実値で切り替えます。';
  if (methodology) {
    methodology.innerHTML = `
      <span class="kicker">METHOD</span>
      <h3>このページで何を比較しているか</h3>
      <p>このモードは実観測ではありません。最初にこのサイトで使用していた <code>data/mars_reference_2020_2030.csv</code> を復元し、2020年1月1日から2030年1月1日まで1日刻みの計算基準値を表示します。</p>
      <p>基準値はJPL Solar System Dynamicsが公開する1800–2050年用の「Approximate Positions of the Planets」の軌道要素から、地球と火星の太陽中心位置を計算し、その差から地心位置・地心黄経・地心距離を求めたものです。望遠鏡による生の観測値ではありません。</p>
      <p>このモードでは距離と太陽中心座標も計算値として持つため、地球固定の見かけの軌跡だけでなく、太陽中心の地球・火星位置も表示できます。</p>
      <p>プトレマイオスの「フィット」は、この2020–2030年計算基準値に合わせて以前求めたパラメータへ自動的に切り替わります。USNO W2J00モードではW2J00実観測へのフィット値へ戻ります。</p>`;
  }
  await import('./app-v3.js?v=jpl-dataset-2');
} else {
  if (firstTheoryTab) firstTheoryTab.textContent = 'USNO W2J00実観測';
  await import('./app-v5.js?v=w2j00-dataset-2');
  await import('./observation-frames.js?v=w2j00-dataset-2');
}
'''
Path('js/data-bootstrap.js').write_text(bootstrap, encoding='utf-8')

app = Path('js/app-v3.js')
text = app.read_text(encoding='utf-8')
replacements = {
    "{ id: 'observation', label: '観測データ', files: [] }": "{ id: 'observation', label: 'JPL計算基準値', files: [] }",
    "name: '地球固定・火星観測データ'": "name: '地球固定・JPL火星計算基準値'",
    "shortName: '観測データ'": "shortName: 'JPL計算値'",
    "description: '地球を画面中央に固定し、基準データの地心座標に従って火星だけを動かします。日付スライダーを動かすと、火星が実際に辿った部分だけを軌跡として表示します。'": "description: '地球を画面中央に固定し、JPL軌道要素から計算した地心座標に従って火星だけを動かします。日付スライダーを動かすと、計算上の火星軌跡がその日まで伸びます。'",
    "elements: ['地球固定', '火星のみ表示', '地心座標', '基準データ']": "elements: ['地球固定', '火星のみ表示', '地心座標', 'JPL計算値', '2020–2030']",
    "els.stage.textContent = 'OBSERVATION / GEOCENTRIC';": "els.stage.textContent = 'JPL / COMPUTED GEOCENTRIC';",
    "els.orbitKicker.textContent = 'OBSERVED MOTION';": "els.orbitKicker.textContent = 'COMPUTED REFERENCE';",
    "els.orbitTitle.textContent = '地球を固定した火星の動き';": "els.orbitTitle.textContent = '地球を固定したJPL計算上の火星の動き';",
    "els.orbitNote.textContent = '地球を中央に固定し、現代基準データの火星だけを表示します。破線の軌跡はスライダー位置までに実際に辿った部分だけを描き、先頭では軌跡を表示しません。';": "els.orbitNote.textContent = '地球を中央に固定し、JPL軌道要素から計算した火星の地心位置を表示します。緑の破線はスライダー位置までの計算軌跡です。これは実観測ではありません。';",
    "els.chartTitle.textContent = '火星の地心黄経：観測データ';": "els.chartTitle.textContent = '火星の地心黄経：JPL計算基準値';",
    "els.orbitKicker.textContent = 'MODEL + REFERENCE';": "els.orbitKicker.textContent = 'MODEL + JPL COMPUTED REFERENCE';",
    "els.orbitTitle.textContent = 'モデルと現代基準の火星';": "els.orbitTitle.textContent = 'モデルとJPL計算基準値';",
    "els.orbitNote.textContent = '赤い実線がモデルの火星軌跡、緑の破線が現代基準データの軌跡です。どちらもスライダー位置までの履歴だけを表示します。プトレマイオスでは距離尺度が異なるため、現代基準はモデルと同じ半径上に方向だけを重ねます。';": "els.orbitNote.textContent = '赤い実線がモデルの火星軌跡、緑の破線がJPL計算基準値です。どちらもスライダー位置までの履歴だけを表示します。プトレマイオスでは距離尺度が異なるため、JPL基準値はモデルと同じ半径上に方向だけを重ねます。';",
    "els.chartTitle.textContent = '火星の地心黄経：モデル vs 基準データ';": "els.chartTitle.textContent = '火星の地心黄経：モデル vs JPL計算基準値';",
    "els.referenceTerm.textContent = '現代基準値';": "els.referenceTerm.textContent = 'JPL計算基準値';",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'app-v3 replacement marker not found: {old[:80]}')
    text = text.replace(old, new, 1)

old_header = """  els.name.textContent = m.name;
  els.description.textContent = m.description;
  els.elements.innerHTML = m.elements.map(x => `<span>${x}</span>`).join('');
  els.source.textContent = m.sourceFile;
"""
new_header = """  const jplText = value => String(value)
    .replaceAll('USNO W2J00の火星実観測', 'JPL計算基準値')
    .replaceAll('USNO W2J00実観測', 'JPL計算基準値')
    .replaceAll('USNO W2J00', 'JPL計算基準値');
  els.name.textContent = m.name;
  els.description.textContent = jplText(m.description);
  els.elements.innerHTML = m.elements.map(x => `<span>${jplText(x)}</span>`).join('');
  els.source.textContent = m.sourceFile;
"""
if old_header not in text:
    raise SystemExit('app-v3 model header marker not found')
text = text.replace(old_header, new_header, 1)
app.write_text(text, encoding='utf-8')

print('enabled W2J00/JPL dataset switch')
