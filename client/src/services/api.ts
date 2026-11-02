import type {
  AdaptationEntry,
  AnalyticsDTO,
  ApiErrorBody,
  CatalogProblemDTO,
  CodeforcesProfile,
  ContestRecordDTO,
  DailyPlanDTO,
  DayFeedback,
  DaySummaryDTO,
  GenerateRoadmapInput,
  GoalAssessment,
  GoalRecommendation,
  HealthResponse,
  RatingLevel,
  RoadmapDTO,
  SolvingStatus,
  UpcomingContest,
  UserDTO,
  UserPreferences,
  VirtualContestSuggestion,
  WeeklyReviewDTO,
} from '@cgp/shared';

// Empty in development (Vite proxies /api) and on Vercel (rewrite to Render).
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection and try again.');
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(res.status, body?.error.code ?? 'HTTP_ERROR', body?.error.message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });
const patch = <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
const del = <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined });

/** Local calendar date (YYYY-MM-DD) so "today" follows the user's timezone. */
export function localDate(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export interface MeResponse {
  user: UserDTO;
  activeRoadmapId: string | null;
}

export interface DayResponse {
  day: DailyPlanDTO;
  roadmap: RoadmapDTO;
  currentDay?: number;
}

export interface RoadmapDetailResponse {
  roadmap: RoadmapDTO;
  days: DaySummaryDTO[];
  notes: string[];
  topics: string[];
}

export interface ContestOverview {
  available: boolean;
  upcoming: UpcomingContest[];
  virtualSuggestions: VirtualContestSuggestion[];
}

export interface ProgressInput {
  problemId: string;
  solvingStatus?: SolvingStatus;
  editorialUsed?: boolean;
  hintRevealed?: boolean;
  timeTakenMinutes?: number | null;
  confidence?: number | null;
  notes?: string;
}

export type ContestInput = Omit<ContestRecordDTO, 'id' | 'roadmapId' | 'contestId'> & { roadmapId?: string | null; contestId?: number | null };

export interface RoadmapSettingsInput {
  targetRating?: number;
  hoursPerDay?: number;
  daysPerWeek?: number;
  contestParticipation?: boolean;
  mandatoryProblems?: number | null;
  status?: RoadmapDTO['status'];
}

export const api = {
  health: () => apiFetch<HealthResponse>('/api/health'),

  me: () => apiFetch<MeResponse>('/api/auth/me'),
  register: (body: { name: string; email: string; password: string }) => post<{ user: UserDTO }>('/api/auth/register', body),
  login: (body: { email: string; password: string }) => post<{ user: UserDTO }>('/api/auth/login', body),
  logout: () => post<{ ok: true }>('/api/auth/logout'),
  updateMe: (body: { name?: string; codeforcesHandle?: string | null; preferences?: Partial<UserPreferences> }) => patch<{ user: UserDTO }>('/api/auth/me', body),
  deleteMe: (password: string) => del<{ ok: true }>('/api/auth/me', { password }),
  removeExcluded: (problemId: string) => del<{ user: UserDTO }>(`/api/auth/me/excluded/${encodeURIComponent(problemId)}`),

  analyzeGoal: (currentRating: number, targetRating: number) => post<GoalAssessment>('/api/goals/analyze', { currentRating, targetRating }),
  recommendGoals: (currentRating: number) => post<{ level: RatingLevel; goals: GoalRecommendation }>('/api/goals/recommend', { currentRating }),
  codeforcesProfile: (handle: string) => apiFetch<{ profile: CodeforcesProfile; level: RatingLevel | null }>(`/api/codeforces/${encodeURIComponent(handle)}`),

  generateRoadmap: (input: GenerateRoadmapInput) => post<{ roadmap: RoadmapDTO; assessment: GoalAssessment; notes: string[] }>('/api/roadmaps/generate', input),
  roadmaps: () => apiFetch<{ roadmaps: RoadmapDTO[] }>('/api/roadmaps'),
  roadmap: (id: string) => apiFetch<RoadmapDetailResponse>(`/api/roadmaps/${id}`),
  today: (id: string) => apiFetch<DayResponse>(`/api/roadmaps/${id}/today?date=${localDate()}`),
  day: (id: string, dayNumber: number) => apiFetch<DayResponse>(`/api/roadmaps/${id}/day/${dayNumber}`),
  updateRoadmap: (id: string, body: RoadmapSettingsInput) => patch<{ roadmap: RoadmapDTO; regeneratedDays: number }>(`/api/roadmaps/${id}?date=${localDate()}`, body),
  deleteRoadmap: (id: string) => del<{ ok: true }>(`/api/roadmaps/${id}`),

  updateProgress: (dayId: string, body: ProgressInput) => patch<{ day: DailyPlanDTO }>(`/api/progress/${dayId}`, body),
  setDayStatus: (dayId: string, status: 'pending' | 'completed' | 'skipped') => patch<{ day: DailyPlanDTO }>(`/api/progress/${dayId}/status`, { status }),
  sendFeedback: (dayId: string, feedback: DayFeedback[]) => post<{ day: DailyPlanDTO; adaptation: AdaptationEntry | null }>(`/api/progress/${dayId}/feedback`, { feedback }),

  replaceProblem: (roadmapId: string, dayNumber: number, problemId: string) => post<{ day: DailyPlanDTO }>('/api/problems/replace', { roadmapId, dayNumber, problemId }),
  excludeProblem: (problemId: string, roadmapId?: string, dayNumber?: number) =>
    post<{ user: UserDTO | null; day: DailyPlanDTO | null }>('/api/problems/exclude', { problemId, roadmapId, dayNumber }),
  searchProblems: (params: { q?: string; tags?: string; min?: number; max?: number; limit?: number }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return apiFetch<{ problems: CatalogProblemDTO[]; catalogUpdatedAt: string; stale: boolean }>(`/api/problems?${qs}`);
  },

  contests: () => apiFetch<ContestOverview>('/api/contests'),
  contestHistory: () => apiFetch<{ contests: ContestRecordDTO[] }>('/api/contests/history'),
  recordContest: (body: ContestInput) => post<{ contest: ContestRecordDTO }>('/api/contests', body),
  updateContest: (id: string, body: { upsolvedProblems?: number; notes?: string; newRating?: number | null }) => patch<{ contest: ContestRecordDTO }>(`/api/contests/${id}`, body),
  deleteContest: (id: string) => del<{ ok: true }>(`/api/contests/${id}`),

  analytics: (roadmapId: string) => apiFetch<AnalyticsDTO>(`/api/analytics/${roadmapId}?date=${localDate()}`),
  weeklyReview: (roadmapId: string, week?: number) =>
    apiFetch<WeeklyReviewDTO>(`/api/analytics/${roadmapId}/weekly-review?date=${localDate()}${week ? `&week=${week}` : ''}`),
};
