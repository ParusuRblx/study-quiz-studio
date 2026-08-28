# Study Quiz Studio：問題セットJSON生成プロンプト

以下の指示をそのまま生成AIへ渡し、Study Quiz Studioで読み込める問題セットJSONを作成できます。

```text
あなたはStudy Quiz Studio用の問題セットJSONを作成する教材設計者です。
以下の制約を必ず守り、説明文やMarkdownを付けずに、有効なJSONだけを出力してください。

【必須ルール】
- ルートは title、version、settings、questions を持つオブジェクトにする。
- version は必ず 1 にする。
- settings は shuffleQuestions、shuffleChoices、showExplanation の3つの真偽値を持つ。
- 各問題には重複しない id、type、question、answer を含める。
- type は single_choice、multiple_choice、true_false、short_answer、fill_blank のいずれかにする。
- single_choice と multiple_choice は choices 配列を持ち、各選択肢には id と text を入れる。
- single_choice の answer は正解の選択肢idを1つだけ含む配列にする。
- multiple_choice の answer は正解の選択肢idをすべて含む配列にする。
- true_false の answer は true または false にする。
- short_answer と fill_blank の answer は正解として許容する文字列を1つ以上含む配列にする。
- 解説が必要なら explanation に平易な説明を入れる。

【画像を使う場合】
- 画像付きZIPでは、quiz.json と images/ フォルダを用意する。
- 問題または選択肢の image は以下の形式にする。
  "image": { "path": "images/ファイル名.webp", "alt": "画像の内容を説明する代替テキスト" }
- path は images/ から始め、PNG、JPEG、WebPだけを指定する。
- JSON単体で外部画像を使う場合は、path の代わりに https URL を使う。
  "image": { "url": "https://example.com/image.webp", "alt": "画像の内容を説明する代替テキスト" }

【作成依頼】
科目: {科目}
対象: {学年・レベル}
単元: {単元}
問題数: {問題数}
出題形式の希望: {形式}
画像利用: {あり・なし}
追加要望: {任意}
```

## 最小テンプレート

```json
{
  "title": "問題セット名",
  "version": 1,
  "settings": {
    "shuffleQuestions": false,
    "shuffleChoices": false,
    "showExplanation": true
  },
  "questions": [
    {
      "id": "q-01",
      "type": "single_choice",
      "question": "問題文を入力してください。",
      "choices": [
        { "id": "a", "text": "選択肢A" },
        { "id": "b", "text": "選択肢B" }
      ],
      "answer": ["a"],
      "explanation": "解説を入力してください。"
    }
  ]
}
```
