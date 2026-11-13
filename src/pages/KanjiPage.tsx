import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Languages,
  Bookmark,
  Sparkles,
  BookOpen,
  Scale,
  Search,
  AlertTriangle,
  CheckCircle2,
  Eye,
} from 'lucide-react';

type KanjiPracticeMode =
  | 'kanji_to_reading'
  | 'kanji_to_meaning'
  | 'meaning_to_kanji'
  | 'jukugo_recognition'
  | 'homophone_discrimination'
  | 'similar_char_discrimination'
  | 'contextual_selection';

export const KanjiPage: React.FC = () => {
  const {
    kanjiMeta,
    allKanjiWords,
    allKanjiChars,
    kanjiProgressMap,
    selectedDayNumber,
    recordKanjiPractice,
    toggleKanjiRedMark,
    addOrIncrementMistake,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'weeks' | 'practice' | 'special_topics'>('weeks');
  const [selectedWeek, setSelectedWeek] = useState<number | 'all' | 'red'>(1);
  const [selectedLesson, setSelectedLesson] = useState<number | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [revealedCardIds, setRevealedCardIds] = useState<Record<string, boolean>>({});

  // Practice state
  const [practiceMode, setPracticeMode] = useState<KanjiPracticeMode>('kanji_to_reading');
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizCorrect, setQuizCorrect] = useState(false);

  // Extract unique individual Kanji characters from allKanjiWords + user imported chars
  const derivedCharacters = useMemo(() => {
    const charMap = new Map<
      string,
      {
        char: string;
        weeks: Set<number>;
        lessons: Set<number>;
        compounds: { word: string; reading: string | null; meaningVi: string | null }[];
      }
    >();

    allKanjiWords.forEach((w) => {
      for (const ch of w.word) {
        if (/[\u4e00-\u9faf]/.test(ch)) {
          const existing = charMap.get(ch) || {
            char: ch,
            weeks: new Set<number>(),
            lessons: new Set<number>(),
            compounds: [],
          };
          if (w.week > 0) existing.weeks.add(w.week);
          w.lessons.forEach((l) => existing.lessons.add(l));
          if (!existing.compounds.some((c) => c.word === w.word)) {
            existing.compounds.push({
              word: w.word,
              reading: w.reading,
              meaningVi: w.meaningVi,
            });
          }
          charMap.set(ch, existing);
        }
      }
    });

    return Array.from(charMap.values());
  }, [allKanjiWords]);

  const stats = useMemo(() => {
    let masteredCount = 0;
    let recAtt = 0;
    let recCor = 0;
    let readAtt = 0;
    let readCor = 0;
    let redCount = 0;

    Object.values(kanjiProgressMap).forEach((rec) => {
      if (rec.mastered) masteredCount++;
      if (rec.redMarked) redCount++;
      recAtt += rec.recognitionAttempts;
      recCor += rec.recognitionCorrect;
      readAtt += rec.readingAttempts;
      readCor += rec.readingCorrect;
    });

    return {
      totalTargetKanji: kanjiMeta.totalKanji, // 336
      totalLessons: kanjiMeta.lessonCount, // 36
      totalWeeks: kanjiMeta.weekCount, // 6
      listedJukugo: allKanjiWords.length,
      uniqueKanjiInSource: derivedCharacters.length + allKanjiChars.length,
      masteredCount,
      redCount,
      recognitionAccuracy: recAtt > 0 ? Math.round((recCor / recAtt) * 100) : null,
      readingAccuracy: readAtt > 0 ? Math.round((readCor / readAtt) * 100) : null,
    };
  }, [kanjiMeta, allKanjiWords.length, derivedCharacters.length, allKanjiChars.length, kanjiProgressMap]);

  const filteredWords = useMemo(() => {
    return allKanjiWords.filter((w) => {
      if (selectedWeek === 'red') {
        if (!kanjiProgressMap[w.id]?.redMarked) return false;
      } else if (selectedWeek !== 'all') {
        if (w.week !== selectedWeek) return false;
        if (selectedLesson !== 'all' && !w.lessons.includes(selectedLesson)) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const mWord = w.word.toLowerCase().includes(q);
        const mRead = (w.reading || '').toLowerCase().includes(q);
        const mMean = (w.meaningVi || '').toLowerCase().includes(q);
        const mTopic = (w.lessonTopic || '').toLowerCase().includes(q);
        if (!mWord && !mRead && !mMean && !mTopic) return false;
      }
      return true;
    });
  }, [allKanjiWords, selectedWeek, selectedLesson, kanjiProgressMap, searchQuery]);

  // Build 7 practice modes from real extracted Kanji data
  const practiceQuestions = useMemo(() => {
    const wordsWithReading = allKanjiWords.filter((w) => w.reading && w.meaningVi);
    const wordsWithMeaning = allKanjiWords.filter((w) => w.meaningVi);

    if (practiceMode === 'homophone_discrimination') {
      return kanjiMeta.homophoneGroups.flatMap((grp) =>
        grp.members.map((m, idx) => ({
          id: `${grp.id}-${idx}`,
          targetId: m.id,
          modeCategory: 'reading' as const,
          prompt: `Phân biệt từ đồng âm / dễ nhầm cách đọc 「${grp.reading}」 (Ngày ${grp.dayNumber}): Chữ Kanji nào mang nghĩa "${m.meaningVi}"?`,
          stimulus: `Cách đọc / Nhóm: ${grp.reading} → Nghĩa cần chọn: "${m.meaningVi}"`,
          correctAnswer: m.word,
          options: grp.members.map((mem) => mem.word),
          explanation: grp.rawText,
        }))
      );
    }

    if (practiceMode === 'similar_char_discrimination') {
      const contrastWords = allKanjiWords.filter((w) => w.contrastGroup);
      return contrastWords.map((w, idx) => {
        const groupPeers = contrastWords.filter((p) => p.contrastGroup === w.contrastGroup);
        const distractors = allKanjiWords
          .filter((other) => other.id !== w.id)
          .slice(idx % 12, (idx % 12) + 3)
          .map((d) => d.word);
        const opts = Array.from(new Set([...groupPeers.map((p) => p.word), ...distractors])).slice(0, 4);
        return {
          id: `sim-${w.id}`,
          targetId: w.id,
          modeCategory: 'recognition' as const,
          prompt: `Phân biệt chữ Kanji dễ nhìn nhầm nét (Ngày ${w.dayNumber}): Từ nào mang nghĩa "${w.meaningVi}"${
            w.reading ? ` (${w.reading})` : ''
          }?`,
          stimulus: `Nhóm đối chiếu: ${w.contrastGroup} | Chủ đề: ${w.lessonTopic}`,
          correctAnswer: w.word,
          options: opts.sort((a, b) => a.localeCompare(b)),
          explanation: `${w.word} ${w.reading ? `(${w.reading})` : ''} = ${w.meaningVi}. Nhóm dễ nhầm: ${w.contrastGroup}`,
        };
      });
    }

    if (practiceMode === 'kanji_to_reading') {
      return wordsWithReading.map((w, idx) => {
        const distractors = wordsWithReading
          .filter((o) => o.id !== w.id && o.reading !== w.reading)
          .slice(idx % 15, (idx % 15) + 3)
          .map((d) => d.reading!);
        const options = Array.from(new Set([w.reading!, ...distractors])).slice(0, 4);
        return {
          id: `k2r-${w.id}`,
          targetId: w.id,
          modeCategory: 'reading' as const,
          prompt: `Chọn cách đọc Hiragana đúng cho từ ghép Jukugo sau (Tuần ${w.week}, Ngày ${w.dayNumber}):`,
          stimulus: w.word,
          correctAnswer: w.reading!,
          options: options.sort((a, b) => a.localeCompare(b)),
          explanation: `${w.word} đọc là 「${w.reading}」 — Nghĩa: ${w.meaningVi} (${w.lessonTopic}).`,
        };
      });
    }

    if (practiceMode === 'meaning_to_kanji') {
      return wordsWithMeaning.map((w, idx) => {
        const distractors = wordsWithMeaning
          .filter((o) => o.id !== w.id)
          .slice(idx % 15, (idx % 15) + 3)
          .map((d) => d.word);
        const options = Array.from(new Set([w.word, ...distractors])).slice(0, 4);
        return {
          id: `m2k-${w.id}`,
          targetId: w.id,
          modeCategory: 'recognition' as const,
          prompt: `Chọn từ Kanji tương ứng với nghĩa tiếng Việt sau (Tuần ${w.week || 'Ôn tập'}):`,
          stimulus: `${w.meaningVi}${w.reading ? ` （Gợi ý âm đọc: ${w.reading}）` : ''}`,
          correctAnswer: w.word,
          options: options.sort((a, b) => a.localeCompare(b)),
          explanation: `${w.word} ${w.reading ? `(${w.reading})` : ''} = ${w.meaningVi}.`,
        };
      });
    }

    if (practiceMode === 'jukugo_recognition') {
      return wordsWithMeaning.map((w, idx) => {
        const distractors = wordsWithMeaning
          .filter((o) => o.id !== w.id)
          .slice((idx * 2) % 20, ((idx * 2) % 20) + 3)
          .map((d) => `${d.word} — ${d.meaningVi}`);
        const correctStr = `${w.word} — ${w.meaningVi}`;
        const options = Array.from(new Set([correctStr, ...distractors])).slice(0, 4);
        return {
          id: `juk-${w.id}`,
          targetId: w.id,
          modeCategory: 'recognition' as const,
          prompt: `Nhận diện từ ghép Jukugo thuộc chủ đề "${w.lessonTopic}" (Tuần ${w.week || 'Ôn tập'}, Trang ${w.pageRange || 'N/A'}):`,
          stimulus: w.reading ? `Âm đọc: ${w.reading}` : `Chữ Kanji: ${w.word}`,
          correctAnswer: correctStr,
          options: options.sort((a, b) => a.localeCompare(b)),
          explanation: `${w.word} (${w.reading || '—'}) = ${w.meaningVi}.`,
        };
      });
    }

    if (practiceMode === 'contextual_selection') {
      return wordsWithMeaning.map((w, idx) => {
        const distractors = wordsWithMeaning
          .filter((o) => o.id !== w.id)
          .slice(idx % 18, (idx % 18) + 3)
          .map((d) => d.word);
        const options = Array.from(new Set([w.word, ...distractors])).slice(0, 4);
        return {
          id: `ctx-${w.id}`,
          targetId: w.id,
          modeCategory: 'recognition' as const,
          prompt: `Chọn từ Kanji phù hợp với ngữ cảnh chủ đề "${w.lessonTopic}" mang nghĩa "${w.meaningVi}":`,
          stimulus: `Trong ngữ cảnh [${w.lessonTopic}], để diễn đạt ý "${w.meaningVi}"${
            w.reading ? ` (đọc là ${w.reading})` : ''
          }, ta dùng từ 【 　　 】.`,
          correctAnswer: w.word,
          options: options.sort((a, b) => a.localeCompare(b)),
          explanation: `${w.word} (${w.reading || '—'}) = ${w.meaningVi}.`,
        };
      });
    }

    // Default: kanji_to_meaning
    return wordsWithMeaning.map((w, idx) => {
      const distractors = wordsWithMeaning
        .filter((o) => o.id !== w.id && o.meaningVi !== w.meaningVi)
        .slice(idx % 15, (idx % 15) + 3)
        .map((d) => d.meaningVi!);
      const options = Array.from(new Set([w.meaningVi!, ...distractors])).slice(0, 4);
      return {
        id: `k2m-${w.id}`,
        targetId: w.id,
        modeCategory: 'recognition' as const,
        prompt: `Chọn nghĩa tiếng Việt đúng cho từ Kanji sau (Tuần ${w.week || 'Ôn tập'}, Ngày ${w.dayNumber}):`,
        stimulus: w.word,
        correctAnswer: w.meaningVi!,
        options: options.sort((a, b) => a.localeCompare(b)),
        explanation: `${w.word} ${w.reading ? `(${w.reading})` : ''} = ${w.meaningVi}.`,
      };
    });
  }, [allKanjiWords, practiceMode, kanjiMeta.homophoneGroups]);

  const currentQuestion = practiceQuestions[quizIndex % Math.max(1, practiceQuestions.length)];

  const handleSubmitQuiz = async () => {
    if (!currentQuestion || !selectedOption) return;
    const isCor = selectedOption === currentQuestion.correctAnswer;
    setQuizCorrect(isCor);
    setQuizSubmitted(true);

    await recordKanjiPractice(
      currentQuestion.targetId,
      'word',
      currentQuestion.modeCategory,
      isCor
    );

    if (!isCor) {
      const errCat =
        practiceMode === 'homophone_discrimination'
          ? 'kanji_homophone_confusion'
          : practiceMode === 'similar_char_discrimination'
          ? 'kanji_similar_characters'
          : 'kanji_incorrect_reading';

      await addOrIncrementMistake({
        skill: 'kanji',
        question: `${currentQuestion.prompt} [${currentQuestion.stimulus}]`,
        options: currentQuestion.options,
        incorrectAnswer: selectedOption,
        correctAnswer: currentQuestion.correctAnswer,
        explanation: currentQuestion.explanation,
        source: `Nihongo Soumatome N3 Kanji (${practiceMode})`,
        dayNumber: selectedDayNumber,
        errorCategory: errCat,
        relatedItemId: currentQuestion.targetId,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Progress Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Nihongo Soumatome N3 Kanji
              </span>
              <span className="text-xs text-slate-500">日本語総まとめ N3 漢字</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <Languages className="w-6 h-6 text-amber-600" />
              Phân hệ Kanji N3 — 336 Chữ / 36 Bài / 6 Tuần
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Trọng tâm theo Mục I.3 của lộ trình: <strong>Nhận diện mặt chữ + đọc âm ghép Jukugo; không luyện viết tay</strong>.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSubTab('weeks')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'weeks'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Lịch 6 Tuần × 6 Bài & Thẻ Jukugo
            </button>
            <button
              onClick={() => setActiveSubTab('practice')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'practice'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              7 Chế độ Luyện tập
            </button>
            <button
              onClick={() => setActiveSubTab('special_topics')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'special_topics'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Scale className="w-4 h-4" />
              Chuyên đề Kanji đặc biệt (Ngày 16, 17, 18, 22)
            </button>
          </div>
        </div>

        {/* Kanji Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500">Mục tiêu sách</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.totalTargetKanji} chữ / {stats.totalLessons} bài
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500">Từ ghép Jukugo tiêu biểu</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.listedJukugo} từ ({stats.uniqueKanjiInSource} chữ)
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500">Đã thành thạo (Mastered)</div>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.masteredCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500">Độ chính xác Nhận diện</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.recognitionAccuracy !== null ? `${stats.recognitionAccuracy}%` : '—'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500">Độ chính xác Âm đọc</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {stats.readingAccuracy !== null ? `${stats.readingAccuracy}%` : '—'}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500">Đánh dấu đỏ</div>
            <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-0.5">
              {stats.redCount}
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: WEEKS & JUKUGO CARDS */}
      {activeSubTab === 'weeks' && (
        <div className="space-y-5">
          {/* Week & Lesson Filter */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {kanjiMeta.weeks.map((wk) => (
                <button
                  key={wk.week}
                  onClick={() => {
                    setSelectedWeek(wk.week);
                    setSelectedLesson('all');
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                    selectedWeek === wk.week
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  Tuần {wk.week} (Bài 1–6 & Test tr.{wk.test.pageRange})
                </button>
              ))}
              <button
                onClick={() => setSelectedWeek('red')}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 ${
                  selectedWeek === 'red'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5" />
                Đánh dấu đỏ ({stats.redCount})
              </button>
              <button
                onClick={() => {
                  setSelectedWeek('all');
                  setSelectedLesson('all');
                }}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold ${
                  selectedWeek === 'all'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Tất cả ({allKanjiWords.length})
              </button>
            </div>

            {typeof selectedWeek === 'number' && (
              <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setSelectedLesson('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                    selectedLesson === 'all'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Cả Tuần {selectedWeek}
                </button>
                {kanjiMeta.weeks
                  .find((w) => w.week === selectedWeek)
                  ?.lessons.map((les) => (
                    <button
                      key={les.id}
                      onClick={() => setSelectedLesson(les.lesson)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                        selectedLesson === les.lesson
                          ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      Bài {les.lesson}: {les.topicVi} (tr.{les.pageRange}, Ngày {les.dayNumber})
                    </button>
                  ))}
              </div>
            )}

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm từ ghép Kanji, cách đọc Hiragana, nghĩa tiếng Việt, chủ đề..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
            </div>
          </div>

          {/* Jukugo Card Grid (Active Recall toggle per card) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredWords.map((w) => {
              const prog = kanjiProgressMap[w.id];
              const isRevealed = !!revealedCardIds[w.id];
              const hasTypoFlag = w.flags && w.flags.includes('SOURCE_TYPO_POSSIBLE');

              return (
                <div
                  key={w.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between shadow-sm hover:border-amber-300 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span>
                        {w.week > 0
                          ? `Tuần ${w.week} • Bài ${w.lessons.join('&')} (tr.${w.pageRange})`
                          : `Ôn tập Ngày ${w.dayNumber}`}
                      </span>
                      <div className="flex items-center gap-1">
                        {prog?.mastered && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold">
                            Mastered
                          </span>
                        )}
                        <button
                          onClick={() => toggleKanjiRedMark(w.id, 'word')}
                          className={`p-1.5 rounded-lg border ${
                            prog?.redMarked
                              ? 'bg-rose-50 border-rose-200 text-rose-600 dark:bg-rose-950/50 dark:border-rose-800'
                              : 'border-slate-200 dark:border-slate-700 text-slate-400'
                          }`}
                        >
                          <Bookmark className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 text-2xl font-bold text-slate-900 dark:text-white japanese-text">
                      {w.word}
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-400 font-medium mt-0.5">
                      Chủ đề: {w.lessonTopic} (Ngày {w.dayNumber})
                    </div>

                    {hasTypoFlag && (
                      <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Giữ nguyên văn bản gốc (có ký tự Hán/Hàn tại dòng {w.sourceLine}: "{w.rawText}")</span>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                      {isRevealed ? (
                        <div className="space-y-1 text-sm">
                          <div className="font-semibold text-indigo-600 dark:text-indigo-400 japanese-text">
                            Âm đọc: {w.reading || '（Chưa ghi âm đọc riêng trong lộ trình）'}
                          </div>
                          <div className="text-slate-800 dark:text-slate-200 font-medium">
                            Nghĩa: {w.meaningVi || '（Xem nhóm đối chiếu）'}
                          </div>
                          {w.contrastGroup && (
                            <div className="text-xs text-slate-500 japanese-text">
                              Nhóm đối chiếu: {w.contrastGroup}
                            </div>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() =>
                            setRevealedCardIds((prev) => ({ ...prev, [w.id]: true }))
                          }
                          className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Nhớ lại âm đọc & nghĩa trước khi lật
                        </button>
                      )}
                    </div>
                  </div>

                  {isRevealed && (
                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <button
                        onClick={() => recordKanjiPractice(w.id, 'word', 'reading', false)}
                        className="flex-1 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold"
                      >
                        Quên / Nhầm
                      </button>
                      <button
                        onClick={() => recordKanjiPractice(w.id, 'word', 'reading', true)}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Nhớ chính xác
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: 7 KANJI PRACTICE MODES */}
      {activeSubTab === 'practice' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'kanji_to_reading', label: '1. Kanji → Cách đọc' },
                { id: 'kanji_to_meaning', label: '2. Kanji → Nghĩa Việt' },
                { id: 'meaning_to_kanji', label: '3. Nghĩa Việt → Kanji' },
                { id: 'jukugo_recognition', label: '4. Nhận diện từ ghép Jukugo' },
                { id: 'homophone_discrimination', label: '5. Phân biệt Đồng âm khác nghĩa' },
                { id: 'similar_char_discrimination', label: '6. Phân biệt Kanji giống nét' },
                { id: 'contextual_selection', label: '7. Chọn Kanji theo ngữ cảnh' },
              ] as { id: KanjiPracticeMode; label: string }[]
            ).map((pm) => (
              <button
                key={pm.id}
                onClick={() => {
                  setPracticeMode(pm.id);
                  setQuizIndex(0);
                  setSelectedOption(null);
                  setQuizSubmitted(false);
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  practiceMode === pm.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {pm.label}
              </button>
            ))}
          </div>

          {currentQuestion ? (
            <div className="max-w-2xl mx-auto space-y-5 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Câu {(quizIndex % practiceQuestions.length) + 1} / {practiceQuestions.length}
                </span>
                <span>Loại bài: {currentQuestion.modeCategory === 'reading' ? 'Đọc âm Jukugo' : 'Nhận diện mặt chữ'}</span>
              </div>

              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {currentQuestion.prompt}
              </h3>

              <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-center text-2xl font-bold text-slate-900 dark:text-white japanese-text">
                {currentQuestion.stimulus}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((opt, idx) => {
                  const isSelected = selectedOption === opt;
                  return (
                    <button
                      key={idx}
                      disabled={quizSubmitted}
                      onClick={() => setSelectedOption(opt)}
                      className={`p-3.5 rounded-xl border text-left text-sm font-semibold transition-all japanese-text ${
                        quizSubmitted
                          ? opt === currentQuestion.correctAnswer
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                            : isSelected
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                            : 'border-slate-200 dark:border-slate-800 opacity-60'
                          : isSelected
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-amber-400'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {!quizSubmitted ? (
                <button
                  onClick={handleSubmitQuiz}
                  disabled={!selectedOption}
                  className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-sm font-semibold"
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
                        ? 'Chính xác!'
                        : 'Chưa chính xác — Đã tự động lưu vào Sổ Tay Lỗi Sai!'}
                    </div>
                    <div className="text-xs japanese-text">{currentQuestion.explanation}</div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedOption(null);
                      setQuizSubmitted(false);
                      setQuizIndex((prev) => (prev + 1) % Math.max(1, practiceQuestions.length));
                    }}
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

      {/* TAB 3: SPECIAL KANJI REVISION TOPICS (PART 9.C) */}
      {activeSubTab === 'special_topics' && (
        <div className="space-y-6">
          {/* Homophones Day 22 */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              1. 7 Nhóm Kanji Đồng âm khác nghĩa / Dễ nhầm (Ngày 22 — Mondai 2 Từ vựng, dòng 540–547)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kanjiMeta.homophoneGroups.map((grp) => (
                <div
                  key={grp.id}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-400 japanese-text">
                      Nhóm 「{grp.reading}」
                    </span>
                    <span className="text-xs text-slate-400">Dòng {grp.sourceLine}</span>
                  </div>
                  {grp.flags && grp.flags.includes('MEMBERS_NOT_HOMOPHONES') && (
                    <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-950/40 px-2 py-1 rounded">
                      Lưu ý nguồn: Nhóm này trong lộ trình gom theo hậu tố 費 (消費 شょうひ / 浪費 ろうひ / 経費 けいひ).
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-1.5">
                    {grp.members.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs"
                      >
                        <span className="font-bold text-base text-slate-900 dark:text-white japanese-text">
                          {m.word}
                        </span>
                        <span className="text-slate-600 dark:text-slate-300">{m.meaningVi}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prefixes, Suffixes, Long Vowels/Sokuon/Rendaku, Similar Looking (Days 16, 17, 18) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              2. Chuyên đề Tiền tố (不・無・未・非), Hậu tố (的・性・化・感), Trường âm/Âm ngắt/Biến âm & Chữ giống nét (Ngày 16–18)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kanjiMeta.revisionTopics.map((rt) => {
                const matchingWords = allKanjiWords.filter((w) => rt.taskIds.includes(w.taskId));
                return (
                  <div
                    key={rt.key}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5"
                  >
                    <div className="font-bold text-sm text-slate-900 dark:text-white">
                      {rt.labelVi} ({rt.taskIds.join(', ')})
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {matchingWords.map((mw) => (
                        <span
                          key={mw.id}
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs japanese-text"
                        >
                          <strong>{mw.word}</strong>
                          {mw.reading ? ` (${mw.reading})` : ''}
                          {mw.meaningVi ? `: ${mw.meaningVi}` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
