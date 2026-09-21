# 勤務表作成アプリ（Kinmuhyo App）

月次の勤務表を作成・管理するためのWebアプリケーション（たたき台）。

## 機能

- **スタッフ管理** — 名前・部署の登録・編集・削除
- **月次勤務表** — スタッフ×日付のグリッド表示
- **勤務区分** — 出勤 / 休日 / 有給 / 半休 / 欠勤 / 遅刻 / 早退
- **集計** — 出勤日数・有給日数・休日数の自動集計
- **祝日表示** — 日本の祝日をカレンダーに反映
- **CSV出力** — 勤務表データのエクスポート
- **印刷** — 印刷用レイアウト
- **データ保存** — ブラウザの localStorage に自動保存

## 起動方法

```bash
python3 -m http.server 8000
# ブラウザで http://localhost:8000/index.html を開く
```

`file://` でも動作しますが、HTTP サーバー経由を推奨します。

## 使い方

1. 左サイドバーでスタッフを追加
2. 年月を選択して勤務表を表示
3. セルをクリックして勤務区分を選択
4. 「CSV出力」でデータをダウンロード

## 技術構成

- フレームワークなし（Vanilla HTML / CSS / JavaScript）
- ビルド不要
- データ永続化: localStorage

## 独立リポジトリとして公開する場合

GitHub で新規リポジトリ（例: `kinmuhyo-app`）を作成後、以下のコマンドでこのブランチの内容をプッシュできます:

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
