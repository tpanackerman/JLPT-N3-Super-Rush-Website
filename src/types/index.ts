export type SkillType =
  | 'vocabulary'
  | 'grammar'
  | 'kanji'
  | 'reading'
  | 'listening'
  | 'mixed'
  | 'general';

export type TaskType =
  | 'learning'
  | 'memorization'
  | 'revision'
  | 'quiz'
  | 'timed_practice'
  | 'mock_exam'
  | 'error_review'
  | 'shadowing'
  | 'exam_preparation';

export type TaskStatus = 'not_started' | 'in_progress' | ' paused' | 'completed' | 'skipped';

export interface SessionRef {
  session: string;
  sessionMinutes: number | null;
  skillShareMinutes: number | null;
  sourceLine: number;
  note: string;
}

export interface RoadmapTask {
  id: string;
  dayNumber: number;
  order: number;
  skill: SkillType;
  taskType: TaskType;
  title: string;
  description: string;
  originalText: string;
  sourceLines: number[];
  sourceSection: number | null;
  origin: 'roadmap_day' | 'daily_schedule_table';
  immutable: boolean;
  textbook: string | null;
  textbookIds: string[];
  textbookBasis: string | null;
  unit: string | null;
  pageRange: string | null;
  pageRanges: string[];
  pageNotes: string[];
  itemRange: string | null;
  patternRange: string | null;
  lessonRefs: string[];
  exerciseRefs: string[];
  mondai: number[];
  target: string | null;
  timeGuidance: string[];
  timeLimitMinutes: number | null;
  estimatedMinutes: number | null;
  estimatedMinutesSource: string | null;
  sessionRef: SessionRef | null;
  playbackSpeeds: string[];
  priority: 'high' | 'medium' | 'low';
  priorityBasis: string | null;
  checklist: string[];
  contentRefs: {
    vocabIds?: string[];
    synonymIds?: string[];
    polysemousIds?: string[];
    kanjiWordIds?: string[];
    homophoneGroupIds?: string[];
    grammarIds?: string[];
    grammarNoteIds?: string[];
    grammarTopicIds?: string[];
    readingAssignmentIds?: string[];
    listeningAssignmentIds?: string[];
    mockIds?: string[];
  };
  flags: string[];
  status: string;
  completedAt: string | null;
  notes: string;
}

export interface RoadmapDay {
  dayNumber: number;
  date: string;
  weekday: string;
  weekdayVi: string;
  phase: number;
  title: string;
  headerLine: number;
  objectives: string[];
  notes: string[];
  noteLines: number[];
  structure: 'five_session' | 'mock_exam_day' | 'final_day';
  estimatedStudyTime: {
    minutes: number;
    rangeMinutes: [number, number] | null;
    basis: string;
    note: string;
  };
  taskIds: string[];
  tasks: RoadmapTask[];
}

export interface RoadmapPhase {
  phase: number;
  titleVi: string;
  startDate: string;
  endDate: string;
  startDay: number;
  endDay: number;
  objective: string;
  headerLine: number;
  objectiveLine: number;
}

export interface TaskProgressRecord {
  taskId: string;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed' | 'skipped';
  startedAt: string | null;
  completedAt: string | null;
  skipReason: string;
  notes: string;
  checkedItems: number[];
  actualSeconds: number;
}

export interface PersonalAdjustment {
  id: string;
  createdAt: string;
  type: 'reschedule' | 'custom_task' | 'page_override' | 'catchup_plan';
  taskId?: string;
  originalDayNumber?: number;
  targetDayNumber: number;
  title: string;
  reason: string;
  skill?: SkillType;
  taskType?: TaskType;
  estimatedMinutes?: number;
  completed?: boolean;
  completedAt?: string | null;
}

export type SrsRating = 'again' | 'hard' | 'good' | 'easy';

export interface VocabItem {
  id: string;
  word: string;
  reading: string | null;
  meaningVi: string | null;
  partOfSpeech: string | null;
  category: string | null;
  unit: number;
  unitName: string;
  dayNumber: number;
  assignedItemRange: string;
  itemNumber: number | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  relatedExpressions: string[];
  audio: string | null;
  source: string;
  textbookId: string;
  taskId: string;
  sourceLine?: number;
  rawText?: string;
  flags: string[];
}

