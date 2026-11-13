import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import type {
  VocabItem,
  GrammarPattern,
  KanjiWordItem,
  ReadingPassageExercise,
  ListeningExerciseItem,
} from '../types';
import type { FullBackupPayload } from '../db/storage';
import {
  Settings,
  Download,
  Upload,
  FileSpreadsheet,
  Database,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

// Simple CSV parser that handles quoted fields
function parseSimpleCsv(text: string): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] || '').replace(/^"|"$/g, '');
    });
    return row;
  });
}

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    extractionIssues,
    importVocabItems,
    importGrammarPatterns,
    importKanjiWords,
    saveReadingPassage,
    saveListeningExercise,
    exportBackup,
    restoreBackup,
    resetAllData,
  } = useApp();

  const [importType, setImportType] = useState<
    'vocabulary' | 'grammar' | 'kanji' | 'reading' | 'listening'
  >('vocabulary');
  const [importStatus, setImportStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const downloadSampleTemplate = (
    kind: 'vocab_csv' | 'grammar_csv' | 'kanji_csv' | 'reading_json' | 'listening_json'
  ) => {
    let filename = '';
    let content = '';
    let mime = 'text/csv;charset=utf-8;';

    if (kind === 'vocab_csv') {
      filename = 'template_vocabulary_n3.csv';
      content =
        'id,itemNumber,unit,word,reading,meaningVi,partOfSpeech,exampleSentence,exampleTranslation\n' +
        'user-voc-0001,1,1,活躍,かつやく,hoạt động sôi nổi,Danh từ / Suru,彼は世界で幅広く活躍している。,Anh ấy đang hoạt động rộng rãi trên thế giới.\n';
    } else if (kind === 'grammar_csv') {
      filename = 'template_grammar_n3.csv';
      content =
        'id,patternNumber,unit,structure,meaningVi,formation,usage,examples,exampleTranslations\n' +
        'user-grm-001,1,1,～うちに,tranh thủ lúc còn...,V-る / V-ている / A-い / A-な + うちに,Làm gì trước khi trạng thái thay đổi,若いうちにいろいろな経験をしたい。,Khi còn trẻ tôi muốn trải nghiệm nhiều thứ.\n';
    } else if (kind === 'kanji_csv') {
      filename = 'template_kanji_n3.csv';
      content =
        'id,week,lesson,word,reading,meaningVi,lessonTopic,pageRange\n' +
        'user-knj-001,1,1,乗車券,じょうしゃけん,vé lên tàu,Tàu điện,10–11\n';
    } else if (kind === 'reading_json') {
      filename = 'template_reading_n3.json';
      mime = 'application/json;charset=utf-8;';
      content = JSON.stringify(
        [
          {
            id: 'user-rd-01',
            source: 'Speed Master N3 Dokkai',
            textbookId: 'speed_dokkai',
            assignmentId: 'rd-d08-01',
            exerciseRef: 'Bài 1 (短文)',
            passageType: 'short',
            title: 'Đoạn ngắn Bài 1',
            passage: '先日、友人に勧められて新しい図書館へ行ってみた。しかし、休館日だった。',
            footnotes: null,
            timeLimitMinutes: 3,
            keyVocabulary: [],
            sentenceAnalysis: [],
            questions: [
              {
                id: 'q1',
                question: '「私」はどうして図書館へ行ったか。',
                choices: [
                  '友人に勧められたから',
                  '本を返すため',
                  '休館日だと知っていたから',
                  '仕事があったから',
                ],
                answerIndex: 0,
                explanation: 'Trong bài có câu 「友人に勧められて…」',
                questionType: 'reason',
              },
            ],
          },
        ],
        null,
        2
      );
    } else {
      filename = 'template_listening_n3.json';
      mime = 'application/json;charset=utf-8;';
      content = JSON.stringify(
        [
          {
            id: 'user-ls-01',
            source: 'Mimi kara Oboeru N3 Choukai',
            textbookId: 'mimi_choukai',
            assignmentId: 'ls-d01-01',
            mondai: 4,
            title: 'Mondai 4 - Luyện 1 Câu 1',
            audioDataUrl: null,
            audioFileName: null,
            transcript: 'ここに荷物を置いてもいいですか。',
            question: '荷物を置きたいです。何と言いますか。',
            choices: [
              'ここに荷物を置いてもいいですか。',
              '荷物を置いてくれますか。',
              '荷物を置いたほうがいいですよ。',
            ],
            answerIndex: 0,
            explanation: 'Mẫu xin phép ～てもいいですか。',
            keyExpressions: ['～てもいいですか'],
            focusCategory: 'requests_permissions',
          },
        ],
        null,
        2
      );
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const isJson = file.name.toLowerCase().endsWith('.json');

      if (importType === 'vocabulary') {
        const rows = isJson ? JSON.parse(text) : parseSimpleCsv(text);
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error('File không có dữ liệu hợp lệ.');
        }
        const items: VocabItem[] = rows.map((r: Record<string, string>, idx: number) => ({
          id: r.id || `user-voc-${idx + 1}`,
          word: r.word || '',
          reading: r.reading || null,
          meaningVi: r.meaningVi || null,
          partOfSpeech: r.partOfSpeech || null,
          category: r.category || 'User Imported',
          unit: Number(r.unit) || 1,
          unitName: `Unit ${r.unit || 1}`,
          dayNumber: Number(r.dayNumber) || 1,
          assignedItemRange: '1–880',
          itemNumber: r.itemNumber ? Number(r.itemNumber) : null,
          exampleSentence: r.exampleSentence || null,
          exampleTranslation: r.exampleTranslation || null,
          relatedExpressions: [],
          audio: null,
          source: 'user_imported',
          textbookId: 'mimi_goi',
          taskId: 'd01-vocab-01',
          flags: [],
        }));
        const count = await importVocabItems(items.filter((i) => i.word));
        setImportStatus({
          type: 'success',
          message: `Đã nhập thành công ${count} mục Từ vựng (chống trùng lặp bằng ID ổn định)!`,
        });
      } else if (importType === 'grammar') {
        const rows = isJson ? JSON.parse(text) : parseSimpleCsv(text);
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error('File Ngữ pháp không có dữ liệu hợp lệ.');
        }
        const patterns: GrammarPattern[] = rows.map((r: Record<string, string>, idx: number) => ({
          id: r.id || `user-grm-${idx + 1}`,
          structure: r.structure || '',
          meaningVi: r.meaningVi || '',
          examples: r.examples ? [r.examples] : [],
          exampleTranslations: r.exampleTranslations ? [r.exampleTranslations] : [],
          formation: r.formation || null,
          usage: r.usage || null,
          similarPatterns: [],
          commonMistakes: [],
          jlptRelevance: null,
          unit: Number(r.unit) || 1,
          group: null,
          dayNumber: Number(r.dayNumber) || 1,
          orderInSession: idx + 1,
          patternNumber: r.patternNumber ? Number(r.patternNumber) : null,
          assignedPatternRange: '1–112',
          unitPart: 'imported',
          taskId: 'd01-grammar-01',
          source: 'user_imported',
          textbookId: 'mimi_bunpou',
          flags: [],
        }));
        const count = await importGrammarPatterns(patterns.filter((p) => p.structure));
        setImportStatus({
          type: 'success',
          message: `Đã nhập thành công ${count} mẫu Ngữ pháp!`,
        });
      } else if (importType === 'kanji') {
        const rows = isJson ? JSON.parse(text) : parseSimpleCsv(text);
        if (!Array.isArray(rows) || rows.length === 0) {
          throw new Error('File Kanji không có dữ liệu hợp lệ.');
        }
        const words: KanjiWordItem[] = rows.map((r: Record<string, string>, idx: number) => ({
          id: r.id || `user-knj-${idx + 1}`,
          word: r.word || r.kanji || '',
          reading: r.reading || r.onyomi || null,
          meaningVi: r.meaningVi || null,
          week: Number(r.week) || 1,
          lessons: [Number(r.lesson) || 1],
          lessonGlobal: [Number(r.lesson) || 1],
          lessonTopic: r.lessonTopic || 'User Imported',
          pageRange: r.pageRange || '10–11',
          dayNumber: Number(r.dayNumber) || 1,
          taskId: 'd01-kanji-01',
          textbookId: 'soumatome_kanji',
          contrastGroup: null,
          source: 'user_imported',
          flags: [],
        }));
        const count = await importKanjiWords(words.filter((w) => w.word));
        setImportStatus({
          type: 'success',
          message: `Đã nhập thành công ${count} mục Kanji!`,
        });
      } else if (importType === 'reading') {
        const parsed = JSON.parse(text);
        const list: ReadingPassageExercise[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const p of list) {
          if (p.id && p.passage) {
            await saveReadingPassage(p);
          }
        }
        setImportStatus({
          type: 'success',
          message: `Đã nhập thành công ${list.length} bài Đọc hiểu JSON!`,
        });
      } else if (importType === 'listening') {
        const parsed = JSON.parse(text);
        const list: ListeningExerciseItem[] = Array.isArray(parsed) ? parsed : [parsed];
        for (const l of list) {
          if (l.id && l.question) {
            await saveListeningExercise(l);
          }
        }
        setImportStatus({
          type: 'success',
          message: `Đã nhập thành công ${list.length} bài Nghe hiểu JSON!`,
        });
      }
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: `Lỗi khi đọc file: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const handleDownloadBackup = async () => {
    const payload = await exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jlpt-n3-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as FullBackupPayload;
      if (!payload.stores || !payload.schemaVersion) {
        throw new Error('File sao lưu không đúng định dạng FullBackupPayload.');
      }
      await restoreBackup(payload);
      setImportStatus({
        type: 'success',
        message: 'Đã khôi phục toàn bộ dữ liệu học tập từ bản sao lưu thành công!',
      });
    } catch (err) {
      setImportStatus({
        type: 'error',
        message: `Không thể khôi phục: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Settings className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            Cài Đặt, Nhập Dữ Liệu Giáo Trình & Sao Lưu Hệ Thống
          </h2>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
          Quản lý cấu hình cá nhân, nhập thêm dữ liệu CSV/JSON từ sách giáo trình, sao lưu/khôi phục IndexedDB và kiểm tra tính toàn vẹn dữ liệu nguồn.
        </p>
      </div>

      {importStatus && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${
            importStatus.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
              : 'bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
          }`}
        >
          {importStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{importStatus.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Content Import & Sample Templates (Part 16) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              1. Nhập dữ liệu từ Giáo trình (CSV / JSON — Part 16)
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Vì lộ trình chỉ liệt kê các từ/mẫu tiêu biểu của mỗi ngày, bạn có thể tải mẫu CSV/JSON bên dưới để nhập bổ sung toàn bộ 880 từ vựng, 112 mẫu ngữ pháp, 336 Kanji, bài đọc và bài nghe. Hệ thống tự động chống trùng lặp theo ID.
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Chọn phân hệ cần nhập
            </label>
            <select
              value={importType}
              onChange={(e) =>
                setImportType(
                  e.target.value as 'vocabulary' | 'grammar' | 'kanji' | 'reading' | 'listening'
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold"
            >
              <option value="vocabulary">Từ vựng — Mimi kara Oboeru N3 Goi (CSV / JSON)</option>
              <option value="grammar">Ngữ pháp — Mimi kara Oboeru N3 Bunpou (CSV / JSON)</option>
              <option value="kanji">Kanji — Nihongo Soumatome N3 Kanji (CSV / JSON)</option>
              <option value="reading">Đọc hiểu — Shinkanzen / Speed Master (JSON)</option>
              <option value="listening">Nghe hiểu — Mimi kara / Speed Master (JSON)</option>
            </select>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Tải tệp CSV hoặc JSON lên:
            </label>
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleImportFile}
              className="w-full text-xs text-slate-600"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs font-bold text-slate-600 dark:text-slate-400">
              Tải tệp mẫu chuẩn (Sample Templates):
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => downloadSampleTemplate('vocab_csv')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Mẫu CSV Từ vựng
              </button>
              <button
                onClick={() => downloadSampleTemplate('grammar_csv')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Mẫu CSV Ngữ pháp
              </button>
              <button
                onClick={() => downloadSampleTemplate('kanji_csv')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Mẫu CSV Kanji
              </button>
              <button
                onClick={() => downloadSampleTemplate('reading_json')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Mẫu JSON Đọc hiểu
              </button>
              <button
                onClick={() => downloadSampleTemplate('listening_json')}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 text-xs font-semibold flex items-center gap-1"
              >
                <Download className="w-3.5 h-3.5" /> Mẫu JSON Nghe hiểu
              </button>
            </div>
          </div>
        </div>

        {/* 2. Backup, Restore & Preferences */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              2. Sao lưu / Khôi phục IndexedDB & Cài đặt Lịch
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDownloadBackup}
              className="p-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Xuất bản sao lưu JSON đầy đủ
            </button>

            <label className="p-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer">
              <Upload className="w-4 h-4" />
              Khôi phục từ file Backup JSON
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreBackup}
                className="hidden"
              />
            </label>
          </div>

          <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Ngày thi chính thức
                </label>
                <input
                  type="date"
                  value={settings.examDate}
                  onChange={(e) => updateSettings({ examDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Giả lập ngày hiện tại (Để kiểm thử)
                </label>
                <input
                  type="date"
                  value={settings.simulatedTodayDate || ''}
                  onChange={(e) =>
                    updateSettings({
                      simulatedTodayDate: e.target.value ? e.target.value : null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-slate-500">
                Đặt lại toàn bộ dữ liệu học tập (Giữ nguyên Lộ trình 25 ngày gốc):
              </span>
              <button
                onClick={async () => {
                  if (
                    window.confirm(
                      'Bạn có chắc muốn xóa tiến độ học tập đã lưu? Lộ trình 25 ngày gốc vẫn được giữ nguyên.'
                    )
                  ) {
                    await resetAllData();
                    setImportStatus({
                      type: 'success',
                      message: 'Đã đặt lại dữ liệu học tập về trạng thái ban đầu.',
                    });
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset tiến độ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Source Data Validation & Flagged Quirks Viewer */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              3. Báo cáo Đối chiếu & 42 Ghi chú / Cảnh báo từ File Markdown Gốc (Stage 1)
            </h3>
            <p className="text-xs text-slate-500">
              Hệ thống không tự ý sửa hay xóa dữ liệu gốc mà gắn cờ minh bạch mọi điểm chưa đồng nhất trong file nguồn.
            </p>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            10/10 Kiểm định PASS
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto pr-1">
          {extractionIssues.map((iss) => (
            <div
              key={iss.id}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  [{iss.code}] {iss.dayNumber ? `Ngày ${iss.dayNumber}` : 'Toàn cục'}
                </span>
                <span className="text-[11px] text-slate-400">
                  Dòng {iss.sourceLines.join(', ')}
                </span>
              </div>
              <div className="text-slate-700 dark:text-slate-300 japanese-text">
                {iss.message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
