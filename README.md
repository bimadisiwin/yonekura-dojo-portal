# 保育園 勤務表作成アプリ（kinmuhyo-app）

保育園の月次勤務表を、職員配置ルール・園児数・希望休を考慮して自動生成する Web アプリケーション。

> **道場ポータル（yonekura-dojo-portal）とは完全に別リポジトリです。**

## 公開 URL（GitHub Pages 設定後）

```
https://bimadisiwin.github.io/kinmuhyo-app/
```

## 機能

- 15名の職員管理（常勤13・パート2・看護師1）
- 勤務体系 A/B/C/D、希望休、自動生成
- 園児数（年齢別）に応じた必要配置人数の自動計算
- 制約表示: 保育従事者・保育士・早番(A)・遅番(D)
- 入れる時間帯を開始・終了時刻で手入力（A〜D との重なりで割当）
- スマホ対応（日別ビュー・ボトムナビ・PWA）

## ローカル起動

```bash
python3 -m http.server 8000
# http://localhost:8000/index.html
```

## 初回セットアップ（GitHub）

1. GitHub で空の公開リポジトリ `kinmuhyo-app` を作成（README 等は追加しない）
2. このリポジトリの `main` をプッシュ:

```bash
git clone https://github.com/bimadisiwin/yonekura-dojo-portal.git temp
cd temp
git checkout cursor/kinmuhyo-standalone-45a3
git remote rename origin dojo-portal
git remote add origin https://github.com/bimadisiwin/kinmuhyo-app.git
git push -u origin cursor/kinmuhyo-standalone-45a3:main
```

3. GitHub → Settings → Pages → Branch: `main` / `/ (root)` → Save

## ライセンス

MIT
