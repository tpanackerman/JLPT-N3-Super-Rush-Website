import React, { useState, useMemo } from 'react';
import {
  Calendar,
  List,
  GitCommitHorizontal,
  ShieldAlert,
  CheckCircle2,
  Plus,
  Trash2,
  Lock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { TaskCard } from '../components/TaskCard';
import { formatIsoToShortVi, formatIsoToViDate } from '../utils/dateUtils';
import type { SkillType } from '../types';

const PHASE_STYLES: Record<
  number,
  { border: string; bg: string; badge: string; header: string }
> = {
  1: {
    border: 'border-blue-300 dark:border-blue-800',
    bg: 'bg-blue-50/40 dark:bg-blue-950/20',
    badge: 'bg-blue-600 text-white',
    header: 'text-blue-800 dark:text-blue-200',
  },
  2: {
    border: 'border-purple-300 dark:border-purple-800',
    bg: 'bg-purple-50/40 dark:bg-purple-950/20',
    badge: 'bg-purple-600 text-white',
    header: 'text-purple-800 dark:text-purple-200',
  },
  3: {
    border: 'border-rose-300 dark:border-rose-800',
    bg: 'bg-rose-50/40 dark:bg-rose-950/20',
    badge: 'bg-rose-600 text-white',
    header: 'text-rose-800 dark:text-rose-200',
  },
};

export const RoadmapPage: React.FC = () => {
  const {
    phases,
    days,
    selectedDayNumber,
    setSelectedDayNumber,
    dateStatus,
    taskProgressMap,
    adjustments,
    addPersonalAdjustment,
    togglePersonalAdjustmentComplete,
    deletePersonalAdjustment,
  } = useApp();

  const [viewMode, setViewMode] = useState<'calendar' | 'timeline' | 'list' | 'recovery'>(
    'calendar'
  );
  const [phaseFilter, setPhaseFilter] = useState<number | 'all'>('all');
  const [skillFilter, setSkillFilter] = useState<SkillType | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'completed' | 'incomplete' | 'in_progress'
  >('all');
  const [dateSearch, setDateSearch] = useState('');

  // Custom adjustment form state
  const [customTitle, setCustomTitle] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [customTargetDay, setCustomTargetDay] = useState<number>(selectedDayNumber);

  // Filtered days
  const filteredDays = useMemo(() => {
    return days.filter((d) => {
      if (phaseFilter !== 'all' && d.phase !== phaseFilter) return false;
      if (dateSearch && !d.date.includes(dateSearch) && !String(d.dayNumber).includes(dateSearch)) {
        return false;
      }
      const matchingTasks = d.tasks.filter((t) => {
        if (skillFilter !== 'all' && t.skill !== skillFilter) return false;
        const st = taskProgressMap[t.id]?.status || 'not_started';
        if (statusFilter === 'completed' && st !== 'completed') return false;
        if (statusFilter === 'incomplete' && st === 'completed') return false;
        if (statusFilter === 'in_progress' && st !== 'in_progress') return false;
        return true;
      });
      return matchingTasks.length > 0;
    });
  }, [days, phaseFilter, dateSearch, skillFilter, statusFilter, taskProgressMap]);

  const activeDay = days.find((d) => d.dayNumber === selectedDayNumber) || days[0];

  // Recovery Mode Calculations (Part 6)
  // 1. Overdue tasks from days prior to calendarDayNumber (or prior to selectedDayNumber)
  const referenceTodayDay = dateStatus.calendarDayNumber || selectedDayNumber;
  const overdueTasks = useMemo(() => {
    return days
      .filter((d) => d.dayNumber < referenceTodayDay)
      .flatMap((d) =>
        d.tasks.filter((t) => {
          const st = taskProgressMap[t.id]?.status || 'not_started';
          return st !== 'completed' && st !== 'skipped';
        })
      );
  }, [days, referenceTodayDay, taskProgressMap]);

  const todayAssignedDay = days.find((d) => d.dayNumber === referenceTodayDay) || activeDay;

  const handleApproveCatchupAdjustment = async (
    taskTitle: string,
    taskId: string,
    fromDay: number,
    toDay: number,
    strategyReason: string
  ) => {
    await addPersonalAdjustment({
      type: 'catchup_plan',
      taskId,
      originalDayNumber: fromDay,
      targetDayNumber: toDay,
      title: `[Học bù Ngày ${fromDay}] ${taskTitle}`,
      reason: strategyReason,
    });
  };

  const handleAddCustomAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTitle.trim()) return;
    await addPersonalAdjustment({
      type: 'custom_task',
      targetDayNumber: customTargetDay,
      title: customTitle.trim(),
      reason: customReason.trim() || 'Điều chỉnh cá nhân',
    });
    setCustomTitle('');
    setCustomReason('');
  };

  return (
    <div className="space-y-6">
      {/* Header & Immutability Notice */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full mb-1">
              <Lock className="w-3.5 h-3.5" />
              Lộ trình gốc 25 ngày được bảo vệ bất biến (Immutable Single Source of Truth)
            </div>
            <h1 className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white">
              Quản lý Lộ trình 25 Ngày (10/11/2026 – 04/12/2026 | Thi 05/12/2026)
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nếu bỏ lỡ 1 ngày, hệ thống tuyệt đối không tự động xóa hay dịch chuyển ngày tiếp theo. Sử dụng Chế độ Phục hồi (Recovery Mode) để duyệt kế hoạch học bù riêng.
            </p>
          </div>

          {/* View Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Lịch 25 Ngày
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'timeline'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <GitCommitHorizontal className="w-3.5 h-3.5" />
              Dòng thời gian
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Danh sách phẳng
            </button>
            <button
              onClick={() => setViewMode('recovery')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                viewMode === 'recovery'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-700 dark:text-rose-300'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Recovery Mode ({overdueTasks.length})
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Lọc theo Giai đoạn:
            </label>
            <select
              value={phaseFilter}
              onChange={(e) =>
                setPhaseFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
            >
              <option value="all">Tất cả 3 Giai đoạn (Ngày 1–25)</option>
              {phases.map((p) => (
                <option key={p.phase} value={p.phase}>
                  Giai đoạn {p.phase}: Ngày {p.startDay}–{p.endDay} ({p.titleVi})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Lọc theo Kỹ năng:
            </label>
            <select
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value as SkillType | 'all')}
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
            >
              <option value="all">Tất cả kỹ năng</option>
              <option value="vocabulary">Từ vựng (Mimi kara Goi)</option>
              <option value="kanji">Kanji (Soumatome)</option>
              <option value="grammar">Ngữ pháp (Mimi kara Bunpou)</option>
              <option value="reading">Đọc hiểu (Shinkanzen / Speed Master)</option>
              <option value="listening">Nghe hiểu (Choukai)</option>
              <option value="mixed">Thi thử Full / Tổng hợp</option>
              <option value="general">Chuẩn bị phòng thi</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Trạng thái hoàn thành:
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as 'all' | 'completed' | 'incomplete' | 'in_progress'
                )
              }
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="incomplete">Chưa hoàn thành</option>
              <option value="in_progress">Đang thực hiện</option>
              <option value="completed">Đã hoàn thành</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Tìm theo Ngày / Ngày tháng:
            </label>
            <input
              type="text"
              value={dateSearch}
              onChange={(e) => setDateSearch(e.target.value)}
              placeholder="VD: 2026-11-18 hoặc 19..."
              className="w-full text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5"
            />
          </div>
        </div>
      </div>

      {/* Phase Overview Legend */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {phases.map((p) => {
          const style = PHASE_STYLES[p.phase];
          const phaseDays = days.filter((d) => d.phase === p.phase);
          const phaseTasks = phaseDays.flatMap((d) => d.tasks);
          const done = phaseTasks.filter(
            (t) => taskProgressMap[t.id]?.status === 'completed'
          ).length;
          const pct = phaseTasks.length > 0 ? Math.round((done / phaseTasks.length) * 100) : 0;

          return (
            <div
              key={p.phase}
              className={`rounded-xl border p-4 ${style.border} ${style.bg}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${style.badge}`}>
                  GIAI ĐOẠN {p.phase} · NGÀY {p.startDay}–{p.endDay}
                </span>
                <span className="text-xs font-bold">
                  {done}/{phaseTasks.length} task ({pct}%)
                </span>
              </div>
              <h3 className={`text-xs md:text-sm font-bold ${style.header}`}>{p.titleVi}</h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                {p.objective}
              </p>
            </div>
          );
        })}
      </div>

      {/* VIEW 1: 25-DAY VISUAL CALENDAR */}
      {viewMode === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 25-Day Grid */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 self-start">
            {filteredDays.map((d) => {
              const style = PHASE_STYLES[d.phase];
              const total = d.tasks.length;
              const done = d.tasks.filter(
                (t) => taskProgressMap[t.id]?.status === 'completed'
              ).length;
              const isSelected = d.dayNumber === selectedDayNumber;
              const isTodayCalendar = d.dayNumber === dateStatus.calendarDayNumber;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;

              return (
                <button
                  key={d.dayNumber}
                  onClick={() => setSelectedDayNumber(d.dayNumber)}
                  className={`text-left rounded-xl border p-3.5 transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'ring-2 ring-indigo-600 border-indigo-600 bg-white dark:bg-slate-900 shadow-md'
                      : `${style.border} ${style.bg} hover:shadow-sm`
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${style.badge}`}>
                        Ngày {d.dayNumber}
                      </span>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        {d.weekdayVi} · {formatIsoToShortVi(d.date)}
                      </span>
                    </div>
                    {isTodayCalendar && (
                      <div className="mb-1 inline-block text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500 text-white">
                        Hôm nay theo lịch
                      </div>
                    )}
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2">
                      {d.title}
                    </h4>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex justify-between text-[11px] font-medium mb-1">
                      <span>
                        Hoàn thành: {done}/{total}
                      </span>
                      <span
                        className={
                          done === total
                            ? 'text-emerald-600 font-bold'
                            : done > 0
                              ? 'text-indigo-600 font-semibold'
                              : 'text-slate-400'
                        }
                      >
                        {done === total ? 'Hoàn tất ✓' : `${pct}%`}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={done === total ? 'bg-emerald-500 h-full' : 'bg-indigo-600 h-full'}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Selected Day Full Detail Panel */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 md:p-5 space-y-4 self-start sticky top-16 max-h-[calc(100vh-5rem)] overflow-y-auto">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                  CHI TIẾT NGÀY {activeDay.dayNumber}/25 · GIAI ĐOẠN {activeDay.phase}
                </span>
                <span className="text-xs text-slate-500">
                  {activeDay.weekdayVi}, {formatIsoToViDate(activeDay.date)}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                {activeDay.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Thời lượng dự kiến: {activeDay.estimatedStudyTime.minutes} phút (
                {activeDay.estimatedStudyTime.note})
              </p>
            </div>

            <div className="space-y-3">
              {activeDay.tasks
                .filter((t) => skillFilter === 'all' || t.skill === skillFilter)
                .map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: TIMELINE VIEW */}
      {viewMode === 'timeline' && (
        <div className="space-y-6">
          {phases.map((p) => {
            const pDays = filteredDays.filter((d) => d.phase === p.phase);
            if (pDays.length === 0) return null;
            const style = PHASE_STYLES[p.phase];

            return (
              <div key={p.phase} className="space-y-3">
                <div className={`p-3 rounded-xl border ${style.border} ${style.bg}`}>
                  <h3 className={`text-sm font-extrabold ${style.header}`}>
                    GIAI ĐOẠN {p.phase}: {p.titleVi} (Ngày {p.startDay}–{p.endDay})
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300">{p.objective}</p>
                </div>

                <div className="relative pl-6 border-l-2 border-indigo-300 dark:border-indigo-800 space-y-4">
                  {pDays.map((d) => {
                    const done = d.tasks.filter(
                      (t) => taskProgressMap[t.id]?.status === 'completed'
                    ).length;
                    return (
                      <div
                        key={d.dayNumber}
                        className="relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4"
                      >
                        <div className="absolute -left-[31px] top-5 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                              Ngày {d.dayNumber} ({d.weekdayVi}, {formatIsoToViDate(d.date)})
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {d.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">
                              {done}/{d.tasks.length} hoàn thành
                            </span>
                            <button
                              onClick={() => {
                                setSelectedDayNumber(d.dayNumber);
                                setViewMode('calendar');
                              }}
                              className="text-xs font-semibold text-indigo-600 hover:underline"
                            >
                              Mở chi tiết →
                            </button>
                          </div>
                        </div>
                        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          {d.tasks.map((t) => {
                            const st = taskProgressMap[t.id]?.status || 'not_started';
                            return (
                              <li key={t.id} className="flex items-center gap-2">
                                <span
                                  className={
                                    st === 'completed'
                                      ? 'text-emerald-600 font-bold'
                                      : 'text-slate-400'
                                  }
                                >
                                  {st === 'completed' ? '✓' : '○'}
                                </span>
                                <span className={st === 'completed' ? 'line-through' : ''}>
                                  {t.title}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 3: LIST VIEW */}
      {viewMode === 'list' && (
        <div className="space-y-4">
          {filteredDays.map((d) => (
            <div
              key={d.dayNumber}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h3 className="text-sm md:text-base font-bold">
                  Ngày {d.dayNumber} ({d.weekdayVi}, {formatIsoToViDate(d.date)}): {d.title}
                </h3>
                <span className="text-xs font-semibold text-slate-500">Giai đoạn {d.phase}</span>
              </div>
              <div className="space-y-3">
                {d.tasks
                  .filter((t) => skillFilter === 'all' || t.skill === skillFilter)
                  .map((t) => (
                    <TaskCard key={t.id} task={t} showDayBadge />
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 4: RECOVERY MODE (Part 6) */}
      {viewMode === 'recovery' && (
        <div className="space-y-6">
          <div className="bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-800 p-5 space-y-3">
            <h2 className="text-base md:text-lg font-extrabold text-rose-900 dark:text-rose-200 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              Chế độ Phục hồi Lộ trình (Recovery Mode — Bảo toàn Lộ trình Gốc)
            </h2>
            <p className="text-xs md:text-sm text-rose-800 dark:text-rose-200">
              Khi bạn bỏ lỡ nhiệm vụ của các ngày trước, hệ thống <strong>không tự động xóa hoặc đẩy lùi các ngày sau</strong>. Dưới đây là phân tích xung đột khối lượng giữa nhiệm vụ tồn đọng và nhiệm vụ hôm nay (Ngày {referenceTodayDay}), kèm chiến thuật học bù cần bạn phê duyệt thủ công.
            </p>

            {/* Conflict analysis summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-rose-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">1. Nhiệm vụ quá hạn (Ngày 1 → {Math.max(1, referenceTodayDay - 1)})</div>
                <div className="text-2xl font-extrabold text-rose-600 mt-0.5">
                  {overdueTasks.length} nhiệm vụ
                </div>
                <div className="text-[11px] text-slate-500">
                  Ước tính thời gian tồn: ~{overdueTasks.length * 25} phút
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-rose-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">2. Nhiệm vụ cố định hôm nay (Ngày {todayAssignedDay.dayNumber})</div>
                <div className="text-2xl font-extrabold text-indigo-600 mt-0.5">
                  {todayAssignedDay.tasks.length} nhiệm vụ
                </div>
                <div className="text-[11px] text-slate-500">
                  Thời lượng chuẩn: {todayAssignedDay.estimatedStudyTime.minutes} phút
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-rose-200 dark:border-slate-800">
                <div className="text-xs text-slate-500">3. Đánh giá xung đột tải học</div>
                <div className="text-sm font-bold text-amber-600 mt-1">
                  {overdueTasks.length === 0
                    ? 'Không có xung đột! Bạn đang bám sát lộ trình.'
                    : overdueTasks.length <= 3
                      ? 'Xung đột Nhẹ: Có thể ghép thêm 30 phút cuối buổi hôm nay.'
                      : 'Xung đột Cao: Không nên dồn hết vào 1 ngày! Hãy rải đều 1–2 task/ngày hoặc đẩy các Unit phụ (Unit 6, 8, 9, 10) sang Ngày 18 & 20.'}
                </div>
              </div>
            </div>
          </div>

          {/* Suggested Catch-up Strategy & Manual Approval */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
              4. Đề xuất Chiến thuật Học bù & Phê duyệt Thủ công (Manual Approval)
            </h3>
            {overdueTasks.length === 0 ? (
              <p className="text-xs text-emerald-600 font-semibold">
                ✓ Tuyệt vời! Không có nhiệm vụ nào bị quá hạn tính đến trước Ngày {referenceTodayDay}.
              </p>
            ) : (
              <div className="space-y-2.5">
                {overdueTasks.map((t, idx) => {
                  // Suggest spreading across upcoming days (1-2 tasks per day) or consolidation days (Day 18 / Day 20)
                  const suggestedTargetDay = Math.min(25, referenceTodayDay + Math.floor(idx / 2));
                  const alreadyScheduled = adjustments.some((a) => a.taskId === t.id);

                  return (
                    <div
                      key={t.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
                            Quá hạn từ Ngày {t.dayNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {t.title}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Gợi ý chiến thuật:{' '}
                          {t.priority === 'high'
                            ? `Ưu tiên cao (chiếm 80% đề thi) → Ghép bù vào Ngày ${suggestedTargetDay} (+25 phút).`
                            : `Mức ưu tiên trung bình → Có thể ghép quét nhanh vào Ngày ${suggestedTargetDay} hoặc Ngày tổng rà soát 18/20.`}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {alreadyScheduled ? (
                          <span className="text-xs font-semibold text-emerald-600">
                            ✓ Đã duyệt lịch bù
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              handleApproveCatchupAdjustment(
                                t.title,
                                t.id,
                                t.dayNumber,
                                suggestedTargetDay,
                                `Duyệt học bù từ Ngày ${t.dayNumber} sang Ngày ${suggestedTargetDay}`
                              )
                            }
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                          >
                            Phê duyệt bù vào Ngày {suggestedTargetDay}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Personal Adjustments Ledger */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm md:text-base font-bold text-slate-900 dark:text-white">
              5. Sổ theo dõi Điều chỉnh Cá nhân (Lưu tách biệt, không ghi đè Lộ trình gốc)
            </h3>

            <form
              onSubmit={handleAddCustomAdjustment}
              className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <input
                type="text"
                required
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Tiêu đề điều chỉnh / nhiệm vụ bổ sung..."
                className="sm:col-span-5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
              />
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Ghi chú / Lý do..."
                className="sm:col-span-4 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5"
              />
              <select
                value={customTargetDay}
                onChange={(e) => setCustomTargetDay(Number(e.target.value))}
                className="sm:col-span-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5"
              >
                {days.map((d) => (
                  <option key={d.dayNumber} value={d.dayNumber}>
                    N{d.dayNumber}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="sm:col-span-2 flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Thêm
              </button>
            </form>

            {adjustments.length === 0 ? (
              <p className="text-xs text-slate-500">Chưa có điều chỉnh cá nhân nào.</p>
            ) : (
              <div className="space-y-2">
                {adjustments.map((adj) => (
                  <div
                    key={adj.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
                          Gán cho Ngày {adj.targetDayNumber}
                        </span>
                        <span
                          className={`text-xs font-bold ${
                            adj.completed ? 'line-through text-slate-400' : ''
                          }`}
                        >
                          {adj.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{adj.reason}</div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => togglePersonalAdjustmentComplete(adj.id)}
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-emerald-600"
                        title="Đánh dấu hoàn thành"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePersonalAdjustment(adj.id)}
                        className="p-1.5 rounded border border-slate-200 dark:border-slate-700 text-rose-600"
                        title="Xóa điều chỉnh"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
