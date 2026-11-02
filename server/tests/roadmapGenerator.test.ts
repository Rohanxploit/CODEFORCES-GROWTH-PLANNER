import { describe, expect, it } from 'vitest';
import { addDays, defaultMandatoryProblems, generateRoadmap, restPositions, type RoadmapGeneratorInput } from '../src/services/roadmapGenerator.service.js';
import { createDifficultyCurve } from '../src/services/difficultyProgression.service.js';
import { orderByPrerequisites, planTopics } from '../src/services/topicPlanner.service.js';
import { TOPICS, topicById } from '../src/config/heuristics/topics.js';
import { makeCatalog } from './fixtures/catalog.js';

const catalog = makeCatalog(1500);

function input(overrides: Partial<RoadmapGeneratorInput> = {}): RoadmapGeneratorInput {
  return {
    startingRating: 1200,
    targetRating: 1600,
    hoursPerDay: 2,
    daysPerWeek: 6,
    contestParticipation: true,
    startDate: '2026-01-05',
    seed: 'test-seed',
    ...overrides,
  };
}

const learnTopics = (r: ReturnType<typeof generateRoadmap>) => [...new Set(r.days.filter((d) => d.type === 'learn').map((d) => d.topicId))];
const allProblems = (r: ReturnType<typeof generateRoadmap>) => r.days.flatMap((d) => d.problems);

describe('topic library', () => {
  it('has unique ids, known prerequisites and no cycles', () => {
    const ids = TOPICS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TOPICS) for (const p of t.prerequisites) expect(topicById(p), `${t.id} → ${p}`).toBeDefined();
    expect(orderByPrerequisites(TOPICS)).toHaveLength(TOPICS.length);
  });

  it('never orders a topic before its prerequisites', () => {
    const order = orderByPrerequisites(TOPICS).map((t) => t.id);
    for (const t of TOPICS) for (const p of t.prerequisites) expect(order.indexOf(p)).toBeLessThan(order.indexOf(t.id));
  });
});

describe('planTopics', () => {
  it('starts beginners with fundamentals and avoids advanced topics', () => {
    const plan = planTopics({ startingRating: 0, rampEnd: 800, learnDays: 60 });
    const ids = plan.blocks.map((b) => b.topic.id);
    expect(ids[0]).toBe('fundamentals');
    for (const advanced of ['dp-basics', 'segment-trees', 'graph-fundamentals', 'binary-search-answer', 'dsu']) expect(ids).not.toContain(advanced);
  });

  it('treats topics far below the rating as revision only', () => {
    const plan = planTopics({ startingRating: 1600, rampEnd: 1900, learnDays: 60 });
    const ids = plan.blocks.map((b) => b.topic.id);
    expect(ids).not.toContain('fundamentals');
    expect(ids).toContain('dp-intermediate');
    expect(plan.revisionTopics.map((t) => t.id)).toContain('greedy');
  });

  it('compresses topics to fit fewer study days', () => {
    const plan = planTopics({ startingRating: 1200, rampEnd: 1600, learnDays: 10 });
    expect(plan.blocks.reduce((a, b) => a + b.days, 0)).toBeLessThanOrEqual(10);
    expect(plan.blocks.every((b) => b.days >= 1)).toBe(true);
  });
});

describe('difficulty curve', () => {
  it('starts near the current rating and approaches the target', () => {
    const curve = createDifficultyCurve({ startingRating: 1200, targetRating: 1600, benchmark: 1900, hoursPerDay: 2 });
    expect(curve.rangeAt(0)).toEqual({ min: 1100, max: 1300 });
    expect(curve.rangeAt(1)).toEqual({ min: 1500, max: 1700 });
    expect(curve.stretchAt(1)!.max).toBeLessThanOrEqual(1900);
  });

  it('caps very large gaps', () => {
    const curve = createDifficultyCurve({ startingRating: 800, targetRating: 2400, benchmark: 2700, hoursPerDay: 2 });
    expect(curve.capped).toBe(true);
    expect(curve.end - curve.start).toBe(700);
  });

  it('keeps beginners on 800-rated problems at the start', () => {
    const curve = createDifficultyCurve({ startingRating: 100, targetRating: 400, benchmark: 700, hoursPerDay: 1 });
    expect(curve.rangeAt(0)).toEqual({ min: 800, max: 800 });
  });
});

