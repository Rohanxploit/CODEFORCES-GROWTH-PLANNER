import { Suspense, lazy, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppHeader } from './components/AppHeader';
import { RequireAuth } from './components/RequireAuth';
import { LandingPage } from './pages/LandingPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { DayPage, TodayPage } from './pages/DayPage';
import { Spinner } from './components/ui';
import { WeeklyReviewPage } from './pages/WeeklyReviewPage';
import { ContestsPage } from './pages/ContestsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Charts (Recharts) are the largest dependency; load them only on the analytics page.
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));

const guard = (el: ReactNode) => <RequireAuth>{el}</RequireAuth>;

export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/onboarding" element={guard(<OnboardingPage />)} />
        <Route path="/dashboard" element={guard(<DashboardPage />)} />
        <Route path="/practice" element={guard(<TodayPage />)} />
        <Route path="/day/:dayNumber" element={guard(<DayPage />)} />
        <Route path="/roadmap" element={guard(<RoadmapPage />)} />
        <Route
          path="/analytics"
          element={guard(
            <Suspense fallback={<main className="mx-auto w-full max-w-6xl px-4 py-8"><Spinner /></main>}>
              <AnalyticsPage />
            </Suspense>,
          )}
        />
        <Route path="/review" element={guard(<WeeklyReviewPage />)} />
        <Route path="/contests" element={guard(<ContestsPage />)} />
        <Route path="/settings" element={guard(<SettingsPage />)} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
