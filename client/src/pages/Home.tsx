/** Restrained dark study workspace with clear answer feedback and session-based reviews. */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileJson,
  History,
  Menu,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  type Attempt,
  type Choice,
  type QuizQuestion,
  type QuizSetRecord,
  type ReviewAttempt,
  type UserAnswer,
  formatDate,
  getJsonErrorMessage,
  isCorrect,
  shuffled,
  validateQuiz,
} from "@/lib/quiz";

const STORAGE_KEY = "study-quiz-studio.quiz-sets.v1";
type Screen = "library" | "quiz" | "result";
type SessionItem = { question: QuizQuestion; choices: Choice[] };
type PracticeSettings = { shuffleQuestions: boolean; shuffleChoices: boolean };

const rate = (result?: { score: number; total: number } | null) =>
  result && result.total ? Math.round((result.score / result.total) * 100) : 0;
const typeName: Record<QuizQuestion["type"], string> = {
  single_choice: "単一選択",
  multiple_choice: "複数選択",
  true_false: "○ / ×",
  short_answer: "短文回答",
  fill_blank: "穴埋め",
};
const setPractice = (set: QuizSetRecord): PracticeSettings =>
  set.practiceSettings ?? {
    shuffleQuestions: set.data.settings.shuffleQuestions,
    shuffleChoices: set.data.settings.shuffleChoices,
  };

function loadSets(): QuizSetRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QuizSetRecord[];
    return Array.isArray(parsed)
      ? parsed.map((set) => ({
          ...set,
          data: validateQuiz(set.data),
          attempts: Array.isArray(set.attempts) ? set.attempts : [],
          practiceSettings: setPractice(set),
        }))
      : [];
  } catch {
    return [];
  }
}

function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-sky-500/70 px-4 text-sm font-semibold text-sky-50 transition hover:bg-sky-500/85 disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
    >
      {children}
    </button>
  );
}

function Toggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onChange}
      className={`flex w-full items-center justify-between gap-4 rounded-xl px-4 py-4 text-left ${checked ? "bg-sky-500/10 ring-1 ring-sky-400/30" : "bg-zinc-800 hover:bg-zinc-700"}`}
    >
      <span>
        <span className="block text-sm font-semibold text-zinc-100">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-zinc-400">{detail}</span>
      </span>
      <span
        className={`flex h-6 w-10 shrink-0 items-center rounded-full p-1 ${checked ? "justify-end bg-sky-400/90" : "justify-start bg-zinc-600"}`}
      >
        <span className="h-4 w-4 rounded-full bg-white" />
      </span>
    </button>
  );
}

