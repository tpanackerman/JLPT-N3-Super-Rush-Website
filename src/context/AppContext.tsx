import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import roadmapRaw from '../data/roadmap.json';
import vocabRaw from '../data/vocabulary.json';
import grammarRaw from '../data/grammar.json';
import kanjiRaw from '../data/kanji.json';
import readingRaw from '../data/reading_tasks.json';
import listeningRaw from '../data/listening_tasks.json';
import mockRaw from '../data/mock_tests.json';
import issuesRaw from '../data/extraction_issues.json';

import type {
  RoadmapDay,
  RoadmapPhase,
  RoadmapTask,
  TaskProgressRecord,
  PersonalAdjustment,
  VocabItem,
  SrsCardState,
  SrsRating,
  GrammarPattern,
  GrammarProgressRecord,
  GrammarMasteryLevel,
  KanjiWordItem,
  KanjiCharItem,
  KanjiProgressRecord,
  ReadingPassageExercise,
  ReadingAttemptRecord,
  ListeningExerciseItem,
  ListeningAttemptRecord,
  MistakeRecord,
  StudySessionLog,
  MockExamAttempt,
  UserSettings,
  NavigationTab,
  SkillType,
} from '../types';

import {
  getAllFromStore,
  putInStore,
  putManyInStore,
  deleteFromStore,
  loadUserSettings,
  saveUserSettings,
  exportFullBackup,
  restoreFullBackup,
  resetAllUserData,
  type FullBackupPayload,
} from '../db/storage';

import {
  scheduleNextSrsReview,
  computeGrammarLevelAfterPractice,
  generateAdaptiveRecommendations,
  type AdaptiveRecommendation,
} from '../utils/learningEngine';

import { computeRoadmapDateStatus, type RoadmapDateStatus } from '../utils/dateUtils';

export interface ActiveTimerState {
  running: boolean;
  taskId: string | null;
  dayNumber: number;
  skill: SkillType;
  plannedMinutes: number;
  elapsedSeconds: number;
  interruptions: number;
  startedAt: string | null;
}

interface AppContextValue {
  ready: boolean;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;

  // Immutable source data
  roadmapMeta: typeof roadmapRaw.meta;
  phases: RoadmapPhase[];
  days: RoadmapDay[];
  allTasks: RoadmapTask[];
  vocabMeta: typeof vocabRaw;
  grammarMeta: typeof grammarRaw;
  kanjiMeta: typeof kanjiRaw;
  readingMeta: typeof readingRaw;
  listeningMeta: typeof listeningRaw;
  mockMeta: typeof mockRaw;
  extractionIssues: typeof issuesRaw.issues;

  // Combined items (source + user imported)
  allVocabItems: VocabItem[];
  allGrammarPatterns: GrammarPattern[];
  allKanjiWords: KanjiWordItem[];
  allKanjiChars: KanjiCharItem[];
  readingPassages: ReadingPassageExercise[];
  listeningExercises: ListeningExerciseItem[];

  // Persistent user state
  settings: UserSettings;
  updateSettings: (partial: Partial<UserSettings>) => void;
  selectedDayNumber: number;
  setSelectedDayNumber: (day: number) => void;
  dateStatus: RoadmapDateStatus;

  taskProgressMap: Record<string, TaskProgressRecord>;
  adjustments: PersonalAdjustment[];
  srsCardsMap: Record<string, SrsCardState>;
  grammarProgressMap: Record<string, GrammarProgressRecord>;
  kanjiProgressMap: Record<string, KanjiProgressRecord>;
  readingAttempts: ReadingAttemptRecord[];
  listeningAttempts: ListeningAttemptRecord[];
  mistakes: MistakeRecord[];
  studySessions: StudySessionLog[];
  mockAttempts: MockExamAttempt[];
  recommendations: AdaptiveRecommendation[];

  // Task actions
  updateTaskStatus: (
    taskId: string,
    status: TaskProgressRecord['status'],
    extra?: { skipReason?: string; notes?: string; checkedItems?: number[] }
  ) => Promise<void>;
  toggleTaskChecklistItem: (taskId: string, index: number) => Promise<void>;
  saveTaskNotes: (taskId: string, notes: string) => Promise<void>;

  // Personal Roadmap Adjustments (Recovery mode without overwriting immutable roadmap)
  addPersonalAdjustment: (adj: Omit<PersonalAdjustment, 'id' | 'createdAt'>) => Promise<void>;
  togglePersonalAdjustmentComplete: (id: string) => Promise<void>;
  deletePersonalAdjustment: (id: string) => Promise<void>;

