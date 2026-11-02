import { describe, expect, it } from 'vitest';
import { classifyRating } from '../src/services/ratingLevel.service.js';
import { assessGoal, recommendGoals } from '../src/services/goalEngine.service.js';
import { calculateBenchmark, stretchOffset } from '../src/services/problemBenchmark.service.js';

describe('classifyRating', () => {
  it.each([
    [0, 'Newbie', 'Beginner', true],
    [100, 'Newbie', 'Beginner', true],
    [200, 'Newbie', 'Beginner', false],
    [500, 'Newbie', 'Beginner', false],
    [800, 'Newbie', 'Beginner', false],
    [1000, 'Newbie', 'Beginner', false],
    [1199, 'Newbie', 'Beginner', false],
    [1200, 'Pupil', 'Basic problem solver', false],
    [1400, 'Specialist', 'Intermediate', false],
    [1600, 'Expert', 'Advanced', false],
    [1899, 'Expert', 'Advanced', false],
    [1900, 'Candidate Master', 'Advanced problem solver', false],
    [2100, 'Master', 'High-level training', false],
    [2300, 'International Master or above', 'Advanced training', false],
    [3500, 'International Master or above', 'Advanced training', false],
  ])('rating %i → %s / %s', (rating, rank, classification, fundamentals) => {
    const level = classifyRating(rating);
    expect(level.rank).toBe(rank);
    expect(level.classification).toBe(classification);
    expect(level.needsFundamentals).toBe(fundamentals);
  });

  it.each([-1, 4001, 1200.5, Number.NaN])('rejects invalid rating %s', (rating) => {
    expect(() => classifyRating(rating)).toThrow(RangeError);
  });
});

describe('recommendGoals', () => {
  it.each([
    [0, 300, 400, 600],
    [150, 300, 400, 600],
    [250, 400, 600, 800],
    [500, 600, 800, 1000],
    [700, 750, 950, 1150],
    [800, 900, 1050, 1200],
    [1000, 1100, 1250, 1400],
    [1200, 1300, 1450, 1550],
    [1400, 1500, 1650, 1750],
    [1600, 1700, 1850, 1950],
    [1999, 1900, 2050, 2150],
  ])('rating %i → %i / %i / %i', (rating, conservative, recommended, stretch) => {
    expect(recommendGoals(rating)).toEqual({ conservative, recommended, stretch, extrapolated: false });
  });

  it('extrapolates smaller gains above the table', () => {
    expect(recommendGoals(2100)).toEqual({ conservative: 2150, recommended: 2200, stretch: 2250, extrapolated: true });
  });
});

describe('assessGoal', () => {
  it('classifies a conservative target without a warning', () => {
    const a = assessGoal(1200, 1300);
    expect(a.difficulty).toBe('conservative');
    expect(a.warning).toBeNull();
    expect(a.ratingGap).toBe(100);
  });

  it('classifies the recommended target', () => {
    expect(assessGoal(1200, 1450).difficulty).toBe('recommended');
  });

  it('warns for a target between recommended and stretch', () => {
    const a = assessGoal(1200, 1550);
    expect(a.difficulty).toBe('ambitious');
    expect(a.warning).toContain('1450');
  });

  it('warns strongly for a target above stretch and still assesses it', () => {
    const a = assessGoal(1200, 1900);
    expect(a.difficulty).toBe('very-ambitious');
    expect(a.warning).toMatch(/well beyond/);
    expect(a.benchmark).toBe(2200);
    expect(a.targetRank).toBe('Candidate Master');
  });

  it('adds a large-gap note for huge targets', () => {
    const a = assessGoal(800, 2400);
    expect(a.notes.some((n) => n.includes('very large gap'))).toBe(true);
  });

  it('treats a target below the current rating as maintenance', () => {
    const a = assessGoal(1500, 1400);
    expect(a.difficulty).toBe('maintenance');
    expect(a.ratingGap).toBe(-100);
    expect(a.notes[0]).toMatch(/maintenance or lower milestone/);
  });

  it('never promises an outcome', () => {
    const a = assessGoal(1000, 1250);
    expect(a.notes.join(' ')).toMatch(/not predictions/);
  });

  it('rejects invalid targets', () => {
    expect(() => assessGoal(1200, -5)).toThrow(RangeError);
    expect(() => assessGoal(1200, 5000)).toThrow(RangeError);
    expect(() => assessGoal(1200, 1300.5)).toThrow(RangeError);
  });
});

describe('calculateBenchmark', () => {
  it.each([
    [800, 1100],
    [1000, 1300],
    [1200, 1500],
    [1400, 1700],
    [1600, 1900],
    [1900, 2200],
    [2100, 2400],
  ])('target %i → benchmark %i', (target, benchmark) => {
    expect(calculateBenchmark(target)).toBe(benchmark);
  });

  it('caps at the maximum rating', () => {
    expect(calculateBenchmark(3900)).toBe(4000);
  });

  it('widens stretch offset from +100 to +300', () => {
    expect(stretchOffset(0)).toBe(100);
    expect(stretchOffset(0.5)).toBe(200);
    expect(stretchOffset(1)).toBe(300);
  });
});
