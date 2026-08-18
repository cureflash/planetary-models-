# Planetary Models

火星の見かけの運動を、実際の天体位置観測と歴史上の惑星モデルで比較する教育用Webサイトです。

現在の比較基準は理論暦ではなく、Tokyo Photoelectric Meridian Circle Catalog 1988 (Tokyo PMC88, CDS I/188) に収録された火星の個別観測です。

## 現在の実観測データ

`data/mars_observations_tokyo_pmc88.csv`

- 出典: Tokyo Photoelectric Meridian Circle Catalog 1988, Part III
- CDS catalog: `I/188`, table `planets`
- 火星観測点: 79点
- 期間: 1986-01-24 〜 1988-12-30
- 観測期間: 1070.5日（約2.93年）
- 観測日時: Julian Date (UT1)
- 元座標: 観測された見かけの地心赤経・赤緯、equinox of date
- モデル比較用の `ecliptic_lon_deg` は赤経・赤緯から座標回転で求める。太陽中心の惑星軌道モデルからは生成しない

以前使用していたCarlsberg CMC4の火星データは135点ありましたが、1986-04-19〜1986-11-29の一出現期だけでした。長期モデル比較には短すぎるため、現在のサイトでは使用していません。

## 画面

`js/app-v4.js` が現在のUIです。

### Tokyo PMC88実観測

- 地球を中央に固定
- 火星だけを表示
- 観測された方向を一定半径上に置く
- 距離は実観測に含まれないため仮定しない
- スライダーを進めると、その時点までの観測点を緑の破線で表示
- 観測間隔が大きく空く部分は線を切る

### モデル比較

- モデル軌跡: 赤い実線
- Tokyo PMC88実観測: 緑の破線
- プトレマイオスでは距離尺度が観測データと共通ではないため、各時刻のモデル火星と同じ半径に観測方向を投影して角度を比較

## プトレマイオス型モデル

小説の提示順に合わせています。

1. `models/ptolemy/01-simple-circle.js` — 単純円
2. `models/ptolemy/02-epicycle.js` — 周転円
3. `models/ptolemy/03-epicycle-eccentric.js` — 周転円＋離心円
4. `models/ptolemy/04-equant.js` — 周転円＋離心円＋エカント
5. `models/ptolemy/05-almagest-mars.js` — 『アルマゲスト』史実パラメータの別実装

`tools/fit_ptolemy_models.py` はTokyo PMC88の79観測点へ1〜4段階をフィットし、`models/ptolemy/fitted-parameters.js` を生成します。

### Tokyo PMC88 79点へのフィット結果

| 段階 | MAE | RMS | Max |
|---|---:|---:|---:|
| 単純円 | 20.298° | 24.638° | 47.489° |
| 周転円 | 7.148° | 9.069° | 32.089° |
| 周転円＋離心円 | 1.131° | 1.309° | 3.551° |
| 周転円＋離心円＋エカント | 0.294° | 0.348° | 1.111° |

短いCMC4データでは離心円段階が過剰に良くフィットしてエカントの改善が見えませんでした。2.93年のTokyo PMC88では、離心円からエカント追加による誤差低下が明瞭に確認できます。

## データ取得・再生成

`tools/fetch_tokyo_pmc88_mars.py`

CDS/VizieRミラーからTokyo PMC88 `I/188/planets` を取得し、Marsの個別観測を抽出します。730日未満のデータしか得られない場合は失敗させるため、少なくとも2年間という比較条件を自動的に保証します。

`tools/fit_ptolemy_models.py`

取得した火星実観測にプトレマイオス4段階をフィットし、JSONとJavaScriptパラメータファイルを生成します。

GitHub Actionsの `.github/workflows/generate-reference.yml` で取得、2年以上の期間確認、再フィット、JavaScript構文検査まで実行します。

## その他のモデル

- `models/tycho/01-geoheliocentric-circles.js` — 簡略ティコ体系
- `models/copernicus/01-heliocentric-circles.js` — 太陽中心・等速円運動
- `models/kepler/01-elliptic-orbits.js` — 楕円軌道モデル

これらもTokyo PMC88の実観測日時で計算し、観測された地心方向と比較します。

## ローカル実行

ES ModulesとCSVの`fetch`を使うためHTTPサーバーで配信します。

```bash
python -m http.server 8000
```
