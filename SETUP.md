# 独立リポジトリのセットアップ手順

道場ポータルと完全に分離して運用するための手順です。

## 1. GitHub で新規リポジトリを作成

1. https://github.com/new を開く
2. Repository name: `kinmuhyo-app`
3. Public を選択
4. **README 等は追加しない**（空のリポジトリ）
5. Create repository

## 2. コードをプッシュ

```bash
git clone https://github.com/bimadisiwin/yonekura-dojo-portal.git
cd yonekura-dojo-portal
git checkout cursor/kinmuhyo-standalone-45a3
git remote rename origin dojo-portal
git remote add origin https://github.com/bimadisiwin/kinmuhyo-app.git
git push -u origin cursor/kinmuhyo-standalone-45a3:main
```

## 3. GitHub Pages を有効化

1. `kinmuhyo-app` リポジトリ → **Settings** → **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **/ (root)**
4. Save

数分後、次のURLで公開されます:

**https://bimadisiwin.github.io/kinmuhyo-app/**

## 4. 先方への共有URL

```
https://bimadisiwin.github.io/kinmuhyo-app/
```

スマホ: ブラウザで開き → 「ホーム画面に追加」
