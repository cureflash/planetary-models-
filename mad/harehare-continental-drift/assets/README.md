# 素材一覧

このフォルダには、AviUtlで読み込む画像・図版を置きます。

## 推奨ファイル名

```text
assets/
├─ wegener_portrait.png
├─ world_map.png
├─ south_america.png
├─ africa.png
├─ pangaea.png
├─ fossil_distribution.png
├─ matching_geology.png
├─ glacial_evidence.png
├─ continental_drift.png
├─ mid_ocean_ridge.png
├─ magnetic_stripes.png
├─ ocean_floor_age.png
├─ subduction.png
├─ plate_map.png
├─ plate_vectors.png
└─ audio/
   └─ README.md
```

ファイル名は `storyboard/timeline.csv` の `primary_asset` と対応させます。

## 素材の扱い

- GitHubへ入れる画像は、自作・パブリックドメイン・再利用条件を満たす素材に限定する。
- 外部素材を使った場合は `credits/credits.md` に出典とライセンスを記録する。
- 楽曲・市販映像・権利処理できない画像はコミットしない。
- ウェゲナー写真など歴史資料も、画像ごとの権利状態を確認してから追加する。

## 切り抜き

昔のMADらしい見た目を優先する場合でも、元画像は高解像度のまま保存し、AviUtl側で縮小・荒らし・急拡大を行います。素材自体を不可逆に劣化させる必要はありません。
