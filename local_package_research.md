# ローカル問題パッケージの調査メモ

## フォルダ選択

`<input type="file" webkitdirectory multiple>` は、選択されたフォルダ以下のファイルをフラットな `FileList` として返し、各 `File` の `webkitRelativePath` から元の相対パスを復元できる。MDNでは、最新デバイス・ブラウザにおいて2025年8月以降に利用可能な機能としている。[1]

## 専用ディレクトリピッカー

`showDirectoryPicker()` は、選択ディレクトリの `FileSystemDirectoryHandle` を返す。HTTPSのセキュアコンテキストとユーザー操作が必要で、MDNは実験的かつ限定的な可用性としている。したがって本アプリでは、利便性を高める補助経路に留め、`webkitdirectory` とZIPを基本の互換経路とする。[2]

## ローカル画像の表示

選択された画像ファイルは `URL.createObjectURL(file)` でブラウザ内限定のURLとして表示できる。不要になったURLは `URL.revokeObjectURL()` で解放する。オブジェクトURLは再読み込み後や別端末では再利用できないため、永続保存の画像URLとして扱わない。[3]

## ZIPアーカイブ

ブラウザ標準のCompression Streams APIはgzip・deflate系を対象とし、一般的なZIPコンテナをそのまま展開する用途には専用のクライアント側ライブラリを用いるのが実用的である。`fflate` または `JSZip` を候補とし、初回実装では依存が軽い `fflate` を優先する。[4] [5]

## 結論：現行アプリとの適合性

この案は**現行の静的アプリと非常に相性がよい**。問題セットと画像をブラウザ上で読み込み、画像は `URL.createObjectURL()` で表示すれば、教材データをサーバーへ送信せずに出題できる。現在のJSON単体の取り込みを残したまま、次の三経路を併用する構成を推奨する。

| 取り込み方法 | 使いどころ | 互換性・実装上の位置付け |
|---|---|---|
| JSON単体 | 画像なしの問題セット | 現在の基本経路として維持する。 |
| フォルダ選択／フォルダD&D | 編集中の教材を素早く試す | `quiz.json` と `images/` をそのまま扱える。フォルダ選択は `webkitdirectory` を基本にし、対応ブラウザでは専用ピッカーも補助利用する。 |
| ZIPアーカイブ | 配布・バックアップ・全ブラウザ向け | **画像付き教材の主経路として推奨する。** 一つのファイルなのでD&Dとファイル選択の両方で扱いやすい。 |

## 推奨パッケージ構成

```text
biology-basics/
├── quiz.json
└── images/
    ├── cell-01.webp
    └── choice-a.png
```

フォルダとZIP内のJSONでは、外部URLではなくパッケージ内の相対パスを使う。

```json
{
  "id": "q-cell-01",
  "type": "single_choice",
  "question": "図の細胞小器官を選んでください。",
  "image": {
    "path": "images/cell-01.webp",
    "alt": "細胞の模式図"
  }
}
```

取り込み時は、フォルダまたはZIPから `path → File/Blob` の対応表を作り、出題中だけ `URL.createObjectURL()` を生成する。画面を離れる際は `URL.revokeObjectURL()` で解放する。JSON単体の `image.url` はオンライン教材用の補助形式として残し、`image.path` はローカル教材専用として扱うと整理しやすい。

## 重要な保存上の制約

現行アプリは問題セットをローカルストレージに保存している。ここへオブジェクトURLだけを保存しても、再読み込み後には有効ではない。画像付きセットをブラウザ再起動後も保存したい場合は、**JSON・画像Blob・メタデータをIndexedDBへ保存する変更**が必要である。これはサーバー不要で、静的サイトのまま実現できる。

「完全にローカル」を、サーバーへ教材データを送らない意味で使うなら、上記の構成で達成できる。インターネット接続なしでもアプリ画面自体を開きたい場合だけ、別途PWAのキャッシュ機能を追加する。

## 安全性と容量のルール

ZIP展開前に合計サイズ・ファイル数・展開後サイズの上限を確認し、`../` を含むパスを拒否する。受け付ける画像形式はWebP、PNG、JPEGに限定し、JSONはパッケージ内に1つだけとする。初期値としては、ZIP 30MB以下、画像1枚2MB以下、展開後60MB以下が扱いやすい。

## 実装順

1. JSONスキーマへ任意の `image.path` と `image.alt` を追加する。
2. `webkitdirectory` とフォルダD&Dで相対パスを読む。
3. `fflate` でZIPを展開し、同じ内部取り込み処理へ渡す。
4. IndexedDBへ画像付きセットを保存し、再読み込み後も復元する。
5. 必要に応じてPWA化し、アプリ本体もオフラインで起動可能にする。

## 参照先

[1]: https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory "MDN: HTMLInputElement.webkitdirectory"
[2]: https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker "MDN: Window.showDirectoryPicker"
[3]: https://developer.mozilla.org/en-US/docs/Web/API/URL/createObjectURL_static "MDN: URL.createObjectURL"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API "MDN: Compression Streams API"
[5]: https://github.com/101arrowz/fflate "fflate repository"