describe('generateRoadmap', () => {
  const base = generateRoadmap(catalog, input());

  it('produces exactly 90 consecutive calendar days', () => {
    expect(base.days).toHaveLength(90);
    base.days.forEach((d, i) => {
      expect(d.dayNumber).toBe(i + 1);
      expect(d.date).toBe(addDays('2026-01-05', i));
    });
    expect(base.days[89]!.date).toBe('2026-04-04');
  });

  it('gives every practice day a topic, objective and concept', () => {
    for (const d of base.days.filter((x) => x.type !== 'rest')) {
      expect(d.topic).toBeTruthy();
      expect(d.objective).toBeTruthy();
      expect(d.concept).toBeTruthy();
    }
  });

  it('produces different plans for different starting ratings', () => {
    const beginner = generateRoadmap(catalog, input({ startingRating: 100, targetRating: 400 }));
    const pupil = generateRoadmap(catalog, input({ startingRating: 1200, targetRating: 1450 }));
    const expert = generateRoadmap(catalog, input({ startingRating: 1700, targetRating: 1850 }));
    const [a, b, c] = [learnTopics(beginner), learnTopics(pupil), learnTopics(expert)];
    expect(a[0]).toBe('fundamentals');
    expect(a).not.toEqual(b);
    expect(b).not.toEqual(c);
    expect(c).toContain('dp-intermediate');
    expect(b).toContain('binary-search-answer');
  });

  it('produces different plans for different targets', () => {
    const modest = generateRoadmap(catalog, input({ targetRating: 1300 }));
    const ambitious = generateRoadmap(catalog, input({ targetRating: 1900 }));
    expect(modest.practiceEnd).toBeLessThan(ambitious.practiceEnd);
    expect(learnTopics(modest)).not.toEqual(learnTopics(ambitious));
  });

  it('scales the daily workload with study hours', () => {
    const light = generateRoadmap(catalog, input({ hoursPerDay: 1 }));
    const heavy = generateRoadmap(catalog, input({ hoursPerDay: 4 }));
    const firstLearn = (r: typeof light) => r.days.find((d) => d.type === 'learn')!;
    expect(firstLearn(light).learnMinutes + firstLearn(light).practiceMinutes).toBe(60);
    expect(firstLearn(heavy).learnMinutes + firstLearn(heavy).practiceMinutes).toBe(240);
    expect(firstLearn(light).problems.filter((p) => p.mandatory)).toHaveLength(1);
    expect(firstLearn(heavy).problems.filter((p) => p.mandatory)).toHaveLength(3);
    expect(defaultMandatoryProblems(2)).toBe(2);
  });

  it('respects a manual mandatory problem count', () => {
    const r = generateRoadmap(catalog, input({ mandatoryProblems: 1 }));
    expect(r.days.find((d) => d.type === 'learn')!.problems.filter((p) => p.mandatory)).toHaveLength(1);
  });

  it.each([1, 3, 5, 7])('respects %i study days per week', (daysPerWeek) => {
    const r = generateRoadmap(catalog, input({ daysPerWeek }));
    for (let w = 0; w < 12; w++) {
      const week = r.days.slice(w * 7, w * 7 + 7);
      expect(week.filter((d) => d.type === 'rest')).toHaveLength(7 - daysPerWeek);
    }
    expect(restPositions(daysPerWeek).size).toBe(7 - daysPerWeek);
  });

  it('includes contest days, or virtual contests when contests are not possible', () => {
    expect(base.days.filter((d) => d.type === 'contest').length).toBeGreaterThan(5);
    const noContests = generateRoadmap(catalog, input({ contestParticipation: false }));
    const contests = noContests.days.filter((d) => d.type === 'contest');
    expect(contests.length).toBeGreaterThan(0);
    expect(contests.every((d) => d.topic === 'Virtual contest')).toBe(true);
    expect(noContests.days[contests[0]!.dayNumber]!.revisionTasks.join(' ') + noContests.days.slice(contests[0]!.dayNumber).find((d) => d.type !== 'rest')!.revisionTasks.join(' ')).toMatch(/Upsolve/);
  });

  it('ends with a final assessment', () => {
    const study = base.days.filter((d) => d.type !== 'rest');
    expect(study[study.length - 1]!.type).toBe('assessment');
  });

  it('respects topic prerequisites in the schedule', () => {
    for (const profile of [input({ startingRating: 0, targetRating: 600 }), input(), input({ startingRating: 1600, targetRating: 2000 })]) {
      const r = generateRoadmap(catalog, profile);
      const firstDay = new Map<string, number>();
      for (const d of r.days) if (d.topicId && !firstDay.has(d.topicId)) firstDay.set(d.topicId, d.dayNumber);
      for (const [id, day] of firstDay) {
        for (const pre of topicById(id)!.prerequisites) {
          if (firstDay.has(pre)) expect(firstDay.get(pre)!).toBeLessThan(day);
        }
      }
    }
  });

  it('raises practice difficulty sensibly over the plan', () => {
    const study = base.days.filter((d) => d.type === 'learn' || d.type === 'practice');
    const avg = (xs: typeof study) => xs.reduce((s, d) => s + (d.difficulty.min + d.difficulty.max) / 2, 0) / xs.length;
    expect(avg(study.slice(0, 10))).toBeLessThan(avg(study.slice(-10)));
    expect(avg(study.slice(0, 10))).toBeLessThanOrEqual(1300);
    expect(Math.max(...study.slice(-10).map((d) => d.difficulty.max))).toBeLessThanOrEqual(1700);
    // Revision days are easier than the surrounding content.
    const rev = base.days.find((d) => d.type === 'revision' && d.dayNumber > 40)!;
    const near = base.days.find((d) => d.type === 'learn' && d.dayNumber > rev.dayNumber)!;
    expect(rev.difficulty.max).toBeLessThanOrEqual(near.difficulty.max);
  });

  it('does not assign benchmark-level problems early', () => {
    for (const d of base.days.slice(0, 15)) {
      for (const p of d.problems) expect(p.rating).toBeLessThanOrEqual(1500);
    }
    for (const p of allProblems(base)) expect(p.rating).toBeLessThanOrEqual(base.benchmark);
    const lateStretch = base.days.slice(-10).flatMap((d) => d.problems.filter((p) => p.role === 'stretch'));
    expect(Math.max(...lateStretch.map((p) => p.rating))).toBeGreaterThanOrEqual(1700);
  });

  it('never repeats a problem and honours manual exclusions', () => {
    const excluded = allProblems(base).slice(0, 5).map((p) => p.problemId);
    const r = generateRoadmap(catalog, input({ excludedProblemIds: excluded }));
    const ids = allProblems(r).map((p) => p.problemId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of excluded) expect(ids).not.toContain(id);
  });

  it('assigns only problems with valid metadata and official URLs', () => {
    const byId = new Map(catalog.map((p) => [p.problemId, p]));
    for (const p of allProblems(base)) {
      const source = byId.get(p.problemId)!;
      expect(source).toBeDefined();
      expect(p.name).toBe(source.name);
      expect(p.rating).toBe(source.rating);
      expect(p.url).toBe(`https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`);
      expect(p.estimatedMinutes).toBeGreaterThan(0);
      expect(p.reason).toBeTruthy();
    }
  });

  it('is deterministic for the same input', () => {
    const again = generateRoadmap(catalog, input());
    expect(allProblems(again).map((p) => p.problemId)).toEqual(allProblems(base).map((p) => p.problemId));
  });

  it('applies an adaptive offset only from the given day', () => {
    const adapted = generateRoadmap(catalog, input({ difficultyOffset: 100, offsetFromDay: 50 }));
    expect(adapted.days[10]!.difficulty).toEqual(base.days[10]!.difficulty);
    const day = adapted.days.findIndex((d, i) => i >= 49 && d.type === 'learn');
    expect(adapted.days[day]!.difficulty.max).toBeGreaterThan(base.days[day]!.difficulty.max - 1);
  });

  it('handles maintenance targets and very large gaps without failing', () => {
    const maintenance = generateRoadmap(catalog, input({ startingRating: 1500, targetRating: 1400 }));
    expect(maintenance.assessment.difficulty).toBe('maintenance');
    expect(maintenance.practiceEnd).toBe(maintenance.practiceStart);
    const huge = generateRoadmap(catalog, input({ startingRating: 800, targetRating: 2400 }));
    expect(huge.rampCapped).toBe(true);
    expect(huge.notes.join(' ')).toMatch(/at most 700/);
  });

  it('works for very high ratings', () => {
    const r = generateRoadmap(catalog, input({ startingRating: 2400, targetRating: 2600 }));
    expect(r.days).toHaveLength(90);
    expect(allProblems(r).length).toBeGreaterThan(50);
  });
});
