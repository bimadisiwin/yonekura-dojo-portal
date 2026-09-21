# 保育園 勤務表作成アプリ

保育園の月次勤務表を、職員配置ルールと希望休を考慮して自動生成するWebアプリケーション。

## 前提条件（初期データ）

| 項目 | 内容 |
|------|------|
| 職員総数 | 15名 |
| 常勤 | 13名（うち看護師1名は保育従事者にカウントしない） |
| パート | 2名（月10日 9-17 / 週4日 8-17） |
| 勤務体系 | A 7-16 / B 8-17 / C 9-18 / D 10-19 |
| 制約 | 平日 保育従事者 ≥ 10人、毎日 保育士 ≥ 7人 |

## 機能

- **職員管理** — 常勤/パート、保育士/看護師/保育従事者、資格、パート勤務条件
- **希望休** — 職員ごとに月単位で日付指定（カンマ区切り）
- **自動生成** — 制約と希望休を考慮した勤務表の一括作成
- **制約チェック** — 日別の保育従事者数・保育士数をフッター行とパネルで表示
- **手動修正** — セルクリックで A/B/C/D/休/有給 を個別変更
- **CSV出力・印刷**

## スマホで使う

1. **GitHub Pages で公開**（推奨）  
   リポジトリ Settings → Pages → Branch を `cursor/kinmuhyo-app-prototype-45a3` に設定  
   スマホブラウザで **https://bimadisiwin.github.io/yonekura-dojo-portal/** を開く

2. **ホーム画面に追加**（iPhone / Android）  
   ブラウザの「ホーム画面に追加」でアプリのように起動できます

3. **スマホ向けUI**  
   - **日別**タブ … 1日分をリスト表示（タップで勤務変更）  
   - **月間**タブ … 従来の一覧表（左右スワイプ）  
   - **職員**タブ … 職員・希望休の編集  
   - **操作**タブ … 自動生成・CSV出力  
   - 右下 **⚡** ボタン … ワンタップ自動生成

## 起動方法（PC）

```bash
python3 -m http.server 8000
# http://localhost:8000/index.html
```

## 使い方

1. サイドバーで職員を確認・追加（クリックで希望休を編集）
2. 年月を選択
3. **⚡ 自動生成** をクリック
4. 制約パネル（緑=OK / 赤=未達）とフッター行で人数を確認
5. 必要に応じてセルを手動調整

## ファイル構成

```
index.html        … UI
css/style.css     … スタイル
js/constants.js   … 定数・シードデータ（15名）
js/scheduler.js   … 自動生成エンジン
js/app.js         … アプリ本体
```

## 独立リポジトリとして公開する場合

GitHub で新規リポジトリを作成後:

```bash
git clone https://github.com/bimadisiwin/yonekura-dojo-portal.git
cd yonekura-dojo-portal
git checkout cursor/kinmuhyo-app-prototype-45a3
git remote rename origin old-origin
git remote add origin https://github.com/bimadisiwin/kinmuhyo-app.git
git push -u origin cursor/kinmuhyo-app-prototype-45a3:main
```

## ライセンス

MIT
