# メンテナンス方法

このファイルは、更新手順と運用上の注意点をまとめたものです。  
プロジェクト全体の概要やディレクトリ構成は `README.md` を参照してください。

## 基本ルール

- `index.html` と `en/index.html` は生成物なので直接編集しません
- `sitemap.xml`、`robots.txt`、`manifest.webmanifest` も生成物なので直接編集しません
- `data/site-meta.json` は自動管理ファイルなので手作業では編集しません
- `locales/` は UI 文言、`data/` は内容データとして使い分けます
- `data/*.jsonl` は新しいものほど先頭に並べます。新しい項目は**ファイルの先頭に追記**します
- 公開内容に関わる変更をした場合は、編集後に `npm run build` を実行します

## 推奨手順

通常の更新は、次の順で行います。

1. 元ファイルを編集する
2. `npm run format:data` を実行する
3. `npm run validate` を実行する
4. 公開内容に関わる変更なら `npm run build` を実行する
5. `npm run smoke` を実行する
6. ブラウザで日本語版と英語版の両方を確認する
7. 言語切替とページ内ナビゲーションが崩れていないか確認する

まとめて確認したい場合は、次を使います。

```bash
npm run check
```

## 更新内容ごとの編集先

### 1. プロフィール本文やリンクを更新する

- `data/profile.json`

言語が分かれる値は `ja` / `en` を持つオブジェクトで管理します。  
`metaDescription` を追加すると、検索結果や共有用の説明文を言語ごとに設定できます。  
公開 HTML に反映するには `npm run build` が必要です。

更新後の基本コマンド:

```bash
npm run format:data
npm run validate
npm run build
```

### 2. 学歴・受賞・経歴を更新する

- `data/education.jsonl`
- `data/awards.jsonl`
- `data/career.jsonl`

各ファイルは 1 行 1 レコードの `jsonl` 形式です。  
言語が分かれる値は `ja` / `en` を持つオブジェクトで管理します。  
各レコードの `id` が欠けている場合は、`npm run format:data` が自動で補完します。

新しい項目はファイルの先頭に追記します。  
表示は日付の降順で並びますが、日付が同じ項目どうしは `jsonl` の記載順を保つため、**上にある方が新しいものとして表示されます**。

継続中の学歴や経歴は、`end: null` と `isCurrent: true` で表現します。

```json
{"id":"education-2025-04-xxxxxxxx","start":"2025-04","end":null,"isCurrent":true,"affiliation":{"ja":"...","en":"..."}}
```

受賞には、必要に応じて `rate` を追加できます。

```json
{"id":"award-2026-03-xxxxxxxx","title":{"ja":"優秀賞","en":"Excellence Award"},"organization":{"ja":"...","en":"..."},"date":"2026-03","rate":"1/32","url":"","note":{"ja":"","en":""}}
```

編集後は、`npm run format:data` と `npm run validate` を実行してから `npm run build` を実行してください。  
`npm run format:data` は軽い表記揺れを検出した場合に警告を出しますが、自動修正はしません。

### 3. 業績を更新する

- `data/publications.jsonl`

業績データは日英共通です。  
分類表示は `type` と `review` をもとに `scripts/static-page-content.js` 側で行います。  
自分の著者名を強調したい場合は、`selfAuthorIndices` で著者配列中の index を指定します。

新しい項目はファイルの先頭に追記します。  
並び順は `year` の降順 → `month` の降順 → `jsonl` の記載順（上にあるものが新しい）です。

`month` は発表月・出版月を表す 1〜12 の数値で、任意項目です。並び替えにのみ使い、表示には出ません。  
同じ `year` の中で `month` を持たない項目は、`month` を持つ項目より後ろに並びます。

```json
{"id":"publication-2026-xxxxxxxx","authors":[...],"title":"...","venue":"...","year":2026,"month":10,"type":"conference","review":true,"url":"","note":""}
```

```json
{"id":"publication-2026-xxxxxxxx","authors":["Taro A","Haruto Yoshida","Jiro C"],"selfAuthorIndices":[1],"title":"..."}
```

