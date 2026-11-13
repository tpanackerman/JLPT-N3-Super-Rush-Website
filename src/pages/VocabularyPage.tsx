import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Bookmark,
  RotateCw,
  CheckCircle2,
  XCircle,
  Volume2,
  Lock,
  Unlock,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { VocabItem, SrsRating } from '../types';
import { isCardDue, SRS_STEP_LABELS } from '../utils/learningEngine';

type VocabLearningMode =
  | 'cards'
  | 'srs_flashcard'
  | 'ja_to_vi'
  | 'vi_to_ja'
  | 'ja_to_reading'
  | 'fill_blank'
  | 'synonym'
  | 'contextual'
  | 'discrimination'
  | 'mcq';

const MODE_LABELS: { id: VocabLearningMode; label: string }[] = [
  { id: 'cards', label: 'Danh sách & Thẻ từ' },
  { id: 'srs_flashcard', label: 'Ôn tập SRS (10p–14d)' },
  { id: 'ja_to_vi', label: '1. Nhật → Việt' },
  { id: 'vi_to_ja', label: '2. Việt → Nhật' },
  { id: 'ja_to_reading', label: '3. Nhật → Cách đọc' },
  { id: 'fill_blank', label: '4. Điền từ vào chỗ trống' },
  { id: 'synonym', label: '5. Đồng nghĩa (Mondai 3)' },
  { id: 'contextual', label: '6. Cách dùng từ (Mondai 5)' },
  { id: 'discrimination', label: '7. Phân biệt từ gần nghĩa' },
  { id: 'mcq', label: '8. Trắc nghiệm tổng hợp' },
];

