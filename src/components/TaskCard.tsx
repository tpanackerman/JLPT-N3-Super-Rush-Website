import React, { useState } from 'react';
import {
  CheckCircle2,
  Play,
  Pause,
  SkipForward,
  BookOpen,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { RoadmapTask, NavigationTab } from '../types';
import { formatSecondsToHms } from '../utils/dateUtils';

const SKILL_BADGE_COLORS: Record<string, string> = {
  vocabulary: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200',
  grammar: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200',
  kanji: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200',
  reading: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200',
  listening: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200',
  mixed: 'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200',
  general: 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
};

const SKILL_NAMES_VI: Record<string, string> = {
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  kanji: 'Kanji',
  reading: 'Đọc hiểu',
  listening: 'Nghe hiểu',
  mixed: 'Tổng hợp / Chữa đề',
  general: 'Chuẩn bị phòng thi',
};

const SKILL_TO_TAB: Record<string, NavigationTab> = {
  vocabulary: 'vocabulary',
  grammar: 'grammar',
  kanji: 'kanji',
  reading: 'reading',
  listening: 'listening',
  mixed: 'mock_exam',
  general: 'roadmap',
};

export const TaskCard: React.FC<{ task: RoadmapTask; showDayBadge?: boolean }> = ({
  task,
  showDayBadge = false,
}) => {
  const {
    taskProgressMap,
    updateTaskStatus,
    toggleTaskChecklistItem,
    saveTaskNotes,
    timer,
    startTimerForTask,
    pauseTimer,
    setActiveTab,
    extractionIssues,
  } = useApp();

  const progress = taskProgressMap[task.id] || {
    taskId: task.id,
    status: 'not_started',
    startedAt: null,
    completedAt: null,
    skipReason: '',
    notes: '',
    checkedItems: [],
    actualSeconds: 0,
  };

  const [expanded, setExpanded] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [skipReasonInput, setSkipReasonInput] = useState(progress.skipReason || '');
  const [noteInput, setNoteInput] = useState(progress.notes || '');
  const [noteSavedMsg, setNoteSavedMsg] = useState(false);

  const isTimerActiveOnThis = timer.taskId === task.id && timer.running;

  const taskIssues = extractionIssues.filter((iss) => task.flags.includes(iss.id));

  const handleSaveNote = async () => {
    await saveTaskNotes(task.id, noteInput);
    setNoteSavedMsg(true);
    setTimeout(() => setNoteSavedMsg(false), 1800);
  };

  const handleSkipSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!skipReasonInput.trim()) return;
    await updateTaskStatus(task.id, 'skipped', { skipReason: skipReasonInput.trim() });
    setSkipModalOpen(false);
  };

  return (
    <div
      className={`rounded-xl border transition-all p-4 ${
        progress.status === 'completed'
          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
          : progress.status === 'in_progress'
            ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-300 dark:border-indigo-800'
            : progress.status === 'skipped'
              ? 'bg-slate-100/70 dark:bg-slate-900/50 border-slate-300 dark:border-slate-800 opacity-80'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Top Row: Badges + Priority + Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {showDayBadge && (
            <span className="px-2 py-0.5 text-[11px] font-bold rounded bg-slate-800 text-white dark:bg-slate-700">
              Ngày {task.dayNumber}
            </span>
          )}
          <span
            className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
              SKILL_BADGE_COLORS[task.skill] || SKILL_BADGE_COLORS.general
            }`}
          >
            {SKILL_NAMES_VI[task.skill] || task.skill}
          </span>
          {task.priority === 'high' && (
            <span
              title={task.priorityBasis || 'Ưu tiên cao'}
              className="px-2 py-0.5 text-[11px] font-bold rounded bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
            >
              Trọng tâm cao
            </span>
          )}
          <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
            #{task.id}
          </span>
        </div>

        {/* Status Pill */}
        <div className="flex items-center gap-1.5">
          {progress.actualSeconds > 0 && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              Đã học: {formatSecondsToHms(progress.actualSeconds)}
            </span>
          )}
          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              progress.status === 'completed'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200'
                : progress.status === 'in_progress'
                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200'
                  : progress.status === 'paused'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                    : progress.status === 'skipped'
                      ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {progress.status === 'completed'
              ? '✓ Đã hoàn thành'
              : progress.status === 'in_progress'
                ? '● Đang học'
                : progress.status === 'paused'
                  ? '❚❚ Tạm dừng'
                  : progress.status === 'skipped'
                    ? '↷ Đã bỏ qua'
                    : 'Chưa bắt đầu'}
          </span>
        </div>
      </div>

      {/* Title */}
      <h3
        className={`text-sm md:text-base font-bold leading-snug ${
          progress.status === 'completed'
            ? 'line-through text-slate-500 dark:text-slate-400'
            : 'text-slate-900 dark:text-white'
        }`}
      >
        {task.title}
      </h3>

      {/* Metadata pills: Textbook, Unit, Page/Item Range, Duration */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-300">
        {task.textbook && (
          <span className="flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <strong>Sách:</strong> {task.textbook}
          </span>
        )}
        {task.unit && (
          <span>
            <strong>Đơn vị:</strong> {task.unit}
          </span>
        )}
        {task.itemRange && (
          <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium">
            Từ số: {task.itemRange}
          </span>
        )}
        {task.patternRange && (
          <span className="px-1.5 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 font-medium">
            Mẫu số: {task.patternRange}
          </span>
        )}
        {task.pageRanges.length > 0 && (
          <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
            Trang: {task.pageRanges.join(', ')}
          </span>
        )}
        {task.estimatedMinutes !== null ? (
          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
            <Clock className="w-3.5 h-3.5" />
            Thời lượng: {task.estimatedMinutes} phút
          </span>
        ) : task.sessionRef ? (
          <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            {task.sessionRef.session} ({task.sessionRef.sessionMinutes}p
            {task.sessionRef.skillShareMinutes
              ? ` · phần này ~${task.sessionRef.skillShareMinutes}p`
              : ''}
            )
          </span>
        ) : null}
        {task.timeGuidance.length > 0 && (
          <span className="text-rose-600 dark:text-rose-400 font-medium">
            ⏱ Bấm giờ: {task.timeGuidance.join(' | ')}
          </span>
        )}
      </div>

      {/* Verbatim instructions / checklist */}
      <div className="mt-3 text-xs md:text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-200/70 dark:border-slate-700/60">
        <div className="font-semibold text-xs text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
          <span>Chi tiết nhiệm vụ trích nguyên bản từ lộ trình:</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5 hover:underline"
          >
            {expanded ? (
              <>
                Thu gọn <ChevronUp className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                Xem Markdown gốc & Ghi chú <ChevronDown className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>

        {task.checklist.length > 0 ? (
          <ul className="space-y-1.5 jp-text">
            {task.checklist.map((item, idx) => {
              const checked = progress.checkedItems.includes(idx);
              return (
                <li key={idx} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTaskChecklistItem(task.id, idx)}
                    className="mt-1 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className={checked ? 'line-through text-slate-400' : ''}>{item}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <pre className="whitespace-pre-wrap font-sans jp-text text-xs md:text-sm leading-relaxed">
            {task.description}
          </pre>
        )}

        {/* Flagged source issues if any */}
        {taskIssues.length > 0 && (
          <div className="mt-2.5 space-y-1">
            {taskIssues.map((iss) => (
              <div
                key={iss.id}
                className="flex items-start gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Ghi chú xác thực nguồn ({iss.code}):</strong> {iss.message}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skip reason if skipped */}
      {progress.status === 'skipped' && progress.skipReason && (
        <div className="mt-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-1.5 rounded border border-amber-200 dark:border-amber-800">
          <strong>Lý do tạm bỏ qua:</strong> {progress.skipReason}
        </div>
      )}

      {/* Expanded Drawer: Raw original text + Personal notes */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-500 mb-1">
              Văn bản Markdown gốc (dòng {task.sourceLines.join(', ')}):
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto">
              {task.originalText}
            </pre>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Ghi chú cá nhân cho nhiệm vụ này:
            </label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Ghi lại từ khó, câu sai, trang sách thực tế..."
                className="flex-1 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 p-2"
              />
              <button
                onClick={handleSaveNote}
                className="px-3 py-1.5 rounded-lg bg-slate-800 dark:bg-slate-700 text-white text-xs font-semibold self-end"
              >
                Lưu ghi chú
              </button>
            </div>
            {noteSavedMsg && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                ✓ Đã lưu ghi chú vào IndexedDB.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons Row */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Start / Pause Timer */}
          {!isTimerActiveOnThis ? (
            <button
              onClick={() => startTimerForTask(task)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
            >
              <Play className="w-3.5 h-3.5" />
              Bắt đầu bấm giờ
            </button>
          ) : (
            <button
              onClick={() => {
                pauseTimer();
                updateTaskStatus(task.id, 'paused');
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold"
            >
              <Pause className="w-3.5 h-3.5" />
              Tạm dừng
            </button>
          )}

          {/* Explicit Complete Button */}
          {progress.status !== 'completed' ? (
            <button
              onClick={() => updateTaskStatus(task.id, 'completed')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Đánh dấu Hoàn thành
            </button>
          ) : (
            <button
              onClick={() => updateTaskStatus(task.id, 'in_progress')}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Mở lại task
            </button>
          )}

          {/* Skip with reason */}
          {progress.status !== 'completed' && (
            <button
              onClick={() => setSkipModalOpen(!skipModalOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <SkipForward className="w-3.5 h-3.5" />
              Bỏ qua (kèm lý do)
            </button>
          )}
        </div>

        {/* Open corresponding learning module */}
        <button
          onClick={() => setActiveTab(SKILL_TO_TAB[task.skill] || 'roadmap')}
          className="flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          <FileText className="w-3.5 h-3.5" />
          Mở phân hệ {SKILL_NAMES_VI[task.skill]}
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Inline Skip Modal */}
      {skipModalOpen && (
        <form
          onSubmit={handleSkipSubmit}
          className="mt-3 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex flex-col sm:flex-row gap-2"
        >
          <input
            type="text"
            required
            value={skipReasonInput}
            onChange={(e) => setSkipReasonInput(e.target.value)}
            placeholder="Nhập lý do bỏ qua (VD: Bận đột xuất, chuyển sang Chủ Nhật học bù)..."
            className="flex-1 text-xs rounded px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
          />
          <div className="flex gap-1.5">
            <button
              type="submit"
              className="px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-semibold"
            >
              Xác nhận bỏ qua
            </button>
            <button
              type="button"
              onClick={() => setSkipModalOpen(false)}
              className="px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-xs"
            >
              Hủy
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
