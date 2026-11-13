import React, { useMemo } from 'react';
import {
  Calendar,
  Clock,
  Target,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  SplitSquareVertical,
  Languages,
  Headphones,
  Award,
  Sparkles,
  Play,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TaskCard } from '../components/TaskCard';
import { formatIsoToViDate } from '../utils/dateUtils';
import type { SkillType } from '../types';

const GROUP_ORDER: { key: SkillType | 'revision_general'; label: string }[] = [
  { key: 'vocabulary', label: '1. Từ vựng (Mimi kara Oboeru N3 Goi)' },
  { key: 'kanji', label: '2. Kanji (Nihongo Soumatome N3 Kanji)' },
  { key: 'grammar', label: '3. Ngữ pháp (Mimi kara Oboeru N3 Bunpou)' },
  { key: 'reading', label: '4. Đọc hiểu (Shinkanzen & Speed Master Dokkai)' },
  { key: 'listening', label: '5. Nghe hiểu (Choukai)' },
  { key: 'revision_general', label: '6. Ôn tập, Thi thử & Nhiệm vụ chung' },
];

export const DashboardPage: React.FC = () => {
  const {
    phases,
    days,
    allTasks,
    selectedDayNumber,
    setSelectedDayNumber,
    dateStatus,
    taskProgressMap,
    adjustments,
    togglePersonalAdjustmentComplete,
    srsCardsMap,
    grammarProgressMap,
    kanjiProgressMap,
    readingAttempts,
    listeningAttempts,
    mockAttempts,
    studySessions,
    recommendations,
    setActiveTab,
    startTimerForTask,
  } = useApp();

  const currentDay = useMemo(
    () => days.find((d) => d.dayNumber === selectedDayNumber) || days[0],
    [days, selectedDayNumber]
  );

  const currentPhase = useMemo(
    () => phases.find((p) => p.phase === currentDay.phase) || phases[0],
    [phases, currentDay.phase]
  );

  // Total roadmap completion
  const totalCompletedTasks = useMemo(
    () => allTasks.filter((t) => taskProgressMap[t.id]?.status === 'completed').length,
    [allTasks, taskProgressMap]
  );
  const totalProgressPct =
    allTasks.length > 0 ? Math.round((totalCompletedTasks / allTasks.length) * 100) : 0;

  // Daily KPI metrics
  const dayTasks = currentDay.tasks;
  const dayCompletedCount = dayTasks.filter(
    (t) => taskProgressMap[t.id]?.status === 'completed'
  ).length;
  const dayCompletionPct =
    dayTasks.length > 0 ? Math.round((dayCompletedCount / dayTasks.length) * 100) : 0;

  const plannedMinutesToday = currentDay.estimatedStudyTime.minutes;

  const actualSecondsToday = useMemo(() => {
    const fromTasks = dayTasks.reduce(
      (sum, t) => sum + (taskProgressMap[t.id]?.actualSeconds || 0),
      0
    );
    const fromCustomSessions = studySessions
      .filter((s) => s.dayNumber === currentDay.dayNumber && !s.taskId)
      .reduce((sum, s) => sum + s.durationSeconds, 0);
    return fromTasks + fromCustomSessions;
  }, [dayTasks, taskProgressMap, studySessions, currentDay.dayNumber]);

  const actualMinutesToday = Math.round(actualSecondsToday / 60);

  // Accuracy of completed exercises (across SRS, grammar, kanji, reading, listening)
  const exerciseAccuracyPct = useMemo(() => {
    let totalAtt = 0;
    let totalCor = 0;
    Object.values(srsCardsMap).forEach((c) => {
      totalAtt += c.reviewCount;
      totalCor += c.correctCount;
    });
    Object.values(grammarProgressMap).forEach((g) => {
      totalAtt += g.attempts;
      totalCor += g.correct;
    });
    Object.values(kanjiProgressMap).forEach((k) => {
      totalAtt += k.recognitionAttempts + k.readingAttempts;
      totalCor += k.recognitionCorrect + k.readingCorrect;
    });
    readingAttempts.forEach((r) => {
      totalAtt += r.totalQuestions;
      totalCor += r.correctAnswers;
    });
    listeningAttempts.forEach((l) => {
      totalAtt += 1;
      if (l.correct) totalCor += 1;
    });
    if (totalAtt === 0) return null;
    return Math.round((totalCor / totalAtt) * 100);
  }, [srsCardsMap, grammarProgressMap, kanjiProgressMap, readingAttempts, listeningAttempts]);

  // Part 5D: Progress Overview (strictly separating task completion vs true mastery)
  // Vocabulary: target 880 items. Never calculate mastered based solely on viewing flashcards!
  const vocabStudiedCount = Object.values(srsCardsMap).filter(
    (c) => c.itemType === 'vocabulary' && c.reviewCount > 0
  ).length;
  const vocabMasteredCount = Object.values(srsCardsMap).filter(
    (c) => c.itemType === 'vocabulary' && c.status === 'mastered'
  ).length;
  const vocabTasksDoneRanges = useMemo(() => {
    let assignedCount = 0;
    days.forEach((d) => {
      d.tasks.forEach((t) => {
        if (
          t.skill === 'vocabulary' &&
          t.itemRange &&
          taskProgressMap[t.id]?.status === 'completed'
        ) {
          const [a, b] = t.itemRange.split('–').map(Number);
          if (!isNaN(a) && !isNaN(b)) assignedCount += b - a + 1;
        }
      });
    });
    return assignedCount;
  }, [days, taskProgressMap]);

  // Grammar: target 112 patterns
  const grammarLearnedCount = Object.values(grammarProgressMap).filter(
    (g) => g.level !== 'not_learned'
  ).length;
  const grammarMasteredCount = Object.values(grammarProgressMap).filter(
    (g) => g.level === 'mastered'
  ).length;

  // Kanji: target 336 characters (36 lessons)
  const kanjiLessonsCompletedCount = useMemo(() => {
    const doneLessons = new Set<string>();
    allTasks.forEach((t) => {
      if (t.skill === 'kanji' && taskProgressMap[t.id]?.status === 'completed') {
        t.lessonRefs.forEach((r) => doneLessons.add(r));
      }
    });
    return doneLessons.size;
  }, [allTasks, taskProgressMap]);
  const kanjiMasteredItemsCount = Object.values(kanjiProgressMap).filter((k) => k.mastered).length;

  // Reading: assigned exercises completed
  const readingTasksAll = allTasks.filter((t) => t.skill === 'reading');
  const readingTasksDone = readingTasksAll.filter(
    (t) => taskProgressMap[t.id]?.status === 'completed'
  ).length;

  // Listening: assigned exercises completed
  const listeningTasksAll = allTasks.filter((t) => t.skill === 'listening');
  const listeningTasksDone = listeningTasksAll.filter(
    (t) => taskProgressMap[t.id]?.status === 'completed'
  ).length;

  // Mock tests: target 4 full examinations
  const fullMockTasks = allTasks.filter(
    (t) => t.skill === 'mixed' && t.taskType === 'mock_exam'
  );
  const fullMocksCompleted = Math.max(
    fullMockTasks.filter((t) => taskProgressMap[t.id]?.status === 'completed').length,
    new Set(mockAttempts.map((m) => m.mockNumber)).size
  );

  // Personal adjustments assigned to today
  const todayAdjustments = adjustments.filter(
    (a) => a.targetDayNumber === currentDay.dayNumber
  );

  // First incomplete task today for Quick Action "Continue today's study"
  const nextIncompleteTask = dayTasks.find(
    (t) => (taskProgressMap[t.id]?.status || 'not_started') !== 'completed'
  );

  return (
    <div className="space-y-6">
      {/* A. Examination Countdown & Roadmap State Banner */}
      <section className="rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 md:p-6 shadow-md">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-5 space-y-1.5">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/10 text-indigo-200 text-xs font-semibold">
              <Calendar className="w-3.5 h-3.5" />
              Kỳ thi JLPT N3: {formatIsoToViDate(dateStatus.examDateIso)} · Hôm nay:{' '}
              {formatIsoToViDate(dateStatus.todayIso)}
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
              Ngày {currentDay.dayNumber}/25 — {currentDay.title}
            </h1>
            <p className="text-xs md:text-sm text-indigo-100/90">
              Giai đoạn {currentPhase.phase}: <strong>{currentPhase.titleVi}</strong> (Ngày{' '}
              {currentPhase.startDay}–{currentPhase.endDay})
            </p>
            {dateStatus.periodState !== 'in_roadmap' && (
              <div className="mt-2 inline-block px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs">
                {dateStatus.periodState === 'before_roadmap' &&
                  'Hiện tại đang trước ngày bắt đầu lộ trình (10/11/2026). Bạn có thể xem trước hoặc chuẩn bị tài liệu.'}
                {dateStatus.periodState === 'exam_day' &&
                  'HÔM NAY LÀ NGÀY THI CHÍNH THỨC (05/12/2026)! Giữ bình tĩnh và áp dụng Chiến thuật Vàng.'}
                {dateStatus.periodState === 'after_roadmap' &&
                  (totalCompletedTasks === allTasks.length
                    ? 'Đã qua kỳ hạn lộ trình — Bạn đã hoàn thành 100% nhiệm vụ!'
                    : `Đã qua ngày 04/12/2026 nhưng còn ${allTasks.length - totalCompletedTasks} nhiệm vụ chưa hoàn tất.`)}
              </div>
            )}
          </div>

          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
              <div className="text-[11px] text-indigo-200 uppercase font-semibold">
                Ngày còn lại
              </div>
              <div className="text-2xl md:text-3xl font-extrabold mt-0.5">
                {dateStatus.daysUntilExam >= 0 ? dateStatus.daysUntilExam : 0}
              </div>
              <div className="text-[11px] text-indigo-200">Tới 05/12/2026</div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
              <div className="text-[11px] text-indigo-200 uppercase font-semibold">
                Ngày lộ trình
              </div>
              <div className="text-2xl md:text-3xl font-extrabold mt-0.5">
                {currentDay.dayNumber}
                <span className="text-base font-normal text-indigo-200">/25</span>
              </div>
              <div className="text-[11px] text-indigo-200">
                {dateStatus.calendarDayNumber
                  ? `Lịch: Ngày ${dateStatus.calendarDayNumber}`
                  : 'Tự chọn'}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
              <div className="text-[11px] text-indigo-200 uppercase font-semibold">
                Giai đoạn hiện tại
              </div>
              <div className="text-2xl md:text-3xl font-extrabold mt-0.5">
                P{currentPhase.phase}
                <span className="text-base font-normal text-indigo-200">/3</span>
              </div>
              <div className="text-[11px] text-indigo-200 truncate">{currentPhase.titleVi}</div>
            </div>

            <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
              <div className="text-[11px] text-indigo-200 uppercase font-semibold">
                Tổng lộ trình
              </div>
              <div className="text-2xl md:text-3xl font-extrabold mt-0.5">
                {totalProgressPct}%
              </div>
              <div className="text-[11px] text-indigo-200">
                {totalCompletedTasks}/{allTasks.length} nhiệm vụ
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* C. Daily KPI + E. Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily KPI Card */}
        <section className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-600" />
                KPI Hôm nay (Ngày {currentDay.dayNumber} · {formatIsoToViDate(currentDay.date)})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tách biệt rõ giữa tỷ lệ hoàn thành đầu việc (Task Completion) và mức độ thuộc bài thực tế (Learning Mastery).
              </p>
            </div>
            <span className="text-sm font-extrabold px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
              {dayCompletionPct}% Hoàn thành
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">Nhiệm vụ được giao</div>
              <div className="text-xl font-bold mt-0.5 text-slate-900 dark:text-white">
                {dayTasks.length} task
              </div>
              <div className="text-[11px] text-slate-400">
                Đã xong: <strong className="text-emerald-600">{dayCompletedCount}</strong> · Còn:{' '}
                <strong>{dayTasks.length - dayCompletedCount}</strong>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Thời gian Kế hoạch vs Thực tế
              </div>
              <div className="text-xl font-bold mt-0.5 text-slate-900 dark:text-white">
                {actualMinutesToday}p{' '}
                <span className="text-sm font-normal text-slate-400">
                  / {plannedMinutesToday}p
                </span>
              </div>
              <div className="text-[11px] text-slate-400">
                Khuyến nghị: 2.5 – 3.5 giờ/ngày
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 col-span-2 sm:col-span-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Độ chính xác bài tập (Mastery)
              </div>
              <div className="text-xl font-bold mt-0.5 text-slate-900 dark:text-white">
                {exerciseAccuracyPct !== null ? `${exerciseAccuracyPct}%` : 'Chưa có'}
              </div>
              <div className="text-[11px] text-slate-400">
                Tính trên các lượt làm quiz & SRS thực tế
              </div>
            </div>
          </div>

          {/* 5-Session Reference Strip */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Cấu trúc phân bổ ca học chuẩn trong ngày:
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px]">
              <div className="p-2 rounded bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-900/50">
                <div className="font-bold text-blue-900 dark:text-blue-200">Ca 1 · 45p</div>
                <div className="text-slate-600 dark:text-slate-400">Từ vựng 25p + Kanji 20p</div>
              </div>
              <div className="p-2 rounded bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/50">
                <div className="font-bold text-purple-900 dark:text-purple-200">Ca 2 · 45p</div>
                <div className="text-slate-600 dark:text-slate-400">Ngữ pháp 6–7 mẫu</div>
              </div>
              <div className="p-2 rounded bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/50">
                <div className="font-bold text-emerald-900 dark:text-emerald-200">Ca 3 · 45p</div>
                <div className="text-slate-600 dark:text-slate-400">Đọc hiểu bấm giờ</div>
              </div>
              <div className="p-2 rounded bg-cyan-50/70 dark:bg-cyan-950/30 border border-cyan-200/60 dark:border-cyan-900/50">
                <div className="font-bold text-cyan-900 dark:text-cyan-200">Ca 4 · 30p</div>
                <div className="text-slate-600 dark:text-slate-400">Nghe + Shadowing</div>
              </div>
              <div className="p-2 rounded bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/60 dark:border-rose-900/50 col-span-2 sm:col-span-1">
                <div className="font-bold text-rose-900 dark:text-rose-200">Cuối buổi · 15p</div>
                <div className="text-slate-600 dark:text-slate-400">Quét từ đánh dấu đỏ</div>
              </div>
            </div>
          </div>
        </section>

        {/* E. Quick Actions */}
        <section className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Thao tác nhanh (Quick Actions)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Truy cập ngay vào công cụ học tập tương ứng trong 1 cú nhấp chuột:
            </p>

            {nextIncompleteTask && (
              <button
                onClick={() => {
                  startTimerForTask(nextIncompleteTask);
                  const el = document.getElementById(`task-${nextIncompleteTask.id}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="w-full mb-3 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-between shadow-sm transition-colors"
              >
                <div className="text-left min-w-0 pr-2">
                  <div className="text-[11px] uppercase tracking-wider text-indigo-200 font-semibold">
                    Tiếp tục bài học hôm nay
                  </div>
                  <div className="text-xs md:text-sm font-bold truncate">
                    {nextIncompleteTask.title}
                  </div>
                </div>
                <Play className="w-5 h-5 shrink-0" />
              </button>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveTab('vocabulary')}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-semibold text-left"
              >
                <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Ôn tập Từ vựng & SRS</span>
              </button>
              <button
                onClick={() => setActiveTab('grammar')}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-semibold text-left"
              >
                <SplitSquareVertical className="w-4 h-4 text-purple-600 shrink-0" />
                <span>Luyện Ngữ pháp & Dấu ★</span>
              </button>
              <button
                onClick={() => setActiveTab('kanji')}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-semibold text-left"
              >
                <Languages className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Ôn Kanji & Đọc Jukugo</span>
              </button>
              <button
                onClick={() => setActiveTab('listening')}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-semibold text-left"
              >
                <Headphones className="w-4 h-4 text-cyan-600 shrink-0" />
                <span>Luyện Nghe & Shadowing</span>
              </button>
              <button
                onClick={() => setActiveTab('mistakes')}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-semibold text-left"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Mở Sổ tay Lỗi sai</span>
              </button>
              <button
                onClick={() => setActiveTab('mock_exam')}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/70 text-xs font-semibold text-left"
              >
                <Award className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Bắt đầu Thi thử 140p</span>
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* D. Progress Overview (6 Distinct Metrics — Separating Task Completion vs Mastery) */}
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Tổng quan Tiến độ 6 Trụ cột JLPT N3
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hiển thị song song tiến độ hoàn thành theo lịch (Assigned Tasks) và số lượng đơn vị kiến thức đã kiểm chứng qua Active Recall / SRS.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Vocabulary: target 880 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className="text-blue-700 dark:text-blue-300">
                1. Từ vựng (Mục tiêu: 880 từ)
              </span>
              <span>Đã thuộc SRS: {vocabMasteredCount}/880</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
              <div
                className="bg-blue-600 h-full"
                style={{ width: `${Math.min(100, (vocabMasteredCount / 880) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Đã làm SRS: {vocabStudiedCount} từ</span>
              <span>Theo lịch task: {vocabTasksDoneRanges}/880</span>
            </div>
          </div>

          {/* 2. Grammar: target 112 */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className="text-purple-700 dark:text-purple-300">
                2. Ngữ pháp (Mục tiêu: 112 mẫu)
              </span>
              <span>Thành thạo: {grammarMasteredCount}/112</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
              <div
                className="bg-purple-600 h-full"
                style={{ width: `${Math.min(100, (grammarMasteredCount / 112) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Đang học/Đã hiểu: {grammarLearnedCount}/112 mẫu</span>
              <span>9 Unit Mimi kara</span>
            </div>
          </div>

          {/* 3. Kanji: target 336 characters / 36 lessons */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className="text-amber-700 dark:text-amber-300">
                3. Kanji (336 chữ · 36 bài)
              </span>
              <span>Bài hoàn tất: {kanjiLessonsCompletedCount}/36</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
              <div
                className="bg-amber-500 h-full"
                style={{ width: `${Math.min(100, (kanjiLessonsCompletedCount / 36) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Ước tính chữ theo bài: ~{Math.round((kanjiLessonsCompletedCount / 36) * 336)}/336</span>
              <span>Từ ghép đã thuộc: {kanjiMasteredItemsCount}</span>
            </div>
          </div>

          {/* 4. Reading: assigned exercises completed */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className="text-emerald-700 dark:text-emerald-300">
                4. Đọc hiểu (Bài tập được giao)
              </span>
              <span>
                {readingTasksDone}/{readingTasksAll.length} buổi
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
              <div
                className="bg-emerald-600 h-full"
                style={{
                  width: `${
                    readingTasksAll.length > 0
                      ? Math.round((readingTasksDone / readingTasksAll.length) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Shinkanzen + Speed Master (45 bài)</span>
              <span>Lượt bấm giờ: {readingAttempts.length}</span>
            </div>
          </div>

          {/* 5. Listening: assigned exercises completed */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className="text-cyan-700 dark:text-cyan-300">
                5. Nghe hiểu (Bài tập được giao)
              </span>
              <span>
                {listeningTasksDone}/{listeningTasksAll.length} buổi
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
              <div
                className="bg-cyan-600 h-full"
                style={{
                  width: `${
                    listeningTasksAll.length > 0
                      ? Math.round((listeningTasksDone / listeningTasksAll.length) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Ưu tiên Mondai 4&5 → 1&2 → 3</span>
              <span>Lượt luyện nghe: {listeningAttempts.length}</span>
            </div>
          </div>

          {/* 6. Mock tests: target 4 full examinations */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex justify-between items-center text-xs font-bold mb-1">
              <span className="text-rose-700 dark:text-rose-300">
                6. Đề thi thử Full (Mục tiêu: 4 đề)
              </span>
              <span>{fullMocksCompleted}/4 đề</span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mb-1.5">
              <div
                className="bg-rose-600 h-full"
                style={{ width: `${Math.min(100, (fullMocksCompleted / 4) * 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Lịch: 28/11 · 30/11 · 02/12 · 03/12</span>
              <span>Chuẩn đỗ: ≥95/180</span>
            </div>
          </div>
        </div>
      </section>

      {/* Adaptive Recommendations Panel (Part 15 — Separate from immutable roadmap) */}
      {recommendations.length > 0 && (
        <section className="bg-amber-50/70 dark:bg-amber-950/20 rounded-2xl border border-amber-200 dark:border-amber-800/70 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h2 className="text-sm md:text-base font-bold text-amber-950 dark:text-amber-200">
                Đề xuất Thích ứng (Adaptive Recommendations — Tách biệt với Lộ trình gốc)
              </h2>
            </div>
            <span className="text-[11px] text-amber-700 dark:text-amber-300">
              Không tự động xóa/sửa nhiệm vụ gốc
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-amber-200/80 dark:border-slate-800 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${
                        rec.priority === 'critical'
                          ? 'bg-rose-600 text-white'
                          : rec.priority === 'high'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {rec.priority === 'critical'
                        ? 'Khẩn cấp'
                        : rec.priority === 'high'
                          ? 'Ưu tiên cao'
                          : 'Gợi ý'}
                    </span>
                    <h3 className="text-xs md:text-sm font-bold text-slate-900 dark:text-white">
                      {rec.title}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{rec.reason}</p>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => setActiveTab(rec.targetTab)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {rec.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* B. Today's Mission (Grouped by Skill) */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 dark:text-white">
              Nhiệm vụ Ngày {currentDay.dayNumber} ({currentDay.weekdayVi},{' '}
              {formatIsoToViDate(currentDay.date)})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Một nhiệm vụ chỉ được đánh dấu Hoàn thành khi bạn chủ động bấm nút xác nhận.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedDayNumber}
              onChange={(e) => setSelectedDayNumber(Number(e.target.value))}
              className="text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5"
            >
              {days.map((d) => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  Ngày {d.dayNumber} ({formatIsoToViDate(d.date)}) — {d.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Day-level notes if any (e.g. Day 25 warning) */}
        {currentDay.notes.length > 0 && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs md:text-sm font-semibold text-rose-800 dark:text-rose-200">
            {currentDay.notes.map((n, idx) => (
              <div key={idx}>{n}</div>
            ))}
          </div>
        )}

        {/* Grouped tasks */}
        {GROUP_ORDER.map((group) => {
          const tasksInGroup = dayTasks.filter((t) => {
            if (group.key === 'revision_general') {
              return t.skill === 'mixed' || t.skill === 'general';
            }
            return t.skill === group.key;
          });
          if (tasksInGroup.length === 0) return null;

          return (
            <div key={group.key} className="space-y-3">
              <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 pb-1">
                {group.label} ({tasksInGroup.length} nhiệm vụ)
              </h3>
              <div className="space-y-3">
                {tasksInGroup.map((task) => (
                  <div key={task.id} id={`task-${task.id}`}>
                    <TaskCard task={task} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Personal adjustments scheduled for this day (separate from original tasks) */}
        {todayAdjustments.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-dashed border-slate-300 dark:border-slate-700">
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Điều chỉnh cá nhân / Học bù đã gán cho Ngày {currentDay.dayNumber} (Lưu tách biệt)
            </h3>
            <div className="space-y-2">
              {todayAdjustments.map((adj) => (
                <div
                  key={adj.id}
                  className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {adj.title}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Lý do: {adj.reason}
                      {adj.originalDayNumber ? ` · Gốc từ Ngày ${adj.originalDayNumber}` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => togglePersonalAdjustmentComplete(adj.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 ${
                      adj.completed
                        ? 'bg-emerald-600 text-white'
                        : 'border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {adj.completed ? 'Đã xong bù' : 'Đánh dấu xong'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
