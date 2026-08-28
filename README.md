# Study Quiz Studio

Study Quiz Studio は、問題JSONまたは画像付きの問題パッケージをブラウザへ保存し、演習・即時採点・誤答復習を行う個人用の学習アプリです。このリポジトリは、サーバーやデータベースに依存せず、**GitHub Pagesで静的公開できる構成**に整理されています。

> 問題セット、画像、挑戦履歴および演習中の進行状況は、利用したブラウザの IndexedDB に保存されます。GitHub Pagesで公開しても、これらのデータが他の端末や他のブラウザへ同期されることはありません。

## 動作要件

| 項目 | 要件 |
|---|---|
| Node.js | 20 以降を推奨 |
| パッケージマネージャー | pnpm（`package.json` の指定バージョンを利用） |
| 配信環境 | GitHub Pages または任意の静的ホスティング |

## ローカルでの実行

```bash
pnpm install
pnpm dev
```

ブラウザで `http://localhost:3000` を開きます。GitHub Pages向けの静的成果物は次のコマンドで作成できます。

```bash
pnpm run check
pnpm run build:pages
```

生成先は `dist/public` です。Viteの `base` は相対パス（`./`）に設定済みのため、`https://<アカウント>.github.io/<リポジトリ名>/` のようなサブパス配信でもJavaScriptとCSSを正しく読み込めます。

## GitHub Pagesへの公開

このリポジトリには、`main` ブランチへのプッシュを契機にビルドと公開を実行する GitHub Actions ワークフロー（`.github/workflows/deploy.yml`）を含めています。GitHubで新しいリポジトリを作成してソースをプッシュした後、リポジトリの **Settings → Pages** を開き、公開元を **GitHub Actions** に設定してください。その後に `main` へプッシュすると、ワークフローが `dist/public` を公開します。

```bash
git init
git add .
git commit -m "Prepare Study Quiz Studio for GitHub Pages"
git branch -M main
git remote add origin https://github.com/<アカウント名>/<リポジトリ名>.git
git push -u origin main
```

公開URLと実行状況は、GitHubの **Actions** タブまたは **Settings → Pages** から確認できます。GitHub Pagesの設定およびカスタムドメインの詳細は、[GitHub Pages公式ドキュメント](https://docs.github.com/pages)を参照してください。

## ルーティングと直接アクセス

GitHub Pagesにはアプリ用のサーバー側ルーティングがないため、ワークフローはビルド後に `index.html` を `404.html` としても配置します。アプリ側は任意のパスをホーム画面として扱うため、プロジェクトページ配下での再読み込みや直接アクセスにも対応します。

## ディレクトリ構成

| パス | 内容 |
|---|---|
| `client/src/` | Reactアプリケーション本体 |
| `client/public/` | 小さな静的設定ファイル用の領域 |
| `.github/workflows/deploy.yml` | GitHub Pagesへの自動ビルド・公開 |
| `vite.config.ts` | 相対パス配信対応のVite設定 |
| `dist/public/` | `pnpm run build:pages` で生成される公開用成果物（Git管理外） |

## 手動で配信する場合

GitHub Actionsを使わずに公開する場合は、`pnpm run build:pages` の後に `dist/public` へ `.nojekyll` を作成し、`index.html` を `404.html` に複製してください。そのフォルダを静的サイトとして配信します。

```bash
pnpm run build:pages
touch dist/public/.nojekyll
cp dist/public/index.html dist/public/404.html
```
