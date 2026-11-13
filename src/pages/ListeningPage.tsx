import React, { useState, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import type { ListeningExerciseItem } from '../types';
import {
  Headphones,
  Play,
  Pause,
  RotateCcw,
  Upload,
  CheckCircle2,
  Eye,
  EyeOff,
  ListChecks,
  Volume2,
} from 'lucide-react';

const WORKFLOW_10_STEPS = [
  '1. Xem trước các phương án hoặc tranh minh họa (Preview choices/illustration)',
  '2. Nghe lần 1 KHÔNG nhìn script (Listen once without transcript)',
  '3. Chọn đáp án (Select an answer)',
  '4. Kiểm tra kết quả (Check result)',
  '5. Nghe lại lần 2 (Listen again)',
  '6. Đọc hiểu toàn bộ script (Read transcript)',
  '7. Đánh dấu từ khóa & từ đổi ý やっぱり/じゃなくて/ただし (Highlight key expressions)',
  '8. Đóng script, nghe lại lần 3 để bắt âm (Listen again without transcript)',
  '9. Nhại lại câu trọng tâm (Shadow key sentences)',
  '10. Lưu câu sai vào Sổ Tay Lỗi Sai (Save mistakes)',
];

export const ListeningPage: React.FC = () => {
  const {
    listeningMeta,
    listeningExercises,
    listeningAttempts,
    selectedDayNumber,
    taskProgressMap,
    updateTaskStatus,
    saveListeningExercise,
    recordListeningAttempt,
    addOrIncrementMistake,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<
    'schedule' | 'player' | 'focus_topics' | 'upload'
  >('schedule');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [listeningMode, setListeningMode] = useState<'study' | 'exam'>('exam');
  const [playbackSpeed, setPlaybackSpeed] = useState<1.0 | 1.1 | 1.25>(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replayCount, setReplayCount] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [usedTranscriptBeforeAnswer, setUsedTranscriptBeforeAnswer] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [shadowingCompleted, setShadowingCompleted] = useState(false);
  const [completedWorkflowSteps, setCompletedWorkflowSteps] = useState<number[]>([]);

  // Upload / Create Listening Exercise state
  const [newMondai, setNewMondai] = useState<1 | 2 | 3 | 4 | 5>(4);
  const [newTitle, setNewTitle] = useState('');
  const [newAudioDataUrl, setNewAudioDataUrl] = useState<string | null>(null);
  const [newAudioFileName, setNewAudioFileName] = useState<string | null>(null);
  const [newTranscript, setNewTranscript] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newChoices, setNewChoices] = useState<string[]>(['', '', '', '']);
  const [newAnswerIdx, setNewAnswerIdx] = useState(0);
  const [newExplanation, setNewExplanation] = useState('');
  const [newKeyExpressions, setNewKeyExpressions] = useState('');
  const [newFocusCat, setNewFocusCat] =
    useState<ListeningExerciseItem['focusCategory']>('immediate_response');

  const activeExercise = useMemo(() => {
    if (selectedExerciseId) {
      return (
        listeningExercises.find((e) => e.id === selectedExerciseId) ||
        listeningExercises[0] ||
        null
      );
    }
    return listeningExercises[0] || null;
  }, [listeningExercises, selectedExerciseId]);

  const handleSpeedChange = (spd: 1.0 | 1.1 | 1.25) => {
    setPlaybackSpeed(spd);
    if (audioRef.current) {
      audioRef.current.playbackRate = spd;
    }
  };

  const handleTogglePlay = () => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play();
      setIsPlaying(true);
    } else {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleReplay = () => {
    setReplayCount((c) => c + 1);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleToggleTranscript = () => {
    // Part 11.B: In exam mode, hide transcript before first attempt
    if (listeningMode === 'exam' && !submitted) {
      alert(
        'Trong chế độ Phòng thi (Exam Mode), Script bị ẩn trước khi nộp đáp án lần đầu tiên để rèn phản xạ nghe thực tế!'
      );
      return;
    }
    if (!submitted && !showTranscript) {
      setUsedTranscriptBeforeAnswer(true);
    }
    setShowTranscript((v) => !v);
  };

  const handleSubmitAnswer = async () => {
    if (!activeExercise || selectedChoice === null) return;
    setSubmitted(true);
    const isCor = selectedChoice === activeExercise.answerIndex;

    await recordListeningAttempt({
      exerciseId: activeExercise.id,
      assignmentId: activeExercise.assignmentId,
      playbackSpeed,
      replayCount,
      usedTranscriptBeforeAnswer,
      selectedIndex: selectedChoice,
      correct: isCor,
      shadowingCompleted,
      workflowStepsCompleted: completedWorkflowSteps,
      notes: '',
    });

    if (!isCor) {
      await addOrIncrementMistake({
        skill: 'listening',
        question: `[Mondai ${activeExercise.mondai}] ${activeExercise.title} — ${activeExercise.question}`,
        options: activeExercise.choices,
        incorrectAnswer: activeExercise.choices[selectedChoice] || `Phương án ${selectedChoice + 1}`,
        correctAnswer:
          activeExercise.choices[activeExercise.answerIndex] ||
          `Phương án ${activeExercise.answerIndex + 1}`,
        explanation: `${activeExercise.explanation}\nScript: ${activeExercise.transcript}`,
        source: `${activeExercise.source} (Mondai ${activeExercise.mondai})`,
        dayNumber: selectedDayNumber,
        errorCategory: 'listening_missed_keyword',
        relatedItemId: activeExercise.id,
      });
    }
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewAudioFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewAudioDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateListeningExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newQuestion.trim()) return;
    const item: ListeningExerciseItem = {
      id: `ls-user-${Date.now()}`,
      source: 'Mimi kara / Speed Master (User Uploaded)',
      textbookId: 'mimi_choukai',
      assignmentId: null,
      mondai: newMondai,
      title: newTitle.trim(),
      audioDataUrl: newAudioDataUrl,
      audioFileName: newAudioFileName,
      transcript: newTranscript.trim() || '（Chưa nhập script）',
      speakersSituation: null,
      topic: null,
      question: newQuestion.trim(),
      choices: newChoices.filter((c) => c.trim().length > 0),
      answerIndex: newAnswerIdx,
      explanation: newExplanation.trim() || 'Giải thích do người học nhập.',
      keyExpressions: newKeyExpressions
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      focusCategory: newFocusCat,
    };
    await saveListeningExercise(item);
    setSelectedExerciseId(item.id);
    setActiveSubTab('player');
  };

  return (
    <div className="space-y-6">
      {/* Header & Priority Order Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                耳から覚える N3 聴解 & Speed Master N3 聴解
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300">
                Thứ tự ưu tiên ăn điểm: Mondai 4 & 5 → Mondai 1 & 2 → Mondai 3
              </span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mt-1 flex items-center gap-2">
              <Headphones className="w-6 h-6 text-sky-600" />
              Phân hệ Nghe hiểu N3 (Listening & Shadowing)
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
              Hỗ trợ tốc độ phát <strong>1.0x • 1.1x • 1.25x</strong> (Ngày 20 luyện nghe nhanh 1.1x–1.25x), đếm số lần nghe lại, ẩn Script trong Exam Mode và quy trình 10 bước Shadowing.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveSubTab('schedule')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'schedule'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <ListChecks className="w-4 h-4" />
              21 Bài giao Nghe hiểu
            </button>
            <button
              onClick={() => setActiveSubTab('player')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'player'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              Trình luyện nghe & 10 bước ({listeningExercises.length})
            </button>
            <button
              onClick={() => setActiveSubTab('focus_topics')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'focus_topics'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              8 Chủ điểm Nghe trọng tâm
            </button>
            <button
              onClick={() => setActiveSubTab('upload')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                activeSubTab === 'upload'
                  ? 'bg-sky-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <Upload className="w-4 h-4" />
              + Tải lên Audio MP3/WAV & Script
            </button>
          </div>
        </div>

        {/* 5 Mondai Catalog */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          {[4, 5, 1, 2, 3].map((mNum, orderIdx) => {
            const info = listeningMeta.mondaiCatalog.find((c) => c.mondai === mNum);
            return (
              <div
                key={mNum}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700"
              >
                <div className="flex items-center justify-between text-[11px] text-sky-600 dark:text-sky-400 font-bold">
                  <span>Ưu tiên #{orderIdx < 2 ? 1 : orderIdx < 4 ? 2 : 3}</span>
                  <span>Mondai {mNum}</span>
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                  {info?.nameVi}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* TAB 1: SCHEDULED ASSIGNMENTS */}
      {activeSubTab === 'schedule' && (
        <div className="space-y-3">
          {listeningMeta.assignments.map((asgn) => {
            const tp = taskProgressMap[asgn.taskId];
            const isCompleted = tp?.status === 'completed';
            return (
              <div
                key={asgn.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      Ngày {asgn.dayNumber}
                    </span>
                    {asgn.mondai.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300"
                      >
                        Mondai {m}
                      </span>
                    ))}
                    {asgn.target && (
                      <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        Chỉ tiêu: {asgn.target}
                      </span>
                    )}
                    {asgn.playbackSpeeds.length > 0 && (
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                        Tốc độ: {asgn.playbackSpeeds.join(' / ')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {asgn.title}
                  </h3>
                  <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-400 space-y-1">
                    {asgn.instructions.map((inst, i) => (
                      <li key={i} className="japanese-text">
                        {inst}
                      </li>
                    ))}
                  </ul>
                  {asgn.focusExpressions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {asgn.focusExpressions.map((exp, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 japanese-text"
                        >
                          {exp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() =>
                      updateTaskStatus(
                        asgn.taskId,
                        isCompleted ? 'not_started' : 'completed'
                      )
                    }
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-sky-600 text-white hover:bg-sky-700'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    {isCompleted ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: AUDIO PLAYER & 10-STEP WORKFLOW */}
      {activeSubTab === 'player' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <select
                  value={activeExercise?.id || ''}
                  onChange={(e) => {
                    setSelectedExerciseId(e.target.value);
                    setSubmitted(false);
                    setSelectedChoice(null);
                    setReplayCount(0);
                    setShowTranscript(false);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
                >
                  {listeningExercises.length === 0 && (
                    <option value="">-- Chưa có bài nghe tải lên (Bấm "+ Tải lên Audio") --</option>
                  )}
                  {listeningExercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      [Mondai {ex.mondai}] {ex.title}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-2">
                  <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                    <button
                      onClick={() => setListeningMode('exam')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        listeningMode === 'exam'
                          ? 'bg-white dark:bg-slate-900 text-rose-600 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Exam Mode (Ẩn Script trước khi nộp)
                    </button>
                    <button
                      onClick={() => setListeningMode('study')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                        listeningMode === 'study'
                          ? 'bg-white dark:bg-slate-900 text-sky-600 shadow-sm'
                          : 'text-slate-500'
                      }`}
                    >
                      Study Mode
                    </button>
                  </div>
                </div>
              </div>

              {/* Audio Player Controls (Always functional even before uploading custom audio) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTogglePlay}
                      disabled={!activeExercise?.audioDataUrl}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {isPlaying ? 'Tạm dừng' : 'Phát Audio'}
                    </button>
                    <button
                      onClick={handleReplay}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Nghe lại ({replayCount} lần)
                    </button>
                  </div>

                  {/* Playback Speed Selector: 1.0x, 1.1x, 1.25x */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500">Tốc độ phát:</span>
                    {([1.0, 1.1, 1.25] as const).map((spd) => (
                      <button
                        key={spd}
                        onClick={() => handleSpeedChange(spd)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                          playbackSpeed === spd
                            ? 'bg-sky-600 text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {activeExercise?.audioDataUrl && (
                  <audio
                    ref={audioRef}
                    src={activeExercise.audioDataUrl}
                    onEnded={() => setIsPlaying(false)}
                    controls
                    className="w-full h-9"
                  />
                )}
              </div>

              {activeExercise ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white japanese-text">
                      [Mondai {activeExercise.mondai}] {activeExercise.question}
                    </h3>
                    <button
                      onClick={handleToggleTranscript}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold flex items-center gap-1.5"
                    >
                      {showTranscript ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      {showTranscript ? 'Ẩn Script' : 'Mở Script'}
                    </button>
                  </div>

                  {showTranscript && (
                    <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs space-y-2">
                      <div className="font-bold text-amber-900 dark:text-amber-300">
                        Transcript (Script bài nghe):
                      </div>
                      <p className="whitespace-pre-line leading-relaxed japanese-text text-slate-800 dark:text-slate-200">
                        {activeExercise.transcript}
                      </p>
                      {activeExercise.keyExpressions.length > 0 && (
                        <div className="pt-2 border-t border-amber-200/60 flex flex-wrap gap-1.5">
                          <span className="font-semibold">Từ khóa/Biểu hiện:</span>
                          {activeExercise.keyExpressions.map((ke, i) => (
                            <span
                              key={i}
                              className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 font-mono japanese-text"
                            >
                              {ke}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    {activeExercise.choices.map((ch, idx) => (
                      <button
                        key={idx}
                        disabled={submitted}
                        onClick={() => setSelectedChoice(idx)}
                        className={`w-full p-3.5 rounded-xl border text-left text-sm font-medium japanese-text ${
                          submitted
                            ? idx === activeExercise.answerIndex
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
                              : selectedChoice === idx
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200'
                              : 'border-slate-200 dark:border-slate-800 opacity-60'
                            : selectedChoice === idx
                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200'
                            : 'border-slate-200 dark:border-slate-700 hover:border-sky-300'
                        }`}
                      >
                        {idx + 1}. {ch}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shadowingCompleted}
                      onChange={(e) => setShadowingCompleted(e.target.checked)}
                      className="rounded border-slate-300 text-sky-600"
                    />
                    Đã hoàn thành nhại lại (Shadowing) câu trọng tâm của bài nghe này
                  </label>

                  {!submitted ? (
                    <button
                      onClick={handleSubmitAnswer}
                      disabled={selectedChoice === null}
                      className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-sm font-semibold"
                    >
                      Chốt đáp án
                    </button>
                  ) : (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white">Giải thích:</div>
                      <div className="japanese-text text-slate-600 dark:text-slate-300">
                        {activeExercise.explanation}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-6 text-center text-xs text-slate-500">
                  Ứng dụng không tạo file audio giả. Hãy bấm tab <strong>"+ Tải lên Audio MP3/WAV & Script"</strong> để thêm bài nghe từ giáo trình của bạn.
                </div>
              )}
            </div>
          </div>

          {/* Right: 10-Step Listening Workflow Checklist (Part 11.C) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Quy trình 10 bước Luyện nghe & Shadowing (Part 11.C)
            </h3>
            <div className="space-y-1.5">
              {WORKFLOW_10_STEPS.map((label, idx) => {
                const checked = completedWorkflowSteps.includes(idx);
                return (
                  <label
                    key={idx}
                    className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer p-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setCompletedWorkflowSteps((prev) =>
                          prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                        )
                      }
                      className="mt-0.5 rounded border-slate-300 text-sky-600"
                    />
                    <span className={checked ? 'line-through text-slate-400' : ''}>{label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: 8 TARGETED LISTENING FOCUS TOPICS (PART 11.D) */}
      {activeSubTab === 'focus_topics' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            8 Chủ điểm Nghe hiểu Trọng tâm trích xuất từ Lộ trình (Part 11.D)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listeningMeta.focusTopics.map((ft) => (
              <div
                key={ft.key}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5"
              >
                <div className="text-sm font-bold text-slate-900 dark:text-white japanese-text">
                  {ft.labelVi}
                </div>
                <div className="text-xs text-slate-500">
                  Ngày học: Ngày {ft.dayNumbers.join(', ')} • Mã bài: {ft.assignmentIds.join(', ')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: UPLOAD AUDIO & SCRIPT */}
      {activeSubTab === 'upload' && (
        <form
          onSubmit={handleCreateListeningExercise}
          className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 max-w-2xl space-y-4"
        >
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Tải lên file Audio (MP3/WAV) & Tạo bài luyện nghe
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mondai</label>
              <select
                value={newMondai}
                onChange={(e) => setNewMondai(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value={4}>Mondai 4 — Phát ngôn theo tranh (Ưu tiên 1)</option>
                <option value={5}>Mondai 5 — Phản xạ nhanh (Ưu tiên 1)</option>
                <option value={1}>Mondai 1 — Nghe hiểu tác vụ (Ưu tiên 2)</option>
                <option value={2}>Mondai 2 — Nghe hiểu điểm chính (Ưu tiên 2)</option>
                <option value={3}>Mondai 3 — Nghe ý chính (Ưu tiên 3)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Chủ điểm trọng tâm
              </label>
              <select
                value={newFocusCat}
                onChange={(e) =>
                  setNewFocusCat(e.target.value as ListeningExerciseItem['focusCategory'])
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
              >
                <option value="immediate_response">Phản xạ tức thì (Mondai 5)</option>
                <option value="requests_permissions">Xin phép / Nhờ vả / Đề nghị</option>
                <option value="honorifics">Kính ngữ & Khiêm nhường ngữ</option>
                <option value="giving_receiving">Cho nhận (ていただく・てもらう)</option>
                <option value="speaker_intention">Ý chính / Ý kiến người nói</option>
                <option value="decision_changes">Từ đổi ý (やっぱり・じゃなくて)</option>
                <option value="reasons_actions">Nghe bắt hành động & lý do</option>
                <option value="exceptions_conditions">Điều kiện ngoại lệ (ただし・～に限る)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tiêu đề bài nghe
            </label>
            <input
              type="text"
              placeholder="VD: Mimi kara Choukai Mondai 4 - Bài luyện 1 Câu 1"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Tệp âm thanh (MP3 / WAV — lưu cục bộ trong IndexedDB)
            </label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioFileUpload}
              className="w-full text-xs text-slate-600"
            />
            {newAudioFileName && (
              <div className="text-xs text-emerald-600 mt-1">Đã nạp: {newAudioFileName}</div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Script / Transcript tiếng Nhật
            </label>
            <textarea
              rows={3}
              value={newTranscript}
              onChange={(e) => setNewTranscript(e.target.value)}
              placeholder="Nhập hội thoại script..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Câu hỏi</label>
            <input
              type="text"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              required
              placeholder="VD: 男の人はこのあとまず何をしますか。"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <input
                key={i}
                type="text"
                placeholder={`Phương án ${i + 1}`}
                value={newChoices[i]}
                onChange={(e) => {
                  const next = [...newChoices];
                  next[i] = e.target.value;
                  setNewChoices(next);
                }}
                required={i < 3}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={newAnswerIdx}
              onChange={(e) => setNewAnswerIdx(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
            >
              <option value={0}>Đáp án đúng: 1</option>
              <option value={1}>Đáp án đúng: 2</option>
              <option value={2}>Đáp án đúng: 3</option>
              <option value={3}>Đáp án đúng: 4</option>
            </select>
            <input
              type="text"
              placeholder="Từ khóa (phân cách bằng dấu phẩy)"
              value={newKeyExpressions}
              onChange={(e) => setNewKeyExpressions(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs japanese-text"
            />
          </div>

          <input
            type="text"
            placeholder="Giải thích đáp án..."
            value={newExplanation}
            onChange={(e) => setNewExplanation(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
          />

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold"
          >
            Lưu bài nghe vào hệ thống
          </button>
        </form>
      )}
    </div>
  );
};
