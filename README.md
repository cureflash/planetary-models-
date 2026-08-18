# Planetary Models

火星の見かけの運動を、地球固定の基準データと歴史上の惑星モデルで比較する教育用Webサイトです。

観測データ、プトレマイオス、ティコ・ブラーエ、コペルニクス、ケプラーを同じ2020–2030年の火星基準データで確認できます。

## 構成

```text
planetary-models/
├─ index.html
├─ css/
│  └─ style.css
├─ js/
│  ├─ app.js
│  └─ app-v2.js
├─ data/
│  ├─ mars_reference_2020_2030.csv
│  └─ ptolemy_mars_fitted_parameters.json
├─ models/
│  ├─ ptolemy/
│  │  ├─ 01-simple-circle.js
│  │  ├─ 02-epicycle.js
│  │  ├─ 03-epicycle-eccentric.js
│  │  ├─ 04-equant.js
│  │  └─ 05-almagest-mars.js
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

各体系の計算は別々のJavaScriptファイルです。現在の画面は `js/app-v2.js` が共通UI、モデルファイルの切り替え、可視化、誤差計算を担当します。

## 観測データモード

「観測データ」タブではモデルを仮定しません。

- 地球を画面中央に固定
- `data/mars_reference_2020_2030.csv` の地心座標 `geo_x_au`, `geo_y_au` に従って火星だけを表示
- 日付スライダーで火星の順行・留・逆行を追跡
- 太陽や地球の公転軌道は表示しない

小説では、前日の観測で単純な円運動モデルを否定した後、東先生が用意したプログラムで長期間の火星データとプトレマイオス型モデルを比較する流れを想定しています。

## プトレマイオス型モデル

プトレマイオス欄には2つのパラメータセットがあります。

### 現代フィット

2020–2030年の基準トラックに各段階をフィットした教育用モデルです。小説内の提示順に合わせています。

1. `models/ptolemy/01-simple-circle.js` — 地球中心の一様円運動
2. `models/ptolemy/02-epicycle.js` — 周転円のみ追加
3. `models/ptolemy/03-epicycle-eccentric.js` — 周転円＋離心円
4. `models/ptolemy/04-equant.js` — 周転円＋離心円＋エカント

この4本の数値定数は『アルマゲスト』の原表そのものではありません。

### 『アルマゲスト』史実値

`models/ptolemy/05-almagest-mars.js`

火星の完成形モデルに、古代の数値を入れた別プログラムです。現代データへの再フィットは行いません。

主要値：

- 離心円半径: `60`
- 地球から離心円中心まで: `6`
- 地球からエカントまで: `12`
- 周転円半径: `39;30 = 39.5`
- Nabonassar元期の平均経度: `3;32°`
- Nabonassar元期の周転円異常: `327;13°`
- Nabonassar元期の遠地点: `106;40°`
- 火星の平均日運動（経度）: `0;31,26,36,53,51,33°/day`
- 火星の平均日運動（周転円異常）: `0;27,41,40,19,20,58°/day`
- 歳差: `1° / 100年`

元期は1 Thoth, 1 Nabonassar（747 BCE年2月26日、Alexandria平均地方時の正午）として扱います。この古代モデルを2020–2030年まで約2700年以上そのまま外挿するため、現在の空での誤差は大きくなります。

Historical references:

- G. J. Toomer, *Ptolemy's Almagest*, Princeton University Press.
- Dennis Duke, "Ptolemy's Treatment of the Outer Planets".
- Dennis Duke, "Mean Motions in Ptolemy's Planetary Hypotheses".

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
| プトレマイオス：単純円（現代フィット） | 28.32° | 31.56° | 53.79° |
| プトレマイオス：周転円のみ（現代フィット） | 6.69° | 8.47° | 33.34° |
| プトレマイオス：周転円＋離心円（現代フィット） | 1.56° | 2.15° | 6.97° |
| プトレマイオス：周転円＋離心円＋エカント（現代フィット） | 0.24° | 0.30° | 0.93° |
| プトレマイオス：『アルマゲスト』史実値を現代まで外挿 | 約10.05° | 約10.97° | 約28.81° |
| ティコ：等速円 | 7.43° | 9.53° | 32.67° |
| コペルニクス：等速円 | 7.43° | 9.53° | 32.67° |
| ケプラー：固定楕円 | 0.015° | 0.019° | 0.055° |

『アルマゲスト』史実値の行は、古代の元期・平均運動をそのまま2020年代まで外挿した教育的比較です。プトレマイオスが自分の時代に10°程度ずれていたという意味ではありません。

ティコとコペルニクスの値が同じになるのは実装ミスではなく、この簡略条件では両者の地心火星ベクトルが数学的に同じになるためです。

## ローカル実行

ES ModulesとCSVの`fetch`を使うため、`index.html`を直接開くのではなくHTTPサーバーで配信します。

```bash
python -m http.server 8000
```
