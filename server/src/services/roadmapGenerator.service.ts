import { CHALLENGE_DURATION_DAYS, type AssignedProblem, type DayType, type GoalAssessment, type RatingRange } from '@cgp/shared';
import { PHASE_NAMES, topicById, type PhaseNumber, type TopicDefinition } from '../config/heuristics/topics.js';
import { assessGoal } from './goalEngine.service.js';
import { createDifficultyCurve } from './difficultyProgression.service.js';
import { planTopics, type TopicBlock } from './topicPlanner.service.js';
import type { CatalogProblem } from './problemSelector/fetchProblemset.js';
import { buildSolvedIndex } from './problemSelector/calculateProblemScore.js';
import { ExclusionSet } from './problemSelector/excludePreviouslyAssigned.js';
import { estimateMinutes, selectDailyProblems } from './problemSelector/selectDailyProblems.js';

// Deterministic 90-day roadmap generation. Same input + same catalog = same
// roadmap. Nothing here reads submission history; the starting rating is the
// only skill input, and hours/days/contest preference shape the workload.

export interface RoadmapGeneratorInput {
  startingRating: number;
  targetRating: number;
  hoursPerDay: number;
  daysPerWeek: number;
  contestParticipation: boolean;
  /** 1–3; defaults from study hours. */
  mandatoryProblems?: number;
  /** YYYY-MM-DD, day 1 of the challenge. */
  startDate: string;
  seed: string;
  excludedProblemIds?: readonly string[];
  /** Problems on days that are being kept when regenerating, so they are not repeated. */
  keptProblems?: readonly Pick<CatalogProblem, 'problemId' | 'contestId' | 'name'>[];
  /** Adaptive offset (±100 steps) applied from `offsetFromDay` onwards. */
  difficultyOffset?: number;
  offsetFromDay?: number;
}

export interface DailyPlanDraft {
  dayNumber: number;
  date: string;
  week: number;
  type: DayType;
  phase: PhaseNumber;
  phaseName: string;
  topicId: string | null;
  topic: string;
  subtopic: string;
  objective: string;
  concept: string;
  whyItMatters: string;
  prerequisites: string[];
  /** Tags used for selection, kept so a problem can be replaced with the same rules later. */
  topicTags: string[];
  fallbackTags: string[];
  learnMinutes: number;
  practiceMinutes: number;
  difficulty: RatingRange;
  stretchDifficulty: RatingRange | null;
  problems: AssignedProblem[];
  revisionTasks: string[];
  ifStuck: string[];
  notes: string[];
}

