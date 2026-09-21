# 保育園 勤務表作成アプリ

保育園の月次勤務表を、職員配置ルールと希望休を考慮して自動生成するWebアプリケーション。

> **道場ポータル（yonekura-dojo-portal）とは別リポジトリです。**

## 公開URL（GitHub Pages 設定後）

```
https://bimadisiwin.github.io/kinmuhyo-app/
```

## 機能

- 15名の職員管理（常勤13・パート2・看護師1）
- 勤務体系 A/B/C/D、希望休、自動生成
- 制約: 平日 保育従事者 ≥ 10人、毎日 保育士 ≥ 7人
- スマホ対応（日別ビュー・ボトムナビ）

## ローカル起動

```bash
python3 -m http.server 8000
# http://localhost:8000/index.html
```

## リポジトリの初回セットアップ

GitHub で空のリポジトリ `kinmuhyo-app` を作成後:

```bash
git clone https://github.com/bimadisiwin/yonekura-dojo-portal.git temp-clone
cd temp-clone
git checkout cursor/kinmuhyo-standalone-45a3
git remote rename origin old-origin
git remote add origin https://github.com/bimadisiwin/kinmuhyo-app.git
git push -u origin cursor/kinmuhyo-standalone-45a3:main
```

GitHub → Settings → Pages → Branch: `main` → Save

## ライセンス

MIT
