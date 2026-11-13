import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Award,
  Clock,
  Play,
  Pause,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Trash2,
  TrendingUp,
} from 'lucide-react';

export const MockExamPage: React.FC = () => {
  const {
    mockMeta,
    mockAttempts,
    settings,
    updateSettings,
    saveMockExamAttempt,
    deleteMockExamAttempt,
    updateTaskStatus,
    taskProgressMap,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'schedule' | 'simulator' | 'logger_analysis'>(
    'schedule'
  );

  // Live 140-minute Exam Simulator state
  const [simSection, setSimSection] = useState<'vocab' | 'grammar_reading' | 'listening'>('vocab');
  const [simRunning, setSimRunning] = useState(false);
  const [simElapsedSec, setSimElapsedSec] = useState(0);
  const [completedMondai7First, setCompletedMondai7First] = useState(true);

  // Score Logger Form state
  const [selectedMockId, setSelectedMockId] = useState('mock-full-1');
  const [vocabCorrect, setVocabCorrect] = useState(26);
  const [vocabTotal, setVocabTotal] = useState(35);
  const [grammarCorrect, setGrammarCorrect] = useState(16);
  const [grammarTotal, setGrammarTotal] = useState(23);
  const [readingCorrect, setReadingCorrect] = useState(12);
  const [readingTotal, setReadingTotal] = useState(16);
  const [listeningCorrect, setListeningCorrect] = useState(20);
  const [listeningTotal, setListeningTotal] = useState(28);
  const [vocabMinutes, setVocabMinutes] = useState(28);
  const [grammarMinutes, setGrammarMinutes] = useState(18);
  const [readingMinutes, setReadingMinutes] = useState(50);
  const [listeningMinutes, setListeningMinutes] = useState(40);
  const [weaknessesInput, setWeaknessesInput] = useState(
    'Mondai 3 Ngữ pháp đoạn văn, Trường văn đọc hơi chậm'
  );
  const [notesInput, setNotesInput] = useState('');

  const sectionLimitMinutes =
    simSection === 'vocab' ? 30 : simSection === 'grammar_reading' ? 70 : 40;
  const remainingSec = Math.max(0, sectionLimitMinutes * 60 - simElapsedSec);
  const grammarAlertMinutes = settings.grammarTimeAllocationMinutes || 18;

  useEffect(() => {
    if (!simRunning) return;
    const id = window.setInterval(() => {
      setSimElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [simRunning]);

  // Estimate scaled scores (clearly labeled as estimates per Part 14.C)
  const estVocabSession = Math.round((vocabCorrect / Math.max(1, vocabTotal)) * 60);
  const estGrammarReadingSession = Math.round(
    ((grammarCorrect + readingCorrect) / Math.max(1, grammarTotal + readingTotal)) * 60
  );
  const estLangKnowledge = Math.round(
    ((vocabCorrect + grammarCorrect) / Math.max(1, vocabTotal + grammarTotal)) * 60
  );
  const estReading = Math.round((readingCorrect / Math.max(1, readingTotal)) * 60);
  const estListening = Math.round((listeningCorrect / Math.max(1, listeningTotal)) * 60);
  const estTotal = estLangKnowledge + estReading + estListening;

  const handleSaveMockAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    const matchedFull = mockMeta.fullMocks.find((m) => m.id === selectedMockId);
    const mockNumber = matchedFull ? matchedFull.number : mockAttempts.length + 1;
    const dayNum = matchedFull ? matchedFull.dayNumber : 19;

    await saveMockExamAttempt({
      mockId: selectedMockId,
      mockNumber,
      title: matchedFull
        ? `Đề thi thử Full #${matchedFull.number} (${matchedFull.date} - Ngày ${matchedFull.dayNumber})`
        : `Đề thi thử tự chọn (${selectedMockId})`,
      takenAt: new Date().toISOString(),
      dayNumber: dayNum,
      vocabSeconds: vocabMinutes * 60,
      grammarSeconds: grammarMinutes * 60,
      readingSeconds: readingMinutes * 60,
      listeningSeconds: listeningMinutes * 60,
      grammarAllocatedMinutes: grammarAlertMinutes,
      completedInfoRetrievalFirst: completedMondai7First,
      vocabCorrect,
      vocabTotal,
      grammarCorrect,
      grammarTotal,
      readingCorrect,
      readingTotal,
      listeningCorrect,
      listeningTotal,
      estimatedVocabSessionScore: estVocabSession,
      estimatedGrammarReadingSessionScore: estGrammarReadingSession,
      estimatedLanguageKnowledgeScore: estLangKnowledge,
      estimatedReadingScore: estReading,
      estimatedListeningScore: estListening,
      estimatedTotalScore: estTotal,
      weaknesses: weaknessesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      notes: notesInput,
    });

    if (matchedFull) {
      await updateTaskStatus(matchedFull.taskId, 'completed');
    }
    setActiveSubTab('logger_analysis');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                Giai đoạn 3: Luyện Đề Thực Chiến & Nước Rút (28/11 – 04/12/2026)
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                4 Đề Full 140 Phút: 28/11 • 30/11 • 02/12 • 03/12
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <Award className="w-6 h-6 text-purple-600" />
              Phòng Thi Thử JLPT N3 & Phân Tích Điểm Ước Tính
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Tổng thời gian 140 phút: Tiết 1 Từ vựng (30p) • Tiết 2 Ngữ pháp & Đọc hiểu (70p: Ngữ pháp tối đa {grammarAlertMinutes}–20p → làm Mondai 7 trước) • Tiết 3 Nghe hiểu (40p).
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSubTab('schedule')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold ${
                activeSubTab === 'schedule'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              Lịch 4 Đề Full & Đề thành phần
            </button>
            <button
              onClick={() => setActiveSubTab('simulator')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'simulator'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Clock className="w-4 h-4" />
              Đồng hồ Phòng thi 140 phút
            </button>
            <button
              onClick={() => setActiveSubTab('logger_analysis')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'logger_analysis'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Chấm điểm Ước tính & So sánh ({mockAttempts.length}/4)
            </button>
          </div>
        </div>

        {/* Passing Reference vs Roadmap Targets Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="font-bold text-slate-900 dark:text-white">
              Chuẩn đỗ JLPT N3 chính thức (3 phần chấm điểm — Dòng 567):
            </div>
            <div className="text-slate-600 dark:text-slate-300 mt-1">
              • Tổng điểm: <strong>≥ 95 / 180 điểm</strong> (Điểm liệt mỗi phần: <strong>≥ 19 / 60 điểm</strong>)
              <br />• 3 phần: Kiến thức ngôn ngữ (Từ vựng + Ngữ pháp) /60 • Đọc hiểu /60 • Nghe hiểu /60
            </div>
          </div>
          <div className="p-3.5 rounded-xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60">
            <div className="font-bold text-purple-900 dark:text-purple-200">
              Mục tiêu an toàn Ngày 23 theo 3 tiết thi trong Lộ trình (Dòng 563–566):
            </div>
            <div className="text-purple-800 dark:text-purple-300 mt-1">
              • Từ vựng: <strong>≥ 38 / 60</strong> (đúng ~24–26/35 câu) • Ngữ pháp & Đọc hiểu: <strong>≥ 40 / 60</strong> • Nghe hiểu: <strong>≥ 40 / 60</strong>
              <br />• <em>Lưu ý: Điểm JLPT thực tế dùng quy đổi Scaled Score. Mọi điểm tính dưới đây đều được gắn nhãn rõ là ƯỚC TÍNH.</em>
            </div>
          </div>
        </div>
      </div>

      {/* TAB 1: SCHEDULED MOCK EXAMS */}
      {activeSubTab === 'schedule' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mockMeta.fullMocks.map((fm) => {
              const tp = taskProgressMap[fm.taskId];
              const isDone = tp?.status === 'completed';
              const loggedAttempt = mockAttempts.find((a) => a.mockId === fm.id);
              return (
                <div
                  key={fm.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                        Đề Full #{fm.number} • Ngày {fm.dayNumber} ({fm.date})
                      </span>
                      <span className="text-xs font-mono text-slate-500">
                        {fm.durationMinutes} phút
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      Đề thi thử JLPT N3 Full số {fm.number}
                    </h3>
                    <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">
                      {fm.instructions.map((inst, idx) => (
                        <li key={idx} className="japanese-text">
                          {inst}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    {loggedAttempt ? (
                      <span className="text-xs font-bold text-emerald-600">
                        Đã chấm (Ước tính: {loggedAttempt.estimatedTotalScore}/180 điểm)
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Chưa nhập kết quả chấm</span>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedMockId(fm.id);
                          setActiveSubTab('simulator');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold hover:bg-purple-50"
                      >
                        Bấm giờ làm đề
                      </button>
                      <button
                        onClick={() => {
                          setSelectedMockId(fm.id);
                          setActiveSubTab('logger_analysis');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700"
                      >
                        {isDone ? 'Cập nhật điểm' : 'Nhập điểm & Phân tích'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section Mocks */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Các đề thi thử thành phần (Speed Master Dokkai & Choukai — Ngày 18 & 20)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {mockMeta.sectionMocksAndReviews.map((sm) => (
                <div
                  key={sm.taskId}
                  className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
                >
                  <div className="font-bold text-purple-700 dark:text-purple-300">
                    Ngày {sm.dayNumber} ({sm.skill}) • {sm.timeLimitMinutes || 45} phút
                  </div>
                  <div className="font-semibold text-slate-900 dark:text-white">{sm.title}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: 140-MINUTE EXAM SIMULATOR */}
      {activeSubTab === 'simulator' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSimSection('vocab');
                  setSimRunning(false);
                  setSimElapsedSec(0);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  simSection === 'vocab'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Tiết 1: Từ vựng 文字・語彙 (30 phút)
              </button>
              <button
                onClick={() => {
                  setSimSection('grammar_reading');
                  setSimRunning(false);
                  setSimElapsedSec(0);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  simSection === 'grammar_reading'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Tiết 2: Ngữ pháp & Đọc hiểu 文法・読解 (70 phút)
              </button>
              <button
                onClick={() => {
                  setSimSection('listening');
                  setSimRunning(false);
                  setSimElapsedSec(0);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  simSection === 'listening'
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                Tiết 3: Nghe hiểu 聴解 (40 phút)
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span>Giới hạn Ngữ pháp Tiết 2 (18–20p):</span>
              <input
                type="number"
                min={15}
                max={25}
                value={grammarAlertMinutes}
                onChange={(e) =>
                  updateSettings({ grammarTimeAllocationMinutes: Number(e.target.value) })
                }
                className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-center"
              />
              <span>phút</span>
            </div>
          </div>

          <div className="p-8 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-center space-y-5">
            <div className="text-xs font-bold uppercase tracking-wider text-purple-600">
              {simSection === 'vocab'
                ? 'Tiết 1 — Từ vựng (35 câu / 30 phút)'
                : simSection === 'grammar_reading'
                ? `Tiết 2 — Ngữ pháp (${grammarAlertMinutes}p) + Đọc hiểu (${
                    70 - grammarAlertMinutes
                  }p)`
                : 'Tiết 3 — Nghe hiểu (40 phút)'}
            </div>

            <div className="text-6xl font-mono font-extrabold text-slate-900 dark:text-white">
              {String(Math.floor(remainingSec / 60)).padStart(2, '0')}:
              {String(remainingSec % 60).padStart(2, '0')}
            </div>

            {simSection === 'grammar_reading' && (
              <div
                className={`max-w-xl mx-auto p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
                  simElapsedSec >= grammarAlertMinutes * 60
                    ? 'bg-rose-100 border-rose-400 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200'
                    : 'bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                {simElapsedSec >= grammarAlertMinutes * 60 ? (
                  <span>
                    ĐÃ QUA {grammarAlertMinutes} PHÚT! Chuyển ngay sang Mondai 7 (Tìm kiếm thông tin) ở trang cuối, sau đó làm Mondai 4 → Mondai 5 → Mondai 6!
                  </span>
                ) : (
                  <span>
                    Chiến thuật Tiết 2 (Ngày 18 & 25): Làm Ngữ pháp Mondai 1–2–3 tối đa {grammarAlertMinutes} phút. Đến phút thứ {grammarAlertMinutes}, lật ngay xuống cuối đề làm Mondai 7 trước!
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setSimRunning((r) => !r)}
                className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold flex items-center gap-2"
              >
                {simRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {simRunning ? 'Tạm dừng' : 'Bắt đầu bấm giờ'}
              </button>
              <button
                onClick={() => {
                  setSimRunning(false);
                  setSimElapsedSec(0);
                }}
                className="px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Đặt lại
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SCORE LOGGER & POST-EXAM ANALYSIS */}
      {activeSubTab === 'logger_analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form
            onSubmit={handleSaveMockAttempt}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Nhập kết quả Đề thi thử & Tính điểm Ước tính (Scaled Estimate)
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Chọn đề thi</label>
              <select
                value={selectedMockId}
                onChange={(e) => setSelectedMockId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
              >
                {mockMeta.fullMocks.map((fm) => (
                  <option key={fm.id} value={fm.id}>
                    Đề Full #{fm.number} — Ngày {fm.dayNumber} ({fm.date})
                  </option>
                ))}
                <option value="custom-mock">Đề thi thử bổ sung</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <div className="font-bold">1. Từ vựng (文字・語彙)</div>
                <div className="flex items-center gap-2">
                  <span>Đúng:</span>
                  <input
                    type="number"
                    min={0}
                    max={vocabTotal}
                    value={vocabCorrect}
                    onChange={(e) => setVocabCorrect(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min={1}
                    value={vocabTotal}
                    onChange={(e) => setVocabTotal(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>Thời gian (phút):</span>
                  <input
                    type="number"
                    min={1}
                    value={vocabMinutes}
                    onChange={(e) => setVocabMinutes(Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <div className="font-bold">2a. Ngữ pháp (Mondai 1–3)</div>
                <div className="flex items-center gap-2">
                  <span>Đúng:</span>
                  <input
                    type="number"
                    min={0}
                    max={grammarTotal}
                    value={grammarCorrect}
                    onChange={(e) => setGrammarCorrect(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min={1}
                    value={grammarTotal}
                    onChange={(e) => setGrammarTotal(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>Thời gian (phút):</span>
                  <input
                    type="number"
                    min={1}
                    value={grammarMinutes}
                    onChange={(e) => setGrammarMinutes(Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <div className="font-bold">2b. Đọc hiểu (Mondai 4–7)</div>
                <div className="flex items-center gap-2">
                  <span>Đúng:</span>
                  <input
                    type="number"
                    min={0}
                    max={readingTotal}
                    value={readingCorrect}
                    onChange={(e) => setReadingCorrect(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min={1}
                    value={readingTotal}
                    onChange={(e) => setReadingTotal(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>Thời gian (phút):</span>
                  <input
                    type="number"
                    min={1}
                    value={readingMinutes}
                    onChange={(e) => setReadingMinutes(Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 space-y-2">
                <div className="font-bold">3. Nghe hiểu (聴解)</div>
                <div className="flex items-center gap-2">
                  <span>Đúng:</span>
                  <input
                    type="number"
                    min={0}
                    max={listeningTotal}
                    value={listeningCorrect}
                    onChange={(e) => setListeningCorrect(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <span>/</span>
                  <input
                    type="number"
                    min={1}
                    value={listeningTotal}
                    onChange={(e) => setListeningTotal(Number(e.target.value))}
                    className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span>Thời gian (phút):</span>
                  <input
                    type="number"
                    min={1}
                    value={listeningMinutes}
                    onChange={(e) => setListeningMinutes(Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={completedMondai7First}
                onChange={(e) => setCompletedMondai7First(e.target.checked)}
              />
              Đã thực hiện chiến thuật làm Mondai 7 (Tìm kiếm thông tin) đầu tiên khi sang phần Đọc hiểu
            </label>

            {/* Live Preview of Estimated Scores */}
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-xs space-y-1">
              <div className="font-bold text-purple-900 dark:text-purple-200">
                Điểm ƯỚC TÍNH (Estimated Score — Chỉ mang tính tham khảo):
              </div>
              <div>
                • Theo 3 phần chấm JLPT chính thức: Kiến thức ngôn ngữ{' '}
                <strong>{estLangKnowledge}/60</strong> + Đọc hiểu <strong>{estReading}/60</strong> +
                Nghe hiểu <strong>{estListening}/60</strong> ={' '}
                <strong className="text-sm">{estTotal}/180</strong> (Chuẩn đỗ: ≥ 95/180 & không phần nào &lt; 19)
              </div>
              <div>
                • Theo mục tiêu Ngày 23: Tiết Từ vựng <strong>{estVocabSession}/60</strong> (Mục tiêu ≥ 38) • Tiết Ngữ pháp+Đọc <strong>{estGrammarReadingSession}/60</strong> (Mục tiêu ≥ 40) • Tiết Nghe <strong>{estListening}/60</strong> (Mục tiêu ≥ 40)
              </div>
            </div>

            <input
              type="text"
              value={weaknessesInput}
              onChange={(e) => setWeaknessesInput(e.target.value)}
              placeholder="Điểm yếu phát hiện (phân cách bằng dấu phẩy)..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
            >
              Lưu kết quả Đề thi thử
            </button>
          </form>

          {/* Post-Exam Analysis & History Comparison */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Bảng đối chiếu & Phân tích sau thi thử ({mockAttempts.length} lần)
            </h3>

            <div className="space-y-3 max-h-[540px] overflow-y-auto">
              {mockAttempts.map((att) => {
                const passOfficial =
                  att.estimatedTotalScore >= 95 &&
                  att.estimatedLanguageKnowledgeScore >= 19 &&
                  att.estimatedReadingScore >= 19 &&
                  att.estimatedListeningScore >= 19;

                const meetDay23 =
                  att.estimatedVocabSessionScore >= 38 &&
                  att.estimatedGrammarReadingSessionScore >= 40 &&
                  att.estimatedListeningScore >= 40;

                return (
                  <div
                    key={att.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                        {att.title}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold ${
                            passOfficial
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                          }`}
                        >
                          Ước tính: {att.estimatedTotalScore}/180 ({passOfficial ? 'ĐẠT ≥95' : 'CHƯA ĐẠT'})
                        </span>
                        <button
                          onClick={() => deleteMockExamAttempt(att.id)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] text-slate-500">Từ vựng (Mục tiêu ≥38)</div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {att.estimatedVocabSessionScore}/60 ({att.vocabCorrect}/{att.vocabTotal})
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] text-slate-500">NP & Đọc (Mục tiêu ≥40)</div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {att.estimatedGrammarReadingSessionScore}/60 (NP{' '}
                          {Math.round(att.grammarSeconds / 60)}p + Đọc{' '}
                          {Math.round(att.readingSeconds / 60)}p)
                        </div>
                      </div>
                      <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                        <div className="text-[11px] text-slate-500">Nghe hiểu (Mục tiêu ≥40)</div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {att.estimatedListeningScore}/60 ({att.listeningCorrect}/
                          {att.listeningTotal})
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>
                        Chỉ tiêu Ngày 23 (38/40/40):{' '}
                        <strong className={meetDay23 ? 'text-emerald-600' : 'text-amber-600'}>
                          {meetDay23 ? 'Đạt cả 3 tiết' : 'Cần cải thiện thêm'}
                        </strong>
                      </span>
                      <span>
                        Mondai 7 làm trước:{' '}
                        {att.completedInfoRetrievalFirst ? (
                          <CheckCircle2 className="w-3.5 h-3.5 inline text-emerald-600" />
                        ) : (
                          'Chưa'
                        )}
                      </span>
                    </div>

                    {att.weaknesses.length > 0 && (
                      <div className="text-rose-600 dark:text-rose-400">
                        <strong>Điểm yếu cần vá:</strong> {att.weaknesses.join(' • ')}
                      </div>
                    )}
                  </div>
                );
              })}

              {mockAttempts.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-500">
                  Chưa có kết quả đề thi thử nào. Hãy nhập kết quả chấm ở biểu mẫu bên trái sau khi hoàn thành đề thi!
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