export interface GeneratedRoadmap {
  assessment: GoalAssessment;
  benchmark: number;
  practiceStart: number;
  practiceEnd: number;
  rampCapped: boolean;
  mandatoryProblems: number;
  topics: string[];
  revisionTopics: string[];
  deferredTopics: string[];
  days: DailyPlanDraft[];
  notes: string[];
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Rest-day positions within a 7-day week, spread out and preferring the week's end. */
export function restPositions(daysPerWeek: number): Set<number> {
  const rest = 7 - Math.min(7, Math.max(1, daysPerWeek));
  const positions = new Set<number>();
  for (let j = 0; j < rest; j++) positions.add(6 - Math.round((j * 7) / rest));
  return positions;
}

export function defaultMandatoryProblems(hoursPerDay: number): number {
  if (hoursPerDay < 1.5) return 1;
  if (hoursPerDay >= 4) return 3;
  return 2;
}

type SlotKind = 'rest' | 'contest' | 'revision' | 'assessment' | 'content';

const round5 = (n: number) => Math.round(n / 5) * 5;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

function ifStuckGuidance(stuckMinutes: number): string[] {
  return [
    'Re-read the statement and work through every sample by hand.',
    'Write a brute force for tiny inputs and look for a pattern in its answers.',
    `After about ${stuckMinutes} minutes without progress, reveal the tags (Blind Practice) or read only the first hint of the editorial.`,
    "If you read the editorial, close it, implement the solution yourself, and record it as 'solved after editorial'.",
    'Write the key idea down in one sentence so revision days can bring it back.',
  ];
}

export function generateRoadmap(catalog: readonly CatalogProblem[], input: RoadmapGeneratorInput): GeneratedRoadmap {
  const assessment = assessGoal(input.startingRating, input.targetRating);
  const benchmark = assessment.benchmark;
  const hours = clamp(input.hoursPerDay, 0.5, 12);
  const daysPerWeek = clamp(Math.round(input.daysPerWeek), 1, 7);
  const mandatoryCount = clamp(Math.round(input.mandatoryProblems ?? defaultMandatoryProblems(hours)), 1, 3);
  const includeStretch = hours >= 1;
  const curve = createDifficultyCurve({ startingRating: input.startingRating, targetRating: input.targetRating, benchmark, hoursPerDay: hours });

  // ---------- 1. Calendar skeleton ----------
  const rest = restPositions(daysPerWeek);
  const kinds: SlotKind[] = Array.from({ length: CHALLENGE_DURATION_DAYS }, (_, d) => (rest.has(d % 7) ? 'rest' : 'content'));
  const weeks = Math.ceil(CHALLENGE_DURATION_DAYS / 7);
  const studyIdx = (week: number) => kinds.map((k, d) => (k !== 'rest' && Math.floor(d / 7) === week ? d : -1)).filter((d) => d >= 0);

  for (let w = 0; w < weeks; w++) {
    const days = studyIdx(w);
    if (days.length === 0) continue;
    // Contests: rated rounds weekly from week 2, or virtual contests from week 3 when rated rounds are not possible.
    const contestWeek = input.contestParticipation ? w >= 1 : w >= 2;
    const frequentEnough = daysPerWeek >= 3 || w % 2 === 1;
    if (contestWeek && frequentEnough && days.length >= 2) kinds[days[days.length - 1]!] = 'contest';
    // Weekly revision at the start of each week from week 2.
    const revisionWeek = daysPerWeek >= 4 ? w >= 1 : w >= 1 && w % 2 === 1;
    if (revisionWeek && days.length >= 3) kinds[days[0]!] = 'revision';
  }
  const studyDays = kinds.map((k, d) => (k !== 'rest' ? d : -1)).filter((d) => d >= 0);
  kinds[studyDays[studyDays.length - 1]!] = 'assessment';
  const totalStudy = studyDays.length;
  const progressOf = (d: number) => (totalStudy <= 1 ? 1 : Math.max(0, studyDays.indexOf(d)) / (totalStudy - 1));

  // ---------- 2. Topics into content slots ----------
  const contentDays = kinds.map((k, d) => (k === 'content' ? d : -1)).filter((d) => d >= 0);
  const phase6Count = Math.round(contentDays.length * 0.12);
  const phase5Min = Math.round(contentDays.length * 0.1);
  const learnCapacity = Math.max(1, contentDays.length - phase6Count - phase5Min);
  const topicPlan = planTopics({ startingRating: input.startingRating, rampEnd: curve.end, learnDays: learnCapacity });

  const learnSlots: { block: TopicBlock; dayInBlock: number }[] = [];
  for (const block of topicPlan.blocks) for (let j = 0; j < block.days; j++) learnSlots.push({ block, dayInBlock: j });
  const contentRole = new Map<number, { kind: 'learn'; slot: (typeof learnSlots)[number] } | { kind: 'practice'; phase: 5 | 6; n: number }>();
  contentDays.forEach((d, i) => {
    if (i < learnSlots.length) contentRole.set(d, { kind: 'learn', slot: learnSlots[i]! });
    else contentRole.set(d, { kind: 'practice', phase: i >= contentDays.length - phase6Count ? 6 : 5, n: i - learnSlots.length });
  });

  const plannedTopics = topicPlan.blocks.map((b) => b.topic);
  const practicePool: TopicDefinition[] = [
    ...plannedTopics.slice().sort((a, b) => b.entryRating - a.entryRating),
    ...topicPlan.revisionTopics.slice(-4).reverse(),
  ];

  // ---------- 3. Day-by-day drafts ----------
  const exclusion = new ExclusionSet(input.keptProblems ?? [], input.excludedProblemIds ?? []);
  const ratedCatalog = catalog.filter((p) => p.rating !== null);
  const solvedIndex = buildSolvedIndex(ratedCatalog);
  const totalMinutes = round5(hours * 60);
  const stuckMinutes = hours < 1.5 ? 20 : 30;
  const offsetFromDay = input.offsetFromDay ?? 1;

  const drafts: Omit<DailyPlanDraft, 'topicTags' | 'fallbackTags'>[] = [];
  const tagsByDay = new Map<number, { topicTags: string[]; fallbackTags: string[] }>();
  let lastPhase: PhaseNumber = 1;
  let pendingUpsolve = false;
  const recentTopics: TopicDefinition[] = [];

  for (let d = 0; d < CHALLENGE_DURATION_DAYS; d++) {
    const dayNumber = d + 1;
    const progress = progressOf(d);
    const offset = dayNumber >= offsetFromDay ? (input.difficultyOffset ?? 0) : 0;
    const base = {
      dayNumber,
      date: addDays(input.startDate, d),
      week: Math.floor(d / 7) + 1,
      prerequisites: [] as string[],
      notes: [] as string[],
      ifStuck: ifStuckGuidance(stuckMinutes),
    };

    const select = (name: string, tags: string[], fallback: string[], range: RatingRange, stretch: RatingRange | null, mandatory = mandatoryCount) => {
      tagsByDay.set(dayNumber, { topicTags: tags, fallbackTags: fallback });
      const { problems, notes } = selectDailyProblems(
        ratedCatalog,
        { topicName: name, topicTags: tags, fallbackTags: fallback, range, stretchRange: stretch, mandatoryCount: mandatory, seed: input.seed, maxSolvedByRating: solvedIndex },
        exclusion,
      );
      const centre = (range.min + range.max) / 2;
      const assigned: AssignedProblem[] = problems.map((s) => ({
        problemId: s.problem.problemId,
        contestId: s.problem.contestId,
        index: s.problem.index,
        name: s.problem.name,
        rating: s.problem.rating!,
        tags: s.problem.tags,
        solvedCount: s.problem.solvedCount,
        url: s.problem.url,
        role: s.role,
        mandatory: s.mandatory,
        reason: s.reason,
        estimatedMinutes: estimateMinutes(s.problem.rating!, centre, s.role),
      }));
      return { assigned, notes };
    };

    const takeUpsolve = (): string[] => {
      if (!pendingUpsolve) return [];
      pendingUpsolve = false;
      return ['Upsolve: attempt at least one problem from your last contest that you did not solve, then read its editorial and record it on the Contests page.'];
    };

    const kind = kinds[d]!;

    if (kind === 'rest') {
      drafts.push({
        ...base,
        type: 'rest',
        phase: lastPhase,
        phaseName: PHASE_NAMES[lastPhase],
        topicId: null,
        topic: 'Rest day',
        subtopic: 'Recovery and light review',
        objective: 'Rest. Consistency over 90 days matters more than any single day.',
        concept: 'Rest days are part of the plan. If you want to, spend 10–15 minutes rereading the notes you wrote this week.',
        whyItMatters: 'Spaced breaks help you retain ideas and avoid burnout.',
        learnMinutes: 0,
        practiceMinutes: 0,
        difficulty: curve.rangeAt(progress, 'normal', offset),
        stretchDifficulty: null,
        problems: [],
        revisionTasks: ['Optional: skim your notes from this week for 10–15 minutes.'],
        ifStuck: [],
      });
      continue;
    }

    if (kind === 'contest') {
      const rated = input.contestParticipation;
      drafts.push({
        ...base,
        type: 'contest',
        phase: lastPhase,
        phaseName: PHASE_NAMES[lastPhase],
        topicId: null,
        topic: rated ? 'Contest day' : 'Virtual contest',
        subtopic: rated ? 'Rated Codeforces round (or a virtual contest)' : 'Timed virtual contest',
        objective: rated
          ? 'Take part in a rated round this week if one fits your schedule (see the Contests page); otherwise do a virtual contest.'
          : 'Do a full virtual contest under real time limits, then review.',
        concept:
          'Contest rating depends on solving quickly and accurately under time pressure, which practice alone does not train. Read all problems you can reach, solve in order, and avoid spending the whole contest on one problem.',
        whyItMatters: 'Rating only changes through contests; practice builds skill, contests convert it.',
        learnMinutes: 0,
        practiceMinutes: Math.max(totalMinutes, 120),
        difficulty: curve.rangeAt(progress, 'normal', offset),
        stretchDifficulty: null,
        problems: [],
        revisionTasks: [
          ...takeUpsolve(),
          'Afterwards, record the result on the Contests page (old/new rating or virtual score, problems solved).',
          ...(hours < 2 ? ['A contest takes about 2 hours, longer than your usual daily time. Do a shorter virtual contest if needed.'] : []),
        ],
        ifStuck: [
          'If stuck for 20+ minutes, check the standings: a problem many people solved may be easier than the one you are on.',
          'Save unsolved problems for upsolving instead of guessing.',
        ],
      });
      pendingUpsolve = true;
      continue;
    }

    if (kind === 'assessment') {
      const range = curve.rangeAt(progress, 'normal', offset);
      const stretch = includeStretch ? curve.stretchAt(progress, offset) : null;
      const { assigned, notes } = select('Final assessment', [], [], range, stretch, Math.max(2, mandatoryCount));
      drafts.push({
        ...base,
        type: 'assessment',
        phase: 6,
        phaseName: PHASE_NAMES[6],
        topicId: null,
        topic: 'Final assessment',
        subtopic: 'Mixed topics, blind',
        objective: 'Solve a mixed set independently with tags hidden, then compare with where you started.',
        concept:
          "This set has no topic hint. Solve it in Blind Practice mode, time yourself, and compare your independent solves with your first weeks. Use the Analytics page to review what changed and decide your next 90-day target.",
        whyItMatters: 'Shows your problem-solving level now, separate from your contest rating.',
        learnMinutes: 0,
        practiceMinutes: totalMinutes,
        difficulty: range,
        stretchDifficulty: stretch,
        problems: assigned,
        revisionTasks: [...takeUpsolve(), 'Review the topics where you most often needed the editorial.'],
        notes,
      });
      lastPhase = 6;
      continue;
    }

    if (kind === 'revision') {
      const topics = recentTopics.length ? recentTopics.slice(-3) : topicPlan.revisionTopics.slice(-3);
      const tags = [...new Set(topics.flatMap((t) => t.cfTags))];
      const names = topics.map((t) => t.name);
      const range = curve.rangeAt(progress, 'revision', offset);
      const { assigned, notes } = select('weekly revision', tags, [], range, null);
      drafts.push({
        ...base,
        type: 'revision',
        phase: lastPhase,
        phaseName: PHASE_NAMES[lastPhase],
        topicId: null,
        topic: 'Weekly revision',
        subtopic: names.length ? `Revisit: ${names.join(', ')}` : 'Revisit the basics',
        objective: 'Consolidate recent topics with slightly easier problems and re-solve what needed help.',
        concept:
          'Revision days are deliberately easier. Re-solving ideas after a few days is what moves them from "I followed the editorial" to "I can do this alone".',
        whyItMatters: 'Spaced repetition makes techniques available under contest pressure.',
        learnMinutes: clamp(round5(totalMinutes * 0.15), 10, 30),
        practiceMinutes: totalMinutes - clamp(round5(totalMinutes * 0.15), 10, 30),
        difficulty: range,
        stretchDifficulty: null,
        problems: assigned,
        revisionTasks: [
          ...takeUpsolve(),
          'Re-solve one problem from last week that you marked as solved with a hint or editorial, without notes.',
          'Write a one-line summary of each topic covered last week.',
        ],
        notes,
      });
      recentTopics.length = 0;
      continue;
    }

    // Content days: topic learning or mixed practice.
    const role = contentRole.get(d)!;
    if (role.kind === 'learn') {
      const { block, dayInBlock } = role.slot;
      const topic = block.topic;
      const sub = topic.subtopics[dayInBlock % topic.subtopics.length]!;
      const range = curve.rangeAt(progress, dayInBlock === 0 ? 'intro' : 'normal', offset);
      const stretch = includeStretch ? curve.stretchAt(progress, offset) : null;
      const { assigned, notes } = select(topic.name, topic.cfTags, topic.fallbackTags, range, stretch);
      const prereqNames = topic.prerequisites.map((id) => topicById(id)?.name).filter((n): n is string => !!n);
      const learn = clamp(round5(totalMinutes * 0.3), 15, 60);
      const revisionTasks = [...takeUpsolve()];
      if (dayInBlock === 0) {
        revisionTasks.push(prereqNames.length ? `Before starting, revise the prerequisites: ${prereqNames.join(', ')}.` : 'Skim your notes from the previous topic before starting.');
      } else {
        revisionTasks.push("Explain yesterday's key idea in two sentences without looking at your notes.");
      }
      if (hours >= 3) revisionTasks.push('With your extra time, attempt the optional stretch problem before reading any hint.');

      const phase = topic.phase as PhaseNumber;
      drafts.push({
        ...base,
        type: 'learn',
        phase,
        phaseName: PHASE_NAMES[phase],
        topicId: topic.id,
        topic: topic.name,
        subtopic: sub.name,
        objective: sub.objective,
        concept: topic.concept,
        whyItMatters: topic.whyItMatters,
        prerequisites: prereqNames,
        learnMinutes: learn,
        practiceMinutes: totalMinutes - learn,
        difficulty: range,
        stretchDifficulty: stretch,
        problems: assigned,
        revisionTasks,
        notes: block.days < topic.subtopics.length && dayInBlock === block.days - 1 ? [...notes, 'This topic was shortened to fit your schedule; revisit the remaining subtopics later.'] : notes,
      });
      lastPhase = phase;
      if (!recentTopics.includes(topic)) recentTopics.push(topic);
      continue;
    }

    // Mixed practice (phase 5: target-level, phase 6: benchmark and contest prep).
    const range = curve.rangeAt(progress, 'normal', offset);
    const stretch = includeStretch ? curve.stretchAt(progress, offset) : null;
    const learn = clamp(round5(totalMinutes * 0.15), 10, 30);
    if (role.phase === 6 || practicePool.length === 0) {
      const { assigned, notes } = select('mixed practice', [], [], range, stretch);
      drafts.push({
        ...base,
        type: 'practice',
        phase: 6,
        phaseName: PHASE_NAMES[6],
        topicId: null,
        topic: 'Timed mixed practice',
        subtopic: 'Unknown topics, contest conditions',
        objective: 'Solve mixed problems under a time limit without knowing the topic in advance.',
        concept:
          'In contests nobody tells you the technique. Use Blind Practice, set a timer for the estimated time, and practise identifying the approach from the statement alone. The optional problem pushes towards your long-term benchmark.',
        whyItMatters: `Builds towards independently solving problems near your ${benchmark} benchmark.`,
        learnMinutes: learn,
        practiceMinutes: totalMinutes - learn,
        difficulty: range,
        stretchDifficulty: stretch,
        problems: assigned,
        revisionTasks: [...takeUpsolve(), 'After the set, note which problems you misjudged and why.'],
        notes,
      });
      lastPhase = 6;
    } else {
      const a = practicePool[role.n % practicePool.length]!;
      const b = practicePool[(role.n + 3) % practicePool.length]!;
      const pair = a === b ? [a] : [a, b];
      const { assigned, notes } = select(pair.map((t) => t.name).join(' + '), [...new Set(pair.flatMap((t) => t.cfTags))], [], range, stretch);
      drafts.push({
        ...base,
        type: 'practice',
        phase: 5,
        phaseName: PHASE_NAMES[5],
        topicId: null,
        topic: 'Target-level mixed practice',
        subtopic: pair.map((t) => t.name).join(' + '),
        objective: 'Apply known techniques on problems around your target difficulty, mixing two topics.',
        concept:
          'Mixed sets make you choose between techniques, which is the real skill in contests. Before coding, write down which technique you think applies and why.',
        whyItMatters: 'Problems near your target rating are what you need to solve reliably in contests.',
        learnMinutes: learn,
        practiceMinutes: totalMinutes - learn,
        difficulty: range,
        stretchDifficulty: stretch,
        problems: assigned,
        revisionTasks: [...takeUpsolve(), `Revise ${pair.map((t) => t.name).join(' and ')} notes before starting.`],
        notes,
      });
      lastPhase = 5;
    }
  }

  const notes: string[] = [];
  if (curve.capped) {
    notes.push(`Practice difficulty rises by at most 700 in 90 days (from ${curve.start} to ${curve.end}). The rest of the gap to ${input.targetRating} is left for a follow-up plan.`);
  }
  if (topicPlan.deferredTopics.length) {
    notes.push(`Not enough study days for every topic. Deferred: ${topicPlan.deferredTopics.map((t) => t.name).join(', ')}.`);
  }
  if (input.startingRating < 800) {
    notes.push('Codeforces has no rated problems below 800, so early days use the most-solved 800-rated problems.');
  }

  return {
    assessment,
    benchmark,
    practiceStart: curve.start,
    practiceEnd: curve.end,
    rampCapped: curve.capped,
    mandatoryProblems: mandatoryCount,
    topics: plannedTopics.map((t) => t.name),
    revisionTopics: topicPlan.revisionTopics.map((t) => t.name),
    deferredTopics: topicPlan.deferredTopics.map((t) => t.name),
    days: drafts.map((d) => ({ ...d, ...(tagsByDay.get(d.dayNumber) ?? { topicTags: [], fallbackTags: [] }) })),
    notes,
  };
}
