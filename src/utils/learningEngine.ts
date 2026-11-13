import type {
  SrsCardState,
  SrsRating,
  GrammarMasteryLevel,
  GrammarProgressRecord,
  TaskProgressRecord,
  MistakeRecord,
  MockExamAttempt,
  KanjiProgressRecord,
  RoadmapDay,
} from '../types';

// Initial review schedule from Part 7C:
// 10 minutes, 1 day, 3 days, 7 days, 14 days
export const SRS_STEPS_MINUTES = [10, 1440, 4320, 10080, 20160] as const;

export const SRS_STEP_LABELS = [
  '10 phút',
  '1 ngày',
  '3 ngày',
  '7 ngày',
  '14 ngày',
] as const;

export function createInitialSrsCard(
  itemId: string,
  itemType: 'vocabulary' | 'kanji' | 'grammar'
): SrsCardState {
  const now = new Date().toISOString();
  return {
    itemId,
    itemType,
    stepIndex: 0,
    intervalMinutes: 0,
    easeFactor: 2.5,
    dueAt: now,
    lastReviewedAt: now,
    reviewCount: 0,
    correctCount: 0,
    lapseCount: 0,
    consecutiveCorrect: 0,
    redMarked: false,
    status: 'new',
  };
}

export function scheduleNextSrsReview(
  existing: SrsCardState | undefined,
  itemId: string,
  itemType: 'vocabulary' | 'kanji' | 'grammar',
  rating: SrsRating,
  nowDate: Date = new Date()
): SrsCardState {
  const base = existing ? { ...existing } : createInitialSrsCard(itemId, itemType);
  base.reviewCount += 1;
  base.lastReviewedAt = nowDate.toISOString();

  if (rating === 'again') {
    base.stepIndex = 0;
    base.intervalMinutes = SRS_STEPS_MINUTES[0]; // 10 minutes
    base.easeFactor = Math.max(1.3, base.easeFactor - 0.2);
    base.lapseCount += 1;
    base.consecutiveCorrect = 0;
    base.status = base.reviewCount > 1 ? 'forgotten' : 'learning';
  } else if (rating === 'hard') {
    base.correctCount += 1;
    base.consecutiveCorrect += 1;
    // Stay at current step or move to at least step 0 (10m) / 1 (1d)
    const nextIdx = Math.max(0, base.stepIndex);
    base.stepIndex = nextIdx;
    base.intervalMinutes = Math.round(SRS_STEPS_MINUTES[nextIdx] * 0.8);
    base.easeFactor = Math.max(1.3, base.easeFactor - 0.1);
    base.status = nextIdx >= 3 && base.consecutiveCorrect >= 3 ? 'mastered' : 'review';
  } else if (rating === 'good') {
    base.correctCount += 1;
    base.consecutiveCorrect += 1;
    const nextIdx =
      base.reviewCount === 1
        ? 1 // First successful recall -> 1 day (after initial 10m step)
        : Math.min(SRS_STEPS_MINUTES.length - 1, base.stepIndex + 1);
    base.stepIndex = nextIdx;
    base.intervalMinutes = SRS_STEPS_MINUTES[nextIdx];
    // Mastered requires repeated successful recall (at least step >= 3 [7d+] and >= 3 consecutive correct recalls)
    base.status = nextIdx >= 3 && base.consecutiveCorrect >= 3 ? 'mastered' : 'review';
  } else {
    // easy
    base.correctCount += 1;
    base.consecutiveCorrect += 1;
    const nextIdx = Math.min(SRS_STEPS_MINUTES.length - 1, base.stepIndex + 2);
    base.stepIndex = nextIdx;
    base.easeFactor = Math.min(3.0, base.easeFactor + 0.15);
    base.intervalMinutes = Math.round(SRS_STEPS_MINUTES[nextIdx] * (base.easeFactor / 2.5));
    base.status = nextIdx >= 3 && base.consecutiveCorrect >= 2 ? 'mastered' : 'review';
  }

  const dueTime = new Date(nowDate.getTime() + base.intervalMinutes * 60 * 1000);
  base.dueAt = dueTime.toISOString();
  return base;
}

export function isCardDue(card: SrsCardState, nowDate: Date = new Date()): boolean {
  return new Date(card.dueAt).getTime() <= nowDate.getTime();
}

