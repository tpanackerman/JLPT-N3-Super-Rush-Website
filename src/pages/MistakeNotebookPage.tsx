import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { MistakeErrorCategory, MistakeRecord } from '../types';
import {
  AlertTriangle,
  Play,
  PlusCircle,
  CheckCircle2,
  Trash2,
  RotateCcw,
  Flame,
} from 'lucide-react';

export const ERROR_CATEGORY_LABELS: Record<MistakeErrorCategory, string> = {
  // Vocabulary
  vocab_unknown_word: 'Từ vựng: Chưa biết từ (Unknown word)',
  vocab_incorrect_reading: 'Từ vựng: Nhầm cách đọc (Incorrect reading)',
  vocab_confused_synonym: 'Từ vựng: Nhầm từ gần nghĩa (Confused synonym)',
  vocab_incorrect_contextual_meaning: 'Từ vựng: Sai nghĩa ngữ cảnh (Contextual meaning)',
  // Grammar
  grammar_incorrect_formation: 'Ngữ pháp: Chia sai thể nối (Incorrect formation)',
  grammar_confused_pattern: 'Ngữ pháp: Nhầm mẫu câu tương tự (Confused pattern)',
  grammar_incorrect_particle: 'Ngữ pháp: Dùng sai trợ từ (Incorrect particle)',
  grammar_incorrect_sentence_structure: 'Ngữ pháp: Sai cấu trúc câu ★ (Sentence structure)',
  // Kanji
  kanji_similar_characters: 'Kanji: Nhìn nhầm chữ giống nét (Similar characters)',
  kanji_incorrect_reading: 'Kanji: Đọc sai âm On/Kun/Biến âm (Incorrect reading)',
  kanji_homophone_confusion: 'Kanji: Nhầm từ đồng âm khác nghĩa (Homophone confusion)',
  // Reading
  reading_missed_keyword: 'Đọc hiểu: Bỏ sót từ khóa (Missed keyword)',
  reading_incorrect_inference: 'Đọc hiểu: Suy luận chủ quan sai (Incorrect inference)',
  reading_misunderstood_connector: 'Đọc hiểu: Hiểu sai từ nối (Misunderstood connector)',
  reading_misidentified_subject: 'Đọc hiểu: Xác định sai chủ ngữ ẩn (Misidentified subject)',
  reading_distractor_selection: 'Đọc hiểu: Dính bẫy đáp án nhiễu すべて/いつも (Distractor selection)',
  // Listening
  listening_missed_keyword: 'Nghe hiểu: Không bắt được từ khóa (Missed keyword)',
  listening_unknown_expression: 'Nghe hiểu: Không biết biểu hiện/kính ngữ (Unknown expression)',
  listening_incorrect_interpretation: 'Nghe hiểu: Hiểu sai tình huống (Incorrect interpretation)',
  listening_missed_speaker_intention: 'Nghe hiểu: Không nắm được ý định người nói (Speaker intention)',
  listening_conversation_tracking: 'Nghe hiểu: Mất dấu khi đổi ý やっぱり/ただし (Conversation tracking)',
};

