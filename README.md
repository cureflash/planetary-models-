# Planetary Models

火星の見かけの運動を、実際の天体位置観測と歴史上の惑星モデルで比較する教育用Webサイトです。

現在の比較基準は理論暦ではなく、USNO W2J00 Transit Circle Catalog（VizieR I/334）に収録された火星の実観測です。

## 現在の実観測データ

`data/mars_observations_usno_w2j00.csv`

- 出典: USNO W2J00 Transit Circle Catalog
- VizieR catalog: `I/334`, file `w2j00sol.dat`
- 火星記録: 746件
- うち赤経・赤緯が両方そろった方向測定: 623点
- 使用期間: 1986-01-21 〜 1995-06-13
- 観測期間: 3429.7日（約9.39年）
- 最大欠測: 約582.5日（1989-01-27 → 1990-09-02）
- 元座標: 観測された見かけの地心赤経・赤緯、true equator/equinox of date
- モデル比較用の `ecliptic_lon_deg` は赤経・赤緯から座標回転で求める。太陽中心の惑星軌道モデルから生成しない

実観測は連続データではありません。サイトでは35日を超える観測間隔を線で結ばず、観測していない期間を補間しません。

Carlsberg CMC1–8も再調査しましたが、実際に確認できたMars観測はCMC4の138点に限られ、長期比較には不足したため採用していません。Tokyo PMC88も長い欠測があるため、現在の比較基準から外しています。

## 画面

`js/app-v4.js` が現在のUIです。

### USNO W2J00実観測

- 「天動説表示・地球固定」と「地動説表示・太陽固定」を切り替え可能
- 地球固定表示では、火星の観測方向だけを一定半径上に置く
- 太陽固定表示では、地球を日付に応じて動かし、実測した火星方向を地球から伸びる視線として描く
- 火星までの距離は実観測に含まれないため、太陽中心の火星位置を実測値として生成しない
- スライダーを進めると、その時点までの観測点だけを表示
- 35日を超える欠測区間は観測線を切る

### モデル比較

- モデル軌跡: 赤い実線
- USNO W2J00実観測: 緑の破線
- プトレマイオスでは距離尺度が観測データと共通ではないため、各時刻のモデル火星と同じ半径に観測方向を投影して角度を比較

## プトレマイオス型モデル

小説の提示順に合わせています。

1. `models/ptolemy/01-simple-circle.js` — 単純円
2. `models/ptolemy/02-epicycle.js` — 周転円
3. `models/ptolemy/03-epicycle-eccentric.js` — 周転円＋離心円
4. `models/ptolemy/04-equant.js` — 周転円＋離心円＋エカント
5. `models/ptolemy/05-almagest-mars.js` — 『アルマゲスト』史実パラメータの別実装

`tools/fit_ptolemy_models.py` はW2J00の623方向測定へ1〜4段階をフィットし、`models/ptolemy/fitted-parameters.js` を生成します。

### USNO W2J00 623点へのフィット結果

| 段階 | MAE | RMS | Max |
|---|---:|---:|---:|
| 単純円 | 28.982° | 31.886° | 53.848° |
| 周転円 | 9.404° | 11.955° | 32.407° |
| 周転円＋離心円 | 3.081° | 3.484° | 5.871° |
| 周転円＋離心円＋エカント | 0.340° | 0.414° | 1.031° |

長期間の実観測にすると、周転円だけでは逆行を定性的に再現できても誤差が残り、離心円、エカントの追加で段階的に改善することが分かります。

## データ取得・再生成

`tools/fetch_usno_w2j00_mars.py`

VizieR/CDSミラーからUSNO W2J00 `I/334/w2j00sol.dat` を取得し、Marsの実観測を抽出します。完全な赤経・赤緯がそろった観測だけをサイト用CSVへ保存します。

`tools/fit_ptolemy_models.py`

取得した火星実観測にプトレマイオス4段階をフィットし、JSONとJavaScriptパラメータファイルを生成します。

GitHub Actionsの `.github/workflows/generate-reference.yml` で取得、期間確認、再フィット、JavaScript構文検査まで実行します。

## その他のモデル

- `models/tycho/01-geoheliocentric-circles.js` — 簡略ティコ体系
- `models/copernicus/01-heliocentric-circles.js` — 太陽中心・等速円運動
- `models/kepler/01-elliptic-orbits.js` — 楕円軌道モデル

これらもW2J00の実観測日時で計算し、観測された地心方向と比較します。

## ローカル実行

ES ModulesとCSVの`fetch`を使うためHTTPサーバーで配信します。

```bash
python -m http.server 8000
```