/**
 * Grammar mastery rules (Part 8):
 * "Mastery must depend on repeated successful recall, not merely clicking a completion button."
 * A grammar pattern can only reach 'mastered' if consecutiveCorrect >= 3 and accuracy >= 80%,
 * or if the learner explicitly sets a lower state. If the learner tries to set 'mastered' without
 * >= 2 successful recalls in practice, we set it to 'understood' and explain why.
 */
export function computeGrammarLevelAfterPractice(
  existing: GrammarProgressRecord | undefined,
  patternId: string,
  isCorrect: boolean
): GrammarProgressRecord {
  const rec: GrammarProgressRecord = existing
    ? { ...existing }
    : {
        patternId,
        level: 'not_learned',
        attempts: 0,
        correct: 0,
        consecutiveCorrect: 0,
        lastPracticedAt: null,
        redMarked: false,
        notes: '',
      };

  rec.attempts += 1;
  rec.lastPracticedAt = new Date().toISOString();
  if (isCorrect) {
    rec.correct += 1;
    rec.consecutiveCorrect += 1;
    const acc = rec.correct / rec.attempts;
    if (rec.consecutiveCorrect >= 3 && acc >= 0.8) {
      rec.level = 'mastered';
    } else if (rec.consecutiveCorrect >= 2) {
      rec.level = 'understood';
    } else {
      rec.level = 'learning';
    }
  } else {
    rec.consecutiveCorrect = 0;
    rec.level = 'needs_review';
  }
  return rec;
}

export interface AdaptiveRecommendation {
  id: string;
  priority: 'critical' | 'high' | 'medium';
  category: 'vocabulary' | 'grammar' | 'kanji' | 'reading' | 'listening' | 'mock_exam' | 'schedule';
  title: string;
  reason: string;
  actionLabel: string;
  targetTab:
    | 'roadmap'
    | 'vocabulary'
    | 'grammar'
    | 'kanji'
    | 'reading'
    | 'listening'
    | 'mistakes'
    | 'mock_exam';
}

