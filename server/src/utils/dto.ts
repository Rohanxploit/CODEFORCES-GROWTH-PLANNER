import type { ContestRecordDTO, DailyPlanDTO, DaySummaryDTO, ProblemProgressDTO, RoadmapDTO, UserDTO } from '@cgp/shared';
import type { IUser } from '../models/User.js';
import type { IRoadmap } from '../models/Roadmap.js';
import type { IDailyPlan } from '../models/DailyPlan.js';
import type { IProgress } from '../models/Progress.js';
import type { IContest } from '../models/Contest.js';

// Maps database documents to API shapes. Internal fields (password hash,
// seed, userId) never leave the server.

export function toUserDTO(u: IUser): UserDTO {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    codeforcesHandle: u.codeforcesHandle,
    currentRating: u.currentRating,
    preferences: { theme: u.preferences?.theme ?? 'system', blindPractice: u.preferences?.blindPractice ?? false },
    excludedProblemIds: u.excludedProblemIds ?? [],
    createdAt: u.createdAt.toISOString(),
  };
}

export function toRoadmapDTO(r: IRoadmap): RoadmapDTO {
  return {
    id: r._id.toString(),
    status: r.status,
    codeforcesHandle: r.codeforcesHandle,
    startingRating: r.startingRating,
    startingLevel: { rating: r.startingRating, ...r.startingLevel },
    targetRating: r.targetRating,
    conservativeGoal: r.conservativeGoal,
    recommendedGoal: r.recommendedGoal,
    stretchGoal: r.stretchGoal,
    goalDifficulty: r.goalDifficulty,
    problemSolvingBenchmark: r.problemSolvingBenchmark,
    duration: r.duration,
    startDate: r.startDate,
    endDate: r.endDate,
    hoursPerDay: r.hoursPerDay,
    daysPerWeek: r.daysPerWeek,
    contestParticipation: r.contestParticipation,
    mandatoryProblems: r.mandatoryProblems,
    difficultyOffset: r.difficultyOffset,
    rampCapped: r.rampCapped,
    adaptations: r.adaptations ?? [],
    createdAt: r.createdAt.toISOString(),
  };
}

export function toProgressDTO(p: IProgress): ProblemProgressDTO {
  return {
    problemId: p.problemId,
    solvingStatus: p.solvingStatus,
    editorialUsed: p.editorialUsed,
    hintRevealed: p.hintRevealed,
    timeTakenMinutes: p.timeTaken,
    confidence: p.confidence,
    notes: p.notes,
    completedAt: p.completedAt ? p.completedAt.toISOString() : null,
  };
}

export function toDayDTO(d: IDailyPlan, progress: IProgress[] = []): DailyPlanDTO {
  return {
    id: d._id.toString(),
    roadmapId: d.roadmapId.toString(),
    dayNumber: d.dayNumber,
    date: d.date,
    week: d.week,
    type: d.type,
    phase: d.phase,
    phaseName: d.phaseName,
    topicId: d.topicId,
    topic: d.topic,
    subtopic: d.subtopic,
    objective: d.objective,
    concept: d.concept,
    whyItMatters: d.whyItMatters,
    prerequisites: d.prerequisites,
    learnMinutes: d.learnMinutes,
    practiceMinutes: d.practiceMinutes,
    difficulty: { min: d.difficulty.min, max: d.difficulty.max },
    stretchDifficulty: d.stretchDifficulty ? { min: d.stretchDifficulty.min, max: d.stretchDifficulty.max } : null,
    problems: d.problems.map((p) => ({
      problemId: p.problemId,
      contestId: p.contestId,
      index: p.index,
      name: p.name,
      rating: p.rating,
      tags: [...p.tags],
      solvedCount: p.solvedCount ?? null,
      url: p.url,
      role: p.role,
      mandatory: p.mandatory,
      reason: p.reason,
      estimatedMinutes: p.estimatedMinutes,
    })),
    revisionTasks: d.revisionTasks,
    ifStuck: d.ifStuck,
    status: d.status,
    feedback: d.feedback,
    progress: progress.map(toProgressDTO),
  };
}

export function toDaySummaryDTO(d: IDailyPlan): DaySummaryDTO {
  return {
    dayNumber: d.dayNumber,
    date: d.date,
    week: d.week,
    type: d.type,
    phase: d.phase,
    topic: d.topic,
    subtopic: d.subtopic,
    difficulty: { min: d.difficulty.min, max: d.difficulty.max },
    status: d.status,
    problemCount: d.problems.length,
  };
}

export function toContestDTO(c: IContest): ContestRecordDTO {
  return {
    id: c._id.toString(),
    roadmapId: c.roadmapId ? c.roadmapId.toString() : null,
    contestId: c.contestId,
    contestName: c.contestName,
    contestDate: c.contestDate,
    kind: c.kind,
    oldRating: c.oldRating,
    newRating: c.newRating,
    problemsSolved: c.problemsSolved,
    upsolvedProblems: c.upsolvedProblems,
    notes: c.notes,
  };
}
