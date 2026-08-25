/**
 * Midnight Index design reminder: keep quiz data strict, quiet, and extensible.
 * This module validates the supplied version-1 JSON format and keeps question
 * rendering/scoring independent from the surrounding interface.
 */

export const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "short_answer",
  "fill_blank",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];
export type Choice = { id: string; text: string };
export type UserAnswer = string[] | boolean;

export type QuizQuestion = {
  id: string;
  type: QuestionType;
  category?: string;
  difficulty?: number;
  tags?: string[];
  question: string;
  choices: Choice[];
  answer: string[] | boolean;
  explanation?: string;
};

export type QuizDocument = {
  title: string;
  version: 1;
  settings: {
    shuffleQuestions: boolean;
    shuffleChoices: boolean;
    showExplanation: boolean;
  };
  questions: QuizQuestion[];
};

export type ReviewAttempt = {
  id: string;
  timestamp: string;
  score: number;
  total: number;
  wrongIds: string[];
};

export type Attempt = {
  id: string;
  timestamp: string;
  score: number;
  total: number;
  wrongIds: string[];
  reviews?: ReviewAttempt[];
};

export type QuizSetRecord = {
  key: string;
  importedAt: string;
  data: QuizDocument;
  attempts: Attempt[];
  practiceSettings?: {
    shuffleQuestions: boolean;
    shuffleChoices: boolean;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export function getJsonErrorMessage(error: unknown, source: string): string {
  if (!(error instanceof SyntaxError)) return "JSONの形式が正しくありません。";
  const match = error.message.match(/position\s+(\d+)/i);
  if (!match) return `JSONを読み込めませんでした：${error.message}`;
  const position = Number(match[1]);
  const line = source.slice(0, position).split("\n").length;
  return `JSONの${line}行目付近に記述エラーがあります。`;
}

export function validateQuiz(value: unknown): QuizDocument {
  if (!isRecord(value)) throw new Error("ルートはオブジェクトである必要があります。");
  if (typeof value.title !== "string" || !value.title.trim()) {
    throw new Error("title は空でない文字列で指定してください。");
  }
  if (value.version !== 1) {
    throw new Error("version はサポート対象の 1 を指定してください。");
  }
  if (!isRecord(value.settings)) {
    throw new Error("settings が見つかりません。");
  }
  const { shuffleQuestions, shuffleChoices, showExplanation } = value.settings;
  if (
    typeof shuffleQuestions !== "boolean" ||
    typeof shuffleChoices !== "boolean" ||
    typeof showExplanation !== "boolean"
  ) {
    throw new Error("settings の各項目は true または false で指定してください。");
  }
  if (!Array.isArray(value.questions) || value.questions.length === 0) {
    throw new Error("questions には1問以上の配列を指定してください。");
  }

  const questionIds = new Set<string>();
  const questions = value.questions.map((item, index) => {
    if (!isRecord(item)) throw new Error(`${index + 1}問目がオブジェクトではありません。`);
    const label = `${index + 1}問目`;
    if (typeof item.id !== "string" || !item.id) throw new Error(`${label}の id がありません。`);
    if (questionIds.has(item.id)) throw new Error(`${label}の id「${item.id}」が重複しています。`);
    questionIds.add(item.id);
    if (!QUESTION_TYPES.includes(item.type as QuestionType)) {
      throw new Error(`${label}の type が未対応です。`);
    }
    if (typeof item.question !== "string" || !item.question.trim()) {
      throw new Error(`${label}の question がありません。`);
    }
    if (item.difficulty !== undefined && (typeof item.difficulty !== "number" || !Number.isInteger(item.difficulty) || item.difficulty < 1 || item.difficulty > 5)) {
      throw new Error(`${label}の difficulty は1〜5の整数で指定してください。`);
    }
    if (item.tags !== undefined && !hasStringArray(item.tags)) {
      throw new Error(`${label}の tags は文字列の配列で指定してください。`);
    }

    const type = item.type as QuestionType;
    const choicesRaw = item.choices ?? [];
    if (!Array.isArray(choicesRaw)) throw new Error(`${label}の choices は配列で指定してください。`);
    const choices = choicesRaw.map((choice, choiceIndex) => {
      if (!isRecord(choice) || typeof choice.id !== "string" || typeof choice.text !== "string" || !choice.id) {
        throw new Error(`${label}の${choiceIndex + 1}番目の選択肢が正しくありません。`);
      }
      return { id: choice.id, text: choice.text };
    });
    const choiceIds = new Set(choices.map((choice) => choice.id));
    if (choiceIds.size !== choices.length) throw new Error(`${label}の選択肢IDが重複しています。`);

    if (type === "true_false") {
      if (typeof item.answer !== "boolean") throw new Error(`${label}の answer は true または false で指定してください。`);
    } else {
      if (!hasStringArray(item.answer) || item.answer.length === 0) {
        throw new Error(`${label}の answer は1つ以上の文字列で指定してください。`);
      }
      if ((type === "single_choice" || type === "multiple_choice") && choices.length === 0) {
        throw new Error(`${label}の choices がありません。`);
      }
      if (type === "single_choice" && item.answer.length !== 1) {
        throw new Error(`${label}の single_choice は正解を1つだけ指定してください。`);
      }
      if ((type === "single_choice" || type === "multiple_choice") && item.answer.some((answer) => !choiceIds.has(answer))) {
        throw new Error(`${label}の answer が存在しない選択肢IDを参照しています。`);
      }
    }

    return {
      id: item.id,
      type,
      category: typeof item.category === "string" ? item.category : undefined,
      difficulty: typeof item.difficulty === "number" ? item.difficulty : undefined,
      tags: hasStringArray(item.tags) ? item.tags : undefined,
      question: item.question,
      choices,
      answer: item.answer as string[] | boolean,
      explanation: typeof item.explanation === "string" ? item.explanation : undefined,
    };
  });

  return {
    title: value.title.trim(),
    version: 1,
    settings: { shuffleQuestions, shuffleChoices, showExplanation },
    questions,
  };
}

export function normalizeText(text: string) {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isCorrect(question: QuizQuestion, answer: UserAnswer | undefined) {
  if (answer === undefined) return false;
  if (question.type === "true_false") return answer === question.answer;
  if (!Array.isArray(answer) || !Array.isArray(question.answer)) return false;
  if (question.type === "short_answer" || question.type === "fill_blank") {
    const response = normalizeText(answer[0] ?? "");
    const validAnswers = question.answer as string[];
    return validAnswers.some((validAnswer) => normalizeText(validAnswer) === response);
  }
  const correctChoiceIds = question.answer as string[];
  return answer.length === correctChoiceIds.length && answer.every((id) => correctChoiceIds.includes(id));
}

export function shuffled<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

export function formatDate(timestamp: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
