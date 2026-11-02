// Contracts shared between client and server. Engine logic lives on the
// server; only data shapes and display constants belong here.

export const CHALLENGE_DURATION_DAYS = 90;

/** Offset used by the "target + 300" problem-solving benchmark heuristic. */
export const BENCHMARK_OFFSET = 300;

export const MIN_RATING = 0;
export const MAX_RATING = 4000;

export type CodeforcesRank =
  | 'Newbie'
  | 'Pupil'
  | 'Specialist'
  | 'Expert'
  | 'Candidate Master'
  | 'Master'
  | 'International Master or above';

export type SkillClassification =
  | 'Beginner'
  | 'Basic problem solver'
  | 'Intermediate'
  | 'Advanced'
  | 'Advanced problem solver'
  | 'High-level training'
  | 'Advanced training';

export interface RatingLevel {
  rating: number;
  rank: CodeforcesRank;
  classification: SkillClassification;
  /** True below 200: the plan starts with programming fundamentals. */
  needsFundamentals: boolean;
}

// ---------- Goals ----------

export type GoalDifficulty = 'maintenance' | 'conservative' | 'recommended' | 'ambitious' | 'very-ambitious';

export interface GoalRecommendation {
  conservative: number;
  recommended: number;
  stretch: number;
  /** True when the rating is outside the heuristic table and values were extrapolated. */
  extrapolated: boolean;
}

export interface GoalAssessment {
  current: RatingLevel;
  target: number;
  targetRank: CodeforcesRank;
  ratingGap: number;
  goals: GoalRecommendation;
  benchmark: number;
  difficulty: GoalDifficulty;
  warning: string | null;
  notes: string[];
}

// ---------- Codeforces ----------

export interface CodeforcesProfile {
  handle: string;
  rating: number | null;
  maxRating: number | null;
  rank: string | null;
  maxRank: string | null;
  avatar: string | null;
}

export interface UpcomingContest {
  id: number;
  name: string;
  startTime: string;
  durationSeconds: number;
  url: string;
}

export interface VirtualContestSuggestion {
  id: number;
  name: string;
  startTime: string;
  url: string;
  reason: string;
}

export interface CatalogProblemDTO {
  problemId: string;
  contestId: number;
  index: string;
  name: string;
  rating: number | null;
  tags: string[];
  solvedCount: number | null;
  url: string;
}

// ---------- Roadmap ----------

export type DayType = 'learn' | 'practice' | 'revision' | 'contest' | 'assessment' | 'rest';
export type ProblemRole = 'core' | 'reinforcement' | 'stretch';
export type DayStatus = 'pending' | 'in-progress' | 'completed' | 'skipped';
export type RoadmapStatus = 'active' | 'archived' | 'completed';

export type SolvingStatus =
  | 'not-attempted'
  | 'solved-independently'
  | 'solved-with-hint'
  | 'solved-with-editorial'
  | 'unable-to-solve';

export const SOLVING_STATUS_LABELS: Record<SolvingStatus, string> = {
  'not-attempted': 'Not attempted',
  'solved-independently': 'Solved independently',
  'solved-with-hint': 'Solved with a hint',
  'solved-with-editorial': 'Solved after editorial',
  'unable-to-solve': 'Unable to solve',
};

export type DayFeedback =
  | 'too-easy'
  | 'appropriate'
  | 'too-difficult'
  | 'need-revision'
  | 'understood'
  | 'need-more-examples';

export const DAY_FEEDBACK_LABELS: Record<DayFeedback, string> = {
  'too-easy': 'Too easy',
  appropriate: 'Appropriate',
  'too-difficult': 'Too difficult',
  'need-revision': 'Need revision',
  understood: 'I understood the concept',
  'need-more-examples': 'I need more examples',
};

export interface RatingRange {
  min: number;
  max: number;
}

export interface AssignedProblem {
  problemId: string;
  contestId: number;
  index: string;
  name: string;
  rating: number;
  tags: string[];
  solvedCount: number | null;
  url: string;
  role: ProblemRole;
  mandatory: boolean;
  reason: string;
  estimatedMinutes: number;
}

export interface ProblemProgressDTO {
  problemId: string;
  solvingStatus: SolvingStatus;
  editorialUsed: boolean;
  hintRevealed: boolean;
  timeTakenMinutes: number | null;
  confidence: number | null;
  notes: string;
  completedAt: string | null;
}