export const VocabularyPage: React.FC = () => {
  const {
    vocabMeta,
    allVocabItems,
    selectedDayNumber,
    srsCardsMap,
    rateVocabCard,
    toggleVocabRedMark,
    addOrIncrementMistake,
  } = useApp();

  const [mode, setMode] = useState<VocabLearningMode>('cards');
  const [selectedUnit, setSelectedUnit] = useState<number | 'today' | 'red' | 'all'>('today');
  const [allowFutureUnits, setAllowFutureUnits] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Active recall quiz state
  const [quizIndex, setQuizIndex] = useState(0);
  const [userAttemptInput, setUserAttemptInput] = useState('');
  const [selectedOptionIdx, setSelectedOptionIdx] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [lastResultCorrect, setLastResultCorrect] = useState<boolean | null>(null);

  // Determine which units are scheduled up to selectedDayNumber (Part 7E: do not make learner study future unit ahead of schedule unless explicitly chosen)
  const maxScheduledDay = allowFutureUnits ? 25 : selectedDayNumber;

  const filteredVocab = useMemo(() => {
    return allVocabItems.filter((item) => {
      if (!allowFutureUnits && item.dayNumber > maxScheduledDay) {
        return false;
      }
      if (selectedUnit === 'today' && item.dayNumber !== selectedDayNumber) {
        // If today has no new vocab (e.g. Day 17-25), fall back to all unlocked units
        const todayHasNew = allVocabItems.some((x) => x.dayNumber === selectedDayNumber);
        if (todayHasNew) return false;
      } else if (selectedUnit === 'red') {
        if (!srsCardsMap[item.id]?.redMarked && (srsCardsMap[item.id]?.lapseCount || 0) === 0) {
          return false;
        }
      } else if (typeof selectedUnit === 'number' && item.unit !== selectedUnit) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        return (
          item.word.toLowerCase().includes(q) ||
          (item.reading || '').toLowerCase().includes(q) ||
          (item.meaningVi || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    allVocabItems,
    allowFutureUnits,
    maxScheduledDay,
    selectedUnit,
    selectedDayNumber,
    srsCardsMap,
    searchQuery,
  ]);

  // SRS queue prioritized by forgotten -> redMarked -> overdue -> new
  const srsQueue = useMemo(() => {
    const now = new Date();
    const pool = [...filteredVocab];
    pool.sort((a, b) => {
      const ca = srsCardsMap[a.id];
      const cb = srsCardsMap[b.id];
      const score = (c: typeof ca) => {
        if (!c) return 2; // new
        if (c.status === 'forgotten') return 5;
        if (c.redMarked) return 4;
        if (isCardDue(c, now)) return 3;
        return 1;
      };
      return score(cb) - score(ca);
    });
    return pool;
  }, [filteredVocab, srsCardsMap]);

  // Analytics metrics (Part 7D)
  const analytics = useMemo(() => {
    const cards = Object.values(srsCardsMap).filter((c) => c.itemType === 'vocabulary');
    const studied = cards.filter((c) => c.reviewCount > 0).length;
    const mastered = cards.filter((c) => c.status === 'mastered').length;
    const forgotten = cards.filter((c) => c.status === 'forgotten').length;
    const dueReview = cards.filter((c) => c.reviewCount > 0 && isCardDue(c)).length;
    const redCount = cards.filter((c) => c.redMarked || c.lapseCount > 0).length;
    const totalRev = cards.reduce((s, c) => s + c.reviewCount, 0);
    const totalCor = cards.reduce((s, c) => s + c.correctCount, 0);
    const accuracy = totalRev > 0 ? Math.round((totalCor / totalRev) * 100) : null;
    const retention =
      studied > 0 ? Math.round(((studied - forgotten) / studied) * 100) : null;

    return {
      sourceTarget: vocabMeta.totalItems, // 880
      extractedCount: allVocabItems.length,
      studied,
      mastered,
      dueReview,
      forgotten,
      redCount,
      accuracy,
      retention,
    };
  }, [srsCardsMap, vocabMeta.totalItems, allVocabItems.length]);

  const resetQuestionState = (nextIdx: number) => {
    setQuizIndex(nextIdx);
    setUserAttemptInput('');
    setSelectedOptionIdx(null);
    setRevealed(false);
    setLastResultCorrect(null);
  };

  // Generate dynamic quiz question based on active learning mode
  const currentQuizData = useMemo(() => {
    if (mode === 'cards' || mode === 'srs_flashcard') return null;

    // Mode 5: Synonym recognition (Day 17 explicit pairs + pool)
    if (mode === 'synonym') {
      const pairs = vocabMeta.synonymPairs;
      if (pairs.length === 0) return null;
      const item = pairs[quizIndex % pairs.length];
      const distractors = pairs
        .filter((p) => p.id !== item.id)
        .slice(0, 3)
        .map((p) => p.equivalent);
      const options = [item.equivalent, ...distractors].sort((a, b) => a.localeCompare(b));
      const answerIdx = options.indexOf(item.equivalent);
      return {
        id: item.id,
        promptLabel: 'Chọn từ/cụm từ đồng nghĩa gần nhất (Mondai 3):',
        promptMain: item.word,
        promptSub: `Gợi ý nghĩa: ${item.meaningVi}`,
        correctAnswer: item.equivalent,
        explanation: `${item.word} ＝ ${item.equivalent} (${item.meaningVi}) — Trích Ngày ${item.dayNumber}`,
        options,
        answerIdx,
        errorCategory: 'vocab_confused_synonym' as const,
      };
    }

    // Mode 6: Contextual usage (Day 22 polysemous verbs Mondai 5)
    if (mode === 'contextual') {
      const poly = vocabMeta.polysemousVerbs;
      const flatUsages = poly.flatMap((v) =>
        v.senses.map((s) => ({
          id: `${v.id}-${s.n}`,
          verb: v.verb,
          senseText: s.text,
          example: s.examples[0] || v.verb,
        }))
      );
      if (flatUsages.length === 0) return null;
      const target = flatUsages[quizIndex % flatUsages.length];
      const otherVerbs = poly
        .filter((v) => v.verb !== target.verb)
        .slice(0, 3)
        .map((v) => v.verb);
      const options = [target.verb, ...otherVerbs].sort();
      const answerIdx = options.indexOf(target.verb);
      return {
        id: target.id,
        promptLabel: 'Chọn động từ đa nghĩa phù hợp với ngữ cảnh (Mondai 5):',
        promptMain: target.senseText,
        promptSub: 'Hãy suy nghĩ cụm cố định trước khi chọn đáp án',
        correctAnswer: target.verb,
        explanation: `Động từ đúng: ${target.verb} — ${target.senseText} (Chuyên đề Ngày 22)`,
        options,
        answerIdx,
        errorCategory: 'vocab_incorrect_contextual_meaning' as const,
      };
    }

    // Standard pool modes (1, 2, 3, 4, 7, 8)
    const pool = filteredVocab.length > 0 ? filteredVocab : allVocabItems;
    if (pool.length === 0) return null;
    const item: VocabItem = pool[quizIndex % pool.length];

    if (mode === 'ja_to_vi' || mode === 'mcq') {
      const distractors = pool
        .filter((x) => x.id !== item.id && x.meaningVi)
        .slice(0, 3)
        .map((x) => x.meaningVi || '');
      const correct = item.meaningVi || '';
      const options = Array.from(new Set([correct, ...distractors])).slice(0, 4);
      while (options.length < 4) options.push(`Nghĩa khác ${options.length + 1}`);
      options.sort();
      return {
        id: item.id,
        vocabItem: item,
        promptLabel: 'Nhớ chủ động nghĩa tiếng Việt của từ sau:',
        promptMain: item.word,
        promptSub: item.reading ? `Cách đọc: ${item.reading} · Unit ${item.unit}` : `Unit ${item.unit}`,
        correctAnswer: correct,
        explanation: `${item.word} (${item.reading || '—'}): ${item.meaningVi} [Unit ${item.unit}, Ngày ${item.dayNumber}]`,
        options,
        answerIdx: options.indexOf(correct),
        errorCategory: 'vocab_unknown_word' as const,
      };
    }

    if (mode === 'vi_to_ja' || mode === 'fill_blank') {
      const distractors = pool
        .filter((x) => x.id !== item.id)
        .slice(0, 3)
        .map((x) => x.word);
      const correct = item.word;
      const options = Array.from(new Set([correct, ...distractors])).slice(0, 4);
      options.sort();
      return {
        id: item.id,
        vocabItem: item,
        promptLabel:
          mode === 'fill_blank'
            ? `Điền từ tiếng Nhật vào chỗ trống [ ___ ] mang nghĩa:`
            : 'Từ tiếng Nhật nào mang nghĩa tiếng Việt sau?',
        promptMain: item.meaningVi || item.word,
        promptSub: `Chủ đề: ${item.category || item.unitName} (Unit ${item.unit})`,
        correctAnswer: correct,
        explanation: `${item.word} (${item.reading || '—'}): ${item.meaningVi}`,
        options,
        answerIdx: options.indexOf(correct),
        errorCategory: 'vocab_unknown_word' as const,
      };
    }

    if (mode === 'ja_to_reading') {
      const poolWithReading = pool.filter((x) => x.reading);
      const target = poolWithReading.length > 0 ? poolWithReading[quizIndex % poolWithReading.length] : item;
      const correct = target.reading || target.word;
      const distractors = poolWithReading
        .filter((x) => x.id !== target.id && x.reading)
        .slice(0, 3)
        .map((x) => x.reading!);
      const options = Array.from(new Set([correct, ...distractors])).slice(0, 4);
      options.sort();
      return {
        id: target.id,
        vocabItem: target,
        promptLabel: 'Chọn cách đọc Hiragana đúng cho từ sau:',
        promptMain: target.word,
        promptSub: `Nghĩa: ${target.meaningVi || '—'}`,
        correctAnswer: correct,
        explanation: `${target.word} đọc là 「${correct}」 (${target.meaningVi})`,
        options,
        answerIdx: options.indexOf(correct),
        errorCategory: 'vocab_incorrect_reading' as const,
      };
    }

    // Mode 7: Word discrimination (same category / unit)
    const sameCat = pool.filter((x) => x.id !== item.id && x.category === item.category);
    const distractors = (sameCat.length >= 3 ? sameCat : pool.filter((x) => x.id !== item.id))
      .slice(0, 3)
      .map((x) => `${x.word} (${x.reading || '—'})`);
    const correct = `${item.word} (${item.reading || '—'})`;
    const options = Array.from(new Set([correct, ...distractors])).slice(0, 4);
    options.sort();
    return {
      id: item.id,
      vocabItem: item,
      promptLabel: `Phân biệt các từ cùng nhóm "${item.category || item.unitName}": Từ nào có nghĩa là`,
      promptMain: `「${item.meaningVi}」`,
      promptSub: `Unit ${item.unit} · Ngày ${item.dayNumber}`,
      correctAnswer: correct,
      explanation: `${item.word} (${item.reading || '—'}) = ${item.meaningVi}`,
      options,
      answerIdx: options.indexOf(correct),
      errorCategory: 'vocab_confused_synonym' as const,
    };
  }, [mode, vocabMeta, filteredVocab, allVocabItems, quizIndex]);

  const handleSubmitQuizAnswer = async (chosenIdx: number) => {
    if (!currentQuizData || revealed) return;
    setSelectedOptionIdx(chosenIdx);
    setRevealed(true);
    const isCorrect = chosenIdx === currentQuizData.answerIdx;
    setLastResultCorrect(isCorrect);

    if (currentQuizData.vocabItem) {
      await rateVocabCard(currentQuizData.vocabItem.id, isCorrect ? 'good' : 'again');
    }

    if (!isCorrect) {
      await addOrIncrementMistake({
        skill: 'vocabulary',
        question: `${currentQuizData.promptLabel} ${currentQuizData.promptMain}`,
        options: currentQuizData.options,
        incorrectAnswer: currentQuizData.options[chosenIdx] || userAttemptInput || 'Sai',
        correctAnswer: currentQuizData.correctAnswer,
        explanation: currentQuizData.explanation,
        source: `Mimi kara Oboeru N3 Goi (${mode})`,
        dayNumber: selectedDayNumber,
        errorCategory: currentQuizData.errorCategory,
        relatedItemId: currentQuizData.id,
      });
    }
  };

  const currentSrsItem = srsQueue[quizIndex % Math.max(1, srsQueue.length)];
  const currentSrsState = currentSrsItem ? srsCardsMap[currentSrsItem.id] : undefined;

  return (
    <div className="space-y-6">
      {/* Header & Analytics Strip */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">
              耳から覚える日本語能力試験 N3 語彙トレーニング
            </span>
            <h1 className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white">
              Phân hệ Từ vựng — Mục tiêu 880 Từ qua 10 Unit
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chiến thuật: Ưu tiên tuyệt đối <strong>Unit 1, 2, 3, 4, 5, 7</strong> (chiếm 80% đề thi), sau đó quét nhanh <strong>Unit 6, 8, 9, 10</strong>.
            </p>
          </div>

          {/* Schedule Lock Toggle (Part 7E) */}
          <button
            onClick={() => setAllowFutureUnits(!allowFutureUnits)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
              allowFutureUnits
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 text-amber-800 dark:text-amber-200'
                : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-200'
            }`}
          >
            {allowFutureUnits ? (
              <>
                <Unlock className="w-3.5 h-3.5" />
                Đang mở khóa học trước lịch (Tất cả 10 Unit)
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                Bám sát lịch tới Ngày {selectedDayNumber} (Bấm để mở Unit tương lai)
              </>
            )}
          </button>
        </div>

        {/* Analytics Cards (Part 7D) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
            <div className="text-[10px] text-slate-500">Mục tiêu sách</div>
            <div className="text-base font-extrabold">{analytics.sourceTarget} từ</div>
            <div className="text-[10px] text-slate-400">Đã nạp: {analytics.extractedCount}</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
            <div className="text-[10px] text-slate-500">Đã học (Studied)</div>
            <div className="text-base font-extrabold text-indigo-600">{analytics.studied}</div>
            <div className="text-[10px] text-slate-400">Có lịch sử recall</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
            <div className="text-[10px] text-slate-500">Đã thuộc (Mastered)</div>
            <div className="text-base font-extrabold text-emerald-600">{analytics.mastered}</div>
            <div className="text-[10px] text-slate-400">Chu kỳ ≥ 7 ngày</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
            <div className="text-[10px] text-slate-500">Đến hạn ôn</div>
            <div className="text-base font-extrabold text-amber-600">{analytics.dueReview}</div>
            <div className="text-[10px] text-slate-400">Cần ôn hôm nay</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
            <div className="text-[10px] text-slate-500">Từ bị quên</div>
            <div className="text-base font-extrabold text-rose-600">{analytics.forgotten}</div>
            <div className="text-[10px] text-slate-400">Đánh giá Again</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
            <div className="text-[10px] text-slate-500">Đánh dấu đỏ</div>
            <div className="text-base font-extrabold text-rose-600">{analytics.redCount}</div>
            <div className="text-[10px] text-slate-400">Bộ sưu tập ưu tiên</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
            <div className="text-[10px] text-slate-500">Độ chính xác</div>
            <div className="text-base font-extrabold">
              {analytics.accuracy !== null ? `${analytics.accuracy}%` : '—'}
            </div>
            <div className="text-[10px] text-slate-400">Accuracy</div>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700">
            <div className="text-[10px] text-slate-500">Tỷ lệ lưu giữ</div>
            <div className="text-base font-extrabold">
              {analytics.retention !== null ? `${analytics.retention}%` : '—'}
            </div>
            <div className="text-[10px] text-slate-400">Retention</div>
          </div>
        </div>

        {/* Progress by Unit Bar */}
        <div>
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">
            Tiến độ theo 10 Unit (Dải từ 1 → 880):
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            {vocabMeta.units.map((u) => {
              const unitItems = allVocabItems.filter((i) => i.unit === u.unit);
              const studiedInUnit = unitItems.filter(
                (i) => (srsCardsMap[i.id]?.reviewCount || 0) > 0
              ).length;
              const pct =
                unitItems.length > 0 ? Math.round((studiedInUnit / unitItems.length) * 100) : 0;
              const isHighPriority = [1, 2, 3, 4, 5, 7].includes(u.unit);

              return (
                <button
                  key={u.unit}
                  onClick={() => {
                    setSelectedUnit(u.unit);
                    setAllowFutureUnits(true);
                  }}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    selectedUnit === u.unit
                      ? 'border-indigo-600 ring-1 ring-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span>Unit {u.unit}</span>
                    {isHighPriority && (
                      <span className="text-[9px] px-1 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
                        Trọng tâm
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{u.nameVi}</div>
                  <div className="text-[10px] text-slate-400">Từ {u.itemRange}</div>
                  <div className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full mt-1 overflow-hidden">
                    <div className="bg-blue-600 h-full" style={{ width: `${pct}%` }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mode Switcher + Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {MODE_LABELS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                resetQuestionState(0);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                mode === m.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedUnit('today')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                selectedUnit === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              Từ vựng Ngày {selectedDayNumber}
            </button>
            <button
              onClick={() => setSelectedUnit('red')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                selectedUnit === 'red'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              Bộ từ Đánh dấu đỏ / Hay sai ({analytics.redCount})
            </button>
            <button
              onClick={() => setSelectedUnit('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                selectedUnit === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              Tất cả đã mở ({filteredVocab.length})
            </button>
          </div>

          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm từ vựng, cách đọc, nghĩa tiếng Việt..."
            className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 w-full sm:w-64"
          />
        </div>
      </div>

      {/* MODE A: VOCABULARY CARDS LIST */}
      {mode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredVocab.map((item) => {
            const cardState = srsCardsMap[item.id];
            const isRed = cardState?.redMarked;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 bg-white dark:bg-slate-900 flex flex-col justify-between ${
                  isRed
                    ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                      Unit {item.unit} · Ngày {item.dayNumber} (Dải {item.assignedItemRange})
                    </span>
                    <div className="flex items-center gap-1">
                      {item.audio && (
                        <button
                          onClick={() => new Audio(item.audio!).play()}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-indigo-600"
                          title="Nghe phát âm"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => toggleVocabRedMark(item.id)}
                        className={`p-1 rounded ${
                          isRed
                            ? 'text-rose-600 bg-rose-100 dark:bg-rose-900/50'
                            : 'text-slate-400 hover:text-rose-600'
                        }`}
                        title="Đánh dấu bút đỏ (ôn cuối buổi & Ngày 18/20/24)"
                      >
                        <Bookmark className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-1">
                    {item.reading && (
                      <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium jp-text">
                        {item.reading}
                      </div>
                    )}
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white jp-text">
                      {item.word}
                    </div>
                  </div>

                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 mt-1">
                    {item.meaningVi || 'Chưa có nghĩa (cần import bổ sung)'}
                  </div>

                  <div className="mt-2 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                    {item.category && (
                      <div>
                        <strong>Nhóm chủ đề:</strong> {item.category}
                      </div>
                    )}
                    {item.partOfSpeech && (
                      <div>
                        <strong>Từ loại:</strong> {item.partOfSpeech}
                      </div>
                    )}
                    {item.exampleSentence && (
                      <div className="jp-text text-slate-700 dark:text-slate-300">
                        <strong>Ví dụ:</strong> {item.exampleSentence}
                        {item.exampleTranslation ? ` (${item.exampleTranslation})` : ''}
                      </div>
                    )}
                    {item.relatedExpressions.length > 0 && (
                      <div>
                        <strong>Từ liên quan:</strong> {item.relatedExpressions.join(', ')}
                      </div>
                    )}
                  </div>

                  {item.flags.length > 0 && (
                    <div className="mt-2 text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Cờ dữ liệu gốc: {item.flags.join(', ')}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Trạng thái SRS:{' '}
                    <strong className="text-slate-700 dark:text-slate-200">
                      {cardState ? cardState.status : 'new'}
                    </strong>
                  </span>
                  {cardState && cardState.reviewCount > 0 && (
                    <span>
                      Đúng {cardState.correctCount}/{cardState.reviewCount} · Bước:{' '}
                      {SRS_STEP_LABELS[cardState.stepIndex]}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODE B: SRS FLASHCARD REVIEW (Part 7C: 10m, 1d, 3d, 7d, 14d; Again, Hard, Good, Easy) */}
      {mode === 'srs_flashcard' && currentSrsItem && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Thẻ SRS {(quizIndex % srsQueue.length) + 1} / {srsQueue.length} (Ưu tiên từ quên & đến hạn)
            </span>
            <span>
              Unit {currentSrsItem.unit} · Ngày {currentSrsItem.dayNumber}
            </span>
          </div>

          <div className="text-center py-8 px-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 space-y-3">
            <div className="text-xs font-semibold text-slate-400 uppercase">
              Hãy tự nhẩm cách đọc và nghĩa tiếng Việt trước khi lật thẻ!
            </div>
            <div className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white jp-text">
              {currentSrsItem.word}
            </div>

            {/* Active recall attempt input before revealing */}
            {!revealed && (
              <div className="max-w-md mx-auto pt-3 space-y-2">
                <input
                  type="text"
                  value={userAttemptInput}
                  onChange={(e) => setUserAttemptInput(e.target.value)}
                  placeholder="Gõ nhanh cách đọc hoặc nghĩa để kiểm tra trí nhớ..."
                  className="w-full text-xs md:text-sm text-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
                />
                <button
                  onClick={() => setRevealed(true)}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-bold inline-flex items-center gap-2"
                >
                  <RotateCw className="w-4 h-4" />
                  Kiểm tra & Lật đáp án
                </button>
              </div>
            )}

            {revealed && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-2">
                {currentSrsItem.reading && (
                  <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 jp-text">
                    {currentSrsItem.reading}
                  </div>
                )}
                <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300">
                  {currentSrsItem.meaningVi}
                </div>
                {userAttemptInput && (
                  <div className="text-xs text-slate-500">
                    Câu trả lời bạn vừa nhẩm: <strong>{userAttemptInput}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {revealed && (
            <div className="space-y-2">
              <div className="text-xs text-center text-slate-500">
                Đánh giá mức độ nhớ để lên lịch SRS (Chu kỳ chuẩn: 10 phút → 1 ngày → 3 ngày → 7 ngày → 14 ngày):
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  [
                    { rating: 'again', label: 'Again (Quên)', sub: '10 phút', color: 'bg-rose-600 hover:bg-rose-700' },
                    {
                      rating: 'hard',
                      label: 'Hard (Khó)',
                      sub: SRS_STEP_LABELS[Math.max(0, currentSrsState?.stepIndex || 0)],
                      color: 'bg-amber-600 hover:bg-amber-700',
                    },
                    {
                      rating: 'good',
                      label: 'Good (Nhớ tốt)',
                      sub: SRS_STEP_LABELS[Math.min(4, (currentSrsState?.stepIndex || 0) + 1)],
                      color: 'bg-emerald-600 hover:bg-emerald-700',
                    },
                    {
                      rating: 'easy',
                      label: 'Easy (Rất dễ)',
                      sub: SRS_STEP_LABELS[Math.min(4, (currentSrsState?.stepIndex || 0) + 2)],
                      color: 'bg-indigo-600 hover:bg-indigo-700',
                    },
                  ] as { rating: SrsRating; label: string; sub: string; color: string }[]
                ).map((btn) => (
                  <button
                    key={btn.rating}
                    onClick={async () => {
                      await rateVocabCard(currentSrsItem.id, btn.rating);
                      resetQuestionState(quizIndex + 1);
                    }}
                    className={`${btn.color} text-white rounded-xl py-2.5 px-3 text-center transition-colors`}
                  >
                    <div className="text-xs font-bold">{btn.label}</div>
                    <div className="text-[10px] opacity-90">Lần tới: {btn.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODES 1..8: ACTIVE RECALL QUIZ WORKFLOW */}
      {mode !== 'cards' && mode !== 'srs_flashcard' && currentQuizData && (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              Chế độ: {MODE_LABELS.find((m) => m.id === mode)?.label}
            </span>
            <span>Câu #{quizIndex + 1} · Active Recall</span>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="text-xs font-semibold text-slate-500">
              {currentQuizData.promptLabel}
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white jp-text">
              {currentQuizData.promptMain}
            </div>
            <div className="text-xs text-slate-500">{currentQuizData.promptSub}</div>
          </div>

          {/* Learner must attempt recall first */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
              Bước 1: Tự nhẩm hoặc gõ đáp án trước khi chọn:
            </label>
            <input
              type="text"
              value={userAttemptInput}
              onChange={(e) => setUserAttemptInput(e.target.value)}
              placeholder="Gõ nhanh câu trả lời trong đầu bạn (tùy chọn)..."
              className="w-full text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2"
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              Bước 2: Chọn đáp án để kiểm tra (sẽ tự động lưu vào Sổ tay Lỗi sai nếu chọn nhầm):
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQuizData.options.map((opt, idx) => {
                const isSelected = selectedOptionIdx === idx;
                const isCorrectAnswer = idx === currentQuizData.answerIdx;

                let btnStyle =
                  'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400';
                if (revealed) {
                  if (isCorrectAnswer) {
                    btnStyle =
                      'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-bold';
                  } else if (isSelected) {
                    btnStyle =
                      'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200';
                  }
                }

                return (
                  <button
                    key={idx}
                    disabled={revealed}
                    onClick={() => handleSubmitQuizAnswer(idx)}
                    className={`p-3.5 rounded-xl border text-left text-xs md:text-sm jp-text transition-all flex items-center justify-between ${btnStyle}`}
                  >
                    <span>
                      {idx + 1}. {opt}
                    </span>
                    {revealed && isCorrectAnswer && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    )}
                    {revealed && isSelected && !isCorrectAnswer && (
                      <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {revealed && (
            <div
              className={`p-4 rounded-xl border text-xs md:text-sm space-y-2 ${
                lastResultCorrect
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="font-bold">
                {lastResultCorrect
                  ? '✓ Chính xác! Đã cập nhật lịch ôn SRS.'
                  : '✗ Chưa đúng! Đã tự động ghi vào Sổ tay Lỗi sai để ôn lại.'}
              </div>
              <div className="jp-text">{currentQuizData.explanation}</div>
              <div className="flex justify-end pt-1">
                <button
                  onClick={() => resetQuestionState(quizIndex + 1)}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold"
                >
                  Câu tiếp theo →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
