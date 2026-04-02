# research-profile-homepage

研究者プロフィール用の静的サイトです。  
日本語版と英語版の 2 ページを生成し、そのまま静的ホスティングで公開できる構成です。

## 概要

- 公開ページは `index.html` と `en/index.html` の 2 ページ構成です
- ページ内容は `data/` と `locales/` をもとにビルド時に生成されます
- クライアントサイドの JavaScript は、言語切替、テーマ切替、ナビゲーションなどの補助機能に限定しています

## ディレクトリ構成

- `data/`
  - プロフィール、学歴、業績、受賞、経歴などの内容データを管理します
- `locales/`
  - 日本語・英語の UI 文言を管理します
- `templates/`
  - 共通 HTML テンプレートを配置します
- `scripts/`
  - データ整形、検証、ビルド、スモークテストなどのスクリプトを配置します
- `assets/`
  - アイコン、アバター画像などの静的ファイルを配置します
- `styles.css`
  - 共通スタイルを定義します
- `main.js`
  - 初期化処理を定義します

## 生成物

次のファイルは生成物です。直接編集せず、元ファイルを編集した上で再生成してください。

- `index.html`
- `en/index.html`
- `sitemap.xml`
- `robots.txt`
- `manifest.webmanifest`

## どこを編集するか

- プロフィール本文やリンクを更新する場合
  - `data/profile.json`
- 学歴・経歴・受賞・業績を更新する場合
  - `data/*.jsonl`
- UI 文言を更新する場合
  - `locales/ja.json`
  - `locales/en.json`
- レイアウトや HTML 構造を更新する場合
  - `templates/page.html`
  - 必要に応じて `styles.css`
- JavaScript の挙動を更新する場合
  - `main.js`
  - `scripts/*.js`

## 基本コマンド

```bash
npm run format:data
npm run validate
npm run build
npm run smoke
npm run test:e2e
npm run check
```

- `format:data`
  - `data/` 配下の JSON / JSONL を整形します
- `validate`
  - `data/`、`locales/`、設定ファイルの整合性を検証します
- `build`
  - 検証を行った上でページと補助ファイルを生成します
- `smoke`
  - 生成物の最低限の整合性を確認します
- `check`
  - `build` と `smoke` をまとめて実行します
- `test:e2e`
  - Playwright で主要な画面操作を確認します

## デプロイ

GitHub Pages へのデプロイは GitHub Actions で行います。  
`main` ブランチへの push、または手動実行で `.github/workflows/pages.yml` が動作します。`build`、`smoke`、`test:e2e` がすべて成功した場合にのみ、生成物を Pages に公開します。

GitHub 側では、Pages の source を `GitHub Actions` に設定してください。

## 補足

詳細な更新手順、各データ形式、運用上の注意点は `MAINTENANCE.md` を参照してください。
