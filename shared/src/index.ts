// Contracts shared between client and server. Engine logic lives on the
// server; only data shapes and display constants belong here.

export const CHALLENGE_DURATION_DAYS = 90;

/** Offset used by the "target + 300" problem-solving benchmark heuristic. */
export const BENCHMARK_OFFSET = 300;

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
