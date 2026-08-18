# Planetary Models

火星の見かけの運動を、歴史上の惑星モデルと現代の基準データで比較する教育用Webサイトです。

プトレマイオス、ティコ・ブラーエ、コペルニクス、ケプラーの4体系を同じ2020–2030年の火星基準データと比較できます。

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
│  │  └─ 01-geoheliocentric-circles.js
│  ├─ copernicus/
│  │  └─ 01-heliocentric-circles.js
│  └─ kepler/
│     └─ 01-elliptic-orbits.js
└─ tools/
   ├─ generate_reference.py
   └─ fit_ptolemy_models.py
```

各体系の計算は別々のJavaScriptファイルです。`js/app.js` は共通UI、モデルファイルの切り替え、可視化、誤差計算だけを担当します。

## プトレマイオス型モデル

4段階は機能フラグで切り替える1本のプログラムではなく、それぞれ独立したJavaScriptです。

1. `models/ptolemy/01-simple-circle.js` — 地球中心の一様円運動
2. `models/ptolemy/02-eccentric.js` — 離心円
3. `models/ptolemy/03-epicycle.js` — 離心円＋周転円
4. `models/ptolemy/04-equant.js` — 離心円＋周転円＋エカント

数値定数は2020–2030年の基準トラックへのフィット値で、『アルマゲスト』の原表をそのまま転記したものではありません。

## ティコ・ブラーエ

`models/tycho/01-geoheliocentric-circles.js`

地球を静止させ、太陽が地球を回り、火星が太陽を回る簡略ティコモデルです。円運動の半径と位相を簡略コペルニクスモデルと対応させているため、地球から見た火星の方向はコペルニクス円軌道モデルと一致します。

## コペルニクス

`models/copernicus/01-heliocentric-circles.js`

地球と火星が太陽を中心とする円軌道を一定角速度で回る簡略モデルです。歴史上のコペルニクス体系に含まれる細かな周転円等を完全再現したものではなく、「太陽中心＋等速円運動」という構造を比較するためのモデルです。

## ケプラー

`models/kepler/01-elliptic-orbits.js`

地球と火星を太陽を焦点とする楕円軌道に置き、ケプラー方程式を解いて軌道上の非等速運動を計算します。基準データ生成式そのものとの自己一致を避けるため、軌道の形状・向きはJ2000値に固定し、基準データ側に含まれる軌道要素の経年変化は入れていません。

## 火星基準データ

`data/mars_reference_2020_2030.csv` は2020-01-01から2030-01-01までの日次データです。

JPL Solar System Dynamics の「Approximate Positions of the Planets」に掲載されている1800–2050年用の軌道要素と計算法から生成しています。

Source: https://ssd.jpl.nasa.gov/planets/approx_pos.html

JPLは高精度用途にはHorizonsを推奨しています。このCSVは生の望遠鏡観測値でもHorizonsの高精度出力でもなく、静的サイト上で再現可能な教育用基準トラックです。

## 2020–2030年の全期間誤差

| Model | MAE | RMS | Max |
|---|---:|---:|---:|
| プトレマイオス：単純円 | 28.32° | 31.56° | 53.79° |
| プトレマイオス：離心円 | 22.95° | 25.88° | 45.35° |
| プトレマイオス：周転円 | 1.56° | 2.15° | 6.97° |
| プトレマイオス：エカント | 0.24° | 0.30° | 0.93° |
| ティコ：等速円 | 7.43° | 9.53° | 32.67° |
| コペルニクス：等速円 | 7.43° | 9.53° | 32.67° |
| ケプラー：固定楕円 | 0.015° | 0.019° | 0.055° |

ティコとコペルニクスの値が同じになるのは実装ミスではなく、この簡略条件では両者の地心火星ベクトルが数学的に同じになるためです。

## ローカル実行

ES ModulesとCSVの`fetch`を使うため、`index.html`を直接開くのではなくHTTPサーバーで配信します。

```bash
python -m http.server 8000
```
