const params = new URLSearchParams(window.location.search);
const dataset = params.get('dataset') === 'jpl' ? 'jpl' : 'w2j00';
window.__PLANETARY_DATASET__ = dataset;

function setText(element, value) {
  if (element && element.textContent !== value) element.textContent = value;
}

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
const readingsNote = document.querySelector('.readings .note');
const dateKicker = document.querySelector('.date-control .kicker');

function replaceJplText(value) {
  return String(value)
    .replaceAll('USNO W2J00の火星実観測', 'JPL計算基準値')
    .replaceAll('USNO W2J00実観測', 'JPL計算基準値')
    .replaceAll('USNO W2J00', 'JPL計算基準値')
    .replaceAll('現代基準データ', 'JPL計算基準値')
    .replaceAll('現代基準値', 'JPL計算基準値');
}

function normalizeJplLabels() {
  if (dataset !== 'jpl') return;
  setText(firstTheoryTab, 'JPL計算基準値');

  const description = document.querySelector('#modelDescription');
  if (description) {
    setText(
      description,
      replaceJplText(description.textContent)
        .replaceAll('実際に辿った', '計算上の')
        .replaceAll('火星観測データ', 'JPL火星計算基準値')
    );
  }

  document.querySelectorAll('#modelElements span').forEach(span => {
    setText(span, replaceJplText(span.textContent).replaceAll('観測データ', 'JPL計算基準値'));
  });

  const orbitNote = document.querySelector('#orbitNote');
  if (orbitNote) setText(orbitNote, replaceJplText(orbitNote.textContent).replaceAll('実際に辿った', '計算上の'));

  const chartTitle = document.querySelector('#chartTitle');
  if (chartTitle) setText(chartTitle, replaceJplText(chartTitle.textContent).replaceAll('観測データ', 'JPL計算基準値'));

  const referenceTerm = document.querySelector('#referenceTerm');
  if (referenceTerm) setText(referenceTerm, replaceJplText(referenceTerm.textContent));

  const modelName = document.querySelector('#modelName');
  if (modelName?.textContent === '地球固定・火星観測データ') setText(modelName, '地球固定・JPL火星計算基準値');

  const stage = document.querySelector('#stageLabel');
  if (stage?.textContent === 'OBSERVATION / GEOCENTRIC') setText(stage, 'JPL / COMPUTED GEOCENTRIC');

  const orbitKicker = document.querySelector('#orbitKicker');
  if (orbitKicker?.textContent === 'OBSERVED MOTION') setText(orbitKicker, 'COMPUTED REFERENCE');

  const orbitTitle = document.querySelector('#orbitTitle');
  if (orbitTitle?.textContent === '地球を固定した火星の動き') setText(orbitTitle, '地球を固定したJPL計算上の火星の動き');
}

if (dataset === 'jpl') {
  if (observationFramePanel) observationFramePanel.hidden = true;
  setText(firstTheoryTab, 'JPL計算基準値');
  setText(lead, 'JPLの近似惑星位置用軌道要素から計算した2020–2030年の火星基準値と、プトレマイオス、ティコ、コペルニクス、ケプラーのモデルを比較する。');
  setText(fittedButton, 'JPL計算値フィット');
  setText(ptolemyPanelText, '同じプトレマイオス型の幾何を、JPL計算基準値へのフィット値と『アルマゲスト』の史実値で切り替えます。');
  setText(readingsNote, 'このモードの火星位置・地心黄経・距離はJPLの近似惑星軌道要素から計算した基準値です。望遠鏡による実観測値ではありません。');
  setText(dateKicker, 'REFERENCE DATE');

  if (methodology) {
    methodology.innerHTML = `
      <span class="kicker">METHOD</span>
      <h3>このページで何を比較しているか</h3>
      <p>このモードは実観測ではありません。最初にこのサイトで使用していた <code>data/mars_reference_2020_2030.csv</code> を復元し、2020年1月1日から2030年1月1日まで1日刻みの計算基準値を表示します。</p>
      <p>基準値はJPL Solar System Dynamicsが公開する1800–2050年用の「Approximate Positions of the Planets」の軌道要素から、地球と火星の太陽中心位置を計算し、その差から地心位置・地心黄経・地心距離を求めたものです。望遠鏡による生の観測値ではありません。</p>
      <p>このモードでは距離と太陽中心座標も計算値として持つため、地球固定の見かけの軌跡だけでなく、太陽中心の地球・火星位置も表示できます。</p>
      <p>プトレマイオスの「フィット」は、この2020–2030年計算基準値に合わせて以前求めたパラメータへ自動的に切り替わります。USNO W2J00モードではW2J00実観測へのフィット値へ戻ります。</p>`;
  }

  const observer = new MutationObserver(normalizeJplLabels);
  observer.observe(document.querySelector('#app'), { subtree: true, childList: true, characterData: true });
  await import('./app-v3.js?v=jpl-dataset-5');
  normalizeJplLabels();
} else {
  setText(firstTheoryTab, 'USNO W2J00実観測');
  await import('./app-v5.js?v=w2j00-dataset-5');
  await import('./observation-frames.js?v=w2j00-dataset-5');
}
