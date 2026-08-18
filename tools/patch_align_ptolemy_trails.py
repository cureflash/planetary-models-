from pathlib import Path

app = Path('js/app-v4.js')
text = app.read_text(encoding='utf-8')

old = '''function modelHistoryPtolemy() {
  const out = [];
  if (selectedIndex < 1) return out;
  const start = observations[0].jd;
  const stop = observations[selectedIndex].jd;
  for (let jd = start; jd <= stop; jd += 1) {
    const p = currentModule.predict(jd);
    out.push({ jd, point: p.mars });
  }
  const final = currentModule.predict(stop);
  if (!out.length || out.at(-1).jd !== stop) out.push({ jd: stop, point: final.mars });
  return out;
}
'''
new = '''function modelHistoryPtolemy() {
  const out = [];
  for (let i = 0; i <= selectedIndex; i++) {
    const p = currentPredictions[i];
    out.push({ jd: observations[i].jd, point: p.mars });
  }
  return out;
}
'''
if text.count(old) != 1:
    raise SystemExit(f'expected one modelHistoryPtolemy block, found {text.count(old)}')
text = text.replace(old, new)

old_note = "els.orbitNote.textContent = '赤い実線がモデル、緑の破線がUSNO W2J00実観測です。実観測は35日を超える欠測区間をつなぎません。観測データは方向だけなので、プトレマイオスでは各時刻のモデル火星と同じ半径上へ観測方向を投影して比較します。';"
new_note = "els.orbitNote.textContent = '赤い実線がモデル、緑の破線がUSNO W2J00実観測です。両方とも同じW2J00観測日時だけを結び、35日を超える欠測区間はつなぎません。観測データは方向だけなので、プトレマイオスでは各時刻のモデル火星と同じ半径上へ観測方向を投影して角度を比較します。';"
if text.count(old_note) != 1:
    raise SystemExit(f'expected one orbit note, found {text.count(old_note)}')
text = text.replace(old_note, new_note)

old_draw = "drawPolyline(ctx, map, modelTrail, { color: '#ff8a65', lineWidth: 2.25 });"
new_draw = "drawPolyline(ctx, map, modelTrail, { color: '#ff8a65', lineWidth: 2.25, maxGapDays: 35 });"
if text.count(old_draw) != 1:
    raise SystemExit(f'expected one Ptolemy model trail draw, found {text.count(old_draw)}')
text = text.replace(old_draw, new_draw)

old_chart = "if (!isObservationMode()) plotSeries(ctx, predU, xOf, yOf, '#ff8a65', 2, false, Infinity);"
new_chart = "if (!isObservationMode()) plotSeries(ctx, predU, xOf, yOf, '#ff8a65', 2, false, 35);"
if text.count(old_chart) != 1:
    raise SystemExit(f'expected one model chart line, found {text.count(old_chart)}')
text = text.replace(old_chart, new_chart)

app.write_text(text, encoding='utf-8')

index = Path('index.html')
html = index.read_text(encoding='utf-8')
old_version = './js/app-v4.js?v=usno-w2j00-sky-1'
new_version = './js/app-v4.js?v=usno-w2j00-sky-2'
if html.count(old_version) != 1:
    raise SystemExit(f'expected one app-v4 cache key, found {html.count(old_version)}')
index.write_text(html.replace(old_version, new_version), encoding='utf-8')

print('patched app-v4 Ptolemy comparison trails and cache key')
