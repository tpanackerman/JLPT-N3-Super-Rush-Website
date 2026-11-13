import React, { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { BarChart3, Clock, Target, Award, AlertTriangle } from 'lucide-react';

const SKILL_COLORS: Record<string, string> = {
  vocabulary: '#4f46e5',
  grammar: '#0ea5e9',
  kanji: '#d97706',
  reading: '#10b981',
  listening: '#8b5cf6',
  mixed: '#ec4899',
  general: '#64748b',
};

const SKILL_NAMES_VI: Record<string, string> = {
  vocabulary: 'Từ vựng',
  grammar: 'Ngữ pháp',
  kanji: 'Kanji',
  reading: 'Đọc hiểu',
  listening: 'Nghe hiểu',
  mixed: 'Tổng hợp / Đề thi',
  general: 'Chung',
};

export const AnalyticsPage: React.FC = () => {
  const {
    days,
    allTasks,
    taskProgressMap,
    studySessions,
    srsCardsMap,
    grammarProgressMap,
    kanjiProgressMap,
    mistakes,
    mockAttempts,
  } = useApp();

  // 1. Daily Study Time: Planned vs Actual across 25 days
  const dailyChartData = useMemo(() => {
    return days.map((d) => {
      const daySessions = studySessions.filter((s) => s.dayNumber === d.dayNumber);
      const sessionMinutes = daySessions.reduce((acc, s) => acc + s.durationSeconds / 60, 0);
      const taskMinutes = d.tasks.reduce((acc, t) => {
        const rec = taskProgressMap[t.id];
        return acc + (rec ? rec.actualSeconds / 60 : 0);
      }, 0);
      const actualMin = Math.round(Math.max(sessionMinutes, taskMinutes));
      const completedTasks = d.tasks.filter(
        (t) => taskProgressMap[t.id]?.status === 'completed'
      ).length;

      return {
        name: `N${d.dayNumber}`,
        date: d.date.slice(5),
        plannedMinutes: d.estimatedStudyTime.minutes,
        actualMinutes: actualMin,
        completedTasks,
        totalTasks: d.tasks.length,
      };
    });
  }, [days, studySessions, taskProgressMap]);

  // 2. Weekly Study Time (4 weeks across the 25 days)
  const weeklyChartData = useMemo(() => {
    const groups = [
      { label: 'Tuần 1 (Ngày 1–7)', start: 1, end: 7 },
      { label: 'Tuần 2 (Ngày 8–14)', start: 8, end: 14 },
      { label: 'Tuần 3 (Ngày 15–21)', start: 15, end: 21 },
      { label: 'Tuần 4 (Ngày 22–25)', start: 22, end: 25 },
    ];
    return groups.map((g) => {
      const sub = dailyChartData.filter(( idxItem, idx) => idx + 1 >= g.start && idx + 1 <= g.end);
      return {
        week: g.label,
        plannedHours: Number(
          (sub.reduce((acc, x) => acc + x.plannedMinutes, 0) / 60).toFixed(1)
        ),
        actualHours: Number(
          (sub.reduce((acc, x) => acc + x.actualMinutes, 0) / 60).toFixed(1)
        ),
      };
    });
  }, [dailyChartData]);

  // 3. Study Time by Skill
  const skillTimeData = useMemo(() => {
    const totals: Record<string, number> = {
      vocabulary: 0,
      grammar: 0,
      kanji: 0,
      reading: 0,
      listening: 0,
      mixed: 0,
    };

    studySessions.forEach((s) => {
      totals[s.skill] = (totals[s.skill] || 0) + s.durationSeconds / 60;
    });

    allTasks.forEach((t) => {
      const rec = taskProgressMap[t.id];
      if (rec && rec.actualSeconds > 0) {
        totals[t.skill] = (totals[t.skill] || 0) + rec.actualSeconds / 60;
      }
    });

    return Object.entries(totals).map(([skill, mins]) => ({
      skill,
      name: SKILL_NAMES_VI[skill] || skill,
      minutes: Math.round(mins),
      color: SKILL_COLORS[skill] || '#64748b',
    }));
  }, [studySessions, allTasks, taskProgressMap]);

  // 4. Mock Exam Progression
  const mockChartData = useMemo(() => {
    return [...mockAttempts]
      .reverse()
      .map((m, idx) => ({
        name: `Đề #${m.mockNumber || idx + 1}`,
        total: m.estimatedTotalScore,
        vocabSession: m.estimatedVocabSessionScore,
        grammarReadingSession: m.estimatedGrammarReadingSessionScore,
        listening: m.estimatedListeningScore,
        passThreshold: 95,
      }));
  }, [mockAttempts]);

  const summaryKPI = useMemo(() => {
    const totalActualMinutes = dailyChartData.reduce((acc, d) => acc + d.actualMinutes, 0);
    const totalPlannedMinutes = dailyChartData.reduce((acc, d) => acc + d.plannedMinutes, 0);
    const totalInterruptions = studySessions.reduce((acc, s) => acc + s.interruptions, 0);
    const masteredVocab = Object.values(srsCardsMap).filter((c) => c.status === 'mastered').length;
    const masteredGrammar = Object.values(grammarProgressMap).filter(
      (g) => g.level === 'mastered'
    ).length;
    const masteredKanji = Object.values(kanjiProgressMap).filter((k) => k.mastered).length;

    return {
      totalActualHours: (totalActualMinutes / 60).toFixed(1),
      totalPlannedHours: (totalPlannedMinutes / 60).toFixed(1),
      totalInterruptions,
      masteredVocab,
      masteredGrammar,
      masteredKanji,
      unresolvedMistakes: mistakes.filter((m) => m.reviewStatus !== 'resolved').length,
    };
  }, [
    dailyChartData,
    studySessions,
    srsCardsMap,
    grammarProgressMap,
    kanjiProgressMap,
    mistakes,
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Phân Tích Hiệu Suất & Thống Kê Thời Gian Học Thực Tế
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Toàn bộ biểu đồ bên dưới sử dụng dữ liệu học tập thực tế từ IndexedDB (tách biệt hoàn toàn giữa Hoàn thành nhiệm vụ và Mức độ thành thạo).
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              Thời gian thực học / Kế hoạch
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {summaryKPI.totalActualHours}h{' '}
              <span className="text-xs font-normal text-slate-500">
                / {summaryKPI.totalPlannedHours}h ({studySessions.length} phiên, {summaryKPI.totalInterruptions} gián đoạn)
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              Thành thạo (Mastered)
            </div>
            <div className="text-sm font-bold text-slate-900 dark:text-white mt-1">
              Từ vựng: {summaryKPI.masteredVocab}/880 • NP: {summaryKPI.masteredGrammar}/112 • Kanji:{' '}
              {summaryKPI.masteredKanji}
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Award className="w-3.5 h-3.5 text-purple-600" />
              Đề thi thử đã làm
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {mockAttempts.length} / 4 đề Full
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              Lỗi sai chờ xử lý
            </div>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {summaryKPI.unresolvedMistakes} lỗi
            </div>
          </div>
        </div>
      </div>

      {/* Chart 1: Daily Study Time (Planned vs Actual) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          1. Thời lượng học hàng ngày: Kế hoạch (Planned) vs Thực tế (Actual) — 25 Ngày
        </h3>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyChartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="p" />
              <Tooltip />
              <Legend />
              <Bar dataKey="plannedMinutes" name="Kế hoạch (phút)" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actualMinutes" name="Thực học (phút)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2 & 3: Weekly Study Time & Study Time by Skill */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            2. Tổng thời gian học theo Tuần (Giờ)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="h" />
                <Tooltip />
                <Legend />
                <Bar dataKey="plannedHours" name="Kế hoạch (giờ)" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="actualHours" name="Thực tế (giờ)" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            3. Phân bổ thời gian thực học theo Kỹ năng (Phút)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={skillTimeData}
                  dataKey="minutes"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={(entry) => `${entry.name}: ${entry.minutes}p`}
                >
                  {skillTimeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Chart 4: Mock Exam Progression */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">
          4. Tiến trình điểm Ước tính qua các Đề thi thử (Chuẩn đỗ ≥ 95/180)
        </h3>
        {mockChartData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mockChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 180]} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Tổng điểm Ước tính (/180)"
                  stroke="#7c3aed"
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="passThreshold"
                  name="Ngưỡng đỗ (95)"
                  stroke="#ef4444"
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="py-10 text-center text-xs text-slate-500">
            Chưa có dữ liệu đề thi thử. Khi bạn nhập kết quả ở mục "Phòng Thi Thử", biểu đồ tiến trình điểm sẽ hiển thị tại đây.
          </div>
        )}
      </div>
    </div>
  );
};
