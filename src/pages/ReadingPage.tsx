import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { ReadingPassageExercise } from '../types';
import {
  FileText,
  Clock,
  BookOpen,
  Compass,
  PlusCircle,
  CheckCircle2,
  Flag,
  Play,
  AlertCircle,
} from 'lucide-react';

const CONNECTOR_REGEX =
  /(しかし|ところが|それなのに|もっとも|ただ|つまり|すなわち|要するに|というのは|しかも|さらに|そのうえ|また)/g;
const DEMONSTRATIVE_REGEX = /(これ|それ|あれ|この|その|あの|こう|そう)/g;

export const ReadingPage: React.FC = () => {
  const {
    readingMeta,
    readingPassages,
    readingAttempts,
    selectedDayNumber,
    taskProgressMap,
    updateTaskStatus,
    saveReadingPassage,
    recordReadingAttempt,
    addOrIncrementMistake,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<
    'schedule' | 'interactive_reader' | 'strategies' | 'log_exercise'
  >('schedule');

  // Interactive reader state
  const [selectedPassageId, setSelectedPassageId] = useState<string>('');
  const [readerMode, setReaderMode] = useState<'study' | 'exam'>('study');
  const [highlightConnectors, setHighlightConnectors] = useState(true);
  const [highlightDemonstratives, setHighlightDemonstratives] = useState(true);
  const [examCountdownSec, setExamCountdownSec] = useState(180);
  const [examRunning, setExamRunning] = useState(false);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [markedForReview, setMarkedForReview] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [errorTags, setErrorTags] = useState<
    ('difficult_vocab' | 'difficult_grammar' | 'incorrect_inference' | 'time_management')[]
  >([]);

  // Quick textbook exercise logger state (for textbook pages where user reads physical book)
  const [logAssignmentId, setLogAssignmentId] = useState<string>(
    readingMeta.assignments[0]?.id || 'rd-d01-01'
  );
  const [logExerciseRef, setLogExerciseRef] = useState<string>('Bài 1');
  const [logDurationMin, setLogDurationMin] = useState<number>(12);
  const [logTotalQ, setLogTotalQ] = useState<number>(4);
  const [logCorrectQ, setLogCorrectQ] = useState<number>(3);
  const [logNotes, setLogNotes] = useState<string>('');
  const [logErrorTags, setLogErrorTags] = useState<
    ('difficult_vocab' | 'difficult_grammar' | 'incorrect_inference' | 'time_management')[]
  >([]);

  // New passage modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newExerciseRef, setNewExerciseRef] = useState('Bài 1 ( 短文 )');
  const [newPassageType, setNewPassageType] =
    useState<ReadingPassageExercise['passageType']>('short');
  const [newTimeLimit, setNewTimeLimit] = useState(3);
  const [newPassageText, setNewPassageText] = useState('');
  const [newFootnotes, setNewFootnotes] = useState('');
  const [newQuestionText, setNewQuestionText] = useState('');
  const [newChoices, setNewChoices] = useState<[string, string, string, string]>([
    '',
    '',
    '',
    '',
  ]);
  const [newAnswerIdx, setNewAnswerIdx] = useState(0);
  const [newExplanation, setNewExplanation] = useState('');

  const activePassage = useMemo(() => {
    if (selectedPassageId) {
      return readingPassages.find((p) => p.id === selectedPassageId) || readingPassages[0] || null;
    }
    return readingPassages[0] || null;
  }, [readingPassages, selectedPassageId]);

  useEffect(() => {
    if (!examRunning || submitted) return;
    const id = window.setInterval(() => {
      setExamCountdownSec((prev) => {
        if (prev <= 1) {
          setExamRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [examRunning, submitted]);

  const startPassageAttempt = (passage: ReadingPassageExercise, mode: 'study' | 'exam') => {
    setSelectedPassageId(passage.id);
    setReaderMode(mode);
    setExamCountdownSec((passage.timeLimitMinutes || 5) * 60);
    setExamRunning(mode === 'exam');
    setCurrentQIdx(0);
    setSelectedAnswers({});
    setMarkedForReview({});
    setSubmitted(false);
    setErrorTags([]);
    setActiveSubTab('interactive_reader');
  };

  const handleSubmitReader = async () => {
    if (!activePassage) return;
    setExamRunning(false);
    setSubmitted(true);

    let correctCount = 0;
    for (const q of activePassage.questions) {
      const ans = selectedAnswers[q.id];
      if (ans === q.answerIndex) {
        correctCount++;
      } else {
        await addOrIncrementMistake({
          skill: 'reading',
          question: `${activePassage.title} — ${q.question}`,
          options: q.choices,
          incorrectAnswer: ans !== undefined ? q.choices[ans] : '(Chưa chọn)',
          correctAnswer: q.choices[q.answerIndex],
          explanation: q.explanation,
          source: `${activePassage.source} (${activePassage.exerciseRef})`,
          dayNumber: selectedDayNumber,
          errorCategory: 'reading_incorrect_inference',
          relatedItemId: activePassage.id,
        });
      }
    }

    const totalSec = Math.max(
      10,
      (activePassage.timeLimitMinutes || 5) * 60 - examCountdownSec
    );

    await recordReadingAttempt({
      exerciseId: activePassage.id,
      assignmentId: activePassage.assignmentId,
      mode: readerMode,
      durationSeconds: totalSec,
      totalQuestions: activePassage.questions.length,
      correctAnswers: correctCount,
      answers: selectedAnswers,
      errorClassifications: errorTags,
      notes: '',
    });
  };

  const handleSaveTextbookLog = async (e: React.FormEvent) => {
    e.preventDefault();
    await recordReadingAttempt({
      exerciseId: logExerciseRef,
      assignmentId: logAssignmentId,
      mode: 'exam',
      durationSeconds: logDurationMin * 60,
      totalQuestions: logTotalQ,
      correctAnswers: logCorrectQ,
      answers: {},
      errorClassifications: logErrorTags,
      notes: logNotes,
    });
    setLogNotes('');
    alert('Đã lưu kết quả luyện đọc hiểu vào lịch sử!');
  };

  const handleCreatePassage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPassageText.trim() || !newQuestionText.trim()) return;
    const created: ReadingPassageExercise = {
      id: `rp-user-${Date.now()}`,
      source: 'User Imported (Shinkanzen / Speed Master)',
      textbookId: 'speed_dokkai',
      assignmentId: null,
      exerciseRef: newExerciseRef,
      passageType: newPassageType,
      title: newTitle.trim(),
      passage: newPassageText.trim(),
      footnotes: newFootnotes.trim() || null,
      timeLimitMinutes: newTimeLimit,
      keyVocabulary: [],
      sentenceAnalysis: [],
      questions: [
        {
          id: `rq-${Date.now()}`,
          question: newQuestionText.trim(),
          choices: newChoices,
          answerIndex: newAnswerIdx,
          explanation: newExplanation.trim() || 'Giải thích do người học nhập.',
          questionType: 'main_idea',
        },
      ],
    };
    await saveReadingPassage(created);
    setShowAddModal(false);
    startPassageAttempt(created, 'study');
  };

  // Render passage with optional connector & demonstrative highlighting in Study Mode
  const renderHighlightedPassage = (text: string) => {
    if (readerMode === 'exam' || (!highlightConnectors && !highlightDemonstratives)) {
      return <p className="whitespace-pre-line leading-loose text-base japanese-text">{text}</p>;
    }
    const parts = text.split(
      /(しかし|ところが|それなのに|もっとも|ただ|つまり|すなわち|要するに|というのは|しかも|さらに|そのうえ|また|これ|それ|あれ|この|その|あの|こう|そう)/g
    );
    return (
      <p className="whitespace-pre-line leading-loose text-base japanese-text">
        {parts.map((part, idx) => {
          if (highlightConnectors && CONNECTOR_REGEX.test(part)) {
            return (
              <mark
                key={idx}
                className="px-1 py-0.5 rounded bg-amber-200/80 dark:bg-amber-800/70 text-amber-950 dark:text-amber-100 font-bold"
                title="Từ nối (接続詞) quyết định mạch logic"
              >
                {part}
              </mark>
            );
          }
          if (highlightDemonstratives && DEMONSTRATIVE_REGEX.test(part)) {
            return (
              <mark
                key={idx}
                className="px-1 py-0.5 rounded bg-sky-200/80 dark:bg-sky-800/70 text-sky-950 dark:text-sky-100 font-bold underline decoration-sky-500"
                title="Từ chỉ thị こ・そ・あ (Đáp án thường nằm ngay câu trước それ/その/そう)"
              >
                {part}
              </mark>
            );
          }
          return <React.Fragment key={idx}>{part}</React.Fragment>;
        })}
      </p>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                Ngày 1–7: 新完全マスター N3 読解
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
                Ngày 8–22: スピードマスター N3 読解 (Bài 1–45 & Đề 1–2)
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <FileText className="w-6 h-6 text-emerald-600" />
              Phân hệ Đọc hiểu N3 (Reading Module)
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Đoạn ngắn (Bài 1–20: 2.5–3p/bài) • Đoạn trung (Bài 21–32: 7–8p/bài) • Đoạn dài (Bài 33–38: 12–14p/bài) • Tìm kiếm thông tin (Bài 39–45: làm ĐẦU TIÊN).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSubTab('schedule')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'schedule'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              20 Bài giao theo Lộ trình
            </button>
            <button
              onClick={() => setActiveSubTab('interactive_reader')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'interactive_reader'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Play className="w-4 h-4" />
              Trình đọc Study / Exam Mode ({readingPassages.length})
            </button>
            <button
              onClick={() => setActiveSubTab('strategies')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'strategies'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Compass className="w-4 h-4" />
              17 Chiến thuật Đọc hiểu
            </button>
            <button
              onClick={() => setActiveSubTab('log_exercise')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'log_exercise'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              Ghi nhận kết quả làm sách ({readingAttempts.length})
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: ASSIGNED SCHEDULE */}
      {activeSubTab === 'schedule' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {readingMeta.passageTypes.map((pt) => (
              <div
                key={pt.type}
                className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
              >
                <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {pt.typeJa} — {pt.labelVi}
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  Speed Master Bài {pt.exercises}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {readingMeta.assignments.map((asgn) => {
              const tp = taskProgressMap[asgn.taskId];
              const isCompleted = tp?.status === 'completed';
              return (
                <div
                  key={asgn.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        Ngày {asgn.dayNumber}
                      </span>
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        {asgn.textbookIds.includes('shinkanzen_dokkai')
                          ? 'Shinkanzen Master N3 Dokkai'
                          : 'Speed Master N3 Dokkai'}
                      </span>
                      {asgn.pageRanges.length > 0 && (
                        <span className="text-xs text-slate-500">
                          Trang: {asgn.pageRanges.join(', ')}
                        </span>
                      )}
                      {asgn.target && (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          Chỉ tiêu: {asgn.target}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {asgn.title}
                    </h3>
                    <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      {asgn.instructions.map((inst, i) => (
                        <li key={i} className="japanese-text">
                          {inst}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setLogAssignmentId(asgn.id);
                        setLogExerciseRef(asgn.title);
                        setActiveSubTab('log_exercise');
                      }}
                      className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      Ghi điểm & thời gian
                    </button>
                    <button
                      onClick={() =>
                        updateTaskStatus(
                          asgn.taskId,
                          isCompleted ? 'not_started' : 'completed'
                        )
                      }
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                        isCompleted
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isCompleted ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: INTERACTIVE READER (STUDY MODE & EXAM MODE) */}
      {activeSubTab === 'interactive_reader' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activePassage?.id || ''}
                onChange={(e) => {
                  const found = readingPassages.find((p) => p.id === e.target.value);
                  if (found) startPassageAttempt(found, readerMode);
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                {readingPassages.length === 0 && (
                  <option value="">-- Chưa có bài đọc nhập vào (Bấm "+ Nhập bài đọc") --</option>
                )}
                {readingPassages.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.exerciseRef}] {p.title} ({p.timeLimitMinutes} phút)
                  </option>
                ))}
              </select>

              <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  onClick={() => {
                    setReaderMode('study');
                    setExamRunning(false);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    readerMode === 'study'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Study Mode (Phân tích câu & Từ nối)
                </button>
                <button
                  onClick={() => {
                    setReaderMode('exam');
                    if (activePassage) {
                      setExamCountdownSec((activePassage.timeLimitMinutes || 5) * 60);
                      setExamRunning(true);
                    }
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    readerMode === 'exam'
                      ? 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Exam Mode (Đồng hồ đếm ngược)
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              + Nhập bài đọc từ sách
            </button>
          </div>

          {activePassage ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Passage Viewer */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div>
                    <span className="text-xs font-semibold text-emerald-600">
                      {activePassage.exerciseRef} • Giới hạn {activePassage.timeLimitMinutes} phút
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {activePassage.title}
                    </h3>
                  </div>
                  {readerMode === 'exam' && (
                    <div className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-mono text-sm font-bold flex items-center gap-1.5">
                      <Clock className="w-4 h-4" />
                      {Math.floor(examCountdownSec / 60)}:
                      {String(examCountdownSec % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>

                {readerMode === 'study' && (
                  <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={highlightConnectors}
                        onChange={(e) => setHighlightConnectors(e.target.checked)}
                      />
                      <span className="px-1.5 py-0.5 rounded bg-amber-200/80 dark:bg-amber-800 text-amber-950 dark:text-amber-100 font-semibold">
                        Tô sáng Từ nối (接続詞)
                      </span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={highlightDemonstratives}
                        onChange={(e) => setHighlightDemonstratives(e.target.checked)}
                      />
                      <span className="px-1.5 py-0.5 rounded bg-sky-200/80 dark:bg-sky-800 text-sky-950 dark:text-sky-100 font-semibold">
                        Tô sáng Từ chỉ thị (こ・そ・あ)
                      </span>
                    </label>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                  {renderHighlightedPassage(activePassage.passage)}
                  {activePassage.footnotes && (
                    <div className="mt-4 pt-3 border-t border-dashed border-amber-400 text-xs text-amber-800 dark:text-amber-300 japanese-text">
                      <strong>※ Chú thích / 注 (Lưu ý bẫy Mondai 7):</strong> {activePassage.footnotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Questions & Navigation */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {activePassage.questions.map((q, idx) => (
                      <button
                        key={q.id}
                        onClick={() => setCurrentQIdx(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                          currentQIdx === idx
                            ? 'bg-emerald-600 text-white'
                            : selectedAnswers[q.id] !== undefined
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                        }`}
                      >
                        Câu {idx + 1}
                        {markedForReview[q.id] && <Flag className="w-3 h-3 text-amber-500" />}
                      </button>
                    ))}
                  </div>

                  {activePassage.questions[currentQIdx] && (
                    <button
                      onClick={() => {
                        const qid = activePassage.questions[currentQIdx].id;
                        setMarkedForReview((prev) => ({ ...prev, [qid]: !prev[qid] }));
                      }}
                      className="text-xs text-amber-600 flex items-center gap-1 hover:underline"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      Đánh dấu xem lại
                    </button>
                  )}
                </div>

                {activePassage.questions[currentQIdx] && (
                  <div className="space-y-4">
                    <h4 className="text-base font-bold text-slate-900 dark:text-white japanese-text">
                      {activePassage.questions[currentQIdx].question}
                    </h4>

                    <div className="space-y-2.5">
                      {activePassage.questions[currentQIdx].choices.map((ch, cIdx) => {
                        const q = activePassage.questions[currentQIdx];
                        const isSel = selectedAnswers[q.id] === cIdx;
                        return (
                          <button
                            key={cIdx}
                            disabled={submitted}
                            onClick={() =>
                              setSelectedAnswers((prev) => ({ ...prev, [q.id]: cIdx }))
                            }
                            className={`w-full p-3.5 rounded-xl border text-left text-sm font-medium japanese-text ${
                              submitted
                                ? cIdx === q.answerIndex
                                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                                  : isSel
                                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                                  : 'border-slate-200 dark:border-slate-800 opacity-60'
                                : isSel
                                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                                : 'border-slate-200 dark:border-slate-700 hover:border-emerald-300'
                            }`}
                          >
                            {cIdx + 1}. {ch}
                          </button>
                        );
                      })}
                    </div>

                    {submitted && (
                      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                        <div className="font-bold text-slate-900 dark:text-white">
                          Giải thích chi tiết:
                        </div>
                        <div className="text-slate-600 dark:text-slate-300 japanese-text">
                          {activePassage.questions[currentQIdx].explanation}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!submitted && (
                  <button
                    onClick={handleSubmitReader}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                  >
                    Nộp bài & Chấm điểm
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Không tạo bài đọc giả (Quy tắc toàn vẹn dữ liệu nguồn)
              </h3>
              <p className="text-xs text-slate-500 max-w-xl mx-auto">
                Theo đúng yêu cầu hệ thống, ứng dụng không tự bịa văn bản bài đọc ngoài giáo trình. Bạn có thể bấm <strong>"+ Nhập bài đọc từ sách"</strong> để dán đoạn văn từ sách Shinkanzen / Speed Master vào trình đọc tương tác, hoặc dùng tab <strong>"Ghi nhận kết quả làm sách"</strong>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: 17 READING STRATEGIES PANEL (PART 10.C) */}
      {activeSubTab === 'strategies' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Sổ tay 17 Chiến thuật Đọc hiểu trích xuất nguyên bản từ Lộ trình 25 ngày
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {readingMeta.strategies.map((st) => (
              <div
                key={st.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    Ngày {st.dayNumber} • {st.titleVi}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Dòng {st.sourceLines.join(', ')}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed japanese-text">
                  {st.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: TEXTBOOK PERFORMANCE LOGGER (PART 10.D) */}
      {activeSubTab === 'log_exercise' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveTextbookLog}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Ghi nhận kết quả làm bài Đọc hiểu trên sách (Shinkanzen / Speed Master)
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Bài giao trong lộ trình
              </label>
              <select
                value={logAssignmentId}
                onChange={(e) => setLogAssignmentId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                {readingMeta.assignments.map((a) => (
                  <option key={a.id} value={a.id}>
                    Ngày {a.dayNumber}: {a.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Số hiệu bài (VD: Bài 1–3, Bài 39–45)
                </label>
                <input
                  type="text"
                  value={logExerciseRef}
                  onChange={(e) => setLogExerciseRef(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Thời gian làm thực tế (phút)
                </label>
                <input
                  type="number"
                  min={1}
                  value={logDurationMin}
                  onChange={(e) => setLogDurationMin(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Số câu đúng
                </label>
                <input
                  type="number"
                  min={0}
                  value={logCorrectQ}
                  onChange={(e) => setLogCorrectQ(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Tổng số câu
                </label>
                <input
                  type="number"
                  min={1}
                  value={logTotalQ}
                  onChange={(e) => setLogTotalQ(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Phân loại nguyên nhân sai (Part 10.D)
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: 'difficult_vocab', label: 'Từ vựng khó' },
                    { id: 'difficult_grammar', label: 'Ngữ pháp khó' },
                    { id: 'incorrect_inference', label: 'Suy luận sai / Bẫy' },
                    { id: 'time_management', label: 'Thiếu thời gian' },
                  ] as const
                ).map((tag) => {
                  const active = logErrorTags.includes(tag.id);
                  return (
                    <button
                      type="button"
                      key={tag.id}
                      onClick={() =>
                        setLogErrorTags((prev) =>
                          prev.includes(tag.id)
                            ? prev.filter((x) => x !== tag.id)
                            : [...prev, tag.id]
                        )
                      }
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        active
                          ? 'bg-rose-50 border-rose-400 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600'
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              Lưu nhật ký luyện Đọc hiểu
            </button>
          </form>

          {/* Attempt History */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Lịch sử làm bài Đọc hiểu ({readingAttempts.length})
            </h3>
            <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
              {readingAttempts.map((att) => (
                <div
                  key={att.id}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white">
                      {att.exerciseId} ({att.mode === 'exam' ? 'Exam' : 'Study'})
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      Thời gian: {Math.round(att.durationSeconds / 60)} phút • Lỗi:{' '}
                      {att.errorClassifications.join(', ') || 'Không'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-600">
                      {att.correctAnswers}/{att.totalQuestions} (
                      {Math.round((att.correctAnswers / Math.max(1, att.totalQuestions)) * 100)}%)
                    </div>
                  </div>
                </div>
              ))}
              {readingAttempts.length === 0 && (
                <div className="text-xs text-slate-500 py-8 text-center">
                  Chưa có lượt làm bài đọc hiểu nào được ghi lại.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Reading Passage */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreatePassage}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-xl w-full space-y-3 max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Nhập bài Đọc hiểu từ giáo trình
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Tiêu đề (VD: Speed Master Đoạn ngắn Bài 4)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
              <input
                type="text"
                placeholder="Mã bài (VD: SM-04)"
                value={newExerciseRef}
                onChange={(e) => setNewExerciseRef(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newPassageType}
                onChange={(e) =>
                  setNewPassageType(e.target.value as ReadingPassageExercise['passageType'])
                }
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value="short">Đoạn ngắn (短文 - 3 phút)</option>
                <option value="medium">Đoạn trung (中文 - 7–8 phút)</option>
                <option value="long">Đoạn dài (長文 - 12–14 phút)</option>
                <option value="info_retrieval">Tìm kiếm thông tin (情報検索 - 7 phút)</option>
              </select>
              <input
                type="number"
                min={1}
                value={newTimeLimit}
                onChange={(e) => setNewTimeLimit(Number(e.target.value))}
                placeholder="Giới hạn phút"
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <textarea
              rows={5}
              placeholder="Nội dung đoạn văn tiếng Nhật..."
              value={newPassageText}
              onChange={(e) => setNewPassageText(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
            />
            <input
              type="text"
              placeholder="Chú thích ※ / 注 (nếu có)"
              value={newFootnotes}
              onChange={(e) => setNewFootnotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
            />
            <input
              type="text"
              placeholder="Câu hỏi..."
              value={newQuestionText}
              onChange={(e) => setNewQuestionText(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
            />
            <div className="grid grid-cols-2 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Đáp án ${i + 1}`}
                  value={newChoices[i]}
                  onChange={(e) => {
                    const copy: [string, string, string, string] = [...newChoices] as [
                      string,
                      string,
                      string,
                      string
                    ];
                    copy[i] = e.target.value;
                    setNewChoices(copy);
                  }}
                  required
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={newAnswerIdx}
                onChange={(e) => setNewAnswerIdx(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value={0}>Đáp án đúng: Câu 1</option>
                <option value={1}>Đáp án đúng: Câu 2</option>
                <option value={2}>Đáp án đúng: Câu 3</option>
                <option value={3}>Đáp án đúng: Câu 4</option>
              </select>
              <input
                type="text"
                placeholder="Giải thích đáp án..."
                value={newExplanation}
                onChange={(e) => setNewExplanation(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold"
              >
                Lưu bài đọc
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
