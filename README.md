# Study Quiz Studio

問題JSONを保存して、出題・採点・復習を行う個人用学習スタジオ。React + Vite製の静的サイトで、データはブラウザの `localStorage` にのみ保存されます(サーバー通信なし)。

## GitHub Pages への公開

### 方法A: GitHub Actions で自動デプロイ(推奨・設定済み)

`.github/workflows/deploy.yml` を同梱しています。

1. このリポジトリを GitHub に push する(ブランチ名は `main`)
2. リポジトリの **Settings → Pages** で **Source** を `GitHub Actions` に設定
3. `main` に push すると自動的にビルドされ、`https://<ユーザー名>.github.io/<リポジトリ名>/` に公開されます

### 方法B: 手動ビルドしてアップロード

```bash
pnpm install
pnpm run build:pages   # dist/public に静的ファイルが生成される
```

`dist/public` の中身を `gh-pages` ブランチ、またはリポジトリの `docs/` フォルダに置いて Pages の Source として指定してください。その際 `dist/public/.nojekyll` を追加し、`index.html` を `404.html` としてもコピーしておくと安全です(直リンク・リロード対策)。

## ローカル開発

```bash
pnpm install
pnpm run dev
```

## 補足

- `server/` は Express による静的ファイル配信のみで、GitHub Pages では不要です(Pages 自体が静的ホスティングのため)。Node環境で自前ホストしたい場合は `pnpm run build && pnpm run start` を使用してください。
- ルーティングはどのサブパスに配置されても Home が表示されるよう調整済みです(`client/src/App.tsx`)。