  // SRS & Vocab actions
  rateVocabCard: (itemId: string, rating: SrsRating) => Promise<void>;
  toggleVocabRedMark: (itemId: string) => Promise<void>;
  importVocabItems: (items: VocabItem[]) => Promise<number>;

  // Grammar actions
  recordGrammarPractice: (patternId: string, isCorrect: boolean) => Promise<GrammarProgressRecord>;
  setGrammarLevelManual: (
    patternId: string,
    requestedLevel: GrammarMasteryLevel
  ) => Promise<{ actualLevel: GrammarMasteryLevel; message?: string }>;
  toggleGrammarRedMark: (patternId: string) => Promise<void>;
  importGrammarPatterns: (patterns: GrammarPattern[]) => Promise<number>;

  // Kanji actions
  recordKanjiPractice: (
    id: string,
    targetType: 'word' | 'character',
    mode: 'recognition' | 'reading',
    isCorrect: boolean
  ) => Promise<void>;
  toggleKanjiRedMark: (id: string, targetType: 'word' | 'character') => Promise<void>;
  importKanjiChars: (chars: KanjiCharItem[]) => Promise<number>;
  importKanjiWords: (words: KanjiWordItem[]) => Promise<number>;

  // Reading & Listening actions
  saveReadingPassage: (passage: ReadingPassageExercise) => Promise<void>;
  recordReadingAttempt: (attempt: Omit<ReadingAttemptRecord, 'id' | 'createdAt'>) => Promise<void>;
  saveListeningExercise: (exercise: ListeningExerciseItem) => Promise<void>;
  recordListeningAttempt: (attempt: Omit<ListeningAttemptRecord, 'id' | 'createdAt'>) => Promise<void>;

  // Mistake Notebook actions
  addOrIncrementMistake: (
    mistake: Omit<MistakeRecord, 'id' | 'createdAt' | 'lastFailedAt' | 'repeatedFailures' | 'reviewStatus'>
  ) => Promise<void>;
  updateMistakeStatus: (id: string, status: MistakeRecord['reviewStatus']) => Promise<void>;
  deleteMistake: (id: string) => Promise<void>;

  // Timer actions
  timer: ActiveTimerState;
  startTimerForTask: (task: RoadmapTask) => void;
  startCustomTimer: (skill: SkillType, dayNumber: number, plannedMinutes: number, taskId?: string | null) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  recordTimerInterruption: () => void;
  finishAndLogTimerSession: (notes?: string) => Promise<void>;
  resetTimer: () => void;

  // Mock Exam actions
  saveMockExamAttempt: (attempt: Omit<MockExamAttempt, 'id'>) => Promise<void>;
  deleteMockExamAttempt: (id: string) => Promise<void>;

  // Backup / Restore / Reset
  exportBackup: () => Promise<FullBackupPayload>;
  restoreBackup: (payload: FullBackupPayload) => Promise<void>;
  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [settings, setSettings] = useState<UserSettings>(() => loadUserSettings());
  const [userSelectedDay, setUserSelectedDay] = useState<number | null>(null);

  const [taskProgressMap, setTaskProgressMap] = useState<Record<string, TaskProgressRecord>>({});
  const [adjustments, setAdjustments] = useState<PersonalAdjustment[]>([]);
  const [customVocab, setCustomVocab] = useState<VocabItem[]>([]);
  const [srsCardsMap, setSrsCardsMap] = useState<Record<string, SrsCardState>>({});
  const [customGrammar, setCustomGrammar] = useState<GrammarPattern[]>([]);
  const [grammarProgressMap, setGrammarProgressMap] = useState<Record<string, GrammarProgressRecord>>({});
  const [customKanjiWords, setCustomKanjiWords] = useState<KanjiWordItem[]>([]);
  const [customKanjiChars, setCustomKanjiChars] = useState<KanjiCharItem[]>([]);
  const [kanjiProgressMap, setKanjiProgressMap] = useState<Record<string, KanjiProgressRecord>>({});
  const [readingPassages, setReadingPassages] = useState<ReadingPassageExercise[]>([]);
  const [readingAttempts, setReadingAttempts] = useState<ReadingAttemptRecord[]>([]);
  const [listeningExercises, setListeningExercises] = useState<ListeningExerciseItem[]>([]);
  const [listeningAttempts, setListeningAttempts] = useState<ListeningAttemptRecord[]>([]);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [studySessions, setStudySessions] = useState<StudySessionLog[]>([]);
  const [mockAttempts, setMockAttempts] = useState<MockExamAttempt[]>([]);

