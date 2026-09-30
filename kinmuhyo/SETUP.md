# 独立リポジトリ kinmuhyo-app のセットアップ

## 1. GitHub で新規リポジトリを作成

1. https://github.com/new
2. Repository name: **`kinmuhyo-app`**
3. Public、**README 等は追加しない**
4. Create repository

## 2. コードをプッシュ

```bash
git clone https://github.com/bimadisiwin/yonekura-dojo-portal.git
cd yonekura-dojo-portal
git checkout cursor/kinmuhyo-standalone-45a3
git remote rename origin dojo-portal
git remote add origin https://github.com/bimadisiwin/kinmuhyo-app.git
git push -u origin cursor/kinmuhyo-standalone-45a3:main
```

## 3. GitHub Pages

Settings → Pages → Branch: **main** / **/ (root)** → Save

公開 URL: **https://bimadisiwin.github.io/kinmuhyo-app/**

## 4. 先方への共有

```
https://bimadisiwin.github.io/kinmuhyo-app/
```
