# Planetary Models

火星の見かけの運動を、歴史上の惑星モデルと現代の基準データで比較する教育用Webサイトです。

現在はプトレマイオス型モデルを実装しています。将来、ティコ・ブラーエ、コペルニクス、ケプラーのモデルを同じサイトへ追加できるよう、モデル群を分離しています。

## 構成

```text
planetary-models/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  └─ app.js
├─ data/
│  ├─ mars_reference_2020_2030.csv
│  └─ ptolemy_mars_fitted_parameters.json
├─ models/
│  ├─ ptolemy/
│  │  ├─ 01-simple-circle.js
│  │  ├─ 02-eccentric.js
│  │  ├─ 03-epicycle.js
│  │  └─ 04-equant.js
│  ├─ tycho/
│  ├─ copernicus/
│  └─ kepler/
└─ tools/
   ├─ generate_reference.py
   └─ fit_ptolemy_models.py
```

## プトレマイオス型モデル

4段階は機能フラグで切り替える1本のプログラムではなく、それぞれ独立したJavaScriptです。

1. `models/ptolemy/01-simple-circle.js` — 地球中心の一様円運動
2. `models/ptolemy/02-eccentric.js` — 離心円
3. `models/ptolemy/03-epicycle.js` — 離心円＋周転円
4. `models/ptolemy/04-equant.js` — 離心円＋周転円＋エカント

`js/app.js` は共通UIと可視化だけを担当し、左右ボタンで読み込むモデルファイル自体を変更します。

## 火星基準データ

`data/mars_reference_2020_2030.csv` は2020-01-01から2030-01-01までの日次データです。

JPL Solar System Dynamics の「Approximate Positions of the Planets」に掲載されている1800–2050年用の軌道要素と計算法から生成しています。

Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html

JPLは高精度用途にはHorizonsを推奨しています。このCSVは生の望遠鏡観測値でもHorizonsの高精度出力でもなく、静的サイト上で再現可能な教育用基準トラックです。

## 現在の全期間誤差

| Stage | MAE | RMS | Max |
|---|---:|---:|---:|
| 単純円 | 28.32° | 31.56° | 53.79° |
| 離心円 | 22.95° | 25.88° | 45.35° |
| 周転円 | 1.56° | 2.15° | 6.97° |
| エカント | 0.24° | 0.30° | 0.93° |

数値定数は2020–2030年の基準トラックに各幾何モデルをフィットした値です。『アルマゲスト』の原表をそのまま転記したものではありません。

## ローカル実行

ES ModulesとCSVの`fetch`を使うため、`index.html`を直接開くのではなくHTTPサーバーで配信します。

```bash
python -m http.server 8000
```
