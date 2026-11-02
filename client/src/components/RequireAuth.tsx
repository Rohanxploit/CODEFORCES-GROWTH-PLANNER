import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorMessage, Spinner } from './ui';

/** Redirects to /login when signed out. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading, error, refresh } = useAuth();
  const location = useLocation();
  if (isLoading) return <Page><Spinner label="Checking your session…" /></Page>;
  if (error) return <Page><ErrorMessage error={error} onRetry={() => void refresh()} /></Page>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

/** For pages that need a roadmap: sends users without one to onboarding. */
export function RequireRoadmap({ children }: { children: (roadmapId: string) => ReactNode }) {
  const { activeRoadmapId } = useAuth();
  if (!activeRoadmapId) {
    return (
      <Page>
        <EmptyState
          title="No active roadmap yet"
          action={
            <Link to="/onboarding" className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:text-zinc-950">
              Create your 90-day plan
            </Link>
          }
        >
          Tell us your current rating, target and schedule, and we will build a personalised 90-day plan.
        </EmptyState>
      </Page>
    );
  }
  return <>{children(activeRoadmapId)}</>;
}

export function Page({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return <main className={`mx-auto w-full px-4 py-8 ${wide ? 'max-w-6xl' : 'max-w-5xl'}`}>{children}</main>;
}