export const MistakeNotebookPage: React.FC = () => {
  const {
    mistakes,
    selectedDayNumber,
    addOrIncrementMistake,
    updateMistakeStatus,
    deleteMistake,
  } = useApp();

  const [viewMode, setViewMode] = useState<'list' | 'repractice' | 'add_manual'>('list');
  const [skillFilter, setSkillFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('unresolved_or_reviewing');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  // Re-practice state
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);

  // Manual mistake form state
  const [mSkill, setMSkill] = useState<MistakeRecord['skill']>('vocabulary');
  const [mCategory, setMCategory] = useState<MistakeErrorCategory>('vocab_unknown_word');
  const [mQuestion, setMQuestion] = useState('');
  const [mWrong, setMWrong] = useState('');
  const [mCorrect, setMCorrect] = useState('');
  const [mExplanation, setMExplanation] = useState('');
  const [mSource, setMSource] = useState('Đề thi thử / Giáo trình');

  const uniqueSources = useMemo(() => {
    return Array.from(new Set(mistakes.map((m) => m.source)));
  }, [mistakes]);

  const filteredMistakes = useMemo(() => {
    return mistakes
      .filter((m) => {
        if (skillFilter !== 'all' && m.skill !== skillFilter) return false;
        if (statusFilter === 'unresolved_or_reviewing') {
          if (m.reviewStatus === 'resolved') return false;
        } else if (statusFilter !== 'all' && m.reviewStatus !== statusFilter) {
          return false;
        }
        if (sourceFilter !== 'all' && m.source !== sourceFilter) return false;
        return true;
      })
      .sort((a, b) => b.repeatedFailures - a.repeatedFailures);
  }, [mistakes, skillFilter, statusFilter, sourceFilter]);

  const mostRepeated = useMemo(() => {
    return [...mistakes]
      .filter((m) => m.reviewStatus !== 'resolved')
      .sort((a, b) => b.repeatedFailures - a.repeatedFailures)
      .slice(0, 5);
  }, [mistakes]);

  const todayMistakesCount = useMemo(() => {
    const todayIso = new Date().toISOString().slice(0, 10);
    return mistakes.filter(
      (m) => m.lastFailedAt.slice(0, 10) === todayIso || m.dayNumber === selectedDayNumber
    ).length;
  }, [mistakes, selectedDayNumber]);

  const activePracticeItem =
    filteredMistakes[practiceIdx % Math.max(1, filteredMistakes.length)] || null;

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mQuestion.trim() || !mCorrect.trim()) return;
    await addOrIncrementMistake({
      skill: mSkill,
      question: mQuestion.trim(),
      incorrectAnswer: mWrong.trim() || '(Sai)',
      correctAnswer: mCorrect.trim(),
      explanation: mExplanation.trim() || 'Ghi chú cá nhân',
      source: mSource.trim() || 'Tự nhập',
      dayNumber: selectedDayNumber,
      errorCategory: mCategory,
    });
    setMQuestion('');
    setMWrong('');
    setMCorrect('');
    setMExplanation('');
    setViewMode('list');
  };

  return (
    <div className="space-y-6">
      {/* Header & Summary */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
              Mistake Notebook — Sổ Tay Lỗi Sai Tập Trung (Part 12)
            </span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-rose-600" />
              Sổ Tay Lỗi Sai & Luyện Lại Chủ Động
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Tự động thu thập mọi câu trả lời sai từ Từ vựng, Ngữ pháp, Kanji, Đọc hiểu, Nghe hiểu và cho phép luyện lại trực tiếp.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${
                viewMode === 'list'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Danh sách lỗi sai ({filteredMistakes.length})
            </button>
            <button
              onClick={() => {
                setViewMode('repractice');
                setPracticeIdx(0);
                setUserAnswer('');
                setRevealed(false);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                viewMode === 'repractice'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Play className="w-4 h-4" />
              Luyện lại ngay từ Sổ tay
            </button>
            <button
              onClick={() => setViewMode('add_manual')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                viewMode === 'add_manual'
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              + Ghi lỗi sai từ sách/đề giấy
            </button>
          </div>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="text-xs text-slate-500">Tổng lỗi đã ghi</div>
            <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {mistakes.length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30">
            <div className="text-xs text-rose-600 dark:text-rose-400">Chưa khắc phục (Unresolved)</div>
            <div className="text-lg font-bold text-rose-700 dark:text-rose-300 mt-0.5">
              {mistakes.filter((m) => m.reviewStatus !== 'resolved').length}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30">
            <div className="text-xs text-amber-700 dark:text-amber-400">Lỗi phát sinh hôm nay / Ngày {selectedDayNumber}</div>
            <div className="text-lg font-bold text-amber-800 dark:text-amber-300 mt-0.5">
              {todayMistakesCount}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30">
            <div className="text-xs text-emerald-700 dark:text-emerald-400">Đã xử lý triệt để (Resolved)</div>
            <div className="text-lg font-bold text-emerald-800 dark:text-emerald-300 mt-0.5">
              {mistakes.filter((m) => m.reviewStatus === 'resolved').length}
            </div>
          </div>
        </div>
      </div>

      {/* Most Repeated Mistakes Highlight */}
      {mostRepeated.length > 0 && viewMode === 'list' && (
        <div className="bg-rose-50/60 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-800/60 p-4 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
            <Flame className="w-4 h-4" />
            Top lỗi sai lặp lại nhiều lần nhất cần xử lý ngay
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {mostRepeated.map((m) => (
              <div
                key={m.id}
                className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-800/60 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase text-rose-600">
                    Sai {m.repeatedFailures} lần • {m.skill}
                  </span>
                  <span className="text-[11px] text-slate-400">{m.source}</span>
                </div>
                <div className="font-semibold text-slate-900 dark:text-white japanese-text truncate">
                  {m.question}
                </div>
                <div className="text-emerald-700 dark:text-emerald-400 japanese-text">
                  Đúng: {m.correctAnswer}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 1: MISTAKE LIST WITH FILTERS */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center gap-3">
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="all">Tất cả kỹ năng (5 kỹ năng)</option>
              <option value="vocabulary">Từ vựng (Vocabulary)</option>
              <option value="grammar">Ngữ pháp (Grammar)</option>
              <option value="kanji">Chữ Hán (Kanji)</option>
              <option value="reading">Đọc hiểu (Reading)</option>
              <option value="listening">Nghe hiểu (Listening)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="unresolved_or_reviewing">Chưa giải quyết / Đang ôn</option>
              <option value="unresolved">Chỉ lỗi Chưa giải quyết (Unresolved)</option>
              <option value="reviewing">Đang ôn lại (Reviewing)</option>
              <option value="resolved">Đã khắc phục (Resolved)</option>
              <option value="all">Tất cả trạng thái</option>
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="all">Tất cả nguồn tài liệu</option>
              {uniqueSources.map((src) => (
                <option key={src} value={src}>
                  {src}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {filteredMistakes.map((m) => (
              <div
                key={m.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                      {m.skill} • Sai {m.repeatedFailures} lần
                    </span>
                    <span className="px-2.5 py-0.5 rounded-md text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {ERROR_CATEGORY_LABELS[m.errorCategory] || m.errorCategory}
                    </span>
                    <span className="text-xs text-slate-400">
                      Nguồn: {m.source} • Ngày {m.dayNumber || '—'} ({m.lastFailedAt.slice(0, 10)})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={m.reviewStatus}
                      onChange={(e) =>
                        updateMistakeStatus(
                          m.id,
                          e.target.value as MistakeRecord['reviewStatus']
                        )
                      }
                      className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                    >
                      <option value="unresolved">Chưa khắc phục</option>
                      <option value="reviewing">Đang ôn tập</option>
                      <option value="resolved">Đã thuộc lòng</option>
                    </select>
                    <button
                      onClick={() => deleteMistake(m.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600"
                      title="Xóa lỗi"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white japanese-text">
                  {m.question}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                    <span className="font-bold text-rose-700 dark:text-rose-300">
                      Đáp án đã chọn (Sai):{' '}
                    </span>
                    <span className="japanese-text text-slate-800 dark:text-slate-200">
                      {m.incorrectAnswer}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      Đáp án đúng:{' '}
                    </span>
                    <span className="japanese-text font-semibold text-slate-900 dark:text-white">
                      {m.correctAnswer}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl whitespace-pre-line japanese-text">
                  <strong>Giải thích:</strong> {m.explanation}
                </div>
              </div>
            ))}

            {filteredMistakes.length === 0 && (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center text-sm text-slate-500">
                Không có lỗi sai nào trong bộ lọc hiện tại. Khi bạn làm sai câu hỏi ở bất kỳ phân hệ nào, lỗi sẽ tự động xuất hiện tại đây!
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: RE-PRACTICE DIRECTLY FROM NOTEBOOK */}
      {viewMode === 'repractice' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
          {activePracticeItem ? (
            <div className="max-w-2xl mx-auto space-y-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Luyện lại lỗi {(practiceIdx % filteredMistakes.length) + 1} /{' '}
                  {filteredMistakes.length}
                </span>
                <span className="font-bold text-rose-600">
                  Đã sai {activePracticeItem.repeatedFailures} lần ({activePracticeItem.skill})
                </span>
              </div>

              <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="text-xs text-slate-400">
                  {ERROR_CATEGORY_LABELS[activePracticeItem.errorCategory]}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white japanese-text">
                  {activePracticeItem.question}
                </h3>
                <div className="text-xs text-rose-600">
                  Lần trước bạn đã chọn nhầm: <strong>{activePracticeItem.incorrectAnswer}</strong>
                </div>
              </div>

              {activePracticeItem.options && activePracticeItem.options.length > 0 ? (
                <div className="grid grid-cols-1 gap-2.5">
                  {activePracticeItem.options.map((opt, idx) => (
                    <button
                      key={idx}
                      disabled={revealed}
                      onClick={() => {
                        setUserAnswer(opt);
                        setRevealed(true);
                      }}
                      className={`p-3.5 rounded-xl border text-left text-sm font-medium japanese-text ${
                        revealed
                          ? opt === activePracticeItem.correctAnswer
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                            : userAnswer === opt
                            ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                            : 'border-slate-200 dark:border-slate-800 opacity-60'
                          : 'border-slate-200 dark:border-slate-700 hover:border-rose-400'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder="Tự gõ câu trả lời đúng trước khi lật đáp án..."
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm japanese-text"
                  />
                  {!revealed && (
                    <button
                      onClick={() => setRevealed(true)}
                      className="w-full py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold"
                    >
                      Đối chiếu đáp án
                    </button>
                  )}
                </div>
              )}

              {revealed && (
                <div className="space-y-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 japanese-text">
                    Đáp án đúng: {activePracticeItem.correctAnswer}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line japanese-text">
                    {activePracticeItem.explanation}
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={async () => {
                        await addOrIncrementMistake({
                          skill: activePracticeItem.skill,
                          question: activePracticeItem.question,
                          options: activePracticeItem.options,
                          incorrectAnswer: userAnswer || activePracticeItem.incorrectAnswer,
                          correctAnswer: activePracticeItem.correctAnswer,
                          explanation: activePracticeItem.explanation,
                          source: activePracticeItem.source,
                          dayNumber: selectedDayNumber,
                          errorCategory: activePracticeItem.errorCategory,
                        });
                        setRevealed(false);
                        setUserAnswer('');
                        setPracticeIdx((i) => i + 1);
                      }}
                      className="flex-1 py-2 rounded-xl bg-rose-100 text-rose-800 text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Vẫn nhầm (+1 lần sai)
                    </button>
                    <button
                      onClick={async () => {
                        await updateMistakeStatus(activePracticeItem.id, 'resolved');
                        setRevealed(false);
                        setUserAnswer('');
                      }}
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã nhớ chắc chắn (Đánh dấu Resolved)
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-10 text-center text-sm text-slate-500">
              Không có lỗi sai nào cần luyện lại!
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: MANUAL ADD MISTAKE */}
      {viewMode === 'add_manual' && (
        <form
          onSubmit={handleManualAdd}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-2xl space-y-4"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Thêm lỗi sai thủ công từ sách giáo trình hoặc đề thi thử
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Kỹ năng</label>
              <select
                value={mSkill}
                onChange={(e) => setMSkill(e.target.value as MistakeRecord['skill'])}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value="vocabulary">Từ vựng (Vocabulary)</option>
                <option value="grammar">Ngữ pháp (Grammar)</option>
                <option value="kanji">Chữ Hán (Kanji)</option>
                <option value="reading">Đọc hiểu (Reading)</option>
                <option value="listening">Nghe hiểu (Listening)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Phân loại nguyên nhân lỗi (21 nhóm chuẩn Part 12)
              </label>
              <select
                value={mCategory}
                onChange={(e) => setMCategory(e.target.value as MistakeErrorCategory)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                {(Object.keys(ERROR_CATEGORY_LABELS) as MistakeErrorCategory[]).map((cat) => (
                  <option key={cat} value={cat}>
                    {ERROR_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Câu hỏi / Từ / Mẫu câu bị sai
            </label>
            <input
              type="text"
              required
              value={mQuestion}
              onChange={(e) => setMQuestion(e.target.value)}
              placeholder="Nhập câu hỏi hoặc từ/mẫu ngữ pháp..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Đáp án sai đã chọn
              </label>
              <input
                type="text"
                value={mWrong}
                onChange={(e) => setMWrong(e.target.value)}
                placeholder="VD: ～間に"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Đáp án đúng
              </label>
              <input
                type="text"
                required
                value={mCorrect}
                onChange={(e) => setMCorrect(e.target.value)}
                placeholder="VD: ～うちに"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nguồn (Sách / Đề thi số mấy)
              </label>
              <input
                type="text"
                value={mSource}
                onChange={(e) => setMSource(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Giải thích / Mẹo nhớ
              </label>
              <input
                type="text"
                value={mExplanation}
                onChange={(e) => setMExplanation(e.target.value)}
                placeholder="Tại sao sai & quy tắc cần nhớ..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
          >
            Lưu vào Sổ Tay Lỗi Sai
          </button>
        </form>
      )}
    </div>
  );
};
