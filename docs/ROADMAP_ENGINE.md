# Roadmap engine

Source: `server/src/services/roadmapGenerator.service.ts`, `topicPlanner.service.ts`, `difficultyProgression.service.ts`, `problemBenchmark.service.ts`, `goalEngine.service.ts`, and the heuristics in `server/src/config/heuristics/`.

## Inputs

| Input | Used for |
|---|---|
| Starting rating | Skill classification, topic window, start of the difficulty curve. **The only skill input.** |
| Target rating | Goal assessment, end of the difficulty curve, benchmark |
| Benchmark (target + 300) | Upper cap for optional stretch problems |
| Hours per day | Learning/practice minutes, mandatory problem count, stretch on/off, a slightly flatter curve under 1 h |
| Days per week | Rest days |
| Contest participation | Rated contest days from week 2, or virtual contests from week 3 |
| Seed | Deterministic tie-breaking in problem selection |
| Exclusions | Problems marked "already solved"/"exclude", and problems on kept days when regenerating |
| Difficulty offset | Adaptive ±100/±200 shift from a given day |

The output is identical for identical inputs and catalog.

## 1. Calendar

- 90 consecutive calendar days from the start date.
- **Rest days** within each 7-day block: for `r = 7 − daysPerWeek` rest days, positions `6 − round(j·7/r)` for `j = 0..r−1`. They are spread out and lean towards the end of the week.
- **Contest day:** the last study day of each week from week 2 (rated), or from week 3 (virtual). With fewer than 3 study days a week, only every other week.
- **Weekly revision:** the first study day of each week from week 2. With fewer than 4 study days a week, every other week.
- **Final assessment:** the last study day.
- The remaining study days are **content days**.

## 2. Topic planning

The [topic library](../server/src/config/heuristics/topics.ts) is a pool of 38 topics in six phases. Each topic has an `entryRating`, `prerequisites`, Codeforces `cfTags`, `fallbackTags`, and 2–4 subtopics (one study day each when time allows).

Given the starting rating `R` and the end of the difficulty ramp `E`:

1. **Known topics:** `entryRating < R − 300` become revision material (used on revision and mixed days).
2. **Planned topics:** `R − 300 ≤ entryRating ≤ max(E, R) + 200`, plus any prerequisites that aren't known.
3. **Order:** Kahn's topological sort, always taking the ready topic with the lowest entry rating, so prerequisites always come first.
4. **Fit:** learning capacity = content days − 12% (final phase) − 10% (minimum target-level practice). With more topics than days, the most advanced topics that are nobody's prerequisite are deferred (and listed in the plan notes). With too many subtopic days, each topic is scaled down proportionally, keeping at least 1 day each.
5. Content days after the topic blocks become **target-level mixed practice** (phase 5), rotating pairs of planned and recent known topics. The last 12% become **timed mixed practice** (phase 6) with no topic hint.

Examples from the live-data verification run:

| Profile | First topics |
|---|---|
| 0 → 400 | Programming fundamentals → Implementation → Arrays and frequency counting → … |
| 900 → 1200 | Core data structures → Brute force → Greedy → Prefix sums → Binary search … |
| 1200 → 1600 | Prefix sums → Binary search → Number theory basics → Two pointers → … → DP basics → Graphs |
| 1700 → 1900 | BFS and DFS → Trees → Intermediate DP → DSU → … → Segment trees |
| 2000 → 2150 | Combinatorics → Range query data structures → Shortest paths → … → Flows and matchings |

## 3. Difficulty progression

```
start = max(800, round100(R))
gap   = min(max(0, round100(T) − start), 700)      // capped at +700 per 90 days
gap   = gap · 0.85 if hours < 1
centre(p) = start + gap · smoothstep(p)            // p = study-day index / (study days − 1)
smoothstep(p) = 3p² − 2p³
```

| Day kind | Practice range |
|---|---|
| Normal | `[c − 100, c + 100]` with `c = round100(centre)` |
| First day of a topic | `[c − 200, c]` |
| Revision | `[c − 200, c]` |
| Beginner (R < 700) while `c = 800` | `[800, 800]` |

Every bound is at least 800. Because of the intro and revision dips the sequence is **not monotonic**, which is intentional.

**Stretch range** (only from 1 h a day): `min = c + offset(p)`, `max = min(benchmark, min + 100)`, with `offset(p) = 100 + round(2p)·100`, i.e. +100 → +200 → +300. It never exceeds the benchmark. If the benchmark is not above the day's normal maximum there is no stretch problem.

Example, 1200 → 1600 (benchmark 1900): days 1–15 practise about 1000–1300, the middle weeks 1200–1500, the last weeks 1500–1700, with stretch problems reaching 1800–1900 only near the end.

## 4. Workload

| Hours/day | Mandatory problems (default) | Stretch |
|---|---|---|
| < 1 | 1 | no |
| 1 – 1.4 | 1 | yes |
| 1.5 – 3.9 | 2 | yes |
| ≥ 4 | 3 | yes |

The user can choose 1–3 mandatory problems instead. On topic days learning time is `clamp(30% of daily minutes, 15, 60)`; on practice and revision days `clamp(15%, 10, 30)`. With 3 h or more there's an extra revision task to attempt the stretch problem before reading hints. Contest days note when a 2-hour contest exceeds the usual daily time.

## 5. Daily plan content

Every day stores: day number, date, week, type, phase, topic, subtopic, objective, concept explanation, why it matters, prerequisites, learning and practice minutes, practice and stretch ranges, assigned problems (with reason and estimated minutes), revision tasks, "if you get stuck" steps, notes, status and feedback.

Revision tasks come from: topic prerequisites (first day of a topic), recalling the previous day's idea, upsolving after a contest day, weekly re-solving of hint- or editorial-assisted problems, and adaptive revision.

## 6. Goal assessment

| Classification | Condition |
|---|---|
| maintenance | target ≤ current |
| conservative | target ≤ conservative goal |
| recommended | target ≤ recommended goal |
| ambitious | target ≤ stretch goal (warning) |
| very-ambitious | target > stretch goal (stronger warning; a large-gap note if 600+ beyond stretch) |

Goal table: [`goals.ts`](../server/src/config/heuristics/goals.ts). Above 1999 the goals are extrapolated as +50/+100/+150 and flagged as such.

## 7. Regeneration

`regenerateFrom(roadmap, fromDay)` reruns the generator with the stored seed and current settings, and replaces only days that are `pending`, have no feedback, have no recorded outcomes and are on or after `fromDay`. Problems on kept days are excluded from the new selection. It is used by settings changes (from today) and by difficulty adaptation (from the next day).