export interface SrsCardState {
  itemId: string;
  itemType: 'vocabulary' | 'kanji' | 'grammar';
  stepIndex: number; // 0..4 corresponding to [10m, 1d, 3d, 7d, 14d]
  intervalMinutes: number;
  easeFactor: number;
  dueAt: string;
  lastReviewedAt: string;
  reviewCount: number;
  correctCount: number;
  lapseCount: number;
  consecutiveCorrect: number;
  redMarked: boolean;
  status: 'new' | 'learning' | 'review' | 'mastered' | 'forgotten';
}

export type GrammarMasteryLevel =
  | 'not_learned'
  | 'learning'
  | 'understood'
  | 'needs_review'
  | 'mastered';

export interface GrammarPattern {
  id: string;
  structure: string;
  meaningVi: string;
  examples: string[];
  exampleTranslations: string[];
  formation: string | null;
  usage: string | null;
  similarPatterns: string[];
  commonMistakes: string[];
  jlptRelevance: string | null;
  unit: number;
  group: string | null;
  dayNumber: number;
  orderInSession: number;
  patternNumber: number | null;
  assignedPatternRange: string;
  unitPart: string;
  taskId: string;
  source: string;
  textbookId: string;
  sourceLine?: number;
  rawText?: string;
  flags: string[];
}

export interface GrammarProgressRecord {
  patternId: string;
  level: GrammarMasteryLevel;
  attempts: number;
  correct: number;
  consecutiveCorrect: number;
  lastPracticedAt: string | null;
  redMarked: boolean;
  notes: string;
}

export interface KanjiWordItem {
  id: string;
  word: string;
  reading: string | null;
  meaningVi: string | null;
  week: number;
  lessons: number[];
  lessonGlobal: number[];
  lessonTopic: string;
  pageRange: string;
  dayNumber: number;
  taskId: string;
  sourceLine?: number;
  textbookId: string;
  contrastGroup: string | null;
  source: string;
  rawText?: string;
  flags: string[];
}

export interface KanjiCharItem {
  id: string;
  kanji: string;
  week: number;
  lesson: number;
  meaningVi: string;
  onyomi: string | null;
  kunyomi: string | null;
  jukugo: string[];
  jukugoMeaningsVi: string[];
  similarKanji: string[];
  confusingReadings: string[];
  exampleUsage: string | null;
  source: string;
}

export interface KanjiProgressRecord {
  id: string; // wordId or charId
  targetType: 'word' | 'character';
  recognitionAttempts: number;
  recognitionCorrect: number;
  readingAttempts: number;
  readingCorrect: number;
  mastered: boolean;
  redMarked: boolean;
  lastPracticedAt: string | null;
}

export interface ReadingQuestionItem {
  id: string;
  question: string;
  choices: [string, string, string, string];
  answerIndex: number;
  explanation: string;
  questionType: 'main_idea' | 'detail' | 'reason' | 'underline' | 'demonstrative' | 'info_retrieval';
}

export interface ReadingPassageExercise {
  id: string;
  source: string;
  textbookId: string;
  assignmentId: string | null;
  exerciseRef: string;
  passageType: 'warmup' | 'short' | 'medium' | 'long' | 'info_retrieval' | 'mock';
  title: string;
  passage: string;
  footnotes: string | null;
  timeLimitMinutes: number;
  keyVocabulary: { word: string; reading: string; meaningVi: string }[];
  sentenceAnalysis: { sentence: string; hiddenSubject?: string; mainVerb?: string; translation: string }[];
  questions: ReadingQuestionItem[];
}

export interface ReadingAttemptRecord {
  id: string;
  exerciseId: string;
  assignmentId: string | null;
  mode: 'study' | 'exam';
  createdAt: string;
  durationSeconds: number;
  totalQuestions: number;
  correctAnswers: number;
  answers: Record<string, number>;
  errorClassifications: ('difficult_vocab' | 'difficult_grammar' | 'incorrect_inference' | 'time_management')[];
  notes: string;
}

export interface ListeningExerciseItem {
  id: string;
  source: string;
  textbookId: string;
  assignmentId: string | null;
  mondai: 1 | 2 | 3 | 4 | 5;
  title: string;
  audioDataUrl: string | null;
  audioFileName: string | null;
  transcript: string;
  speakersSituation: string | null;
  topic: string | null;
  question: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
  keyExpressions: string[];
  focusCategory:
    | 'immediate_response'
    | 'requests_permissions'
    | 'honorifics'
    | 'giving_receiving'
    | 'speaker_intention'
    | 'decision_changes'
    | 'reasons_actions'
    | 'exceptions_conditions'
    | 'general';
}