export default function Home() {
  const [sets, setSets] = useState<QuizSetRecord[]>(loadSets);
  const [selectedKey, setSelectedKey] = useState<string | null>(() => loadSets()[0]?.key ?? null);
  const [screen, setScreen] = useState<Screen>("library");
  const [session, setSession] = useState<SessionItem[]>([]);
  const [sessionSetKey, setSessionSetKey] = useState<string | null>(null);
  const [reviewParentId, setReviewParentId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, UserAnswer>>({});
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [lastAttempt, setLastAttempt] = useState<Attempt | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  }, [sets]);

  useEffect(() => {
    if (selectedKey && !sets.some((set) => set.key === selectedKey)) {
      setSelectedKey(sets[0]?.key ?? null);
    }
    if (!selectedKey && sets[0]) setSelectedKey(sets[0].key);
  }, [sets, selectedKey]);

  const selectedSet = useMemo(
    () => sets.find((set) => set.key === selectedKey) ?? null,
    [sets, selectedKey],
  );
  const attempts = selectedSet?.attempts ?? [];
  const current = session[currentIndex];
  const practice = selectedSet ? setPractice(selectedSet) : null;
  const answeredCount = session.filter(({ question }) => answers[question.id] !== undefined).length;
  const confirmedCount = currentIndex + (feedback !== null ? 1 : 0);
  const progress = session.length ? Math.round((confirmedCount / session.length) * 100) : 0;

  const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const source = await file.text();
      let raw: unknown;
      try {
        raw = JSON.parse(source);
      } catch (error) {
        throw new Error(getJsonErrorMessage(error, source));
      }
      const data = validateQuiz(raw);
      const entry: QuizSetRecord = {
        key: `set-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        importedAt: new Date().toISOString(),
        data,
        attempts: [],
        practiceSettings: {
          shuffleQuestions: data.settings.shuffleQuestions,
          shuffleChoices: data.settings.shuffleChoices,
        },
      };
      setSets((items) => [entry, ...items]);
      setSelectedKey(entry.key);
      setScreen("library");
      toast.success("問題セットを追加しました。", {
        description: `${data.title}（${data.questions.length}問）`,
      });
    } catch (error) {
      toast.error("読み込みに失敗しました。", {
        description: error instanceof Error ? error.message : "JSONの形式を確認してください。",
      });
    } finally {
      event.target.value = "";
    }
  };

  const updatePractice = (partial: Partial<PracticeSettings>) => {
    if (!selectedSet) return;
    setSets((items) =>
      items.map((set) =>
        set.key === selectedSet.key
          ? { ...set, practiceSettings: { ...setPractice(set), ...partial } }
          : set,
      ),
    );
  };

  const startSession = (set: QuizSetRecord, reviewParent?: Attempt) => {
    const source = reviewParent
      ? set.data.questions.filter((question) => reviewParent.wrongIds.includes(question.id))
      : set.data.questions;
    if (reviewParent && source.length === 0) {
      toast.message("復習する誤答がありません。");
      return;
    }
    const settings = setPractice(set);
    const ordered = settings.shuffleQuestions ? shuffled(source) : [...source];
    setSession(
      ordered.map((question) => ({
        question,
        choices: settings.shuffleChoices ? shuffled(question.choices) : question.choices,
      })),
    );
    setSessionSetKey(set.key);
    setReviewParentId(reviewParent?.id ?? null);
    if (reviewParent) setLastAttempt(reviewParent);
    setCurrentIndex(0);
    setAnswers({});
    setFeedback(null);
    setLeaveConfirm(false);
    setScreen("quiz");
    setSettingsOpen(false);
    setMenuOpen(false);
  };

  const leaveQuiz = () => {
    setLeaveConfirm(false);
    setSelectedKey(sessionSetKey);
    setScreen("library");
  };

  const setAnswer = (value: UserAnswer) => {
    if (current && feedback === null) {
      setAnswers((items) => ({ ...items, [current.question.id]: value }));
    }
  };

  const submitAnswer = () => {
    if (!current) return;
    const value = answers[current.question.id];
    if (value === undefined || (Array.isArray(value) && !value[0])) {
      toast.message("回答を選択または入力してください。");
      return;
    }
    setFeedback(isCorrect(current.question, value));
  };

  const finishSession = () => {
    if (!current) return;
    if (currentIndex < session.length - 1) {
      setCurrentIndex((index) => index + 1);
      setFeedback(null);
      return;
    }
    const set = sets.find((item) => item.key === sessionSetKey);
    if (!set) return;

    const wrongIds = session
      .filter(({ question }) => !isCorrect(question, answers[question.id]))
      .map(({ question }) => question.id);
    const result = {
      id: `attempt-${Date.now()}`,
      timestamp: new Date().toISOString(),
      score: session.length - wrongIds.length,
      total: session.length,
      wrongIds,
    };

    if (reviewParentId) {
      const review: ReviewAttempt = result;
      setLastAttempt((attempt) =>
        attempt?.id === reviewParentId
          ? { ...attempt, reviews: [review, ...(attempt.reviews ?? [])] }
          : attempt,
      );
      setReviewParentId(null);
      setScreen("result");
      return;
    }

    const attempt: Attempt = result;
    setSets((items) =>
      items.map((item) => (item.key === set.key ? { ...item, attempts: [attempt, ...item.attempts] } : item)),
    );
    setLastAttempt(attempt);
    setSelectedKey(set.key);
    setScreen("result");
  };

  const deleteSelected = () => {
    if (!selectedSet || !window.confirm(`「${selectedSet.data.title}」を削除しますか？\n挑戦履歴も削除されます。`)) return;
    setSets((items) => items.filter((set) => set.key !== selectedSet.key));
    setScreen("library");
    toast.message("問題セットを削除しました。");
  };

  const controlStyle = (chosen: boolean, correct: boolean, missing: boolean, extra: boolean) => {
    if (correct) return "bg-emerald-950/70 text-emerald-100 ring-1 ring-emerald-500/45";
    if (missing) return "bg-rose-950/70 text-rose-100 ring-1 ring-rose-500/45";
    if (extra) return "bg-zinc-800 text-zinc-100 ring-1 ring-rose-500/70";
    if (chosen) return "bg-sky-500/16 text-sky-50 ring-1 ring-sky-400/35";
    return "bg-zinc-800 text-zinc-100 hover:bg-zinc-700";
  };

  const answerControl = () => {
    if (!current) return null;
    const { question, choices } = current;
    const value = answers[question.id];
    const locked = feedback !== null;

    if (question.type === "true_false") {
      return (
        <div className="grid grid-cols-2 gap-3">
          {[true, false].map((item) => {
            const chosen = value === item;
            const correct = locked && item === question.answer;
            const extra = locked && chosen && item !== question.answer;
            return (
              <button
                key={String(item)}
                disabled={locked}
                onClick={() => setAnswer(item)}
                className={`min-h-24 rounded-xl px-5 text-left text-base font-semibold ${controlStyle(chosen, correct, false, extra)}`}
              >
                <span className="mb-1 block text-[11px] font-normal tracking-wide opacity-70">{item ? "TRUE" : "FALSE"}</span>
                {item ? "○ 正しい" : "× 誤り"}
              </button>
            );
          })}
        </div>
      );
    }

    if (question.type === "short_answer" || question.type === "fill_blank") {
      const text = Array.isArray(value) ? value[0] ?? "" : "";
      const valid = locked && feedback === true;
      const invalid = locked && feedback === false;
      return (
        <input
          value={text}
          disabled={locked}
          onChange={(event) => setAnswer([event.target.value])}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !locked) submitAnswer();
          }}
          placeholder="回答を入力"
          className={`h-14 w-full rounded-xl bg-zinc-800 px-4 text-base text-zinc-100 outline-none placeholder:text-zinc-500 focus:ring-2 focus:ring-sky-400/60 ${valid ? "ring-1 ring-emerald-400/45" : invalid ? "ring-1 ring-rose-400/45" : ""}`}
        />
      );
    }

    const answerKeys = question.answer as string[];
    return (
      <div className="space-y-3">
        {choices.map((choice, order) => {
          const chosen = Array.isArray(value) && value.includes(choice.id);
          const key = answerKeys.includes(choice.id);
          const correct = locked && key && (question.type === "single_choice" || chosen);
          const missing = locked && question.type === "multiple_choice" && key && !chosen;
          const extra = locked && chosen && !key;
          const optionClass = question.type === "single_choice" && extra
            ? "bg-rose-950/70 text-rose-100 ring-1 ring-rose-500/45"
            : controlStyle(chosen, correct, missing, extra);
          return (
            <button
              key={choice.id}
              disabled={locked}
              onClick={() => {
                if (question.type === "single_choice") {
                  setAnswer([choice.id]);
                } else {
                  const selectedIds = Array.isArray(value) ? value : [];
                  setAnswer(
                    selectedIds.includes(choice.id)
                      ? selectedIds.filter((id) => id !== choice.id)
                      : [...selectedIds, choice.id],
                  );
                }
              }}
              className={`flex min-h-15 w-full items-center gap-4 rounded-xl px-4 py-3 text-left ${optionClass}`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/20 text-xs font-semibold">
                {correct ? <Check className="h-4 w-4" /> : String.fromCharCode(65 + order)}
              </span>
              <span className="flex-1 leading-relaxed">
                {choice.text}
                {missing && <span className="ml-2 text-xs font-medium text-rose-200">未選択の正解</span>}
              </span>
              {question.type === "multiple_choice" && <span className={`h-4 w-4 rounded ${chosen ? "bg-current" : "bg-white/20"}`} />}
            </button>
          );
        })}
      </div>
    );
  };

  const chooseSet = (set: QuizSetRecord) => {
    setSelectedKey(set.key);
    setSettingsOpen(false);
    setScreen("library");
    setMenuOpen(false);
  };

  const setList = (
    <div className="mt-5 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
      {sets.length === 0 ? (
        <div className="px-3 py-10 text-center">
          <FileJson className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
          <p className="text-sm text-zinc-500">問題セットがありません</p>
        </div>
      ) : (
        sets.map((set) => {
          const active = set.key === selectedKey;
          return (
            <button
              key={set.key}
              onClick={() => chooseSet(set)}
              className={`w-full rounded-xl p-3 text-left ${active ? "bg-sky-500/18 text-sky-50 ring-1 ring-sky-400/30" : "text-zinc-300 hover:bg-zinc-800"}`}
            >
              <p className="truncate text-sm font-medium">{set.data.title}</p>
              <p className={`mt-1 flex justify-between text-[11px] ${active ? "text-sky-200/70" : "text-zinc-500"}`}>
                <span>{set.data.questions.length}問 · {set.attempts.length}回</span>
                <span>{set.attempts[0] ? `${rate(set.attempts[0])}%` : "—"}</span>
              </p>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#111] text-zinc-100">
      <input ref={inputRef} onChange={importJson} accept="application/json,.json" type="file" className="hidden" />
      <header className="relative z-50 flex h-16 items-center justify-between bg-zinc-900 px-4 sm:px-7">
        <div className="flex items-center gap-3">
          <button onClick={() => setMenuOpen(true)} className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-800 lg:hidden" aria-label="問題セットを開く">
            <Menu className="h-5 w-5" />
          </button>
          <p className="text-base font-bold tracking-tight">Study Quiz Studio</p>
        </div>
        <PrimaryButton onClick={() => inputRef.current?.click()}>
          <Plus className="h-4 w-4" />JSONを追加
        </PrimaryButton>
      </header>

      <div className="flex min-h-[calc(100vh-64px)]">
        <aside className={`${menuOpen ? "translate-x-0" : "-translate-x-full"} fixed bottom-0 left-0 top-16 z-40 flex w-[86vw] max-w-[330px] flex-col overflow-hidden bg-zinc-900 p-4 shadow-2xl transition-transform duration-200 lg:static lg:w-[280px] lg:translate-x-0 lg:shadow-none`}>
          <div className="flex items-center justify-between px-2 pt-1">
            <div>
              <p className="font-semibold">問題セット</p>
              <p className="mt-1 text-xs text-zinc-500">{sets.length}セット</p>
            </div>
            <button onClick={() => inputRef.current?.click()} className="grid h-9 w-9 place-items-center rounded-lg bg-zinc-800" aria-label="JSONを追加">
              <Upload className="h-4 w-4" />
            </button>
          </div>
          {setList}
          <div className="mt-auto shrink-0 pt-4">
            <button onClick={() => inputRef.current?.click()} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 text-sm font-medium text-zinc-200 hover:bg-zinc-700">
              <Upload className="h-4 w-4" />JSONを読み込む
            </button>
          </div>
        </aside>
        {menuOpen && <button aria-label="問題セットを閉じる" onClick={() => setMenuOpen(false)} className="fixed inset-x-0 bottom-0 top-16 z-30 bg-black/50 lg:hidden" />}

        <main className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
          {screen === "library" && !selectedSet && (
            <section className="mx-auto grid min-h-[540px] max-w-3xl place-items-center">
              <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-8 text-center">
                <FileJson className="mx-auto h-10 w-10 text-sky-300/80" />
                <h1 className="mt-5 text-2xl font-bold">問題セットを読み込む</h1>
                <p className="mt-3 text-sm leading-6 text-zinc-400">指定フォーマットのJSONファイルを追加すると、ここから出題できます。</p>
                <PrimaryButton onClick={() => inputRef.current?.click()} className="mt-6">
                  <Upload className="h-4 w-4" />JSONを追加
                </PrimaryButton>
              </div>
            </section>
          )}

          {screen === "library" && selectedSet && (
            <section className="mx-auto max-w-5xl">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{selectedSet.data.title}</h1>
                  <p className="mt-2 text-sm text-zinc-500">{selectedSet.data.questions.length}問 · {formatDate(selectedSet.importedAt)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={deleteSelected} className="grid h-10 w-10 place-items-center rounded-lg bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white" aria-label="問題セットを削除">
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button onClick={() => setSettingsOpen((open) => !open)} aria-expanded={settingsOpen} className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${settingsOpen ? "bg-sky-500/18 text-sky-50 ring-1 ring-sky-400/35" : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"}`}>
                    <Settings2 className="h-4 w-4" />出題設定
                  </button>
                  <PrimaryButton onClick={() => startSession(selectedSet)}>
                    <Play className="h-4 w-4 fill-current" />開始
                  </PrimaryButton>
                </div>
              </div>

              {settingsOpen && practice && (
                <div className="mt-5 rounded-2xl bg-zinc-900 p-5">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-sky-300" />
                    <div>
                      <h2 className="font-semibold">出題設定</h2>
                      <p className="mt-1 text-xs text-zinc-500">この問題セットに保存されます。</p>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Toggle label="問題順をシャッフル" detail="問題の表示順を毎回ランダムにします。" checked={practice.shuffleQuestions} onChange={() => updatePractice({ shuffleQuestions: !practice.shuffleQuestions })} />
                    <Toggle label="選択肢順をシャッフル" detail="選択肢の表示順を毎回ランダムにします。" checked={practice.shuffleChoices} onChange={() => updatePractice({ shuffleChoices: !practice.shuffleChoices })} />
                  </div>
                </div>
              )}

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl bg-zinc-900 p-5">
                  <p className="text-xs text-zinc-500">最新の正答率</p>
                  <p className="mt-3 text-4xl font-bold">{attempts[0] ? `${rate(attempts[0])}%` : "—"}</p>
                  {attempts[0] && <p className="mt-2 text-xs text-zinc-500">{attempts[0].score} / {attempts[0].total} 問正解</p>}
                </div>
                <div className="rounded-2xl bg-zinc-900 p-5">
                  <p className="text-xs text-zinc-500">挑戦回数</p>
                  <p className="mt-3 text-4xl font-bold">{attempts.length}</p>
                  <p className="mt-2 text-xs text-zinc-500">通常演習のみを集計</p>
                </div>
                <div className="rounded-2xl bg-zinc-900 p-5">
                  <p className="text-xs text-zinc-500">前回の誤答</p>
                  <p className="mt-3 text-4xl font-bold">{attempts[0] ? attempts[0].wrongIds.length : "—"}</p>
                  <p className="mt-2 text-xs text-zinc-500">やり直し対象の問題数</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-zinc-900 p-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">挑戦履歴</h2>
                  <History className="h-5 w-5 text-zinc-500" />
                </div>
                <div className="mt-4 space-y-2">
                  {attempts.length === 0 ? (
                    <p className="py-6 text-center text-sm text-zinc-500">まだ挑戦履歴がありません。</p>
                  ) : (
                    attempts.map((attempt) => (
                      <div key={attempt.id} className="rounded-xl bg-zinc-800 px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium">{formatDate(attempt.timestamp)}</p>
                            <p className="mt-1 text-xs text-zinc-500">{attempt.score} / {attempt.total} 問正解 · 誤答 {attempt.wrongIds.length}問</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="text-lg font-bold">{rate(attempt)}%</p>
                            <button onClick={() => startSession(selectedSet, attempt)} disabled={attempt.wrongIds.length === 0} className="inline-flex h-8 items-center gap-1 rounded-md bg-zinc-700 px-3 text-xs font-medium text-zinc-100 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-35">
                              <RotateCcw className="h-3.5 w-3.5" />誤答を復習
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}

          {screen === "quiz" && current && (
            <section className="mx-auto max-w-3xl">
              <div className="relative flex items-center justify-between">
                <button onClick={() => setLeaveConfirm(true)} className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-100">
                  <ArrowLeft className="h-4 w-4" />戻る
                </button>
                {leaveConfirm && (
                  <div role="dialog" aria-label="演習を中止して戻る確認" className="absolute left-0 top-8 z-20 w-64 rounded-xl bg-zinc-800 p-3 shadow-2xl ring-1 ring-zinc-700">
                    <p className="text-sm leading-5 text-zinc-200">この演習を中止してセット概要に戻りますか？</p>
                    <div className="mt-3 flex justify-end gap-2">
                      <button onClick={leaveQuiz} className="h-8 rounded-md px-2.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700">戻る</button>
                      <button onClick={() => setLeaveConfirm(false)} className="h-8 rounded-md bg-zinc-100 px-2.5 text-xs font-semibold text-zinc-900 hover:bg-white">続ける</button>
                    </div>
                  </div>
                )}
                <p className="text-sm text-zinc-500">{currentIndex + 1} / {session.length}{reviewParentId ? " · 復習" : ""}</p>
              </div>

              <div className="mt-5 flex items-center gap-3" aria-label={`進行度 ${progress}%`}>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full bg-sky-400/80 transition-[width] duration-200" style={{ width: `${progress}%` }} />
                </div>
                <span className="w-9 text-right text-xs tabular-nums text-zinc-500">{progress}%</span>
              </div>

              <div className="mt-9">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium">{typeName[current.question.type]}</span>
                  {current.question.category && <span className="text-xs text-zinc-500">{current.question.category}</span>}
                </div>
                <h1 className="mt-6 text-2xl font-bold leading-relaxed sm:text-3xl">{current.question.question}</h1>
                {current.question.tags?.length ? <p className="mt-3 text-xs text-zinc-400">{current.question.tags.map((tag) => `#${tag}`).join("  ")}</p> : null}
                <div className="mt-8">{answerControl()}</div>

                {feedback !== null && (
                  <div className={`mt-4 rounded-xl p-4 ${feedback ? "bg-emerald-950/75 text-emerald-100 ring-1 ring-emerald-500/40" : "bg-rose-950/75 text-rose-100 ring-1 ring-rose-500/40"}`}>
                    <div className="flex gap-3">
                      <div className="mt-0.5">{feedback ? <CheckCircle2 className="h-5 w-5 text-emerald-300" /> : <XCircle className="h-5 w-5 text-rose-300" />}</div>
                      <div>
                        <p className="font-semibold">{feedback ? "正解" : "不正解"}</p>
                        {selectedSet?.data.settings.showExplanation && current.question.explanation && <p className="mt-1 text-sm leading-6 opacity-90">{current.question.explanation}</p>}
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-8 flex items-center justify-between">
                  <p className="text-xs text-zinc-500">回答済み {answeredCount} / {session.length}</p>
                  {feedback === null ? (
                    <PrimaryButton onClick={submitAnswer}>回答を確認</PrimaryButton>
                  ) : (
                    <PrimaryButton onClick={finishSession}>
                      {currentIndex === session.length - 1 ? (reviewParentId ? "復習を完了" : "結果を見る") : "次の問題"}
                      <ChevronRight className="h-4 w-4" />
                    </PrimaryButton>
                  )}
                </div>
              </div>
            </section>
          )}

          {screen === "result" && lastAttempt && selectedSet && (
            <section className="mx-auto max-w-3xl">
              <div className="rounded-2xl bg-zinc-900 p-7 sm:p-10">
                <p className="text-sm text-zinc-500">結果</p>
                <h1 className="mt-2 text-2xl font-bold">{selectedSet.data.title}</h1>
                <div className="mt-8 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs text-zinc-500">正答率</p>
                    <p className="mt-2 text-6xl font-bold">{rate(lastAttempt)}%</p>
                    <p className="mt-3 text-sm text-zinc-500">{lastAttempt.score} / {lastAttempt.total} 問正解</p>
                  </div>
                  <div className="rounded-xl bg-zinc-800 p-5">
                    <p className="text-xs text-zinc-500">誤答</p>
                    <p className="mt-2 text-4xl font-bold">{lastAttempt.wrongIds.length}問</p>
                    <p className="mt-2 text-sm text-zinc-500">{lastAttempt.reviews?.length ? `このセッションで復習 ${lastAttempt.reviews.length} 回` : lastAttempt.wrongIds.length ? "間違えた問題を復習できます。" : "全問正解です。"}</p>
                  </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-2">
                  <PrimaryButton onClick={() => startSession(selectedSet, lastAttempt)} disabled={lastAttempt.wrongIds.length === 0}>
                    <RotateCcw className="h-4 w-4" />誤答をやり直す
                  </PrimaryButton>
                  <button onClick={() => startSession(selectedSet)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-zinc-800 px-4 text-sm font-semibold text-zinc-100 hover:bg-zinc-700">
                    <Play className="h-4 w-4" />最初から挑戦
                  </button>
                  <button onClick={() => setScreen("library")} className="inline-flex h-10 items-center gap-2 px-3 text-sm text-zinc-400 hover:text-white">
                    セット概要へ<ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
