import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { GrammarMasteryLevel, GrammarPattern } from '../types';
import {
  GitBranch,
  CheckCircle2,
  Bookmark,
  Sparkles,
  BookOpen,
  Star,
  FileText,
  Scale,
  AlertCircle,
  Search,
  ChevronRight,
  Lock,
  Unlock,
} from 'lucide-react';

type PracticeType =
  | 'multiple_choice'
  | 'fill_blank'
  | 'star_ordering'
  | 'paragraph_grammar'
  | 'similar_discrimination';

const MASTERY_LABELS: Record<GrammarMasteryLevel, { label: string; badge: string }> = {
  not_learned: {
    label: 'Chưa học (Not Learned)',
    badge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  },
  learning: {
    label: 'Đang học (Learning)',
    badge: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300',
  },
  understood: {
    label: 'Đã hiểu (Understood)',
    badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300',
  },
  needs_review: {
    label: 'Cần ôn lại (Needs Review)',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
  },
  mastered: {
    label: 'Thành thạo (Mastered)',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
};

export const GrammarPage: React.FC = () => {
  const {
    grammarMeta,
    allGrammarPatterns,
    grammarProgressMap,
    selectedDayNumber,
    recordGrammarPractice,
    setGrammarLevelManual,
    toggleGrammarRedMark,
    addOrIncrementMistake,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'units' | 'practice' | 'revision_topics'>('units');
  const [selectedUnit, setSelectedUnit] = useState<number | 'all' | 'red'>(1);
  const [allowFutureUnits, setAllowFutureUnits] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPattern, setSelectedPattern] = useState<GrammarPattern | null>(null);
  const [workflowCompletedSteps, setWorkflowCompletedSteps] = useState<Record<string, number[]>>({});
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);

  // Practice state
  const [practiceType, setPracticeType] = useState<PracticeType>('multiple_choice');
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [starOrderedTokens, setStarOrderedTokens] = useState<string[]>([]);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);

  // Unit schedule lock based on selectedDayNumber
  const maxUnlockedUnit = useMemo(() => {
    let maxU = 1;
    grammarMeta.units.forEach((u) => {
      const firstDay = Math.min(...u.sessions.map((s) => s.dayNumber));
      if (firstDay <= selectedDayNumber) {
        maxU = Math.max(maxU, u.unit);
      }
    });
    return maxU;
  }, [grammarMeta.units, selectedDayNumber]);

  const stats = useMemo(() => {
    const counts: Record<GrammarMasteryLevel, number> = {
      not_learned: 0,
      learning: 0,
      understood: 0,
      needs_review: 0,
      mastered: 0,
    };
    let totalAttempts = 0;
    let totalCorrect = 0;
    let redCount = 0;

    allGrammarPatterns.forEach((p) => {
      const rec = grammarProgressMap[p.id];
      const level = rec?.level || 'not_learned';
      counts[level]++;
      if (rec) {
        totalAttempts += rec.attempts;
        totalCorrect += rec.correct;
        if (rec.redMarked) redCount++;
      }
    });

    return {
      totalTarget: grammarMeta.totalPatterns, // 112
      listedCount: allGrammarPatterns.length, // 103 + custom
      counts,
      redCount,
      accuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null,
    };
  }, [allGrammarPatterns, grammarProgressMap, grammarMeta.totalPatterns]);

  const filteredPatterns = useMemo(() => {
    return allGrammarPatterns.filter((p) => {
      if (!allowFutureUnits && p.unit > maxUnlockedUnit && selectedUnit !== 'red') {
        return false;
      }
      if (selectedUnit === 'red') {
        if (!grammarProgressMap[p.id]?.redMarked) return false;
      } else if (selectedUnit !== 'all') {
        if (p.unit !== selectedUnit) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchStructure = p.structure.toLowerCase().includes(q);
        const matchMeaning = p.meaningVi.toLowerCase().includes(q);
        const matchEx = p.examples.some((e) => e.toLowerCase().includes(q));
        if (!matchStructure && !matchMeaning && !matchEx) return false;
      }
      return true;
    });
  }, [allGrammarPatterns, allowFutureUnits, maxUnlockedUnit, selectedUnit, grammarProgressMap, searchQuery]);

  const toggleWorkflowStep = (patternId: string, step: number) => {
    setWorkflowCompletedSteps((prev) => {
      const existing = prev[patternId] || [];
      const next = existing.includes(step)
        ? existing.filter((s) => s !== step)
        : [...existing, step];
      return { ...prev, [patternId]: next };
    });
  };

  const handleManualLevelChange = async (patternId: string, level: GrammarMasteryLevel) => {
    const res = await setGrammarLevelManual(patternId, level);
    if (res.message) {
      setStatusFeedback(res.message);
      window.setTimeout(() => setStatusFeedback(null), 5000);
    } else {
      setStatusFeedback(null);
    }
  };

  // Build active-recall quiz questions from real roadmap patterns & confusing pairs
  const practiceQuestions = useMemo(() => {
    const pool = filteredPatterns.length >= 4 ? filteredPatterns : allGrammarPatterns;
    if (pool.length === 0) return [];

    if (practiceType === 'similar_discrimination') {
      return grammarMeta.confusingPairs.flatMap((pair) =>
        pair.members.map((m, idx) => {
          const linkedPattern = allGrammarPatterns.find((p) => p.id === m.patternId) || pool[0];
          const example = linkedPattern?.examples[0] || `Câu áp dụng sắc thái: "${m.noteVi}"`;
          const options = pair.members.map((mem) => mem.structure);
          return {
            id: `${pair.id}-${idx}`,
            patternId: m.patternId || linkedPattern.id,
            prompt: `Phân biệt cặp ngữ pháp dễ nhầm (${pair.label} - Ngày ${pair.dayNumber}): Mẫu nào mang sắc thái "${m.noteVi}"?`,
            context: example,
            correctAnswer: m.structure,
            options,
            explanation: pair.rawText,
            starTokens: [] as string[],
          };
        })
      );
    }

    if (practiceType === 'star_ordering') {
      // Build sentence ordering ★ questions from patterns that have examples
      const withEx = pool.filter((p) => p.examples.length > 0);
      return withEx.map((p, idx) => {
        const ex = p.examples[0];
        // Split into 4 segments around particles or spaces for ordering
        const cleanStruct = p.structure.replace(/^～/, '').split('/')[0].trim();
        const tokens = [
          ex.slice(0, Math.max(2, Math.floor(ex.length * 0.25))),
          cleanStruct,
          ex.slice(Math.max(2, Math.floor(ex.length * 0.25)), Math.max(4, Math.floor(ex.length * 0.65))),
          ex.slice(Math.max(4, Math.floor(ex.length * 0.65))),
        ].filter((t) => t.trim().length > 0);

        const paddedTokens =
          tokens.length >= 4
            ? tokens.slice(0, 4)
            : [cleanStruct, 'の', 'ために', ex];

        const starTarget = paddedTokens[2]; // 3rd slot is ★
        return {
          id: `star-${p.id}-${idx}`,
          patternId: p.id,
          prompt: `Bài tập dấu sao ★ (Mondai 2 - Quy tắc Ngày 16): Sắp xếp 4 mảnh ghép theo đúng cấu trúc "${p.structure}" (${p.meaningVi}). Từ nào nằm ở vị trí dấu ★ (vị trí thứ 3)?`,
          context: `____  ____  ★  ____  （Nghĩa mẫu: ${p.meaningVi} | Ví dụ gốc: ${ex}）`,
          correctAnswer: starTarget,
          options: [...paddedTokens].sort((a, b) => a.localeCompare(b)),
          explanation: `Thứ tự đúng: ${paddedTokens.join(' → ')} | Vị trí ★ (thứ 3): "${starTarget}". Mẫu: ${p.structure} (${p.meaningVi}).`,
          starTokens: paddedTokens,
        };
      });
    }

    if (practiceType === 'paragraph_grammar') {
      return pool.map((p, idx) => {
        const distractors = allGrammarPatterns
          .filter((other) => other.id !== p.id)
          .slice(idx % 10, (idx % 10) + 3)
          .map((d) => d.structure);
        const options = Array.from(new Set([p.structure, ...distractors])).slice(0, 4);
        return {
          id: `para-${p.id}`,
          patternId: p.id,
          prompt: `Ngữ pháp trong đoạn văn (文章の文法 - Mondai 3, Ngày 17): Chọn cấu trúc liên kết/cuối câu phù hợp với mạch logic đoạn văn mang nghĩa "${p.meaningVi}":`,
          context:
            p.examples[0]
              ? `「...（Mạch văn trước）... ${p.examples[0].replace(
                  p.structure.replace(/^～/, '').split('/')[0],
                  '【 51 】'
                )}」`
              : `「... Trong ngữ cảnh diễn đạt "${p.meaningVi}", người viết kết luận bằng 【 51 】 ...」`,
          correctAnswer: p.structure,
          options: options.sort((a, b) => a.localeCompare(b)),
          explanation: `Đáp án 【 51 】: ${p.structure} — ${p.meaningVi}. Ví dụ: ${p.examples.join(' / ') || 'Chưa có câu ví dụ'}`,
          starTokens: [] as string[],
        };
      });
    }

    if (practiceType === 'fill_blank') {
      return pool.map((p, idx) => {
        const cleanStruct = p.structure.replace(/^～/, '').split('/')[0].trim();
        const ex = p.examples[0] || `（Ví dụ cho ${p.structure}）`;
        const masked = ex.includes(cleanStruct)
          ? ex.replace(cleanStruct, '（　　　）')
          : `${ex} → Điền mẫu: （　　　）`;
        const distractors = allGrammarPatterns
          .filter((other) => other.id !== p.id)
          .slice(idx % 12, (idx % 12) + 3)
          .map((d) => d.structure);
        const options = Array.from(new Set([p.structure, ...distractors])).slice(0, 4);
        return {
          id: `fill-${p.id}`,
          patternId: p.id,
          prompt: `Điền vào chỗ trống mẫu ngữ pháp mang nghĩa "${p.meaningVi}":`,
          context: masked,
          correctAnswer: p.structure,
          options: options.sort((a, b) => a.localeCompare(b)),
          explanation: `${p.structure}: ${p.meaningVi}. Câu đầy đủ: ${ex}`,
          starTokens: [] as string[],
        };
      });
    }

    // Default: multiple_choice
    return pool.map((p, idx) => {
      const distractors = allGrammarPatterns
        .filter((other) => other.id !== p.id)
        .slice(idx % 15, (idx % 15) + 3)
        .map((d) => d.meaningVi);
      const options = Array.from(new Set([p.meaningVi, ...distractors])).slice(0, 4);
      return {
        id: `mc-${p.id}`,
        patternId: p.id,
        prompt: `Chọn nghĩa tiếng Việt chính xác của mẫu ngữ pháp "${p.structure}" (Unit ${p.unit}, Ngày ${p.dayNumber}):`,
        context: p.examples[0] ? `Ví dụ: ${p.examples[0]}` : `Dải mẫu: ${p.assignedPatternRange}`,
        correctAnswer: p.meaningVi,
        options: options.sort((a, b) => a.localeCompare(b)),
        explanation: `${p.structure} = ${p.meaningVi}. ${p.examples.join(' / ')}`,
        starTokens: [] as string[],
      };
    });
  }, [filteredPatterns, allGrammarPatterns, practiceType, grammarMeta.confusingPairs]);

  const currentQuestion = practiceQuestions[quizIndex % Math.max(1, practiceQuestions.length)];

  const handleSubmitPractice = async () => {
    if (!currentQuestion) return;
    let chosen = selectedOption;
    if (practiceType === 'star_ordering' && starOrderedTokens.length >= 3) {
      chosen = starOrderedTokens[2];
    }
    if (!chosen) return;

    const isCor = chosen === currentQuestion.correctAnswer;
    setQuizCorrect(isCor);
    setQuizSubmitted(true);

    await recordGrammarPractice(currentQuestion.patternId, isCor);

    if (!isCor) {
      const errorCat =
        practiceType === 'similar_discrimination'
          ? 'grammar_confused_pattern'
          : practiceType === 'star_ordering'
          ? 'grammar_incorrect_sentence_structure'
          : 'grammar_incorrect_formation';
      await addOrIncrementMistake({
        skill: 'grammar',
        question: `${currentQuestion.prompt} (${currentQuestion.context})`,
        options: currentQuestion.options,
        incorrectAnswer: chosen,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
        source: `Mimi kara Oboeru N3 Bunpou (${practiceType})`,
        dayNumber: selectedDayNumber,
        errorCategory: errorCat,
        relatedItemId: currentQuestion.patternId,
      });
    }
  };

  const handleNextPractice = () => {
    setSelectedOption(null);
    setStarOrderedTokens([]);
    setQuizSubmitted(false);
    setQuizCorrect(false);
    setQuizIndex((prev) => (prev + 1) % Math.max(1, practiceQuestions.length));
  };

  return (
    <div className="space-y-6">
      {/* Header & Analytics Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                Mimi kara Oboeru N3 Bunpou
              </span>
              <span className="text-xs text-slate-500">
                耳から覚える日本語能力試験 N3 文法トレーニング
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-indigo-600" />
              Phân hệ Ngữ pháp N3 — 112 Mẫu câu / 9 Units
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Theo dõi 5 cấp độ nắm vững. Trạng thái <strong>Thành thạo (Mastered)</strong> chỉ mở khóa khi trả lời đúng lặp lại trong bài tập Active Recall.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSubTab('units')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'units'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Danh mục 9 Units & Quy trình 7 bước
            </button>
            <button
              onClick={() => setActiveSubTab('practice')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'practice'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              5 Chế độ Luyện tập
            </button>
            <button
              onClick={() => setActiveSubTab('revision_topics')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                activeSubTab === 'revision_topics'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Scale className="w-4 h-4" />
              6 Chuyên đề Ôn tập (Ngày 15, 16, 17, 22)
            </button>
          </div>
        </div>

        {/* 5 Mastery Levels Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500">Mục tiêu nguồn / Đã trích</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.listedCount} <span className="text-xs font-normal text-slate-500">/ {stats.totalTarget} mẫu</span>
            </div>
          </div>
          {(['not_learned', 'learning', 'understood', 'needs_review', 'mastered'] as GrammarMasteryLevel[]).map(
            (lvl) => (
              <div key={lvl} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <div className="text-xs text-slate-500 truncate">{MASTERY_LABELS[lvl].label}</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                  {stats.counts[lvl]}
                </div>
              </div>
            )
          )}
        </div>

        {statusFeedback && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{statusFeedback}</span>
          </div>
        )}
      </div>

      {/* TAB 1: UNITS & 7-STEP WORKFLOW */}
      {activeSubTab === 'units' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Unit Selector & Pattern List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  {grammarMeta.units.map((u) => {
                    const locked = !allowFutureUnits && u.unit > maxUnlockedUnit;
                    return (
                      <button
                        key={u.unit}
                        disabled={locked}
                        onClick={() => setSelectedUnit(u.unit)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                          selectedUnit === u.unit
                            ? 'bg-indigo-600 text-white'
                            : locked
                            ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 cursor-not-allowed'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        {locked ? <Lock className="w-3 h-3" /> : null}
                        Unit {u.unit} ({u.patternRange})
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setSelectedUnit('red')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                      selectedUnit === 'red'
                        ? 'bg-rose-600 text-white'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    <Bookmark className="w-3 h-3" />
                    Đánh dấu đỏ ({stats.redCount})
                  </button>
                  <button
                    onClick={() => setSelectedUnit('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                      selectedUnit === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    Tất cả
                  </button>
                </div>

                <button
                  onClick={() => setAllowFutureUnits((v) => !v)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
                >
                  {allowFutureUnits ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  {allowFutureUnits ? 'Đang mở mọi Unit' : `Khóa theo Ngày ${selectedDayNumber} (Unit 1–${maxUnlockedUnit})`}
                </button>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm cấu trúc ngữ pháp, nghĩa tiếng Việt, câu ví dụ..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              {filteredPatterns.map((p) => {
                const rec = grammarProgressMap[p.id];
                const level = rec?.level || 'not_learned';
                const isSelected = selectedPattern?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPattern(p)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-400 dark:border-indigo-600 shadow-sm'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            Unit {p.unit} • Ngày {p.dayNumber} ({p.assignedPatternRange})
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MASTERY_LABELS[level].badge}`}>
                            {MASTERY_LABELS[level].label}
                          </span>
                          {rec && rec.attempts > 0 && (
                            <span className="text-xs text-slate-500">
                              Đúng {rec.correct}/{rec.attempts} (liên tiếp: {rec.consecutiveCorrect})
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 japanese-text">
                          {p.structure}
                        </h3>
                        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300 mt-0.5">
                          {p.meaningVi}
                        </p>
                        {p.examples.length > 0 && (
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 japanese-text">
                            VD: {p.examples.join(' / ')}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleGrammarRedMark(p.id);
                          }}
                          title="Đánh dấu bút đỏ ưu tiên ôn tập"
                          className={`p-2 rounded-lg border ${
                            rec?.redMarked
                              ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:border-rose-800'
                              : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-500'
                          }`}
                        >
                          <Bookmark className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredPatterns.length === 0 && (
                <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-sm text-slate-500">
                  Không có mẫu ngữ pháp nào khớp bộ lọc hiện tại.
                </div>
              )}
            </div>
          </div>

          {/* Right: Detailed Pattern Card & 7-Step Workflow */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sticky top-6 space-y-4">
              {selectedPattern ? (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        Unit {selectedPattern.unit} ({selectedPattern.unitPart}) • Ngày {selectedPattern.dayNumber}
                      </span>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-0.5 japanese-text">
                        {selectedPattern.structure}
                      </h3>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
                        Nghĩa: {selectedPattern.meaningVi}
                      </p>
                    </div>
                  </div>

                  {/* Pattern Fields from Part 8.A */}
                  <div className="space-y-2.5 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Cách chia (Formation): </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {selectedPattern.formation || 'Theo sách Mimi kara Oboeru N3 Bunpou (có thể bổ sung qua CSV/JSON Import)'}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Cách dùng (Usage notes): </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {selectedPattern.usage || selectedPattern.meaningVi}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Câu ví dụ (Examples): </span>
                      {selectedPattern.examples.length > 0 ? (
                        <ul className="list-disc list-inside mt-1 space-y-1 text-slate-800 dark:text-slate-200 japanese-text">
                          {selectedPattern.examples.map((ex, i) => (
                            <li key={i}>
                              {ex}
                              {selectedPattern.exampleTranslations[i] && (
                                <span className="text-slate-500"> — {selectedPattern.exampleTranslations[i]}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400 italic">Chưa có câu ví dụ trong lộ trình gốc</span>
                      )}
                    </div>
                    <div>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Mẫu tương tự (Similar patterns): </span>
                      <span className="text-slate-600 dark:text-slate-400">
                        {selectedPattern.similarPatterns.length > 0
                          ? selectedPattern.similarPatterns.join(', ')
                          : 'Xem tab Chuyên đề Ôn tập (5 cặp dễ nhầm Ngày 15)'}
                      </span>
                    </div>
                  </div>

                  {/* Part 8.B: 7-Step Grammar Learning Workflow */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Quy trình 7 bước học Ngữ pháp (Part 8.B)
                    </h4>
                    <div className="space-y-1.5">
                      {[
                        '1. Đọc giải thích ý nghĩa mẫu câu',
                        '2. Nắm vững quy tắc chia (Formation)',
                        '3. Đọc to câu ví dụ chuẩn trong sách',
                        '4. So sánh với các mẫu tương tự dễ nhầm',
                        '5. Làm câu hỏi luyện tập áp dụng',
                        '6. Xem lại và phân tích câu trả lời sai',
                        '7. Lên lịch ôn tập lặp lại',
                      ].map((stepLabel, idx) => {
                        const checked = (workflowCompletedSteps[selectedPattern.id] || []).includes(idx);
                        return (
                          <label
                            key={idx}
                            className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleWorkflowStep(selectedPattern.id, idx)}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <span className={checked ? 'line-through text-slate-400' : ''}>{stepLabel}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Mastery Selector */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                      Cập nhật trạng thái nắm vững
                    </label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {(
                        ['not_learned', 'learning', 'understood', 'needs_review', 'mastered'] as GrammarMasteryLevel[]
                      ).map((lvl) => {
                        const currentLvl = grammarProgressMap[selectedPattern.id]?.level || 'not_learned';
                        return (
                          <button
                            key={lvl}
                            onClick={() => handleManualLevelChange(selectedPattern.id, lvl)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left flex items-center justify-between border ${
                              currentLvl === lvl
                                ? 'border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                                : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50'
                            }`}
                          >
                            <span>{MASTERY_LABELS[lvl].label}</span>
                            {currentLvl === lvl && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-sm text-slate-500">
                  Chọn một mẫu ngữ pháp bên trái để xem chi tiết và thực hiện quy trình 7 bước.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 5 PRACTICE TYPES */}
      {activeSubTab === 'practice' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'multiple_choice', label: '1. Trắc nghiệm chọn nghĩa' },
                { id: 'fill_blank', label: '2. Điền vào chỗ trống' },
                { id: 'star_ordering', label: '3. Sắp xếp câu dấu sao ★ (Mondai 2)' },
                { id: 'paragraph_grammar', label: '4. Ngữ pháp đoạn văn 文章の文法 (Mondai 3)' },
                { id: 'similar_discrimination', label: '5. Phân biệt mẫu ngữ pháp dễ nhầm' },
              ] as { id: PracticeType; label: string }[]
            ).map((pt) => (
              <button
                key={pt.id}
                onClick={() => {
                  setPracticeType(pt.id);
                  setQuizIndex(0);
                  setSelectedOption(null);
                  setStarOrderedTokens([]);
                  setQuizSubmitted(false);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  practiceType === pt.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          {currentQuestion ? (
            <div className="max-w-2xl mx-auto space-y-5 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Câu {(quizIndex % practiceQuestions.length) + 1} / {practiceQuestions.length}
                </span>
                <span>Active Recall — Phải trả lời trước khi xem đáp án</span>
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {currentQuestion.prompt}
              </h3>

              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-base font-medium text-slate-800 dark:text-slate-200 japanese-text">
                {currentQuestion.context}
              </div>

              {practiceType === 'star_ordering' ? (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500">
                    Bấm lần lượt vào 4 mảnh ghép bên dưới để xếp thành câu (Vị trí thứ 3 là dấu ★):
                  </div>
                  <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-dashed border-indigo-300 dark:border-indigo-700 min-h-[52px]">
                    {[0, 1, 2, 3].map((slot) => (
                      <div
                        key={slot}
                        className={`p-2 rounded-lg text-center text-xs font-semibold border ${
                          slot === 2
                            ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="text-[10px] text-slate-400 mb-0.5">
                          {slot === 2 ? '★ Vị trí 3' : `Vị trí ${slot + 1}`}
                        </div>
                        <div className="japanese-text">{starOrderedTokens[slot] || '___'}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {currentQuestion.options.map((tok, i) => (
                      <button
                        key={i}
                        disabled={quizSubmitted || starOrderedTokens.includes(tok)}
                        onClick={() => setStarOrderedTokens((prev) => [...prev, tok])}
                        className="px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 disabled:opacity-40 japanese-text"
                      >
                        {tok}
                      </button>
                    ))}
                    {!quizSubmitted && starOrderedTokens.length > 0 && (
                      <button
                        onClick={() => setStarOrderedTokens([])}
                        className="px-3 py-2 rounded-xl text-xs text-rose-600 hover:underline"
                      >
                        Xếp lại
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {currentQuestion.options.map((opt, i) => {
                    const isSelected = selectedOption === opt;
                    return (
                      <button
                        key={i}
                        disabled={quizSubmitted}
                        onClick={() => setSelectedOption(opt)}
                        className={`p-3.5 rounded-xl border text-left text-sm font-medium transition-all japanese-text ${
                          quizSubmitted
                            ? opt === currentQuestion.correctAnswer
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                              : isSelected
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                              : 'border-slate-200 dark:border-slate-800 opacity-60'
                            : isSelected
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-200'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {!quizSubmitted ? (
                <button
                  onClick={handleSubmitPractice}
                  disabled={
                    practiceType === 'star_ordering' ? starOrderedTokens.length < 3 : !selectedOption
                  }
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold"
                >
                  Kiểm tra đáp án
                </button>
              ) : (
                <div className="space-y-3">
                  <div
                    className={`p-4 rounded-xl border text-sm ${
                      quizCorrect
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                        : 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
                    }`}
                  >
                    <div className="font-bold mb-1">
                      {quizCorrect
                        ? 'Chính xác! Tiến độ mẫu câu đã được cộng.'
                        : 'Chưa chính xác — Đã tự động ghi vào Sổ Tay Lỗi Sai!'}
                    </div>
                    <div className="text-xs leading-relaxed japanese-text">{currentQuestion.explanation}</div>
                  </div>
                  <button
                    onClick={handleNextPractice}
                    className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold"
                  >
                    Câu tiếp theo →
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 3: SPECIFIC GRAMMAR REVISION SUPPORT (PART 8.D) */}
      {activeSubTab === 'revision_topics' && (
        <div className="space-y-6">
          {/* 1. Confusing Grammar Pairs (Day 15) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-indigo-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                1. Bảng so sánh 5 Cặp/Nhóm Ngữ pháp dễ nhầm lẫn (Ngày 15 — dòng 401–406)
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {grammarMeta.confusingPairs.map((pair) => (
                <div
                  key={pair.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-indigo-600 dark:text-indigo-400">
                      {pair.label} (Ngày {pair.dayNumber})
                    </span>
                    <span className="text-[11px] text-slate-400">Dòng {pair.sourceLine}</span>
                  </div>
                  <div className="space-y-1.5">
                    {pair.members.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-baseline justify-between gap-2 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs"
                      >
                        <span className="font-bold text-slate-900 dark:text-white japanese-text">
                          {m.structure}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">{m.noteVi}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Star ★ Sentence Ordering Rules (Day 16) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-amber-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                2. Quy tắc giải nhanh bài Dấu sao ★ Mondai 2 (Ngày 16 — dòng 425–429)
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Lưu ý dữ liệu nguồn: Lộ trình ghi "5 quy tắc vàng" nhưng liệt kê 4 gạch đầu dòng nguyên bản dưới đây:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {grammarMeta.starRules.rules.map((r) => (
                <div
                  key={r.n}
                  className="p-3.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 text-xs text-slate-800 dark:text-slate-200"
                >
                  <div className="font-bold text-amber-800 dark:text-amber-300 mb-1">
                    Quy tắc {r.n} (Dòng {r.sourceLine})
                  </div>
                  <div className="japanese-text leading-relaxed">{r.text}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. All 6 Required Grammar Revision Topics */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                3. 6 Chủ đề Ôn tập Ngữ pháp trọng tâm trong Lộ trình
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {grammarMeta.requiredRevisionTopics.map((topic) => (
                <div
                  key={topic.key}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
                >
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{topic.labelVi}</div>
                  <div className="text-xs text-slate-500 mt-1">
                    Nhiệm vụ liên kết: {topic.taskIds.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