export function generateAdaptiveRecommendations(params: {
  days: RoadmapDay[];
  calendarDayNumber: number | null;
  activeRoadmapDay: number;
  taskProgressMap: Record<string, TaskProgressRecord>;
  srsCards: SrsCardState[];
  grammarProgress: GrammarProgressRecord[];
  kanjiProgress: KanjiProgressRecord[];
  mistakes: MistakeRecord[];
  mockAttempts: MockExamAttempt[];
}): AdaptiveRecommendation[] {
  const {
    days,
    calendarDayNumber,
    activeRoadmapDay,
    taskProgressMap,
    srsCards,
    grammarProgress,
    kanjiProgress,
    mistakes,
    mockAttempts,
  } = params;

  const recs: AdaptiveRecommendation[] = [];

  // 1. Check overdue tasks vs current calendar day (Recovery Mode trigger)
  const checkUpToDay = calendarDayNumber
    ? Math.max(calendarDayNumber - 1, activeRoadmapDay - 1)
    : activeRoadmapDay - 1;

  if (checkUpToDay >= 1) {
    let overdueCount = 0;
    days
      .filter((d) => d.dayNumber <= checkUpToDay)
      .forEach((d) => {
        d.tasks.forEach((t) => {
          const st = taskProgressMap[t.id]?.status || 'not_started';
          if (st !== 'completed' && st !== 'skipped') {
            overdueCount += 1;
          }
        });
      });

    if (overdueCount > 0) {
      recs.push({
        id: 'rec-overdue-recovery',
        priority: 'critical',
        category: 'schedule',
        title: `Có ${overdueCount} nhiệm vụ tồn đọng từ các ngày trước`,
        reason:
          'Lộ trình gốc không tự động xóa hay dời ngày khi bạn bỏ lỡ. Hãy mở Chế độ Phục hồi (Recovery Mode) để xem gợi ý ghép bù mà không phá vỡ lịch gốc.',
        actionLabel: 'Mở Recovery Mode',
        targetTab: 'roadmap',
      });
    }
  }

  // 2. Overdue / forgotten SRS flashcards
  const now = new Date();
  const dueVocab = srsCards.filter(
    (c) => c.itemType === 'vocabulary' && (c.status === 'forgotten' || isCardDue(c, now))
  );
  if (dueVocab.length > 0) {
    recs.push({
      id: 'rec-srs-due',
      priority: dueVocab.some((c) => c.status === 'forgotten') ? 'high' : 'medium',
      category: 'vocabulary',
      title: `${dueVocab.length} thẻ Từ vựng đến hạn ôn SRS (ưu tiên từ quên/đánh dấu đỏ)`,
      reason: `Có ${dueVocab.filter((c) => c.status === 'forgotten').length} từ vừa trả lời sai (Again) và ${dueVocab.length} từ đã đến chu kỳ lặp lại ngắt quãng.`,
      actionLabel: 'Ôn SRS ngay',
      targetTab: 'vocabulary',
    });
  }

  // 3. Low vocabulary accuracy
  const reviewedVocab = srsCards.filter((c) => c.itemType === 'vocabulary' && c.reviewCount > 0);
  if (reviewedVocab.length >= 5) {
    const totalRev = reviewedVocab.reduce((s, c) => s + c.reviewCount, 0);
    const totalCor = reviewedVocab.reduce((s, c) => s + c.correctCount, 0);
    const acc = totalRev > 0 ? Math.round((totalCor / totalRev) * 100) : 100;
    if (acc < 75) {
      recs.push({
        id: 'rec-vocab-low-acc',
        priority: 'high',
        category: 'vocabulary',
        title: `Độ chính xác Từ vựng đang thấp (${acc}%)`,
        reason:
          'Tỷ lệ nhớ chủ động dưới 75%. Hệ thống khuyến nghị luyện thêm chế độ Nhớ chủ động (Việt → Nhật / Điền từ / Đồng nghĩa).',
        actionLabel: 'Luyện Active Recall Từ vựng',
        targetTab: 'vocabulary',
      });
    }
  }

  // 4. Grammar accuracy low -> recommend comparison exercises
  const practicedGrammar = grammarProgress.filter((g) => g.attempts > 0);
  if (practicedGrammar.length >= 3) {
    const totalAtt = practicedGrammar.reduce((s, g) => s + g.attempts, 0);
    const totalCor = practicedGrammar.reduce((s, g) => s + g.correct, 0);
    const acc = totalAtt > 0 ? Math.round((totalCor / totalAtt) * 100) : 100;
    if (acc < 75 || practicedGrammar.some((g) => g.level === 'needs_review')) {
      recs.push({
        id: 'rec-grammar-comparison',
        priority: 'high',
        category: 'grammar',
        title: 'Cần củng cố phân biệt các cặp Ngữ pháp dễ nhầm',
        reason: `Độ chính xác Ngữ pháp đạt ${acc}% (${practicedGrammar.filter((g) => g.level === 'needs_review').length} mẫu đang ở mức Cần ôn lại). Hãy luyện chuyên đề phân biệt cặp mẫu và bài dấu sao ★.`,
        actionLabel: 'Luyện phân biệt Ngữ pháp',
        targetTab: 'grammar',
      });
    }
  }

  // 5. Kanji recognition high but reading accuracy low -> Jukugo reading exercises
  if (kanjiProgress.length >= 3) {
    const recAtt = kanjiProgress.reduce((s, k) => s + k.recognitionAttempts, 0);
    const recCor = kanjiProgress.reduce((s, k) => s + k.recognitionCorrect, 0);
    const readAtt = kanjiProgress.reduce((s, k) => s + k.readingAttempts, 0);
    const readCor = kanjiProgress.reduce((s, k) => s + k.readingCorrect, 0);
    const recAcc = recAtt > 0 ? (recCor / recAtt) * 100 : 100;
    const readAcc = readAtt > 0 ? (readCor / readAtt) * 100 : 100;
    if (readAtt >= 3 && readAcc < 75 && recAcc >= readAcc) {
      recs.push({
        id: 'rec-kanji-jukugo-reading',
        priority: 'high',
        category: 'kanji',
        title: `Độ chính xác đọc âm ghép Jukugo (${Math.round(readAcc)}%) thấp hơn nhận diện nghĩa (${Math.round(recAcc)}%)`,
        reason:
          'Bạn nhớ nghĩa mặt chữ nhưng hay nhầm trường âm, âm ngắt (っ) hoặc biến âm khi đọc từ ghép. Hãy luyện bài đọc Jukugo & Đồng âm.',
        actionLabel: 'Luyện đọc Jukugo',
        targetTab: 'kanji',
      });
    }
  }

  // 6. Reading errors from vocabulary or inference
  const unresolvedMistakes = mistakes.filter((m) => m.reviewStatus !== 'resolved');
  const readingMistakes = unresolvedMistakes.filter((m) => m.skill === 'reading');
  if (readingMistakes.length > 0) {
    recs.push({
      id: 'rec-reading-mistakes',
      priority: 'medium',
      category: 'reading',
      title: `${readingMistakes.length} lỗi Đọc hiểu chưa xử lý trong Sổ tay Lỗi sai`,
      reason:
        'Ôn lại các từ khóa, mệnh đề bổ nghĩa và các bẫy mở rộng phạm vi (すべて/全員/いつも) từ những câu đọc hiểu đã chọn sai.',
      actionLabel: 'Xem lỗi Đọc hiểu',
      targetTab: 'mistakes',
    });
  }

  // 7. Listening errors from unknown expressions
  const listeningExprMistakes = unresolvedMistakes.filter(
    (m) => m.skill === 'listening' && m.errorCategory === 'listening_unknown_expression'
  );
  if (listeningExprMistakes.length > 0) {
    recs.push({
      id: 'rec-listening-expressions',
      priority: 'high',
      category: 'listening',
      title: `Hàng đợi ${listeningExprMistakes.length} biểu hiện Nghe hiểu chưa thuộc`,
      reason:
        'Các câu nghe sai do không nhận ra cụm cố định / kính ngữ / từ đổi ý (やっぱり, じゃなくて). Cần nghe lại kèm Script và Shadowing.',
      actionLabel: 'Ôn biểu hiện Nghe hiểu',
      targetTab: 'listening',
    });
  }

  // 8. Mock test section approaching minimum threshold (19/60) or below Day 23 targets
  if (mockAttempts.length > 0) {
    const latest = [...mockAttempts].sort(
      (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime()
    )[0];

    const nearFloorSections: string[] = [];
    if (latest.estimatedLanguageKnowledgeScore < 25) {
      nearFloorSections.push(`Kiến thức ngôn ngữ (${latest.estimatedLanguageKnowledgeScore}/60)`);
    }
    if (latest.estimatedReadingScore < 25) {
      nearFloorSections.push(`Đọc hiểu (${latest.estimatedReadingScore}/60)`);
    }
    if (latest.estimatedListeningScore < 25) {
      nearFloorSections.push(`Nghe hiểu (${latest.estimatedListeningScore}/60)`);
    }

    if (nearFloorSections.length > 0) {
      recs.push({
        id: 'rec-mock-section-danger',
        priority: 'critical',
        category: 'mock_exam',
        title: `CẢNH BÁO ĐIỂM LIỆT: ${nearFloorSections.join(', ')} tiệm cận ngưỡng 19/60`,
        reason:
          'Điểm chuẩn đỗ JLPT N3 yêu cầu tổng ≥ 95/180 VÀ không có phần nào dưới 19/60. Cần tập trung cứu ngay phần điểm thấp nhất này.',
        actionLabel: 'Phân tích Đề thi thử',
        targetTab: 'mock_exam',
      });
    } else if (
      latest.estimatedVocabSessionScore < 38 ||
      latest.estimatedGrammarReadingSessionScore < 40 ||
      latest.estimatedListeningScore < 40
    ) {
      recs.push({
        id: 'rec-mock-day23-target',
        priority: 'high',
        category: 'mock_exam',
        title: 'Điểm thi thử chưa đạt trọn mục tiêu Ngày 23 (38 / 40 / 40)',
        reason: `Đề gần nhất: Từ vựng ${latest.estimatedVocabSessionScore}/60 (mục tiêu ≥38), NP&ĐH ${latest.estimatedGrammarReadingSessionScore}/60 (mục tiêu ≥40), Nghe ${latest.estimatedListeningScore}/60 (mục tiêu ≥40).`,
        actionLabel: 'Xem chi tiết điểm yếu',
        targetTab: 'mock_exam',
      });
    }
  }

  return recs;
}
