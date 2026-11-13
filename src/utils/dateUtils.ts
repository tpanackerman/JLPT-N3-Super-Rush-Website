import type { RoadmapDay, TaskProgressRecord } from '../types';

export function getTodayIsoString(simulatedTodayDate: string | null): string {
  if (simulatedTodayDate && /^\d{4}-\d{2}-\d{2}$/.test(simulatedTodayDate)) {
    return simulatedTodayDate;
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffDaysBetweenIso(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split('-').map(Number);
  const [y2, m2, d2] = toIso.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

export function formatIsoToViDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatIsoToShortVi(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

export interface RoadmapDateStatus {
  todayIso: string;
  examDateIso: string;
  daysUntilExam: number;
  calendarDayNumber: number | null; // 1..25 if todayIso is inside 2026-11-10..2026-12-04
  periodState: 'before_roadmap' | 'in_roadmap' | 'exam_day' | 'after_roadmap';
  earliestIncompleteDay: number | null;
  effectiveStudyDay: number; // Never automatically moves forward when previous day tasks remain incomplete unless user explicitly selects a day
}

export function computeRoadmapDateStatus(
  days: RoadmapDay[],
  taskProgressMap: Record<string, TaskProgressRecord>,
  examDateIso: string,
  simulatedTodayDate: string | null,
  userSelectedDay: number | null
): RoadmapDateStatus {
  const todayIso = getTodayIsoString(simulatedTodayDate);
  const daysUntilExam = diffDaysBetweenIso(todayIso, examDateIso);

  const startIso = days[0]?.date || '2026-11-10';
  const endIso = days[days.length - 1]?.date || '2026-12-04';

  let periodState: RoadmapDateStatus['periodState'] = 'in_roadmap';
  let calendarDayNumber: number | null = null;

  if (todayIso < startIso) {
    periodState = 'before_roadmap';
  } else if (todayIso === examDateIso) {
    periodState = 'exam_day';
  } else if (todayIso > endIso) {
    periodState = 'after_roadmap';
  } else {
    periodState = 'in_roadmap';
    const found = days.find((d) => d.date === todayIso);
    calendarDayNumber = found ? found.dayNumber : null;
  }

  // Find earliest day that still has incomplete tasks
  let earliestIncompleteDay: number | null = null;
  for (const d of days) {
    const hasIncomplete = d.tasks.some((t) => {
      const st = taskProgressMap[t.id]?.status || 'not_started';
      return st !== 'completed' && st !== 'skipped';
    });
    if (hasIncomplete) {
      earliestIncompleteDay = d.dayNumber;
      break;
    }
  }

  // Rule (Part 5A):
  // "Use the actual calendar date to determine the current day.
  // Do not automatically move the roadmap forward when tasks remain incomplete."
  let defaultDay = 1;
  if (calendarDayNumber !== null) {
    if (earliestIncompleteDay !== null && earliestIncompleteDay < calendarDayNumber) {
      defaultDay = earliestIncompleteDay;
    } else {
      defaultDay = calendarDayNumber;
    }
  } else if (periodState === 'after_roadmap' || periodState === 'exam_day') {
    defaultDay = earliestIncompleteDay !== null ? earliestIncompleteDay : 25;
  } else {
    defaultDay = earliestIncompleteDay !== null ? earliestIncompleteDay : 1;
  }

  const effectiveStudyDay =
    userSelectedDay && userSelectedDay >= 1 && userSelectedDay <= 25
      ? userSelectedDay
      : defaultDay;

  return {
    todayIso,
    examDateIso,
    daysUntilExam,
    calendarDayNumber,
    periodState,
    earliestIncompleteDay,
    effectiveStudyDay,
  };
}

export function formatSecondsToHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
