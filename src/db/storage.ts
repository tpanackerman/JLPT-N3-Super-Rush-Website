import type {
  TaskProgressRecord,
  PersonalAdjustment,
  VocabItem,
  SrsCardState,
  GrammarPattern,
  GrammarProgressRecord,
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
} from '../types';

const DB_NAME = 'jlpt_n3_25day_db';
const DB_VERSION = 1;
const SETTINGS_KEY = 'jlpt_n3_25day_settings_v1';

export const STORES = {
  taskProgress: 'taskProgress',
  adjustments: 'adjustments',
  customVocab: 'customVocab',
  srsCards: 'srsCards',
  customGrammar: 'customGrammar',
  grammarProgress: 'grammarProgress',
  customKanjiWords: 'customKanjiWords',
  customKanjiChars: 'customKanjiChars',
  kanjiProgress: 'kanjiProgress',
  readingPassages: 'readingPassages',
  readingAttempts: 'readingAttempts',
  listeningExercises: 'listeningExercises',
  listeningAttempts: 'listeningAttempts',
  mistakes: 'mistakes',
  studySessions: 'studySessions',
  mockAttempts: 'mockAttempts',
} as const;

export type StoreName = (typeof STORES)[keyof typeof STORES];

const STORE_KEY_PATHS: Record<StoreName, string> = {
  taskProgress: 'taskId',
  adjustments: 'id',
  customVocab: 'id',
  srsCards: 'itemId',
  customGrammar: 'id',
  grammarProgress: 'patternId',
  customKanjiWords: 'id',
  customKanjiChars: 'id',
  kanjiProgress: 'id',
  readingPassages: 'id',
  readingAttempts: 'id',
  listeningExercises: 'id',
  listeningAttempts: 'id',
  mistakes: 'id',
  studySessions: 'id',
  mockAttempts: 'id',
};

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      (Object.keys(STORE_KEY_PATHS) as StoreName[]).forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: STORE_KEY_PATHS[storeName] });
        }
      });
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export async function getAllFromStore<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as T[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function putInStore<T>(storeName: StoreName, record: T): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function putManyInStore<T>(storeName: StoreName, records: T[]): Promise<void> {
  if (records.length === 0) return;
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach((rec) => store.put(rec));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteFromStore(storeName: StoreName, key: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export function getDefaultSettings(): UserSettings {
  return {
    theme: 'light',
    examDate: '2026-12-05',
    activeRoadmapDay: 1,
    simulatedTodayDate: null,
    grammarTimeAllocationMinutes: 18,
    dailyPlannedMinutes: 180,
    showFuriganaByDefault: true,
  };
}

export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return getDefaultSettings();
    const parsed = JSON.parse(raw);
    return { ...getDefaultSettings(), ...parsed };
  } catch {
    return getDefaultSettings();
  }
}

export function saveUserSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.error('Failed to save settings to localStorage:', err);
  }
}

export interface FullBackupPayload {
  schemaVersion: string;
  exportedAt: string;
  settings: UserSettings;
  stores: {
    taskProgress: TaskProgressRecord[];
    adjustments: PersonalAdjustment[];
    customVocab: VocabItem[];
    srsCards: SrsCardState[];
    customGrammar: GrammarPattern[];
    grammarProgress: GrammarProgressRecord[];
    customKanjiWords: KanjiWordItem[];
    customKanjiChars: KanjiCharItem[];
    kanjiProgress: KanjiProgressRecord[];
    readingPassages: ReadingPassageExercise[];
    readingAttempts: ReadingAttemptRecord[];
    listeningExercises: ListeningExerciseItem[];
    listeningAttempts: ListeningAttemptRecord[];
    mistakes: MistakeRecord[];
    studySessions: StudySessionLog[];
    mockAttempts: MockExamAttempt[];
  };
}

export async function exportFullBackup(): Promise<FullBackupPayload> {
  const [
    taskProgress,
    adjustments,
    customVocab,
    srsCards,
    customGrammar,
    grammarProgress,
    customKanjiWords,
    customKanjiChars,
    kanjiProgress,
    readingPassages,
    readingAttempts,
    listeningExercises,
    listeningAttempts,
    mistakes,
    studySessions,
    mockAttempts,
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

  return {
    schemaVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    settings: loadUserSettings(),
    stores: {
      taskProgress,
      adjustments,
      customVocab,
      srsCards,
      customGrammar,
      grammarProgress,
      customKanjiWords,
      customKanjiChars,
      kanjiProgress,
      readingPassages,
      readingAttempts,
      listeningExercises,
      listeningAttempts,
      mistakes,
      studySessions,
      mockAttempts,
    },
  };
}

export async function restoreFullBackup(payload: FullBackupPayload): Promise<void> {
  if (!payload || !payload.stores) {
    throw new Error('Tệp sao lưu không hợp lệ (thiếu trường stores).');
  }
  if (payload.settings) {
    saveUserSettings(payload.settings);
  }
  const storeNames = Object.keys(STORES) as StoreName[];
  for (const name of storeNames) {
    await clearStore(name);
    const items = (payload.stores as Record<string, unknown[]>)[name];
    if (Array.isArray(items) && items.length > 0) {
      await putManyInStore(name, items);
    }
  }
}

export async function resetAllUserData(): Promise<void> {
  const storeNames = Object.keys(STORES) as StoreName[];
  for (const name of storeNames) {
    await clearStore(name);
  }
  localStorage.removeItem(SETTINGS_KEY);
}
