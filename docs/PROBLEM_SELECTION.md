# Problem selection

Source: `server/src/services/problemSelector/`, `codeforces.service.ts`, `problemCatalog.service.ts`.

## Data

- Fetched from the official `https://codeforces.com/api/problemset.problems` endpoint and normalised by `fetchProblemset.ts`:
  - `problemId` (`{contestId}{index}`), contest id, index, name, rating (or `null`), tags (possibly empty), solved count (or `null`)
  - URL: `https://codeforces.com/problemset/problem/{contestId}/{index}`
  - Dropped: entries without a contest id, index or name; non-`PROGRAMMING` types; problems tagged `*special` (e.g. April Fools); duplicates
- `ProblemCatalog` keeps the set in memory and in MongoDB (`problems` collection). It refreshes at most once every 24 h, serves the last good copy (flagged stale) when Codeforces fails, waits 10 minutes before retrying, and deduplicates concurrent refreshes.
- `CodeforcesClient` sends every request through one queue spaced ≥ 2.1 s apart (Codeforces asks for at most one call per 2 s), with a 15 s timeout. It maps responses to `NOT_FOUND`, `INVALID_HANDLE`, `RATE_LIMITED` (HTTP 429 or "Call limit exceeded"), `TIMEOUT`, `UNAVAILABLE` and `BAD_RESPONSE`. Profiles are cached for 10 minutes and the contest list for 1 hour.
- **Submission history is never requested.**

## The five stages

`selectDailyProblems(catalog, request, exclusion)` picks, in order: a **core** problem, `mandatoryCount − 1` **reinforcement** problems, and an optional **stretch** problem. Each pick runs the stages below; chosen problems are added to the exclusion set immediately, so later picks and later days never repeat them.

### 1. Topic relevance (`filterByTopic.ts`)

The candidate must share at least one tag with the day's topic tags (mixed days have no tag filter).

```
relevance = 0.5 + 0.5 · (matching tags / total tags)     // 0 if no match
```

A problem tagged only `binary search` is more relevant to a binary search day than one tagged with five unrelated tags. Tags describe *a* possible approach, not *the* solution, so they rank candidates rather than define them.

### 2. Difficulty (`filterByDifficulty.ts`)

The rating must be inside the day's range. Unrated problems are never assigned. If a stage yields no candidates the range widens by 100, then 200 (stretch ranges widen downwards only, so they never pass the benchmark).

### 3. Quality (`calculateProblemScore.ts`)

```
score = 0.45 · relevance
      + 0.25 · difficultyFit            // 1 − min(|rating − rangeCentre|, 400) / 400
      + 0.20 · quality                   // log10(1 + solved) / log10(1 + max solved at that rating)
      + 0.10 · jitter(seed, problemId)   // FNV-1a hash → [0, 1)
```

- The solved count is a supporting signal and is compared only within the same rating, so 800-rated problems don't win on popularity alone.
- A missing solved count scores a neutral 0.4. A problem without tags loses 0.2 of its quality score.
- The seeded jitter makes different users get different problems, while the same seed always gives the same result. Exact ties go to the lower problem id.
- Reinforcement picks get +0.05 if they bring in a tag the core problem doesn't have (a different observation).

### 4. Variety (`ensureVariety.ts`)

A candidate must differ from every problem already chosen that day:

- different contest
- different name
- tag Jaccard similarity < 0.75

If no candidate passes, the check relaxes to "different contest and name".

### 5. Exclusion (`excludePreviouslyAssigned.ts`)

`ExclusionSet` holds:

- every problem already assigned in the roadmap
- the user's manual exclusions ("Already solved" or "Exclude")
- when regenerating, every problem on days that are kept

It also treats a problem with the **same name within 2 contest ids** as a duplicate. This catches Div. 1/Div. 2 parallel rounds that publish the same problem under two ids.

## Fallbacks and explanations

Order of attempts for each pick: topic tags at ±0, ±100, ±200, then fallback tags at ±0, ±100, ±200. If nothing is found the slot stays empty and a note is stored on the day. No problem is ever invented.

Every problem carries a reason, for example:

- *Direct practice of Binary search on the answer (tagged binary search), rated 1400, inside today's 1300–1500 range.*
- *Reinforces the same idea from a different angle (also involves greedy, sortings), rated 1400.*
- *Optional stretch at 1700, above today's range, to build towards harder problems.*
- *Few unused Prefix sums problems fit, so this uses a related tag (math). The rating range was widened by 100 because few unused problems matched.*

## Replacement

`POST /api/problems/replace` reruns the pipeline for that day with the same tags and range (the stretch range for a stretch problem). The current problem, all roadmap problems and the user's exclusions are excluded. The replacement keeps the role and the mandatory flag, and recorded progress for the replaced problem is removed.

## Estimated solving time

`25 + 10 · (rating − rangeCentre) / 100` minutes, +15 for stretch problems, clamped to 15–90 and rounded to 5.