export interface DailyPlanDTO {
  id: string;
  roadmapId: string;
  dayNumber: number;
  date: string;
  week: number;
  type: DayType;
  phase: number;
  phaseName: string;
  topicId: string | null;
  topic: string;
  subtopic: string;
  objective: string;
  concept: string;
  whyItMatters: string;
  prerequisites: string[];
  learnMinutes: number;
  practiceMinutes: number;
  difficulty: RatingRange;
  stretchDifficulty: RatingRange | null;
  problems: AssignedProblem[];
  revisionTasks: string[];
  ifStuck: string[];
  status: DayStatus;
  feedback: DayFeedback[];
  progress: ProblemProgressDTO[];
}

export interface AdaptationEntry {
  date: string;
  fromDay: number;
  change: 'increase' | 'decrease' | 'revision';
  offset: number;
  reason: string;
}

export interface RoadmapDTO {
  id: string;
  status: RoadmapStatus;
  codeforcesHandle: string | null;
  startingRating: number;
  startingLevel: RatingLevel;
  targetRating: number;
  conservativeGoal: number;
  recommendedGoal: number;
  stretchGoal: number;
  goalDifficulty: GoalDifficulty;
  problemSolvingBenchmark: number;
  duration: number;
  startDate: string;
  endDate: string;
  hoursPerDay: number;
  daysPerWeek: number;
  contestParticipation: boolean;
  mandatoryProblems: number;
  difficultyOffset: number;
  rampCapped: boolean;
  adaptations: AdaptationEntry[];
  createdAt: string;
}

export interface DaySummaryDTO {
  dayNumber: number;
  date: string;
  week: number;
  type: DayType;
  phase: number;
  topic: string;
  subtopic: string;
  difficulty: RatingRange;
  status: DayStatus;
  problemCount: number;
}

export interface RoadmapDetailDTO {
  roadmap: RoadmapDTO;
  days: DaySummaryDTO[];
}

export interface GenerateRoadmapInput {
  codeforcesHandle?: string;
  currentRating?: number;
  targetRating: number;
  hoursPerDay: number;
  daysPerWeek: number;
  contestParticipation: boolean;
  mandatoryProblems?: number;
  startDate?: string;
}

// ---------- Users ----------

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserPreferences {
  theme: ThemePreference;
  blindPractice: boolean;
}

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  codeforcesHandle: string | null;
  currentRating: number | null;
  preferences: UserPreferences;
  excludedProblemIds: string[];
  createdAt: string;
}

// ---------- Contests ----------

export interface ContestRecordDTO {
  id: string;
  roadmapId: string | null;
  contestId: number | null;
  contestName: string;
  contestDate: string;
  kind: 'rated' | 'virtual';
  oldRating: number | null;
  newRating: number | null;
  problemsSolved: number;
  upsolvedProblems: number;
  notes: string;
}

// ---------- Analytics ----------

export interface AnalyticsDTO {
  roadmapId: string;
  currentDay: number;
  totals: {
    studyDays: number;
    completedDays: number;
    completionPercent: number;
    mandatoryProblems: number;
    problemsAttempted: number;
    problemsSolved: number;
  };
  consistency: { currentStreak: number; longestStreak: number; activeDays: number };
  weekly: { week: number; plannedDays: number; completedDays: number; solved: number }[];
  topics: { topic: string; days: number; completedDays: number; solved: number; assigned: number }[];
  solvingBreakdown: Record<SolvingStatus, number>;
  difficultyProgression: { day: number; plannedMin: number; plannedMax: number; solvedRating: number | null }[];
  highestIndependentlySolved: number | null;
  contests: {
    participated: number;
    rated: number;
    virtual: number;
    upsolved: number;
    history: { date: string; name: string; newRating: number | null; kind: 'rated' | 'virtual' }[];
  };
}

export interface WeeklyReviewDTO {
  week: number;
  startDate: string;
  endDate: string;
  topicsCovered: string[];
  problemsCompleted: number;
  independentSolves: number;
  hintSolves: number;
  editorialSolves: number;
  unableToSolve: number;
  pendingTasks: { dayNumber: number; problemId: string; name: string }[];
  feedbackSummary: Partial<Record<DayFeedback, number>>;
  contests: ContestRecordDTO[];
  nextWeek: { dayNumber: number; date: string; type: DayType; topic: string }[];
}

// ---------- API envelope ----------

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  database: 'connected' | 'connecting' | 'disconnected';
  timestamp: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