`npm run format:data` では、欠けている `id` の補完と key 順の整形を行います。  
`npm run validate` では、`id`、`type`、`review`、`year`、`selfAuthorIndices` の整合性も確認します。  
公開 HTML に反映するには `npm run build` が必要です。

### 4. UI 文言を更新する

- `locales/ja.json`
- `locales/en.json`

対象例:

- セクション名
- `最終更新` / `Last updated`
- 空状態メッセージ
- 業績グループ名

`npm run validate` では、日本語・英語ロケール間でキー構造が一致しているかも確認します。  
公開 HTML と埋め込みロケールに反映するには `npm run build` が必要です。

### 5. レイアウトや HTML 構造を更新する

- `templates/page.html`
- 必要に応じて `styles.css`

テンプレートを更新した場合は、`npm run build` が必要です。  
`build` は内部で `validate` を先に実行するため、データやロケールが壊れている場合は生成前に止まります。

### 6. 公開 URL や共有メタデータを更新する

- `site.config.json`

主な項目:

- `siteUrl`
- `siteName`
- `shortName`
- `socialImagePath`
- `themeColorLight`
- `themeColorDark`
- `backgroundColor`

この設定をもとに、`canonical`、`hreflang`、OGP、Twitter Card、構造化データ、`sitemap.xml`、`robots.txt`、`manifest.webmanifest` が生成されます。  
変更後は `npm run validate` と `npm run build` を実行してください。

### 7. 最終更新日を管理する

- `data/site-meta.json`

このファイルは `build` 時に自動更新されます。  
公開用ソースファイル群のハッシュが変わったときだけ、`lastUpdated` がその日の `YYYY-MM-DD` に更新されます。  
手作業では編集しません。

### 8. JavaScript の挙動を更新する

- `main.js`
- `scripts/*.js`

対象例:

- データの読み込み方法
- 画面表示後の補助動作
- ハッシュ付き遷移
- 言語切替
- テーマ切替

この変更だけなら通常は HTML の再生成は不要です。  
ただし、`scripts/static-page-content.js` や `scripts/build-pages.mjs` を編集した場合、またはテンプレート構造も変えた場合は `npm run build` を実行してください。

## `npm run build` が必要なケース

次の変更をしたときは、`npm run build` を実行してください。

- `data/` 配下を編集した
- `locales/` 配下を編集した
- `templates/page.html` を編集した
- `site.config.json` を編集した
- `scripts/static-page-content.js` を編集した
- `scripts/build-pages.mjs` を編集した
- 日英ページの相対パス構成を変えた
- `data/site-meta.json` が自動更新された

次の変更だけなら、通常は再生成不要です。

- `styles.css` の編集
- `main.js` の編集
- `scripts/` 配下のうち、生成処理に関係しないファイルの編集

## デプロイ

GitHub Pages へのデプロイは `.github/workflows/pages.yml` で行います。  
`main` ブランチへの push、または GitHub Actions の手動実行で workflow が動作します。`npm run build`、`npm run smoke`、`npm run test:e2e` がすべて成功した場合にのみ、生成物を Pages に公開します。

GitHub 側では、Pages の source を `GitHub Actions` に設定してください。

## 追加の確認コマンド

主要な操作フローまで確認したい場合は、次を使います。

```bash
npm run test:e2e
```

- Playwright で言語切替、テーマ切替の保持、ページ内ナビ、JS 無効時のアンカー移動を確認します

表示速度を測るには、次を使います。

```bash
npm run benchmark
```

- ローカルサーバーを自動で起動し、Playwright で `/` と `/en/` を開いて計測します
- `FCP`、`DOMContentLoaded`、`load`、アプリ固有の `readyTime` を出力します

`playwright` が未導入なら、先に依存を入れてブラウザをセットアップしてください。

```bash
npm install -D playwright
npx playwright install chromium
```

GitHub Actions では Playwright の Chromium を workflow 側で自動セットアップします。

## 注意点

- `data/` や `locales/` を編集しただけでも、公開反映には `npm run build` が必要です
- 生成物を直接編集すると、次回ビルド時に上書きされます
- 更新後は、少なくとも日本語版と英語版の両方を目視確認してください