export interface ListeningAttemptRecord {
  id: string;
  exerciseId: string;
  assignmentId: string | null;
  createdAt: string;
  playbackSpeed: 1.0 | 1.1 | 1.25;
  replayCount: number;
  usedTranscriptBeforeAnswer: boolean;
  selectedIndex: number;
  correct: boolean;
  shadowingCompleted: boolean;
  workflowStepsCompleted: number[];
  notes: string;
}

export type MistakeErrorCategory =
  // Vocabulary
  | 'vocab_unknown_word'
  | 'vocab_incorrect_reading'
  | 'vocab_confused_synonym'
  | 'vocab_incorrect_contextual_meaning'
  // Grammar
  | 'grammar_incorrect_formation'
  | 'grammar_confused_pattern'
  | 'grammar_incorrect_particle'
  | 'grammar_incorrect_sentence_structure'
  // Kanji
  | 'kanji_similar_characters'
  | 'kanji_incorrect_reading'
  | 'kanji_homophone_confusion'
  // Reading
  | 'reading_missed_keyword'
  | 'reading_incorrect_inference'
  | 'reading_misunderstood_connector'
  | 'reading_misidentified_subject'
  | 'reading_distractor_selection'
  // Listening
  | 'listening_missed_keyword'
  | 'listening_unknown_expression'
  | 'listening_incorrect_interpretation'
  | 'listening_missed_speaker_intention'
  | 'listening_conversation_tracking';

export interface MistakeRecord {
  id: string;
  skill: 'vocabulary' | 'grammar' | 'kanji' | 'reading' | 'listening';
  question: string;
  options?: string[];
  incorrectAnswer: string;
  correctAnswer: string;
  explanation: string;
  source: string;
  dayNumber: number | null;
  createdAt: string;
  lastFailedAt: string;
  errorCategory: MistakeErrorCategory;
  repeatedFailures: number;
  reviewStatus: 'unresolved' | 'reviewing' | 'resolved';
  relatedItemId?: string;
}

export interface StudySessionLog {
  id: string;
  taskId: string | null;
  dayNumber: number;
  skill: SkillType;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  plannedMinutes: number;
  interruptions: number;
  notes: string;
}

export interface MockExamAttempt {
  id: string;
  mockId: string; // mock-full-1 .. mock-full-4 or custom
  mockNumber: number;
  title: string;
  takenAt: string;
  dayNumber: number;
  // Time spent (seconds)
  vocabSeconds: number;
  grammarSeconds: number;
  readingSeconds: number;
  listeningSeconds: number;
  grammarAllocatedMinutes: number; // default 18–20
  completedInfoRetrievalFirst: boolean;
  // Raw correct / total
  vocabCorrect: number;
  vocabTotal: number;
  grammarCorrect: number;
  grammarTotal: number;
  readingCorrect: number;
  readingTotal: number;
  listeningCorrect: number;
  listeningTotal: number;
  // Estimated scaled scores (0..60) — clearly labeled as estimates
  estimatedVocabSessionScore: number; // Roadmap Day 23 target >= 38/60
  estimatedGrammarReadingSessionScore: number; // Roadmap Day 23 target >= 40/60
  estimatedLanguageKnowledgeScore: number; // Official section (Vocab + Grammar) /60, min 19
  estimatedReadingScore: number; // Official section /60, min 19
  estimatedListeningScore: number; // Official section /60, min 19 & Day 23 target >= 40/60
  estimatedTotalScore: number; // /180, pass >= 95
  weaknesses: string[];
  notes: string;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  examDate: string; // default 2026-12-05
  activeRoadmapDay: number; // user-controlled current day pointer (never auto-advances when incomplete)
  simulatedTodayDate: string | null; // optional date override for testing or real calendar
  grammarTimeAllocationMinutes: number; // default 18
  dailyPlannedMinutes: number; // default 180 (3 hours)
  showFuriganaByDefault: boolean;
}

export type NavigationTab =
  | 'dashboard'
  | 'roadmap'
  | 'vocabulary'
  | 'grammar'
  | 'kanji'
  | 'reading'
  | 'listening'
  | 'mistakes'
  | 'mock_exam'
  | 'analytics'
  | 'settings';
