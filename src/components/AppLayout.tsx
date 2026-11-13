import React, { useState } from 'react';
import {
  LayoutDashboard,
  CalendarRange,
  BookOpen,
  SplitSquareVertical,
  Languages,
  FileText,
  Headphones,
  AlertTriangle,
  Award,
  BarChart3,
  Settings,
  Sun,
  Moon,
  Menu,
  X,
  Play,
  Pause,
  CheckCircle2,
  RotateCcw,
  AlertOctagon,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { NavigationTab, SkillType } from '../types';
import { formatSecondsToHms, formatIsoToViDate } from '../utils/dateUtils';

const NAV_ITEMS: { id: NavigationTab; label: string; sub: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Bảng điều khiển', sub: 'Hôm nay & KPI', icon: LayoutDashboard },
  { id: 'roadmap', label: 'Lộ trình 25 Ngày', sub: '10/11 – 04/12', icon: CalendarRange },
  { id: 'vocabulary', label: 'Từ vựng (880)', sub: 'Mimi kara Goi', icon: BookOpen },
  { id: 'grammar', label: 'Ngữ pháp (112)', sub: 'Mimi kara Bunpou', icon: SplitSquareVertical },
  { id: 'kanji', label: 'Kanji (336 / 36 bài)', sub: 'Soumatome Kanji', icon: Languages },
  { id: 'reading', label: 'Đọc hiểu', sub: 'Shinkanzen & Speed', icon: FileText },
  { id: 'listening', label: 'Nghe hiểu', sub: '5 Mondai & Shadowing', icon: Headphones },
  { id: 'mistakes', label: 'Sổ tay Lỗi sai', sub: 'Phân loại & Ôn lại', icon: AlertTriangle },
  { id: 'mock_exam', label: 'Thi thử (4 Đề Full)', sub: 'Mô phỏng 140 phút', icon: Award },
  { id: 'analytics', label: 'Phân tích & Thời gian', sub: 'Tiến độ thực tế', icon: BarChart3 },
  { id: 'settings', label: 'Cài đặt & Dữ liệu', sub: 'Import / Backup', icon: Settings },
];

const SKILL_NAMES_VI: Record<SkillType, string> = {
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  kanji: 'Kanji',
  reading: 'Đọc hiểu',
  listening: 'Nghe hiểu',
  mixed: 'Tổng hợp',
  general: 'Chung',
};

export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    activeTab,
    setActiveTab,
    settings,
    updateSettings,
    dateStatus,
    selectedDayNumber,
    setSelectedDayNumber,
    days,
    allTasks,
    taskProgressMap,
    mistakes,
    timer,
    pauseTimer,
    resumeTimer,
    recordTimerInterruption,
    finishAndLogTimerSession,
    resetTimer,
    startCustomTimer,
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const completedTasksCount = allTasks.filter(
    (t) => taskProgressMap[t.id]?.status === 'completed'
  ).length;
  const totalPct = allTasks.length > 0 ? Math.round((completedTasksCount / allTasks.length) * 100) : 0;
  const unresolvedMistakesCount = mistakes.filter((m) => m.reviewStatus !== 'resolved').length;

  const currentDayObj = days.find((d) => d.dayNumber === selectedDayNumber) || days[0];

  const handleNav = (id: NavigationTab) => {
    setActiveTab(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs font-bold rounded bg-indigo-600 text-white">
                JLPT N3
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                25-DAY SPRINT
              </span>
            </div>
            <h1 className="text-sm font-bold mt-1 text-slate-900 dark:text-white">
              Chiến dịch Thi 05/12/2026
            </h1>
          </div>
          <button
            onClick={() =>
              updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
            }
            title="Đổi giao diện Sáng / Tối"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>

        {/* Countdown & Active Day mini card */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Đếm ngược ngày thi:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {dateStatus.daysUntilExam > 0
                ? `Còn ${dateStatus.daysUntilExam} ngày`
                : dateStatus.daysUntilExam === 0
                  ? 'HÔM NAY THI!'
                  : `Đã qua ${Math.abs(dateStatus.daysUntilExam)} ngày`}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Đang mở:</span>
            <select
              value={selectedDayNumber}
              onChange={(e) => setSelectedDayNumber(Number(e.target.value))}
              className="text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-800 dark:text-slate-100"
            >
              {days.map((d) => (
                <option key={d.dayNumber} value={d.dayNumber}>
                  Ngày {d.dayNumber} ({d.date.slice(8, 10)}/{d.date.slice(5, 7)})
                </option>
              ))}
            </select>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full transition-all"
              style={{ width: `${totalPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Tiến độ tổng: {totalPct}%</span>
            <span>
              {completedTasksCount}/{allTasks.length} task
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-white' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  />
                  <div className="truncate">
                    <div className="text-xs font-semibold leading-tight truncate">
                      {item.label}
                    </div>
                    <div
                      className={`text-[10px] truncate ${
                        active ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.sub}
                    </div>
                  </div>
                </div>
                {item.id === 'mistakes' && unresolvedMistakesCount > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                      active
                        ? 'bg-white text-indigo-700'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                    }`}
                  >
                    {unresolvedMistakesCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Built-in Study Timer Dock in Sidebar */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
              Đồng hồ bấm giờ học
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {SKILL_NAMES_VI[timer.skill]} · Ngày {timer.dayNumber}
            </span>
          </div>

          <div className="flex items-baseline justify-between my-1">
            <span className="font-mono text-xl font-bold text-slate-900 dark:text-white">
              {formatSecondsToHms(timer.elapsedSeconds)}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Mục tiêu: {timer.plannedMinutes}p
              {timer.interruptions > 0 ? ` · Gián đoạn: ${timer.interruptions}` : ''}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1 mt-2">
            {!timer.running ? (
              <button
                onClick={() =>
                  timer.elapsedSeconds > 0
                    ? resumeTimer()
                    : startCustomTimer('vocabulary', selectedDayNumber, 45)
                }
                className="col-span-2 flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                title="Bắt đầu / Tiếp tục"
              >
                <Play className="w-3.5 h-3.5" />
                {timer.elapsedSeconds > 0 ? 'Tiếp' : 'Bắt đầu'}
              </button>
            ) : (
              <button
                onClick={pauseTimer}
                className="col-span-2 flex items-center justify-center gap-1 py-1.5 px-2 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium"
                title="Tạm dừng"
              >
                <Pause className="w-3.5 h-3.5" />
                Dừng
              </button>
            )}
            <button
              onClick={recordTimerInterruption}
              disabled={timer.elapsedSeconds === 0}
              className="flex items-center justify-center py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs disabled:opacity-40"
              title="Ghi nhận 1 lần gián đoạn"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-amber-500" />
            </button>
            <button
              onClick={resetTimer}
              disabled={timer.elapsedSeconds === 0}
              className="flex items-center justify-center py-1.5 px-2 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs disabled:opacity-40"
              title="Đặt lại đồng hồ"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          {timer.elapsedSeconds > 0 && (
            <button
              onClick={() => finishAndLogTimerSession()}
              className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Lưu phiên học ({Math.max(1, Math.round(timer.elapsedSeconds / 60))} phút)
            </button>
          )}
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 leading-tight">
            *Lưu thời gian thực tế, không tự động đánh dấu hoàn thành task.
          </p>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Header for Mobile & Quick Status */}
        <header className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700"
              aria-label="Mở menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                  Ngày {currentDayObj.dayNumber}/25 · Giai đoạn {currentDayObj.phase}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {currentDayObj.weekdayVi}, {formatIsoToViDate(currentDayObj.date)}
                </span>
                {dateStatus.calendarDayNumber !== null &&
                  dateStatus.calendarDayNumber !== currentDayObj.dayNumber && (
                    <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 font-medium">
                      Lịch thực tế hôm nay: Ngày {dateStatus.calendarDayNumber} (giữ Ngày{' '}
                      {currentDayObj.dayNumber} do còn task chưa xong)
                    </span>
                  )}
              </div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-2xl">
                {currentDayObj.title}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Compact quick day switcher */}
            <div className="hidden sm:flex items-center gap-1">
              <button
                onClick={() => setSelectedDayNumber(Math.max(1, selectedDayNumber - 1))}
                disabled={selectedDayNumber <= 1}
                className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                ← Ngày trước
              </button>
              <button
                onClick={() => setSelectedDayNumber(Math.min(25, selectedDayNumber + 1))}
                disabled={selectedDayNumber >= 25}
                className="px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                Ngày sau →
              </button>
            </div>
            <button
              onClick={() =>
                updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
              }
              className="lg:hidden p-2 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="relative w-72 max-w-full bg-white dark:bg-slate-900 h-full flex flex-col z-10 p-4 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <span className="font-bold text-sm">JLPT N3 — 25 Ngày Cấp tốc</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="my-3">
                <label className="block text-xs text-slate-500 mb-1">Chọn ngày lộ trình:</label>
                <select
                  value={selectedDayNumber}
                  onChange={(e) => setSelectedDayNumber(Number(e.target.value))}
                  className="w-full text-xs bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded p-2"
                >
                  {days.map((d) => (
                    <option key={d.dayNumber} value={d.dayNumber}>
                      Ngày {d.dayNumber} ({d.date.slice(8, 10)}/{d.date.slice(5, 7)}) — {d.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 flex-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-xs font-semibold ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Page Body */}
        <main className="flex-1 p-4 md:p-6 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
