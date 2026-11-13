import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { GrammarPage } from './pages/GrammarPage';
import { KanjiPage } from './pages/KanjiPage';
import { ReadingPage } from './pages/ReadingPage';
import { ListeningPage } from './pages/ListeningPage';
import { MistakeNotebookPage } from './pages/MistakeNotebookPage';
import { MockExamPage } from './pages/MockExamPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

const MainRouter: React.FC = () => {
  const { ready, activeTab } = useApp();

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-sm font-semibold">
            Đang tải cơ sở dữ liệu Lộ trình JLPT N3 25 ngày (IndexedDB)...
          </div>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      {activeTab === 'dashboard' && <DashboardPage />}
      {activeTab === 'roadmap' && <RoadmapPage />}
      {activeTab === 'vocabulary' && <VocabularyPage />}
      {activeTab === 'grammar' && <GrammarPage />}
      {activeTab === 'kanji' && <KanjiPage />}
      {activeTab === 'reading' && <ReadingPage />}
      {activeTab === 'listening' && <ListeningPage />}
      {activeTab === 'mistakes' && <MistakeNotebookPage />}
      {activeTab === 'mock_exam' && <MockExamPage />}
      {activeTab === 'analytics' && <AnalyticsPage />}
      {activeTab === 'settings' && <SettingsPage />}
    </AppLayout>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
};

export default App;