  const [timer, setTimer] = useState<ActiveTimerState>({
    running: false,
    taskId: null,
    dayNumber: 1,
    skill: 'vocabulary',
    plannedMinutes: 45,
    elapsedSeconds: 0,
    interruptions: 0,
    startedAt: null,
  });

  // Apply light/dark theme to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [settings.theme]);

  const loadAllFromIndexedDB = useCallback(async () => {
    try {
      const [
        tp,
        adj,
        cv,
        srs,
        cg,
        gp,
        ckw,
        ckc,
        kp,
        rp,
        ra,
        le,
        la,
        ms,
        ss,
        ma,
      ] = await Promise.all([
        getAllFromStore<TaskProgressRecord>('taskProgress'),
        getAllFromStore<PersonalAdjustment>('adjustments'),
        getAllFromStore<VocabItem>('customVocab'),
        getAllFromStore<SrsCardState>('srsCards'),
        getAllFromStore<GrammarPattern>('customGrammar'),
        getAllFromStore<GrammarProgressRecord>('grammarProgress'),
        getAllFromStore<KanjiWordItem>('customKanjiWords'),
        getAllFromStore<KanjiCharItem>('customKanjiChars'),
        getAllFromStore<KanjiProgressRecord>('kanjiProgress'),
        getAllFromStore<ReadingPassageExercise>('readingPassages'),
        getAllFromStore<ReadingAttemptRecord>('readingAttempts'),
        getAllFromStore<ListeningExerciseItem>('listeningExercises'),
        getAllFromStore<ListeningAttemptRecord>('listeningAttempts'),
        getAllFromStore<MistakeRecord>('mistakes'),
        getAllFromStore<StudySessionLog>('studySessions'),
        getAllFromStore<MockExamAttempt>('mockAttempts'),
      ]);

      const tpMap: Record<string, TaskProgressRecord> = {};
      tp.forEach((r) => {
        tpMap[r.taskId] = r;
      });
      setTaskProgressMap(tpMap);
      setAdjustments(adj);
      setCustomVocab(cv);

      const srsMap: Record<string, SrsCardState> = {};
      srs.forEach((c) => {
        srsMap[c.itemId] = c;
      });
      setSrsCardsMap(srsMap);

      setCustomGrammar(cg);
      const gpMap: Record<string, GrammarProgressRecord> = {};
      gp.forEach((g) => {
        gpMap[g.patternId] = g;
      });
      setGrammarProgressMap(gpMap);

      setCustomKanjiWords(ckw);
      setCustomKanjiChars(ckc);
      const kpMap: Record<string, KanjiProgressRecord> = {};
      kp.forEach((k) => {
        kpMap[k.id] = k;
      });
      setKanjiProgressMap(kpMap);

      setReadingPassages(rp);
      setReadingAttempts(ra);
      setListeningExercises(le);
      setListeningAttempts(la);
      setMistakes(ms);
      setStudySessions(ss);
      setMockAttempts(ma);
    } catch (err) {
      console.error('Error loading IndexedDB stores:', err);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    loadAllFromIndexedDB();
  }, [loadAllFromIndexedDB]);

  // Timer tick interval
  useEffect(() => {
    if (!timer.running) return;
    const id = window.setInterval(() => {
      setTimer((prev) => (prev.running ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : prev));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timer.running]);

  const days = useMemo(() => roadmapRaw.days as unknown as RoadmapDay[], []);
  const phases = useMemo(() => roadmapRaw.phases as unknown as RoadmapPhase[], []);
  const allTasks = useMemo(() => days.flatMap((d) => d.tasks), [days]);

  const dateStatus = useMemo(
    () =>
      computeRoadmapDateStatus(
        days,
        taskProgressMap,
        settings.examDate,
        settings.simulatedTodayDate,
        userSelectedDay
      ),
    [days, taskProgressMap, settings.examDate, settings.simulatedTodayDate, userSelectedDay]
  );

  const selectedDayNumber = dateStatus.effectiveStudyDay;

  const setSelectedDayNumber = useCallback((day: number) => {
    setUserSelectedDay(day);
  }, []);

  const updateSettings = useCallback((partial: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveUserSettings(next);
      return next;
    });
  }, []);

  // Merge immutable roadmap items with user-imported items (deduped by stable ID)
  const allVocabItems = useMemo(() => {
    const map = new Map<string, VocabItem>();
    (vocabRaw.items as unknown as VocabItem[]).forEach((v) => map.set(v.id, v));
    customVocab.forEach((v) => map.set(v.id, v));
    return Array.from(map.values());
  }, [customVocab]);

  const allGrammarPatterns = useMemo(() => {
    const map = new Map<string, GrammarPattern>();
    (grammarRaw.patterns as unknown as GrammarPattern[]).forEach((p) => map.set(p.id, p));
    customGrammar.forEach((p) => map.set(p.id, p));
    return Array.from(map.values());
  }, [customGrammar]);

  const allKanjiWords = useMemo(() => {
    const map = new Map<string, KanjiWordItem>();
    (kanjiRaw.words as unknown as KanjiWordItem[]).forEach((w) => map.set(w.id, w));
    customKanjiWords.forEach((w) => map.set(w.id, w));
    return Array.from(map.values());
  }, [customKanjiWords]);

  const allKanjiChars = useMemo(() => {
    const map = new Map<string, KanjiCharItem>();
    customKanjiChars.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }, [customKanjiChars]);

  const recommendations = useMemo(
    () =>
      generateAdaptiveRecommendations({
        days,
        calendarDayNumber: dateStatus.calendarDayNumber,
        activeRoadmapDay: selectedDayNumber,
        taskProgressMap,
        srsCards: Object.values(srsCardsMap),
        grammarProgress: Object.values(grammarProgressMap),
        kanjiProgress: Object.values(kanjiProgressMap),
        mistakes,
        mockAttempts,
      }),
    [
      days,
      dateStatus.calendarDayNumber,
      selectedDayNumber,
      taskProgressMap,
      srsCardsMap,
      grammarProgressMap,
      kanjiProgressMap,
      mistakes,
      mockAttempts,
    ]
  );

  // Task operations
  const updateTaskStatus = useCallback(
    async (
      taskId: string,
      status: TaskProgressRecord['status'],
      extra?: { skipReason?: string; notes?: string; checkedItems?: number[] }
    ) => {
      const existing = taskProgressMap[taskId] || {
        taskId,
        status: 'not_started',
        startedAt: null,
        completedAt: null,
        skipReason: '',
        notes: '',
        checkedItems: [],
        actualSeconds: 0,
      };
      const now = new Date().toISOString();
      const updated: TaskProgressRecord = {
        ...existing,
        status,
        startedAt: status === 'in_progress' && !existing.startedAt ? now : existing.startedAt,
        completedAt: status === 'completed' ? now : status === 'not_started' ? null : existing.completedAt,
        skipReason: extra?.skipReason !== undefined ? extra.skipReason : existing.skipReason,
        notes: extra?.notes !== undefined ? extra.notes : existing.notes,
        checkedItems: extra?.checkedItems !== undefined ? extra.checkedItems : existing.checkedItems,
      };
      await putInStore('taskProgress', updated);
      setTaskProgressMap((prev) => ({ ...prev, [taskId]: updated }));
    },
    [taskProgressMap]
  );

  const toggleTaskChecklistItem = useCallback(
    async (taskId: string, index: number) => {
      const existing = taskProgressMap[taskId] || {
        taskId,
        status: 'not_started',
        startedAt: null,
        completedAt: null,
        skipReason: '',
        notes: '',
        checkedItems: [],
        actualSeconds: 0,
      };
      const checked = existing.checkedItems.includes(index)
        ? existing.checkedItems.filter((i) => i !== index)
        : [...existing.checkedItems, index];
      const updated: TaskProgressRecord = {
        ...existing,
        checkedItems: checked,
        status: existing.status === 'not_started' && checked.length > 0 ? 'in_progress' : existing.status,
        startedAt: existing.startedAt || new Date().toISOString(),
      };
      await putInStore('taskProgress', updated);
      setTaskProgressMap((prev) => ({ ...prev, [taskId]: updated }));
    },
    [taskProgressMap]
  );

  const saveTaskNotes = useCallback(
    async (taskId: string, notes: string) => {
      const existing = taskProgressMap[taskId] || {
        taskId,
        status: 'not_started',
        startedAt: null,
        completedAt: null,
        skipReason: '',
        notes: '',
        checkedItems: [],
        actualSeconds: 0,
      };
      const updated: TaskProgressRecord = { ...existing, notes };
      await putInStore('taskProgress', updated);
      setTaskProgressMap((prev) => ({ ...prev, [taskId]: updated }));
    },
    [taskProgressMap]
  );

  // Personal adjustments
  const addPersonalAdjustment = useCallback(
    async (adj: Omit<PersonalAdjustment, 'id' | 'createdAt'>) => {
      const record: PersonalAdjustment = {
        ...adj,
        id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: new Date().toISOString(),
        completed: false,
        completedAt: null,
      };
      await putInStore('adjustments', record);
      setAdjustments((prev) => [...prev, record]);
    },
    []
  );

  const togglePersonalAdjustmentComplete = useCallback(
    async (id: string) => {
      const target = adjustments.find((a) => a.id === id);
      if (!target) return;
      const completed = !target.completed;
      const updated: PersonalAdjustment = {
        ...target,
        completed,
        completedAt: completed ? new Date().toISOString() : null,
      };
      await putInStore('adjustments', updated);
      setAdjustments((prev) => prev.map((a) => (a.id === id ? updated : a)));
    },
    [adjustments]
  );

  const deletePersonalAdjustment = useCallback(async (id: string) => {
    await deleteFromStore('adjustments', id);
    setAdjustments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // SRS & Vocab
  const rateVocabCard = useCallback(
    async (itemId: string, rating: SrsRating) => {
      const updated = scheduleNextSrsReview(srsCardsMap[itemId], itemId, 'vocabulary', rating);
      await putInStore('srsCards', updated);
      setSrsCardsMap((prev) => ({ ...prev, [itemId]: updated }));
    },
    [srsCardsMap]
  );

  const toggleVocabRedMark = useCallback(
    async (itemId: string) => {
      const existing = srsCardsMap[itemId] || {
        itemId,
        itemType: 'vocabulary' as const,
        stepIndex: 0,
        intervalMinutes: 0,
        easeFactor: 2.5,
        dueAt: new Date().toISOString(),
        lastReviewedAt: new Date().toISOString(),
        reviewCount: 0,
        correctCount: 0,
        lapseCount: 0,
        consecutiveCorrect: 0,
        redMarked: false,
        status: 'new' as const,
      };
      const updated: SrsCardState = { ...existing, redMarked: !existing.redMarked };
      await putInStore('srsCards', updated);
      setSrsCardsMap((prev) => ({ ...prev, [itemId]: updated }));
    },
    [srsCardsMap]
  );

  const importVocabItems = useCallback(async (items: VocabItem[]) => {
    if (items.length === 0) return 0;
    await putManyInStore('customVocab', items);
    setCustomVocab((prev) => {
      const map = new Map(prev.map((x) => [x.id, x]));
      items.forEach((i) => map.set(i.id, i));
      return Array.from(map.values());
    });
    return items.length;
  }, []);

  // Grammar
  const recordGrammarPractice = useCallback(
    async (patternId: string, isCorrect: boolean) => {
      const updated = computeGrammarLevelAfterPractice(grammarProgressMap[patternId], patternId, isCorrect);
      await putInStore('grammarProgress', updated);
      setGrammarProgressMap((prev) => ({ ...prev, [patternId]: updated }));
      return updated;
    },
    [grammarProgressMap]
  );

  const setGrammarLevelManual = useCallback(
    async (patternId: string, requestedLevel: GrammarMasteryLevel) => {
      const existing = grammarProgressMap[patternId] || {
        patternId,
        level: 'not_learned',
        attempts: 0,
        correct: 0,
        consecutiveCorrect: 0,
        lastPracticedAt: null,
        redMarked: false,
        notes: '',
      };

      // Enforce Part 8 rule: "Mastery must depend on repeated successful recall, not merely clicking a completion button."
      if (requestedLevel === 'mastered' && existing.consecutiveCorrect < 2) {
        const fallback: GrammarProgressRecord = { ...existing, level: 'understood' };
        await putInStore('grammarProgress', fallback);
        setGrammarProgressMap((prev) => ({ ...prev, [patternId]: fallback }));
        return {
          actualLevel: 'understood' as const,
          message:
            'Theo quy tắc học chủ động, trạng thái "Mastered (Thành thạo)" chỉ mở khóa sau ít nhất 2–3 lần trả lời đúng liên tiếp trong bài luyện tập. Đã chuyển tạm sang "Understood (Đã hiểu)".',
        };
      }

      const updated: GrammarProgressRecord = { ...existing, level: requestedLevel };
      await putInStore('grammarProgress', updated);
      setGrammarProgressMap((prev) => ({ ...prev, [patternId]: updated }));
      return { actualLevel: requestedLevel };
    },
    [grammarProgressMap]
  );

  const toggleGrammarRedMark = useCallback(
    async (patternId: string) => {
      const existing = grammarProgressMap[patternId] || {
        patternId,
        level: 'not_learned' as const,
        attempts: 0,
        correct: 0,
        consecutiveCorrect: 0,
        lastPracticedAt: null,
        redMarked: false,
        notes: '',
      };
      const updated: GrammarProgressRecord = { ...existing, redMarked: !existing.redMarked };
      await putInStore('grammarProgress', updated);
      setGrammarProgressMap((prev) => ({ ...prev, [patternId]: updated }));
    },
    [grammarProgressMap]
  );

  const importGrammarPatterns = useCallback(async (patterns: GrammarPattern[]) => {
    if (patterns.length === 0) return 0;
    await putManyInStore('customGrammar', patterns);
    setCustomGrammar((prev) => {
      const map = new Map(prev.map((x) => [x.id, x]));
      patterns.forEach((p) => map.set(p.id, p));
      return Array.from(map.values());
    });
    return patterns.length;
  }, []);

  // Kanji
  const recordKanjiPractice = useCallback(
    async (
      id: string,
      targetType: 'word' | 'character',
      mode: 'recognition' | 'reading',
      isCorrect: boolean
    ) => {
      const existing = kanjiProgressMap[id] || {
        id,
        targetType,
        recognitionAttempts: 0,
        recognitionCorrect: 0,
        readingAttempts: 0,
        readingCorrect: 0,
        mastered: false,
        redMarked: false,
        lastPracticedAt: null,
      };
      const updated: KanjiProgressRecord = {
        ...existing,
        lastPracticedAt: new Date().toISOString(),
        recognitionAttempts:
          mode === 'recognition' ? existing.recognitionAttempts + 1 : existing.recognitionAttempts,
        recognitionCorrect:
          mode === 'recognition' && isCorrect ? existing.recognitionCorrect + 1 : existing.recognitionCorrect,
        readingAttempts: mode === 'reading' ? existing.readingAttempts + 1 : existing.readingAttempts,
        readingCorrect:
          mode === 'reading' && isCorrect ? existing.readingCorrect + 1 : existing.readingCorrect,
      };
      const totalAtt = updated.recognitionAttempts + updated.readingAttempts;
      const totalCor = updated.recognitionCorrect + updated.readingCorrect;
      updated.mastered = totalAtt >= 3 && totalCor / totalAtt >= 0.8;

      await putInStore('kanjiProgress', updated);
      setKanjiProgressMap((prev) => ({ ...prev, [id]: updated }));
    },
    [kanjiProgressMap]
  );

  const toggleKanjiRedMark = useCallback(
    async (id: string, targetType: 'word' | 'character') => {
      const existing = kanjiProgressMap[id] || {
        id,
        targetType,
        recognitionAttempts: 0,
        recognitionCorrect: 0,
        readingAttempts: 0,
        readingCorrect: 0,
        mastered: false,
        redMarked: false,
        lastPracticedAt: null,
      };
      const updated: KanjiProgressRecord = { ...existing, redMarked: !existing.redMarked };
      await putInStore('kanjiProgress', updated);
      setKanjiProgressMap((prev) => ({ ...prev, [id]: updated }));
    },
    [kanjiProgressMap]
  );

  const importKanjiChars = useCallback(async (chars: KanjiCharItem[]) => {
    if (chars.length === 0) return 0;
    await putManyInStore('customKanjiChars', chars);
    setCustomKanjiChars((prev) => {
      const map = new Map(prev.map((x) => [x.id, x]));
      chars.forEach((c) => map.set(c.id, c));
      return Array.from(map.values());
    });
    return chars.length;
  }, []);

  const importKanjiWords = useCallback(async (words: KanjiWordItem[]) => {
    if (words.length === 0) return 0;
    await putManyInStore('customKanjiWords', words);
    setCustomKanjiWords((prev) => {
      const map = new Map(prev.map((x) => [x.id, x]));
      words.forEach((w) => map.set(w.id, w));
      return Array.from(map.values());
    });
    return words.length;
  }, []);

  // Reading & Listening
  const saveReadingPassage = useCallback(async (passage: ReadingPassageExercise) => {
    await putInStore('readingPassages', passage);
    setReadingPassages((prev) => {
      const others = prev.filter((p) => p.id !== passage.id);
      return [...others, passage];
    });
  }, []);

  const recordReadingAttempt = useCallback(
    async (attempt: Omit<ReadingAttemptRecord, 'id' | 'createdAt'>) => {
      const record: ReadingAttemptRecord = {
        ...attempt,
        id: `ra-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      await putInStore('readingAttempts', record);
      setReadingAttempts((prev) => [record, ...prev]);
    },
    []
  );

  const saveListeningExercise = useCallback(async (exercise: ListeningExerciseItem) => {
    await putInStore('listeningExercises', exercise);
    setListeningExercises((prev) => {
      const others = prev.filter((e) => e.id !== exercise.id);
      return [...others, exercise];
    });
  }, []);

  const recordListeningAttempt = useCallback(
    async (attempt: Omit<ListeningAttemptRecord, 'id' | 'createdAt'>) => {
      const record: ListeningAttemptRecord = {
        ...attempt,
        id: `la-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      await putInStore('listeningAttempts', record);
      setListeningAttempts((prev) => [record, ...prev]);
    },
    []
  );

  // Mistake Notebook
  const addOrIncrementMistake = useCallback(
    async (
      mistake: Omit<MistakeRecord, 'id' | 'createdAt' | 'lastFailedAt' | 'repeatedFailures' | 'reviewStatus'>
    ) => {
      const now = new Date().toISOString();
      const existing = mistakes.find(
        (m) => m.skill === mistake.skill && m.question.trim() === mistake.question.trim()
      );
      if (existing) {
        const updated: MistakeRecord = {
          ...existing,
          incorrectAnswer: mistake.incorrectAnswer,
          lastFailedAt: now,
          repeatedFailures: existing.repeatedFailures + 1,
          reviewStatus: 'unresolved',
        };
        await putInStore('mistakes', updated);
        setMistakes((prev) => prev.map((m) => (m.id === existing.id ? updated : m)));
      } else {
        const record: MistakeRecord = {
          ...mistake,
          id: `mk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: now,
          lastFailedAt: now,
          repeatedFailures: 1,
          reviewStatus: 'unresolved',
        };
        await putInStore('mistakes', record);
        setMistakes((prev) => [record, ...prev]);
      }
    },
    [mistakes]
  );

  const updateMistakeStatus = useCallback(
    async (id: string, status: MistakeRecord['reviewStatus']) => {
      const existing = mistakes.find((m) => m.id === id);
      if (!existing) return;
      const updated: MistakeRecord = { ...existing, reviewStatus: status };
      await putInStore('mistakes', updated);
      setMistakes((prev) => prev.map((m) => (m.id === id ? updated : m)));
    },
    [mistakes]
  );

  const deleteMistake = useCallback(async (id: string) => {
    await deleteFromStore('mistakes', id);
    setMistakes((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Study Timer (Part 13: "Do not automatically mark tasks completed when the timer ends.")
  const startTimerForTask = useCallback(
    (task: RoadmapTask) => {
      const planned =
        task.estimatedMinutes ||
        task.sessionRef?.skillShareMinutes ||
        task.sessionRef?.sessionMinutes ||
        30;
      setTimer({
        running: true,
        taskId: task.id,
        dayNumber: task.dayNumber,
        skill: task.skill,
        plannedMinutes: planned,
        elapsedSeconds: 0,
        interruptions: 0,
        startedAt: new Date().toISOString(),
      });
      if ((taskProgressMap[task.id]?.status || 'not_started') === 'not_started') {
        updateTaskStatus(task.id, 'in_progress');
      }
    },
    [taskProgressMap, updateTaskStatus]
  );

  const startCustomTimer = useCallback(
    (skill: SkillType, dayNumber: number, plannedMinutes: number, taskId: string | null = null) => {
      setTimer({
        running: true,
        taskId,
        dayNumber,
        skill,
        plannedMinutes,
        elapsedSeconds: 0,
        interruptions: 0,
        startedAt: new Date().toISOString(),
      });
    },
    []
  );

  const pauseTimer = useCallback(() => {
    setTimer((prev) => ({ ...prev, running: false }));
  }, []);

  const resumeTimer = useCallback(() => {
    setTimer((prev) => ({
      ...prev,
      running: true,
      startedAt: prev.startedAt || new Date().toISOString(),
    }));
  }, []);

  const recordTimerInterruption = useCallback(() => {
    setTimer((prev) => ({
      ...prev,
      running: false,
      interruptions: prev.interruptions + 1,
    }));
  }, []);

  const finishAndLogTimerSession = useCallback(
    async (notes = '') => {
      if (timer.elapsedSeconds <= 0) return;
      const now = new Date().toISOString();
      const session: StudySessionLog = {
        id: `ss-${Date.now()}`,
        taskId: timer.taskId,
        dayNumber: timer.dayNumber,
        skill: timer.skill,
        startedAt: timer.startedAt || now,
        endedAt: now,
        durationSeconds: timer.elapsedSeconds,
        plannedMinutes: timer.plannedMinutes,
        interruptions: timer.interruptions,
        notes,
      };
      await putInStore('studySessions', session);
      setStudySessions((prev) => [session, ...prev]);

      if (timer.taskId) {
        const existing = taskProgressMap[timer.taskId] || {
          taskId: timer.taskId,
          status: 'in_progress' as const,
          startedAt: timer.startedAt || now,
          completedAt: null,
          skipReason: '',
          notes: '',
          checkedItems: [],
          actualSeconds: 0,
        };
        const updatedTask: TaskProgressRecord = {
          ...existing,
          actualSeconds: (existing.actualSeconds || 0) + timer.elapsedSeconds,
        };
        await putInStore('taskProgress', updatedTask);
        setTaskProgressMap((prev) => ({ ...prev, [timer.taskId!]: updatedTask }));
      }

      setTimer((prev) => ({
        ...prev,
        running: false,
        elapsedSeconds: 0,
        interruptions: 0,
        startedAt: null,
      }));
    },
    [timer, taskProgressMap]
  );

  const resetTimer = useCallback(() => {
    setTimer((prev) => ({
      ...prev,
      running: false,
      elapsedSeconds: 0,
      interruptions: 0,
      startedAt: null,
    }));
  }, []);

  // Mock Exams
  const saveMockExamAttempt = useCallback(async (attempt: Omit<MockExamAttempt, 'id'>) => {
    const record: MockExamAttempt = {
      ...attempt,
      id: `mock-att-${Date.now()}`,
    };
    await putInStore('mockAttempts', record);
    setMockAttempts((prev) => [record, ...prev]);
  }, []);

  const deleteMockExamAttempt = useCallback(async (id: string) => {
    await deleteFromStore('mockAttempts', id);
    setMockAttempts((prev) => prev.filter((m) => m.id !== id));
  }, []);

  // Backup / Restore / Reset
  const exportBackup = useCallback(async () => {
    return exportFullBackup();
  }, []);

  const restoreBackup = useCallback(
    async (payload: FullBackupPayload) => {
      await restoreFullBackup(payload);
      setSettings(loadUserSettings());
      await loadAllFromIndexedDB();
    },
    [loadAllFromIndexedDB]
  );

  const resetAllData = useCallback(async () => {
    await resetAllUserData();
    setSettings(loadUserSettings());
    await loadAllFromIndexedDB();
  }, [loadAllFromIndexedDB]);

  const value: AppContextValue = {
    ready,
    activeTab,
    setActiveTab,
    roadmapMeta: roadmapRaw.meta,
    phases,
    days,
    allTasks,
    vocabMeta: vocabRaw,
    grammarMeta: grammarRaw,
    kanjiMeta: kanjiRaw,
    readingMeta: readingRaw,
    listeningMeta: listeningRaw,
    mockMeta: mockRaw,
    extractionIssues: issuesRaw.issues,
    allVocabItems,
    allGrammarPatterns,
    allKanjiWords,
    allKanjiChars,
    readingPassages,
    listeningExercises,
    settings,
    updateSettings,
    selectedDayNumber,
    setSelectedDayNumber,
    dateStatus,
    taskProgressMap,
    adjustments,
    srsCardsMap,
    grammarProgressMap,
    kanjiProgressMap,
    readingAttempts,
    listeningAttempts,
    mistakes,
    studySessions,
    mockAttempts,
    recommendations,
    updateTaskStatus,
    toggleTaskChecklistItem,
    saveTaskNotes,
    addPersonalAdjustment,
    togglePersonalAdjustmentComplete,
    deletePersonalAdjustment,
    rateVocabCard,
    toggleVocabRedMark,
    importVocabItems,
    recordGrammarPractice,
    setGrammarLevelManual,
    toggleGrammarRedMark,
    importGrammarPatterns,
    recordKanjiPractice,
    toggleKanjiRedMark,
    importKanjiChars,
    importKanjiWords,
    saveReadingPassage,
    recordReadingAttempt,
    saveListeningExercise,
    recordListeningAttempt,
    addOrIncrementMistake,
    updateMistakeStatus,
    deleteMistake,
    timer,
    startTimerForTask,
    startCustomTimer,
    pauseTimer,
    resumeTimer,
    recordTimerInterruption,
    finishAndLogTimerSession,
    resetTimer,
    saveMockExamAttempt,
    deleteMockExamAttempt,
    exportBackup,
    restoreBackup,
    resetAllData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
