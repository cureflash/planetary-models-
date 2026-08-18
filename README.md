# Planetary Models

火星の見かけの運動を、実際の天体位置観測と歴史上の惑星モデルで比較する教育用Webサイトです。

現在の比較基準は、JPL軌道要素から生成した理論トラックではなく、Carlsberg Automatic Meridian Circle が測定した火星の位置です。

## 現在の実観測データ

`data/mars_observations_carlsberg.csv`

- 出典: Carlsberg Meridian Catalog の惑星観測表
- 現在取得できた火星データ: CMC4 (`I/147`, object code `99040`)
- 観測点: 135点
- 期間: 1986-04-19 〜 1986-11-29
- 元データ: 見かけの地心赤経・赤緯、equinox of date
- `quality_flag='*'` は内部誤差の大きい観測としてフィットから除外
- モデル比較用の `ecliptic_lon_deg` は赤経・赤緯から座標回転で求める。太陽中心の惑星軌道モデルからは生成しない

CMC4〜CMC8の公開惑星観測表を取得してMarsコード `99040` を調べたところ、今回の取得対象でMarsが収録されていたのはCMC4だけでした。CMC5〜CMC8の表自体も取得して確認しています。

## 画面

`js/app-v4.js` が現在のUIです。

### Carlsberg実観測

- 地球を中央に固定
- 火星だけを表示
- 観測された方向を一定半径上に置く
- 距離は実観測に含まれないため仮定しない
- スライダー先頭では軌跡なし
- スライダーを進めると、その時点までの観測点だけを緑の破線で追加
- 観測間隔が大きく空く部分は線を切り、連続観測のようには表示しない

### モデル比較

- モデル軌跡: 赤い実線
- Carlsberg実観測: 緑の破線
- 軌跡はスライダー位置までだけ表示
- プトレマイオスでは距離尺度が観測データと共通ではないため、各時刻のモデル火星と同じ半径に観測方向を投影して角度を比較

## プトレマイオス型モデル

小説の提示順に合わせています。

1. `models/ptolemy/01-simple-circle.js` — 単純円
2. `models/ptolemy/02-epicycle.js` — 周転円
3. `models/ptolemy/03-epicycle-eccentric.js` — 周転円＋離心円
4. `models/ptolemy/04-equant.js` — 周転円＋離心円＋エカント
5. `models/ptolemy/05-almagest-mars.js` — 『アルマゲスト』史実パラメータの別実装

`tools/fit_ptolemy_models.py` はCarlsberg実観測の日時と地心黄経に対して、上の1〜4段階をフィットします。生成値は `models/ptolemy/fitted-parameters.js` に書き出され、ブラウザ側の各モデルが直接読み込みます。

### CMC4 135点へのフィット結果

| 段階 | MAE | RMS | Max |
|---|---:|---:|---:|
| 単純円 | 23.053° | 25.415° | 39.945° |
| 周転円 | 1.560° | 1.778° | 4.256° |
| 周転円＋離心円 | 0.00297° | 0.00364° | 0.01037° |
| 周転円＋離心円＋エカント | 0.00320° | 0.00409° | 0.01329° |

注意: このCarlsberg火星データは1986年の一回の火星出現期に集中しています。そのため自由パラメータの多い離心円・エカント段階は非常に強くフィットでき、エカントの優位性を長期的に検証するデータセットとしては不十分です。上表を「プトレマイオス体系一般の長期精度」と解釈しないでください。

## データ取得・再生成

`tools/fetch_carlsberg_mars.py`

CMC4〜CMC8のCDS/VizieRミラー上の惑星観測表を取得し、Marsコード `99040` を抽出します。公開表の固定幅データから観測日時・赤経・赤緯・品質フラグを読み取ります。

`tools/fit_ptolemy_models.py`

取得したCarlsberg火星観測にプトレマイオス4段階をフィットし、JSONとJavaScriptパラメータファイルを生成します。

GitHub Actionsの `.github/workflows/generate-reference.yml` で取得、再フィット、JavaScript構文検査まで実行します。

## その他のモデル

- `models/tycho/01-geoheliocentric-circles.js` — 簡略ティコ体系
- `models/copernicus/01-heliocentric-circles.js` — 太陽中心・等速円運動
- `models/kepler/01-elliptic-orbits.js` — 楕円軌道モデル

これらもCarlsbergの実観測日時で計算し、観測された地心方向と比較します。

## ローカル実行

ES ModulesとCSVの`fetch`を使うためHTTPサーバーで配信します。

```bash
python -m http.server 8000
```
